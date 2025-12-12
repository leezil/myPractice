const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { getConceptsByCategory, getAllConcepts } = require('./conceptCategories');
const { getTopicsByCategory, getAllTopics } = require('./topicCategories');
const { getProblems } = require('./problemParser');

// 클래스 정의 추출 함수
function extractClassDefinition(template) {
  if (!template) return null;
  
  const lines = template.split('\n');
  let classStartIndex = -1;
  let classEndIndex = -1;
  let braceCount = 0;
  
  // "class " 로 시작하는 줄 찾기 (첫 번째 클래스)
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('class ') && !trimmed.includes('Program')) {
      classStartIndex = i;
      break;
    }
  }
  
  if (classStartIndex === -1) return null;
  
  // 클래스 정의 추출 (중괄호 포함)
  braceCount = 0;
  for (let i = classStartIndex; i < lines.length; i++) {
    const line = lines[i];
    braceCount += (line.match(/{/g) || []).length;
    braceCount -= (line.match(/}/g) || []).length;
    
    if (braceCount <= 0 && line.includes('}')) {
      classEndIndex = i;
      break;
    }
  }
  
  if (classEndIndex === -1) return null;
  
  // 클래스 정의만 추출
  const classLines = lines.slice(classStartIndex, classEndIndex + 1);
  let classCode = classLines.join('\n');
  
  // 주석 제거하되 "여기에 클래스를 완성하세요"는 유지
  classCode = classCode.replace(/\/\/.*$/gm, (match) => {
    if (match.includes('여기에 클래스를 완성하세요')) {
      return match;
    }
    return '';
  });
  
  // 빈 줄 정리
  classCode = classCode.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return classCode.trim();
}

// 메소드 시그니처 추출 함수 (메소드 만들기 문제용)
function extractMethodSignature(template) {
  if (!template) return null;
  
  const lines = template.split('\n');
  
  // "// 여기에 코드를 작성하세요" 주석이 있는 줄 찾기
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// 여기에 코드를 작성하세요')) {
      // 이전 줄들에서 메소드 시그니처 찾기
      for (let j = i - 1; j >= 0; j--) {
        const line = lines[j].trim();
        // 메소드 시그니처 패턴: public/private/protected + 반환타입 + 메소드명 + (매개변수)
        if (line.includes('(') && line.includes(')') && 
            (line.includes('public') || line.includes('private') || line.includes('protected') || line.includes('internal'))) {
          // 메소드 시그니처와 여는 중괄호까지 포함
          let methodSignature = line;
          
          // 다음 줄이 여는 중괄호인지 확인
          if (i + 1 < lines.length && lines[i + 1].trim() === '{') {
            methodSignature += '\n' + lines[i + 1];
          } else if (line.endsWith('{')) {
            // 시그니처와 같은 줄에 중괄호가 있는 경우
            methodSignature = line;
          } else {
            // 중괄호가 없으면 추가
            methodSignature += '\n{';
          }
          
          // 주석 추가
          methodSignature += '\n  // 여기에 코드를 작성하세요';
          methodSignature += '\n}';
          
          return methodSignature;
        }
      }
      break;
    }
  }
  
  return null;
}

// 간단한 코드 추출 함수 (extractCodeParts 대체)
function extractCodeToWrite(problem) {
  if (problem.codeToWrite) {
    return problem.codeToWrite;
  }
  
  if (problem.template && problem.template.includes('/* 빈칸 */')) {
    return '/* 빈칸 */';
  }
  return problem.template || '';
}

function getFullCode(problem) {
  // 전체 코드 섹션에는 예제 코드 또는 완전한 템플릿 표시
  if (problem.exampleCode) {
    return problem.exampleCode;
  }
  return problem.template || '';
}

// .NET SDK 사용 가능 여부 확인 (캐시 사용)
async function checkDotNetSDKAvailable() {
  // 캐시된 결과가 있으면 반환
  if (dotNetSDKCache !== null) {
    return dotNetSDKCache;
  }
  
  // 실제 확인 수행
  const result = await checkDotNetSDKAvailableInternal();
  dotNetSDKCache = result;
  return result;
}

// .NET SDK 사용 가능 여부 확인 (내부 함수)
async function checkDotNetSDKAvailableInternal() {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const fs = require('fs');
  const path = require('path');
  const execAsync = promisify(exec);
  
  // 여러 경로 시도 (우선순위 순)
  const possiblePaths = [
    process.env.DOTNET_ROOT,
    '/opt/render/.dotnet',  // Render 기본 설치 경로
    `${process.env.HOME || '/home/render'}/.dotnet`,
    '/usr/share/dotnet',
    '/opt/dotnet'
  ];
  
  console.log('[.NET SDK 확인 시작]');
  console.log('[환경변수 DOTNET_ROOT]:', process.env.DOTNET_ROOT);
  console.log('[환경변수 PATH]:', process.env.PATH);
  
  // 먼저 dotnet 실행 파일이 실제로 존재하는지 확인
  for (const dotnetPath of possiblePaths) {
    if (!dotnetPath) continue;
    try {
      const dotnetExe = path.join(dotnetPath, 'dotnet');
      if (fs.existsSync(dotnetExe)) {
        console.log('[.NET SDK 실행 파일 발견]', dotnetExe);
        const env = { ...process.env };
        env.PATH = `${dotnetPath}:${env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'}`;
        env.DOTNET_ROOT = dotnetPath;
        
        try {
          const { stdout } = await execAsync('dotnet --version', { 
            timeout: 5000,
            maxBuffer: 1024 * 1024,
            env: env
          });
          console.log('[.NET SDK] 사용 가능 (경로:', dotnetPath, '), 버전:', stdout.trim());
          return { available: true, version: stdout.trim(), path: dotnetPath };
        } catch (e) {
          console.log('[.NET SDK] 실행 실패 (경로:', dotnetPath, '):', e.message);
          continue;
        }
      }
    } catch (e) {
      // 다음 경로 시도
    }
  }
  
  // 실행 파일을 찾지 못했으면 PATH에 추가해서 시도
  console.log('[.NET SDK] 실행 파일을 찾지 못함, PATH에 추가해서 시도');
  for (const dotnetPath of possiblePaths) {
    if (!dotnetPath) continue;
    try {
      const env = { ...process.env };
      env.PATH = `${dotnetPath}:${env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'}`;
      env.DOTNET_ROOT = dotnetPath;
      
      // 먼저 절대 경로로 시도
      const dotnetExe = path.join(dotnetPath, 'dotnet');
      let stdout;
      try {
        if (fs.existsSync(dotnetExe)) {
          const result = await execAsync(`"${dotnetExe}" --version`, { 
            timeout: 5000,
            maxBuffer: 1024 * 1024,
            env: env
          });
          stdout = result.stdout;
        } else {
          // PATH에서 찾기
          const result = await execAsync('dotnet --version', { 
            timeout: 5000,
            maxBuffer: 1024 * 1024,
            env: env
          });
          stdout = result.stdout;
        }
        console.log('[.NET SDK] 사용 가능 (경로:', dotnetPath, '), 버전:', stdout.trim());
        return { available: true, version: stdout.trim(), path: dotnetPath };
      } catch (e) {
        console.log('[.NET SDK] 시도 실패 (경로:', dotnetPath, '):', e.message);
        continue;
      }
    } catch (e) {
      console.log('[.NET SDK] 시도 실패 (경로:', dotnetPath, '):', e.message);
    }
  }
  
  console.log('[.NET SDK] 사용 불가 - 모든 경로 시도 실패');
  return { available: false };
}

async function checkDockerAvailable() {
  return false; // Docker는 사용하지 않음
}

// C# 코드 컴파일 검증
async function validateCodeLocally(code, problemId) {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const fs = require('fs');
  const path = require('path');
  const execAsync = promisify(exec);
  
  const tempDir = path.join(__dirname, 'temp-validation');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const timestamp = Date.now();
  const projectDir = path.join(tempDir, `proj_${timestamp}`);
  const csFile = path.join(projectDir, 'Program.cs');
  
  // .NET SDK 경로 찾기 (캐시된 정보 사용)
  let dotnetPath = null;
  let dotnetExe = 'dotnet'; // 기본값: PATH에서 찾기
  
  if (dotNetSDKCache && dotNetSDKCache.available && dotNetSDKCache.path) {
    dotnetPath = dotNetSDKCache.path;
    dotnetExe = path.join(dotnetPath, 'dotnet');
    console.log('[컴파일 검증] 캐시된 .NET SDK 경로 사용:', dotnetPath);
  } else {
    // 캐시가 없으면 다시 찾기
    const possiblePaths = [
      process.env.DOTNET_ROOT,
      '/opt/render/.dotnet',  // Render 기본 설치 경로
      `${process.env.HOME || '/home/render'}/.dotnet`,
      '/usr/share/dotnet',
      '/opt/dotnet'
    ];
    
    // 실제 dotnet 실행 파일이 있는지 확인
    for (const testPath of possiblePaths) {
      if (!testPath) continue;
      try {
        const testExe = path.join(testPath, 'dotnet');
        if (fs.existsSync(testExe)) {
          dotnetPath = testPath;
          dotnetExe = testExe;
          console.log('[컴파일 검증] .NET SDK 경로 발견:', testPath);
          break;
        }
      } catch (e) {}
    }
    
    // 경로를 찾지 못했으면 첫 번째 경로 시도
    if (!dotnetPath && possiblePaths[0]) {
      dotnetPath = possiblePaths[0];
      dotnetExe = path.join(dotnetPath, 'dotnet');
      console.log('[컴파일 검증] .NET SDK 경로 기본값 사용:', dotnetPath);
    }
  }
  
  // 환경변수 설정
  const env = { ...process.env };
  if (dotnetPath) {
    env.PATH = `${dotnetPath}:${env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'}`;
    env.DOTNET_ROOT = dotnetPath;
  }
  
  try {
    // 프로젝트 디렉토리 생성
    fs.mkdirSync(projectDir, { recursive: true });
    
    // 코드를 Program.cs에 저장
    console.log('[컴파일 검증] 저장할 코드 (처음 1000자):\n' + code.substring(0, 1000));
    fs.writeFileSync(csFile, code, 'utf-8');
    
    // .csproj 파일 생성
    const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>`;
    fs.writeFileSync(path.join(projectDir, 'proj.csproj'), csprojContent);
    
    // dotnet build 실행 (절대 경로 사용)
    console.log('[컴파일 검증] dotnet 빌드 실행:', dotnetExe);
    console.log('[컴파일 검증] 컴파일할 코드 (처음 1000자):\n' + code.substring(0, 1000));
    // DOTNET_CLI_TELEMETRY_OPTOUT 환경변수 설정하여 welcome 메시지 제거
    env.DOTNET_CLI_TELEMETRY_OPTOUT = '1';
    // 먼저 NuGet 패키지 복원
    try {
      await execAsync(`"${dotnetExe}" restore`, {
        timeout: 10000,
        maxBuffer: 1024 * 1024 * 10,
        cwd: projectDir,
        env: env
      });
    } catch (restoreError) {
      console.log('[컴파일 검증] restore 실패 (무시하고 계속):', restoreError.message);
    }
    // stderr도 stdout으로 리다이렉트하여 모든 출력 확인
    const { stdout, stderr } = await execAsync(`"${dotnetExe}" build 2>&1`, {
      timeout: 15000,
      maxBuffer: 1024 * 1024 * 10, // 10MB 버퍼 증가
      cwd: projectDir,
      env: env
    });
    
    // stdout에 welcome 메시지가 포함되어 있으면 제거
    const cleanOutput = stdout.split('\n')
      .filter(line => !line.includes('Welcome to .NET') && 
                      !line.includes('SDK Version:') &&
                      !line.includes('Telemetry') &&
                      !line.includes('Installed an ASP.NET Core') &&
                      !line.includes('Write your first app') &&
                      !line.includes('Find out what') &&
                      !line.includes('Explore documentation') &&
                      !line.includes('Report issues') &&
                      !line.includes('Use \'dotnet --help\''))
      .join('\n');
    
    if (stderr && stderr.trim()) {
      console.log('[컴파일 검증] 빌드 stderr:', stderr);
    }
    
    // 빌드 성공 여부 확인 (오류 메시지가 없으면 성공)
    const hasError = cleanOutput.toLowerCase().includes('error') || 
                     (stderr && stderr.toLowerCase().includes('error'));
    
    // 임시 디렉토리 삭제
    try {
      fs.rmSync(projectDir, { recursive: true, force: true });
    } catch (e) {
      console.log('[임시 파일 삭제 실패]', e.message);
    }
    
    if (hasError) {
      return { 
        success: false, 
        compiled: false, 
        output: cleanOutput,
        stdout: cleanOutput,
        stderr: stderr || ''
      };
    }
    
    return { success: true, compiled: true, output: cleanOutput };
  } catch (error) {
    // 임시 디렉토리 삭제
    try {
      fs.rmSync(projectDir, { recursive: true, force: true });
    } catch (e) {
      console.log('[임시 파일 삭제 실패]', e.message);
    }
    
    const errorMessage = error.stderr || error.stdout || error.message;
    console.log('[컴파일 검증 실패] 전체 오류 메시지:');
    console.log('stdout:', error.stdout || '없음');
    console.log('stderr:', error.stderr || '없음');
    console.log('message:', error.message || '없음');
    
    // 오류가 발생한 코드도 파일로 저장
    const errorDebugDir = path.join(__dirname, 'debug-output');
    if (!fs.existsSync(errorDebugDir)) {
      fs.mkdirSync(errorDebugDir, { recursive: true });
    }
    const errorDebugFile = path.join(errorDebugDir, `error_${problemId}_${Date.now()}.cs`);
    fs.writeFileSync(errorDebugFile, code, 'utf-8');
    console.log(`[컴파일 검증 실패] 오류 발생 코드 저장: ${errorDebugFile}`);
    
    return { 
      success: false, 
      compiled: false, 
      error: errorMessage,
      stdout: error.stdout || '',
      stderr: error.stderr || ''
    };
  }
}

async function validateCodeInDocker(code, problemId) {
  // Docker는 사용하지 않으므로 로컬 검증 사용
  return await validateCodeLocally(code, problemId);
}

const app = express();
const PORT = process.env.PORT || 5000;

// .NET SDK 정보 캐시
let dotNetSDKCache = null;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API 라우트

// 문제 목록 조회 API (과목별)
app.get('/api/:subject/problems', (req, res) => {
  const { subject } = req.params;
  const { type } = req.query;
  
  // 과목별 문제 로드
  const problems = getProblems(subject);
  let filteredProblems = problems;
  
  // 유형별 필터링
  if (type && type !== 'all') {
    filteredProblems = problems.filter(p => p.type === type);
  }
  
  // 개념 추출을 위해 template, answer, exampleCode, concepts도 포함
  res.json(filteredProblems.map(p => ({
    id: p.id,
    type: p.type,
    title: p.title,
    description: p.description,
    template: p.template,
    answer: p.answer,
    exampleCode: p.exampleCode,
    requirements: p.requirements,
    source: p.source,
    concepts: p.concepts || [], // concepts 필드 추가
    question: p.question, // 객관식 문제용
    options: p.options, // 객관식 문제용
    week: p.week || null // 부모교육 주차 정보
  })));
});

// 문제 상세 조회 API (과목별)
app.get('/api/:subject/problems/:id', (req, res) => {
  const { subject, id } = req.params;
  
  // 과목별 문제 로드
  const problems = getProblems(subject);
  const problem = problems.find(p => p.id === parseInt(id));
  if (!problem) {
    return res.status(404).json({ error: '문제를 찾을 수 없습니다.' });
  }
  
  // 객관식 문제는 코드 분리 불필요
  if (problem.type === 'multiple_choice') {
    return res.json({
      ...problem
      // answer는 포함되어 있지만, 프론트엔드에서 정답 보기 버튼을 눌렀을 때만 표시
    });
  }
  
  // 코드 분리
  const fullCode = getFullCode(problem);
  let codeToWrite = extractCodeToWrite(problem);
  
  // 클래스 정의 문제의 경우 특별 처리
  if (problem.type === 'class') {
    // 전체 코드 섹션: 전체 template 표시
    // 코드 작성 칸: 클래스 정의만 표시
    const classDefinition = extractClassDefinition(problem.template);
    if (classDefinition) {
      codeToWrite = classDefinition;
    }
  }
  
  // 메소드 만들기 문제의 경우 특별 처리
  if (problem.type === 'method') {
    // 전체 코드 섹션: 전체 template 표시
    // 코드 작성 칸: 메소드 시그니처만 표시
    const methodSignature = extractMethodSignature(problem.template);
    if (methodSignature) {
      codeToWrite = methodSignature;
    }
  }
  
  // 정답은 별도로 전달 (정답 보기 버튼용)
  // 전체 코드 섹션: 완전한 예제 코드 (보기용)
  // 코드 작성 칸: 작성할 부분만 (작성용)
  res.json({
    ...problem,
    fullCode: (problem.type === 'class' || problem.type === 'method') ? problem.template : codeToWrite, // 클래스/메소드 문제는 전체 template, 아니면 작성할 부분
    codeToWrite: (problem.type === 'class' || problem.type === 'method') ? codeToWrite : fullCode // 클래스/메소드 문제는 정의만, 아니면 전체 코드
    // answer는 포함되어 있지만, 프론트엔드에서 정답 보기 버튼을 눌렀을 때만 표시
  });
});

// 문제 제출 및 정답 확인 API (실시간 컴파일 검증, 과목별)
app.post('/api/:subject/problems/:id/submit', async (req, res) => {
  const { subject, id } = req.params;
  
  // 과목별 문제 로드
  const problems = getProblems(subject);
  const problem = problems.find(p => p.id === parseInt(id));
  if (!problem) {
    return res.status(404).json({ error: '문제를 찾을 수 없습니다.' });
  }

  // 객관식 문제 처리
  if (problem.type === 'multiple_choice') {
    const { selectedAnswer } = req.body;
    
    if (!selectedAnswer) {
      return res.json({
        success: false,
        message: '답을 선택해주세요.'
      });
    }
    
    const isCorrect = parseInt(selectedAnswer) === problem.answer;
    
    return res.json({
      success: true,
      isCorrect: isCorrect,
      message: isCorrect 
        ? '정답입니다! 🎉' 
        : '오답입니다. 다시 시도해보세요.',
      answer: problem.answer,
      selectedAnswer: parseInt(selectedAnswer)
    });
  }

  const { code } = req.body;
  
  if (!code || code.trim().length === 0) {
    return res.json({
      success: false,
      message: '코드를 입력해주세요.'
    });
  }

  // 사용자가 작성한 코드를 전체 코드에 삽입
  let userFullCode = '';
  let userCode = ''; // 사용자 입력 코드 부분 (정답 비교용)
  
  if (problem.type === 'fill') {
    // 빈칸 채우기: /* 빈칸 */ 주석을 사용자 코드로 대체
    userCode = code.trim();
    
    // 사용자가 입력한 코드가 여러 줄이고 빈칸 주석이 포함되어 있으면,
    // 빈칸 주석 다음의 의미있는 라인을 추출
    // 단, 사용자가 한 줄만 입력했다면 그대로 사용
    if (userCode.includes('\n') && userCode.includes('/* 빈칸 */')) {
      const userLines = userCode.split('\n');
      const userBlankIndex = userLines.findIndex(line => line.includes('/* 빈칸 */'));
      
      if (userBlankIndex !== -1) {
        // 빈칸 주석 바로 다음 라인부터 의미있는 코드 찾기
        let foundCode = false;
        for (let i = userBlankIndex + 1; i < userLines.length; i++) {
          const line = userLines[i].trim();
          if (line.length > 0 && 
              !line.startsWith('{') && 
              !line.startsWith('}') &&
              !line.startsWith('//') &&
              !line.startsWith('/*') &&
              !line.includes('/* 빈칸 */')) {
            userCode = line;
            foundCode = true;
            break;
          }
        }
        
        // 의미있는 라인을 찾지 못한 경우, 빈칸 주석만 제거
        if (!foundCode) {
          userCode = userCode.replace(/\/\*\s*빈칸\s*\*\//g, '').trim();
        }
      }
    } else if (userCode.includes('/* 빈칸 */')) {
      // 한 줄에 빈칸 주석이 포함된 경우, 주석만 제거
      userCode = userCode.replace(/\/\*\s*빈칸\s*\*\//g, '').trim();
    }
    
    // template에서 빈칸 다음에 사용되는 변수명 찾기
    // 예: Console.WriteLine(pt1); 에서 pt1을 찾음
    const templateLines = problem.template.split('\n');
    const blankIndex = templateLines.findIndex(line => line.includes('/* 빈칸 */'));
    let templateVariableName = null;
    
    if (blankIndex !== -1) {
      // 빈칸 다음 몇 줄에서 변수명 찾기
      // C# 키워드 목록 (변수명으로 사용 불가)
      const csharpKeywords = ['new', 'as', 'if', 'for', 'var', 'int', 'void', 'bool', 'string', 'object', 
                              'class', 'static', 'private', 'public', 'protected', 'internal', 'return',
                              'Console', 'System', 'using', 'namespace', 'Point', 'Clone', 'ToString'];
      
      // 먼저 명확한 변수 사용 패턴 찾기
      for (let i = blankIndex + 1; i < Math.min(templateLines.length, blankIndex + 10); i++) {
        const line = templateLines[i];
        
        // 패턴 1: Console.WriteLine(pt1) - 괄호 안의 변수명 (가장 우선)
        let varMatch = line.match(/Console\.WriteLine\(([a-z][a-zA-Z0-9]*)\)/i);
        if (varMatch) {
          const candidate = varMatch[1];
          if (!csharpKeywords.includes(candidate) && candidate.length <= 10) {
            templateVariableName = candidate;
            console.log(`[디버그] template에서 찾은 변수명 (패턴 1 - Console.WriteLine): ${templateVariableName} (라인 ${i + 1})`);
            break;
          }
        }
        
        // 패턴 2: pt1.Clone() - 점 앞의 변수명 (Console 제외)
        varMatch = line.match(/\b([a-z][a-zA-Z0-9]*)\s*\.(Clone|ToString|Equals|GetType)/i);
        if (varMatch) {
          const candidate = varMatch[1];
          if (!csharpKeywords.includes(candidate) && candidate !== 'Console' && candidate.length <= 10) {
            templateVariableName = candidate;
            console.log(`[디버그] template에서 찾은 변수명 (패턴 2 - 메소드 호출): ${templateVariableName} (라인 ${i + 1})`);
            break;
          }
        }
        
        // 패턴 3: = pt1.Clone() - 할당문에서 변수명
        varMatch = line.match(/=\s*([a-z][a-zA-Z0-9]*)\s*\./i);
        if (varMatch) {
          const candidate = varMatch[1];
          if (!csharpKeywords.includes(candidate) && candidate !== 'Console' && candidate.length <= 10) {
            templateVariableName = candidate;
            console.log(`[디버그] template에서 찾은 변수명 (패턴 3 - 할당문): ${templateVariableName} (라인 ${i + 1})`);
            break;
          }
        }
        
        // 패턴 4: pt1?.ToString() - null 조건부 연산자
        varMatch = line.match(/\b([a-z][a-zA-Z0-9]*)\s*\?\./i);
        if (varMatch) {
          const candidate = varMatch[1];
          if (!csharpKeywords.includes(candidate) && candidate !== 'Console' && candidate.length <= 10) {
            templateVariableName = candidate;
            console.log(`[디버그] template에서 찾은 변수명 (패턴 4 - null 조건부): ${templateVariableName} (라인 ${i + 1})`);
            break;
          }
        }
      }
      
      // 위에서 찾지 못한 경우, 일반적인 변수명 패턴 찾기 (키워드 제외)
      if (!templateVariableName) {
        for (let i = blankIndex + 1; i < Math.min(templateLines.length, blankIndex + 5); i++) {
          const line = templateLines[i];
          const varMatch = line.match(/\b([a-z][a-zA-Z0-9]{1,3})\b/i);
          if (varMatch && !csharpKeywords.includes(varMatch[1].toLowerCase())) {
            templateVariableName = varMatch[1];
            console.log(`[디버그] template에서 찾은 변수명 (후보): ${templateVariableName}`);
            break;
          }
        }
      }
    }
    
    // 사용자가 입력한 코드에서 변수명 추출 및 변경
    if (templateVariableName) {
      console.log(`[디버그] 변수명 매칭 시작 - template 변수명: ${templateVariableName}`);
      console.log(`[디버그] 사용자 코드 원본: ${userCode}`);
      
      // 사용자 코드에서 변수 선언 패턴 찾기 (여러 패턴 시도)
      let userVarName = null;
      
      // 패턴 1: Point pt3 = new Point(...)
      let userVarMatch = userCode.match(/\b\w+\s+([a-z][a-zA-Z0-9]*)\s*=\s*new\s+\w+\s*\(/i);
      if (userVarMatch) {
        userVarName = userVarMatch[1];
        console.log(`[디버그] 패턴 1 매칭: ${userVarName}`);
      } else {
        // 패턴 2: pt3 = new Point(...)
        userVarMatch = userCode.match(/\b([a-z][a-zA-Z0-9]*)\s*=\s*new/i);
        if (userVarMatch) {
          userVarName = userVarMatch[1];
          console.log(`[디버그] 패턴 2 매칭: ${userVarName}`);
        } else {
          // 패턴 3: 첫 번째 변수명 추출
          userVarMatch = userCode.match(/\b([a-z][a-zA-Z0-9]{2,})\b/i);
          if (userVarMatch) {
            userVarName = userVarMatch[1];
            console.log(`[디버그] 패턴 3 매칭: ${userVarName}`);
          }
        }
      }
      
      if (userVarName && userVarName !== templateVariableName) {
        // 사용자 변수명을 template 변수명으로 변경
        const beforeReplace = userCode;
        userCode = userCode.replace(new RegExp(`\\b${userVarName}\\b`, 'g'), templateVariableName);
        console.log(`[디버그] 변수명 변경: ${userVarName} -> ${templateVariableName}`);
        console.log(`[디버그] 변경 전: ${beforeReplace}`);
        console.log(`[디버그] 변경 후: ${userCode}`);
      } else if (!userVarName) {
        console.log(`[디버그] 경고: 사용자 코드에서 변수명을 찾을 수 없음`);
      } else {
        console.log(`[디버그] 변수명이 이미 일치함: ${userVarName}`);
      }
    } else {
      console.log(`[디버그] 경고: template에서 변수명을 찾을 수 없음`);
    }
    
    // template의 빈칸 주석을 사용자 코드로 대체
    userFullCode = problem.template.replace(/\/\*\s*빈칸\s*\*\//g, userCode);
    
    // 디버깅: 생성된 코드를 파일로 저장 (문제 해결용)
    const debugDir = path.join(__dirname, 'debug-validation');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const debugFile = path.join(debugDir, `problem_${problem.id}_${Date.now()}.cs`);
    fs.writeFileSync(debugFile, userFullCode, 'utf-8');
    console.log(`[디버그] 생성된 코드 저장: ${debugFile}`);
    console.log(`[디버그] 사용자 입력 원본: ${code.substring(0, 200)}`);
    console.log(`[디버그] 추출된 코드: ${userCode}`);
    console.log(`[디버그] template 변수명: ${templateVariableName || '없음'}`);
    console.log(`[디버그] 생성된 전체 코드 (처음 500자):\n${userFullCode.substring(0, 500)}`);
  } else if (problem.type === 'method') {
    // 메서드 만들기: 사용자가 입력한 메소드(시그니처 포함 또는 본문만)를 템플릿에 삽입
    const lines = problem.template.split('\n');
    const result = [];
    let skipUntilBrace = false;
    let userCodeLines = code.split('\n').filter(l => l.trim() !== '');
    
    // 사용자가 입력한 코드에서 주석 제거
    userCodeLines = userCodeLines.filter(line => 
      !line.includes('// 여기에 코드를 작성하세요')
    );
    
    // 템플릿에서 메소드 시그니처 찾기 (매개변수 이름 추출용)
    let templateMethodSignature = null;
    let templateMethodStartIndex = -1;
    let templateParams = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('// 여기에 코드를 작성하세요')) {
        templateMethodStartIndex = i;
        // 이전 줄에서 메소드 시그니처 찾기
        for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j].trim();
          if (prevLine.includes('(') && prevLine.includes(')')) {
            templateMethodSignature = prevLine;
            // 매개변수 추출: public Point(int x, int y) -> ['x', 'y']
            const paramMatch = prevLine.match(/\(([^)]+)\)/);
            if (paramMatch) {
              const paramsStr = paramMatch[1];
              templateParams = paramsStr.split(',').map(p => {
                const paramParts = p.trim().split(/\s+/);
                return paramParts[paramParts.length - 1]; // 마지막 부분이 변수명
              }).filter(p => p);
            }
            break;
          }
        }
        break;
      }
    }
    
    // 사용자 입력에서 메소드 본문만 추출
    let userMethodBody = userCodeLines.join('\n');
    let userMethodSignature = null;
    
    // 사용자 입력에 메소드 시그니처가 포함되어 있는지 확인
    const userCodeStr = userCodeLines.join('\n');
    const hasMethodSignature = userCodeStr.includes('(') && userCodeStr.includes(')') && 
                               (userCodeStr.includes('public') || userCodeStr.includes('private') || 
                                userCodeStr.includes('protected') || userCodeStr.includes('internal') ||
                                userCodeStr.includes('override'));
    
    if (hasMethodSignature && userMethodBody.includes('{') && userMethodBody.includes('}')) {
      // 메소드 시그니처가 포함된 경우: 본문만 추출
      const firstBrace = userMethodBody.indexOf('{');
      const lastBrace = userMethodBody.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        // 중괄호 안의 내용만 추출 (인덴트 제거)
        let extractedBody = userMethodBody.substring(firstBrace + 1, lastBrace);
        
        // 앞뒤 공백 제거
        extractedBody = extractedBody.trim();
        
        // 각 줄의 앞쪽 공통 인덴트 제거 (최소 인덴트 기준)
        const bodyLines = extractedBody.split('\n');
        if (bodyLines.length > 0) {
          // 빈 줄이 아닌 모든 줄의 인덴트 중 최소값 찾기
          let minIndent = Infinity;
          for (const line of bodyLines) {
            if (line.trim() !== '') {
              const indentMatch = line.match(/^(\s*)/);
              if (indentMatch) {
                const indent = indentMatch[1].length;
                if (indent < minIndent) {
                  minIndent = indent;
                }
              }
            }
          }
          
          // 공통 인덴트 제거 (최소 인덴트만큼 모든 줄에서 제거)
          if (minIndent > 0 && minIndent < Infinity) {
            extractedBody = bodyLines.map(line => {
              if (line.trim() === '') return line;
              // 최소 인덴트만큼 제거
              if (line.length >= minIndent) {
                return line.substring(minIndent);
              }
              return line.trimStart();
            }).join('\n');
          } else {
            // 인덴트를 찾지 못한 경우 모든 공백 제거 후 재구성
            extractedBody = bodyLines.map(line => line.trimStart()).join('\n');
          }
        }
        
        userMethodBody = extractedBody;
        
        // 사용자 입력에서 매개변수 이름 추출
        const userParamMatch = userCodeStr.match(/\(([^)]+)\)/);
        if (userParamMatch) {
          const userParamsStr = userParamMatch[1];
          const userParams = userParamsStr.split(',').map(p => {
            const paramParts = p.trim().split(/\s+/);
            return paramParts[paramParts.length - 1];
          }).filter(p => p);
          
          // 매개변수 이름 매핑 및 변경
          if (userParams.length === templateParams.length) {
            for (let i = 0; i < userParams.length; i++) {
              const userParam = userParams[i];
              const templateParam = templateParams[i];
              if (userParam !== templateParam) {
                // 사용자 매개변수 이름을 템플릿 매개변수 이름으로 변경
                const regex = new RegExp(`\\b${userParam}\\b`, 'g');
                userMethodBody = userMethodBody.replace(regex, templateParam);
                console.log(`[디버그] 메소드 매개변수 변경: ${userParam} -> ${templateParam}`);
              }
            }
          }
        }
      }
    }
    
    // 본문을 다시 줄 단위로 분할
    userCodeLines = userMethodBody.split('\n').filter(l => l.trim() !== '');
    
    // 템플릿에 사용자 코드 삽입
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('// 여기에 코드를 작성하세요')) {
        // 사용자 코드 삽입 (인덴트 유지)
        // 주석 다음 줄(여는 중괄호 다음 줄)의 인덴트 확인
        let indent = '            '; // 기본 12칸 인덴트
        let indentCheckIdx = i + 1;
        // 빈 줄 건너뛰기
        while (indentCheckIdx < lines.length && lines[indentCheckIdx].trim() === '') {
          indentCheckIdx++;
        }
        // 여는 중괄호 건너뛰기
        if (indentCheckIdx < lines.length && lines[indentCheckIdx].trim() === '{') {
          indentCheckIdx++;
          // 빈 줄 건너뛰기
          while (indentCheckIdx < lines.length && lines[indentCheckIdx].trim() === '') {
            indentCheckIdx++;
          }
        }
        // 실제 코드가 있는 줄의 인덴트 확인
        if (indentCheckIdx < lines.length && lines[indentCheckIdx].trim() !== '' && !lines[indentCheckIdx].includes('}')) {
          const indentMatch = lines[indentCheckIdx].match(/^(\s*)/);
          if (indentMatch) {
            indent = indentMatch[1];
          }
        } else {
          // 인덴트를 찾지 못한 경우 주석 줄의 인덴트 + 4칸
          const commentIndentMatch = lines[i].match(/^(\s*)/);
          if (commentIndentMatch) {
            indent = commentIndentMatch[1] + '    '; // 주석 인덴트 + 4칸
          }
        }
        
        const indentedUserCode = userCodeLines.map(line => {
          // 빈 줄이면 그대로 유지
          if (line.trim() === '') return line;
          // 인덴트 추가 (줄 앞의 모든 공백 제거 후 추가)
          const trimmedLine = line.trimStart();
          return indent + trimmedLine;
        });
        result.push(...indentedUserCode);
        skipUntilBrace = true;
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') {
          j++;
        }
        i = j - 1;
      } else if (skipUntilBrace && lines[i].trim() === '}') {
        result.push(lines[i]);
        skipUntilBrace = false;
      } else if (!skipUntilBrace) {
        result.push(lines[i]);
      }
    }
    userFullCode = result.join('\n');
    
    // 디버깅: 생성된 코드 확인 및 파일 저장
    const debugDir = path.join(__dirname, 'debug-output');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const debugFile = path.join(debugDir, `method_${problem.id}_${Date.now()}.cs`);
    fs.writeFileSync(debugFile, userFullCode, 'utf-8');
    
    console.log(`[메소드 문제] 사용자 입력 원본:\n${code}`);
    console.log(`[메소드 문제] 추출된 본문:\n${userCodeLines.join('\n')}`);
    console.log(`[메소드 문제] 생성된 전체 코드 저장: ${debugFile}`);
    console.log(`[메소드 문제] 생성된 전체 코드:\n${userFullCode}`);
    
    // 사용자가 입력한 코드 부분 저장 (정답 비교용) - 본문만
    userCode = userCodeLines.join('\n');
  } else if (problem.type === 'class') {
    // 클래스 만들기: 사용자가 입력한 클래스 정의(전체 또는 본문만)를 템플릿에 삽입
    const lines = problem.template.split('\n');
    const result = [];
    let inClass = false;
    let classBraceCount = 0;
    let userCodeLines = code.split('\n').filter(l => l.trim() !== '');
    
    // 사용자가 입력한 코드에서 주석 제거
    userCodeLines = userCodeLines.filter(line => 
      !line.includes('// 여기에 클래스를 완성하세요')
    );
    
    // 템플릿에서 클래스 시작 위치 찾기
    let templateClassStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('// 여기에 클래스를 완성하세요')) {
        templateClassStartIndex = i;
        break;
      }
    }
    
    // 사용자 입력이 클래스 정의 전체인지 본문만인지 확인
    const userCodeStr = userCodeLines.join('\n');
    const hasClassKeyword = userCodeStr.includes('class ') && !userCodeStr.includes('Program');
    
    let userClassBody = '';
    
    if (hasClassKeyword) {
      // 클래스 정의 전체가 입력된 경우: 클래스 본문만 추출
      // "class " 로 시작하는 줄 찾기
      let classStartIndex = -1;
      for (let i = 0; i < userCodeLines.length; i++) {
        const trimmed = userCodeLines[i].trim();
        if (trimmed.startsWith('class ') && !trimmed.includes('Program')) {
          classStartIndex = i;
          break;
        }
      }
      
      if (classStartIndex !== -1) {
        // 클래스 본문 추출 (첫 번째 { 다음부터 마지막 } 전까지)
        let braceCount = 0;
        let foundFirstBrace = false;
        let bodyStartIndex = -1;
        let bodyEndIndex = -1;
        
        for (let i = classStartIndex; i < userCodeLines.length; i++) {
          const line = userCodeLines[i];
          if (!foundFirstBrace && line.includes('{')) {
            foundFirstBrace = true;
            bodyStartIndex = i + 1; // { 다음 줄부터
            braceCount = 1;
          } else if (foundFirstBrace) {
            braceCount += (line.match(/{/g) || []).length;
            braceCount -= (line.match(/}/g) || []).length;
            if (braceCount <= 0 && line.includes('}')) {
              bodyEndIndex = i; // } 포함하지 않음
              break;
            }
          }
        }
        
        if (bodyStartIndex !== -1 && bodyEndIndex !== -1) {
          userClassBody = userCodeLines.slice(bodyStartIndex, bodyEndIndex).join('\n');
        } else {
          // 본문 추출 실패 시 전체 사용
          userClassBody = userCodeStr;
        }
      } else {
        userClassBody = userCodeStr;
      }
    } else {
      // 클래스 본문만 입력된 경우
      userClassBody = userCodeStr;
    }
    
    // 본문을 다시 줄 단위로 분할
    userCodeLines = userClassBody.split('\n').filter(l => l.trim() !== '');
    
    // 템플릿에 사용자 코드 삽입
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('// 여기에 클래스를 완성하세요')) {
        result.push(...userCodeLines);
        inClass = true;
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') {
          j++;
        }
        i = j - 1;
      } else if (inClass) {
        const line = lines[i];
        classBraceCount += (line.match(/{/g) || []).length;
        classBraceCount -= (line.match(/}/g) || []).length;
        if (classBraceCount <= 0 && line.includes('}')) {
          result.push(line);
          inClass = false;
        }
      } else {
        result.push(lines[i]);
      }
    }
    userFullCode = result.join('\n');
    
    // 사용자가 입력한 코드 부분 저장 (정답 비교용) - 본문만
    userCode = userCodeLines.join('\n');
  } else if (problem.type === 'full') {
    // 전체 코드 작성: // 여기에 전체 코드를 작성하세요 부분을 사용자 코드로 대체
    const lines = problem.template.split('\n');
    const result = [];
    let skipContent = false;
    let userCodeLines = code.split('\n');
    
    // 사용자가 입력한 코드에서 주석 제거
    userCodeLines = userCodeLines.filter(line => 
      !line.includes('// 여기에 전체 코드를 작성하세요')
    );
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('// 여기에 전체 코드를 작성하세요')) {
        result.push(...userCodeLines);
        skipContent = true;
        let j = i + 1;
        while (j < lines.length && (lines[j].trim() === '' || lines[j].trim() === '}')) {
          j++;
        }
        i = j - 1;
      } else if (skipContent && lines[i].trim() === '}') {
        result.push(lines[i]);
        skipContent = false;
      } else if (!skipContent) {
        result.push(lines[i]);
      }
    }
    userFullCode = result.join('\n');
    
    // 사용자가 입력한 코드 부분 저장 (정답 비교용)
    userCode = userCodeLines.join('\n');
  } else {
    userFullCode = code;
    userCode = code;
  }

  try {
    // 컴파일 검증 환경 확인
    const dotNetInfo = await checkDotNetSDKAvailable();
    const useLocal = dotNetInfo.available;
    
    if (!useLocal) {
      const dockerAvailable = await checkDockerAvailable();
      if (!dockerAvailable) {
        // 컴파일 검증 불가능한 경우 사용자 입력 부분만 정답과 비교
        const normalizeForComparison = (str) => {
          if (!str) return '';
          return str
            .replace(/\/\*[\s\S]*?\*\//g, '') // 블록 주석 제거
            .replace(/\/\/.*$/gm, '') // 라인 주석 제거
            .replace(/\s+/g, '') // 모든 공백 제거
            .replace(/;/g, '') // 세미콜론 제거
            .trim();
        };
        
        const normalizedUserInput = normalizeForComparison(userCode);
        const normalizedAnswer = normalizeForComparison(problem.answer || '');
        const isCorrect = normalizedUserInput === normalizedAnswer;
        
        return res.json({
          success: true,
          isCorrect: isCorrect,
          message: isCorrect 
            ? '정답입니다! 🎉' 
            : '오답입니다. 다시 시도해보세요.',
          answer: problem.answer,
          userCode: code,
          compileError: null,
          note: '컴파일 검증을 사용할 수 없어 문자열 비교로 검증했습니다.'
        });
      }
    }

    // 실제 컴파일 검증 수행
    const compileResult = useLocal
      ? await validateCodeLocally(userFullCode, problem.id)
      : await validateCodeInDocker(userFullCode, problem.id);

    // 디버깅: 컴파일 결과 확인
    if (!compileResult.success) {
      console.log(`[디버그] 컴파일 실패 - 문제 ID: ${problem.id}, 타입: ${problem.type}`);
      console.log(`[디버그] 생성된 코드 길이: ${userFullCode.length}`);
      console.log(`[디버그] 생성된 전체 코드:\n${userFullCode}`);
      console.log(`[디버그] 컴파일 오류 stdout (처음 2000자):\n${compileResult.stdout.substring(0, 2000)}`);
      if (compileResult.stderr) {
        console.log(`[디버그] 컴파일 오류 stderr (처음 2000자):\n${compileResult.stderr.substring(0, 2000)}`);
      }
    } else {
      console.log(`[디버그] 컴파일 성공 - 문제 ID: ${problem.id}, 타입: ${problem.type}`);
    }

    // 컴파일 실패 시에도 사용자 입력 부분만 정답과 비교
    if (!compileResult.success) {
      // 컴파일 오류 메시지 추출
      const errorOutput = compileResult.stdout || compileResult.stderr || '';
      const errorLines = errorOutput.split('\n')
        .filter(line => line.includes('error'))
        .slice(0, 3)
        .map(line => line.trim())
        .join('; ');

      // 컴파일 실패해도 사용자 입력 부분만 정답과 비교
      const normalizeForComparison = (str) => {
        if (!str) return '';
        return str
          .replace(/\/\*[\s\S]*?\*\//g, '') // 블록 주석 제거
          .replace(/\/\/.*$/gm, '') // 라인 주석 제거
          .replace(/\s+/g, '') // 모든 공백 제거
          .replace(/;/g, '') // 세미콜론 제거
          .trim();
      };
      
      const normalizedUserInput = normalizeForComparison(userCode);
      const normalizedAnswer = normalizeForComparison(problem.answer || '');
      const isCorrect = normalizedUserInput === normalizedAnswer;

      return res.json({
        success: true,
        isCorrect: isCorrect,
        message: isCorrect 
          ? '정답입니다! 🎉 (컴파일 오류가 있었지만 코드는 정답입니다)' 
          : '컴파일 오류가 발생했습니다.',
        answer: problem.answer,
        userCode: code,
        compileError: errorLines || '알 수 없는 컴파일 오류',
        compileDetails: errorOutput.substring(0, 500) // 처음 500자만 전송
      });
    }

    // 컴파일 성공 시 정답 비교
    // 모든 문제 타입에서 사용자가 입력한 코드 부분만 정답과 비교
    // 여러 줄 정답도 지원 (메소드, 클래스 문제)
    
    // 여러 줄 정답 비교를 위한 정규화 함수
    // 공백, 들여쓰기, 줄바꿈, 세미콜론 차이를 무시
    const normalizeForComparison = (str) => {
      if (!str) return '';
      return str
        .replace(/\/\*[\s\S]*?\*\//g, '') // 블록 주석 제거
        .replace(/\/\/.*$/gm, '') // 라인 주석 제거
        .replace(/\s+/g, '') // 모든 공백 제거 (공백, 탭, 줄바꿈 모두)
        .replace(/;/g, '') // 세미콜론 제거
        .trim();
    };
    
    // 사용자가 입력한 코드 부분 정규화
    const normalizedUserInput = normalizeForComparison(userCode);
    // 정답 정규화 (여러 줄도 처리)
    const normalizedAnswer = normalizeForComparison(problem.answer || '');
    
    const isCorrect = normalizedUserInput === normalizedAnswer;
    
    // 디버깅
    console.log(`[디버그] 정답 비교 - 문제 ID: ${problem.id}, 타입: ${problem.type}`);
    console.log(`[디버그] 사용자 입력 원본 (처음 300자): "${userCode.substring(0, 300)}"`);
    console.log(`[디버그] 사용자 입력 (정규화, 처음 200자): "${normalizedUserInput.substring(0, 200)}"`);
    console.log(`[디버그] 정답 원본 (처음 300자): "${(problem.answer || '').substring(0, 300)}"`);
    console.log(`[디버그] 정답 (정규화, 처음 200자): "${normalizedAnswer.substring(0, 200)}"`);
    console.log(`[디버그] 일치 여부: ${isCorrect}`);

    res.json({
      success: true,
      isCorrect: isCorrect,
      message: isCorrect 
        ? '정답입니다! 🎉 (컴파일 성공)' 
        : '컴파일은 성공했지만 정답과 다릅니다. 다시 시도해보세요.',
      answer: problem.answer,
      userCode: code,
      compileError: null
    });

  } catch (error) {
    // 검증 중 오류 발생 시 사용자 입력 부분만 정답과 비교
    console.error('컴파일 검증 중 오류:', error);
    console.error('오류 상세:', error.message);
    console.error('스택:', error.stack);
    
    // 모든 문제 타입에서 사용자 입력 부분만 정답과 비교
    const normalizeForComparison = (str) => {
      if (!str) return '';
      return str
        .replace(/\/\*[\s\S]*?\*\//g, '') // 블록 주석 제거
        .replace(/\/\/.*$/gm, '') // 라인 주석 제거
        .replace(/\s+/g, '') // 모든 공백 제거
        .replace(/;/g, '') // 세미콜론 제거
        .trim();
    };
    
    const normalizedUserInput = normalizeForComparison(userCode);
    const normalizedAnswer = normalizeForComparison(problem.answer || '');
    const isCorrect = normalizedUserInput === normalizedAnswer;
    
    console.log(`[디버그] 폴백 정답 비교 - 문제 ID: ${problem.id}, 타입: ${problem.type}`);
    console.log(`[디버그] 사용자 입력 (정규화): "${normalizedUserInput.substring(0, 200)}"`);
    console.log(`[디버그] 정답 (정규화): "${normalizedAnswer.substring(0, 200)}"`);
    console.log(`[디버그] 일치 여부: ${isCorrect}`);
    
    res.json({
      success: true,
      isCorrect: isCorrect,
      message: isCorrect 
        ? '정답입니다! 🎉' 
        : '오답입니다. 다시 시도해보세요.',
      answer: problem.answer,
      userCode: code,
      compileError: null,
      note: '컴파일 검증 중 오류가 발생하여 문자열 비교로 검증했습니다.'
    });
  }
});

// 코드 정규화 함수 (공백, 줄바꿈, 주석 제거)
function normalizeCode(code) {
  if (!code) return '';
  
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '') // 블록 주석 제거
    .replace(/\/\/.*$/gm, '') // 라인 주석 제거
    .replace(/\s+/g, ' ') // 모든 공백을 하나로
    .replace(/[{};]/g, '') // 중괄호와 세미콜론 제거 (빈칸 채우기 문제 대응)
    .trim();
}

// 개념 카테고리 조회 API
app.get('/api/concepts', (req, res) => {
  res.json(getConceptsByCategory());
});

// 주제 카테고리 조회 API
app.get('/api/topics', (req, res) => {
  res.json(getTopicsByCategory());
});

// React 빌드 파일 서빙 (개발/프로덕션 모두)
const buildPath = path.join(__dirname, '../client/build');

// 빌드 폴더가 존재하는지 확인
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  
  // API가 아닌 모든 요청을 React 앱으로 라우팅
  app.get('*', (req, res, next) => {
    // API 경로는 제외
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(buildPath, 'index.html'));
  });
} else {
  // 빌드 폴더가 없을 때 안내 페이지
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.status(503).send(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>C# 시험 준비 플랫폼</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            max-width: 600px;
          }
          h1 { margin-top: 0; }
          code {
            background: rgba(0, 0, 0, 0.3);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
          }
          .command {
            margin: 1.5rem 0;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 6px;
            text-align: left;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 C# 시험 준비 플랫폼</h1>
          <p>React 앱을 먼저 빌드해주세요.</p>
          <div class="command">
            <p>다음 명령어를 실행하세요:</p>
            <code>npm run build</code>
          </div>
          <p style="font-size: 0.9rem; opacity: 0.8;">
            빌드가 완료되면 이 페이지가 자동으로 새로고침됩니다.
          </p>
        </div>
        <script>
          setTimeout(() => location.reload(), 5000);
        </script>
      </body>
      </html>
    `);
  });
}

// 서버 시작 시 .NET SDK 확인
(async () => {
  console.log('[서버 시작] .NET SDK 확인 중...');
  const dotNetInfo = await checkDotNetSDKAvailable();
  if (dotNetInfo.available) {
    console.log('[서버 시작] .NET SDK 사용 가능:', dotNetInfo.version, '(경로:', dotNetInfo.path || 'N/A', ')');
  } else {
    console.log('[서버 시작] .NET SDK 사용 불가 - 문자열 비교로 검증합니다.');
  }
})();

app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`개발 모드: http://localhost:${PORT}`);
  console.log(`프로덕션 모드: http://localhost:${PORT} (빌드 후)`);
});



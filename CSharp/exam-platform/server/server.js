const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { getConceptsByCategory, getAllConcepts } = require('./conceptCategories');
const { getTopicsByCategory, getAllTopics } = require('./topicCategories');
const { getProblems } = require('./problemParser');

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
  if (problem.exampleCode) {
    return problem.exampleCode;
  }
  return problem.template || '';
}

// 간단한 검증 함수 (validateWithDocker 대체)
async function checkDotNetSDKAvailable() {
  return { available: false };
}

async function checkDockerAvailable() {
  return false;
}

async function validateCodeLocally(code, problemId) {
  // 간단한 문자열 비교로 대체
  return { success: true, compiled: true };
}

async function validateCodeInDocker(code, problemId) {
  // 간단한 문자열 비교로 대체
  return { success: true, compiled: true };
}

const app = express();
const PORT = process.env.PORT || 5000;

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
  const codeToWrite = extractCodeToWrite(problem);
  
  // 정답은 별도로 전달 (정답 보기 버튼용)
  res.json({
    ...problem,
    fullCode: fullCode, // 문제 설명에 표시할 전체 코드
    codeToWrite: codeToWrite // 코드 작성 칸에 표시할 작성할 부분
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
    // 메서드 만들기: // 여기에 코드를 작성하세요 부분을 사용자 코드로 대체
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
    let templateParams = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('// 여기에 코드를 작성하세요')) {
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
    
    // 사용자 입력에서 메소드 본문만 추출 (시그니처 제거)
    let userMethodBody = userCodeLines.join('\n');
    
    // 사용자 입력에 메소드 시그니처가 포함되어 있으면 제거
    if (userMethodBody.includes('{') && userMethodBody.includes('}')) {
      // 첫 번째 { 부터 마지막 } 까지가 본문
      const firstBrace = userMethodBody.indexOf('{');
      const lastBrace = userMethodBody.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        userMethodBody = userMethodBody.substring(firstBrace + 1, lastBrace).trim();
      }
    }
    
    // 사용자 입력에서 매개변수 이름 추출 및 템플릿 매개변수로 변경
    if (templateParams.length > 0 && userCodeLines.length > 0) {
      const userCodeStr = userCodeLines.join('\n');
      // 사용자 입력에서 매개변수 선언 찾기: public Point(int xzc, int yzc)
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
    
    // 본문을 다시 줄 단위로 분할
    userCodeLines = userMethodBody.split('\n').filter(l => l.trim() !== '');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('// 여기에 코드를 작성하세요')) {
        result.push(...userCodeLines);
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
    
    // 사용자가 입력한 코드 부분 저장 (정답 비교용) - 본문만
    userCode = userCodeLines.join('\n');
  } else if (problem.type === 'class') {
    // 클래스 만들기: // 여기에 클래스를 완성하세요 부분을 사용자 코드로 대체
    const lines = problem.template.split('\n');
    const result = [];
    let inClass = false;
    let classBraceCount = 0;
    let userCodeLines = code.split('\n');
    
    // 사용자가 입력한 코드에서 주석 제거
    userCodeLines = userCodeLines.filter(line => 
      !line.includes('// 여기에 클래스를 완성하세요')
    );
    
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
    
    // 사용자가 입력한 코드 부분 저장 (정답 비교용)
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
      console.log(`[디버그] 컴파일 실패 - 문제 ID: ${problem.id}`);
      console.log(`[디버그] 생성된 코드 길이: ${userFullCode.length}`);
      console.log(`[디버그] 컴파일 오류 (처음 2000자):\n${compileResult.stdout.substring(0, 2000)}`);
      if (compileResult.stderr) {
        console.log(`[디버그] stderr:\n${compileResult.stderr.substring(0, 1000)}`);
      }
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

app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`개발 모드: http://localhost:${PORT}`);
  console.log(`프로덕션 모드: http://localhost:${PORT} (빌드 후)`);
});



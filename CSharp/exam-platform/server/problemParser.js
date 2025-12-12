/**
 * JSON 파일에서 문제 데이터를 로드하는 모듈
 */

const fs = require('fs');
const path = require('path');

/**
 * JSON 파일에서 문제 배열을 로드 (과목별)
 */
function loadProblemsFromJson(subject) {
  // 과목별 문제 파일 경로 매핑
  const subjectPaths = {
    'csharp': path.join(__dirname, 'csharp-sources', 'problems.json'),
    'parenting': path.join(__dirname, 'parenting-sources', 'problems.json')
  };
  
  const jsonPath = subjectPaths[subject];
  
  if (!jsonPath) {
    console.warn(`${subject} 과목의 문제 파일 경로가 설정되지 않았습니다.`);
    return [];
  }
  
  try {
    if (!fs.existsSync(jsonPath)) {
      console.warn(`${subject} 과목의 problems.json 파일이 없습니다. 빈 배열을 반환합니다.`);
      return [];
    }
    
    const jsonData = fs.readFileSync(jsonPath, 'utf-8');
    const problems = JSON.parse(jsonData);
    
    // ID가 중복되지 않도록 확인하고 재정렬
    const uniqueProblems = [];
    const seenIds = new Set();
    
    problems.forEach(problem => {
      if (!seenIds.has(problem.id)) {
        seenIds.add(problem.id);
        uniqueProblems.push(problem);
      }
    });
    
    // ID 순으로 정렬
    uniqueProblems.sort((a, b) => a.id - b.id);
    
    return uniqueProblems;
  } catch (error) {
    console.error(`${subject} 과목 JSON 파일 로드 오류:`, error);
    return [];
  }
}

/**
 * 문제 데이터를 초기화하고 반환 (과목별)
 */
function getProblems(subject = 'csharp') {
  try {
    return loadProblemsFromJson(subject);
  } catch (error) {
    console.error('문제 로드 오류:', error);
    return [];
  }
}

/**
 * txt 파일을 파싱하는 함수 (파일 경로를 받을 수 있음)
 */
function parseTxtFile(txtFilePath) {
  const content = fs.readFileSync(txtFilePath, 'utf-8');
  
  const problems = [];
  // 문제 블록을 구분자로 분리
  const separators = [
    '//////////////////////////////////////////////////////////////////////////////',
    '////////////////////////////////////////////////////////',
    '///////////////////////////////////////////////////////////'
  ];
  
  let blocks = [content];
  separators.forEach(sep => {
    const newBlocks = [];
    blocks.forEach(block => {
      newBlocks.push(...block.split(sep));
    });
    blocks = newBlocks;
  });
  
  blocks = blocks.filter(block => block.trim() && block.includes('문제'));
  
  blocks.forEach((block) => {
    const rawLines = block.split('\n');
    
    // 문제 번호와 제목 추출
    const titleLine = rawLines.find(line => line.trim().match(/^문제\s*\d+:/));
    if (!titleLine) return;
    
    const titleMatch = titleLine.trim().match(/문제\s*(\d+):\s*(.+)/);
    if (!titleMatch) return;
    
    const problemNumber = parseInt(titleMatch[1]);
    const title = titleMatch[2].trim();
    
    // 전체 텍스트에서 섹션 찾기
    const fullText = block;
    
    // 문제 요구사항 추출
    const requirementsMatch = fullText.match(/- 문제 요구사항\s+([\s\S]*?)(?=- 예제 코드|- 작성할 코드|- 정답|$)/);
    const requirements = requirementsMatch ? requirementsMatch[1].trim() : '';
    
    // 예제 코드 추출
    const exampleMatch = fullText.match(/- 예제 코드\s+([\s\S]*?)(?=- 작성할 코드|- 정답|$)/);
    let exampleCode = exampleMatch ? exampleMatch[1].trim() : '';
    // 코드 블록만 추출 (using부터 시작하는 부분)
    const codeBlockMatch = exampleCode.match(/(using[\s\S]*?)(?=\n\n|\n-|$)/);
    if (codeBlockMatch) {
      exampleCode = codeBlockMatch[1].trim();
    }
    
    // 작성할 코드 추출
    const templateMatch = fullText.match(/- 작성할 코드\s+([\s\S]*?)(?=- 정답|$)/);
    let templateCode = templateMatch ? templateMatch[1].trim() : '';
    // 코드 블록 정리 (불필요한 빈 줄 제거)
    templateCode = templateCode.replace(/\n{3,}/g, '\n\n').trim();
    
    // 정답 추출
    const answerMatch = fullText.match(/- 정답\s+([\s\S]*?)(?=\n\n\/{50,}|\n\n문제|$)/);
    let answerCode = answerMatch ? answerMatch[1].trim() : '';
    // 정답 코드 블록 정리 (불필요한 빈 줄 제거)
    answerCode = answerCode.replace(/\n{3,}/g, '\n\n').trim();
    
    // 문제 유형 결정
    let type = 'method'; // 기본값
    if (title.includes('전체 프로그램') || title.includes('전체 코드')) {
      type = 'full';
    } else if (title.includes('빈칸 채우기') || templateCode.includes('/* 빈칸 */')) {
      type = 'fill';
    } else if (title.includes('클래스 완성') || title.includes('클래스 완성하기')) {
      type = 'class';
    } else if (title.includes('메소드 만들기') || title.includes('메소드')) {
      type = 'method';
    }
    
    problems.push({
      id: problemNumber,
      type: type,
      title: title,
      requirements: requirements,
      exampleCode: exampleCode,
      template: templateCode,
      answer: answerCode,
      description: `${requirements}\n\n**예제 코드:**\n\`\`\`csharp\n${exampleCode}\n\`\`\``
    });
  });
  
  return problems;
}

module.exports = {
  parseTxtFile,
  getProblems
};


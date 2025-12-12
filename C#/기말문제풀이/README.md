# C# 프로그래밍 시험 준비 플랫폼

C# 프로그래밍 시험 준비를 위한 웹 기반 문제 풀이 플랫폼입니다.

## 주요 기능

- 📝 C# 코드 작성 문제 풀이
- 📚 문제 목록 및 상세 보기
- ✏️ Monaco Editor를 활용한 코드 편집
- 📖 마크다운 형식의 문제 설명 지원
- 🌐 ngrok을 통한 외부 접속 지원

## 기술 스택

- **Frontend**: React 18
- **Backend**: Express.js
- **Code Editor**: Monaco Editor (VS Code 에디터)
- **Markdown**: react-markdown

## 설치 및 실행

### 1. 의존성 설치

```bash
npm run install-all
```

또는 개별적으로 설치:

```bash
npm install
cd client && npm install
cd ../server && npm install
```

### 2. 개발 모드 실행

```bash
npm run dev
```

이 명령어는 React 앱을 빌드한 후 Express 서버를 시작합니다.
- **단일 포트 사용**: `http://localhost:5000` (ngrok 호환)
- API 엔드포인트: `http://localhost:5000/api`

**참고**: 코드를 수정한 후에는 다시 빌드해야 합니다:
```bash
npm run build
```

### 3. 프로덕션 모드 실행

```bash
# 클라이언트 빌드
npm run build

# 서버 실행 (단일 포트)
npm start
```

서버가 `http://localhost:5000`에서 실행됩니다.

## ngrok 설정

ngrok 무료 버전은 단일 포트만 지원하므로, 프로덕션 모드로 빌드한 후 Express 서버를 실행하고 ngrok을 연결하세요.

### 1. 프로덕션 빌드 및 실행

```bash
npm run build
npm start
```

### 2. ngrok 실행

다른 터미널에서:

```bash
ngrok http 5000
```

ngrok이 제공하는 공개 URL을 통해 외부에서 접속할 수 있습니다.

### 3. 외부 접속 시 문제 생성 기능

**외부에서 접속해도 문제 생성 기능을 사용할 수 있습니다!**

✅ **사용 가능:**
- 템플릿 기반 문제 생성 (무료, 즉시 사용 가능)
- OpenAI API 문제 생성 (유료, API 키 필요)
- Perplexity API 문제 생성 (유료, API 키 필요)

❌ **사용 불가:**
- Ollama 문제 생성 (로컬에서만 실행되므로 외부 접속 시 사용 불가)

**자세한 내용은 `NGROK_GUIDE.md` 파일을 참고하세요.**

## 프로젝트 구조

```
├── client/              # React 프론트엔드
│   ├── public/
│   ├── src/
│   │   ├── components/  # React 컴포넌트
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── server/              # Express 백엔드
│   ├── server.js        # 서버 메인 파일
│   └── package.json
├── package.json         # 루트 package.json
└── README.md
```

## 문제 생성 기능

### 무료 사용 (추천)

**템플릿 기반 생성** (기본값):
- 설정 불필요, 즉시 사용 가능
- 미리 정의된 템플릿에서 문제 생성
- 완전 무료

**Ollama 사용** (로컬 LLM):
- Ollama 설치 필요: https://ollama.ai
- 로컬에서 실행되므로 완전 무료
- 오프라인 사용 가능
- **설정 방법**: `OLLAMA_SETUP.md` 파일 참고

### 유료 API 사용 (선택사항)

유료 AI API를 사용하려면 환경 변수를 설정해야 합니다.

1. `server` 폴더에 `.env` 파일 생성
2. API 키 입력:

```bash
# OpenAI 사용 시
OPENAI_API_KEY=sk-your-openai-api-key-here

# Perplexity 사용 시
PERPLEXITY_API_KEY=pplx-your-perplexity-api-key-here

# Ollama 사용 시 (기본값: http://localhost:11434)
OLLAMA_BASE_URL=http://localhost:11434
```

**API 키 발급 방법:**
- **OpenAI**: https://platform.openai.com/api-keys (유료)
- **Perplexity**: https://www.perplexity.ai/settings/api (유료)
- **Ollama**: https://ollama.ai (무료, 로컬 설치)

## API 엔드포인트

### GET /api/problems
문제 목록 조회
- 쿼리 파라미터: `type` (선택) - 'fill', 'method', 'class', 'full', 'all'

### GET /api/problems/:id
특정 문제 상세 정보 조회

### POST /api/problems/:id/submit
코드 제출 (현재는 검증만 수행, 실제 실행 기능은 추후 구현)

### POST /api/problems/generate
AI를 사용한 문제 생성
- 요청 본문:
```json
{
  "type": "method",           // 'fill', 'method', 'class', 'full'
  "topic": "배열",             // 주제 (선택)
  "difficulty": "medium",     // 'easy', 'medium', 'hard'
  "concepts": ["foreach", "LINQ"],  // 포함할 개념들 (선택)
  "requirements": "예외 처리 포함",  // 추가 요구사항 (선택)
  "aiProvider": "openai"      // 'openai' 또는 'perplexity'
}
```

## 문제 추가 방법

`server/server.js`의 `problems` 배열에 새로운 문제를 추가하세요:

```javascript
{
  id: 2,
  title: "문제 제목",
  description: "마크다운 형식의 문제 설명",
  template: "코드 템플릿",
  testCases: [
    {
      input: "입력값",
      expectedOutput: "예상 출력"
    }
  ]
}
```

## AI 문제 생성 기능

웹사이트에서 직접 AI를 이용해 문제를 생성할 수 있습니다.

1. 문제 목록 페이지에서 **"🤖 AI 문제 생성"** 버튼 클릭
2. 문제 유형, 주제, 난이도 등을 입력
3. AI 제공자 선택 (OpenAI 또는 Perplexity)
4. **"✨ 문제 생성하기"** 버튼 클릭

생성된 문제는 자동으로 문제 목록에 추가되며, 바로 풀어볼 수 있습니다.

## 향후 개선 사항

- [x] AI를 이용한 문제 자동 생성
- [x] 문제 유형별 분류 및 필터링
- [ ] 실제 C# 코드 실행 및 테스트 케이스 검증
- [ ] 데이터베이스 연동 (문제 저장)
- [ ] 사용자 인증 및 제출 이력 관리
- [ ] 코드 실행 결과 상세 표시
- [ ] 문제 난이도 및 카테고리 분류

## 라이선스

MIT



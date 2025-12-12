# Render에서 .NET SDK 설정 가이드

## 문제
현재 "컴파일 검증을 사용할 수 없어 문자열 비교로 검증했습니다" 메시지가 표시됩니다.

## 해결 방법

### 방법 1: Build Command에 .NET SDK 설치 추가 (권장)

Render Settings → Build Command를 다음과 같이 수정:

```
cd CSharp/exam-platform/client && npm install && npm run build && cd ../server && npm install && curl -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 8.0 && export PATH="$PATH:$HOME/.dotnet"
```

또는 더 간단하게:

```
cd CSharp/exam-platform/client && npm install && npm run build && cd ../server && npm install
```

그리고 **Environment Variables**에 추가:
- `DOTNET_ROOT`: `/home/render/.dotnet`
- `PATH`: `/home/render/.dotnet:$PATH`

### 방법 2: Nixpacks 사용 (자동 감지)

Render는 Nixpacks를 사용하여 자동으로 .NET SDK를 감지할 수 있습니다.

**render.yaml** 파일 생성 (프로젝트 루트):

```yaml
services:
  - type: web
    name: myPractice
    env: node
    buildCommand: cd CSharp/exam-platform/client && npm install && npm run build && cd ../server && npm install
    startCommand: cd CSharp/exam-platform/server && node server.js
    envVars:
      - key: DOTNET_ROOT
        value: /home/render/.dotnet
```

### 방법 3: 문자열 비교로 계속 사용 (간단함)

현재 상태로 사용해도 됩니다. 컴파일 검증 없이도 정답 비교는 가능합니다.

## 추천 방법

**방법 1**을 사용하되, .NET SDK 설치가 실패하면 **방법 3**을 사용하세요.

## 확인 방법

배포 후 로그에서 다음 메시지 확인:
- `.NET SDK 사용 가능` 또는
- `컴파일 검증을 사용할 수 없어 문자열 비교로 검증했습니다`

첫 번째 메시지가 보이면 컴파일 검증이 작동하는 것입니다.


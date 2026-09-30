# GUI 설치 프로그램 (게임 설치 마법사 스타일)

CMD 창 없이 **다음/뒤로** 버튼이 있는 설치 마법사 형태의 단일 exe입니다.

## 빌드 방법

**프로젝트 루트**에서:

```bash
npm run build:gui-installer
```

또는 단계별로:

```bash
# 1. payload 생성
npm run build:payload

# 2. installer-app에서 빌드
cd installer-app
npm install
npm run build
```

생성 파일: **웹사이트 설치 프로그램/PhotoSite-Setup.exe**

## 요구 사항

- Node.js (빌드 시)
- 받는 사람 PC에는 설치 경로에서 `동기화-및-로컬서버.bat` 등으로 사용하려면 **Node.js**가 필요합니다. (없으면 배치 파일 실행 시 자동 설치 시도)

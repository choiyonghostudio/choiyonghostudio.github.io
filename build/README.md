# 단일 실행 파일(이메일로 보낼 수 있는 설치 파일) 만들기

## 목적
**내 사이트 그 자체가 풀리는 것이 아니라**, 내가 만든 **사이트 디자인의 템플릿 + 편의 기능**을 사용할 수 있는 **사용자 맞춤 사이트 제작용 원클릭 설치 마법사**를 만들기 위함입니다.

**실행 파일 하나만** 이메일로 보내면, 받는 사람이 다운로드 후 **한 번만 실행**해도:
- 필요 프로그램(Node 등) 설치 시도
- 설치 경로, **사이트 이름**, **GitHub URL** 등 설정
- **템플릿**(디자인·편의 기능)이 선택한 경로에 설치  
→ 받는 사람이 자기 사이트로 바로 사용·푸시할 수 있습니다.

---

## Windows용 단일 exe (PhotoSite-Setup.exe)

1. **의존성 설치** (프로젝트 루트에서 한 번만)
   ```bash
   npm install
   ```

2. **단일 exe 생성**
   ```bash
   npm run build:sfx-win
   ```
   - `웹사이트 설치 프로그램/PhotoSite-Setup.exe` 가 생성됩니다.
   - `pkg`가 없으면 `npx pkg`로 자동 설치를 시도합니다. 실패 시 `npm install -g pkg` 후 다시 실행하세요.

3. **배포**
   - `웹사이트 설치 프로그램/PhotoSite-Setup.exe` **파일 하나만** 이메일로 보냅니다.
   - 받는 사람: 다운로드 → 더블클릭 → 자동으로 압축 해제 후 설치 마법사 실행 (Node 없으면 자동 설치 시도).

---

## Mac용 단일 .command (PhotoSite-Setup.command)

**Windows에서도 생성 가능**합니다 (payload.zip 사용, tar 불필요).

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **단일 .command 생성**
   ```bash
   npm run build:sfx-mac
   ```
   - `웹사이트 설치 프로그램/PhotoSite-Setup.command` 가 생성됩니다.

3. **배포**
   - `웹사이트 설치 프로그램/PhotoSite-Setup.command` **파일 하나만** 이메일로 보냅니다.
   - 받는 사람(Mac): 다운로드 → 더블클릭 (권한 요청 시 "열기") → 자동으로 압축 해제 후 설치 마법사 실행.

---

## pkg 실패 시 (Windows)

`npm run build:sfx-win` 이 pkg 오류로 실패하면:

1. **payload.zip만 사용**
   - `npm run build:payload` 로 `build/payload.zip` 생성
   - `build/payload.zip` + `설치하기.bat` 등이 들어 있는 **폴더 전체**를 압축해서 보내거나,
   - `build/payload.zip` 만 보내고 "압축 해제 후 폴더 안의 **설치하기.bat** 를 실행하세요"라고 안내할 수 있습니다.

2. **7-Zip SFX** (고급)
   - 7-Zip 설치 후 [7z Extra](https://www.7-zip.org/a/7z2301-extra.zip) 에서 `7zS.sfx` 추출
   - `7z a -t7z build/archive.7z ...` 로 아카이브 생성 후 `copy /b 7zS.sfx + config.txt + archive.7z PhotoSite-Setup.exe` 로 exe 생성 가능 (설정은 7-Zip SFX 문서 참고).

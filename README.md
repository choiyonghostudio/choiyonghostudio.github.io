# Jeong In Hwan Photography Portfolio

GitHub Pages에서 호스팅할 수 있는 **정적 사진 포트폴리오 사이트**입니다.

## 사용 방법

- `index.html`과 `style.css`만으로 동작하는 단일 페이지입니다.
- 루트에 그대로 두고 GitHub에 푸시한 뒤, 아래와 같이 GitHub Pages를 설정합니다.

## GitHub Pages 설정

1. 이 레포를 GitHub에 푸시합니다.
2. GitHub 웹에서 레포로 이동합니다.
3. **Settings → Pages** 메뉴로 이동합니다.
4. **Source**를 `Deploy from a branch`로 두고,  
   **Branch**를 `main` (또는 사용하는 기본 브랜치) / `/ (root)`로 지정합니다.
5. 저장하면, 잠시 후 상단에 사이트 주소가 생성됩니다.

## 사진 관리 방법 (images 폴더 + JSON 자동 렌더링)

사진은 레포의 `images` 폴더에 저장하고, 루트의 `images.json` 파일을 통해 자동으로 화면에 표시됩니다.

1. 레포 루트에 `images` 폴더를 만들고, 그 안에 사진 파일들을 넣습니다.
   - 예: `images/landscape-01.jpg`, `images/portrait-01.png` 등
2. 로컬에서 Node.js로 다음 스크립트를 실행합니다.

```bash
node generate-images-json.mjs
```

그러면 `images` 폴더 안의 이미지 파일 목록을 읽어서, 자동으로 아래 형식의 `images.json`을 생성/업데이트합니다.

```json
[
  {
    "src": "images/landscape-01.jpg",
    "alt": "landscape-01"
  },
  {
    "src": "images/portrait-01.png",
    "alt": "portrait-01"
  }
]
```

- 지원 확장자: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`
- `alt`는 파일명을 기반으로 자동 생성되며, 필요하면 `images.json`을 직접 열어 수정해도 됩니다.

브라우저에서 페이지가 로드되면, `index.html`의 스크립트가 `images.json`을 읽고  
각 항목마다 `<figure class="gallery-item"><img ... /></figure>`를 자동으로 생성해 5열 그리드에 표시합니다.

## 레이아웃 특징

- 기본 배경은 **완전 흰색(#ffffff)** 입니다.
- 사진은 PC 기준 **5열(grid 5 columns)** 로 나열됩니다.
- 화면 폭이 줄어들면 자동으로 4열 → 3열 → 2열로 줄어드는 반응형 레이아웃입니다.
- 별도의 로고 이미지는 사용하지 않고, 상단에 텍스트로 이름과 포트폴리오 타이틀만 보여줍니다.



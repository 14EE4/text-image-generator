# 픽셀 텍스트 → 이미지 변환기

픽셀 폰트 스프라이트를 사용하여 텍스트를 투명 배경 PNG 이미지로 변환하는 웹 도구입니다.

> 🤖 **이 프로젝트는 Claude (Anthropic AI)의 도움으로 제작되었습니다.**

## ✨ 주요 기능

- 📝 **여러 줄 텍스트 지원** - 줄바꿈이 포함된 긴 텍스트 렌더링
- 🎨 **색상 커스터마이징** - 컬러 피커 또는 HEX 코드 직접 입력
- 📏 **세밀한 간격 조절** - 글자 간격, 공백 너비, 줄 간격 조정
- 🔍 **화면 배율 조절** - 1~6배 확대하여 미리보기 (픽셀 퍼펙트)
- 💾 **투명 배경 PNG 다운로드** - 고품질 PNG 이미지 내보내기
- ⌨️ **키보드 단축키** - `Ctrl+Enter`로 빠른 생성
- 🪟 **Windows XP 테마** - 레트로 UI 지원

## 📦 지원 폰트

| 폰트 | 높이 | 설명 |
|------|------|------|
| **English Old** | 18px | 클래식 픽셀 폰트 (대문자, 소문자, 숫자, 기호) |
| **Smallest Font** | 5px | 초소형 비트맵 폰트 (알파벳만) |

## 🚀 빠른 시작

### 로컬 서버 실행

```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (npx http-server)
npx http-server -p 8000
```

브라우저에서 접속:
- **기본 테마**: `http://localhost:8000`
- **XP 테마**: `http://localhost:8000/xp_theme/`

### 사용 방법

1. **폰트 선택** - 드롭다운에서 원하는 폰트 선택
2. **텍스트 입력** - 텍스트 영역에 내용 입력 (Enter로 줄바꿈)
3. **설정 조정** - 색상, 간격, 배율 등을 슬라이더로 조절
4. **생성** - `Ctrl+Enter` 또는 "생성" 버튼 클릭
5. **다운로드** - "이미지 다운로드" 링크 클릭
6. **테마 전환** - 우측 상단/상단 버튼으로 테마 변경

## 📁 프로젝트 구조

```
text-image-generator/
├── index.html              # 메인 HTML (기본 테마)
├── script.js               # 메인 스크립트 (ES6 모듈)
├── js/                     # 공통 모듈
│   ├── fonts.js           # 폰트 설정 및 경로 관리
│   ├── utils.js           # 유틸리티 함수 (색상, 파일명 등)
│   ├── loader.js          # 리소스 로더 (FontLoader 클래스)
│   └── renderer.js        # 글리프 렌더러 (GlyphRenderer 클래스)
├── xp_theme/              # Windows XP 테마
│   ├── index.html         # XP 스타일 UI (xp.css)
│   └── script.js          # XP 테마용 스크립트 (상위 js/ 참조)
├── sprite_fonts/          # 폰트 리소스
│   ├── english_old/
│   │   ├── coords.json    # 글리프 좌표 데이터
│   │   └── english_old.png # 스프라이트 이미지
│   └── smallest_font/
│       ├── smallest_coords.json
│       └── smallest-font.png
└── README.md
```

## 🛠️ 기술 스택

- **Vanilla JavaScript (ES6 모듈)** - 프레임워크 없이 순수 JS
- **Canvas API** - 픽셀 퍼펙트 렌더링 및 픽셀 조작
- **ImageData API** - 실시간 색상 틴팅
- **Fetch API** - 비동기 리소스 로딩
- **CSS3** - 반응형 UI 스타일링
- **[xp.css](https://botoxparty.github.io/XP.css/)** - Windows XP 스타일 (옵션)

## 🎨 렌더링 방식

### Canvas 2D Context
- **오프스크린 캔버스**를 사용한 색상 틴팅
- **ImageData API**로 픽셀 단위 RGB 값 직접 수정
- `imageSmoothingEnabled = false`로 픽셀 퍼펙트 유지
- **정수 배율 스케일링**으로 픽셀 왜곡 방지

### 처리 흐름
```
스프라이트 로드 → 레이아웃 계산 → 글리프별 색상 틴팅 → 메인 캔버스 합성 → PNG 출력
```

## 📝 coords.json 형식

```json
{
  "meta": {
    "image": "sprite.png",
    "imageWidth": 640,
    "imageHeight": 18,
    "charCount": 52,
    "order": "AaBbCc..."
  },
  "coords": [
    {
      "char": "A",
      "index": 0,
      "sx": 0,
      "sy": 0,
      "w": 12,
      "h": 18
    }
  ]
}
```

## 🔧 새 폰트 추가하기

1. **스프라이트 이미지 준비** (PNG, 투명 배경)
2. **coords.json 생성** - 각 글자의 위치와 크기 정의
3. **js/fonts.js 수정**:

```javascript
export const FONTS = {
  your_font: {
    coords: './sprite_fonts/your_font/coords.json',
    sprite: './sprite_fonts/your_font/sprite.png',
    cellH: 높이,
    defaultSpaceWidth: 공백너비,
    defaultDisplayScale: 기본배율
  }
};
```

4. **index.html 및 xp_theme/index.html에 옵션 추가**:

```html
<option value="your_font">Your Font Name (높이px)</option>
```

## 🎯 주요 클래스

### FontLoader
폰트 리소스 로드 및 관리
```javascript
constructor(statusCallback, basePath = './')
loadResources(fontKey) // 비동기 폰트 로딩, coords + sprite
```

**특징:**
- 상대 경로 자동 조정 (`basePath`)
- XP 테마에서 `../` 경로 지원
- 좌표 맵 자동 생성 (`coordsMap`)

### GlyphRenderer
Canvas 렌더링 엔진
```javascript
constructor(canvas, loader)
render(text, options) // 텍스트 렌더링
drawTintedGlyph(g, ctx, x, y, color, h) // 색상 변경 글리프 그리기
getTransparentDataURL(threshold, color) // PNG 데이터 생성
```

**특징:**
- 오프스크린 캔버스 틴팅
- 레이아웃 캐싱 (`lastRenderLayout`)
- 투명 배경 최적화

### 유틸리티 함수 (utils.js)
```javascript
normalizeHex(v)           // HEX 색상 정규화
hexToRgb(hex)             // HEX → RGB 변환
sanitizeFilename(text)    // 파일명 안전화
setCanvasSize(canvas, ctx, w, h) // 캔버스 크기 설정
```

## 🐛 알려진 제한사항

- 영문 알파벳과 일부 기호만 지원 (폰트에 따라 다름)
- 유니코드/이모지 미지원
- 매우 긴 텍스트는 성능 저하 가능
- 모바일 터치 최적화 미흡

## 🔮 향후 계획

- [ ] 추가 폰트 지원 (한글, 일본어 등)
- [ ] 프리셋 저장/불러오기 (LocalStorage)
- [ ] 실시간 미리보기 최적화
- [ ] 다크 모드 테마
- [ ] 드래그 앤 드롭 폰트 업로드

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

## 🤝 기여

이슈 제보 및 풀 리퀘스트 환영합니다!

### 개발 환경 설정
```bash
# 로컬 서버 실행
python -m http.server 8000

# 브라우저 개발자 도구로 디버깅
# Chrome DevTools > Sources > script.js 브레이크포인트 설정
```

## 🤖 제작 정보

이 프로젝트는 **Claude (Anthropic AI)** 와의 협업으로 제작되었습니다.

- **AI 모델**: Claude 3.5 Sonnet
- **개발 방식**: 페어 프로그래밍 스타일 대화형 개발
- **주요 기여**:
  - 모듈화된 아키텍처 설계
  - Canvas API 기반 픽셀 렌더링 구현
  - 색상 틴팅 알고리즘
  - Windows XP 테마 UI

---

**버전:** 2.0.0  
**최종 업데이트:** 2025-11-02  
**테마:** 기본 + Windows XP  
**렌더링:** Canvas 2D + ImageData API  
**AI Assisted:** Claude 3.5 Sonnet
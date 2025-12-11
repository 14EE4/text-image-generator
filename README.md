# 픽셀 텍스트 → 이미지 변환기

픽셀 폰트 스프라이트를 사용하여 텍스트를 투명 배경 PNG 이미지로 변환하는 웹 도구입니다.

> 🤖 이 프로젝트는 GitHub Copilot (GPT-5, Claude 3.5 Sonnet)의 도움으로 제작되었습니다.

## ✨ 주요 기능

- 📝 여러 줄 텍스트 지원
- 🎨 색상 커스터마이징 (컬러 피커/HEX)
- 📏 글자 간격·공백 너비·줄 간격 조절
- 🔍 화면 배율 1~6x (픽셀 퍼펙트)
- 💾 투명 배경 PNG 다운로드
- ⌨️ 단축키 `Ctrl+Enter`로 생성
- 🪟 Windows XP 테마, 🖥️ Windows 98 테마
- 🔁 상단 고정 테마 전환 버튼(기본/XP/98 페이지 공통)
- 🌙 다크 모드 자동 감지 + 토글 버튼(메인 페이지, LocalStorage 저장)

## 📦 지원 폰트

| 폰트 | 높이 | 설명 |
|------|------|------|
| English Old | 18px | 클래식 픽셀 폰트 |
| Smallest Font | 5px | 초소형 비트맵 폰트 |

## 🚀 빠른 시작

### 로컬 서버
```bash
python -m http.server 8000
# 또는
npx http-server -p 8000
```

브라우저에서 접속:
- 기본 테마: http://localhost:8000/
- XP 테마: http://localhost:8000/xp_theme/
- 98 테마: http://localhost:8000/98_theme/

## 📁 프로젝트 구조

```
text-image-generator/
├── index.html              # 기본 테마 (상단 테마 전환 + 다크 모드 토글)
├── script.js               # 기본 테마 스크립트
├── js/
│   ├── fonts.js            # 폰트 설정/경로
│   ├── utils.js            # 유틸리티
│   ├── loader.js           # FontLoader
│   └── renderer.js         # GlyphRenderer
├── xp_theme/
│   ├── index.html          # XP 스타일 (xp.css, 상단 전환 버튼)
│   └── script.js           # 상위 js/ 재사용, basePath('../')
├── 98_theme/
│   └── index.html          # 98 스타일 (98.css, 상단 전환 버튼)
├── sprite_fonts/
│   ├── english_old/
│   │   ├── coords.json
│   │   └── english_old.png
│   └── smallest_font/
│       ├── smallest_coords.json
│       └── smallest-font.png
└── README.md
```

## 🛠️ 기술 스택

- Vanilla JavaScript(ES6 모듈)
- Canvas 2D + ImageData API (색상 틴팅)
- Fetch API
- CSS3
- 다크 모드: prefers-color-scheme + LocalStorage 토글
- XP 테마: xp.css (https://unpkg.com/xp.css)
- 98 테마: 98.css (https://unpkg.com/98.css)

## 🎨 렌더링 방식

- 오프스크린 캔버스로 글리프 색상 틴팅
- imageSmoothingEnabled=false로 보간 제거
- 정수 배율 스케일링, DPR 영향 제거(1:1 픽셀 매칭)

흐름: 스프라이트 로드 → 레이아웃 계산 → 색상 틴팅 → 캔버스 합성 → PNG 출력

## 🛡️ 픽셀 무결성 보장 (Pixel Purity)

**Brave** 등 핑거프린팅 방지 기능이 켜진 브라우저에서도 사용자가 의도한 정확한 색상(투명도 포함)을 얻을 수 있도록 별도의 **커스텀 PNG 인코더(`js/png_encoder.js`)**를 내장했습니다.

- **Direct Encoding**: 브라우저의 `toDataURL`을 사용하지 않고, 검증된 메모리 버퍼에서 직접 PNG 파일을 생성합니다.
- **Privacy Bypass**: 브라우저가 다운로드되는 이미지에 노이즈를 섞는 행위를 원천 차단합니다.
- **GPU Safe**: 그래픽 드라이버의 연산 오차 없이 완벽한 `(0,0,0,0)` 또는 선택된 색상을 보장합니다.

## 📝 coords.json 형식

```json
{
  "meta": { "image": "sprite.png", "imageWidth": 640, "imageHeight": 18, "charCount": 52 },
  "coords": [{ "char": "A", "index": 0, "sx": 0, "sy": 0, "w": 12, "h": 18 }]
}
```

## 🎯 주요 클래스

- FontLoader(statusCallback, basePath='./')
  - coords.json 및 스프라이트 로드
  - XP/98 테마에서 basePath('../')로 상위 리소스 참조
- GlyphRenderer(canvas, loader)
  - render(text, options), getTransparentDataURL()

## 🐛 알려진 제한사항

- 지원 문자는 폰트 파일에 의존
- 유니코드/이모지 미지원
- 매우 긴 텍스트 성능 저하 가능

## 🤝 기여

이슈/PR 환영

## 📄 라이선스

MIT

---

버전: 2.2.1  
최종 업데이트: 2025-12-11  
테마: 기본 + Windows XP + Windows 98  
렌더링: Canvas 2D + Custom PNG Encoder (Client-side)  
AI Assisted: GitHub Copilot (GPT-5, Claude 3.5 Sonnet)
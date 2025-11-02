# 픽셀 텍스트 → 이미지 변환기

픽셀 폰트 스프라이트를 사용하여 텍스트를 투명 배경 PNG 이미지로 변환하는 웹 도구입니다.

## ✨ 주요 기능

- 📝 **여러 줄 텍스트 지원** - 줄바꿈이 포함된 긴 텍스트 렌더링
- 🎨 **색상 커스터마이징** - 컬러 피커 또는 HEX 코드 직접 입력
- 📏 **세밀한 간격 조절** - 글자 간격, 공백 너비, 줄 간격 조정
- 🔍 **화면 배율 조절** - 1~6배 확대하여 미리보기
- 💾 **투명 배경 PNG 다운로드** - 고품질 PNG 이미지 내보내기
- ⌨️ **키보드 단축키** - `Ctrl+Enter`로 빠른 생성

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

브라우저에서 `http://localhost:8000` 접속

### 사용 방법

1. **폰트 선택** - 드롭다운에서 원하는 폰트 선택
2. **텍스트 입력** - 텍스트 영역에 내용 입력 (Enter로 줄바꿈)
3. **설정 조정** - 색상, 간격, 배율 등을 슬라이더로 조절
4. **생성** - `Ctrl+Enter` 또는 "생성" 버튼 클릭
5. **다운로드** - "이미지 다운로드" 링크 클릭

## 📁 프로젝트 구조

```
text-image-generator/
├── index.html              # 메인 HTML
├── script.js               # 메인 스크립트 (ES6 모듈)
├── js/
│   ├── fonts.js           # 폰트 설정
│   ├── utils.js           # 유틸리티 함수
│   ├── loader.js          # 리소스 로더
│   └── renderer.js        # 글리프 렌더러
├── sprite_fonts/
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
- **Canvas API** - 이미지 렌더링 및 픽셀 조작
- **Fetch API** - 비동기 리소스 로딩
- **CSS3** - 반응형 UI 스타일링

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

4. **index.html에 옵션 추가**:

```html
<option value="your_font">Your Font Name (높이px)</option>
```

## 🎯 주요 클래스

### FontLoader
- 폰트 리소스 로드 및 관리
- `loadResources(fontKey)` - 비동기 폰트 로딩

### GlyphRenderer
- Canvas 렌더링 엔진
- `render(text, options)` - 텍스트 렌더링
- `getTransparentDataURL(threshold, color)` - PNG 데이터 생성
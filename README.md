# 픽셀 텍스트 → 이미지

픽셀 폰트로 텍스트를 PNG 이미지로 변환하는 웹 도구.

## 기능
- 여러 줄 텍스트 지원
- 색상/간격/배율 조절
- 투명 배경 PNG 다운로드

## 사용법
1. 텍스트 입력
2. 색상/설정 조정
3. Enter 또는 생성 버튼
4. 이미지 다운로드

## 실행
```bash
python -m http.server 8000
# http://localhost:8000
```

## 파일
- `index.html` - UI
- `script.js` - 로직
- `coords.json` - 글리프 좌표
- `english_old2.png` - 스프라이트

## 라이선스
MIT
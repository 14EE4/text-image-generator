document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const input = document.getElementById('textInput');
    const btn = document.getElementById('generateBtn');
    const downloadLink = document.getElementById('downloadLink');
    const widthInput = document.getElementById('canvasWidth');
    const heightInput = document.getElementById('canvasHeight');
    const dotSizeInput = document.getElementById('dotSize');
    const dotSizeVal = document.getElementById('dotSizeVal');

    // 간단한 디바운스 유틸
    function debounce(fn, delay = 200) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), delay);
        };
    }

    dotSizeInput.addEventListener('input', () => {
        dotSizeVal.textContent = dotSizeInput.value;
        scheduleRender();
    });

    // 즉시 캔버스 크기(시각적) 반영 + 미리보기 예약
    function applyCanvasSizeVisual(w, h) {
        canvas.width = w;
        canvas.height = h;
        // 명시적으로 스타일 너비/높이도 설정 -> 렌더링/표시 크기 일치
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
    }

    // 디바운스된 렌더 호출
    const scheduleRender = debounce(() => {
        const t = input.value.trim() || 'Sample';
        renderDotText(t);
    }, 250);

    widthInput.addEventListener('input', () => {
        const v = Math.max(50, parseInt(widthInput.value, 10) || 800);
        widthInput.value = v;
        applyCanvasSizeVisual(v, parseInt(heightInput.value, 10) || canvas.height);
        scheduleRender();
    });

    heightInput.addEventListener('input', () => {
        const v = Math.max(50, parseInt(heightInput.value, 10) || 200);
        heightInput.value = v;
        applyCanvasSizeVisual(parseInt(widthInput.value, 10) || canvas.width, v);
        scheduleRender();
    });

    async function renderDotText(text) {
        const w = Math.max(50, parseInt(widthInput.value, 10) || 800);
        const h = Math.max(50, parseInt(heightInput.value, 10) || 200);
        const dotSize = Math.max(1, parseInt(dotSizeInput.value, 10) || 8);

        // 캔버스 크기 설정 (그리기 버퍼)
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';

        // 오프스크린 캔버스(텍스트 렌더링용)
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const offCtx = off.getContext('2d');

        // 폰트 크기 계산 (높이에 비례)
        const fontSize = Math.max(12, Math.floor(h * 0.6));
        await document.fonts.load(`${fontSize}px "UnifrakturMaguntia"`);

        // 배경 흰색
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, w, h);

        // 텍스트 그리기 (가운데 정렬)
        offCtx.fillStyle = '#000000';
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'middle';
        offCtx.font = `${fontSize}px "UnifrakturMaguntia", serif`;
        offCtx.fillText(text, w / 2, h / 2);

        // 픽셀 데이터 읽기
        const img = offCtx.getImageData(0, 0, w, h);
        const data = img.data;

        // 표시 캔버스 초기화(배경)
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        // 도트 그리기: 그리드 간격 = dotSize, 샘플 위치은 셀 중앙
        const radius = Math.max(0.5, dotSize / 2 * 0.9);
        for (let y = 0; y < h; y += dotSize) {
            for (let x = 0; x < w; x += dotSize) {
                const sx = Math.min(w - 1, x + Math.floor(dotSize / 2));
                const sy = Math.min(h - 1, y + Math.floor(dotSize / 2));
                const idx = (sy * w + sx) * 4;
                const alpha = data[idx + 3];
                // 픽셀이 텍스트(검정)에 가깝다면 도트 그리기
                if (alpha > 50) {
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];
                    ctx.fillStyle = `rgb(${r},${g},${b})`;
                    ctx.beginPath();
                    ctx.arc(x + dotSize / 2, y + dotSize / 2, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // 다운로드 링크 설정
        downloadLink.href = canvas.toDataURL('image/png');
        downloadLink.download = 'text-dot.png';
        downloadLink.style.display = 'inline';
        downloadLink.textContent = '이미지 다운로드';
    }

    btn.addEventListener('click', () => {
        const t = input.value.trim() || 'Sample';
        renderDotText(t);
    });

    // 초기 적용 및 미리보기
    applyCanvasSizeVisual(parseInt(widthInput.value, 10) || 800, parseInt(heightInput.value, 10) || 200);
    renderDotText(input.value.trim() || 'Sample');
});
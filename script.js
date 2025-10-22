document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
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

    // 즉시 캔버스 스타일 크기만 반영(버퍼는 렌더 시 적용)
    function applyCanvasSizeVisual(w, h) {
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
    }

    // 디바운스된 렌더 호출
    const scheduleRender = debounce(() => {
        const t = input.value.trim() || 'Sample';
        renderDotText(t);
    }, 200);

    // input/change 모두 반영
    function onSizeInput() {
        const w = Math.max(50, parseInt(widthInput.value, 10) || 800);
        const h = Math.max(50, parseInt(heightInput.value, 10) || 200);
        widthInput.value = w;
        heightInput.value = h;
        applyCanvasSizeVisual(w, h);
        scheduleRender();
    }
    widthInput.addEventListener('input', onSizeInput);
    widthInput.addEventListener('change', onSizeInput);
    heightInput.addEventListener('input', onSizeInput);
    heightInput.addEventListener('change', onSizeInput);

    async function renderDotText(text) {
        const w = Math.max(50, parseInt(widthInput.value, 10) || 800);
        const h = Math.max(50, parseInt(heightInput.value, 10) || 200);
        const dotSize = Math.max(1, parseInt(dotSizeInput.value, 10) || 8);

        // DPR(고해상도) 처리: 내부 버퍼는 DPR 배율로 키우고 스타일은 CSS픽셀 유지
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';

        // 컨텍스트는 리사이즈 후 다시 가져오고 스케일 적용
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 이후 그리기는 CSS 픽셀 단위

        // 오프스크린 캔버스(텍스트 렌더링용)도 DPR 고려
        const off = document.createElement('canvas');
        off.width = Math.round(w * dpr);
        off.height = Math.round(h * dpr);
        off.style.width = w + 'px';
        off.style.height = h + 'px';
        const offCtx = off.getContext('2d');
        offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // 폰트 크기 계산 (CSS 픽셀 기준)
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

        // 픽셀 데이터 읽기 (CSS 픽셀 크기 영역)
        const img = offCtx.getImageData(0, 0, Math.round(w), Math.round(h));
        const data = img.data;

        // 표시 캔버스 초기화(배경)
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        // 도트 그리기: 그리드 간격 = dotSize, 샘플 위치는 셀 중앙
        const radius = Math.max(0.5, dotSize / 2 * 0.9);
        for (let y = 0; y < h; y += dotSize) {
            for (let x = 0; x < w; x += dotSize) {
                const sx = Math.min(Math.round(w) - 1, x + Math.floor(dotSize / 2));
                const sy = Math.min(Math.round(h) - 1, y + Math.floor(dotSize / 2));
                const idx = (sy * Math.round(w) + sx) * 4;
                const alpha = data[idx + 3];
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
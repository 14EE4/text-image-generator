document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const input = document.getElementById('textInput');
    const btn = document.getElementById('generateBtn');
    const downloadLink = document.getElementById('downloadLink');

    async function renderText(text) {
        // 폰트가 로드될 때까지 대기 (영문 텍스트에만 적용되는 장식 폰트)
        await document.fonts.load('72px "UnifrakturMaguntia"');

        // 배경 초기화
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 캔버스에 폰트 적용 후 텍스트 그리기
        const fontSize = 72;
        ctx.fillStyle = '#000000';
        ctx.font = `${fontSize}px "UnifrakturMaguntia", serif`;
        ctx.textBaseline = 'middle';

        // 간단한 좌표 계산(필요하면 줄바꿈/정렬 로직 추가)
        const x = 20;
        const y = canvas.height / 2;
        ctx.fillText(text, x, y);

        // 다운로드 링크 설정
        downloadLink.href = canvas.toDataURL('image/png');
        downloadLink.download = 'text.png';
        downloadLink.style.display = 'inline';
        downloadLink.textContent = '이미지 다운로드';
    }

    btn.addEventListener('click', () => {
        const t = input.value.trim() || 'Sample';
        renderText(t);
    });
});
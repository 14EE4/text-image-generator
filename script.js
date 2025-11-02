document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const input = document.getElementById('textInput');
  const btn = document.getElementById('generateBtn');
  const lineSpacingInput = document.getElementById('lineSpacing');
  const lineSpacingVal = document.getElementById('lineSpacingVal');

  // resources
  const sprite = new Image();
  let coords = [];
  let cmap = {};

  // helpers
  function setCanvasSize(w, h) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function loadJSON(path) {
    return fetch(path).then(r => {
      if (!r.ok) throw new Error('coords fetch fail');
      return r.json();
    });
  }

  function buildMap() {
    cmap = {};
    for (const g of coords) if (g && typeof g.char !== 'undefined') cmap[g.char] = g;
  }

  function getLineHeight() {
    // 고정 18px (원본 스프라이트 높이)
    return 18;
  }

  function render() {
    const text = (input.value || '').replace(/\r\n/g, '\n');
    const lines = text.split('\n');
    const gap = parseInt(lineSpacingInput.value || '0', 10) || 0;
    const H = getLineHeight();

    // 각 줄의 폭 계산 (문자 폭 합 + 문자 간 간격이 있다면 추가)
    const spaceW = 8; // 간단한 기본 공백폭(필요 시 조절)
    const widths = lines.map(line => {
      let w = 0;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === ' ') { w += spaceW; continue; }
        const g = cmap[ch] || cmap[ch.toUpperCase()] || cmap[ch.toLowerCase()];
        w += g ? g.w : 8;
      }
      return w;
    });

    const maxW = Math.max(1, widths.reduce((m, v) => Math.max(m, v), 1));
    // 전체 높이 = 줄수*18 + (줄수-1)*gap — 마지막 줄 뒤에는 gap 없음
    const totalH = Math.max(1, lines.length * H + Math.max(0, lines.length - 1) * gap);

    setCanvasSize(maxW, totalH);
    ctx.clearRect(0, 0, maxW, totalH);

    // y는 정확히 idx*(H+gap) — 추가 오프셋 없음
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      let x = 0;
      const y = li * (H + gap);
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === ' ') { x += spaceW; continue; }
        const g = cmap[ch] || cmap[ch.toUpperCase()] || cmap[ch.toLowerCase()];
        if (!g) { x += 8; continue; }
        // sy는 이미 0, h는 18로 맞춰져 있다고 가정
        ctx.drawImage(sprite, g.sx, g.sy || 0, g.w, g.h || H, x, y, g.w, g.h || H);
        x += g.w;
      }
    }
  }

  // UI wiring
  lineSpacingVal.textContent = lineSpacingInput.value;
  lineSpacingInput.addEventListener('input', () => {
    lineSpacingVal.textContent = lineSpacingInput.value;
    render();
  });
  btn.addEventListener('click', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      render();
    }
  });

  // load assets then initial render
  Promise.all([
    loadJSON('./coords.json').then(j => { coords = j.coords || []; buildMap(); }),
    new Promise(res => { sprite.onload = res; sprite.src = './english_old2.png'; })
  ]).then(render).catch(err => {
    console.error(err);
    setCanvasSize(600, 120);
    ctx.fillText('리소스 로드 실패', 20, 60);
  });
});
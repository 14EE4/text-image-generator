document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const input = document.getElementById('textInput');
  const btn = document.getElementById('generateBtn');
  const downloadLink = document.getElementById('downloadLink');

  const letterSpacingInput = document.getElementById('letterSpacing');
  const letterSpacingVal = document.getElementById('letterSpacingVal');
  const spaceWidthInput = document.getElementById('spaceWidth');
  const spaceWidthVal = document.getElementById('spaceWidthVal');
  const lineSpacingInput = document.getElementById('lineSpacing');
  const lineSpacingVal = document.getElementById('lineSpacingVal');
  const displayScaleInput = document.getElementById('displayScale');
  const displayScaleVal = document.getElementById('displayScaleVal');
  const colorPicker = document.getElementById('colorPicker');
  const colorHex = document.getElementById('colorHex');

  // 상태 배너
  const status = document.createElement('div');
  status.id = 'statusBanner';
  status.style.cssText = 'font-family:monospace;margin:6px;padding:6px;border:1px solid #ddd;background:#f8f8f8;';
  if (canvas && canvas.parentNode) canvas.parentNode.insertBefore(status, canvas);
  function setStatus(msg, isError = false) {
    status.textContent = msg;
    status.style.color = isError ? '#a00' : '#080';
    console.log('[STATUS]', msg);
  }

  function normalizeHex(v) {
    if (!v) return '#000000';
    v = v.trim();
    if (!v) return '#000000';
    if (v[0] !== '#') v = '#' + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
    return '#000000';
  }
  function hexToRgb(hex) {
    hex = normalizeHex(hex).slice(1);
    return { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16) };
  }

  // UI 초기값 표시
  if (displayScaleInput && displayScaleVal) displayScaleVal.textContent = displayScaleInput.value;
  if (letterSpacingInput && letterSpacingVal) letterSpacingVal.textContent = letterSpacingInput.value;
  if (spaceWidthInput && spaceWidthVal) spaceWidthVal.textContent = spaceWidthInput.value;
  if (lineSpacingInput && lineSpacingVal) lineSpacingVal.textContent = lineSpacingInput.value;
  if (colorPicker && colorHex) {
    colorHex.value = normalizeHex(colorPicker.value || colorHex.value);
    colorPicker.value = normalizeHex(colorHex.value);
  }

  function setCanvasSize(w, h) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  // 리소스
  let meta = { cellH: 18 };
  let coords = [];
  let coordsMap = {};
  const spriteImg = new Image();

  async function loadResources() {
    try {
      const res = await fetch('./coords.json');
      if (!res.ok) throw new Error(`coords.json fetch failed: ${res.status}`);
      const payload = await res.json();
      meta = payload.meta || meta;
      coords = payload.coords || [];
      coordsMap = {};
      for (const c of coords) if (c && c.char !== undefined) coordsMap[c.char] = c;
      setStatus(`coords.json loaded (${coords.length})`);
    } catch (e) {
      console.error(e);
      setStatus(`coords.json load failed: ${e.message}`, true);
      coords = []; coordsMap = {};
    }
    return new Promise((resolve) => {
      spriteImg.onload = () => {
        setStatus(`sprite loaded: ${spriteImg.naturalWidth}x${spriteImg.naturalHeight}`);
        resolve();
      };
      spriteImg.onerror = (ev) => {
        console.warn('sprite load error', ev);
        setStatus('sprite load failed', true);
        resolve();
      };
      spriteImg.src = './english_old2.png';
    });
  }

  // 틴팅용 오프스크린
  const tintOff = document.createElement('canvas');
  const tintOffCtx = tintOff.getContext('2d');

  function drawTintedGlyphToCtx(g, destCtx, dx, dy, colorHex, fixedH) {
    const w = g.w; const h = fixedH; // 높이는 18로 고정
    tintOff.width = w; tintOff.height = h;
    tintOffCtx.clearRect(0,0,w,h);
    tintOffCtx.drawImage(spriteImg, g.sx, g.sy || 0, w, h, 0, 0, w, h);
    const img = tintOffCtx.getImageData(0,0,w,h);
    const d = img.data;
    const rgb = hexToRgb(colorHex);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i+3] === 0) continue;
      d[i] = rgb.r; d[i+1] = rgb.g; d[i+2] = rgb.b;
    }
    tintOffCtx.putImageData(img, 0, 0);
    destCtx.drawImage(tintOff, 0, 0, w, h, dx, dy, w, h);
  }

  function sanitizeFilename(text) {
    const rawName = (text || '').trim() || 'text-glyphs';
    return rawName.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-\.]/g, '').slice(0,64) || 'text-glyphs';
  }

  let lastRenderLayout = null;

  async function renderUsingGlyphs(text) {
    try {
      if (!coords || coords.length === 0 || !spriteImg.complete || spriteImg.naturalWidth === 0) {
        setStatus('리소스 로드 중/실패', true);
        return;
      }
      const fixedH = meta.cellH || 18;

      const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
      const visualGap = (letterSpacingInput && !isNaN(Number(letterSpacingInput.value))) ? parseInt(letterSpacingInput.value,10) : 1;
      const lineGap = (lineSpacingInput && !isNaN(Number(lineSpacingInput.value))) ? parseInt(lineSpacingInput.value,10) : 0;
      const avgSrcW = Math.max(1, Math.round(coords.reduce((s,c)=>s + (c.w||0),0) / Math.max(1, coords.length)));
      const spaceSrcWidth = (spaceWidthInput && !isNaN(Number(spaceWidthInput.value))) ? parseInt(spaceWidthInput.value,10) : avgSrcW;

      const lineLayouts = [];
      let maxLineW = 0;
      let totalH = 0;

      for (const line of lines) {
        const layout = [];
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          const g = coordsMap[ch] || coordsMap[ch?.toUpperCase?.()] || coordsMap[ch?.toLowerCase?.()];
          if (ch === ' ') layout.push({ type: 'space', srcW: spaceSrcWidth, srcH: fixedH });
          else if (!g) layout.push({ type: 'empty', srcW: avgSrcW, srcH: fixedH });
          else layout.push({ type: 'glyph', g: g, srcW: g.w, srcH: fixedH });
        }
        let lineW = 0;
        for (const item of layout) lineW += item.srcW || 0;
        if (layout.length > 1) lineW += (layout.length - 1) * visualGap;

        lineLayouts.push({ layout, width: lineW, height: fixedH });
        maxLineW = Math.max(maxLineW, lineW);
        totalH += fixedH;
      }
      if (lineLayouts.length > 1) totalH += (lineLayouts.length - 1) * lineGap;

      lastRenderLayout = { lineLayouts, visualGap, lineGap };

      setCanvasSize(maxLineW || 1, totalH || fixedH);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      const displayScale = (displayScaleInput && !isNaN(Number(displayScaleInput.value))) ? parseInt(displayScaleInput.value,10) : 1;
      canvas.style.width = Math.round((maxLineW || 1) * displayScale) + 'px';
      canvas.style.height = Math.round((totalH || fixedH) * displayScale) + 'px';

      const selColor = (colorHex && colorHex.value) ? normalizeHex(colorHex.value) : (colorPicker ? normalizeHex(colorPicker.value || '#000000') : '#000000');

      let yOffset = 0;
      for (let lineIdx = 0; lineIdx < lineLayouts.length; lineIdx++) {
        const lineInfo = lineLayouts[lineIdx];
        let x = 0;
        for (let idx = 0; idx < lineInfo.layout.length; idx++) {
          const item = lineInfo.layout[idx];
          if (item.type === 'glyph') {
            drawTintedGlyphToCtx(item.g, ctx, x, yOffset, selColor, fixedH);
            x += item.srcW || 0;
          } else {
            x += item.srcW || 0;
          }
          if (idx < lineInfo.layout.length - 1) x += visualGap;
        }
        yOffset += lineInfo.height;
        if (lineIdx < lineLayouts.length - 1) yOffset += lineGap;
      }

      downloadLink.href = getTransparentDataURL(250);
      downloadLink.download = sanitizeFilename(text) + '.png';
      downloadLink.style.display = 'inline';
      downloadLink.textContent = '이미지 다운로드';
      setStatus('렌더링 완료');
    } catch (err) {
      console.error('render error', err);
      setStatus('렌더 오류: 콘솔 확인', true);
    }
  }

  function getTransparentDataURL(threshold = 250) {
    const selHex = (colorHex && colorHex.value) ? normalizeHex(colorHex.value) : (colorPicker ? normalizeHex(colorPicker.value || '#000000') : null);
    const selRgb = selHex ? hexToRgb(selHex) : null;
    const colorTolerance = 8;
    const closeToSelected = (r,g,b) => selRgb ? (Math.abs(r-selRgb.r)<=colorTolerance && Math.abs(g-selRgb.g)<=colorTolerance && Math.abs(b-selRgb.b)<=colorTolerance) : false;

    if (lastRenderLayout && lastRenderLayout.lineLayouts && lastRenderLayout.lineLayouts.length) {
      const lineLayouts = lastRenderLayout.lineLayouts;
      const visualGap = lastRenderLayout.visualGap || 0;
      const lineGap = lastRenderLayout.lineGap || 0;

      let maxW = 0, totalH = 0;
      for (const l of lineLayouts) { maxW = Math.max(maxW, l.width); totalH += l.height; }
      if (lineLayouts.length > 1) totalH += (lineLayouts.length - 1) * lineGap;
      if (maxW <= 0 || totalH <= 0) return canvas.toDataURL('image/png');

      const tmp = document.createElement('canvas');
      tmp.width = maxW; tmp.height = totalH;
      const tctx = tmp.getContext('2d'); tctx.imageSmoothingEnabled = false;

      const color = selHex || '#000000';
      let yOffset = 0;
      for (let lineIdx = 0; lineIdx < lineLayouts.length; lineIdx++) {
        const lineInfo = lineLayouts[lineIdx];
        let x = 0;
        for (let idx = 0; idx < lineInfo.layout.length; idx++) {
          const item = lineInfo.layout[idx];
          if (item.type === 'glyph') {
            const g = item.g; const w = g.w; const h = lineInfo.height;
            tintOff.width = w; tintOff.height = h;
            tintOffCtx.clearRect(0,0,w,h);
            tintOffCtx.drawImage(spriteImg, g.sx, g.sy || 0, w, h, 0, 0, w, h);
            const img = tintOffCtx.getImageData(0,0,w,h);
            const d = img.data;
            const rgb = hexToRgb(color);
            for (let pi = 0; pi < d.length; pi += 4) {
              if (d[pi+3] === 0) continue;
              d[pi] = rgb.r; d[pi+1] = rgb.g; d[pi+2] = rgb.b;
            }
            tintOffCtx.putImageData(img, 0, 0);
            tctx.drawImage(tintOff, 0, 0, w, h, x, yOffset, w, h);
            x += w;
          } else {
            x += item.srcW || 0;
          }
          if (idx < lineInfo.layout.length - 1) x += visualGap;
        }
        yOffset += lineInfo.height;
        if (lineIdx < lineLayouts.length - 1) yOffset += lineGap;
      }

      // 흰색 배경만 투명 처리 (선택 색상과 유사한 픽셀은 유지)
      const imgAll = tctx.getImageData(0,0,tmp.width,tmp.height);
      const dAll = imgAll.data;
      for (let i = 0; i < dAll.length; i += 4) {
        const r = dAll[i], g = dAll[i+1], b = dAll[i+2], a = dAll[i+3];
        if (a > 0 && r >= threshold && g >= threshold && b >= threshold) {
          if (!closeToSelected(r,g,b)) dAll[i+3] = 0;
        }
      }
      tctx.putImageData(imgAll, 0, 0);
      return tmp.toDataURL('image/png');
    }

    // Fallback: 현재 캔버스 스냅샷
    return canvas.toDataURL('image/png');
  }

  function triggerRender() {
    renderUsingGlyphs(input ? (input.value || '') : '');
  }

  function render() {
    const text = (input.value || '').replace(/\r\n/g, '\n');
    const lines = text.split('\n');

    const H = 18; // 한 줄 높이
    const gapRaw = parseInt((lineSpacingInput && lineSpacingInput.value) || '0', 10) || 0;
    const lineGap = Math.max(0, gapRaw); // 음수 차단

    // 각 줄 폭 계산
    const spaceW = 8;
    const widths = lines.map(line => {
      let w = 0;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === ' ') { w += spaceW; continue; }
        const g = coordsMap[ch] || coordsMap[ch?.toUpperCase?.()] || coordsMap[ch?.toLowerCase?.()];
        w += g ? g.w : 8;
      }
      return w;
    });

    // 블록 전체 크기
    const blockW = Math.max(1, widths.reduce((m,v)=>Math.max(m,v), 1));
    const blockH = Math.max(1, lines.length * H + Math.max(0, lines.length - 1) * lineGap);

    // 캔버스 크기를 블록에 딱 맞추면 수직 중앙은 의미 없음.
    // 여백이 있는 고정 캔버스를 쓰고 싶다면 setCanvasSize(원하는W, 원하는H)로 바꾸세요.
    setCanvasSize(blockW, blockH);
    ctx.clearRect(0, 0, blockW, blockH);
    ctx.imageSmoothingEnabled = false;

    // 세로 중앙 시작점(캔버스가 블록보다 크면 적용됨)
    const yStart = Math.floor((canvas.height / (window.devicePixelRatio||1) - blockH) / 2);
    for (let li = 0, y = yStart; li < lines.length; li++) {
      const line = lines[li];
      const lineW = widths[li];
      // 가로 중앙 시작점
      let x = Math.floor((blockW - lineW) / 2);

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === ' ') { x += spaceW; continue; }
        const g = coordsMap[ch] || coordsMap[ch?.toUpperCase?.()] || coordsMap[ch?.toLowerCase?.()];
        if (!g) { x += 8; continue; }
        ctx.drawImage(spriteImg, g.sx, g.sy || 0, g.w, g.h || H, x, y, g.w, g.h || H);
        x += g.w;
      }
      // 다음 줄 y
      if (li < lines.length - 1) y += H + lineGap;
    }
  }

  // 이벤트
  if (letterSpacingInput) letterSpacingInput.addEventListener('input', () => { if (letterSpacingVal) letterSpacingVal.textContent = letterSpacingInput.value; triggerRender(); });
  if (spaceWidthInput) spaceWidthInput.addEventListener('input', () => { if (spaceWidthVal) spaceWidthVal.textContent = spaceWidthInput.value; triggerRender(); });
  if (lineSpacingInput) lineSpacingInput.addEventListener('input', () => { if (lineSpacingVal) lineSpacingVal.textContent = lineSpacingInput.value; triggerRender(); });
  if (displayScaleInput) displayScaleInput.addEventListener('input', () => { if (displayScaleVal) displayScaleVal.textContent = displayScaleInput.value; triggerRender(); });
  if (colorPicker && colorHex) {
    colorPicker.addEventListener('input', () => { colorHex.value = normalizeHex(colorPicker.value); triggerRender(); });
    colorHex.addEventListener('input', () => { colorHex.value = normalizeHex(colorHex.value); try { colorPicker.value = colorHex.value; } catch(e){} triggerRender(); });
  }
  if (btn) btn.addEventListener('click', triggerRender);
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); triggerRender(); } });

  if (downloadLink) downloadLink.style.display = 'none';

  // 로드 후 초기 렌더
  loadResources().then(() => {
    setStatus('준비 완료');
    triggerRender();
  });
});
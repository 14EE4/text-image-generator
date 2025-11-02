document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const input = document.getElementById('textInput');
  const btn = document.getElementById('generateBtn');
  const downloadLink = document.getElementById('downloadLink');
  const fontSelect = document.getElementById('fontSelect');

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

  // 폰트 설정
  const FONTS = {
    english_old: {
      coords: './sprite_fonts/english_old/coords.json',
      sprite: './sprite_fonts/english_old/english_old.png',
      cellH: 18,
      defaultSpaceWidth: 4,
      defaultDisplayScale: 2
    },
    smallest_font: {
      coords: './sprite_fonts/smallest_font/smallest_coords.json',
      sprite: './sprite_fonts/smallest_font/smallest-font.png',
      cellH: 5,
      defaultSpaceWidth: 2,
      defaultDisplayScale: 6
    }
  };

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

  async function loadResources(fontKey) {
    const fontConfig = FONTS[fontKey];
    if (!fontConfig) {
      setStatus('알 수 없는 폰트', true);
      return;
    }

    // 공백 너비 기본값 변경
    if (spaceWidthInput && spaceWidthVal) {
      spaceWidthInput.value = fontConfig.defaultSpaceWidth;
      spaceWidthVal.textContent = fontConfig.defaultSpaceWidth;
    }

    // 화면 배율 기본값 변경
    if (displayScaleInput && displayScaleVal) {
      displayScaleInput.value = fontConfig.defaultDisplayScale;
      displayScaleVal.textContent = fontConfig.defaultDisplayScale;
    }

    try {
      const res = await fetch(fontConfig.coords);
      if (!res.ok) throw new Error(`coords fetch failed: ${res.status}`);
      const payload = await res.json();
      meta = payload.meta || { cellH: fontConfig.cellH };
      meta.cellH = fontConfig.cellH; // 고정값 사용
      coords = payload.coords || [];
      coordsMap = {};
      for (const c of coords) if (c && c.char !== undefined) coordsMap[c.char] = c;
      setStatus(`${fontKey} coords loaded (${coords.length})`);
    } catch (e) {
      console.error(e);
      setStatus(`${fontKey} coords load failed: ${e.message}`, true);
      coords = []; coordsMap = {};
    }

    return new Promise((resolve) => {
      spriteImg.onload = () => {
        setStatus(`${fontKey} sprite loaded: ${spriteImg.naturalWidth}x${spriteImg.naturalHeight}`);
        resolve();
      };
      spriteImg.onerror = (ev) => {
        console.warn('sprite load error', ev);
        setStatus(`${fontKey} sprite load failed`, true);
        resolve();
      };
      spriteImg.src = fontConfig.sprite;
    });
  }

  // 틴팅용 오프스크린
  const tintOff = document.createElement('canvas');
  const tintOffCtx = tintOff.getContext('2d');

  function drawTintedGlyphToCtx(g, destCtx, dx, dy, colorHex, fixedH) {
    const w = g.w; const h = fixedH;
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
      const lineGap = (lineSpacingInput && !isNaN(Number(lineSpacingInput.value))) ? parseInt(lineSpacingInput.value,10) : 1;
      const avgSrcW = Math.max(1, Math.round(coords.reduce((s,c)=>s + (c.w||0),0) / Math.max(1, coords.length)));
      const spaceSrcWidth = (spaceWidthInput && !isNaN(Number(spaceWidthInput.value))) ? parseInt(spaceWidthInput.value,10) : 4;

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

    return canvas.toDataURL('image/png');
  }

  function triggerRender() {
    renderUsingGlyphs(input ? (input.value || '') : '');
  }

  // 이벤트
  if (fontSelect) fontSelect.addEventListener('change', async () => {
    setStatus('폰트 로딩 중...');
    await loadResources(fontSelect.value);
    triggerRender();
  });
  
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

  // 초기 로드
  loadResources(fontSelect.value).then(() => {
    setStatus('준비 완료');
    triggerRender();
  });
});
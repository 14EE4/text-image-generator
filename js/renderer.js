import { hexToRgb, setCanvasSize, sanitizeFilename } from './utils.js';

export class GlyphRenderer {
  constructor(canvas, loader) {
    this.canvas = canvas;
    // Force CPU rendering (software) to avoid GPU color dithering/approximation
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.loader = loader;
    this.lastRenderLayout = null;

    this.tintOff = document.createElement('canvas');
    this.tintOffCtx = this.tintOff.getContext('2d', { willReadFrequently: true });
  }

  drawTintedGlyph(g, destCtx, dx, dy, colorHex, fixedH) {
    const w = g.w;
    const h = fixedH;

    this.tintOff.width = w;
    this.tintOff.height = h;
    this.tintOffCtx.clearRect(0, 0, w, h);
    this.tintOffCtx.drawImage(this.loader.spriteImg, g.sx, g.sy || 0, w, h, 0, 0, w, h);

    const img = this.tintOffCtx.getImageData(0, 0, w, h);
    const d = img.data;
    const rgb = hexToRgb(colorHex);

    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) {
        // Fully transparent pixel – clear RGB as well.
        d[i] = 0;
        d[i + 1] = 0;
        d[i + 2] = 0;
        continue;
      }
      // Visible pixel – force pure black and full opacity.
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 255;
    }

    this.tintOffCtx.putImageData(img, 0, 0);
    destCtx.drawImage(this.tintOff, 0, 0, w, h, dx, dy, w, h);
  }

  render(text, options) {
    const { visualGap, lineGap, spaceSrcWidth, displayScale, color } = options;

    if (!this.loader.coords.length || !this.loader.spriteImg.complete || this.loader.spriteImg.naturalWidth === 0) {
      return { success: false, error: '리소스 로드 중/실패' };
    }

    const fixedH = this.loader.meta.cellH || 18;
    const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
    const avgSrcW = Math.max(1, Math.round(this.loader.coords.reduce((s, c) => s + (c.w || 0), 0) / Math.max(1, this.loader.coords.length)));

    const lineLayouts = [];
    let maxLineW = 0;
    let totalH = 0;

    for (const line of lines) {
      const layout = [];
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const g = this.loader.coordsMap[ch] || this.loader.coordsMap[ch?.toUpperCase?.()] || this.loader.coordsMap[ch?.toLowerCase?.()];

        if (ch === ' ') {
          layout.push({ type: 'space', srcW: spaceSrcWidth, srcH: fixedH });
        } else if (!g) {
          layout.push({ type: 'empty', srcW: avgSrcW, srcH: fixedH });
        } else {
          layout.push({ type: 'glyph', g: g, srcW: g.w, srcH: fixedH });
        }
      }

      let lineW = 0;
      for (const item of layout) lineW += item.srcW || 0;
      if (layout.length > 1) lineW += (layout.length - 1) * visualGap;

      lineLayouts.push({ layout, width: lineW, height: fixedH });
      maxLineW = Math.max(maxLineW, lineW);
      totalH += fixedH;
    }

    if (lineLayouts.length > 1) totalH += (lineLayouts.length - 1) * lineGap;

    this.lastRenderLayout = { lineLayouts, visualGap, lineGap };

    // 내부 해상도는 실제 픽셀 크기로 (최소 1x1)
    const canvasW = Math.max(1, maxLineW || 1);
    const canvasH = Math.max(1, totalH || fixedH);

    setCanvasSize(this.canvas, this.ctx, canvasW, canvasH);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.imageSmoothingEnabled = false;




    // CSS는 displayScale 적용 (정수 배율만 사용하여 픽셀 퍼펙트 유지)
    const displayW = canvasW * displayScale;
    const displayH = canvasH * displayScale;
    this.canvas.style.width = displayW + 'px';
    this.canvas.style.height = displayH + 'px';

    let yOffset = 0;
    for (let lineIdx = 0; lineIdx < lineLayouts.length; lineIdx++) {
      const lineInfo = lineLayouts[lineIdx];
      let x = 0;

      for (let idx = 0; idx < lineInfo.layout.length; idx++) {
        const item = lineInfo.layout[idx];
        if (item.type === 'glyph') {
          this.drawTintedGlyph(item.g, this.ctx, x, yOffset, color, fixedH);
          x += item.srcW || 0;
        } else {
          x += item.srcW || 0;
        }
        if (idx < lineInfo.layout.length - 1) x += visualGap;
      }

      yOffset += lineInfo.height;
      if (lineIdx < lineLayouts.length - 1) yOffset += lineGap;
    }

    // Force strict pixel colors using an intermediary offscreen buffer
    // This bypasses potential noisy state in the main canvas context
    const finalImg = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const finalD = finalImg.data;

    // 2. Prepare Fresh Clean Buffer
    // We create a new buffer to avoid any potential referencing issues with the original ImageData
    const cleanData = new Uint8ClampedArray(finalD.length);
    for (let i = 0; i < finalD.length; i += 4) {
      if (finalD[i + 3] > 0) {
        // Visible -> Force Pure Black (0, 0, 0, 255)
        cleanData[i] = 0;
        cleanData[i + 1] = 0;
        cleanData[i + 2] = 0;
        cleanData[i + 3] = 255;
      } else {
        // Transparent -> Force Clear (0, 0, 0, 0)
        cleanData[i] = 0; // R
        cleanData[i + 1] = 0; // G
        cleanData[i + 2] = 0; // B
        cleanData[i + 3] = 0; // A
      }
    }

    // 3. Render to Detached Canvas (Verification Layer)
    // We use a detached canvas to ensure no browser/DOM interference (extensions, etc.) affects the data.
    const verifyCanvas = document.createElement('canvas');
    verifyCanvas.width = this.canvas.width;
    verifyCanvas.height = this.canvas.height;
    // Attempting default context to avoid potential 'willReadFrequently' bugs on Linux
    const verifyCtx = verifyCanvas.getContext('2d');

    // PRE-CHECK: Verify cleanData array in memory BEFORE touching any Canvas API
    // This proves if our logic generated clean bytes.
    let preCheckFail = false;
    for (let i = 0; i < cleanData.length; i += 4) {
      if (cleanData[i + 3] === 0 && (cleanData[i] !== 0 || cleanData[i + 1] !== 0 || cleanData[i + 2] !== 0)) {
        console.error(`[Renderer] Logic Error! cleanData dirty at index ${i / 4}:`, [cleanData[i], cleanData[i + 1], cleanData[i + 2], cleanData[i + 3]]);
        preCheckFail = true;
        break;
      }
    }
    if (!preCheckFail) {
      console.log(`[Renderer] cleanData (in-memory buffer) is 100% CLEAN.`);
    }

    const newImageData = new ImageData(cleanData, this.canvas.width, this.canvas.height);
    verifyCtx.putImageData(newImageData, 0, 0);

    // 4. Verify Internal Data Integrity
    const internalImg = verifyCtx.getImageData(0, 0, verifyCanvas.width, verifyCanvas.height);
    const internalD = internalImg.data;
    let internalFailCount = 0;
    let internalFirstFail = null;
    let internalFirstFailXY = null;
    const width = verifyCanvas.width;

    for (let i = 0; i < internalD.length; i += 4) {
      const r = internalD[i];
      const g = internalD[i + 1];
      const b = internalD[i + 2];
      const a = internalD[i + 3];

      const isTransparentFail = (a === 0 && (r !== 0 || g !== 0 || b !== 0));
      const isVisibleFail = (a > 0 && (a !== 255 || r !== 0 || g !== 0 || b !== 0));

      if (isTransparentFail || isVisibleFail) {
        internalFailCount++;
        if (!internalFirstFail) {
          internalFirstFail = [r, g, b, a];
          const pxIdx = i / 4;
          internalFirstFailXY = { x: pxIdx % width, y: Math.floor(pxIdx / width) };
        }
      }
    }

    if (internalFailCount > 0) {
      console.error(`[Renderer] CRITICAL: Internal Data Generation Failed! ${internalFailCount} bad pixels. At (${internalFirstFailXY?.x}, ${internalFirstFailXY?.y}):`, internalFirstFail);
    } else {
      console.log(`[Renderer] Internal pixel data verified: 100% Clean.`);
    }

    // 5. Transfer to Visible Canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(verifyCanvas, 0, 0);

    // 6. Optional: Check Visible Canvas (Debug only)
    // If internal is clean but visible is dirty, it's a browser/extension issue.
    const visibleImg = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const visibleD = visibleImg.data;
    let visibleFailCount = 0;
    // We only count roughly to see if there's a difference
    for (let i = 0; i < visibleD.length; i += 4) {
      const a = visibleD[i + 3];
      const r = visibleD[i];
      const g = visibleD[i + 1];
      const b = visibleD[i + 2];
      const isFail = (a === 0 && (r || g || b)) || (a > 0 && (a !== 255 || r || g || b));
      if (isFail) visibleFailCount++;
    }

    if (visibleFailCount > 0 && internalFailCount === 0) {
      console.warn(`[Renderer] Visible canvas has ${visibleFailCount} artifacts, but internal data is CLEAN. Download will be correct.`);
    } else if (visibleFailCount === 0) {
      console.log(`[Renderer] Visible canvas matches internal data (Clean).`);
    }

    return { success: true, filename: sanitizeFilename(text) + '.png' };
  }

  getTransparentDataURL(threshold = 250, selectedColor = '#000000') {
    const selRgb = hexToRgb(selectedColor);
    const colorTolerance = 8;
    const closeToSelected = (r, g, b) =>
      Math.abs(r - selRgb.r) <= colorTolerance &&
      Math.abs(g - selRgb.g) <= colorTolerance &&
      Math.abs(b - selRgb.b) <= colorTolerance;

    if (!this.lastRenderLayout?.lineLayouts?.length) {
      return this.canvas.toDataURL('image/png');
    }

    const { lineLayouts, visualGap, lineGap } = this.lastRenderLayout;
    let maxW = 0, totalH = 0;

    for (const l of lineLayouts) {
      maxW = Math.max(maxW, l.width);
      totalH += l.height;
    }
    if (lineLayouts.length > 1) totalH += (lineLayouts.length - 1) * lineGap;
    if (maxW <= 0 || totalH <= 0) return this.canvas.toDataURL('image/png');

    const tmp = document.createElement('canvas');
    tmp.width = maxW;
    tmp.height = totalH;
    // Force CPU rendering here too
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.imageSmoothingEnabled = false;

    let yOffset = 0;
    for (let lineIdx = 0; lineIdx < lineLayouts.length; lineIdx++) {
      const lineInfo = lineLayouts[lineIdx];
      let x = 0;

      for (let idx = 0; idx < lineInfo.layout.length; idx++) {
        const item = lineInfo.layout[idx];
        if (item.type === 'glyph') {
          const g = item.g;
          const w = g.w;
          const h = lineInfo.height;

          this.tintOff.width = w;
          this.tintOff.height = h;
          this.tintOffCtx.clearRect(0, 0, w, h);
          this.tintOffCtx.drawImage(this.loader.spriteImg, g.sx, g.sy || 0, w, h, 0, 0, w, h);

          const img = this.tintOffCtx.getImageData(0, 0, w, h);
          const d = img.data;
          const rgb = hexToRgb(selectedColor);

          for (let pi = 0; pi < d.length; pi += 4) {
            if (d[pi + 3] === 0) continue;
            d[pi] = rgb.r;
            d[pi + 1] = rgb.g;
            d[pi + 2] = rgb.b;
          }

          this.tintOffCtx.putImageData(img, 0, 0);
          tctx.drawImage(this.tintOff, 0, 0, w, h, x, yOffset, w, h);
          x += w;
        } else {
          x += item.srcW || 0;
        }
        if (idx < lineInfo.layout.length - 1) x += visualGap;
      }

      yOffset += lineInfo.height;
      if (lineIdx < lineLayouts.length - 1) yOffset += lineGap;
    }

    const imgAll = tctx.getImageData(0, 0, tmp.width, tmp.height);
    const dAll = imgAll.data;

    // Final Pass: Ensure Strict Colors
    // 1. Any pixel with Alpha > 0 must be PURE BLACK (0,0,0,255)
    // 2. Any pixel with Alpha == 0 must be PURE TRANSPARENT (0,0,0,0)
    for (let i = 0; i < dAll.length; i += 4) {
      if (dAll[i + 3] > 0) {
        // Visible (even slightly) -> Force Pure Black
        dAll[i] = 0;
        dAll[i + 1] = 0;
        dAll[i + 2] = 0;
        dAll[i + 3] = 255;
      } else {
        // Transparent -> Force Clear
        dAll[i] = 0;
        dAll[i + 1] = 0;
        dAll[i + 2] = 0;
        dAll[i + 3] = 0;
      }
    }

    tctx.putImageData(imgAll, 0, 0);
    return tmp.toDataURL('image/png');
  }
}

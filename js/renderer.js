import { hexToRgb, setCanvasSize, sanitizeFilename } from './utils.js';

export class GlyphRenderer {
  constructor(canvas, loader) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.loader = loader;
    this.lastRenderLayout = null;

    this.tintOff = document.createElement('canvas');
    this.tintOffCtx = this.tintOff.getContext('2d');
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
      if (d[i + 3] === 0) continue;
      d[i] = rgb.r;
      d[i + 1] = rgb.g;
      d[i + 2] = rgb.b;
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
    const tctx = tmp.getContext('2d');
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

    for (let i = 0; i < dAll.length; i += 4) {
      // 1. Check alpha first. If it's effectively transparent, nuke it to 0,0,0,0
      if (dAll[i + 3] < 10) { // Threshold for "transparent enough"
        dAll[i] = 0;
        dAll[i + 1] = 0;
        dAll[i + 2] = 0;
        dAll[i + 3] = 0;
        continue;
      }

      // 2. If it's visible, FORCE the RGB to be exactly the selected color.
      // We ignore the original RGB values completely for visible pixels, 
      // as they should be the text color.
      dAll[i] = selRgb.r;
      dAll[i + 1] = selRgb.g;
      dAll[i + 2] = selRgb.b;
      // We preserve the alpha (dAll[i+3]) to keep anti-aliasing if it exists,
      // or we could force it to 255 if binary is desired. 
      // Assuming user wants to keep the shape (alpha), just fix the color.
    }

    tctx.putImageData(imgAll, 0, 0);
    return tmp.toDataURL('image/png');
  }
}
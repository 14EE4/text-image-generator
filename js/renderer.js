import { hexToRgb, setCanvasSize, sanitizeFilename } from './utils.js';
import { encodePNG } from './png_encoder.js';

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

    // CACHE CLEAN DATA
    this.cleanData = cleanData;

    // 3. Render to Detached Canvas (Verification Layer)
    // We use a detached canvas to ensure no browser/DOM interference.
    const verifyCanvas = document.createElement('canvas');
    verifyCanvas.width = this.canvas.width;
    verifyCanvas.height = this.canvas.height;
    // Driver bug prevention: Force CPU rendering + explicit SRGB
    const verifyCtx = verifyCanvas.getContext('2d', {
      willReadFrequently: true,
      colorSpace: 'srgb',
      alpha: true
    });
    verifyCtx.imageSmoothingEnabled = false;

    // "Vector Reconstruction"
    // We reconstruct the image using purely standard drawing commands (fillRect).
    verifyCtx.clearRect(0, 0, verifyCanvas.width, verifyCanvas.height);
    // Apply user selected color for display
    verifyCtx.fillStyle = color || '#000000';

    // Iterate and draw only black pixels
    for (let i = 0; i < cleanData.length; i += 4) {
      if (cleanData[i + 3] > 0) { // If visible (we know it's black from cleanData logic)
        const pIdx = i / 4;
        const x = pIdx % verifyCanvas.width;
        const y = Math.floor(pIdx / verifyCanvas.width);
        verifyCtx.fillRect(x, y, 1, 1);
      }
    }

    // 4. Transfer to Visible Canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(verifyCanvas, 0, 0);

    return { success: true, filename: sanitizeFilename(text) + '.png' };
  }

  getTransparentDataURL(threshold = 250, selectedColor = '#000000') {
    if (!this.cleanData || !this.lastRenderLayout) {
      console.warn('[Renderer] No clean data available for download.');
      return '';
    }

    const width = this.canvas.width;
    const height = this.canvas.height;

    // Check if we need to apply color
    // cleanData is guaranteed to be Pure Black (0,0,0,255) or Transparent (0,0,0,0)
    let finalData = this.cleanData;
    const normColor = selectedColor.toLowerCase();

    if (normColor !== '#000000' && normColor !== '#000') {
      const rgb = hexToRgb(selectedColor);
      // Create a copy to apply color
      finalData = new Uint8Array(this.cleanData.length);
      for (let i = 0; i < this.cleanData.length; i += 4) {
        const a = this.cleanData[i + 3];
        if (a > 0) {
          // Visible: Apply selected color
          finalData[i] = rgb.r;
          finalData[i + 1] = rgb.g;
          finalData[i + 2] = rgb.b;
          finalData[i + 3] = 255;
        } else {
          // Transparent: Keep as is (0,0,0,0)
          finalData[i] = 0;
          finalData[i + 1] = 0;
          finalData[i + 2] = 0;
          finalData[i + 3] = 0;
        }
      }
    }

    console.log(`[Renderer] Encoding PNG directly from clean buffer (Color: ${selectedColor})...`);
    const pngBytes = encodePNG(width, height, finalData);
    const blob = new Blob([pngBytes], { type: 'image/png' });
    const url = URL.createObjectURL(blob);

    return url;
  }
}

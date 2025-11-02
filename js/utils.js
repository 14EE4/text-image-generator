export function normalizeHex(v) {
  if (!v) return '#000000';
  v = v.trim();
  if (!v) return '#000000';
  if (v[0] !== '#') v = '#' + v;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  return '#000000';
}

export function hexToRgb(hex) {
  hex = normalizeHex(hex).slice(1);
  return { 
    r: parseInt(hex.slice(0,2), 16), 
    g: parseInt(hex.slice(2,4), 16), 
    b: parseInt(hex.slice(4,6), 16) 
  };
}

export function sanitizeFilename(text) {
  const rawName = (text || '').trim() || 'text-glyphs';
  return rawName.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-\.]/g, '').slice(0, 64) || 'text-glyphs';
}

export function setCanvasSize(canvas, ctx, w, h) {
  // DPR 사용하지 않고 1:1 픽셀 매칭
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
import { getFontsWithBasePath } from './js/fonts.js';
import { normalizeHex } from './js/utils.js';
import { FontLoader } from './js/loader.js';
import { GlyphRenderer } from './js/renderer.js';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
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

  // 상태 배너
  const status = document.createElement('div');
  status.id = 'statusBanner';
  status.style.cssText = 'font-family:monospace;margin:6px;padding:6px;border:1px solid #ddd;background:#f8f8f8;';
  if (canvas?.parentNode) canvas.parentNode.insertBefore(status, canvas);
  
  function setStatus(msg, isError = false) {
    status.textContent = msg;
    status.style.color = isError ? '#a00' : '#080';
    console.log('[STATUS]', msg);
  }

  // 초기화 (기본 경로 사용)
  const loader = new FontLoader(setStatus, './');
  const renderer = new GlyphRenderer(canvas, loader);

  // UI 초기값
  if (displayScaleInput && displayScaleVal) displayScaleVal.textContent = displayScaleInput.value;
  if (letterSpacingInput && letterSpacingVal) letterSpacingVal.textContent = letterSpacingInput.value;
  if (spaceWidthInput && spaceWidthVal) spaceWidthVal.textContent = spaceWidthInput.value;
  if (lineSpacingInput && lineSpacingVal) lineSpacingVal.textContent = lineSpacingInput.value;
  if (colorPicker && colorHex) {
    colorHex.value = normalizeHex(colorPicker.value || colorHex.value);
    colorPicker.value = normalizeHex(colorHex.value);
  }

  async function loadFont(fontKey) {
    const result = await loader.loadResources(fontKey);
    if (result.success && result.config) {
      if (spaceWidthInput && spaceWidthVal) {
        spaceWidthInput.value = result.config.defaultSpaceWidth;
        spaceWidthVal.textContent = result.config.defaultSpaceWidth;
      }
      if (displayScaleInput && displayScaleVal) {
        displayScaleInput.value = result.config.defaultDisplayScale;
        displayScaleVal.textContent = result.config.defaultDisplayScale;
      }
    }
    return result.success;
  }

  function triggerRender() {
    const text = input?.value || '';
    const options = {
      visualGap: parseInt(letterSpacingInput?.value || '1', 10),
      lineGap: parseInt(lineSpacingInput?.value || '1', 10),
      spaceSrcWidth: parseInt(spaceWidthInput?.value || '4', 10),
      displayScale: parseInt(displayScaleInput?.value || '2', 10),
      color: normalizeHex(colorHex?.value || colorPicker?.value || '#000000')
    };

    const result = renderer.render(text, options);
    
    if (result.success) {
      downloadLink.href = renderer.getTransparentDataURL(250, options.color);
      downloadLink.download = result.filename;
      downloadLink.style.display = 'inline';
      downloadLink.textContent = '이미지 다운로드';
      setStatus('렌더링 완료');
    } else {
      setStatus(result.error, true);
    }
  }

  // 이벤트 리스너
  fontSelect?.addEventListener('change', async () => {
    setStatus('폰트 로딩 중...');
    await loadFont(fontSelect.value);
    triggerRender();
  });

  letterSpacingInput?.addEventListener('input', () => {
    if (letterSpacingVal) letterSpacingVal.textContent = letterSpacingInput.value;
    triggerRender();
  });

  spaceWidthInput?.addEventListener('input', () => {
    if (spaceWidthVal) spaceWidthVal.textContent = spaceWidthInput.value;
    triggerRender();
  });

  lineSpacingInput?.addEventListener('input', () => {
    if (lineSpacingVal) lineSpacingVal.textContent = lineSpacingInput.value;
    triggerRender();
  });

  displayScaleInput?.addEventListener('input', () => {
    if (displayScaleVal) displayScaleVal.textContent = displayScaleInput.value;
    triggerRender();
  });

  colorPicker?.addEventListener('input', () => {
    if (colorHex) colorHex.value = normalizeHex(colorPicker.value);
    triggerRender();
  });

  colorHex?.addEventListener('input', () => {
    colorHex.value = normalizeHex(colorHex.value);
    try { if (colorPicker) colorPicker.value = colorHex.value; } catch(e) {}
    triggerRender();
  });

  btn?.addEventListener('click', triggerRender);
  
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      triggerRender();
    }
  });

  if (downloadLink) downloadLink.style.display = 'none';

  // 초기 로드
  loadFont(fontSelect?.value || 'english_old').then(() => {
    setStatus('준비 완료');
    triggerRender();
  });
});
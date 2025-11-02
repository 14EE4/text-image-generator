document.addEventListener('DOMContentLoaded', () => {
    console.log('script.js loaded');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const input = document.getElementById('textInput');
    const btn = document.getElementById('generateBtn');
    const downloadLink = document.getElementById('downloadLink');

    // controls (letter spacing visual, space width for export)
    const letterSpacingInput = document.getElementById('letterSpacing');
    const letterSpacingVal = document.getElementById('letterSpacingVal');
    const spaceWidthInput = document.getElementById('spaceWidth');
    const spaceWidthVal = document.getElementById('spaceWidthVal');
    // line spacing control
    const lineSpacingInput = document.getElementById('lineSpacing');
    const lineSpacingVal = document.getElementById('lineSpacingVal');
 
    // display scale control
    const displayScaleInput = document.getElementById('displayScale');
    const displayScaleVal = document.getElementById('displayScaleVal');
 
    // color controls (picker + hex input)
    const colorPicker = document.getElementById('colorPicker');
    const colorHex = document.getElementById('colorHex');

    // status banner
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
 
    // initialize UI displays
    if (displayScaleInput && displayScaleVal) displayScaleVal.textContent = displayScaleInput.value;
    if (letterSpacingInput && letterSpacingVal) letterSpacingVal.textContent = letterSpacingInput.value;
    if (spaceWidthInput && spaceWidthVal) spaceWidthVal.textContent = spaceWidthInput.value;
    if (lineSpacingInput && lineSpacingVal) lineSpacingVal.textContent = lineSpacingInput.value;
    if (colorPicker && colorHex) {
        colorHex.value = normalizeHex(colorPicker.value || colorHex.value);
        colorPicker.value = normalizeHex(colorHex.value);
    }

    // re-render helpers
    function triggerRender() {
        const t = input ? (input.value.trim() || '') : '';
        renderUsingGlyphs(t);
    }
    if (displayScaleInput) displayScaleInput.addEventListener('input', () => {
        if (displayScaleVal) displayScaleVal.textContent = displayScaleInput.value;
        triggerRender();
    });
    if (letterSpacingInput) letterSpacingInput.addEventListener('input', () => {
        if (letterSpacingVal) letterSpacingVal.textContent = letterSpacingInput.value;
        triggerRender();
    });
    if (spaceWidthInput) spaceWidthInput.addEventListener('input', () => {
        if (spaceWidthVal) spaceWidthVal.textContent = spaceWidthInput.value;
        triggerRender();
    });
    if (lineSpacingInput) lineSpacingInput.addEventListener('input', () => {
        if (lineSpacingVal) lineSpacingVal.textContent = lineSpacingInput.value;
        triggerRender();
    });
    if (colorPicker && colorHex) {
        colorPicker.addEventListener('input', () => {
            colorHex.value = normalizeHex(colorPicker.value);
            triggerRender();
        });
        colorHex.addEventListener('input', () => {
            colorHex.value = normalizeHex(colorHex.value);
            try { colorPicker.value = colorHex.value; } catch(e) {}
            triggerRender();
        });
    }

    // Enter to generate → Ctrl+Enter로 변경
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                triggerRender();
            }
            // 일반 Enter는 그냥 줄바꿈 (기본 동작 유지)
        });
    }

    // resources
    let coords = [];
    let coordsMap = {};
    const coordsPath = './coords.json';
    const spritePath = './english_old2.png';
    const spriteImg = new Image();

    async function loadResources() {
        setStatus('Loading coords.json...');
        try {
            const res = await fetch(coordsPath);
            if (!res.ok) throw new Error(`coords.json fetch failed: ${res.status}`);
            const payload = await res.json();
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
                setStatus(`sprite loaded: ${spritePath} (${spriteImg.naturalWidth}x${spriteImg.naturalHeight})`);
                resolve();
            };
            spriteImg.onerror = (ev) => {
                console.warn('sprite load error', ev);
                setStatus('sprite load failed', true);
                resolve();
            };
            spriteImg.src = spritePath;
        });
    }

    function setCanvasSize(w, h) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        // default CSS size equals logical pixels; caller may override style for display scaling
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // tint offscreen
    let lastRenderLayout = null;
    const tintOff = document.createElement('canvas');
    const tintOffCtx = tintOff.getContext('2d');

    function drawTintedGlyphToCtx(g, destCtx, dx, dy, colorHex) {
        tintOff.width = g.w; tintOff.height = g.h;
        tintOffCtx.clearRect(0,0,g.w,g.h);
        tintOffCtx.drawImage(spriteImg, g.sx, g.sy, g.w, g.h, 0, 0, g.w, g.h);
        const img = tintOffCtx.getImageData(0,0,g.w,g.h);
        const d = img.data;
        const rgb = hexToRgb(colorHex);
        for (let i = 0; i < d.length; i += 4) {
            if (d[i+3] === 0) continue;
            d[i] = rgb.r; d[i+1] = rgb.g; d[i+2] = rgb.b;
        }
        tintOffCtx.putImageData(img, 0, 0);
        destCtx.drawImage(tintOff, 0, 0, g.w, g.h, dx, dy, g.w, g.h);
    }

    function sanitizeFilename(text) {
        const rawName = (text || '').trim() || 'text-glyphs';
        return rawName.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_\-\.]/g, '').slice(0,64) || 'text-glyphs';
    }

    async function renderUsingGlyphs(text) {
        try {
            console.log('renderUsingGlyphs()', { text, coordsLen: coords.length, spriteLoaded: spriteImg.complete && spriteImg.naturalWidth > 0 });
            if (!coords || coords.length === 0 || !spriteImg.complete || spriteImg.naturalWidth === 0) {
                setStatus('Fallback: missing coords/sprite', true);
                setCanvasSize(600, 120);
                ctx.clearRect(0,0,600,120);
                ctx.fillStyle = '#000';
                ctx.font = '24px serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text || '', 300, 60);
                downloadLink.style.display = 'none';
                return;
            }

            // 줄 분리
            const lines = text.split('\n');
            const visualGapNow = (letterSpacingInput && !isNaN(Number(letterSpacingInput.value))) ? parseInt(letterSpacingInput.value,10) : 1;
            const lineGap = (lineSpacingInput && !isNaN(Number(lineSpacingInput.value))) ? parseInt(lineSpacingInput.value,10) : 2;

            // 각 줄의 레이아웃 생성
            const avgSrcW = Math.max(1, Math.round(coords.reduce((s,c)=>s + (c.w||0),0) / Math.max(1, coords.length)));
            const spaceSrcWidth = (spaceWidthInput && !isNaN(Number(spaceWidthInput.value))) ? parseInt(spaceWidthInput.value,10) : avgSrcW;
            const fixedH = 18; // coords.json meta.cellH 값 (모든 글자 높이 고정)
            
            const lineLayouts = [];
            let maxLineW = 0;
            let totalH = 0;

            for (const line of lines) {
                const layout = [];
                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    const g = coordsMap[ch] || coordsMap[ch.toUpperCase()] || coordsMap[ch.toLowerCase()];
                    if (ch === ' ') layout.push({ type: 'space', srcW: spaceSrcWidth, srcH: fixedH });
                    else if (!g) layout.push({ type: 'empty', srcW: avgSrcW, srcH: fixedH });
                    else layout.push({ type: 'glyph', g: g, srcW: g.w, srcH: fixedH });
                }

                let lineW = 0;
                let lineH = fixedH; // 모든 줄 높이를 18로 고정
                for (const item of layout) {
                    lineW += item.srcW || 0;
                }
                if (layout.length > 1) lineW += (layout.length - 1) * visualGapNow;

                lineLayouts.push({ layout, width: lineW, height: lineH });
                maxLineW = Math.max(maxLineW, lineW);
                totalH += lineH;
            }

            // 줄 간격 추가
            if (lineLayouts.length > 1) totalH += (lineLayouts.length - 1) * lineGap;

            lastRenderLayout = { lineLayouts, visualGap: visualGapNow, lineGap };

            // 캔버스 크기 설정
            const canvasW = Math.max(1, maxLineW);
            const canvasH = Math.max(1, totalH);
            setCanvasSize(canvasW, canvasH);
            ctx.clearRect(0, 0, canvasW, canvasH);
            ctx.imageSmoothingEnabled = false;

            const displayScale = (displayScaleInput && !isNaN(Number(displayScaleInput.value))) ? parseInt(displayScaleInput.value,10) : 1;
            canvas.style.width = Math.round(canvasW * displayScale) + 'px';
            canvas.style.height = Math.round(canvasH * displayScale) + 'px';

            // 각 줄 그리기
            const color = (colorHex && colorHex.value) ? normalizeHex(colorHex.value) : (colorPicker ? normalizeHex(colorPicker.value || '#000000') : '#000000');
            let yOffset = 0;

            for (let lineIdx = 0; lineIdx < lineLayouts.length; lineIdx++) {
                const lineInfo = lineLayouts[lineIdx];
                let x = 0;
                for (let idx = 0; idx < lineInfo.layout.length; idx++) {
                    const item = lineInfo.layout[idx];
                    if (item.type === 'glyph') {
                        drawTintedGlyphToCtx(item.g, ctx, x, yOffset, color);
                        x += item.srcW || 0;
                    } else {
                        x += item.srcW || 0;
                    }
                    if (idx < lineInfo.layout.length - 1) x += visualGapNow;
                }
                yOffset += lineInfo.height;
                // 마지막 줄이 아니면 줄 간격 추가
                if (lineIdx < lineLayouts.length - 1) yOffset += lineGap;
            }

            // 다운로드 링크 업데이트
            downloadLink.href = getTransparentDataURL(250);
            downloadLink.download = sanitizeFilename(text) + '.png';
            downloadLink.style.display = 'inline';
            downloadLink.textContent = '이미지 다운로드';
            setStatus('렌더링 완료 (여러 줄 지원)');
        } catch (err) {
            console.error('render error', err);
            setStatus('렌더 오류: 콘솔 확인', true);
        }
    }

    function getTransparentDataURL(threshold = 250) {
        const selHex = (colorHex && colorHex.value) ? normalizeHex(colorHex.value) : (colorPicker ? normalizeHex(colorPicker.value || '#000000') : null);
        const selRgb = selHex ? hexToRgb(selHex) : null;
        const colorTolerance = 8;

        function closeToSelected(r,g,b) {
            if (!selRgb) return false;
            return Math.abs(r - selRgb.r) <= colorTolerance &&
                   Math.abs(g - selRgb.g) <= colorTolerance &&
                   Math.abs(b - selRgb.b) <= colorTolerance;
        }

        if (lastRenderLayout && lastRenderLayout.lineLayouts && lastRenderLayout.lineLayouts.length) {
            const lineLayouts = lastRenderLayout.lineLayouts;
            const visualGap = lastRenderLayout.visualGap || 0;
            const lineGap = lastRenderLayout.lineGap || 2;

            let maxW = 0;
            let totalH = 0;
            for (const lineInfo of lineLayouts) {
                maxW = Math.max(maxW, lineInfo.width);
                totalH += lineInfo.height;
            }
            if (lineLayouts.length > 1) totalH += (lineLayouts.length - 1) * lineGap;

            if (maxW <= 0 || totalH <= 0) return canvas.toDataURL('image/png');

            const tmp = document.createElement('canvas');
            tmp.width = maxW;
            tmp.height = totalH;
            const tctx = tmp.getContext('2d');
            tctx.imageSmoothingEnabled = false;

            const color = selHex || '#000000';
            let yOffset = 0;

            for (let lineIdx = 0; lineIdx < lineLayouts.length; lineIdx++) {
                const lineInfo = lineLayouts[lineIdx];
                let x = 0;
                for (let idx = 0; idx < lineInfo.layout.length; idx++) {
                    const item = lineInfo.layout[idx];
                    if (item.type === 'glyph') {
                        const g = item.g;
                        tintOff.width = g.w; tintOff.height = g.h;
                        tintOffCtx.clearRect(0,0,g.w,g.h);
                        tintOffCtx.drawImage(spriteImg, g.sx, g.sy, g.w, g.h, 0, 0, g.w, g.h);
                        const img = tintOffCtx.getImageData(0,0,g.w,g.h);
                        const d = img.data;
                        const rgb = hexToRgb(color);
                        for (let pi = 0; pi < d.length; pi += 4) {
                            if (d[pi+3] === 0) continue;
                            d[pi] = rgb.r; d[pi+1] = rgb.g; d[pi+2] = rgb.b;
                        }
                        tintOffCtx.putImageData(img, 0, 0);
                        tctx.drawImage(tintOff, 0, 0, g.w, g.h, x, yOffset, g.w, g.h);
                        x += g.w;
                    } else {
                        x += item.srcW || 0;
                    }
                    if (idx < lineInfo.layout.length - 1) x += visualGap;
                }
                yOffset += lineInfo.height;
                if (lineIdx < lineLayouts.length - 1) yOffset += lineGap;
            }

            // 흰색→투명 변환 (선택 색상 제외)
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

        // Fallback
        try {
            const rect = canvas.getBoundingClientRect();
            const outW = Math.max(1, Math.round(rect.width));
            const outH = Math.max(1, Math.round(rect.height));
            const tmp = document.createElement('canvas');
            tmp.width = outW; tmp.height = outH;
            const tctx = tmp.getContext('2d');
            tctx.imageSmoothingEnabled = false;
            tctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, outW, outH);
            const img = tctx.getImageData(0,0,outW,outH);
            const d = img.data;
            for (let i = 0; i < d.length; i += 4) {
                const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
                if (a > 0 && r >= threshold && g >= threshold && b >= threshold) {
                    if (!closeToSelected(r,g,b)) d[i+3] = 0;
                }
            }
            tctx.putImageData(img,0,0);
            return tmp.toDataURL('image/png');
        } catch (e) {
            console.error('export fallback failed', e);
            return canvas.toDataURL('image/png');
        }
    }

    // wire up button
    if (btn) btn.addEventListener('click', () => {
        console.log('Generate button clicked');
        triggerRender();
    });

    // 초기 리소스 로드
    loadResources().then(() => {
        setStatus('대기 중...');
        // 기본 텍스트 렌더링
        if (input && input.value.trim()) triggerRender();
    });
});
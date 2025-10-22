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

    // display scale control
    const displayScaleInput = document.getElementById('displayScale');
    const displayScaleVal = document.getElementById('displayScaleVal');
    if (displayScaleInput && displayScaleVal) displayScaleVal.textContent = displayScaleInput.value;
    if (displayScaleInput) {
        displayScaleInput.addEventListener('input', () => {
            if (displayScaleVal) displayScaleVal.textContent = displayScaleInput.value;
            const t = input.value.trim() || 'Sample';
            renderUsingGlyphs(t);
        });
    }

    // color controls (picker + hex input)
    const colorPicker = document.getElementById('colorPicker');
    const colorHex = document.getElementById('colorHex');
    function normalizeHex(v) {
        if (!v) return '#000000';
        v = v.trim();
        if (!v) return '#000000';
        if (v[0] !== '#') v = '#' + v;
        if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
        return '#000000';
    }
    if (colorPicker && colorHex) {
        colorPicker.addEventListener('input', () => {
            colorHex.value = normalizeHex(colorPicker.value);
            renderUsingGlyphs(input.value.trim() || 'Sample');
        });
        colorHex.addEventListener('input', () => {
            const v = normalizeHex(colorHex.value);
            colorHex.value = v;
            try { colorPicker.value = v; } catch (e) {}
            renderUsingGlyphs(input.value.trim() || 'Sample');
        });
    }

    // initialize displays if elements exist
    if (letterSpacingInput && letterSpacingVal) letterSpacingVal.textContent = letterSpacingInput.value;
    if (spaceWidthInput && spaceWidthVal) spaceWidthVal.textContent = spaceWidthInput.value;

    // re-render when sliders change
    if (letterSpacingInput) {
        letterSpacingInput.addEventListener('input', () => {
            if (letterSpacingVal) letterSpacingVal.textContent = letterSpacingInput.value;
            const t = input.value.trim() || 'Sample';
            renderUsingGlyphs(t);
        });
    }
    if (spaceWidthInput) {
        spaceWidthInput.addEventListener('input', () => {
            if (spaceWidthVal) spaceWidthVal.textContent = spaceWidthInput.value;
            const t = input.value.trim() || 'Sample';
            renderUsingGlyphs(t);
        });
    }

    // status banner (visible on page)
    const status = document.createElement('div');
    status.id = 'statusBanner';
    status.style.cssText = 'font-family:monospace;margin:6px;padding:6px;border:1px solid #ddd;background:#f8f8f8;';
    document.body.insertBefore(status, document.getElementById('canvas'));

    function setStatus(msg, isError = false) {
        status.textContent = msg;
        status.style.color = isError ? '#a00' : '#080';
        console.log('[STATUS]', msg);
    }

    // resources (fixed: coords.json + english_old2.png)
    let coords = [];
    let coordsMap = {};
    const coordsPath = './coords.json';
    const spritePath = './english_old2.png';
    const spriteImg = new Image();

    async function loadResources() {
        setStatus('Loading coords.json...');
        try {
            const res = await fetch(coordsPath);
            if (!res.ok) throw new Error(`coords.json fetch failed: ${res.status} ${res.statusText}`);
            const payload = await res.json();
            coords = payload.coords || [];
            coordsMap = {};
            for (const c of coords) {
                if (c && c.char !== undefined) coordsMap[c.char] = c;
            }
            console.log('Loaded coords:', coords.length);
            setStatus(`coords.json loaded (${coords.length} entries)`);
        } catch (e) {
            console.error('coords.json load failed', e);
            setStatus(`coords.json load failed: ${e.message}`, true);
            coords = [];
            coordsMap = {};
        }

        return new Promise((resolve) => {
            spriteImg.onload = () => {
                console.log('sprite loaded:', spritePath, spriteImg.naturalWidth, 'x', spriteImg.naturalHeight);
                setStatus(`sprite loaded: ${spritePath} (${spriteImg.naturalWidth}x${spriteImg.naturalHeight})`);
                resolve();
            };
            spriteImg.onerror = (ev) => {
                console.warn('sprite image load error', spritePath, ev);
                setStatus(`sprite load failed: ${spritePath}`, true);
                resolve();
            };
            spriteImg.src = spritePath;
        });
    }

    function setCanvasSize(w, h) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        // default CSS size equals logical pixels; caller can override CSS size (display scale)
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // add near top of file-scoped variables
    let lastRenderLayout = null; // saved layout to export 1:1 pixels
    // temp offscreen canvas for tinting
    const tintOff = document.createElement('canvas');
    const tintOffCtx = tintOff.getContext('2d');

    function hexToRgb(hex) {
        hex = normalizeHex(hex).slice(1);
        return { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16) };
    }

    // draw tinted glyph onto destination context at (dx,dy) with 1:1 pixels
    function drawTintedGlyphToCtx(g, destCtx, dx, dy, colorHex) {
        tintOff.width = g.w;
        tintOff.height = g.h;
        tintOffCtx.clearRect(0,0,g.w,g.h);
        tintOffCtx.drawImage(spriteImg, g.sx, g.sy, g.w, g.h, 0, 0, g.w, g.h);
        const img = tintOffCtx.getImageData(0,0,g.w,g.h);
        const d = img.data;
        const rgb = hexToRgb(colorHex);
        for (let i = 0; i < d.length; i += 4) {
            // if pixel has alpha > 0, replace rgb but preserve alpha
            if (d[i+3] === 0) continue;
            d[i] = rgb.r;
            d[i+1] = rgb.g;
            d[i+2] = rgb.b;
        }
        tintOffCtx.putImageData(img, 0, 0);
        destCtx.drawImage(tintOff, 0, 0, g.w, g.h, dx, dy, g.w, g.h);
    }

    // visual gap (from slider) in source-pixel units
    const visualGap = (letterSpacingInput && !isNaN(Number(letterSpacingInput.value))) ? parseInt(letterSpacingInput.value, 10) : 1;

    async function renderUsingGlyphs(text) {
        try {
            console.log('renderUsingGlyphs()', { text, coordsLen: coords.length, spriteLoaded: spriteImg.complete && spriteImg.naturalWidth > 0 });
            if (!coords || coords.length === 0 || !spriteImg.complete || spriteImg.naturalWidth === 0) {
                setStatus('Fallback: drawing simple text (missing coords or sprite)', true);
                const w = 800, h = 200;
                setCanvasSize(w, h);
                ctx.clearRect(0,0,w,h);
                ctx.fillStyle = '#000';
                ctx.font = `${Math.floor(h*0.3)}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, w/2, h/2);
                downloadLink.style.display = 'none';
                return;
            }

            // Build layout info for export in source-pixel units (same as download)
            const avgSrcW = Math.max(1, Math.round(coords.reduce((s,c)=>s + (c.w||0),0) / Math.max(1, coords.length)));
            const spaceSrcWidth = (spaceWidthInput && !isNaN(Number(spaceWidthInput.value))) ? parseInt(spaceWidthInput.value, 10) : avgSrcW;
            const layout = [];
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                const g = coordsMap[ch] || coordsMap[ch.toUpperCase()] || coordsMap[ch.toLowerCase()];
                if (ch === ' ') {
                    layout.push({ type: 'space', srcW: spaceSrcWidth });
                } else if (!g) {
                    layout.push({ type: 'empty', srcW: avgSrcW });
                } else {
                    layout.push({ type: 'glyph', g: g, srcW: g.w, srcH: g.h });
                }
            }

            // store layout + visualGap so export uses exactly same spacing as screen
            lastRenderLayout = { layout: layout, visualGap: visualGap };

            // compute total source size including gaps between layout items
            let totalW = 0;
            let maxH = 0;
            for (const item of layout) {
                totalW += item.srcW || 0;
                if (item.srcH) maxH = Math.max(maxH, item.srcH);
            }
            if (layout.length > 1) totalW += (layout.length - 1) * visualGap;
            if (totalW <= 0) totalW = 1;
            if (maxH <= 0) maxH = 1;

            // set canvas to source-pixel dimensions (visible CSS size will match these pixels)
            setCanvasSize(totalW, maxH);
            ctx.clearRect(0, 0, totalW, maxH);
            ctx.imageSmoothingEnabled = false;

            // apply visual display scale (only affects CSS display size, not backing pixels/download)
            const displayScale = (displayScaleInput && !isNaN(Number(displayScaleInput.value))) ? parseInt(displayScaleInput.value, 10) : 1;
            canvas.style.width = Math.round(totalW * displayScale) + 'px';
            canvas.style.height = Math.round(maxH * displayScale) + 'px';

            // draw each item 1:1 and add visualGap between items
            let x = 0;
            for (let idx = 0; idx < layout.length; idx++) {
                const item = layout[idx];
                if (item.type === 'glyph') {
                    const g = item.g;
                    // tint with selected color when drawing to screen
                    const color = (colorHex && colorHex.value) ? normalizeHex(colorHex.value) : (colorPicker ? normalizeHex(colorPicker.value) : '#000000');
                    drawTintedGlyphToCtx(g, ctx, x, 0, color);
                    x += g.w;
                } else {
                    x += item.srcW || 0;
                }
                // add gap after item except last
                if (idx < layout.length - 1) x += visualGap;
            }

            // update download link from same layout (will match screen)
            downloadLink.href = getTransparentDataURL(250);
            // generate safe filename from rendered text
            const rawName = (text || '').trim() || 'text-glyphs';
            const safeName = rawName
                .replace(/\s+/g, '_')                // spaces -> _
                .replace(/[^A-Za-z0-9_\-\.]/g, '')   // remove unsafe chars
                .slice(0, 64) || 'text-glyphs';      // limit length
            downloadLink.download = safeName + '.png';
             downloadLink.style.display = 'inline';
             downloadLink.textContent = '이미지 다운로드';
             setStatus('Rendered (screen matches download) successfully');
        } catch (err) {
            console.error('render error', err);
            setStatus('Render error: see console', true);
        }
    }

    btn.addEventListener('click', () => {
        console.log('Generate button clicked');
        const t = input.value.trim() || 'Sample';
        renderUsingGlyphs(t);
    });

    // Enter 키로 바로 변환
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const t = input.value.trim() || 'Sample';
            renderUsingGlyphs(t);
        }
    });

    // initial load & render
    loadResources().then(() => {
        const t = input.value.trim() || 'Sample';
        renderUsingGlyphs(t);
    });

    function getTransparentDataURL(threshold = 250) {
        // If we have a saved source-pixel layout, compose a 1:1 image from sprite
        if (lastRenderLayout && lastRenderLayout.layout && lastRenderLayout.layout.length) {
            const layout = lastRenderLayout.layout;
            const visualGap = lastRenderLayout.visualGap || 0;
            // compute total source width and max height (including visual gaps)
            let totalW = 0;
            let maxH = 0;
            for (const item of layout) {
                totalW += item.srcW || 0;
                if
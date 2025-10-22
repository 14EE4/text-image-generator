document.addEventListener('DOMContentLoaded', () => {
    console.log('script.js loaded');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const input = document.getElementById('textInput');
    const btn = document.getElementById('generateBtn');
    const downloadLink = document.getElementById('downloadLink');

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
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // add near top of file-scoped variables
    let lastRenderLayout = null; // saved layout to export 1:1 pixels

    async function renderUsingGlyphs(text) {
        try {
            console.log('renderUsingGlyphs()', { text, coordsLen: coords.length, spriteLoaded: spriteImg.complete && spriteImg.naturalWidth > 0 });
            if (!coords || coords.length === 0 || !spriteImg.complete || spriteImg.naturalWidth === 0) {
                setStatus('Fallback: drawing simple text (missing coords or sprite)', true);
                const w = 800, h = 200;
                setCanvasSize(w, h);
                ctx.clearRect(0,0,w,h);
                ctx.fillStyle = '#fff';
                ctx.fillRect(0,0,w,h);
                ctx.fillStyle = '#000';
                ctx.font = `${Math.floor(h*0.3)}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, w/2, h/2);
                downloadLink.style.display = 'none';
                return;
            }

            const spacing = 4;
            const maxCanvasWidth = Math.min(1200, Math.max(600, Math.floor(window.innerWidth * 0.9)));
            const avgSrcH = Math.max(1, Math.round(coords.reduce((s,c)=>s + (c.h||0),0) / Math.max(1, coords.length)));
            // Build layout info for export in source-pixel units
            const avgSrcW = Math.max(1, Math.round(coords.reduce((s,c)=>s + (c.w||0),0) / Math.max(1, coords.length)));
            const spaceSrcWidth = Math.max(1, Math.round(avgSrcW * 0.35));
            const layout = [];
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                const g = coordsMap[ch] || coordsMap[ch.toUpperCase()] || coordsMap[ch.toLowerCase()];
                if (ch === ' ') {
                    layout.push({ type: 'space', srcW: spaceSrcWidth });
                } else if (!g) {
                    // unknown -> reserve avg width
                    layout.push({ type: 'empty', srcW: avgSrcW });
                } else {
                    layout.push({ type: 'glyph', g: g, srcW: g.w, srcH: g.h });
                }
            }
            // store for export
            lastRenderLayout = { layout: layout };

            const scales = [];
            const glyphWidths = [];
            // define desiredGlyphH (was missing) — target glyph height in CSS pixels
            const desiredGlyphH = Math.max(8, Math.floor(window.innerHeight * 0.12));
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                const g = coordsMap[ch] || coordsMap[ch.toUpperCase()] || coordsMap[ch.toLowerCase()];
                const srcH = g ? (g.h || avgSrcH) : avgSrcH;
                let s = Math.max(1, Math.floor(desiredGlyphH / srcH)); // integer scale
                scales.push(s);
                glyphWidths.push((g ? g.w : avgSrcW) * s);
            }

            let totalW = glyphWidths.reduce((a,b)=>a+b,0) + Math.max(0, text.length-1) * spacing + 20;
            if (totalW > maxCanvasWidth) {
                const factor = maxCanvasWidth / totalW;
                for (let i = 0; i < scales.length; i++) {
                    const newScale = Math.max(1, Math.floor(scales[i] * factor));
                    scales[i] = newScale;
                    const g = coordsMap[text[i]] || coordsMap[text[i].toUpperCase()] || coordsMap[text[i].toLowerCase()];
                    glyphWidths[i] = (g ? g.w : avgSrcW) * newScale;
                }
                totalW = glyphWidths.reduce((a,b)=>a+b,0) + Math.max(0, text.length-1) * spacing + 20;
            }

            const padding = 10;
            const canvasW = Math.max(200, Math.round(totalW));
            const maxGlyphH = Math.max(...glyphWidths.map((w,i)=> (coordsMap[text[i]] ? (coordsMap[text[i]].h||avgSrcH) * scales[i] : avgSrcH*scales[i])));
            const canvasH = Math.max(50, Math.round(maxGlyphH + padding * 2));
            setCanvasSize(canvasW, canvasH);
            ctx.clearRect(0,0,canvasW,canvasH);
            ctx.fillStyle = '#fff';
            ctx.fillRect(0,0,canvasW,canvasH);

            let x = Math.round((canvasW - (glyphWidths.reduce((a,b)=>a+b,0) + Math.max(0, text.length-1)*spacing)) / 2);
            const y = padding;

            // offscreen canvas for copying native glyph pixels
            const off = document.createElement('canvas');
            const offCtx = off.getContext('2d');

            // ensure nearest-neighbor when scaling
            offCtx.imageSmoothingEnabled = false;
            ctx.imageSmoothingEnabled = false;

            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                const g = coordsMap[ch] || coordsMap[ch.toUpperCase()] || coordsMap[ch.toLowerCase()];
                const scale = scales[i] || 1;

                // treat space as small gap (smaller than full glyph width)
                if (ch === ' ') {
                    // prefer a small fixed width or proportional small gap
                    const smallGap = Math.max(2, Math.floor((avgSrcW || avgSrcH) * scale * 0.35));
                    x += smallGap;
                    continue;
                }

                if (!g) {
                    // unknown char -> placeholder gap
                    ctx.fillStyle = '#ddd';
                    ctx.fillRect(x, y, Math.max(4, glyphWidths[i]), canvasH - padding*2);
                    x += glyphWidths[i] + spacing;
                    continue;
                }

                const sW = g.w, sH = g.h;
                off.width = sW;
                off.height = sH;
                offCtx.clearRect(0,0,sW,sH);
                offCtx.drawImage(spriteImg, g.sx, g.sy, sW, sH, 0, 0, sW, sH);

                // draw per-source-pixel as filled rects (preserve color; scale is integer)
                const imgData = offCtx.getImageData(0, 0, sW, sH).data;
                for (let py = 0; py < sH; py++) {
                    for (let px = 0; px < sW; px++) {
                        const idx = (py * sW + px) * 4;
                        const a = imgData[idx + 3];
                        if (a === 0) continue;
                        const r = imgData[idx], gcol = imgData[idx + 1], b = imgData[idx + 2];
                        const alpha = (a / 255);
                        ctx.fillStyle = `rgba(${r},${gcol},${b},${alpha})`;
                        const drawX = x + px * scale;
                        const drawY = y + py * scale;
                        ctx.fillRect(drawX, drawY, Math.max(1, scale), Math.max(1, scale));
                    }
                }

                x += sW * scale + spacing;
            }

            // restore smoothing default
            ctx.imageSmoothingEnabled = true;

            // after successful render, ensure download link uses export helper
            downloadLink.href = getTransparentDataURL(250); // will use lastRenderLayout if available
            downloadLink.download = 'text-glyphs.png';
            downloadLink.style.display = 'inline';
            downloadLink.textContent = '이미지 다운로드';
            setStatus('Rendered (original pixels) successfully');
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
            // compute total source width and max height
            let totalW = 0;
            let maxH = 0;
            for (const item of layout) {
                totalW += item.srcW || 0;
                if (item.srcH) maxH = Math.max(maxH, item.srcH);
            }
            if (totalW <= 0 || maxH <= 0) {
                // fallback to default canvas export
                console.warn('invalid lastRenderLayout, falling back to canvas export');
            } else {
                const tmp = document.createElement('canvas');
                tmp.width = totalW;
                tmp.height = maxH;
                const tctx = tmp.getContext('2d');
                tctx.imageSmoothingEnabled = false;

                let x = 0;
                for (const item of layout) {
                    if (item.type === 'glyph') {
                        const g = item.g;
                        // draw source pixels 1:1
                        tctx.drawImage(spriteImg, g.sx, g.sy, g.w, g.h, x, 0, g.w, g.h);
                        x += g.w;
                    } else {
                        // space/empty: leave transparent area of srcW
                        x += item.srcW || 0;
                    }
                }

                // convert near-white to transparent
                const img = tctx.getImageData(0, 0, tmp.width, tmp.height);
                const d = img.data;
                for (let i = 0; i < d.length; i += 4) {
                    const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
                    if (a > 0 && r >= threshold && g >= threshold && b >= threshold) {
                        d[i+3] = 0;
                    }
                }
                tctx.putImageData(img, 0, 0);
                return tmp.toDataURL('image/png');
            }
        }

        // Fallback: downscale visible canvas to logical pixels (account for DPR)
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(canvas.width / dpr);
        const h = Math.round(canvas.height / dpr);
        const tmp = document.createElement('canvas');
        tmp.width = w;
        tmp.height = h;
        const tctx = tmp.getContext('2d');
        tctx.imageSmoothingEnabled = false;
        // draw scaled down so each CSS pixel becomes 1 image pixel
        tctx.drawImage(canvas, 0, 0, w, h);
        const img = tctx.getImageData(0, 0, w, h);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
            if (a > 0 && r >= threshold && g >= threshold && b >= threshold) d[i+3] = 0;
        }
        tctx.putImageData(img, 0, 0);
        return tmp.toDataURL('image/png');
    }
});
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

            // Use original glyph pixel grid to draw dots.
            // srcW/srcH come from each coord (glyph native size)
            const spacing = 4;
            // choose uniform pixel scale to keep dots visible; prefer integer scaling
            // compute a target glyph height (visual) but then convert to integer pixel scale per glyph
            const maxCanvasWidth = Math.min(1200, Math.max(600, Math.floor(window.innerWidth * 0.9)));
            // compute tentative scale based on average glyph height
            const avgSrcH = Math.max(1, Math.round(coords.reduce((s,c)=>s + (c.h||0),0) / Math.max(1, coords.length)));
            let desiredGlyphH = Math.max(8, Math.floor(window.innerHeight * 0.12)); // visual target
            // will adjust per-glyph to integer scale
            // Precompute glyph widths after integer scaling to compute total width
            const scales = [];
            const glyphWidths = [];
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                const g = coordsMap[ch] || coordsMap[ch.toUpperCase()] || coordsMap[ch.toLowerCase()];
                const srcH = g ? (g.h || avgSrcH) : avgSrcH;
                let s = Math.max(1, Math.floor(desiredGlyphH / srcH)); // integer scale
                // if single glyph would be too wide, reduce scale
                const wAfter = (g ? g.w : avgSrcH) * s;
                scales.push(s);
                glyphWidths.push(wAfter);
            }
            let totalW = glyphWidths.reduce((a,b)=>a+b,0) + Math.max(0, text.length-1) * spacing + 20;
            // if exceed maxCanvasWidth, reduce all scales proportionally (keeping integer)
            if (totalW > maxCanvasWidth) {
                const factor = maxCanvasWidth / totalW;
                for (let i = 0; i < scales.length; i++) {
                    const newScale = Math.max(1, Math.floor(scales[i] * factor));
                    scales[i] = newScale;
                    const g = coordsMap[text[i]] || coordsMap[text[i].toUpperCase()] || coordsMap[text[i].toLowerCase()];
                    glyphWidths[i] = (g ? g.w : avgSrcH) * newScale;
                }
                totalW = glyphWidths.reduce((a,b)=>a+b,0) + Math.max(0, text.length-1) * spacing + 20;
            }

            const padding = 10;
            const canvasW = Math.max(200, Math.round(totalW));
            const canvasH = Math.max(50, Math.round(Math.max(...glyphWidths.map((w,i)=> (coordsMap[text[i]] ? (coordsMap[text[i]].h||avgSrcH) * scales[i] : avgSrcH*scales[i]))) + padding * 2));
            setCanvasSize(canvasW, canvasH);
            ctx.clearRect(0,0,canvasW,canvasH);
            ctx.fillStyle = '#fff';
            ctx.fillRect(0,0,canvasW,canvasH);

            let x = Math.round((canvasW - (glyphWidths.reduce((a,b)=>a+b,0) + Math.max(0, text.length-1)*spacing)) / 2);
            const yTop = Math.round((canvasH - (canvasH - padding*2)) / 2); // baseline top padding not critical

            // offscreen canvas reused per glyph
            const off = document.createElement('canvas');
            const offCtx = off.getContext('2d');

            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                const g = coordsMap[ch] || coordsMap[ch.toUpperCase()] || coordsMap[ch.toLowerCase()];
                const scale = scales[i] || 1;
                if (!g) {
                    ctx.fillStyle = '#ddd';
                    ctx.fillRect(x, padding, Math.max(4,glyphWidths[i]), canvasH - padding*2);
                    x += glyphWidths[i] + spacing;
                    continue;
                }

                const sW = g.w, sH = g.h;
                off.width = sW;
                off.height = sH;
                offCtx.clearRect(0,0,sW,sH);
                offCtx.drawImage(spriteImg, g.sx, g.sy, sW, sH, 0, 0, sW, sH);
                const img = offCtx.getImageData(0,0,sW,sH).data;

                // draw a dot per source pixel (circle), positioned and scaled by integer 'scale'
                const pixelSize = scale;
                const radius = Math.max(0.2, pixelSize * 0.45);
                for (let py = 0; py < sH; py++) {
                    for (let px = 0; px < sW; px++) {
                        const idx = (py * sW + px) * 4;
                        const a = img[idx + 3];
                        if (a > 50) {
                            const r = img[idx], gcol = img[idx + 1], b = img[idx + 2];
                            ctx.fillStyle = `rgb(${r},${gcol},${b})`;
                            const cx = x + px * pixelSize + pixelSize / 2;
                            const cy = padding + py * pixelSize + pixelSize / 2;
                            ctx.beginPath();
                            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }

                x += sW * pixelSize + spacing;
            }

            downloadLink.href = canvas.toDataURL('image/png');
            downloadLink.download = 'text-glyphs-dot.png';
            downloadLink.style.display = 'inline';
            downloadLink.textContent = '이미지 다운로드';
            setStatus('Rendered (original dots) successfully');
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

    // initial load & render
    loadResources().then(() => {
        const t = input.value.trim() || 'Sample';
        renderUsingGlyphs(t);
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const input = document.getElementById('textInput');
    const btn = document.getElementById('generateBtn');
    const downloadLink = document.getElementById('downloadLink');
    const widthInput = document.getElementById('canvasWidth');
    const heightInput = document.getElementById('canvasHeight');
    const dotSizeInput = document.getElementById('dotSize');
    const dotSizeVal = document.getElementById('dotSizeVal');

    dotSizeInput.addEventListener('input', () => dotSizeVal.textContent = dotSizeInput.value);

    // load coords.json and sprite image
    let coords = [];
    let coordsMap = {};
    let spriteImg = new Image();
    const coordsPath = './coords.json';
    const spritePath = './english_old2.png';

    async function loadResources() {
        try {
            const res = await fetch(coordsPath);
            if (!res.ok) throw new Error('coords.json not found');
            const payload = await res.json();
            coords = payload.coords || [];
            coordsMap = {};
            for (const c of coords) coordsMap[c.char] = c;
            console.log('Loaded coords:', coords.length);
        } catch (e) {
            console.warn('coords.json load failed:', e.message);
            coords = [];
            coordsMap = {};
        }

        return new Promise((resolve) => {
            spriteImg.onload = () => resolve();
            spriteImg.onerror = () => {
                console.warn('sprite image not loaded:', spritePath);
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

    // render using glyph bitmaps (with optional dotization)
    function renderUsingGlyphs(text, dotSize = 0) {
        const w = Math.max(50, parseInt(widthInput.value, 10) || 800);
        const h = Math.max(50, parseInt(heightInput.value, 10) || 200);
        setCanvasSize(w, h);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);

        if (!coords || coords.length === 0 || !spriteImg.complete) {
            ctx.fillStyle = '#000';
            ctx.font = `${Math.floor(h*0.6)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, w/2, h/2);
            return;
        }

        // decide glyph target size (height = 60% canvas height)
        const glyphTargetH = Math.floor(h * 0.6);
        // use first coord height as source glyph height if available
        const srcH = coords[0] && coords[0].h ? coords[0].h : glyphTargetH;
        const scale = glyphTargetH / srcH;
        const glyphTargetW = Math.round((coords[0] && coords[0].w ? coords[0].w : glyphTargetH) * scale);

        // total width for fixed-width layout
        const spacing = 4;
        const totalW = text.length * glyphTargetW + Math.max(0, text.length - 1) * spacing;
        let x = Math.round((w - totalW) / 2);
        const y = Math.round((h - glyphTargetH) / 2);

        // offscreen canvas for sampling glyph pixels when dotSize > 0
        const off = document.createElement('canvas');
        off.width = Math.round(glyphTargetW);
        off.height = Math.round(glyphTargetH);
        const offCtx = off.getContext('2d');

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const g = coordsMap[ch] || coordsMap[ch.toUpperCase()] || coordsMap[ch.toLowerCase()];
            if (!g) {
                // placeholder box
                ctx.fillStyle = '#ddd';
                ctx.fillRect(x, y, glyphTargetW, glyphTargetH);
                x += glyphTargetW + spacing;
                continue;
            }

            if (dotSize > 1) {
                // draw glyph from sprite into offscreen at target size, then dotize
                off.width = glyphTargetW;
                off.height = glyphTargetH;
                offCtx.clearRect(0,0,off.width,off.height);
                try {
                    offCtx.drawImage(
                        spriteImg,
                        g.sx, g.sy, g.w, g.h,
                        0, 0, off.width, off.height
                    );
                    const imgData = offCtx.getImageData(0,0,off.width,off.height).data;
                    const radius = Math.max(0.5, dotSize/2*0.9);
                    for (let yy = 0; yy < off.height; yy += dotSize) {
                        for (let xx = 0; xx < off.width; xx += dotSize) {
                            const sx = Math.min(off.width-1, xx + Math.floor(dotSize/2));
                            const sy = Math.min(off.height-1, yy + Math.floor(dotSize/2));
                            const idx = (sy * off.width + sx) * 4;
                            const alpha = imgData[idx+3];
                            if (alpha > 50) {
                                const r = imgData[idx], gcol = imgData[idx+1], b = imgData[idx+2];
                                ctx.fillStyle = `rgb(${r},${gcol},${b})`;
                                ctx.beginPath();
                                ctx.arc(x + xx + dotSize/2, y + yy + dotSize/2, radius, 0, Math.PI*2);
                                ctx.fill();
                            }
                        }
                    }
                } catch (e) {
                    // fallback draw image normally
                    ctx.drawImage(spriteImg, g.sx, g.sy, g.w, g.h, x, y, glyphTargetW, glyphTargetH);
                }
            } else {
                ctx.drawImage(spriteImg, g.sx, g.sy, g.w, g.h, x, y, glyphTargetW, glyphTargetH);
            }
            x += glyphTargetW + spacing;
        }

        downloadLink.href = canvas.toDataURL('image/png');
        downloadLink.download = 'text-glyphs.png';
        downloadLink.style.display = 'inline';
        downloadLink.textContent = '이미지 다운로드';
    }

    btn.addEventListener('click', () => {
        const t = input.value.trim() || 'Sample';
        const dot = parseInt(dotSizeInput.value, 10) || 0;
        renderUsingGlyphs(t, dot);
    });

    // initial load
    loadResources().then(() => {
        const t = input.value.trim() || 'Sample';
        renderUsingGlyphs(t, parseInt(dotSizeInput.value,10) || 0);
    });
});
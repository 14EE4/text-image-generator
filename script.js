document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const input = document.getElementById('textInput');
    const btn = document.getElementById('generateBtn');
    const downloadLink = document.getElementById('downloadLink');

    // resources (fixed: coords.json + english_old2.png)
    let coords = [];
    let coordsMap = {};
    const coordsPath = './coords.json';
    const spritePath = './english_old2.png';
    const spriteImg = new Image();

    async function loadResources() {
        // load coords.json
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

        // load sprite image
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

    // render text using sprite glyphs (no user size inputs)
    function renderUsingGlyphs(text) {
        if (!coords || coords.length === 0 || !spriteImg.complete) {
            // fallback: simple text
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

        // use first coord as base glyph size
        const srcW = coords[0].w || 16;
        const srcH = coords[0].h || 16;
        const spacing = 4;

        // desired maximum canvas width
        const maxCanvasWidth = Math.min(1200, Math.max(600, Math.floor(window.innerWidth * 0.9)));
        // compute scale so text fits within maxCanvasWidth
        // initial scale = 2
        let scale = 2;
        let glyphW = Math.round(srcW * scale);
        let glyphH = Math.round(srcH * scale);
        let totalW = text.length * glyphW + Math.max(0, text.length - 1) * spacing + 20; // padding 20

        if (totalW > maxCanvasWidth) {
            // recompute scale to fit
            const avail = maxCanvasWidth - 20 - Math.max(0, text.length - 1) * spacing;
            scale = Math.max(1, avail / (text.length * srcW));
            glyphW = Math.max(1, Math.round(srcW * scale));
            glyphH = Math.max(1, Math.round(srcH * scale));
            totalW = text.length * glyphW + Math.max(0, text.length - 1) * spacing + 20;
        }

        const padding = 10;
        const canvasW = totalW;
        const canvasH = glyphH + padding * 2;

        setCanvasSize(canvasW, canvasH);
        ctx.clearRect(0,0,canvasW,canvasH);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0,0,canvasW,canvasH);

        let x = Math.round((canvasW - (text.length * glyphW + Math.max(0, text.length - 1) * spacing)) / 2);
        const y = Math.round((canvasH - glyphH) / 2);

        // draw each glyph from sprite (no dotizing)
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const g = coordsMap[ch] || coordsMap[ch.toUpperCase()] || coordsMap[ch.toLowerCase()];
            if (!g) {
                // placeholder for missing glyph
                ctx.fillStyle = '#ddd';
                ctx.fillRect(x, y, glyphW, glyphH);
                x += glyphW + spacing;
                continue;
            }
            try {
                ctx.drawImage(
                    spriteImg,
                    g.sx, g.sy, g.w, g.h,
                    x, y, glyphW, glyphH
                );
            } catch (e) {
                // if drawImage fails, draw placeholder
                ctx.fillStyle = '#ddd';
                ctx.fillRect(x, y, glyphW, glyphH);
            }
            x += glyphW + spacing;
        }

        downloadLink.href = canvas.toDataURL('image/png');
        downloadLink.download = 'text-glyphs.png';
        downloadLink.style.display = 'inline';
        downloadLink.textContent = '이미지 다운로드';
    }

    btn.addEventListener('click', () => {
        const t = input.value.trim() || 'Sample';
        renderUsingGlyphs(t);
    });

    // initial load & render
    loadResources().then(() => {
        const t = input.value.trim() || 'Sample';
        renderUsingGlyphs(t);
    });
});
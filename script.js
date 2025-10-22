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

    function renderUsingGlyphs(text) {
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

            const srcW = coords[0].w || 16;
            const srcH = coords[0].h || 16;
            const spacing = 4;
            const maxCanvasWidth = Math.min(1200, Math.max(600, Math.floor(window.innerWidth * 0.9)));
            let scale = 2;
            let glyphW = Math.round(srcW * scale);
            let glyphH = Math.round(srcH * scale);
            let totalW = text.length * glyphW + Math.max(0, text.length - 1) * spacing + 20;
            if (totalW > maxCanvasWidth) {
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

            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                const g = coordsMap[ch] || coordsMap[ch.toUpperCase()] || coordsMap[ch.toLowerCase()];
                if (!g) {
                    ctx.fillStyle = '#ddd';
                    ctx.fillRect(x, y, glyphW, glyphH);
                    x += glyphW + spacing;
                    continue;
                }
                ctx.drawImage(spriteImg, g.sx, g.sy, g.w, g.h, x, y, glyphW, glyphH);
                x += glyphW + spacing;
            }

            downloadLink.href = canvas.toDataURL('image/png');
            downloadLink.download = 'text-glyphs.png';
            downloadLink.style.display = 'inline';
            downloadLink.textContent = '이미지 다운로드';
            setStatus('Rendered successfully');
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
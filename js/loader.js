import { getFontsWithBasePath } from './fonts.js';

export class FontLoader {
  constructor(statusCallback, basePath = './') {
    this.meta = { cellH: 18 };
    this.coords = [];
    this.coordsMap = {};
    this.spriteImg = new Image();
    this.setStatus = statusCallback;
    this.basePath = basePath;
    this.FONTS = getFontsWithBasePath(basePath);
  }

  async loadResources(fontKey) {
    const fontConfig = this.FONTS[fontKey];
    if (!fontConfig) {
      this.setStatus('알 수 없는 폰트', true);
      return { success: false };
    }

    try {
      const res = await fetch(fontConfig.coords);
      if (!res.ok) throw new Error(`coords fetch failed: ${res.status}`);
      const payload = await res.json();
      
      this.meta = payload.meta || { cellH: fontConfig.cellH };
      this.meta.cellH = fontConfig.cellH;
      this.coords = payload.coords || [];
      this.coordsMap = {};
      
      for (const c of this.coords) {
        if (c && c.char !== undefined) this.coordsMap[c.char] = c;
      }
      
      this.setStatus(`${fontKey} coords loaded (${this.coords.length})`);
    } catch (e) {
      console.error(e);
      this.setStatus(`${fontKey} coords load failed: ${e.message}`, true);
      this.coords = [];
      this.coordsMap = {};
      return { success: false };
    }

    return new Promise((resolve) => {
      this.spriteImg.onload = () => {
        this.setStatus(`${fontKey} sprite loaded: ${this.spriteImg.naturalWidth}x${this.spriteImg.naturalHeight}`);
        resolve({ success: true, config: fontConfig });
      };
      this.spriteImg.onerror = () => {
        this.setStatus(`${fontKey} sprite load failed`, true);
        resolve({ success: false });
      };
      this.spriteImg.src = fontConfig.sprite;
    });
  }
}
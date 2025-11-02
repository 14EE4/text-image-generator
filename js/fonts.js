export const FONTS = {
  english_old: {
    coords: './sprite_fonts/english_old/coords.json',
    sprite: './sprite_fonts/english_old/english_old.png',
    cellH: 18,
    defaultSpaceWidth: 4,
    defaultDisplayScale: 2
  },
  smallest_font: {
    coords: './sprite_fonts/smallest_font/smallest_coords.json',
    sprite: './sprite_fonts/smallest_font/smallest-font.png',
    cellH: 5,
    defaultSpaceWidth: 2,
    defaultDisplayScale: 6
  }
};

// 현재 경로에 따라 상대 경로 조정
export function getFontsWithBasePath(basePath = './') {
  const adjustedFonts = {};
  for (const [key, config] of Object.entries(FONTS)) {
    adjustedFonts[key] = {
      ...config,
      coords: basePath + config.coords,
      sprite: basePath + config.sprite
    };
  }
  return adjustedFonts;
}
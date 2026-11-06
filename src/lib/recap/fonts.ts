/**
 * Brand typography for the Recap video (brand book):
 *  - Plus Jakarta Sans — display: headlines, big numbers (Regular / Semibold / ExtraBold)
 *  - Switzer — body text and the "Anacan" wordmark (Regular / Medium / Bold)
 *  - Inter — small UI labels: pills, chips, captions
 * Files ship in public/recap/fonts (Inter comes with the app's stylesheet). Scripts these fonts do not cover
 * (Cyrillic for Jakarta/Switzer, Arabic, CJK, Georgian, Devanagari) fall back per glyph to Noto Sans /
 * Noto Naskh Arabic (public/fonts) and then to the system fonts.
 */

export interface RecapFontFace { family: string; url: string; weight: string; unicodeRange?: string }

const JAKARTA_RANGES = {
  'cyrillic-ext': 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F',
  vietnamese: 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
  'latin-ext': 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
  latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
} as const;

/** Faces the recap registers with FontFace (paths are relative to the app root). */
export const RECAP_FONT_FACES: RecapFontFace[] = [
  ...(Object.keys(JAKARTA_RANGES) as Array<keyof typeof JAKARTA_RANGES>).map((subset) => ({
    family: 'Plus Jakarta Sans', url: `/recap/fonts/jakarta-normal-${subset}.woff2`, weight: '200 800', unicodeRange: JAKARTA_RANGES[subset],
  })),
  { family: 'Switzer', url: '/recap/fonts/switzer-400.woff2', weight: '400' },
  { family: 'Switzer', url: '/recap/fonts/switzer-500.woff2', weight: '500' },
  { family: 'Switzer', url: '/recap/fonts/switzer-700.woff2', weight: '700' },
  { family: 'Recap Noto Sans', url: '/fonts/NotoSans-Regular.ttf', weight: '400' },
  { family: 'Recap Noto Sans', url: '/fonts/NotoSans-Bold.ttf', weight: '700' },
  { family: 'Recap Noto Naskh Arabic', url: '/fonts/NotoNaskhArabic-Regular.ttf', weight: '400' },
  { family: 'Recap Noto Naskh Arabic', url: '/fonts/NotoNaskhArabic-Bold.ttf', weight: '700' },
];

const FALLBACK = '"Recap Noto Sans", "Noto Sans", "Noto Sans Arabic", "Recap Noto Naskh Arabic", system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans", "Apple SD Gothic Neo", sans-serif';

export interface RecapFonts { display: string; body: string; ui: string }

export const RECAP_FONTS: RecapFonts = {
  display: `"Plus Jakarta Sans", ${FALLBACK}`,
  body: `"Switzer", ${FALLBACK}`,
  ui: `"Inter", ${FALLBACK}`,
};

/** CSS `font` shorthands to load before the first frame (each family at the weights the video uses). */
export const RECAP_FONT_PROBES = [
  '400 64px "Plus Jakarta Sans"', '600 64px "Plus Jakarta Sans"', '800 64px "Plus Jakarta Sans"',
  '400 64px Switzer', '500 64px Switzer', '700 64px Switzer',
  '500 40px Inter', '600 40px Inter', '700 40px Inter',
];

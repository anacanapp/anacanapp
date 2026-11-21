// Tools hub tile text per language (sync, tiny). Kept in step with each <lang>.json ui.tileName / ui.tileDesc
// (checked by src/data/kid-exercises/kid-exercises-i18n.test.ts).
export const KIDEX_TILE_TEXT: Record<string, { name: string; description: string }> = {
  az: { name: 'Uşaq məşqləri', description: '0–5 yaş üçün şəkilli hərəkət məşqləri' },
};

/** App languages with Uşaq məşqləri content (same keys as KIDEX_LANGUAGE_LOADERS in ./index.ts; checked by the test). */
export const KIDEX_CONTENT_LANGUAGES = ['az'];

export const hasKidExContent = (language: string | null | undefined): boolean => KIDEX_CONTENT_LANGUAGES.includes(String(language || ''));

/** Sync tile name/description for the Tools hub (no content loaded). */
export const kidExTileText = (language: string): { name: string; description: string } =>
  KIDEX_TILE_TEXT[language] ?? KIDEX_TILE_TEXT.en ?? KIDEX_TILE_TEXT.az;

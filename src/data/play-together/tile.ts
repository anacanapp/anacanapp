// Tools hub tile text per language (sync, tiny). Kept in step with each <lang>.ts ui.tileName / ui.tileDesc
// (checked by src/lib/play-together.test.ts).
export const PLAY_TILE_TEXT: Record<string, { name: string; description: string }> = {
  az: { name: 'Uşaqla oyun', description: 'Ekransız oyunlar və kitablar' },
  en: { name: "Play together", description: "Screen-free games with your child" },
  ru: { name: "Играем вместе", description: "Игры с ребёнком без экрана" },
  tr: { name: "Çocukla oyun", description: "Çocukla ekransız oyunlar" },
  kk: { name: "Баламен ойын", description: "Баламен экрансыз ойындар" },
  de: { name: "Spielen mit dem Kind", description: "Spiele ohne Bildschirm" },
  ar: { name: "اللعب مع الطفل", description: "ألعاب مع طفلكِ بلا شاشات" },
  uz: { name: "Bola bilan oʻyin", description: "Bola bilan ekransiz oʻyinlar" },
  ka: { name: "თამაში ბავშვთან", description: "თამაშები ეკრანის გარეშე" },
  zh: { name: "亲子游戏", description: "无屏幕亲子游戏" },
  id: { name: "Main bersama anak", description: "Permainan tanpa layar bersama anak" },
  fr: { name: "Jouer ensemble", description: "Jeux sans écran avec votre enfant" },
  es: { name: "Jugar juntos", description: "Juegos sin pantallas con tu hijo" },
  pt: { name: "Brincar juntos", description: "Brincadeiras sem tela com seu filho" },
  vi: { name: "Chơi cùng con", description: "Trò chơi không màn hình cùng con" },
  hi: { name: "बच्चे के साथ खेल", description: "बच्चे के साथ स्क्रीन-मुक्त खेल" },
  ja: { name: "親子あそび", description: "画面を使わない親子あそび" },
  ko: { name: "아이와 놀이", description: "아이와 함께하는 화면 없는 놀이" },
  pl: { name: "Zabawy z dzieckiem", description: "Zabawy bez ekranu z dzieckiem" },
  nl: { name: "Samen spelen", description: "Spelletjes zonder scherm" },
  sv: { name: "Lek tillsammans", description: "Lekar utan skärm" },
  ky: { name: "Бала менен оюн", description: "Бала менен экрансыз оюндар" },
  et: { name: "Mängime koos", description: "Ekraanivabad mängud lapsega" },
};

/** App languages with Uşaqla oyun content (same keys as PLAY_LANGUAGE_LOADERS in ./index.ts; checked by the test). */
export const PLAY_CONTENT_LANGUAGES = ['az', 'en', 'ru', 'tr', 'kk', 'de', 'ar', 'uz', 'ka', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et'];

export const hasPlayContent = (language: string | null | undefined): boolean => PLAY_CONTENT_LANGUAGES.includes(String(language || ''));

/** Sync tile name/description for the Tools hub (no content loaded). */
export const playTileText = (language: string): { name: string; description: string } =>
  PLAY_TILE_TEXT[language] ?? PLAY_TILE_TEXT.en ?? PLAY_TILE_TEXT.az;

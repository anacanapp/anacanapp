// Tools hub tile text per language (sync, tiny). Kept in step with each <lang>.json ui.tileName / ui.tileDesc
// (checked by src/data/kid-exercises/kid-exercises-i18n.test.ts).
export const KIDEX_TILE_TEXT: Record<string, { name: string; description: string }> = {
  az: { name: 'Uşaq məşqləri', description: '0–5 yaş üçün şəkilli hərəkət məşqləri' },
  en: { name: "Kids' exercises", description: "Illustrated movement exercises for ages 0–5" },
  ru: { name: "Упражнения для детей", description: "Двигательные упражнения с картинками для детей 0–5 лет" },
  tr: { name: "Çocuk egzersizleri", description: "0–5 yaş için resimli hareket egzersizleri" },
  fr: { name: "Exercices pour enfants", description: "Exercices de motricité illustrés de 0 à 5 ans" },
  es: { name: "Ejercicios para niños", description: "Ejercicios de movimiento ilustrados de 0 a 5 años" },
  id: { name: "Latihan anak", description: "Latihan gerak bergambar untuk usia 0–5 tahun" },
  pt: { name: "Exercícios infantis", description: "Exercícios de movimento ilustrados para 0–5 anos" },
  vi: { name: "Bài tập cho bé", description: "Bài tập vận động có hình minh họa cho trẻ 0–5 tuổi" },
  hi: { name: "बच्चों के व्यायाम", description: "0–5 साल के लिए चित्रों वाले हरकत के व्यायाम" },
  ja: { name: "キッズ運動", description: "0–5歳向け、イラスト付きの運動あそび" },
  ko: { name: "아이 운동", description: "0–5세를 위한 그림으로 보는 몸 놀이 운동" },
  pl: { name: "Ćwiczenia dla dzieci", description: "Ilustrowane ćwiczenia ruchowe dla dzieci 0–5 lat" },
  nl: { name: "Beweegoefeningen", description: "Beweegoefeningen met plaatjes voor 0–5 jaar" },
  sv: { name: "Rörelseövningar", description: "Rörelseövningar med bilder för 0–5 år" },
  et: { name: "Laste liikumisharjutused", description: "Piltidega liikumisharjutused 0–5-aastastele" },
  de: { name: "Bewegung für Kinder", description: "Bewegungsübungen mit Bildern für 0–5 Jahre" },
  kk: { name: "Балаларға арналған жаттығулар", description: "0–5 жасқа арналған суретті қимыл жаттығулары" },
  ar: { name: "تمارين الأطفال", description: "تمارين حركية مصوّرة للأعمار من 0 إلى 5 سنوات" },
  uz: { name: "Bola mashqlari", description: "0–5 yosh uchun rasmli harakat mashqlari" },
  ka: { name: "ბავშვის ვარჯიშები", description: "სურათებიანი მოძრაობის ვარჯიშები 0–5 წლის ბავშვებისთვის" },
  zh: { name: "宝宝运动", description: "0–5 岁图解运动练习" },
};

/** App languages with Uşaq məşqləri content (same keys as KIDEX_LANGUAGE_LOADERS in ./index.ts; checked by the test). */
export const KIDEX_CONTENT_LANGUAGES = ['az', 'en', 'ru', 'tr', 'fr', 'es', 'id', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'et', 'de', 'kk', 'ar', 'uz', 'ka', 'zh'];

export const hasKidExContent = (language: string | null | undefined): boolean => KIDEX_CONTENT_LANGUAGES.includes(String(language || ''));

/** Sync tile name/description for the Tools hub (no content loaded). */
export const kidExTileText = (language: string): { name: string; description: string } =>
  KIDEX_TILE_TEXT[language] ?? KIDEX_TILE_TEXT.en ?? KIDEX_TILE_TEXT.az;

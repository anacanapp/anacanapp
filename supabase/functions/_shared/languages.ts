/** Application language codes are independent of account/country routing. */
export const EXPANDED_LANGUAGE_NAMES: Record<string, string> = {
  zh: 'Mandarin Chinese (Simplified Chinese characters, zh-CN)',
  id: 'Indonesian (Bahasa Indonesia, id-ID)',
  fr: 'French (fr-FR)', es: 'Spanish (es-ES)', pt: 'European Portuguese (pt-PT)',
  vi: 'Vietnamese (vi-VN, with complete Vietnamese diacritics)', hi: 'Hindi (hi-IN, Devanagari script)',
  ja: 'Japanese (ja-JP, natural Japanese with kanji and kana)', ko: 'Korean (ko-KR, Hangul)',
  pl: 'Polish (pl-PL)', nl: 'Dutch (Netherlands, nl-NL)', sv: 'Swedish (sv-SE)',
};
export const LANGUAGE_NAMES: Record<string, string> = {
  az: 'Azerbaijani', en: 'English', tr: 'Turkish', ru: 'Russian', de: 'German',
  ar: 'Modern Standard Arabic', ka: 'Georgian', kk: 'Kazakh', uz: 'Uzbek (Latin script)',
  ...EXPANDED_LANGUAGE_NAMES,
};
export const LANGUAGE_CODES = Object.keys(LANGUAGE_NAMES);
export const isExpandedLanguage = (language: string) => Object.hasOwn(EXPANDED_LANGUAGE_NAMES, language);
export function outputLanguageRule(language: string): string {
  if (!isExpandedLanguage(language)) return '';
  return `Write all user-visible text in ${EXPANDED_LANGUAGE_NAMES[language]}, including titles, labels, descriptions, explanations and recommendations. The language of these instructions does not determine the reply language. Keep JSON keys, enum/status codes, numbers, units, identifiers, names supplied by the user and URLs unchanged. Do not add medical claims or change the meaning.`;
}

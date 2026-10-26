import { normalizeAppLanguage } from './app-languages';

// Fictional examples only. Never replace a real child/profile name.
const EXAMPLES = {
  az: 'Aylin', en: 'Emma', tr: 'Zeynep', ru: 'София', de: 'Mia', ar: 'ليان',
  ka: 'ნინო', kk: 'Айша', uz: 'Madina', zh: '小雨', id: 'Putri', fr: 'Léa',
  es: 'Lucía', pt: 'Inês', vi: 'An', hi: 'आन्या', ja: 'はな', ko: '하나', pl: 'Zosia', nl: 'Noor', sv: 'Alma',
} as const;
export const exampleChildName = (language: string) => EXAMPLES[normalizeAppLanguage(language)];

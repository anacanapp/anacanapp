import { normalizeAppLanguage, readAppLanguage } from './app-languages';

// Shared mode labels for onboarding, profiles and community. Bundled so an old
// remote translation or first-launch cache cannot restore the character names.
export const STAGE_NAMES = {
  az: ['Menstruasiya', 'Hamiləlik', 'Analıq'],
  en: ['Period', 'Pregnancy', 'Motherhood'],
  tr: ['Adet', 'Hamilelik', 'Annelik'],
  ru: ['Менструация', 'Беременность', 'Материнство'],
  de: ['Periode', 'Schwangerschaft', 'Mutterschaft'],
  ar: ['الدورة الشهرية', 'الحمل', 'الأمومة'],
  ka: ['მენსტრუაცია', 'ორსულობა', 'დედობა'],
  kk: ['Етеккір', 'Жүктілік', 'Ана болу'],
  uz: ['Hayz', 'Homiladorlik', 'Onalik'],
  zh: ['经期', '孕期', '育儿'],
  id: ['Menstruasi', 'Kehamilan', 'Menjadi ibu'],
  fr: ['Règles', 'Grossesse', 'Maternité'],
  es: ['Menstruación', 'Embarazo', 'Maternidad'],
  pt: ['Menstruação', 'Gravidez', 'Maternidade'],
  vi: ['Kinh nguyệt', 'Thai kỳ', 'Làm mẹ'],
  hi: ['मासिक धर्म', 'गर्भावस्था', 'मातृत्व'],
  ja: ['月経', '妊娠', '育児'],
  ko: ['월경', '임신', '육아'],
  pl: ['Miesiączka', 'Ciąża', 'Macierzyństwo'],
  nl: ['Menstruatie', 'Zwangerschap', 'Moederschap'],
  sv: ['Mens', 'Graviditet', 'Moderskap'],
} as const;

export function lifeStageName(stage: 'flow' | 'bump' | 'mommy', language: string = readAppLanguage()): string {
  return STAGE_NAMES[normalizeAppLanguage(language)][stage === 'flow' ? 0 : stage === 'bump' ? 1 : 2];
}

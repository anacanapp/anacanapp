/** Bundled UI language registry. Region controls formatting, not account country. */
export const APP_LANGUAGES = [
  { code: 'az', name: 'Azerbaijani', native_name: 'Azərbaycan', locale: 'az-AZ', flag: 'az' },
  { code: 'en', name: 'English', native_name: 'English', locale: 'en-US', flag: 'gb' },
  { code: 'tr', name: 'Turkish', native_name: 'Türkçe', locale: 'tr-TR', flag: 'tr' },
  { code: 'ru', name: 'Russian', native_name: 'Русский', locale: 'ru-RU', flag: 'ru' },
  { code: 'de', name: 'German', native_name: 'Deutsch', locale: 'de-DE', flag: 'de' },
  { code: 'ar', name: 'Arabic', native_name: 'العربية', locale: 'ar', flag: 'sa' },
  { code: 'ka', name: 'Georgian', native_name: 'ქართული', locale: 'ka-GE', flag: 'ge' },
  { code: 'kk', name: 'Kazakh', native_name: 'Қазақша', locale: 'kk-KZ', flag: 'kz' },
  { code: 'uz', name: 'Uzbek', native_name: 'O‘zbekcha', locale: 'uz-UZ', flag: 'uz' },
  { code: 'zh', name: 'Chinese (Mandarin, Simplified)', native_name: '简体中文', locale: 'zh-CN', flag: 'cn' },
  { code: 'id', name: 'Indonesian', native_name: 'Bahasa Indonesia', locale: 'id-ID', flag: 'id' },
  { code: 'fr', name: 'French', native_name: 'Français', locale: 'fr-FR', flag: 'fr' },
  { code: 'es', name: 'Spanish', native_name: 'Español', locale: 'es-ES', flag: 'es' },
  { code: 'pt', name: 'Portuguese', native_name: 'Português', locale: 'pt-PT', flag: 'pt' },
  { code: 'vi', name: 'Vietnamese', native_name: 'Tiếng Việt', locale: 'vi-VN', flag: 'vn' },
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी', locale: 'hi-IN', flag: 'in' },
  { code: 'ja', name: 'Japanese', native_name: '日本語', locale: 'ja-JP', flag: 'jp' },
  { code: 'ko', name: 'Korean', native_name: '한국어', locale: 'ko-KR', flag: 'kr' },
  { code: 'pl', name: 'Polish', native_name: 'Polski', locale: 'pl-PL', flag: 'pl' },
  { code: 'nl', name: 'Dutch', native_name: 'Nederlands', locale: 'nl-NL', flag: 'nl' },
  { code: 'sv', name: 'Swedish', native_name: 'Svenska', locale: 'sv-SE', flag: 'se' },
] as const;
export type AppLanguageCode = typeof APP_LANGUAGES[number]['code'];
export const APP_LANGUAGE_CODES = APP_LANGUAGES.map(language => language.code);
export const NEW_LANGUAGE_CODES = ['zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv'] as const;
export const LANGUAGE_EXPANSION_21 = ['vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv'] as const;
export const isAppLanguage = (code: string): code is AppLanguageCode => APP_LANGUAGES.some(language => language.code === code);
export function normalizeAppLanguage(value: unknown): AppLanguageCode {
  const code = typeof value === 'string' ? value.trim().toLowerCase().replace(/_/g, '-').split('-')[0] : '';
  return isAppLanguage(code) ? code : 'az';
}
// tr() calls this ~thousands of times per render. Reading + JSON.parse-ing the
// whole persisted user store each time froze low-end WebViews, so the result is
// kept in memory. userStore keeps it current (setCachedAppLanguage on every
// language change, incl. hydration/logout); another tab's write clears it.
let cachedLanguage: AppLanguageCode | null = null;
export function setCachedAppLanguage(value: unknown): void {
  cachedLanguage = value == null || value === '' ? null : normalizeAppLanguage(value);
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === 'anacan-user-store' || event.key === 'language') cachedLanguage = null;
  });
}
export function readAppLanguage(): AppLanguageCode {
  if (cachedLanguage) return cachedLanguage;
  cachedLanguage = readStoredAppLanguage();
  return cachedLanguage;
}
function readStoredAppLanguage(): AppLanguageCode {
  try {
    const raw = localStorage.getItem('anacan-user-store');
    if (raw) {
      try { const language = JSON.parse(raw)?.state?.language; if (language) return normalizeAppLanguage(language); } catch { /* separate preference below */ }
    }
    return normalizeAppLanguage(localStorage.getItem('language'));
  } catch { return 'az'; }
}
export const appLanguageLocale = (code: string) => APP_LANGUAGES.find(language => language.code === normalizeAppLanguage(code))!.locale;

export interface AppLanguage {
  code: string;
  name: string;
  native_name: string;
  is_active?: boolean;
  sort_order?: number;
  disabled_tools?: string[];
}

/** Only this bundle's registry determines supported UI choices. As with the
 * existing TR/RU rollout, new server rows stay inactive for legacy clients that
 * cannot render them. Remote names and tool restrictions still apply. */
export function resolveAppLanguages(remote: AppLanguage[] = []): AppLanguage[] {
  const known = new Set(remote.map(language => language.code));
  const enabled = remote.filter(language => isAppLanguage(language.code)).map(language => ({ ...language, is_active: true }));
  const referenceTools = remote.find(language => language.code === 'en')?.disabled_tools;
  return [...enabled, ...APP_LANGUAGES.filter(language => !known.has(language.code)).map(language =>
    (NEW_LANGUAGE_CODES as readonly string[]).includes(language.code) && Array.isArray(referenceTools)
      ? { ...language, disabled_tools: [...referenceTools] } : language)];
}

const regionNames = new Map<string, { of(code: string): string | undefined }>();
export function localizedCountryName(code: string, language: string, fallback = code): string {
  try {
    const locale = appLanguageLocale(language);
    if (!regionNames.has(locale)) {
      const DisplayNames = (Intl as typeof Intl & { DisplayNames?: new (locales: string[], options: { type: 'region' }) => { of(code: string): string | undefined } }).DisplayNames;
      if (!DisplayNames) return fallback;
      regionNames.set(locale, new DisplayNames([locale], { type: 'region' }));
    }
    return regionNames.get(locale)?.of(code.toUpperCase()) || fallback;
  } catch { return fallback; }
}

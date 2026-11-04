import copy from '../../../scripts/i18n/privacy-copy.json';
import { normalizeAppLanguage } from '@/lib/app-languages';
import { useUserStore } from '@/store/userStore';

export type PrivacyCopyKey = keyof typeof copy.languages.en;
const table = copy.languages as Record<string, Record<string, string>>;

export function privacyText(key: PrivacyCopyKey, language: string): string {
  return table[normalizeAppLanguage(language)]?.[key] || copy.languages.en[key];
}
export function usePrivacyText() {
  const language = useUserStore(state => state.language);
  return (key: PrivacyCopyKey) => privacyText(key, language);
}

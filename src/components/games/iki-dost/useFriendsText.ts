import { useCallback, useMemo } from 'react';
import { useUserStore } from '@/store/userStore';
import { appLanguageLocale, normalizeAppLanguage } from '@/lib/app-languages';
import { friendsText, type FriendsMessageKey } from './messages';

export type FriendsText = (key: FriendsMessageKey, values?: Record<string, string | number>) => string;
export function useFriendsText() {
  const language = normalizeAppLanguage(useUserStore(state => state.language));
  const formatter = useMemo(() => new Intl.NumberFormat(appLanguageLocale(language), { maximumFractionDigits: 0 }), [language]);
  const number = useCallback((value: number) => formatter.format(value), [formatter]);
  const t = useCallback<FriendsText>((key, values = {}) => friendsText(language, key,
    Object.fromEntries(Object.entries(values).map(([name, value]) => [name, typeof value === 'number' ? formatter.format(value) : value]))), [language, formatter]);
  return { t, number, language, dir: language === 'ar' ? 'rtl' as const : 'ltr' as const };
}

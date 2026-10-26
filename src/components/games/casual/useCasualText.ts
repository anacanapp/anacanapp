import { useCallback, useMemo } from 'react';
import { useUserStore } from '@/store/userStore';
import { appLanguageLocale, normalizeAppLanguage } from '@/lib/app-languages';
import { casualText, type CasualTextKey } from './messages';

export type CasualText = (key: CasualTextKey, values?: Record<string, string | number>) => string;
export function useCasualText() {
  const language = normalizeAppLanguage(useUserStore(state => state.language));
  const formatter = useMemo(() => new Intl.NumberFormat(appLanguageLocale(language), { maximumFractionDigits: 0 }), [language]);
  const number = useCallback((value: number) => formatter.format(value), [formatter]);
  const t = useCallback<CasualText>((key, values = {}) => casualText(language, key,
    Object.fromEntries(Object.entries(values).map(([name, value]) => [name, typeof value === 'number' ? formatter.format(value) : value]))), [language, formatter]);
  return { language, number, t, dir: language === 'ar' ? 'rtl' as const : 'ltr' as const };
}

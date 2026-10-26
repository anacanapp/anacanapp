import { useCallback, useMemo } from 'react';
import { useUserStore } from '@/store/userStore';
import { getCachedTranslation } from '@/lib/i18n';
import { MESSAGES, type MessageKey } from './messages';
import { appLanguageLocale } from '@/lib/app-languages';

export function colorSortText(language: string, key: MessageKey, parameters: Record<string, string | number> = {}): string {
  const seed = MESSAGES[language] ?? MESSAGES.az;
  const value = getCachedTranslation(`colorsort_${key}`, language) || getCachedTranslation(`color_sort.${key}`, language) || seed[key];
  return value.replace(/\{(\w+)\}/g, (placeholder, name) => parameters[name] === undefined ? placeholder : String(parameters[name]));
}

export function useColorSortText() {
  const language = useUserStore(state => state.language) || 'az';
  const formatter = useMemo(() => new Intl.NumberFormat(appLanguageLocale(language), { maximumFractionDigits: 0 }), [language]);
  const number = useCallback((value: number) => formatter.format(value), [formatter]);
  const t = useCallback((key: MessageKey, parameters: Record<string, string | number> = {}) => colorSortText(language, key,
    Object.fromEntries(Object.entries(parameters).map(([key, value]) => [key, typeof value === 'number' ? formatter.format(value) : value]))), [language, formatter]);
  return { t, number, language, dir: language === 'ar' ? 'rtl' as const : 'ltr' as const };
}

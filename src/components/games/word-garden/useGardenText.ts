import { useCallback, useMemo } from 'react';
import { gardenText, type GardenMessageKey } from './messages';

export function useGardenText(language: string, locale: string) {
  const formatter = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }), [locale]);
  const number = useCallback((value: number) => formatter.format(value), [formatter]);
  const t = useCallback((key: GardenMessageKey, values: Record<string, string | number> = {}) => gardenText(language, key,
    Object.fromEntries(Object.entries(values).map(([name, value]) => [name, typeof value === 'number' ? formatter.format(value) : value]))), [language, formatter]);
  return { t, number };
}
export type GardenText = ReturnType<typeof useGardenText>['t'];

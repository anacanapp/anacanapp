import { appLanguageLocale, LANGUAGE_EXPANSION_21 } from './app-languages';

const units: Record<string, { unit: string; short?: boolean }> = {
  day: { unit: 'day' }, days: { unit: 'day' }, gün: { unit: 'day' },
  week: { unit: 'week' }, weeks: { unit: 'week' }, həftə: { unit: 'week' },
  month: { unit: 'month' }, months: { unit: 'month' }, ay: { unit: 'month' },
  year: { unit: 'year' }, years: { unit: 'year' }, il: { unit: 'year' },
  hour: { unit: 'hour' }, hours: { unit: 'hour' }, saat: { unit: 'hour' },
  minute: { unit: 'minute' }, minutes: { unit: 'minute' }, dəqiqə: { unit: 'minute' },
  min: { unit: 'minute', short: true }, dəq: { unit: 'minute', short: true },
  second: { unit: 'second' }, seconds: { unit: 'second' }, saniyə: { unit: 'second' },
  sec: { unit: 'second', short: true }, san: { unit: 'second', short: true },
};

/** CLDR supplies grammatical count forms (e.g. Polish 1 dzień / 2 dni) for
 * simple duration labels. Prices and sentence templates retain their own copy. */
export function formatCountUnit(language: string, template: string, values: Record<string, unknown>): string | undefined {
  if (!(LANGUAGE_EXPANSION_21 as readonly string[]).includes(language)) return undefined;
  const match = /^\{([A-Za-z_][A-Za-z0-9_]*)\}\s+(day|days|gün|week|weeks|həftə|month|months|ay|year|years|il|hour|hours|saat|minute|minutes|dəqiqə|min|dəq|second|seconds|saniyə|sec|san)\.?$/iu.exec(template.trim());
  if (!match || typeof values[match[1]] !== 'number' || !Number.isFinite(values[match[1]])) return undefined;
  const item = units[match[2].toLowerCase()];
  return new Intl.NumberFormat(appLanguageLocale(language), { style: 'unit', unit: item.unit, unitDisplay: item.short ? 'short' : 'long', maximumFractionDigits: 2 }).format(values[match[1]] as number);
}

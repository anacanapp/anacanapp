import { formatTr, getPersistedLanguage, tr } from './tr';
import { pluralOf } from './recap/numbers';

/**
 * Counted nouns and ordinal week/trimester labels for all app languages.
 *
 * "{count} {noun}" built from one translated word reads wrong wherever the noun inflects after numerals
 * (Russian "93 статей" instead of "93 статьи", "1 запис."). Each counted noun therefore has one template per
 * CLDR category: `<key>_one`, `<key>_few`, `<key>_many`, `<key>_other` (languages without a category repeat
 * the `_other` text). The category comes from the project's CLDR rules (src/lib/recap/numbers.ts), so it does
 * not depend on the WebView's ICU data.
 */
export type CountNoun = 'count_articles' | 'count_records';

const AZ_FALLBACK: Record<CountNoun, string> = {
  count_articles: '{count} məqalə',
  count_records: '{count} qeyd',
};

export function pluralCategory(language: string, count: number): 'one' | 'few' | 'many' | 'other' {
  const category = pluralOf(language, count);
  return category === 'one' || category === 'few' || category === 'many' ? category : 'other';
}

export function formatCount(noun: CountNoun, count: number, language: string = getPersistedLanguage()): string {
  const safe = Number.isFinite(count) ? count : 0;
  const category = pluralCategory(language, safe);
  const fallback = tr(`${noun}_other`, AZ_FALLBACK[noun]);
  const template = category === 'other' ? fallback : tr(`${noun}_${category}`, fallback);
  return template.replace(/\{count\}/g, String(safe));
}

/** "19. həftə" / "Week 19" / "19-я неделя": the language's own ordinal pattern, not "19. НЕДЕЛЯ". */
export function weekOrdinal(week: number): string {
  return formatTr('ordinal_week_label', '{week}. həftə', { week });
}

export function trimesterOrdinal(trimester: number): string {
  return formatTr('ordinal_trimester_label', '{n}. trimestr', { n: trimester });
}

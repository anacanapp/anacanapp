/**
 * Synchronous registry of the 42 week texts per language (az.ts, ru.ts). The SSR renderer and tests register them at import
 * (tools/tool-data-server.ts); the browser loads one language chunk before hydration only on these URLs
 * (tools/tool-data-client.ts), so the main site bundle does not carry the texts.
 */
import type { PregnancyWeekContent } from './weeks';

const weeks = new Map<string, Map<number, PregnancyWeekContent>>();
export function registerPregnancyWeeks(rows: readonly PregnancyWeekContent[], language = 'az') { weeks.set(language, new Map(rows.map(row => [row.week, row]))); }
export const pregnancyWeekContent = (week: number, language = 'az') => weeks.get(language)?.get(week);
export const pregnancyWeeksLoaded = (language = 'az') => weeks.has(language);

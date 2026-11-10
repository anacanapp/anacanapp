/**
 * Synchronous registry of the 42 week texts (az.ts). The SSR renderer and tests register them at import
 * (tools/tool-data-server.ts); the browser loads the az.ts chunk before hydration only on these URLs
 * (tools/tool-data-client.ts), so the main site bundle does not carry the texts.
 */
import type { PregnancyWeekContent } from './weeks';

let weeks: Map<number, PregnancyWeekContent> | undefined;
export function registerPregnancyWeeks(rows: readonly PregnancyWeekContent[]) { weeks = new Map(rows.map(row => [row.week, row])); }
export const pregnancyWeekContent = (week: number) => weeks?.get(week);
export const pregnancyWeeksLoaded = () => !!weeks;

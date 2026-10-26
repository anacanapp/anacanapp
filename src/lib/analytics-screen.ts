/** Actual mounted screens, not URLs or user content. Entries disappear on exit. */
export interface AnalyticsScreen { id: number; title: string; category?: string }
let sequence = 0;
const screens = new Map<number, AnalyticsScreen>();
export function registerAnalyticsScreen(title: string, category?: string) {
  const id = ++sequence;
  screens.set(id, { id, title, category });
  return () => { screens.delete(id); };
}
export function currentAnalyticsScreen(): AnalyticsScreen | null {
  return [...screens.values()].at(-1) || null;
}

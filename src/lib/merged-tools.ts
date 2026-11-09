/**
 * Tools shown as sections of another tool (2026-11-09, compact Tools page). The child keeps its own screen, data and
 * access rule; its tile is hidden only where the host tool is available in the current stage, and every old link
 * (tile id, deeplink, push, banner) opens the host on that section.
 */
export const TOOL_HOST: Record<string, string> = {
  mood: 'mental-health', 'mood-diary': 'mental-health',
  'baby-growth': 'baby-tracker', 'growth-tracker': 'baby-tracker',
  teething: 'baby-tracker', 'teething-tracker': 'baby-tracker',
  'blood-sugar': 'blood-pressure',
  'noise-meter': 'whitenoise',
};
/** Sections of each host, in tab order (host first). Aliases resolve to the canonical id. */
export const HOST_SECTIONS: Record<string, string[]> = {
  'mental-health': ['mental-health', 'mood'],
  'baby-tracker': ['baby-tracker', 'baby-growth', 'teething'],
  'blood-pressure': ['blood-pressure', 'blood-sugar'],
  whitenoise: ['whitenoise', 'noise-meter'],
};
const ALIAS: Record<string, string> = { 'mood-diary': 'mood', 'growth-tracker': 'baby-growth', 'teething-tracker': 'teething', 'white-noise': 'whitenoise' };
export const canonicalToolId = (id: string) => ALIAS[id] ?? id;

/** Sleep tools stay separate but link to each other with a short intro at the top. */
export const TOOL_COMPANION: Record<string, string> = { whitenoise: 'sleep-training', 'sleep-training': 'whitenoise' };

/** Where a tool id opens: its host (when available) and the section to show. */
export function resolveToolTarget(id: string, available: (toolId: string) => boolean): { host: string; section: string } {
  const c = canonicalToolId(id);
  const host = TOOL_HOST[id] ?? TOOL_HOST[c];
  if (host && available(host)) return { host, section: c };
  return { host: c, section: c };
}
/** Hide a child tile when its host tile is shown. */
export const isMergedAway = (id: string, available: (toolId: string) => boolean) => {
  const host = TOOL_HOST[id] ?? TOOL_HOST[canonicalToolId(id)];
  return !!host && available(host);
};

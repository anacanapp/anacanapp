// Daily quiz tile visibility: app_settings.daily_quiz = { enabled, languages[] } (Admin → Bilik Yarışı).
// Admins always see the tile so they can test a language before switching it on.
export function isQuizTileVisible({ setting, language, isAdmin }: { setting: unknown; language: string; isAdmin?: boolean }): boolean {
  if (isAdmin) return true;
  let v = setting;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return false; } }
  if (!v || typeof v !== 'object') return false;
  const cfg = v as { enabled?: unknown; languages?: unknown };
  if (cfg.enabled === false) return false;
  const lang = String(language || '').toLowerCase().split(/[-_]/)[0];
  return Array.isArray(cfg.languages) && cfg.languages.includes(lang);
}

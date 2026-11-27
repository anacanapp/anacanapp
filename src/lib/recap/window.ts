// Anacan Recap availability window (app_settings.recap_<year>), mirrored from anacan_recap_v1 (2026-11-12):
// everyone, admins included, sees it between start_at and end_at; admin_start_at / admin_end_at, when set,
// replace those dates for admins only.
export interface RecapConfig { enabled?: boolean; start_at?: string | null; end_at?: string | null; admin_start_at?: string | null; admin_end_at?: string | null }

/** Parses the stored value (object or JSON string). */
export function parseRecapConfig(value: unknown): RecapConfig {
  let v = value;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { v = {}; } }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as RecapConfig) : {};
}

const BAKU_MS = 4 * 3600_000;
/** ISO timestamp -> value for <input type="datetime-local"> in Baku time (UTC+4, no DST). */
export function toBakuInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + BAKU_MS).toISOString().slice(0, 16) : '';
}
/** <input type="datetime-local"> value (Baku time) -> ISO with +04:00, or null when empty/invalid. */
export function fromBakuInput(value: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+04:00` : null;
}

/** Window that applies to an admin or to everyone else. */
export function recapWindow(cfg: RecapConfig, admin: boolean): { start: string | null; end: string | null } {
  return {
    start: (admin && cfg.admin_start_at) || cfg.start_at || null,
    end: (admin && cfg.admin_end_at) || cfg.end_at || null,
  };
}

export function recapOpen(cfg: RecapConfig, admin: boolean, now = new Date()): boolean {
  if (!cfg.enabled) return false;
  const w = recapWindow(cfg, admin);
  const s = w.start ? Date.parse(w.start) : Infinity;
  const e = w.end ? Date.parse(w.end) : Infinity;
  return now.getTime() >= s && now.getTime() <= e;
}

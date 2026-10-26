import { emptyAdLedger, normalizeAdLedger, type AdLedger } from './policy';
import { AD_PLACEMENT_IDS, type AdMode } from './config';

const key = (mode: AdMode) => `anacan.ads.ledger.v1:${mode}`;
const countIsValid = (value: unknown) => {
  const item = value as { session?: unknown; day?: unknown; last?: unknown };
  return item && [item.session, item.day, item.last].every(number => Number.isSafeInteger(number) && Number(number) >= 0);
};
export function readAdLedger(mode: AdMode, sessionId: string, now = Date.now()): AdLedger {
  try {
    const stored = localStorage.getItem(key(mode));
    if (!stored) return emptyAdLedger(now, sessionId);
    const value: AdLedger = JSON.parse(stored);
    if (!/^\d{4}-\d\d-\d\d$/.test(value.date) || typeof value.session_id !== 'string' || !countIsValid(value.fullscreen)
      || !Number.isSafeInteger(value.pause_until) || value.pause_until < 0 || !Number.isSafeInteger(value.last_banner)
      || !value.placements || Object.entries(value.placements).some(([id, item]) => !AD_PLACEMENT_IDS.includes(id as never) || !countIsValid(item)))
      return emptyAdLedger(now, sessionId);
    return normalizeAdLedger(value, now, sessionId);
  } catch { return emptyAdLedger(now, sessionId); }
}
export function writeAdLedger(mode: AdMode, ledger: AdLedger): void {
  try { localStorage.setItem(key(mode), JSON.stringify(ledger)); } catch { /* In-memory caps remain active. */ }
}

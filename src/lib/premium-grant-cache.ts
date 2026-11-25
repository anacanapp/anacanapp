/**
 * Offline continuation of a server-confirmed Premium grant.
 *
 * `get_premium_access_v1` answers with a short (≤31s) lease plus the real expiry of
 * the own/household grant. The lease forces frequent re-checks while online, but a
 * paying user who goes offline (or whose app is backgrounded past the lease) must
 * not lose Premium. A confirmed active grant therefore stays valid locally until
 * min(real expiry, last confirmation + 72h).
 *
 * Security boundaries:
 * - only a validated server answer for the same backend + account writes a record;
 *   a record never grants anything the server has not confirmed;
 * - an explicit server "inactive" answer overwrites the record immediately;
 * - deadlines are server-relative (expiresAt - checkedAt) and anchored to the local
 *   clock at confirmation time, and a clock moved backwards invalidates the record.
 */

export const PREMIUM_OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000;
/** Local clock skew tolerated before a record is treated as tampered. */
const CLOCK_BACKWARD_TOLERANCE_MS = 5 * 60 * 1000;
const PREFIX = 'anacan_premium_grant_v1:';

export interface ServerGrant { active: boolean; expiresAt: string | null; source?: string }

export interface PremiumGrantRecord {
  backend: string;
  userId: string;
  /** Partner the household grant was confirmed for; a changed link invalidates it. */
  partner: string | null;
  /** Local wall-clock time of the confirming server answer. */
  confirmedAt: number;
  /** Local wall-clock deadlines (0 = inactive). */
  ownUntil: number;
  householdUntil: number;
  ownSource: string | null;
}

function grantDeadline(grant: ServerGrant, checkedAt: number, confirmedAt: number, graceMs: number): number {
  if (!grant?.active) return 0;
  const cap = confirmedAt + graceMs;
  if (grant.expiresAt === null) return cap;
  const expires = Date.parse(grant.expiresAt);
  if (!Number.isFinite(expires)) return 0;
  // Server-relative remaining time; immune to a device clock that is simply wrong.
  return Math.min(cap, confirmedAt + (expires - checkedAt));
}

/** Build a record from an already validated server answer. */
export function recordFromServer(input: {
  backend: string; userId: string; partner: string | null; checkedAt: string;
  own: ServerGrant; household: ServerGrant; now?: number; graceMs?: number;
}): PremiumGrantRecord {
  const confirmedAt = input.now ?? Date.now();
  const checked = Date.parse(input.checkedAt);
  const graceMs = input.graceMs ?? PREMIUM_OFFLINE_GRACE_MS;
  const safeChecked = Number.isFinite(checked) ? checked : confirmedAt;
  return {
    backend: input.backend, userId: input.userId, partner: input.partner, confirmedAt,
    ownUntil: grantDeadline(input.own, safeChecked, confirmedAt, graceMs),
    householdUntil: grantDeadline(input.household, safeChecked, confirmedAt, graceMs),
    ownSource: input.own?.active ? input.own.source ?? null : null,
  };
}

/** Evaluate a record for the current account/backend/partner at `now`. */
export function evaluateGrant(record: PremiumGrantRecord | null | undefined, scope: { backend: string; userId: string | null; partner: string | null },
  now = Date.now()): { own: boolean; household: boolean; hadGrant: boolean; nextChange: number | null } {
  const none = { own: false, household: false, hadGrant: false, nextChange: null };
  if (!record || !scope.userId || record.userId !== scope.userId || record.backend !== scope.backend) return none;
  if (now < record.confirmedAt - CLOCK_BACKWARD_TOLERANCE_MS) return { ...none, hadGrant: record.ownUntil > 0 || record.householdUntil > 0 };
  const householdUntil = record.partner === scope.partner ? record.householdUntil : 0;
  const own = record.ownUntil > now, household = householdUntil > now;
  const upcoming = [record.ownUntil, householdUntil].filter(value => value > now);
  return { own, household, hadGrant: record.ownUntil > 0 || householdUntil > 0, nextChange: upcoming.length ? Math.min(...upcoming) : null };
}

const storageKey = (backend: string, userId: string) => `${PREFIX}${backend}:${userId}`;

export function readGrantRecord(backend: string, userId: string): PremiumGrantRecord | null {
  try {
    const raw = localStorage.getItem(storageKey(backend, userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as PremiumGrantRecord;
    if (!value || value.userId !== userId || value.backend !== backend
      || ![value.confirmedAt, value.ownUntil, value.householdUntil].every(Number.isFinite)) return null;
    return value;
  } catch { return null; }
}

export function writeGrantRecord(record: PremiumGrantRecord): void {
  try {
    const key = storageKey(record.backend, record.userId);
    if (record.ownUntil <= 0 && record.householdUntil <= 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(record));
  } catch { /* storage unavailable: the in-memory record still covers this session */ }
}

/** Pick the newest of the in-memory and stored records. */
export function newestRecord(...records: Array<PremiumGrantRecord | null | undefined>): PremiumGrantRecord | null {
  return records.reduce<PremiumGrantRecord | null>((best, value) => value && (!best || value.confirmedAt > best.confirmedAt) ? value : best, null);
}

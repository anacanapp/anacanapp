// ============================================================
// kickSession.ts: pure helpers for the kick counter session.
// A session is timed from a stored start timestamp (not setInterval ticks), so a
// locked screen or a backgrounded WebView does not stop the clock. An unfinished
// session survives leaving the screen through localStorage.
// ============================================================
import { localDateKey } from '@/lib/local-date';

export interface ActiveKickSession {
  /** Epoch ms when this session started. */
  startedAt: number;
  kicks: number;
  position?: 'left' | 'right' | null;
}

/** Unfinished sessions older than this are dropped on restore (forgotten timer). */
export const KICK_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

const STORAGE_PREFIX = 'anacan_kick_active_v1';
const storageKey = (userId?: string | null) => `${STORAGE_PREFIX}:${userId || 'anon'}`;

/** A fresh session: count 0, new start time. Every "start" must use this. */
export const newKickSession = (now: number = Date.now(), kicks = 0): ActiveKickSession => ({ startedAt: now, kicks });

/** Whole seconds since the session started (never negative). */
export const kickElapsedSeconds = (session: Pick<ActiveKickSession, 'startedAt'> | null, now: number = Date.now()) =>
  session ? Math.max(0, Math.floor((now - session.startedAt) / 1000)) : 0;

function isValidSession(v: unknown, now: number): v is ActiveKickSession {
  if (!v || typeof v !== 'object') return false;
  const s = v as ActiveKickSession;
  return typeof s.startedAt === 'number' && Number.isFinite(s.startedAt) &&
    s.startedAt <= now + 60_000 && now - s.startedAt <= KICK_SESSION_MAX_AGE_MS &&
    typeof s.kicks === 'number' && Number.isInteger(s.kicks) && s.kicks >= 0 && s.kicks < 10_000;
}

export function loadActiveKickSession(userId?: string | null, now: number = Date.now()): ActiveKickSession | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidSession(parsed, now)) {
      localStorage.removeItem(storageKey(userId));
      return null;
    }
    const position = parsed.position === 'left' || parsed.position === 'right' ? parsed.position : null;
    return { startedAt: parsed.startedAt, kicks: parsed.kicks, position };
  } catch {
    return null;
  }
}

export function saveActiveKickSession(userId: string | null | undefined, session: ActiveKickSession | null) {
  try {
    if (session) localStorage.setItem(storageKey(userId), JSON.stringify(session));
    else localStorage.removeItem(storageKey(userId));
  } catch {
    /* storage blocked: the session just will not survive leaving the screen */
  }
}

/** Local calendar day of a saved session (from created_at, so old rows with a server-side UTC session_date group correctly). */
export const kickSessionDayKey = (s: { created_at: string; session_date?: string }) => {
  const d = new Date(s.created_at);
  return Number.isNaN(d.getTime()) ? (s.session_date || '') : localDateKey(d);
};

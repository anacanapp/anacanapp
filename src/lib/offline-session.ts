/**
 * Offline session restore.
 *
 * When the app opens with an expired access token and no usable network, auth-js keeps the
 * stored session (the refresh failed with a retryable network error) but reports
 * INITIAL_SESSION with no session, and only after ~25 s of refresh retries. The app must not
 * treat that as a logout: it opens read-only on the stored account (cached children,
 * timers, last data, offline outbox) and refreshes once the network is back.
 *
 * A real invalid refresh token is different: auth-js removes the stored session and emits
 * SIGNED_OUT, so `readStoredSession` then returns null and the normal logout path runs.
 */
import type { Session, User } from '@supabase/supabase-js';

type MaybeAsyncStorage = { getItem: (key: string) => string | null | Promise<string | null> } | undefined;

/** auth-js treats a session as expired this long before `expires_at`. */
export const SESSION_EXPIRY_MARGIN_MS = 90_000;
/** Online but slow: open on the stored account if the SDK has not answered by then. */
export const OFFLINE_RESTORE_GRACE_MS = 2_500;

export interface StoredSession extends Session {
  user: User;
}

export function parseStoredSession(raw: string | null | undefined): StoredSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSession> | null;
    if (!value || typeof value !== 'object') return null;
    if (typeof value.access_token !== 'string' || typeof value.refresh_token !== 'string' || !value.refresh_token) return null;
    if (typeof value.expires_at !== 'number') return null;
    const user = value.user as User | undefined;
    if (!user || typeof user !== 'object' || typeof user.id !== 'string' || !user.id) return null;
    if ((user as { __isUserNotAvailableProxy?: boolean }).__isUserNotAvailableProxy) return null;
    return value as StoredSession;
  } catch { return null; }
}

/** The session auth-js persisted (kept after a retryable refresh failure), or null. */
export async function readStoredSession(storage: MaybeAsyncStorage, storageKey: string | undefined): Promise<StoredSession | null> {
  if (!storage || !storageKey) return null;
  try { return parseStoredSession(await storage.getItem(storageKey)); } catch { return null; }
}

export function isSessionExpired(session: Pick<Session, 'expires_at'>, now = Date.now()): boolean {
  return typeof session.expires_at !== 'number' || session.expires_at * 1000 - now < SESSION_EXPIRY_MARGIN_MS;
}

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { authStorage, supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { AZURE_API_ORIGIN } from '@/integrations/supabase/backend-admission';

const LEGACY_BACKUP_KEY = 'anacan.auth.session.v1';
const BACKUP_KEY = `anacan.auth.session.v2:${encodeURIComponent(authStorage.realm)}`;
const TERMINAL_CODES = new Set([
  'refresh_token_not_found', 'refresh_token_already_used', 'session_not_found',
  'session_expired', 'user_banned', 'user_not_found',
]);

interface PersistedSession {
  access_token: string;
  refresh_token: string;
}

export class NativeSessionRecoveryPendingError extends Error {
  constructor() { super('NATIVE_SESSION_RECOVERY_PENDING'); this.name = 'NativeSessionRecoveryPendingError'; }
}

let writes = Promise.resolve();
let restoring: Promise<void> | undefined;
let subscribed = false;
let revision = 0;
let loggedOut = false;
let pendingLogouts = 0;

function tokenPair(value: unknown): PersistedSession | null {
  const session = value as Partial<PersistedSession> | null;
  return typeof session?.access_token === 'string' && session.access_token.length > 0 &&
    typeof session.refresh_token === 'string' && session.refresh_token.length > 0
    ? { access_token: session.access_token, refresh_token: session.refresh_token }
    : null;
}

function saveSession(session: PersistedSession | null): Promise<void> {
  const value = JSON.stringify({ realm: authStorage.realm, session });
  writes = writes.then(async () => {
    try {
      // A null tombstone, unlike removing the key, also blocks the v1 fallback.
      await Preferences.set({ key: BACKUP_KEY, value });
    } catch (error) {
      if (!session) await Preferences.remove({ key: BACKUP_KEY });
      throw error;
    } finally {
      if (!session && authStorage.allowLegacyFallback) {
        await Preferences.remove({ key: LEGACY_BACKUP_KEY });
      }
    }
    if (session && authStorage.allowLegacyFallback) {
      await Preferences.remove({ key: LEGACY_BACKUP_KEY });
    }
  }).catch(() => {
    // Errors can contain credentials; never log the payload or error object.
    console.warn('[session-persistence] backup write failed');
  });
  return writes;
}

async function loadSession(): Promise<PersistedSession | null> {
  await writes;
  const { value } = await Preferences.get({ key: BACKUP_KEY });
  if (value !== null) {
    const backup = JSON.parse(value);
    return backup?.realm === authStorage.realm ? tokenPair(backup.session) : null;
  }
  if (!authStorage.allowLegacyFallback) return null;
  const { value: legacy } = await Preferences.get({ key: LEGACY_BACKUP_KEY });
  return legacy === null ? null : tokenPair(JSON.parse(legacy));
}

function isTerminal(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return false;
  // Code-less AuthSessionMissingError also occurs for malformed success responses.
  // Retained candidates still require a successful server refresh before recovery.
  return isAuthApiError(error) && [400, 401, 403, 404, 422].includes(error.status) &&
    TERMINAL_CODES.has(error.code ?? '');
}

/** Native-only, idempotent. Existing callers keep using auth.signOut(). */
export function startNativeSessionSync(): void {
  if (!Capacitor.isNativePlatform() || subscribed) return;
  subscribed = true;
  const signOut = supabase.auth.signOut.bind(supabase.auth);
  supabase.auth.signOut = async (options) => {
    if (options?.scope === 'others') return signOut(options);
    loggedOut = true;
    pendingLogouts++;
    revision++;
    const cleared = saveSession(null);
    try {
      return await signOut(options);
    } finally {
      // The SDK can leave local credentials behind when remote logout fails.
      // Honor this explicit device logout without claiming server revocation.
      for (const suffix of ['', '-user', '-code-verifier']) {
        try { await authStorage.storage?.removeItem(authStorage.storageKey + suffix); }
        catch { console.warn('[session-persistence] local logout cleanup failed'); }
      }
      await cleared;
      pendingLogouts--;
    }
  };

  supabase.auth.onAuthStateChange((event, session) => {
    // SIGNED_OUT has no cause: the SDK also emits it for some server failures.
    // Retain that backup as a candidate only; recovery always checks refresh.
    if (!session || event === 'SIGNED_OUT') return;
    if (!['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event)) return;
    if (loggedOut && (event !== 'SIGNED_IN' || pendingLogouts > 0)) return;
    const pair = tokenPair(session);
    if (!pair) return;
    loggedOut = false;
    revision++;
    // Do not await SDK calls inside its auth callback/lock.
    void saveSession(pair);
  });
}

/** Call before rendering. Backup-only recovery requires the real refresh grant. */
export async function restoreNativeSession({ requireRecovery = false, preserveOnTerminal = false }:
  { requireRecovery?: boolean; preserveOnTerminal?: boolean } = {}): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  startNativeSessionSync();
  if (restoring) return restoring;
  if (loggedOut) return;

  restoring = (async () => {
    const startedAt = revision;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (revision !== startedAt || loggedOut) return;
      if (error) throw error;
      const existing = tokenPair(data.session);
      if (existing) {
        await saveSession(existing);
        return;
      }

      const persisted = await loadSession();
      if (!persisted || revision !== startedAt || loggedOut) return;
      const result = await supabase.auth.refreshSession({ refresh_token: persisted.refresh_token });
      if (revision !== startedAt || loggedOut) return;
      if (result.error) throw result.error;
      const refreshed = tokenPair(result.data.session);
      if (refreshed) await saveSession(refreshed);
      else if (requireRecovery) throw new NativeSessionRecoveryPendingError();
    } catch (error) {
      if (revision === startedAt && !loggedOut && isTerminal(error) && !preserveOnTerminal) {
        loggedOut = true;
        revision++;
        await saveSession(null);
      } else if (requireRecovery && revision === startedAt && !loggedOut) {
        // A retained backup is not a signed-out user. Transition builds show a
        // retry screen instead of asking for a password after network/config errors.
        throw new NativeSessionRecoveryPendingError();
      }
      // Network, maintenance, malformed storage and unknown errors never erase a backup.
    } finally {
      await writes;
    }
  })();
  try { await restoring; } finally { restoring = undefined; }
}

const ADOPTION_KEY = `anacan.auth.adoption.v1:${encodeURIComponent(AZURE_API_ORIGIN)}`;
let adopting: Promise<void> | undefined;

/** Native 29+: obtain a real target JWT before ANY application API call, even
 * when the cached Source ES256 JWT has not expired. The migration receipt survives
 * logout/restart, like the one-way authority pin; subsequent logins use this same
 * immutable target client. Source writers must already be frozen at admission. */
export async function restoreAdmittedNativeSession(): Promise<void> {
  const backend = getBackendConfig();
  if (!Capacitor.isNativePlatform() || !backend.sourceFirst || !backend.azure) {
    return restoreNativeSession({ requireRecovery: backend.sourceFirst });
  }
  if (adopting) return adopting;
  adopting = (async () => {
    try {
      const handoff = backend.admission?.policy.handoffSha256;
      if (backend.url !== AZURE_API_ORIGIN || !handoff || !/^[a-f0-9]{64}$/.test(handoff)) throw new Error();
      const { value } = await Preferences.get({ key: ADOPTION_KEY });
      const receipt = value === null ? null : JSON.parse(value);
      if (receipt && (receipt.schema !== 'anacan-auth-adoption-v1' || !['pending', 'complete'].includes(receipt.state)
        || typeof receipt.handoff !== 'string')) throw new Error();
      if (receipt?.handoff === handoff && receipt.state === 'complete') {
        await restoreNativeSession({ requireRecovery: true });
        return;
      }
      // During first adoption, a missing target row can also mean an incomplete
      // migration. Keep that untrusted candidate and block the app, rather than
      // erasing a potentially valid Source session. No fallback to Source occurs.
      await restoreNativeSession({ requireRecovery: true, preserveOnTerminal: true });
      const current = await supabase.auth.getSession();
      if (current.error) throw current.error;
      const expectedUserId = receipt?.handoff === handoff && receipt.state === 'pending'
        ? receipt.userId : current.data.session?.user.id ?? null;
      if (current.data.session && expectedUserId !== current.data.session.user.id) throw new Error();
      await Preferences.set({ key: ADOPTION_KEY, value: JSON.stringify({ schema: 'anacan-auth-adoption-v1',
        state: 'pending', handoff, userId: expectedUserId }) });
      if (current.data.session) {
        // No argument: the SDK acquires its lock and refreshes the latest stored
        // token, avoiding a race with a just-completed automatic refresh.
        const result = await supabase.auth.refreshSession();
        const pair = tokenPair(result.data.session);
        if (result.error || !pair || result.data.session.user.id !== expectedUserId) throw new Error();
        await saveSession(pair);
        const durable = await loadSession();
        if (durable?.access_token !== pair.access_token || durable.refresh_token !== pair.refresh_token) throw new Error();
      } else if (expectedUserId !== null) {
        // A previous pending attempt must not become a new anonymous installation.
        throw new Error();
      }
      await Preferences.set({ key: ADOPTION_KEY, value: JSON.stringify({ schema: 'anacan-auth-adoption-v1',
        state: 'complete', handoff, userId: expectedUserId }) });
    } catch { throw new NativeSessionRecoveryPendingError(); }
  })();
  try { await adopting; } finally { adopting = undefined; }
}

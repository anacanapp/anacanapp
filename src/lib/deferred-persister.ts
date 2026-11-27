import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { getPersistClearedAt } from './query-persist-policy';

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * React Query persister that never serialises during use. The throttled sync persister ran JSON.stringify over the
 * whole cache (several MB after weeks of use) every few seconds while the user navigated, which froze scrolling and
 * screen changes on mid-range Android (Samsung A51). This one keeps the latest snapshot in memory and writes it when
 * the app goes to the background, plus at most every `idleMs` when the main thread is idle.
 * A snapshot taken before a logout (clearPersistedQueryCache) is dropped, so a previous account's data is never written.
 */
export function createDeferredStoragePersister({ storage, key, idleMs = 120_000 }: { storage: Store | undefined; key: string; idleMs?: number }): Persister {
  let pending: PersistedClient | null = null;
  let pendingAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const write = (client: PersistedClient) => {
    if (!storage) return;
    try {
      storage.setItem(key, JSON.stringify(client));
    } catch {
      // Storage full: keep the newer half of the queries and try once more.
      try {
        const queries = client.clientState.queries;
        const trimmed = { ...client, clientState: { ...client.clientState, queries: queries.slice(Math.floor(queries.length / 2)) } };
        storage.setItem(key, JSON.stringify(trimmed));
      } catch { /* give up quietly; the cache is an optimisation */ }
    }
  };

  const flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!pending) return;
    const client = pending;
    pending = null;
    if (pendingAt <= getPersistClearedAt()) return;
    write(client);
  };

  const scheduleIdle = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      if (ric) ric(flush, { timeout: 10_000 }); else flush();
    }, idleMs);
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  }
  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush);

  return {
    persistClient: (client) => { pending = client; pendingAt = Date.now(); scheduleIdle(); },
    restoreClient: () => {
      if (!storage) return undefined;
      try {
        const raw = storage.getItem(key);
        return raw ? (JSON.parse(raw) as PersistedClient) : undefined;
      } catch { return undefined; }
    },
    removeClient: () => { pending = null; try { storage?.removeItem(key); } catch { /* blocked storage */ } },
  };
}

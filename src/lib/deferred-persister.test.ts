import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { createDeferredStoragePersister } from './deferred-persister';
import { clearPersistedQueryCache, resetPersistClearMarkForTests } from './query-persist-policy';

const client = (n: number): PersistedClient => ({ timestamp: n, buster: 'b', clientState: { mutations: [], queries: [{ queryKey: ['q', n], queryHash: `q${n}`, state: { data: n } } as never] } });
const memStore = () => { const m = new Map<string, string>(); return { m, setItem: vi.fn((k: string, v: string) => { m.set(k, v); }), getItem: (k: string) => m.get(k) ?? null, removeItem: (k: string) => { m.delete(k); } }; };
const hide = () => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); };

afterEach(() => { vi.useRealTimers(); resetPersistClearMarkForTests(); Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });

describe('deferred persister', () => {
  it('does not serialise while the app is in use, writes the latest snapshot on background', () => {
    const store = memStore();
    const p = createDeferredStoragePersister({ storage: store, key: 'k', idleMs: 60_000 });
    for (let i = 1; i <= 20; i++) p.persistClient(client(i));
    expect(store.setItem).not.toHaveBeenCalled();
    hide();
    expect(store.setItem).toHaveBeenCalledOnce();
    expect(JSON.parse(store.m.get('k')!).timestamp).toBe(20);
  });

  it('writes on the idle timer when the app stays open', () => {
    vi.useFakeTimers();
    const store = memStore();
    const p = createDeferredStoragePersister({ storage: store, key: 'k', idleMs: 1000 });
    p.persistClient(client(1));
    vi.advanceTimersByTime(999);
    expect(store.setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(store.setItem).toHaveBeenCalledOnce();
  });

  it('never writes a snapshot taken before logout', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const store = memStore();
    const p = createDeferredStoragePersister({ storage: store, key: 'k', idleMs: 60_000 });
    p.persistClient(client(1));
    vi.setSystemTime(2_000);
    clearPersistedQueryCache(store);
    hide();
    expect(store.setItem).not.toHaveBeenCalled();
  });

  it('restores what it wrote', () => {
    const store = memStore();
    const p = createDeferredStoragePersister({ storage: store, key: 'k' });
    p.persistClient(client(7));
    hide();
    expect((p.restoreClient() as PersistedClient).timestamp).toBe(7);
  });
});

/**
 * Web Storage that never throws on access.
 *
 * In private mode, with site data blocked, or inside some embedded WebViews, merely READING
 * `window.sessionStorage` / `window.localStorage` throws ("Failed to read the 'sessionStorage'
 * property from 'Window': Access is denied"). Module-level code (ours or a vendor's) that touches
 * storage while the app boots then white-screens the app. `installStorageFallbacks` replaces an
 * inaccessible storage with an in-memory one at startup, so the app keeps working for the tab's
 * lifetime without persistence; the helpers below are for code that wants an explicit guard.
 */
export type StorageKind = 'localStorage' | 'sessionStorage';

/** In-memory Storage with the full Web Storage API (values are kept as strings). */
export function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  const storage = {
    get length() { return data.size; },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => (data.has(String(key)) ? data.get(String(key))! : null),
    setItem: (key: string, value: string) => { data.set(String(key), String(value)); },
    removeItem: (key: string) => { data.delete(String(key)); },
    clear: () => { data.clear(); },
  };
  return storage as Storage;
}

type StorageHost = Partial<Record<StorageKind, Storage>>;

function hostWindow(): StorageHost | undefined {
  return typeof window !== 'undefined' ? (window as unknown as StorageHost) : undefined;
}

/** The real storage when it can be read, otherwise null. Never throws. */
export function safeStorage(kind: StorageKind, host: StorageHost | undefined = hostWindow()): Storage | null {
  if (!host) return null;
  try {
    const storage = host[kind];
    return storage && typeof storage.getItem === 'function' ? storage : null;
  } catch {
    return null;
  }
}

export function safeGetItem(kind: StorageKind, key: string): string | null {
  try { return safeStorage(kind)?.getItem(key) ?? null; } catch { return null; }
}

/** Returns false when the value could not be stored (blocked storage, quota). */
export function safeSetItem(kind: StorageKind, key: string, value: string): boolean {
  try { const storage = safeStorage(kind); if (!storage) return false; storage.setItem(key, value); return true; } catch { return false; }
}

export function safeRemoveItem(kind: StorageKind, key: string): void {
  try { safeStorage(kind)?.removeItem(key); } catch { /* blocked storage */ }
}

/**
 * Replaces each storage whose getter throws with an in-memory Storage. Returns the kinds that were
 * replaced. Must run before any other module reads storage (src/lib/polyfills.ts is the first import).
 */
export function installStorageFallbacks(host: StorageHost | undefined = hostWindow()): StorageKind[] {
  if (!host) return [];
  const replaced: StorageKind[] = [];
  for (const kind of ['localStorage', 'sessionStorage'] as const) {
    let blocked = false;
    try { void host[kind]; } catch { blocked = true; }
    if (!blocked) continue;
    try {
      Object.defineProperty(host, kind, { value: createMemoryStorage(), configurable: true, enumerable: true, writable: false });
      replaced.push(kind);
    } catch { /* non-configurable in this engine: explicit guards still apply */ }
  }
  return replaced;
}

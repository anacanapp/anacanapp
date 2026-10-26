/** Keep disposable server/translation caches from crowding out auth and UI state.
 * Never evict sessions, admission/adoption pins, logout markers, drafts, carts,
 * timers, health preferences or game progress. Critical writes remain durable:
 * when cache eviction cannot make room, the original storage failure is returned.
 */
const CACHE_BUDGET_BYTES = 2 * 1024 * 1024;
const CACHE_STORAGE_CEILING_BYTES = 4 * 1024 * 1024;
const bytes = (key: string, value: string) => 2 * (key.length + value.length);
const cachePriority = (key: string) => /^anacan_i18n_cache:(az|en|ru|tr|kk|de|ar|uz|ka|zh|id|fr|es|pt|vi|hi|ja|ko|pl|nl|sv)$/.test(key)
  ? 0 : key.startsWith('anacan_ocache_v1:') ? 1 : -1;

export function isStorageQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: string; code?: number; message?: string };
  return value.name === 'QuotaExceededError' || value.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || value.code === 22 || value.code === 1014
    || /^(?:the quota has been exceeded\.?|quota exceeded\.?)$/i.test(value.message ?? '');
}

function entries(storage: Storage) {
  const result: { key: string; bytes: number; priority: number }[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key === null) continue;
    const value = storage.getItem(key);
    if (value !== null) result.push({ key, bytes: bytes(key, value), priority: cachePriority(key) });
  }
  return result;
}
const disposable = (items: ReturnType<typeof entries>, except: string) => items
  .filter(item => item.priority >= 0 && item.key !== except)
  .sort((a, b) => a.priority - b.priority || b.bytes - a.bytes);

export function writeStorageItem(storage: Storage, key: string, value: string): void {
  let failure: unknown;
  try { storage.setItem(key, value); return; }
  catch (error) { if (!isStorageQuotaError(error)) throw error; failure = error; }
  for (const cached of disposable(entries(storage), key)) {
    storage.removeItem(cached.key);
    try { storage.setItem(key, value); return; }
    catch (error) { if (!isStorageQuotaError(error)) throw error; failure = error; }
  }
  throw failure;
}

/** Optional cache writes share a bounded budget and leave headroom for sessions. */
export function writeStorageCache(storage: Storage, key: string, value: string): boolean {
  if (cachePriority(key) < 0) throw new Error('NOT_A_DISPOSABLE_STORAGE_CACHE');
  try {
    const size = bytes(key, value);
    if (size > CACHE_BUDGET_BYTES) return false;
    const items = entries(storage).filter(item => item.key !== key);
    let total = items.reduce((sum, item) => sum + item.bytes, size);
    let cached = items.filter(item => item.priority >= 0).reduce((sum, item) => sum + item.bytes, size);
    const essential = items.filter(item => item.priority < 0).reduce((sum, item) => sum + item.bytes, 0);
    if (essential + size > CACHE_STORAGE_CEILING_BYTES) return false;
    for (const item of disposable(items, key)) {
      if (total <= CACHE_STORAGE_CEILING_BYTES && cached <= CACHE_BUDGET_BYTES) break;
      storage.removeItem(item.key); total -= item.bytes; cached -= item.bytes;
    }
    storage.setItem(key, value);
    return true;
  } catch { return false; }
}

export function quotaManagedStorage(storage: Storage, { bestEffort = false } = {}): Storage {
  return {
    get length() { return storage.length; },
    key: index => storage.key(index),
    getItem: key => storage.getItem(key),
    removeItem: key => storage.removeItem(key),
    clear: () => storage.clear(),
    setItem(key, value) {
      try { writeStorageItem(storage, key, value); }
      catch (error) {
        // A derived Zustand UI snapshot must not reject a successful SDK auth
        // callback. Auth/pin adapters use the strict default, never this fallback.
        if (!bestEffort) throw error;
      }
    },
  };
}

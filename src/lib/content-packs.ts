// Runtime for server-hosted content packs (see scripts/i18n/content-packs.mjs and
// docs/LOCALIZATION_25.md). Lookups stay synchronous: a missing shard returns
// undefined (callers fall back to en/ru) and is fetched in the background; when it
// arrives, subscribers are told so the UI can re-render / re-map cached queries.
import { contentTranslationKey } from '../../scripts/i18n/content-translation-core.mjs';

export const MANIFEST_SCHEMA = 'anacan-content-pack-manifest-v1';
export const SHARD_SCHEMA = 'anacan-content-pack-shard-v1';
const HEX64 = /^[a-f0-9]{64}$/;
const SHARD_ID = /^[a-z0-9_]+(?:\.[0-9]+)?$/;
const SHARD_FILE = /^[a-z0-9_]+(?:\.[0-9]+)?\.[a-f0-9]{16}\.json$/;

export interface ContentPackManifest {
  schema: typeof MANIFEST_SCHEMA;
  language: string;
  sourceHash: string;
  keys: number;
  fields: Record<string, string[]>;
  shards: Record<string, { file: string; sha256: string; count: number; bytes?: number }>;
}
export interface PackStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}
export interface ContentPackDeps {
  baseUrl: string;
  languages: readonly string[];
  /** Resolves with the response body (text, or already-parsed JSON from a native bridge). Rejects on HTTP/network error. */
  fetchPack(url: string, options: { fresh: boolean; timeoutMs: number }): Promise<unknown>;
  store: PackStore;
  sha256Hex(text: string): Promise<string>;
  hot?: { read(language: string): string[]; write(language: string, ids: string[]): void };
  now?: () => number;
}

/** Same canonical form as the build (object keys in code-unit order). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, (item as Record<string, unknown>)[key]])) : item);
}
export function keyBucket(key: string, buckets: number): number {
  if (buckets <= 1) return 0;
  const value = parseInt(key.slice(key.lastIndexOf(':') + 1).slice(0, 8), 16);
  return Number.isFinite(value) ? value % buckets : 0;
}
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function parseManifest(value: unknown, language: string): ContentPackManifest | null {
  const data = typeof value === 'string' ? safeParse(value) : value;
  if (!isRecord(data) || data.schema !== MANIFEST_SCHEMA || data.language !== language || typeof data.sourceHash !== 'string' || !HEX64.test(data.sourceHash)
    || !isRecord(data.fields) || !isRecord(data.shards)) return null;
  const shards = data.shards as Record<string, unknown>;
  for (const [id, meta] of Object.entries(shards)) {
    if (!SHARD_ID.test(id) || !isRecord(meta) || typeof meta.file !== 'string' || !SHARD_FILE.test(meta.file)
      || typeof meta.sha256 !== 'string' || !HEX64.test(meta.sha256) || !meta.file.startsWith(`${id}.${meta.sha256.slice(0, 16)}.`)) return null;
  }
  for (const ids of Object.values(data.fields as Record<string, unknown>)) {
    if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(shards, id))) return null;
  }
  return data as unknown as ContentPackManifest;
}
function safeParse(text: string): unknown { try { return JSON.parse(text); } catch { return undefined; } }

type ShardState = { sha256: string; values: Record<string, unknown> };
type LanguageState = {
  manifest?: ContentPackManifest;
  manifestText?: string;
  prepared?: Promise<void>;
  revalidation?: Promise<void>;
  revalidated: boolean;
  manifestFailedUntil: number;
  shards: Map<string, ShardState>;
  loading: Map<string, Promise<void>>;
  failedUntil: Map<string, number>;
  failures: Map<string, number>;
  wantedKeys: Set<string>;
  hot: string[];
};
const MANIFEST_TIMEOUT = 15000, SHARD_TIMEOUT = 20000, MAX_WANTED = 5000, MAX_HOT = 64;
const backoff = (failures: number) => Math.min(10 * 60_000, 15_000 * 2 ** Math.max(0, failures - 1));

export function createContentPackLoader(deps: ContentPackDeps) {
  const now = deps.now ?? (() => Date.now());
  const states = new Map<string, LanguageState>();
  const listeners = new Set<() => void>();
  let version = 0, missed = false;
  const supported = (language: string) => (deps.languages as readonly string[]).includes(language);
  const base = deps.baseUrl.replace(/\/$/, '');

  function state(language: string): LanguageState {
    let item = states.get(language);
    if (!item) {
      item = { revalidated: false, manifestFailedUntil: 0, shards: new Map(), loading: new Map(), failedUntil: new Map(), failures: new Map(), wantedKeys: new Set(), hot: [] };
      try { item.hot = deps.hot?.read(language).filter(id => SHARD_ID.test(id)).slice(0, MAX_HOT) ?? []; } catch { item.hot = []; }
      states.set(language, item);
    }
    return item;
  }
  function notify() {
    if (!missed) return;
    missed = false; version++;
    for (const listener of [...listeners]) { try { listener(); } catch { /* listener errors stay local */ } }
  }
  function rememberHot(language: string, item: LanguageState, id: string) {
    if (item.hot[0] === id) return;
    item.hot = [id, ...item.hot.filter(value => value !== id)].slice(0, MAX_HOT);
    try { deps.hot?.write(language, item.hot); } catch { /* optional */ }
  }

  function setShard(language: string, item: LanguageState, id: string, text: string, sha256: string): boolean {
    const data = safeParse(text);
    if (!isRecord(data) || data.schema !== SHARD_SCHEMA || data.language !== language || data.shard !== id || !isRecord(data.values)) return false;
    item.shards.set(id, { sha256, values: data.values });
    return true;
  }

  function requestShard(language: string, id: string): Promise<void> {
    const item = state(language), meta = item.manifest?.shards[id];
    if (!meta) return Promise.resolve();
    if (item.shards.get(id)?.sha256 === meta.sha256) return Promise.resolve();
    const running = item.loading.get(id);
    if (running) return running;
    if ((item.failedUntil.get(id) ?? 0) > now()) return Promise.resolve();
    const storeKey = `s:${language}:${id}`;
    const operation = (async () => {
      const cached = await deps.store.get(storeKey).catch(() => undefined);
      if (cached !== undefined) {
        const hash = await deps.sha256Hex(cached);
        // An older cached revision is still correct for every key it holds (keys bind
        // the exact source text), so it is served while the current one downloads.
        const current = hash === meta.sha256;
        if ((current || !item.shards.has(id)) && setShard(language, item, id, cached, hash)) {
          notify();
          if (current) return;
        }
      }
      let body: unknown;
      try {
        body = await deps.fetchPack(`${base}/content-packs/${language}/${meta.file}`, { fresh: false, timeoutMs: SHARD_TIMEOUT });
      } catch (error) {
        // The deploy may have replaced this shard: refresh a cache-only manifest once.
        if (!item.revalidated) void revalidate(language);
        throw error;
      }
      const parsed = typeof body === 'string' ? safeParse(body) : body;
      if (parsed === undefined) throw new Error('CONTENT_PACK_SHARD_INVALID');
      const text = canonicalJson(parsed), hash = await deps.sha256Hex(text);
      if (hash !== meta.sha256 || !setShard(language, item, id, text, hash)) throw new Error('CONTENT_PACK_SHARD_INVALID');
      item.failures.delete(id); item.failedUntil.delete(id);
      await deps.store.set(storeKey, text).catch(() => {});
      notify();
    })().then(() => true, () => {
      const failures = (item.failures.get(id) ?? 0) + 1;
      item.failures.set(id, failures); item.failedUntil.set(id, now() + backoff(failures));
      return false;
    }).then(succeeded => {
      item.loading.delete(id);
      // The manifest may have been revalidated while this (older) revision loaded.
      const latest = item.manifest?.shards[id];
      if (succeeded && latest && latest.sha256 !== meta.sha256) void requestShard(language, id);
    });
    item.loading.set(id, operation);
    return operation;
  }

  function shardForKey(manifest: ContentPackManifest, key: string): string | undefined {
    const field = key.split(':').slice(-2)[0];
    const ids = Object.prototype.hasOwnProperty.call(manifest.fields, field) ? manifest.fields[field] : undefined;
    return ids ? ids[keyBucket(key, ids.length)] : undefined;
  }

  function useManifest(language: string, item: LanguageState, manifest: ContentPackManifest, text: string) {
    item.manifest = manifest; item.manifestText = text;
    const wanted = [...item.wantedKeys]; item.wantedKeys.clear();
    const ids = new Set<string>();
    for (const key of wanted) { const id = shardForKey(manifest, key); if (id) ids.add(id); }
    // Refresh shards already in use whose revision changed.
    for (const [id, shard] of item.shards) if (manifest.shards[id] && manifest.shards[id].sha256 !== shard.sha256) ids.add(id);
    for (const id of ids) void requestShard(language, id);
    return [...ids];
  }

  function revalidate(language: string): Promise<void> {
    const item = state(language);
    if (item.revalidation) return item.revalidation;
    if (item.manifestFailedUntil > now()) return Promise.resolve();
    item.revalidation = (async () => {
      const body = await deps.fetchPack(`${base}/content-packs/${language}/manifest.json`, { fresh: true, timeoutMs: MANIFEST_TIMEOUT });
      const manifest = parseManifest(body, language);
      if (!manifest) throw new Error('CONTENT_PACK_MANIFEST_INVALID');
      item.revalidated = true;
      const text = canonicalJson(manifest);
      if (text === item.manifestText) return;
      useManifest(language, item, manifest, text);
      await deps.store.set(`m:${language}`, text).catch(() => {});
      // Drop cached shards that this revision no longer lists.
      const keys = await deps.store.keys(`s:${language}:`).catch(() => [] as string[]);
      await Promise.all(keys.filter(key => !manifest.shards[key.slice(`s:${language}:`.length)]).map(key => deps.store.delete(key).catch(() => {})));
    })().catch(() => { item.manifestFailedUntil = now() + 30_000; })
      .finally(() => { item.revalidation = undefined; });
    return item.revalidation;
  }

  /** Never rejects and never needs to be awaited before rendering. Resolves once the
   * cached manifest and recently used shards are in memory (or the first download ended). */
  function prepare(language: string): Promise<void> {
    if (!supported(language)) return Promise.resolve();
    const item = state(language);
    if (item.prepared) {
      if (!item.manifest) void revalidate(language); // e.g. offline at launch, online now
      return item.prepared;
    }
    item.prepared = (async () => {
      const text = await deps.store.get(`m:${language}`).catch(() => undefined);
      const manifest = text !== undefined ? parseManifest(text, language) : null;
      if (manifest && !item.manifest) useManifest(language, item, manifest, canonicalJson(manifest));
      const network = item.revalidated ? Promise.resolve() : revalidate(language);
      if (!item.manifest) await network;
      if (item.manifest) await Promise.all(item.hot.filter(id => item.manifest!.shards[id]).map(id => requestShard(language, id)));
    })().catch(() => {});
    return item.prepared;
  }

  function lookup(row: Record<string, unknown>, field: string, language: string): unknown {
    if (!supported(language)) return undefined;
    const item = state(language);
    const key = contentTranslationKey(row, field);
    if (!key) return undefined;
    if (!item.manifest) {
      if (item.wantedKeys.size < MAX_WANTED) item.wantedKeys.add(key);
      missed = true;
      if (typeof window !== 'undefined') void prepare(language);
      return undefined;
    }
    const id = shardForKey(item.manifest, key);
    if (!id) return undefined;
    const shard = item.shards.get(id);
    if (!shard || shard.sha256 !== item.manifest.shards[id].sha256) {
      if (!shard) missed = true;
      rememberHot(language, item, id);
      void requestShard(language, id);
    }
    return shard && Object.prototype.hasOwnProperty.call(shard.values, key) ? shard.values[key] : undefined;
  }

  /** Retry what failed (e.g. on the browser "online" event). */
  function retry() {
    for (const [language, item] of states) {
      item.manifestFailedUntil = 0; item.failedUntil.clear();
      if (!item.manifest || !item.revalidated) void revalidate(language);
      for (const id of item.failures.keys()) void requestShard(language, id);
    }
  }
  /** Test helper: settles every in-flight load. */
  async function settled(language: string) {
    const item = state(language);
    for (let round = 0; round < 10; round++) {
      const work = [...item.loading.values(), ...(item.revalidation ? [item.revalidation] : [])];
      if (!work.length) return;
      await Promise.all(work);
    }
  }

  return {
    prepare, lookup, retry, settled,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getVersion: () => version,
  };
}

/** IndexedDB key/value store (WKWebView / Android WebView / browsers). */
export function createIndexedDbStore(name = 'anacan-content-packs'): PackStore | null {
  const factory = typeof indexedDB !== 'undefined' ? indexedDB : undefined;
  if (!factory) return null;
  let opening: Promise<IDBDatabase> | null = null;
  const open = () => opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('kv'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = null; reject(request.error); };
  });
  const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('kv', mode), request = action(transaction.objectStore('kv'));
      transaction.oncomplete = () => resolve(request.result as T);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  };
  return {
    get: key => run<unknown>('readonly', store => store.get(key)).then(value => typeof value === 'string' ? value : undefined),
    set: (key, value) => run('readwrite', store => store.put(value, key)).then(() => undefined),
    delete: key => run('readwrite', store => store.delete(key)).then(() => undefined),
    keys: prefix => run<IDBValidKey[]>('readonly', store => store.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`)))
      .then(keys => keys.filter((key): key is string => typeof key === 'string')),
  };
}

export function createMemoryStore(initial: Record<string, string> = {}): PackStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async key => data.get(key),
    set: async (key, value) => { data.set(key, value); },
    delete: async key => { data.delete(key); },
    keys: async prefix => [...data.keys()].filter(key => key.startsWith(prefix)),
  };
}

import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { canonicalJson, createContentPackLoader, createMemoryStore, parseManifest, type ContentPackDeps } from './content-packs';
import { buildLanguagePacks } from '../../scripts/i18n/content-packs.mjs';
import { contentTranslationKey } from '../../scripts/i18n/content-translation-core.mjs';

const sha = async (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const row = { id: 'row-1', description: 'Source text: 3 mg', description_en: 'Source text: 3 mg' };
const titleRow = { id: 'row-2', title: 'Pregnancy week' };
const key = contentTranslationKey(row, 'description')!;
const titleKey = contentTranslationKey(titleRow, 'title')!;
const bundle = (values: Record<string, unknown> = { [key]: 'Texte source : 3 mg', [titleKey]: 'Semaine de grossesse' }) =>
  ({ schema: 'anacan-content-translations-v1', language: 'fr', sourceHash: 'a'.repeat(64), values });
const server = (files: { path: string; text: string }[]) => new Map(files.map(file => [`https://app.anacan.az/content-packs/${file.path}`, file.text]));

function setup(files = buildLanguagePacks(bundle()).files, store = createMemoryStore()) {
  const remote = server(files);
  let online = true;
  const fetchPack = vi.fn<ContentPackDeps['fetchPack']>(async url => {
    if (!online) throw new Error('offline');
    const text = remote.get(url);
    if (text === undefined) throw new Error('404');
    return text;
  });
  let clock = 0;
  const hotList: Record<string, string[]> = {};
  const loader = createContentPackLoader({ baseUrl: 'https://app.anacan.az', languages: ['fr', 'ky'], fetchPack, store, sha256Hex: sha,
    now: () => clock, hot: { read: language => hotList[language] ?? [], write: (language, ids) => { hotList[language] = ids; } } });
  return { loader, fetchPack, store, remote, hotList, setOnline: (value: boolean) => { online = value; }, advance: (ms: number) => { clock += ms; } };
}

describe('content pack loader', () => {
  it('serves nothing until ready, downloads only the needed shard, then notifies once', async () => {
    const { loader, fetchPack } = setup();
    const listener = vi.fn();
    loader.subscribe(listener);
    expect(loader.lookup(row, 'description', 'fr')).toBeUndefined(); // non-blocking: fallback first
    await loader.prepare('fr'); await loader.settled('fr');
    expect(loader.lookup(row, 'description', 'fr')).toBe('Texte source : 3 mg');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(loader.getVersion()).toBe(1);
    // manifest + the one shard holding the waited key
    expect(fetchPack.mock.calls.map(([url]) => url.split('/').pop())).toEqual(['manifest.json', expect.stringMatching(/^_misc\.0\.[a-f0-9]{16}\.json$/)]);
    expect(loader.lookup({ ...row, description: 'Edited source' }, 'description', 'fr')).toBeUndefined(); // source-bound
    expect(loader.lookup(row, 'description', 'de')).toBeUndefined();
  });

  it('reuses the durable cache offline (cache hit, no network)', async () => {
    const first = setup();
    await first.loader.prepare('fr'); first.loader.lookup(row, 'description', 'fr'); await first.loader.settled('fr');
    expect([...first.store.data.keys()].sort()).toEqual(['m:fr', expect.stringMatching(/^s:fr:_misc\.0$/)]);
    const second = setup(undefined, first.store);
    second.setOnline(false);
    second.hotList.fr = first.hotList.fr; // shards used last session are preloaded
    await second.loader.prepare('fr');
    expect(second.loader.lookup(row, 'description', 'fr')).toBe('Texte source : 3 mg');
    expect(second.fetchPack).toHaveBeenCalledTimes(1); // only the failed manifest revalidation
  });

  it('offline without cache falls back and recovers on retry', async () => {
    const { loader, setOnline, fetchPack } = setup();
    setOnline(false);
    await loader.prepare('fr');
    expect(loader.lookup(row, 'description', 'fr')).toBeUndefined();
    setOnline(true); loader.retry(); await loader.settled('fr');
    expect(fetchPack.mock.calls.length).toBeGreaterThan(1);
    expect(loader.lookup(row, 'description', 'fr')).toBe('Texte source : 3 mg');
  });

  it('rejects a shard whose hash does not match the manifest and does not cache it', async () => {
    const files = buildLanguagePacks(bundle()).files.map(file => file.path.endsWith('manifest.json') ? file
      : { ...file, text: file.text.replace('Texte source : 3 mg', 'Tampered') });
    const { loader, store } = setup(files);
    await loader.prepare('fr'); loader.lookup(row, 'description', 'fr'); await loader.settled('fr');
    expect(loader.lookup(row, 'description', 'fr')).toBeUndefined();
    expect([...store.data.keys()]).toEqual(['m:fr']);
  });

  it('rejects an invalid or foreign manifest', async () => {
    const { manifest } = buildLanguagePacks(bundle());
    expect(parseManifest(canonicalJson(manifest), 'fr')).not.toBeNull();
    expect(parseManifest(canonicalJson(manifest), 'es')).toBeNull();
    const traversal = { ...manifest, shards: { ...manifest.shards, '_misc.0': { ...manifest.shards['_misc.0'], file: '../../x.json' } } };
    expect(parseManifest(traversal, 'fr')).toBeNull();
    const files = buildLanguagePacks(bundle()).files.map(file => file.path.endsWith('manifest.json') ? { ...file, text: '{"schema":"x"}' } : file);
    const { loader } = setup(files);
    await loader.prepare('fr'); loader.lookup(row, 'description', 'fr'); await loader.settled('fr');
    expect(loader.lookup(row, 'description', 'fr')).toBeUndefined();
  });

  it('accepts JSON already parsed by a native bridge (hash is over canonical JSON)', async () => {
    const files = buildLanguagePacks(bundle()).files;
    const { loader, fetchPack, remote } = setup(files);
    fetchPack.mockImplementation(async url => {
      const parsed = JSON.parse(remote.get(url)!);
      // re-ordered keys, like a native dictionary round trip
      return Object.fromEntries(Object.entries(parsed).reverse());
    });
    await loader.prepare('fr'); loader.lookup(titleRow, 'title', 'fr'); await loader.settled('fr');
    expect(loader.lookup(titleRow, 'title', 'fr')).toBe('Semaine de grossesse');
  });

  it('keeps serving a cached older shard while a new revision downloads, and prunes removed shards', async () => {
    const first = setup();
    await first.loader.prepare('fr'); first.loader.lookup(row, 'description', 'fr'); await first.loader.settled('fr');
    await first.store.set('s:fr:gone', 'x');
    const newer = buildLanguagePacks(bundle({ [key]: 'Texte source : 3 mg', [titleKey]: 'Semaine', [`${'row-3'}:title:${'b'.repeat(64)}`]: 'Nouveau' })).files;
    const second = setup(newer, first.store);
    second.hotList.fr = first.hotList.fr;
    await second.loader.prepare('fr'); await second.loader.settled('fr');
    expect(second.loader.lookup(row, 'description', 'fr')).toBe('Texte source : 3 mg');
    expect(second.loader.lookup(titleRow, 'title', 'fr')).toBe('Semaine');
    expect(second.store.data.has('s:fr:gone')).toBe(false);
  });

  it('backs off after a failed shard instead of hammering the server', async () => {
    const { loader, fetchPack, remote, advance } = setup();
    await loader.prepare('fr');
    for (const url of [...remote.keys()]) if (!url.endsWith('manifest.json')) remote.delete(url);
    loader.lookup(row, 'description', 'fr'); await loader.settled('fr');
    const calls = fetchPack.mock.calls.length;
    loader.lookup(row, 'description', 'fr'); await loader.settled('fr');
    expect(fetchPack.mock.calls.length).toBe(calls);
    advance(60_000);
    loader.lookup(row, 'description', 'fr'); await loader.settled('fr');
    expect(fetchPack.mock.calls.length).toBeGreaterThan(calls);
  });
});

import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLanguagePacks, canonicalJson, keyBucket, writeContentPacks, contentPacksPlugin } from '../../scripts/i18n/content-packs.mjs';
import { keyBucket as runtimeKeyBucket, canonicalJson as runtimeCanonical, parseManifest } from './content-packs';

const hex = (seed: number) => createHash('sha256').update(String(seed)).digest('hex');
function fixture(language = 'fr') {
  const values: Record<string, unknown> = {};
  for (let index = 0; index < 400; index++) values[`id-${index}:info:${hex(index)}`] = 'x'.repeat(2000) + index; // ~800 KB -> split
  values[`id-a:title:${hex(1000)}`] = 'Titre'; values[`id-b:tags:${hex(1001)}`] = ['Un', 'Deux'];
  return { schema: 'anacan-content-translations-v1', language, sourceHash: 'c'.repeat(64), values };
}

describe('content pack emitter', () => {
  it('shards by field, splits large fields into hash buckets and groups small fields', () => {
    const { manifest, files } = buildLanguagePacks(fixture());
    expect(manifest.fields.info.length).toBe(4);
    expect(manifest.fields.title).toEqual(['_misc.0']); expect(manifest.fields.tags).toEqual(['_misc.0']);
    expect(parseManifest(manifest, 'fr')).not.toBeNull();
    const shards = files.filter(file => !file.path.endsWith('manifest.json'));
    let total = 0;
    for (const file of shards) {
      const data = JSON.parse(file.text);
      const meta = manifest.shards[data.shard];
      expect(file.path).toBe(`fr/${meta.file}`);
      expect(createHash('sha256').update(file.text).digest('hex')).toBe(meta.sha256);
      expect(runtimeCanonical(data)).toBe(file.text); // runtime recomputes the identical canonical text
      for (const key of Object.keys(data.values)) {
        const field = key.split(':')[1], ids = manifest.fields[field];
        expect(ids[runtimeKeyBucket(key, ids.length)]).toBe(data.shard); // runtime routes every key to its shard
        expect(keyBucket(key, ids.length)).toBe(runtimeKeyBucket(key, ids.length));
      }
      total += Object.keys(data.values).length;
    }
    expect(total).toBe(402);
    expect(manifest.keys).toBe(402);
  });

  it('is deterministic and content-addressed', () => {
    const a = buildLanguagePacks(fixture()), b = buildLanguagePacks(fixture());
    expect(a.files).toEqual(b.files);
    const changed = fixture(); changed.values[`id-a:title:${hex(1000)}`] = 'Autre';
    const c = buildLanguagePacks(changed);
    expect(c.manifest.shards['_misc.0'].sha256).not.toBe(a.manifest.shards['_misc.0'].sha256);
    expect(c.manifest.shards['info.0'].sha256).toBe(a.manifest.shards['info.0'].sha256); // unchanged shards keep their URL
    expect(canonicalJson({ b: 1, a: { d: 1, c: 2 } })).toBe('{"a":{"c":2,"d":1},"b":1}');
  });

  it('rejects malformed bundles', () => {
    expect(() => buildLanguagePacks({ ...fixture(), schema: 'x' })).toThrow('CONTENT_PACK_BUNDLE_INVALID');
    expect(() => buildLanguagePacks({ ...fixture(), values: { 'no-field': 'x' } })).toThrow('CONTENT_PACK_KEY_INVALID');
  });

  it('writes packs to a directory and the Vite plugin skips native builds', async () => {
    const source = await mkdtemp(join(tmpdir(), 'packs-src-')), out = await mkdtemp(join(tmpdir(), 'packs-out-'));
    try {
      await writeFile(join(source, 'fr.json'), JSON.stringify(fixture()));
      expect(await writeContentPacks(out, { directory: source })).toEqual({ fr: { shards: 5, keys: 402 } });
      const names = await readdir(join(out, 'fr'));
      expect(names).toContain('manifest.json'); expect(names.length).toBe(6);
      expect(JSON.parse(await readFile(join(out, 'fr', 'manifest.json'), 'utf8')).schema).toBe('anacan-content-pack-manifest-v1');
      const emitted: string[] = [];
      const context = { emitFile: (file: { fileName: string }) => { emitted.push(file.fileName); } };
      const web = contentPacksPlugin({ directory: source }); web.configResolved({ env: { VITE_NATIVE_BUILD: 'false' } });
      await web.generateBundle.call(context);
      expect(emitted).toHaveLength(6); expect(emitted.every(name => name.startsWith('content-packs/fr/'))).toBe(true);
      emitted.length = 0;
      const native = contentPacksPlugin({ directory: source }); native.configResolved({ env: { VITE_NATIVE_BUILD: 'true' } });
      await native.generateBundle.call(context);
      expect(emitted).toHaveLength(0);
    } finally { await rm(source, { recursive: true, force: true }); await rm(out, { recursive: true, force: true }); }
  });
});

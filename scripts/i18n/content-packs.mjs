// Content packs: the 16 source-bound content dictionaries (scripts/i18n/content/<lang>.json)
// are NOT part of the app bundle. They are published next to the web app as small,
// content-hashed JSON shards under /content-packs/<lang>/ and downloaded on demand
// (src/lib/content-packs.ts). Native builds emit nothing here. See docs/LOCALIZATION_25.md.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export const MANIFEST_SCHEMA = 'anacan-content-pack-manifest-v1';
export const SHARD_SCHEMA = 'anacan-content-pack-shard-v1';
export const BUNDLE_SCHEMA = 'anacan-content-translations-v1';
export const TARGET_SHARD_BYTES = 256 * 1024;
export const MAX_BUCKETS = 32;
const defaultDirectory = () => fileURLToPath(new URL('./content/', import.meta.url));

/** JSON with object keys in code-unit order. The runtime recomputes the same text
 * after parsing, so the hash does not depend on transport (native HTTP re-encodes JSON). */
export function canonicalJson(value) {
  return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');

/** Key layout is `${id}:${field}:${sha256}` (contentTranslationKey). */
export function keyField(key) { const parts = key.split(':'); return parts.length >= 3 ? parts[parts.length - 2] : null; }
/** Bucket from the key's own hash, so the runtime can pick the shard from the key alone. */
export function keyBucket(key, buckets) {
  if (buckets <= 1) return 0;
  const hash = key.slice(key.lastIndexOf(':') + 1);
  const value = parseInt(hash.slice(0, 8), 16);
  return Number.isFinite(value) ? value % buckets : 0;
}
const entryBytes = (key, value) => Buffer.byteLength(key) + Buffer.byteLength(JSON.stringify(value)) + 4;

/** Pure: one language bundle -> manifest + shard files ({ path, text }). */
export function buildLanguagePacks(bundle, { targetBytes = TARGET_SHARD_BYTES, maxBuckets = MAX_BUCKETS } = {}) {
  if (bundle?.schema !== BUNDLE_SCHEMA || !/^[a-z]{2}$/.test(bundle.language || '') || !/^[a-f0-9]{64}$/.test(bundle.sourceHash || '')
    || !bundle.values || typeof bundle.values !== 'object' || Array.isArray(bundle.values)) throw new Error('CONTENT_PACK_BUNDLE_INVALID');
  const { language } = bundle;
  const byField = new Map();
  for (const [key, value] of Object.entries(bundle.values)) {
    const field = keyField(key);
    if (!field || !/^[a-z0-9_]+$/.test(field)) throw new Error('CONTENT_PACK_KEY_INVALID');
    if (!byField.has(field)) byField.set(field, { bytes: 0, entries: [] });
    const group = byField.get(field); group.entries.push([key, value]); group.bytes += entryBytes(key, value);
  }
  const shardValues = new Map(); // shardId -> values
  const fields = {};
  const small = [];
  for (const field of [...byField.keys()].sort()) {
    const group = byField.get(field);
    if (group.bytes < targetBytes / 8) { small.push(field); continue; }
    let buckets = 1;
    while (buckets < maxBuckets && group.bytes / buckets > targetBytes) buckets *= 2;
    const ids = Array.from({ length: buckets }, (_, index) => buckets === 1 ? field : `${field}.${index}`);
    for (const id of ids) shardValues.set(id, {});
    for (const [key, value] of group.entries) shardValues.get(ids[keyBucket(key, buckets)])[key] = value;
    fields[field] = ids;
  }
  // Small fields share "_misc.N" shards (greedy, sorted, so ids are stable for the same content).
  let misc = -1, miscBytes = Infinity;
  for (const field of small) {
    const group = byField.get(field);
    if (miscBytes + group.bytes > targetBytes) { misc++; miscBytes = 0; shardValues.set(`_misc.${misc}`, {}); }
    const id = `_misc.${misc}`;
    for (const [key, value] of group.entries) shardValues.get(id)[key] = value;
    miscBytes += group.bytes; fields[field] = [id];
  }
  const files = [], shards = {};
  for (const [id, values] of [...shardValues].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const text = canonicalJson({ schema: SHARD_SCHEMA, language, shard: id, values });
    const hash = sha256(text), file = `${id}.${hash.slice(0, 16)}.json`;
    shards[id] = { file, sha256: hash, count: Object.keys(values).length, bytes: Buffer.byteLength(text) };
    files.push({ path: `${language}/${file}`, text });
  }
  const manifest = { schema: MANIFEST_SCHEMA, language, sourceHash: bundle.sourceHash,
    keys: Object.keys(bundle.values).length, fields, shards };
  const manifestText = canonicalJson(manifest);
  files.push({ path: `${language}/manifest.json`, text: manifestText });
  return { manifest, files };
}

async function readBundles(directory) {
  const names = (await readdir(directory)).filter(name => /^[a-z]{2}\.json$/.test(name)).sort();
  return Promise.all(names.map(async name => {
    const bundle = JSON.parse(await readFile(join(directory, name), 'utf8'));
    if (bundle.language !== basename(name, '.json')) throw new Error('CONTENT_PACK_BUNDLE_INVALID');
    return bundle;
  }));
}

/** Writes <outDir>/<lang>/manifest.json and shards; returns a summary. */
export async function writeContentPacks(outDir, { directory = defaultDirectory() } = {}) {
  const summary = {};
  for (const bundle of await readBundles(directory)) {
    const { manifest, files } = buildLanguagePacks(bundle);
    await mkdir(join(outDir, bundle.language), { recursive: true });
    for (const file of files) await writeFile(join(outDir, file.path), file.text);
    summary[bundle.language] = { shards: Object.keys(manifest.shards).length, keys: manifest.keys };
  }
  return summary;
}

const isNativeBuild = env => (env?.VITE_NATIVE_BUILD ?? process.env.VITE_NATIVE_BUILD) === 'true';

/** Vite: web builds emit dist/content-packs/**; native builds emit nothing (packs are
 * downloaded from https://app.anacan.az/content-packs/). Dev serves them from memory. */
export function contentPacksPlugin({ directory = defaultDirectory() } = {}) {
  let native = false;
  const devCache = new Map();
  const devFiles = language => {
    if (!devCache.has(language)) devCache.set(language, readFile(join(directory, `${language}.json`), 'utf8')
      .then(text => new Map(buildLanguagePacks(JSON.parse(text)).files.map(file => [file.path, file.text]))));
    return devCache.get(language);
  };
  return {
    name: 'anacan-content-packs',
    configResolved(config) { native = isNativeBuild(config.env); },
    configureServer(server) {
      server.middlewares.use('/content-packs/', (req, res, next) => {
        const match = /^\/([a-z]{2})\/([A-Za-z0-9_.-]+\.json)$/.exec((req.url || '').split('?')[0]);
        if (!match) return next();
        devFiles(match[1]).then(files => {
          const text = files.get(`${match[1]}/${match[2]}`);
          if (text === undefined) { res.statusCode = 404; res.end(); return; }
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(text);
        }).catch(() => { devCache.delete(match[1]); res.statusCode = 404; res.end(); });
      });
    },
    async generateBundle() {
      if (native) return;
      for (const bundle of await readBundles(directory)) {
        for (const file of buildLanguagePacks(bundle).files) this.emitFile({ type: 'asset', fileName: `content-packs/${file.path}`, source: file.text });
      }
    },
  };
}

// CLI: node scripts/i18n/content-packs.mjs <outDir>   (e.g. to publish packs without a web build)
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const outDir = process.argv[2];
  if (!outDir) { console.error('usage: node scripts/i18n/content-packs.mjs <outDir>'); process.exit(1); }
  console.log(JSON.stringify(await writeContentPacks(resolve(outDir))));
}

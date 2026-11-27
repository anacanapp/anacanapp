#!/usr/bin/env node
// Determinism check: compare two runs shot-by-shot (sha256 from index.json; pixel diff via sharp when available).
// Usage: node tools/reference-shots/compare.mjs <runA> <runB> [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const HERE = new URL('.', import.meta.url).pathname;
const [a, b] = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
if (!a || !b) { console.error('usage: compare.mjs <runA> <runB>'); process.exit(2); }
const load = (run) => JSON.parse(readFileSync(join(HERE, 'out', run, 'index.json'), 'utf8'));
const A = load(a), B = load(b);
const mapB = new Map(B.shots.map((s) => [s.file, s]));

let sharp = null;
try { sharp = createRequire(join(HERE, '../../package.json'))('sharp'); } catch { /* hash-only */ }

async function pixelDiff(file) {
  if (!sharp) return null;
  const [x, y] = await Promise.all([a, b].map((run) => sharp(join(HERE, 'out', run, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) return { sizeMismatch: true };
  let changed = 0, minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  const w = x.info.width;
  for (let i = 0; i < x.data.length; i += 4) {
    if (x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2]) {
      changed++; const p = i / 4, px = p % w, py = Math.floor(p / w);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  }
  return { changed, ratio: changed / (x.data.length / 4), bbox: changed ? [minX, minY, maxX, maxY] : null };
}

const diffs = [], missing = [];
let same = 0;
for (const s of A.shots) {
  const t = mapB.get(s.file);
  if (!t) { missing.push(s.file); continue; }
  if (t.sha256 === s.sha256) { same++; continue; }
  diffs.push({ file: s.file, ...(await pixelDiff(s.file)) });
}
const compared = same + diffs.length;
console.log(`${compared} shots compared: ${same} identical, ${diffs.length} different (${(100 * diffs.length / Math.max(1, compared)).toFixed(2)}% flake), ${missing.length} missing in ${b}`);
for (const d of diffs) console.log(`  ${d.file}  ${d.changed ?? '?'} px (${((d.ratio ?? 0) * 100).toFixed(3)}%) bbox=${JSON.stringify(d.bbox)}`);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ a, b, compared, same, diffs, missing }, null, 2));

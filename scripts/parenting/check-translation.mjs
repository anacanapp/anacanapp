// npx vite-node scripts/parenting/check-translation.mjs <lang>
// Compares src/data/parenting/<lang>/ with the Azerbaijani original: same ids, same structure (array lengths,
// keys), same {placeholders}, sources kept identical (who/year/title are not translated), no Azerbaijani-only letters left.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const lang = process.argv[2];
if (!lang) { console.error('usage: <lang>'); process.exit(2); }
const load = async (l) => (await import(pathToFileURL(resolve('src/data/parenting', l, 'index.ts')).href)).default;
const az = await load('az'), tr = await load(lang);
const errors = [];
const walk = (a, b, path) => {
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return errors.push(`${path}: expected array`);
    if (a.length !== b.length) errors.push(`${path}: length ${a.length} vs ${b.length}`);
    a.forEach((x, i) => walk(x, b[i], `${path}[${i}]`));
  } else if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object') return errors.push(`${path}: expected object`);
    const ka = Object.keys(a).sort().join(','), kb = Object.keys(b).sort().join(',');
    if (ka !== kb) errors.push(`${path}: keys ${ka} vs ${kb}`);
    for (const k of Object.keys(a)) {
      if (/^(id|band|bands|area|areas|emoji|premium|free|day|days|minAge|maxAge|kind|type|value|score|scores|weight|tags?)$/.test(k) && JSON.stringify(a[k]) !== JSON.stringify(b?.[k])) errors.push(`${path}.${k}: changed (${JSON.stringify(a[k])} -> ${JSON.stringify(b?.[k])})`);
      walk(a[k], b?.[k], `${path}.${k}`);
    }
  } else if (typeof a === 'string') {
    if (typeof b !== 'string') return errors.push(`${path}: expected string`);
    const ph = (s) => (s.match(/\{[a-z]+\}/g) || []).sort().join(',');
    if (ph(a) !== ph(b)) errors.push(`${path}: placeholders ${ph(a)} vs ${ph(b)}`);
    if (/\.sources\[\d+\]\.(who|year|title)$/.test(path) && a !== b) errors.push(`${path}: source changed`);
    if (!/\.sources\[/.test(path) && !['tr', 'uz'].includes(lang) && /[əƏ]/.test(b)) errors.push(`${path}: Azerbaijani ə left`);
    if (b.trim() === '' && a.trim() !== '') errors.push(`${path}: empty`);
  } else if (a !== b && typeof a !== 'undefined') errors.push(`${path}: value changed`);
};
walk(az, tr, lang);
console.log(errors.length ? errors.slice(0, 40).join('\n') + `\n${errors.length} problem(s)` : `OK ${lang}`);
process.exit(errors.length ? 1 : 0);

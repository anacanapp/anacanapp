#!/usr/bin/env node
// Checks src/data/kid-exercises/<lang>.json against the Azerbaijani source (keys, counts, placeholders, dashes).
// Usage: node scripts/check-kid-exercises-locale.mjs en [ru ...]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'kid-exercises');
const az = JSON.parse(readFileSync(join(dir, 'az.json'), 'utf8'));
const uiSrc = readFileSync(join(dir, 'ui-az.ts'), 'utf8');
const uiKeys = [...uiSrc.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
const groups = [...new Set(az.exercises.map((e) => e.group))];

let failed = 0;
for (const lang of process.argv.slice(2)) {
  const errors = [];
  let loc;
  try { loc = JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8')); } catch (e) { console.log(`${lang}: cannot read/parse: ${e.message}`); failed++; continue; }
  const text = (v) => typeof v === 'string' && v.trim().length > 0;
  for (const k of uiKeys) if (!text(loc.ui?.[k])) errors.push(`ui.${k} missing`);
  for (const k of Object.keys(loc.ui ?? {})) if (!uiKeys.includes(k)) errors.push(`ui.${k} unknown`);
  for (const k of ['count', 'doneCount']) if (loc.ui?.[k] && !loc.ui[k].includes('{n}')) errors.push(`ui.${k} lost {n}`);
  if (loc.ui?.ageFor && !loc.ui.ageFor.includes('{name}')) errors.push('ui.ageFor lost {name}');
  for (const s of az.sets) {
    const t = loc.sets?.[s.id];
    if (!t || !text(t.label) || !text(t.months)) { errors.push(`sets.${s.id} missing`); continue; }
    if (!Array.isArray(t.rules) || t.rules.length !== s.rules.length || !t.rules.every(text)) errors.push(`sets.${s.id}.rules count ${t.rules?.length} != ${s.rules.length}`);
  }
  for (const g of groups) if (!text(loc.groups?.[g])) errors.push(`groups["${g}"] missing`);
  for (const e of az.exercises) {
    const t = loc.exercises?.[e.id];
    if (!t) { errors.push(`exercises.${e.id} missing`); continue; }
    for (const k of ['title', 'age', 'how', 'duration', 'benefit']) if (!text(t[k])) errors.push(`exercises.${e.id}.${k} missing`);
    if (e.caution && !text(t.caution)) errors.push(`exercises.${e.id}.caution missing`);
    if (!e.caution && t.caution) errors.push(`exercises.${e.id}.caution extra`);
    const nums = (s) => (s.match(/\d+/g) ?? []).sort().join(',');
    for (const k of ['how', 'duration', 'caution']) if (e[k] && t[k] && nums(e[k]) !== nums(t[k])) errors.push(`exercises.${e.id}.${k} numbers ${nums(e[k])} vs ${nums(t[k])}`);
  }
  const extra = Object.keys(loc.exercises ?? {}).filter((id) => !az.exercises.some((e) => e.id === id));
  if (extra.length) errors.push(`unknown exercises: ${extra.join(', ')}`);
  if (JSON.stringify(loc).includes('—')) errors.push('long dash (—) used');
  console.log(errors.length ? `${lang}: ${errors.length} problem(s)\n  ${errors.slice(0, 40).join('\n  ')}` : `${lang}: ok`);
  if (errors.length) failed++;
}
process.exit(failed ? 1 : 0);

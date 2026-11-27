#!/usr/bin/env node
// Generates cross-language fixtures in app/test/domain/fixtures/ by running the ORIGINAL TypeScript (bundled with
// the repo's esbuild, see run_ts.mjs) on a spread of inputs. Reproducible: `node app/tool/domain/gen_fixtures.mjs`.
//
// Zone-dependent fixtures are produced once per zone in a child process started with that TZ and saved as
// <name>.<Zone_Name>.json; the Dart tests load the file for their own process zone (test/domain/helpers.dart).
// Zone-free fixtures are <name>.json. Dates are serialized as {"$date": epochMs} and non-finite numbers as
// {"$num": "NaN" | "Infinity" | "-Infinity"}.
import { execFileSync } from 'node:child_process';
import { transform } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appDir, loadEntry, repoDir, setSystemTime } from './run_ts.mjs';

export const ZONES = ['UTC', 'America/New_York', 'Europe/Berlin', 'Asia/Baku'];
const outDir = path.join(appDir, 'test', 'domain', 'fixtures');
const self = fileURLToPath(import.meta.url);

function save(name, zone, value) {
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, zone ? `${name}.${zone.replace(/\//g, '_')}.json` : `${name}.json`);
  writeFileSync(file, `${JSON.stringify(value)}\n`);
  console.log('wrote', path.relative(appDir, file));
}

/** Body of the first `<start> ... {` block after `marker` (brace matched, strings skipped). */
function block(source, marker) {
  const at = source.indexOf(marker);
  if (at < 0) throw new Error(`marker not found: ${marker}`);
  let i = source.indexOf('{', at + marker.length);
  const open = i;
  let depth = 0, str = null;
  for (; i < source.length; i++) {
    const c = source[i];
    if (str) { if (c === '\\') i++; else if (c === str) str = null; continue; }
    if (c === "'" || c === '"' || c === '`') { str = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  return source.slice(open + 1, i);
}

const zoneArg = process.argv.find((a) => a.startsWith('--zone='))?.slice(7);
if (zoneArg) {
  // Child: TZ is set by the parent before Node started.
  const entry = await loadEntry('fixtures');
  const all = entry.zoned((ms) => setSystemTime(ms));
  for (const [name, value] of Object.entries(all)) save(name, zoneArg, value);
  const calc = readFileSync(path.join(repoDir, 'src/components/tools/MaternityCalculator.tsx'), 'utf8');
  const hook = readFileSync(path.join(repoDir, 'src/hooks/useMaternityBenefits.ts'), 'utf8');
  const handleCalculate = block(calc, 'const handleCalculate = () =>');
  const calculateBenefit = `const calculateBenefit = (monthlySalary, pregnancyType) => {${block(hook, 'const calculateBenefit = (')}};`;
  save('maternity_calc', zoneArg, await entry.maternity(handleCalculate, calculateBenefit, transform));
} else {
  for (const zone of ZONES) {
    execFileSync(process.execPath, [self, `--zone=${zone}`], { stdio: 'inherit', env: { ...process.env, TZ: zone } });
  }
  process.env.TZ = 'UTC';
  const entry = await loadEntry('fixtures');
  for (const [name, value] of Object.entries(entry.zoneFree())) save(name, null, value);
}

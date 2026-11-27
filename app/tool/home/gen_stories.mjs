// Ported from: (tooling) — generates app/lib/features/stories/data/{stories_az,story_illustrations}.g.dart from
// src/data/stories/az.ts and src/components/stories/illustrations.ts (the original modules, bundled with the
// repo's esbuild).
//
//   node app/tool/home/gen_stories.mjs
//
// Illustrations are functions of two colours (c = theme pop, a = accent ink); they are rendered once with
// placeholder colours that the Dart side replaces. Re-running reproduces the files byte for byte.
import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(toolDir, '../..');
const repoDir = path.resolve(appDir, '..');
const outDir = path.join(appDir, 'lib/features/stories/data');

const C = '#C0C0C1';
const A = '#A0A0A1';

async function load() {
  const dir = mkdtempSync(path.join(process.env.HOME_TOOL_TMP || tmpdir(), 'anacan-home-'));
  const outfile = path.join(dir, 'stories.mjs');
  await build({
    entryPoints: [path.join(toolDir, 'entries/stories.ts')],
    bundle: true, platform: 'node', format: 'esm', target: 'node20', outfile, logLevel: 'error',
    alias: { '@': path.join(repoDir, 'src') },
  });
  return import(pathToFileURL(outfile).href);
}

const dartString = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$').replace(/\n/g, '\\n')}'`;

const m = await load();
mkdirSync(outDir, { recursive: true });
const header = (src) => `// GENERATED — do not edit; run node app/tool/home/gen_stories.mjs\n// Ported from: ${src}\n// ignore_for_file: lines_longer_than_80_chars\n\n`;

const data = { stories: m.STORIES_AZ, weeks: m.WEEKS, months: m.MONTHS, phases: m.PHASES };
writeFileSync(path.join(outDir, 'stories_az.g.dart'),
  header('src/data/stories/az.ts') + `/// STORIES_AZ, WEEKS, MONTHS, PHASES as JSON.\nconst String storiesAzJson = ${dartString(JSON.stringify(data))};\n`);

const lines = m.ILLUSTRATION_NAMES.map((n) => `  ${dartString(n)}: ${dartString(m.illustration(n, C, A).replace(/\s*\n\s*/g, ' '))},`);
writeFileSync(path.join(outDir, 'story_illustrations.g.dart'),
  header('src/components/stories/illustrations.ts') +
  `/// Placeholder colours replaced at runtime: [illustrationPop] (c) and [illustrationAccent] (a).\nconst String illustrationPop = '${C}';\nconst String illustrationAccent = '${A}';\n\n` +
  `/// ILL[name](c, a) rendered with the placeholder colours.\nconst Map<String, String> illustrationTemplates = {\n${lines.join('\n')}\n};\n`);
console.log(`stories: ${m.STORIES_AZ.length}, illustrations: ${m.ILLUSTRATION_NAMES.length}`);

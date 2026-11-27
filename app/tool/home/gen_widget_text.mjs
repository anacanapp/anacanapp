// Ported from: (tooling) — generates app/lib/features/home/data/widget_text.g.dart from src/data/widgets/*.json
// (the journey strings HomeWidgetSync needs: pregnancy_week, pregnancy_week_only, baby_size, days_left, trimester).
//
//   node app/tool/home/gen_widget_text.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(toolDir, '../..');
const repoDir = path.resolve(appDir, '..');
const KEYS = ['pregnancy_week', 'pregnancy_week_only', 'baby_size', 'days_left', 'trimester'];
const dir = path.join(repoDir, 'src/data/widgets');
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$')}'`;
const langs = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const rows = langs.map((f) => {
  const j = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
  return `  ${q(f.replace('.json', ''))}: {${KEYS.map((k) => `${q(k)}: ${q(j[k] ?? '')}`).join(', ')}},`;
});
writeFileSync(path.join(appDir, 'lib/features/home/data/widget_text.g.dart'),
  `// GENERATED — do not edit; run node app/tool/home/gen_widget_text.mjs\n// Ported from: src/data/widgets/*.json (journey keys)\n// ignore_for_file: lines_longer_than_80_chars\n\n` +
  `const Map<String, Map<String, String>> widgetJourneyText = {\n${rows.join('\n')}\n};\n`);
console.log(`widget text: ${langs.length} languages`);

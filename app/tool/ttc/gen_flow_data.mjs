#!/usr/bin/env node
// Generates the const Dart data of the flow home and the TTC section from the React sources:
//   lib/features/ttc/data/ttc_text.g.dart          ← src/data/ttc/<lang>.json (all 25 app languages)
//   lib/features/home_flow/copy/flow_copy.g.dart   ← scripts/i18n/feature37-copy.json (keys the flow/mommy-period ports use)
// Run from the repo root or anywhere:  node app/tool/ttc/gen_flow_data.mjs
// Re-running reproduces the files byte for byte.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const app = join(root, 'app');
const LANGS = ['az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et', 'tk', 'uk'];
const lit = (v) => JSON.stringify(v).replace(/\$/g, '\\$');
const dart = (v) => {
  if (typeof v === 'string') return lit(v);
  if (Array.isArray(v)) return `<Object>[${v.map(dart).join(', ')}]`;
  return `<String, Object>{${Object.entries(v).map(([k, x]) => `${lit(k)}: ${dart(x)}`).join(', ')}}`;
};

// TTC text packs (createFeatureText: own language, else en, else az).
const ttcDir = join(root, 'src/data/ttc');
const files = new Set(readdirSync(ttcDir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')));
let ttc = '// GENERATED — do not edit; run node app/tool/ttc/gen_flow_data.mjs\n';
ttc += '// Ported from: src/data/ttc/*.json\n// ignore_for_file: lines_longer_than_80_chars\n\n';
ttc += 'const Map<String, Map<String, Object>> kTtcText = {\n';
for (const lang of LANGS) {
  if (!files.has(lang)) continue;
  ttc += `  ${lit(lang)}: ${dart(JSON.parse(readFileSync(join(ttcDir, `${lang}.json`), 'utf8')))},\n`;
}
ttc += '};\n';
writeFileSync(join(app, 'lib/features/ttc/data/ttc_text.g.dart'), ttc);

// feature37 keys used by src/components/flow/*, src/components/mommy/MommyPeriodTracker.tsx.
const KEYS = ['period_banner_title', 'period_banner_body', 'period_title', 'period_body', 'period_tracking_note', 'period_days',
  'period_last', 'period_empty', 'back_mommy', 'period_card_title', 'period_start', 'period_end', 'period_continue', 'period_day_n',
  'period_ask_today', 'period_last_short', 'period_calendar', 'period_saved', 'period_failed', 'reminder_period_start',
  'reminder_period_end', 'reminder_ovulation', 'reminder_fertile_start', 'reminder_fertile_end', 'reminder_pms', 'reminder_pill',
  'cycle_anomaly_badge', 'cycle_anomaly_note', 'cycle_now', 'next_period', 'cycle_day', 'days_left', 'cycle_days',
  'period_days_short', 'forecast_default', 'forecast_learned', 'recent_cycles', 'cycle_len', 'postpartum_note'];
const langs = JSON.parse(readFileSync(join(root, 'scripts/i18n/feature37-copy.json'), 'utf8')).languages;
let copy = '// GENERATED — do not edit; run node app/tool/ttc/gen_flow_data.mjs\n';
copy += '// Ported from: scripts/i18n/feature37-copy.json (flow + mommy period keys)\n// ignore_for_file: lines_longer_than_80_chars\n\n';
copy += 'const Map<String, Map<String, String>> kFlowFeature37Copy = {\n';
for (const lang of LANGS) {
  const row = langs[lang];
  if (!row) continue;
  copy += `  ${lit(lang)}: {${KEYS.filter((k) => typeof row[k] === 'string' && row[k] !== '').map((k) => `${lit(k)}: ${lit(row[k])}`).join(', ')}},\n`;
}
copy += '};\n';
writeFileSync(join(app, 'lib/features/home_flow/copy/flow_copy.g.dart'), copy);
console.log('wrote ttc_text.g.dart, flow_copy.g.dart');

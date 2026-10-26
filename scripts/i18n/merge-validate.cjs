/**
 * i18n Merge + Validasiya — pipeline addım 3.
 *
 * chunks/*.json (mənbə) + out/{ru,tr}/*.json (tərcümələr) →
 *   - coverage: hər mənbə açarının hər dildə qarşılığı varmı
 *   - placeholder parity: AZ-dakı {x} tokenləri tərcümədə eynilə varmı
 *   - boş dəyər / AZ-identik dəyər aşkarı
 *   → ru.seed.json / tr.seed.json + report.json
 *
 * Run: node scripts/i18n/merge-validate.cjs
 */
const fs = require('fs');
const path = require('path');

const CHUNKS = path.join(__dirname, 'chunks');
const OUT = path.join(__dirname, 'out');

const placeholders = (s) => (s.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(',');

const source = new Map(); // key -> {az, en, chunk}
for (const f of fs.readdirSync(CHUNKS).filter((f) => f.endsWith('.json'))) {
  for (const row of JSON.parse(fs.readFileSync(path.join(CHUNKS, f), 'utf8'))) {
    source.set(row.key, { az: row.az, en: row.en, chunk: f });
  }
}

const report = { generatedAt: new Date().toISOString(), langs: {} };

for (const lang of ['ru', 'tr']) {
  const dir = path.join(OUT, lang);
  const merged = {};
  const issues = { missing: [], empty: [], azIdentical: [], placeholderMismatch: [], unknownKeys: [] };

  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      for (const [key, val] of Object.entries(data)) {
        if (!source.has(key)) {issues.unknownKeys.push(key);continue;}
        merged[key] = val;
      }
    }
  }

  for (const [key, src] of source) {
    const val = merged[key];
    if (val === undefined) {issues.missing.push(key);continue;}
    if (!String(val).trim()) {issues.empty.push(key);continue;}
    if (String(val).trim() === String(src.az).trim() && String(src.az).length > 3) {
      issues.azIdentical.push(key);
    }
    if (placeholders(src.az) !== placeholders(String(val))) {
      issues.placeholderMismatch.push({ key, az: placeholders(src.az), got: placeholders(String(val)) });
    }
  }

  fs.writeFileSync(path.join(__dirname, `${lang}.seed.json`), JSON.stringify(merged, null, 1), 'utf8');

  report.langs[lang] = {
    translated: Object.keys(merged).length,
    sourceTotal: source.size,
    coveragePct: Math.round(Object.keys(merged).length / source.size * 1000) / 10,
    issues: {
      missing: issues.missing.length,
      empty: issues.empty.length,
      azIdentical: issues.azIdentical.length,
      placeholderMismatch: issues.placeholderMismatch.length,
      unknownKeys: issues.unknownKeys.length
    },
    detail: {
      missingSample: issues.missing.slice(0, 20),
      empty: issues.empty,
      azIdentical: issues.azIdentical.slice(0, 30),
      placeholderMismatch: issues.placeholderMismatch,
      unknownKeys: issues.unknownKeys
    }
  };

  console.log(`${lang}: ${report.langs[lang].translated}/${source.size} (${report.langs[lang].coveragePct}%)  ` +
  `missing=${issues.missing.length} empty=${issues.empty.length} azIdent=${issues.azIdentical.length} phMismatch=${issues.placeholderMismatch.length}`);
}

fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log('→ report.json, ru.seed.json, tr.seed.json yazıldı');

/**
 * Hardcoded AZ mətn skaneri:
 *   1) tr() İLƏ SARILMAMIŞ string literallar (ə hərfi = qəti AZ markeri)
 *   2) JSX text node-ları (>...ə...<)
 *   3) Modul-səviyyəli tr() konstantları (ilk yükləmədə AZ donur)
 * tr("key","az default") ikinci arqumenti NORMAL sayılır (fallback-dır) — skip.
 */
const fs = require('fs');
const path = require('path');

const findings = []; // {file, line, kind, text}
const moduleTrConsts = [];

function scanFile(p) {
  const src = fs.readFileSync(p, 'utf8');
  const lines = src.split('\n');
  const rel = p.replace(/\\/g, '/').replace(/^.*?src\//, 'src/');

  lines.forEach((line, i) => {
    const ln = i + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // şərh
    if (/console\.(log|warn|error|info)/.test(line)) return; // dev log

    // 1) String literallar
    const re = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
    let m;
    while ((m = re.exec(line))) {
      const content = m[2];
      if (!/[əƏ]/.test(content)) continue;
      // tr( ... , "BU" ) — default arqumentidirsə skip
      const before = line.slice(0, m.index);
      if (/\btr\(\s*(['"])[^'"]*\1\s*,\s*$/.test(before)) continue;
      // tr("BU" — birinci arqument (key) heç vaxt ə saxlamır, amma yoxla
      if (/\btr\(\s*$/.test(before)) continue;
      // getTranslatedTip("...") / TIP_TRANSLATIONS açarları (tip-translations öz lüğətidir)
      if (rel.includes('tip-translations')) continue;
      // maternityRules data faylı (guidelines_az sahələri — data, ayrıca sistem)
      if (rel.includes('maternityRules')) continue;
      findings.push({ file: rel, line: ln, kind: 'literal', text: content.slice(0, 90) });
    }

    // 2) JSX text node
    const jsxRe = />([^<>{}`]*[əƏ][^<>{}`]*)</g;
    let j;
    while ((j = jsxRe.exec(line))) {
      const t = j[1].trim();
      if (!t || !/[əƏ]/.test(t)) continue;
      findings.push({ file: rel, line: ln, kind: 'jsx', text: t.slice(0, 90) });
    }

    // 3) Modul-səviyyəli tr() konstantları (sütun 0-da const + tr()
    if (/^const\s+[A-Z_a-z]+\s*[:=]/.test(line)) {
      // bu constun bədənində tr( varmı — sadə: eyni sətirdə və ya sonrakı 30 sətirdə "];" qədər
      const chunk = lines.slice(i, i + 40).join('\n');
      const constEnd = chunk.search(/\n(};|\];|\)\;|`;)/);
      const body = constEnd > 0 ? chunk.slice(0, constEnd) : chunk.split('\n').slice(0, 5).join('\n');
      if (/\btr\(/.test(body) && !/=>\s*/.test(line.slice(0, line.indexOf('=') + 3))) {
        moduleTrConsts.push({ file: rel, line: ln, text: line.trim().slice(0, 80) });
      }
    }
  });
}

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!/\.(tsx?|jsx?)$/.test(f)) continue;
    scanFile(p);
  }
}
walk('src');

// Qruplaşdır
const byFile = {};
for (const f of findings) {
  byFile[f.file] = byFile[f.file] || [];
  byFile[f.file].push(f);
}
console.log(`CƏMİ tapıntı: ${findings.length} (${Object.keys(byFile).length} fayl)`);
const sorted = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);
for (const [file, items] of sorted) {
  console.log(`\n${file} (${items.length}):`);
  items.slice(0, 12).forEach((x) => console.log(`  L${x.line} [${x.kind}] ${JSON.stringify(x.text)}`));
  if (items.length > 12) console.log(`  ... +${items.length - 12}`);
}
console.log('\n══ Modul-səviyyəli tr() konstantları (dublikatsız fayllar) ══');
const seen = new Set();
for (const c of moduleTrConsts) {
  const k = c.file + ':' + c.line;
  if (seen.has(k)) continue;
  seen.add(k);
  console.log(`  ${c.file}:L${c.line} — ${c.text}`);
}
fs.writeFileSync('scripts/i18n/hardcoded-scan.json', JSON.stringify({ findings, moduleTrConsts }, null, 1));

/**
 * Skaner v2 — "ə"-siz AZ UI sözləri (v1 yalnız ə axtarırdı):
 * Saxla, Davam, Bağla, Axtar, Silin, Başla, Paylaş, Seçin və s.
 * tr("key","default") ikinci arqumenti normaldır — skip.
 */
const fs = require('fs');
const path = require('path');

const WORDS = /\b(Saxla|saxlansın|Davam et|Bağla\b|Bağlayın|Axtar\b|Axtarış|Silinsin|Silmək|Dayandır|Paylaş\b|Seçin\b|Hamısı\b|Yoxla\b|Kopyala|Sabah\b|Doğum|Aylıq|İllik|Uşaq\b|Yüklə\b|Göndər\b|Başla\b|Yenilə\b|Qapat|Hazırdır)\b/;

const findings = [];
function scanFile(p) {
  const src = fs.readFileSync(p, 'utf8');
  const lines = src.split('\n');
  const rel = p.replace(/\\/g, '/').replace(/^.*?src\//, 'src/');
  lines.forEach((line, i) => {
    const ln = i + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    if (/console\.(log|warn|error|info)/.test(line)) return;

    const re = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
    let m;
    while ((m = re.exec(line))) {
      const content = m[2];
      if (!WORDS.test(content)) continue;
      const before = line.slice(0, m.index);
      if (/\btr\(\s*(['"])[^'"]*\1\s*,\s*$/.test(before)) continue; // tr defaultu
      if (/\btr\(\s*$/.test(before)) continue;
      if (content.includes('tr("') || content.includes("tr('")) continue; // template içi tr
      findings.push({ file: rel, line: ln, kind: 'literal', text: content.slice(0, 80) });
    }
    const jsxRe = />([^<>{}`]*)</g;
    let j;
    while ((j = jsxRe.exec(line))) {
      const t = j[1].trim();
      if (!t || !WORDS.test(t)) continue;
      findings.push({ file: rel, line: ln, kind: 'jsx', text: t.slice(0, 80) });
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

const skip = (f) => f.includes('/admin/') || f.includes('AdminPanel') || f.includes('tip-translations') || f.includes('maternityRules') || f.includes('/locales/');
const items = findings.filter((x) => !skip(x.file));
const byFile = {};
for (const x of items) (byFile[x.file] = byFile[x.file] || []).push(x);
console.log('Tapıntı (admin xaric):', items.length, '| fayl:', Object.keys(byFile).length);
for (const [f, arr] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
  console.log('\n' + f + ' (' + arr.length + '):');
  arr.forEach((x) => console.log('  L' + x.line + ' [' + x.kind + '] ' + JSON.stringify(x.text)));
}

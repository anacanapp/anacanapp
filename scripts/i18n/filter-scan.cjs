// Skan nəticəsini istifadəçi-tərəfli süz (admin + bilinən-normal fayllar xaric)
const d = require('./hardcoded-scan.json');
const skip = (f) => f.includes('/admin/') || f.includes('AdminPanel') || f.includes('Recipes.tsx') || f.includes('tip-translations') || f.includes('maternityRules');
const fp = (t) => t.includes('tr("') || t.includes("tr('");
const items = d.findings.filter((x) => !skip(x.file) && !fp(x.text));
const byFile = {};
for (const x of items) { (byFile[x.file] = byFile[x.file] || []).push(x); }
console.log('İstifadəçi-tərəfli tapıntı:', items.length, '| fayl:', Object.keys(byFile).length);
for (const [f, arr] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
  console.log('\n' + f + ' (' + arr.length + '):');
  arr.forEach((x) => console.log('  L' + x.line + ' [' + x.kind + '] ' + JSON.stringify(x.text)));
}
console.log('\n== Modul-səviyyəli tr() konstantları ==');
const seen = new Set();
for (const c of d.moduleTrConsts) {
  if (skip(c.file)) continue;
  const k = c.file + ':' + c.line;
  if (seen.has(k)) continue;
  seen.add(k);
  console.log('  ' + c.file + ':L' + c.line + ' — ' + c.text);
}

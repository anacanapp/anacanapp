// CSS fayllarında fiziki → logical (left:50% mərkəzləmə istisna)
const fs = require('fs');
for (const p of ['src/styles/anacan-design.css', 'src/index.css']) {
  let s = fs.readFileSync(p, 'utf8');
  let n = 0;
  const R = (re, rep) => { n += (s.match(re) || []).length; s = s.replace(re, rep); };
  R(/margin-left(\s*:)/g, 'margin-inline-start$1');
  R(/margin-right(\s*:)/g, 'margin-inline-end$1');
  R(/padding-left(\s*:)/g, 'padding-inline-start$1');
  R(/padding-right(\s*:)/g, 'padding-inline-end$1');
  R(/text-align(\s*:\s*)left\b/g, 'text-align$1start');
  R(/text-align(\s*:\s*)right\b/g, 'text-align$1end');
  R(/(^|[;{]\s*)left(\s*:\s*)(?!50%)/gm, '$1inset-inline-start$2');
  R(/(^|[;{]\s*)right(\s*:\s*)(?!50%)/gm, '$1inset-inline-end$2');
  fs.writeFileSync(p, s);
  console.log(p, 'çevirmə:', n);
}

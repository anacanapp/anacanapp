const fs = require('fs');
const file = process.argv[2];
const s = fs.readFileSync(file, 'utf8');
s.split('\n').forEach((l, i) => {
  if (/[əğışçöüĞİŞÇÖÜƏ]/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 160));
});

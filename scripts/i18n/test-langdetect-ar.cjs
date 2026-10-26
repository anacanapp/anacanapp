const fs = require('fs');
const ts = require('typescript');
let src = fs.readFileSync('src/lib/langDetect.ts', 'utf8');
src = src.replace(/^import .*$/gm, '').replace(/export /g, '');
fs.writeFileSync('scripts/i18n/_ld_gen.cjs', '"use strict";' + ts.transpile(src) + ';module.exports={detectLang};');
const { detectLang } = require('./_ld_gen.cjs');
const cases = [
  ['أنا حامل في الأسبوع العشرين وأشعر بالتعب', 'ar'],
  ['ما هو أفضل فيتامين للحامل؟', 'ar'],
  ['Salam, mən hamiləyəm və çox yorğunam', 'az'],
  ['Я беременна на 20 неделе и устала', 'ru'],
  ['Hamileyim ve çok yorgunum bugün', 'tr'],
  ['Мен жүктімін және шаршадым қазір', 'kk'],
  ['Ich bin schwanger und sehr müde heute', 'de'],
  ['I am pregnant and very tired today', 'en'],
];
let ok = 0;
for (const [t, exp] of cases) {
  const got = detectLang(t);
  const p = got === exp;
  ok += p ? 1 : 0;
  console.log((p ? 'OK ' : 'FAIL') + ' ' + exp + ' -> ' + got + ' | ' + t.slice(0, 30));
}
console.log(ok + '/' + cases.length);
fs.unlinkSync('scripts/i18n/_ld_gen.cjs');

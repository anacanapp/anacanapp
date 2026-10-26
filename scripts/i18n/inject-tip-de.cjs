// tip-translations.ts-ə de sahələrini əlavə edir (de-hardcoded.json-dan).
const fs = require('fs');
const DE = require('./de-hardcoded.json');
const P = 'src/lib/tip-translations.ts';
let src = fs.readFileSync(P, 'utf8');

const MAP = [
  ['Enerji Artımı', DE.tip_t1],
  ['Follikulyar fazada estrogen artır və artan enerji və optimizm gətirir.', DE.tip_b1],
  ['Hidrasiya Vacibdir', DE.tip_t2],
  ['Bol su içmək şişkinliyi aradan qaldırır və menstruasiya simptomlarını yüngülləşdirir. Orqanizmin maye balansını qoruyaraq bu dövrü daha rahat keçirə bilərsiniz.', DE.tip_b2],
  ['Yuxu Keyfiyyəti', DE.tip_t3],
  ['Tsikl boyu baş verən hormonal dəyişikliklər yuxunuza təsir edə bilər. Keyfiyyətli istirahət üçün sabit yuxu rejiminə riayət edin.', DE.tip_b3],
  ['Tsiklini Anlamaq', DE.tip_t4],
  [null, DE.tip_b4],
  ['Məşq Faydaları', DE.tip_t5],
  ['Müntəzəm məşq etmək menstrual sancıları yüngülləşdirir və tsikl boyu əhval-ruhiyyəni yüksəldir.', DE.tip_b5],
  ['Enerji Yüksəlir', DE.tip_t6],
  ['Estrogen səviyyəsi yüksəlir! Yeni layihələrə başlamaq və çətin işlərin öhdəsindən gəlmək üçün əla zamandır.', DE.tip_b6],
  ['Yeni Məşqlər Sınayın', DE.tip_t7],
  ['Bədəniniz indi daha intensiv məşqlərə hazırdır. HIIT, qaçış və ya ağırlıq məşqlərini sınayın.', DE.tip_b7],
  ['Protein Gücü', DE.tip_t8],
  ['Əzələ inkişafını toyuq, balıq, yumurta və paxlalılar kimi yağsız proteinlərlə dəstəkləyin.', DE.tip_b8],
  ['Sosial Enerji', DE.tip_t9],
  ['Özünüzü daha sosial və ünsiyyətcil hiss edə bilərsiniz. Sosiallaşmaq və yeni əlaqələr qurmaq üçün əla zamandır.', DE.tip_b9],
  ['Yaradıcılıq Zirvəsi', DE.tip_t10],
  ['Zehni fəaliyyətiniz güclənib. Bu vaxtı beyin fırtınası, öyrənmək və yaradıcı işlər üçün dəyərləndirin.', DE.tip_b10],
];

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
let added = 0;

for (const [azKey, deVal] of MAP) {
  if (!deVal || azKey === null) continue;
  const keyIdx = src.indexOf(JSON.stringify(azKey));
  if (keyIdx < 0) { console.log('⚠ tapılmadı:', azKey.slice(0, 40)); continue; }
  const closeIdx = src.indexOf('}', keyIdx);
  if (closeIdx < 0) continue;
  const before = src.slice(0, closeIdx).replace(/\s+$/, '');
  const needsComma = !before.endsWith(',');
  src = before + (needsComma ? ',' : '') + `\n    "de": "${esc(deVal)}"\n  ` + src.slice(closeIdx);
  added++;
}

const longKeyStart = '"Menstrual dövrünüz dörd fazaya bölünür';
const longIdx = src.indexOf(longKeyStart);
if (longIdx >= 0 && DE.tip_b4) {
  const closeIdx = src.indexOf('}', longIdx);
  const before = src.slice(0, closeIdx).replace(/\s+$/, '');
  const needsComma = !before.endsWith(',');
  src = before + (needsComma ? ',' : '') + `\n    "de": "${esc(DE.tip_b4)}"\n  ` + src.slice(closeIdx);
  added++;
} else {
  console.log('⚠ uzun tip_b4 tapılmadı');
}

fs.writeFileSync(P, src, 'utf8');
console.log(`✓ tip-translations.ts: ${added} de sahəsi əlavə olundu`);

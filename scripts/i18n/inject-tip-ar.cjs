// tip-translations.ts-ə ar sahələrini əlavə edir (ar-hardcoded.json-dan). inject-tip-de klonu.
const fs = require('fs');
const AR = require('./ar-hardcoded.json');
const P = 'src/lib/tip-translations.ts';
let src = fs.readFileSync(P, 'utf8');

const MAP = [
  ['Enerji Artımı', AR.tip_t1],
  ['Follikulyar fazada estrogen artır və artan enerji və optimizm gətirir.', AR.tip_b1],
  ['Hidrasiya Vacibdir', AR.tip_t2],
  ['Bol su içmək şişkinliyi aradan qaldırır və menstruasiya simptomlarını yüngülləşdirir. Orqanizmin maye balansını qoruyaraq bu dövrü daha rahat keçirə bilərsiniz.', AR.tip_b2],
  ['Yuxu Keyfiyyəti', AR.tip_t3],
  ['Tsikl boyu baş verən hormonal dəyişikliklər yuxunuza təsir edə bilər. Keyfiyyətli istirahət üçün sabit yuxu rejiminə riayət edin.', AR.tip_b3],
  ['Tsiklini Anlamaq', AR.tip_t4],
  [null, AR.tip_b4],
  ['Məşq Faydaları', AR.tip_t5],
  ['Müntəzəm məşq etmək menstrual sancıları yüngülləşdirir və tsikl boyu əhval-ruhiyyəni yüksəldir.', AR.tip_b5],
  ['Enerji Yüksəlir', AR.tip_t6],
  ['Estrogen səviyyəsi yüksəlir! Yeni layihələrə başlamaq və çətin işlərin öhdəsindən gəlmək üçün əla zamandır.', AR.tip_b6],
  ['Yeni Məşqlər Sınayın', AR.tip_t7],
  ['Bədəniniz indi daha intensiv məşqlərə hazırdır. HIIT, qaçış və ya ağırlıq məşqlərini sınayın.', AR.tip_b7],
  ['Protein Gücü', AR.tip_t8],
  ['Əzələ inkişafını toyuq, balıq, yumurta və paxlalılar kimi yağsız proteinlərlə dəstəkləyin.', AR.tip_b8],
  ['Sosial Enerji', AR.tip_t9],
  ['Özünüzü daha sosial və ünsiyyətcil hiss edə bilərsiniz. Sosiallaşmaq və yeni əlaqələr qurmaq üçün əla zamandır.', AR.tip_b9],
  ['Yaradıcılıq Zirvəsi', AR.tip_t10],
  ['Zehni fəaliyyətiniz güclənib. Bu vaxtı beyin fırtınası, öyrənmək və yaradıcı işlər üçün dəyərləndirin.', AR.tip_b10],
];

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
let added = 0;

for (const [azKey, arVal] of MAP) {
  if (!arVal || azKey === null) continue;
  const keyIdx = src.indexOf(JSON.stringify(azKey));
  if (keyIdx < 0) { console.log('⚠ tapılmadı:', azKey.slice(0, 40)); continue; }
  const closeIdx = src.indexOf('}', keyIdx);
  if (closeIdx < 0) continue;
  const before = src.slice(0, closeIdx).replace(/\s+$/, '');
  const needsComma = !before.endsWith(',');
  src = before + (needsComma ? ',' : '') + `\n    "ar": "${esc(arVal)}"\n  ` + src.slice(closeIdx);
  added++;
}

const longKeyStart = '"Menstrual dövrünüz dörd fazaya bölünür';
const longIdx = src.indexOf(longKeyStart);
if (longIdx >= 0 && AR.tip_b4) {
  const closeIdx = src.indexOf('}', longIdx);
  const before = src.slice(0, closeIdx).replace(/\s+$/, '');
  const needsComma = !before.endsWith(',');
  src = before + (needsComma ? ',' : '') + `\n    "ar": "${esc(AR.tip_b4)}"\n  ` + src.slice(closeIdx);
  added++;
} else {
  console.log('⚠ uzun tip_b4 tapılmadı');
}

fs.writeFileSync(P, src, 'utf8');
console.log(`✓ tip-translations.ts: ${added} ar sahəsi əlavə olundu`);

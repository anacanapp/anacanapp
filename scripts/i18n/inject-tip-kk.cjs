// tip-translations.ts-ə kk sahələrini əlavə edir (kk-hardcoded.json-dan).
const fs = require('fs');
const KK = require('./kk-hardcoded.json');
const P = 'src/lib/tip-translations.ts';
let src = fs.readFileSync(P, 'utf8');

// az açar → kk dəyəri (translate-hardcoded-kk.cjs PAYLOAD sırası ilə)
const MAP = [
  ['Enerji Artımı', KK.tip_t1],
  ['Follikulyar fazada estrogen artır və artan enerji və optimizm gətirir.', KK.tip_b1],
  ['Hidrasiya Vacibdir', KK.tip_t2],
  ['Bol su içmək şişkinliyi aradan qaldırır və menstruasiya simptomlarını yüngülləşdirir. Orqanizmin maye balansını qoruyaraq bu dövrü daha rahat keçirə bilərsiniz.', KK.tip_b2],
  ['Yuxu Keyfiyyəti', KK.tip_t3],
  ['Tsikl boyu baş verən hormonal dəyişikliklər yuxunuza təsir edə bilər. Keyfiyyətli istirahət üçün sabit yuxu rejiminə riayət edin.', KK.tip_b3],
  ['Tsiklini Anlamaq', KK.tip_t4],
  [null, KK.tip_b4], // uzun mətn — aşağıda xüsusi emal
  ['Məşq Faydaları', KK.tip_t5],
  ['Müntəzəm məşq etmək menstrual sancıları yüngülləşdirir və tsikl boyu əhval-ruhiyyəni yüksəldir.', KK.tip_b5],
  ['Enerji Yüksəlir', KK.tip_t6],
  ['Estrogen səviyyəsi yüksəlir! Yeni layihələrə başlamaq və çətin işlərin öhdəsindən gəlmək üçün əla zamandır.', KK.tip_b6],
  ['Yeni Məşqlər Sınayın', KK.tip_t7],
  ['Bədəniniz indi daha intensiv məşqlərə hazırdır. HIIT, qaçış və ya ağırlıq məşqlərini sınayın.', KK.tip_b7],
  ['Protein Gücü', KK.tip_t8],
  ['Əzələ inkişafını toyuq, balıq, yumurta və paxlalılar kimi yağsız proteinlərlə dəstəkləyin.', KK.tip_b8],
  ['Sosial Enerji', KK.tip_t9],
  ['Özünüzü daha sosial və ünsiyyətcil hiss edə bilərsiniz. Sosiallaşmaq və yeni əlaqələr qurmaq üçün əla zamandır.', KK.tip_b9],
  ['Yaradıcılıq Zirvəsi', KK.tip_t10],
  ['Zehni fəaliyyətiniz güclənib. Bu vaxtı beyin fırtınası, öyrənmək və yaradıcı işlər üçün dəyərləndirin.', KK.tip_b10],
];

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
let added = 0;

// Hər entry-nin "tr": "..." sətrindən sonra "kk" əlavə et — entry az açarı ilə tapılır
for (const [azKey, kkVal] of MAP) {
  if (!kkVal) continue;
  if (azKey === null) continue;
  const keyIdx = src.indexOf(JSON.stringify(azKey));
  if (keyIdx < 0) { console.log('⚠ tapılmadı:', azKey.slice(0, 40)); continue; }
  // Bu entry-nin bağlanma mötərizəsini tap: keyIdx-dən sonrakı ilk "  }" bloku
  const closeIdx = src.indexOf('}', keyIdx);
  if (closeIdx < 0) continue;
  // "tr" dəyərindən sonra vergül + kk sətri daxil et (bağlanmadan əvvəl)
  const before = src.slice(0, closeIdx);
  const after = src.slice(closeIdx);
  // son dəyərdən sonra vergül lazımdırsa əlavə et
  const trimmed = before.replace(/\s+$/, '');
  const needsComma = !trimmed.endsWith(',');
  src = trimmed + (needsComma ? ',' : '') + `\n    "kk": "${esc(kkVal)}"\n  ` + after;
  added++;
}

// Uzun tip_b4 mətni (dörd faza) — açarın ilk 60 simvolu ilə tap
const longKeyStart = '"Menstrual dövrünüz dörd fazaya bölünür';
const longIdx = src.indexOf(longKeyStart);
if (longIdx >= 0 && KK.tip_b4) {
  const closeIdx = src.indexOf('}', longIdx);
  const before = src.slice(0, closeIdx).replace(/\s+$/, '');
  const needsComma = !before.endsWith(',');
  src = before + (needsComma ? ',' : '') + `\n    "kk": "${esc(KK.tip_b4)}"\n  ` + src.slice(closeIdx);
  added++;
} else {
  console.log('⚠ uzun tip_b4 tapılmadı');
}

fs.writeFileSync(P, src, 'utf8');
console.log(`✓ tip-translations.ts: ${added} kk sahəsi əlavə olundu`);

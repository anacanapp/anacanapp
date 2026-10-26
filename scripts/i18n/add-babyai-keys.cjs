const fs = require('fs');
const KEYS = {
  // Həkim hesabatı giriş nöqtələri
  profilescreen_hekim_hesabati: { az: 'Həkim Hesabatı (PDF)', en: 'Doctor Report (PDF)', ru: 'Отчёт для врача (PDF)', tr: 'Doktor Raporu (PDF)' },
  dash_pdf_report: { az: 'Həkim hesabatı (PDF)', en: 'Doctor report (PDF)', ru: 'Отчёт для врача (PDF)', tr: 'Doktor raporu (PDF)' },
  // PDF körpə qulluq bölməsi
  pdf_section_babycare: { az: 'Körpə Qulluğu (dövr üzrə)', en: 'Baby Care (over period)', ru: 'Уход за малышом (за период)', tr: 'Bebek Bakımı (dönem boyunca)' },
  pdf_bc_sleep_avg: { az: 'Yuxu (orta/gün)', en: 'Sleep (avg/day)', ru: 'Сон (в среднем/день)', tr: 'Uyku (ort./gün)' },
  pdf_bc_feeds_avg: { az: 'Qidalanma (orta/gün)', en: 'Feeding (avg/day)', ru: 'Кормление (в среднем/день)', tr: 'Beslenme (ort./gün)' },
  pdf_bc_breast: { az: 'Ana südü (cəmi)', en: 'Breast (total)', ru: 'Грудное (всего)', tr: 'Anne sütü (toplam)' },
  pdf_bc_formula: { az: 'Süd əvəzedicisi (cəmi)', en: 'Formula (total)', ru: 'Смесь (всего)', tr: 'Mama (toplam)' },
  pdf_bc_solid: { az: 'Əlavə qida (cəmi)', en: 'Solids (total)', ru: 'Прикорм (всего)', tr: 'Ek gıda (toplam)' },
  pdf_bc_diapers_avg: { az: 'Bez (orta/gün)', en: 'Diapers (avg/day)', ru: 'Подгузники (в среднем/день)', tr: 'Bez (ort./gün)' },
  pdf_bc_wet_dirty: { az: 'Nəm / Çirkli (cəmi)', en: 'Wet / Dirty (total)', ru: 'Мокрые / Грязные (всего)', tr: 'Islak / Kirli (toplam)' },
  pdf_bc_total: { az: 'Cəmi qeyd', en: 'Total logs', ru: 'Всего записей', tr: 'Toplam kayıt' },
  // Tracker AI analizi
  babyai_title: { az: 'AI Analiz', en: 'AI Analysis', ru: 'AI-анализ', tr: 'AI Analizi' },
  babyai_check: { az: 'AI ilə yoxla — bu göstəricilər normaldır?', en: 'Check with AI — are these numbers normal?', ru: 'Проверить с AI — эти показатели в норме?', tr: 'AI ile kontrol et — bu değerler normal mi?' },
  babyai_loading: { az: 'AI analiz edir...', en: 'AI is analyzing...', ru: 'AI анализирует...', tr: 'AI analiz ediyor...' },
  babyai_error_retry: { az: 'AI analiz alınmadı — yenidən cəhd et', en: 'AI analysis failed — tap to retry', ru: 'AI-анализ не удался — попробуйте ещё раз', tr: 'AI analizi başarısız — tekrar deneyin' },
  babyai_refresh: { az: 'Yenilə', en: 'Refresh', ru: 'Обновить', tr: 'Yenile' },
  babyai_status_normal: { az: 'Normal', en: 'Normal', ru: 'Норма', tr: 'Normal' },
  babyai_status_low: { az: 'Az', en: 'Low', ru: 'Мало', tr: 'Az' },
  babyai_status_high: { az: 'Çox', en: 'High', ru: 'Много', tr: 'Çok' },
  babyai_status_watch: { az: 'Diqqət', en: 'Watch', ru: 'Внимание', tr: 'Dikkat' },
};

for (const [f, lang] of [['src/locales/az.json', 'az'], ['src/locales/en.json', 'en'], ['scripts/i18n/ru.seed.json', 'ru'], ['scripts/i18n/tr.seed.json', 'tr']]) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  let n = 0;
  for (const [k, v] of Object.entries(KEYS)) if (!d[k]) { d[k] = v[lang]; n++; }
  fs.writeFileSync(f, JSON.stringify(d, null, 2));
  console.log('✓', f, '+' + n);
}

const esc = (s) => s.replace(/'/g, "''");
const rows = [];
for (const [k, v] of Object.entries(KEYS)) {
  for (const l of ['ru', 'tr', 'en']) rows.push(`  ('${k}', '${l}', '${esc(v[l])}', 'common')`);
}
const sql = [
  '-- Həkim PDF hesabatı + Tracker AI analiz UI açarları (ru/tr/en) — idempotent',
  'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
  rows.join(',\n'),
  'ON CONFLICT (key, lang) DO NOTHING;',
  '',
].join('\n');
fs.writeFileSync('supabase/migrations/20260813150028_babyai_pdf_ui_keys.sql', sql);
fs.copyFileSync('supabase/migrations/20260813150028_babyai_pdf_ui_keys.sql', 'supabase/son/Son10.sql');
console.log('✓ Son10.sql +', rows.length, 'sətir');

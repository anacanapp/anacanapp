// Son26: legal sənədlər en/ru/tr + dublikat deaktiv + partner EN açarları
const fs = require('fs');
const path = require('path');

const esc = (s) => String(s).replace(/'/g, "''");

// ── legal tərcümələri out/-dan yığ ──
const legal = {}; // id -> {lang: {title, content}}
for (const lang of ['ru', 'tr', 'en']) {
  const dir = path.join('scripts/content-i18n/out', lang);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    const rows = f.startsWith('_') ? d.legal_documents : null;
    if (!rows) continue;
    for (const [id, v] of Object.entries(rows)) {
      legal[id] = legal[id] || {};
      legal[id][lang] = v;
    }
  }
}

const lines = [
  '-- ============================================================',
  '-- Son26: 1) legal_documents en/ru/tr tərcümələri (6 sənəd)',
  '--        2) köhnə dublikat sənədlər deaktiv (privacy/terms, az boş)',
  '--        3) partner modulunun EN açarları',
  '-- ============================================================',
  '',
];
let cnt = 0;
for (const [id, langs] of Object.entries(legal)) {
  const sets = [];
  if (langs.ru) sets.push(`title_ru = '${esc(langs.ru.title)}'`, `content_ru = '${esc(langs.ru.content)}'`);
  if (langs.tr) sets.push(`title_tr = '${esc(langs.tr.title)}'`, `content_tr = '${esc(langs.tr.content)}'`);
  if (langs.en) {
    sets.push(`title_en = '${esc(langs.en.title)}'`, `content_en = '${esc(langs.en.content)}'`);
    // base title/content (EN kimi istifadə olunur) yalnız boş/qısadırsa doldur
    sets.push(`title = CASE WHEN length(coalesce(title, '')) < 5 THEN '${esc(langs.en.title)}' ELSE title END`);
    sets.push(`content = CASE WHEN length(coalesce(content, '')) < 50 THEN '${esc(langs.en.content)}' ELSE content END`);
  }
  if (sets.length) {
    lines.push(`UPDATE public.legal_documents SET ${sets.join(', ')} WHERE id = '${id}';`);
    cnt++;
  }
}

lines.push('', '-- Dublikatlar (az məzmunu olmayan köhnə privacy/terms) deaktiv');
lines.push("UPDATE public.legal_documents SET is_active = false WHERE document_type IN ('privacy', 'terms') AND length(coalesce(content_az, '')) < 50;");
lines.push('');

// ── partner EN açarları ──
const PARTNER_EN = {
  namevotingscreen_partnyor_label: { az: 'Partnyor', en: 'Partner', ru: 'Партнёр', tr: 'Partner' },
  partner_surprise_planned: { az: '🎁 Həyat yoldaşın sənin üçün xüsusi bir sürpriz planladı!', en: '🎁 Your partner has planned a special surprise for you!', ru: '🎁 Ваш супруг запланировал для вас особый сюрприз!', tr: '🎁 Eşiniz sizin için özel bir sürpriz planladı!' },
  partner_surprise_completed_1: { az: 'Həyat yoldaşın', en: 'Your partner', ru: 'Ваш супруг', tr: 'Eşiniz' },
  partner_surprise_completed_2: { az: 'sürprizini sənin üçün tamamladı! 🎉', en: 'completed the surprise for you! 🎉', ru: 'выполнил(а) сюрприз для вас! 🎉', tr: 'sürprizinizi tamamladı! 🎉' },
  partner_points_earned_2: { az: 'xal qazandın! 🏆', en: 'points earned! 🏆', ru: 'баллов заработано! 🏆', tr: 'puan kazandın! 🏆' },
  partner_surprise_done: { az: 'tamamlandı!', en: 'completed!', ru: 'выполнено!', tr: 'tamamlandı!' },
  partner_ready: { az: 'hazır', en: 'ready', ru: 'готово', tr: 'hazır' },
  partner_will_receive_notification: { az: 'bildiriş alacaq', en: 'will receive a notification', ru: 'получит уведомление', tr: 'bildirim alacak' },
  common_legv_et: { az: 'Ləğv et', en: 'Cancel', ru: 'Отмена', tr: 'İptal' },
  partnerv2_boyukluyunde: { az: 'böyüklüyündə', en: 'in size', ru: 'размером', tr: 'büyüklüğünde' },
};

// lokal fayllar
const az = JSON.parse(fs.readFileSync('src/locales/az.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
let na = 0, ne = 0;
for (const [k, v] of Object.entries(PARTNER_EN)) {
  if (!az[k]) { az[k] = v.az; na++; }
  if (!en[k]) { en[k] = v.en; ne++; }
}
fs.writeFileSync('src/locales/az.json', JSON.stringify(az, null, 2));
fs.writeFileSync('src/locales/en.json', JSON.stringify(en, null, 2));

const insRows = [];
for (const [k, v] of Object.entries(PARTNER_EN)) {
  for (const l of ['ru', 'tr', 'en']) insRows.push(`  ('${k}', '${l}', '${esc(v[l])}', 'common')`);
}
lines.push('-- Partner EN/RU/TR açarları (idempotent)');
lines.push('INSERT INTO public.translations (key, lang, value, namespace) VALUES');
lines.push(insRows.join(',\n'));
lines.push('ON CONFLICT (key, lang) DO NOTHING;');
lines.push('');
lines.push('-- Yoxlama: 6 sənəddə ru/tr dolu olmalıdır');
lines.push("SELECT document_type, length(content_ru) AS ru, length(content_tr) AS tr, length(content_en) AS en FROM public.legal_documents WHERE is_active = true ORDER BY document_type;");
lines.push('');

fs.writeFileSync('supabase/son/Son26.sql', lines.join('\n'));
const mig = lines.slice(0, lines.indexOf('-- Yoxlama: 6 sənəddə ru/tr dolu olmalıdır')).join('\n') + '\n';
fs.writeFileSync('supabase/migrations/20260813150044_legal_i18n_partner_en.sql', mig);
console.log(`✓ Son26.sql: ${cnt} legal sənəd + ${insRows.length} açar sətri (az.json +${na}, en.json +${ne})`);

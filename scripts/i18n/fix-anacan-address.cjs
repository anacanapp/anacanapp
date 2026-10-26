/**
 * "Anacan" MÜRACİƏTİNİN lokallaşdırılması (brend adı deyil!):
 *   kk → Анашым · ru → Мамочка/мамочка · tr → Anneciğim/anneciğim
 * Əhatə:
 *   1) pregnancy_daily_content.baby_message_{kk,ru,tr} — körpənin anaya mesajları (yeganə müraciət sahəsi)
 *   2) UI: dashboard_hero_fruit_tpl + dashboard_anacan_hazirda_cfaa50 (kk; ru/tr/en yoxlanılır)
 * Brend qorunur: Dr.Anacan, Anacan Premium, Anacan.AI, Anacan AI (+bütün digər brend açarları toxunulmur).
 * Nəticə: out/* fayllar yerində yenilənir + kk.seed/kk.out + supabase/qazax/Qazax8.sql
 */
const fs = require('fs');
const path = require('path');

const ADDRESS = {
  kk: { cap: 'Анашым', low: 'анашым' },
  ru: { cap: 'Мамочка', low: 'мамочка' },
  tr: { cap: 'Anneciğim', low: 'anneciğim' },
};

function replaceAddress(text, lang) {
  const { cap, low } = ADDRESS[lang];
  let t = String(text);
  // brend qoruması
  const prot = [
    [/Dr\.?\s?Anacan/g, '\u0001'],
    [/Anacan\s+Premium/g, '\u0002'],
    [/Anacan\.AI/gi, '\u0003'],
    [/Anacan\s+AI\b/g, '\u0004'],
  ];
  for (const [re, ph] of prot) t = t.replace(re, ph);
  // Cümlə başı (sətir başı / . ! ? … " « „ sonrası) → böyük hərf
  t = t.replace(/(^|[.!?…]\s+|\n\s*|["«„]\s*)Anacan\b/g, (m, pre) => pre + cap);
  // Qalan (cümlə ortası) → kiçik hərf (ru/tr/kk qrammatikasına uyğun)
  t = t.replace(/\bAnacan\b/g, low);
  return t
    .replace(/\u0001/g, 'Dr.Anacan')
    .replace(/\u0002/g, 'Anacan Premium')
    .replace(/\u0003/g, 'Anacan.AI')
    .replace(/\u0004/g, 'Anacan AI');
}

const esc = (s) => String(s).replace(/'/g, "''");
const sqlStmts = [];

// ── 1) Content: baby_message ──
const changed = { kk: 0, ru: 0, tr: 0 };
for (const lang of ['kk', 'ru', 'tr']) {
  const dir = path.join(__dirname, '..', 'content-i18n', 'out', lang);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    const isBatch = f.startsWith('_');
    const tables = isBatch ? d : { [path.basename(f, '.json')]: d };
    let fileChanged = false;
    const rows = tables['pregnancy_daily_content'];
    if (rows) {
      for (const [id, fields] of Object.entries(rows)) {
        const v = fields['baby_message'];
        if (typeof v !== 'string') continue;
        const nv = replaceAddress(v, lang);
        if (nv !== v) {
          fields['baby_message'] = nv;
          fileChanged = true;
          changed[lang]++;
          sqlStmts.push(`UPDATE public.pregnancy_daily_content SET baby_message_${lang} = '${esc(nv)}' WHERE id = '${id}';`);
        }
      }
    }
    if (fileChanged) fs.writeFileSync(path.join(dir, f), JSON.stringify(isBatch ? tables : tables[path.basename(f, '.json')], null, 1), 'utf8');
  }
}
console.log(`baby_message düzəldildi: kk=${changed.kk}, ru=${changed.ru}, tr=${changed.tr}`);

// ── 2) UI açarları (kk) ──
const UI_FIX_KK = {
  dashboard_hero_fruit_tpl: 'Анашым, қазір менің өлшемім {fruit} сияқты',
  dashboard_anacan_hazirda_cfaa50: 'Анашым, қазір',
};
for (const p of ['scripts/i18n/kk.seed.json', 'scripts/i18n/kk.out.json']) {
  const full = path.join(__dirname, '..', '..', p);
  const d = JSON.parse(fs.readFileSync(full, 'utf8'));
  for (const [k, v] of Object.entries(UI_FIX_KK)) d[k] = v;
  fs.writeFileSync(full, JSON.stringify(d, null, p.includes('seed') ? 2 : 1), 'utf8');
}
const uiUpserts = Object.entries(UI_FIX_KK).map(([k, v]) =>
  `INSERT INTO public.translations (key, lang, value, namespace) VALUES ('${esc(k)}', 'kk', '${esc(v)}', 'common')\nON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;`
);
console.log(`UI kk düzəldildi: ${Object.keys(UI_FIX_KK).length} açar`);

// ru/tr/en yoxlaması (məlumat üçün)
const ru = JSON.parse(fs.readFileSync(path.join(__dirname, 'ru.seed.json'), 'utf8'));
const tr = JSON.parse(fs.readFileSync(path.join(__dirname, 'tr.seed.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src/locales/en.json'), 'utf8'));
for (const k of Object.keys(UI_FIX_KK)) {
  console.log(`  ${k}: ru=${JSON.stringify(ru[k] || '—')} tr=${JSON.stringify(tr[k] || '—')} en=${JSON.stringify(en[k] || '—')}`);
}

// ── 3) Qazax8.sql ──
const body = [
  '-- ============================================================',
  '-- Qazax8 — "Anacan" MÜRACİƏTİNİN lokallaşdırılması',
  '--   kk → Анашым · ru → мамочка · tr → anneciğim (brend adları toxunulmur)',
  '-- Əhatə: pregnancy_daily_content.baby_message_{kk,ru,tr} (körpənin anaya mesajları)',
  '--        + 2 dashboard UI açarı (kk).',
  `-- Cəmi: ${sqlStmts.length} content UPDATE + ${uiUpserts.length} UI upsert.`,
  '-- ============================================================',
  '', '',
  uiUpserts.join('\n\n'),
  '',
  sqlStmts.join('\n'),
  '',
].join('\n');
const outPath = path.join(__dirname, '..', '..', 'supabase', 'qazax', 'Qazax8.sql');
fs.writeFileSync(outPath, body, 'utf8');
console.log(`✓ supabase/qazax/Qazax8.sql — ${Math.round(Buffer.byteLength(body, 'utf8') / 1024)}KB`);

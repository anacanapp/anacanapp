/**
 * Hardcoded-audit açarları: 11 yeni açar → en/ru/tr/kk/de (tək Azure job).
 * Yenilənir: az.json, en.json, ru/tr/kk/de seed-lər (+kk.out/de.out) + supabase/alman/Alman6.sql
 */
const fs = require('fs');
const path = require('path');

const envAz = path.join(__dirname, '..', 'content-i18n', '.env.azure');
for (const line of fs.readFileSync(envAz, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const ENDPOINT = (process.env.AZURE_OPENAI_V1_ENDPOINT || '').replace(/\/$/, '');
const API_KEY = process.env.AZURE_API_KEY;
const MODEL = process.env.AZURE_MODEL || 'gpt-5.6-sol';

const KEYS = {
  vaccinecalendar_yer_ph: 'məs. Bakı Uşaq Klinik Xəstəxanası',
  vaccinecalendar_sebeb_ph: 'məs. Tibbi əks-göstəriş',
  maternity_is_staji_telebi: 'İş Stajı Tələbi',
  maternity_staj_metni: 'Məzuniyyət ödənişi almaq üçün son iş yerində minimum {n} ay iş stajınız olmalıdır.',
  maternity_usaga_qulluq_mezuniyyeti: 'Uşağa Qulluq Məzuniyyəti',
  maternity_muddet: 'Müddət',
  common_ay_unit: 'ay',
  dashboard_diger_ml_ph: 'Digər (ml)',
  dashboard_qida_ph: 'Məs: balkabaqlı püre',
  nutrition_kcal_ph: 'məs. 350',
  games_user_fallback: 'Anacan istifadəçisi',
};

const LANG_RULES = {
  en: 'English. Concise product English.',
  ru: 'Russian. Formal «вы» style where applicable.',
  tr: 'Turkish. Natural product Turkish, "siz" form.',
  kk: 'Kazakh (Cyrillic, Kazakhstan). Formal «Сіз» form.',
  de: 'German (parenting-app style). Informal "du" form.',
};

async function azureCall(lang) {
  const system = [
    'You are a UI translator for a pregnancy & motherhood app (Anacan).',
    `Translate the JSON values from Azerbaijani to ${LANG_RULES[lang]}`,
    'Rules: Return ONLY valid JSON with EXACTLY the same keys. Preserve {n} placeholder exactly. Keep brand word Anacan unchanged.',
    '"məs." means "e.g." — use the natural equivalent (e.g./напр./örn./мыс./z. B.).',
    'For the clinic example, use a natural local-sounding example clinic name for that language.',
  ].join('\n');
  let body = {
    model: MODEL,
    messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(KEYS) }],
    max_completion_tokens: 3000,
    response_format: { type: 'json_object' },
  };
  for (let a = 1; a <= 5; a++) {
    const resp = await fetch(`${ENDPOINT}/chat/completions`, {
      method: 'POST', headers: { 'api-key': API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (resp.status === 429 || resp.status >= 500) { await new Promise((r) => setTimeout(r, a * 5000)); continue; }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const text = (data?.choices?.[0]?.message?.content || '').trim();
    return JSON.parse(text.startsWith('```') ? text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') : text);
  }
  throw new Error('retries exhausted');
}

const esc = (s) => String(s).replace(/'/g, "''");

(async () => {
  const results = {}; // lang -> {key: value}
  for (const lang of ['en', 'ru', 'tr', 'kk', 'de']) {
    results[lang] = await azureCall(lang);
    console.log(`✓ ${lang}: ${Object.keys(results[lang]).length}`);
  }

  // Faylları yenilə (yalnız boşluqlar; az həmişə yazılır)
  const FILES = {
    az: ['src/locales/az.json', Object.fromEntries(Object.entries(KEYS))],
    en: ['src/locales/en.json', results.en],
    ru: ['scripts/i18n/ru.seed.json', results.ru],
    tr: ['scripts/i18n/tr.seed.json', results.tr],
    kk: ['scripts/i18n/kk.seed.json', results.kk],
    de: ['scripts/i18n/de.seed.json', results.de],
  };
  for (const [lang, [p, vals]] of Object.entries(FILES)) {
    const full = path.join(__dirname, '..', '..', p);
    const d = JSON.parse(fs.readFileSync(full, 'utf8'));
    let n = 0;
    for (const [k, v] of Object.entries(vals)) {
      if (typeof v === 'string' && v.trim() && !d[k]) { d[k] = v; n++; }
    }
    fs.writeFileSync(full, JSON.stringify(d, null, 2), 'utf8');
    console.log(`  ${p}: +${n}`);
  }
  // out fayllar (rebuild mənbələri)
  for (const [lang, outFile] of [['kk', 'kk.out.json'], ['de', 'de.out.json']]) {
    const full = path.join(__dirname, outFile);
    const d = JSON.parse(fs.readFileSync(full, 'utf8'));
    let n = 0;
    for (const [k, v] of Object.entries(results[lang])) if (v && !d[k]) { d[k] = v; n++; }
    fs.writeFileSync(full, JSON.stringify(d, null, 1), 'utf8');
  }

  // Alman6.sql — bütün dillər üçün upsert
  const rows = [];
  for (const [lang, vals] of Object.entries(results)) {
    for (const [k, v] of Object.entries(vals)) {
      if (typeof v === 'string' && v.trim()) rows.push(`  ('${esc(k)}', '${lang}', '${esc(v)}', 'common')`);
    }
  }
  const body = [
    '-- ============================================================',
    '-- Alman6 — Hardcoded-audit açarları (BÜTÜN dillər: en/ru/tr/kk/de)',
    '-- Mənbə: kodda tr() olmadan qalmış istifadəçi-tərəfli mətnlər',
    '-- (vaksin placeholder-ləri, maternity etiketləri, dashboard/nutrition',
    '--  placeholder-ləri, oyun leaderboard fallback). İdempotent.',
    '-- ============================================================',
    '',
    'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
    rows.join(',\n'),
    'ON CONFLICT (key, lang) DO NOTHING;',
    '',
  ].join('\n');
  const outPath = path.join(__dirname, '..', '..', 'supabase', 'alman', 'Alman6.sql');
  fs.writeFileSync(outPath, body, 'utf8');
  console.log(`✓ supabase/alman/Alman6.sql — ${rows.length} sətir`);

  // Nümunə
  console.log('\nNümunə (maternity_staj_metni):');
  for (const l of ['en', 'ru', 'tr', 'kk', 'de']) console.log(` ${l}:`, results[l].maternity_staj_metni);
})();

/**
 * EPDS options jsonb i18n düzəlişi — text_ru/text_tr/text_kk əlavə edir.
 * (Depressiya testinin cavab variantları indiyədək YALNIZ az/en idi — ru/tr istifadəçilər
 *  də az mətn görürdü. Bu script 3 dili birdən düzəldir.)
 * Axın: diag token → epds_questions oxu → Azure (az→ru/tr/kk) → Qazax6.sql (UPDATE options).
 */
const fs = require('fs');
const path = require('path');

// Azure env
const envAz = path.join(__dirname, '.env.azure');
for (const line of fs.readFileSync(envAz, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const ENDPOINT = (process.env.AZURE_OPENAI_V1_ENDPOINT || '').replace(/\/$/, '');
const API_KEY = process.env.AZURE_API_KEY;
const MODEL = process.env.AZURE_MODEL || 'gpt-5.6-sol';

// Supabase env
const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);

const LANG_STYLE = {
  ru: 'Russian. Use the formal «вы» form.',
  tr: 'Turkish. Use the formal "siz" form.',
  kk: 'Kazakh (Cyrillic script, as used in Kazakhstan). Use the formal «Сіз» form.',
};

async function azureTranslate(payload, lang) {
  const system = [
    'You translate answer options of the EPDS postnatal depression screening questionnaire for a motherhood app.',
    `Translate the JSON values from Azerbaijani to ${LANG_STYLE[lang]}`,
    'Rules: Return ONLY valid JSON with EXACTLY the same keys. Clinical accuracy is critical — preserve intensity/frequency nuances (e.g. "çox vaxt" vs "bəzən"). No commentary.',
  ].join('\n');
  let body = {
    model: MODEL,
    messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(payload) }],
    max_completion_tokens: 4000,
    response_format: { type: 'json_object' },
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    const resp = await fetch(`${ENDPOINT}/chat/completions`, {
      method: 'POST', headers: { 'api-key': API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (resp.status === 429 || resp.status >= 500) { await new Promise((r) => setTimeout(r, attempt * 5000)); continue; }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    const data = await resp.json();
    const text = (data?.choices?.[0]?.message?.content || '').trim();
    return JSON.parse(text.startsWith('```') ? text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') : text);
  }
  throw new Error('retries exhausted');
}

const esc = (s) => String(s).replace(/'/g, "''");

(async () => {
  // 1) Oxu
  const su = await fetch(URL_ + '/auth/v1/signup', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'diag_' + Date.now() + '@anacan-test.dev', password: 'Test1234!diag' }) });
  const d = await su.json();
  const H = { apikey: KEY, Authorization: 'Bearer ' + d.access_token };
  const r = await fetch(URL_ + '/rest/v1/epds_questions?select=id,sort_order,options&order=sort_order.asc', { headers: H });
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) { console.error('✗ epds_questions oxuna bilmədi:', JSON.stringify(rows).slice(0, 200)); process.exit(1); }
  console.log(`epds_questions: ${rows.length} sual`);

  // 2) Unikal az mətnləri topla
  const texts = new Map(); // az -> {ru,tr,kk}
  for (const row of rows) {
    for (const o of row.options || []) {
      const az = o.text_az || o.text;
      if (az && !texts.has(az)) texts.set(az, {});
    }
  }
  console.log(`Unikal variant mətni: ${texts.size}`);

  // 3) Tərcümə (hər dil üçün 1 çağırış)
  const keys = [...texts.keys()];
  const payload = Object.fromEntries(keys.map((k, i) => [`t${i}`, k]));
  for (const lang of ['ru', 'tr', 'kk']) {
    const out = await azureTranslate(payload, lang);
    keys.forEach((k, i) => { texts.get(k)[lang] = out[`t${i}`] || null; });
    console.log(`✓ ${lang} tərcümə olundu`);
  }

  // 4) SQL — options massivini yenidən qur (mövcud açarlar qorunur)
  const stmts = [];
  for (const row of rows) {
    const newOptions = (row.options || []).map((o) => {
      const az = o.text_az || o.text;
      const t = texts.get(az) || {};
      return {
        ...o,
        text_ru: o.text_ru || t.ru || null,
        text_tr: o.text_tr || t.tr || null,
        text_kk: o.text_kk || t.kk || null,
      };
    });
    stmts.push(`UPDATE public.epds_questions SET options = '${esc(JSON.stringify(newOptions))}'::jsonb WHERE id = '${row.id}';`);
  }

  const body = [
    '-- ============================================================',
    '-- Qazax6 — EPDS cavab variantlarının i18n düzəlişi (ru + tr + kk birdən)',
    '-- options jsonb-yə text_ru/text_tr/text_kk əlavə olunur.',
    '-- QEYD: ru/tr üçün də köhnə boşluq idi — depressiya testinin variantları',
    '-- bütün dillərdə az görünürdü. İdempotent (mövcud dəyərlər qorunur).',
    '-- ============================================================',
    '', '',
    stmts.join('\n\n'),
    '',
  ].join('\n');
  const outPath = path.join(__dirname, '..', '..', 'supabase', 'qazax', 'Qazax6.sql');
  fs.writeFileSync(outPath, body, 'utf8');
  console.log(`✓ supabase/qazax/Qazax6.sql — ${rows.length} UPDATE, ${Math.round(Buffer.byteLength(body, 'utf8') / 1024)}KB`);
})();

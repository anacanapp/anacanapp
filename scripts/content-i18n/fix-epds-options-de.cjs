/**
 * EPDS options jsonb — text_de əlavə edir (Alman5.sql).
 * Qazax6 pattern-i: diag token → epds_questions oxu → Azure (az→de) → UPDATE options.
 */
const fs = require('fs');
const path = require('path');

const envAz = path.join(__dirname, '.env.azure');
for (const line of fs.readFileSync(envAz, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const ENDPOINT = (process.env.AZURE_OPENAI_V1_ENDPOINT || '').replace(/\/$/, '');
const API_KEY = process.env.AZURE_API_KEY;
const MODEL = process.env.AZURE_MODEL || 'gpt-5.6-sol';

const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);

async function azureTranslate(payload) {
  const system = [
    'You translate answer options of the EPDS postnatal depression screening questionnaire for a motherhood app.',
    'Translate the JSON values from Azerbaijani to German. Use the informal "du" form where applicable.',
    'Rules: Return ONLY valid JSON with EXACTLY the same keys. Clinical accuracy is critical — preserve intensity/frequency nuances. No commentary.',
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
  const su = await fetch(URL_ + '/auth/v1/signup', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'diag_' + Date.now() + '@anacan-test.dev', password: 'Test1234!diag' }) });
  const d = await su.json();
  const H = { apikey: KEY, Authorization: 'Bearer ' + d.access_token };
  const r = await fetch(URL_ + '/rest/v1/epds_questions?select=id,sort_order,options&order=sort_order.asc', { headers: H });
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) { console.error('✗ epds_questions oxuna bilmədi'); process.exit(1); }
  console.log(`epds_questions: ${rows.length} sual`);

  const texts = new Map();
  for (const row of rows) {
    for (const o of row.options || []) {
      const az = o.text_az || o.text;
      if (az && !texts.has(az)) texts.set(az, null);
    }
  }
  const keys = [...texts.keys()];
  const payload = Object.fromEntries(keys.map((k, i) => [`t${i}`, k]));
  const out = await azureTranslate(payload);
  keys.forEach((k, i) => texts.set(k, out[`t${i}`] || null));
  console.log(`✓ ${keys.length} variant de-yə tərcümə olundu`);

  const stmts = [];
  for (const row of rows) {
    const newOptions = (row.options || []).map((o) => {
      const az = o.text_az || o.text;
      return { ...o, text_de: o.text_de || texts.get(az) || null };
    });
    stmts.push(`UPDATE public.epds_questions SET options = '${esc(JSON.stringify(newOptions))}'::jsonb WHERE id = '${row.id}';`);
  }

  const body = [
    '-- ============================================================',
    '-- Alman5 — EPDS cavab variantlarına text_de əlavə olunur',
    '-- QEYD: Qazax6-dan SONRA işlədin (mövcud text_ru/tr/kk qorunur — options',
    '-- massivi DB-dəki cari vəziyyətdən oxunub üzərinə de yazılıb).',
    '-- ============================================================',
    '', '',
    stmts.join('\n\n'),
    '',
  ].join('\n');
  const outPath = path.join(__dirname, '..', '..', 'supabase', 'alman', 'Alman5.sql');
  fs.writeFileSync(outPath, body, 'utf8');
  console.log(`✓ supabase/alman/Alman5.sql — ${rows.length} UPDATE`);
})();

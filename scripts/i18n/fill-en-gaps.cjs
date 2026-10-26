/**
 * 83 canlı açarın EN tərcüməsi (az→en) — en.json + Qazax7.sql (DB overlay, köhnə buildlər üçün).
 * Bu açarlar (billingscreen_* və s.) ru/tr seedlərdə var idi, amma EN heç yerdə yox idi —
 * EN istifadəçilər inline AZ default görürdü. kk auditi zamanı aşkarlandı.
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'content-i18n', '.env.azure');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const ENDPOINT = (process.env.AZURE_OPENAI_V1_ENDPOINT || '').replace(/\/$/, '');
const API_KEY = process.env.AZURE_API_KEY;
const MODEL = process.env.AZURE_MODEL || 'gpt-5.6-sol';

const ITEMS = JSON.parse(fs.readFileSync(path.join(__dirname, 'en-live-gaps.json'), 'utf8'));

const SYSTEM = [
  'You are a professional UI-string translator for a pregnancy & motherhood mobile app (Anacan).',
  'Translate the JSON values from Azerbaijani to English.',
  'Rules:',
  '1) Return ONLY valid JSON with EXACTLY the same keys. No commentary, no markdown fences.',
  '2) Preserve placeholders like {name}, {n} and emojis exactly.',
  '3) Keep brand words unchanged: Anacan, Premium, Dr.Anacan.',
  '4) Short UI strings (buttons, labels, toasts) — concise, natural product English.',
].join('\n');

(async () => {
  const payload = Object.fromEntries(ITEMS.map((x) => [x.key, x.az]));
  let body = {
    model: MODEL,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(payload) }],
    max_completion_tokens: 8000,
    response_format: { type: 'json_object' },
  };
  let parsed = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const resp = await fetch(`${ENDPOINT}/chat/completions`, {
      method: 'POST', headers: { 'api-key': API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (resp.status === 429 || resp.status >= 500) { await new Promise((r) => setTimeout(r, attempt * 5000)); continue; }
    if (!resp.ok) { console.error('HTTP', resp.status, (await resp.text()).slice(0, 200)); process.exit(1); }
    const data = await resp.json();
    const text = (data?.choices?.[0]?.message?.content || '').trim();
    parsed = JSON.parse(text.startsWith('```') ? text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') : text);
    break;
  }
  if (!parsed) { console.error('✗ tərcümə alınmadı'); process.exit(1); }

  // en.json yenilə (yalnız boşluqlar)
  const enPath = path.join(__dirname, '..', '..', 'src/locales/en.json');
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  let added = 0;
  for (const x of ITEMS) {
    const v = parsed[x.key];
    if (!en[x.key] && typeof v === 'string' && v.trim()) { en[x.key] = v; added++; }
  }
  fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf8');
  console.log(`✓ en.json: +${added} (indi ${Object.keys(en).length})`);

  // Qazax7.sql — DB overlay (köhnə bundle-lı buildlər DB-dən oxusun)
  const esc = (s) => String(s).replace(/'/g, "''");
  const rows = ITEMS.filter((x) => parsed[x.key]).map((x) => `  ('${esc(x.key)}', 'en', '${esc(parsed[x.key])}', 'common')`);
  const sqlBody = [
    '-- ============================================================',
    '-- Qazax7 — 83 canlı açarın EN dəyəri (kk auditi zamanı aşkarlanan köhnə EN boşluğu)',
    '-- billingscreen_* və s. — EN istifadəçilər inline AZ default görürdü.',
    '-- en.json-a da əlavə olunub (yeni buildlər); bu SQL köhnə buildlər üçündür. İdempotent.',
    '-- ============================================================',
    '',
    'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
    rows.join(',\n'),
    'ON CONFLICT (key, lang) DO NOTHING;',
    '',
  ].join('\n');
  const outPath = path.join(__dirname, '..', '..', 'supabase/qazax/Qazax7.sql');
  fs.writeFileSync(outPath, sqlBody, 'utf8');
  console.log(`✓ supabase/qazax/Qazax7.sql — ${rows.length} sətir`);
})();

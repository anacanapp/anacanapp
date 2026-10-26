/**
 * Kod-daxili (hardcoded) qısa mətnlərin ALMAN tərcüməsi — tək Azure job.
 * Mənbə payload translate-hardcoded-kk.cjs ilə eynidir (AZ mətnlər).
 * Nəticə: scripts/i18n/de-hardcoded.json
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

// PAYLOAD-u kk skriptindən oxu (eyni AZ mənbələr — tək mənbə həqiqəti)
const kkSrc = fs.readFileSync(path.join(__dirname, 'translate-hardcoded-kk.cjs'), 'utf8');
const m = kkSrc.match(/const PAYLOAD = (\{[\s\S]*?\n\});/);
if (!m) { console.error('✗ PAYLOAD tapılmadı'); process.exit(1); }
// eslint-disable-next-line no-eval
const PAYLOAD = eval(`(${m[1]})`);

const SYSTEM = [
  'You are a professional medical/parenting translator for a pregnancy & motherhood app (Anacan).',
  'Translate the JSON values from Azerbaijani to German (as used in German parenting apps).',
  'Rules:',
  '1) Return ONLY valid JSON with EXACTLY the same keys. No commentary, no markdown fences.',
  '2) Preserve placeholders EXACTLY as-is: {name} {n} {d} {names} {childName} {ageInstruction} {ageText} {theme} {hero} {moral} {style}.',
  '3) Preserve emojis and line breaks (\\n) exactly. Keep brand names unchanged: Anacan (app name), Premium, Dr.Anacan. EXCEPTION: "Anacan" as an affectionate address to the mother → "Mami".',
  '4) Use the informal "du" form (warm, familiar tone — standard in German motherhood apps). Use "Baby" for baby, "Periode" for period. Emergency number is 112.',
  '5) Medical accuracy over literal wording; warm, natural German.',
].join('\n');

(async () => {
  let body = {
    model: MODEL,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(PAYLOAD) }],
    max_completion_tokens: 16000,
    response_format: { type: 'json_object' },
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    const resp = await fetch(`${ENDPOINT}/chat/completions`, {
      method: 'POST', headers: { 'api-key': API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (resp.status === 429 || resp.status >= 500) {
      await new Promise((r) => setTimeout(r, attempt * 6000));
      continue;
    }
    if (!resp.ok) { console.error('HTTP', resp.status, (await resp.text()).slice(0, 200)); process.exit(1); }
    const data = await resp.json();
    const text = (data?.choices?.[0]?.message?.content || '').trim();
    const parsed = JSON.parse(text.startsWith('```') ? text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') : text);
    const missing = Object.keys(PAYLOAD).filter((k) => !parsed[k]);
    if (missing.length) { console.error('✗ çatışmayan açarlar:', missing.join(',')); process.exit(1); }
    fs.writeFileSync(path.join(__dirname, 'de-hardcoded.json'), JSON.stringify(parsed, null, 2), 'utf8');
    console.log(`✓ de-hardcoded.json — ${Object.keys(parsed).length} açar`);
    return;
  }
  console.error('✗ retries exhausted');
  process.exit(1);
})();

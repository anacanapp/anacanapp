/**
 * UI açarlarının Qazax (kk) tərcüməsi — az.json → kk.out.json (Azure OpenAI, lokal).
 * Resume dəstəkli: kk.out.json-dakı açarlar ötürülür (təkrar işə salmaq təhlükəsizdir).
 * İstifadə: node scripts/i18n/translate-ui-kk.cjs [--conc 3] [--keys 40] [--limit N]
 * Sonra:    node scripts/i18n/build-qazax-ui-sql.cjs   (kk.seed.json + Qazax2*.sql)
 */
const fs = require('fs');
const path = require('path');

// ── Azure env (content-i18n ilə eyni creds) ──
const envPath = path.join(__dirname, '..', 'content-i18n', '.env.azure');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const ENDPOINT = (process.env.AZURE_OPENAI_V1_ENDPOINT || '').replace(/\/$/, '');
const API_KEY = process.env.AZURE_API_KEY;
const MODEL = process.env.AZURE_MODEL || 'gpt-5.6-sol';
if (!ENDPOINT || !API_KEY) { console.error('✗ .env.azure natamam'); process.exit(1); }

const args = process.argv.slice(2);
const getOpt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : dflt; };
const CONC = getOpt('--conc', 3);
const KEYS_PER_CALL = getOpt('--keys', 40);
const LIMIT = getOpt('--limit', Infinity);

const AZ = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'locales', 'az.json'), 'utf8'));
const OUT_PATH = path.join(__dirname, 'kk.out.json');
const out = fs.existsSync(OUT_PATH) ? JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')) : {};

const SYSTEM = [
  'You are a professional UI-string translator for a pregnancy & motherhood mobile app (Anacan).',
  'Translate the JSON values from Azerbaijani to Kazakh (Cyrillic script, as used in Kazakhstan).',
  'Rules:',
  '1) Return ONLY valid JSON with EXACTLY the same keys. No commentary, no markdown fences.',
  '2) Preserve placeholders like {name}, {n}, {days}, %s, and emojis, line breaks (\\n) EXACTLY.',
  '3) Keep brand names unchanged: Anacan (app name), Premium, Dr.Anacan. EXCEPTION: "Anacan" as an affectionate address to the mother → «Анашым».',
  '4) These are short UI strings (buttons, labels, toasts) — keep them concise and natural.',
  '5) Use the formal «Сіз» form. Use «етеккір» for period/menstruation, «бөпе» for baby, «ДДСҰ» for WHO. Emergency number is 103.',
  '6) Medical accuracy over literal wording; warm tone for mothers.',
].join('\n');

async function callAzure(user, maxTokens) {
  let body = {
    model: MODEL,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
    max_completion_tokens: maxTokens,
    response_format: { type: 'json_object' },
  };
  for (let attempt = 1; attempt <= 6; attempt++) {
    const resp = await fetch(`${ENDPOINT}/chat/completions`, {
      method: 'POST', headers: { 'api-key': API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (resp.status === 429 || resp.status >= 500) {
      const ra = Number(resp.headers.get('retry-after')) || attempt * 5;
      await new Promise((r) => setTimeout(r, ra * 1000));
      continue;
    }
    if (resp.status === 400) {
      const t = await resp.text();
      if (/max_completion_tokens|unsupported/i.test(t) && body.max_completion_tokens) {
        body = { ...body, max_tokens: body.max_completion_tokens };
        delete body.max_completion_tokens;
        continue;
      }
      throw new Error(`HTTP 400: ${t.slice(0, 200)}`);
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('empty');
    return text;
  }
  throw new Error('retries exhausted');
}

const stripFences = (s) => {
  const t = String(s).trim();
  return t.startsWith('```') ? t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim() : t;
};

(async () => {
  const todo = Object.entries(AZ)
    .filter(([k, v]) => typeof v === 'string' && v.trim() && !out[k])
    .slice(0, LIMIT);
  console.log(`UI kk: cəmi ${Object.keys(AZ).length} açar, hazır ${Object.keys(out).length}, tərcümə olunacaq ${todo.length} | model: ${MODEL}`);
  if (!todo.length) return;

  const groups = [];
  for (let i = 0; i < todo.length; i += KEYS_PER_CALL) groups.push(todo.slice(i, i + KEYS_PER_CALL));

  let doneCalls = 0, okKeys = 0, failKeys = 0;
  const t0 = Date.now();
  const save = () => fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 1), 'utf8');

  async function processGroup(group) {
    const payload = Object.fromEntries(group);
    const est = JSON.stringify(payload).length;
    const maxTok = Math.min(16000, Math.max(2000, Math.round(est * 1.6)));
    try {
      const text = await callAzure(JSON.stringify(payload), maxTok);
      const parsed = JSON.parse(stripFences(text));
      for (const [k, src] of group) {
        const v = parsed[k];
        if (typeof v === 'string' && v.trim()) { out[k] = v; okKeys++; }
        else { failKeys++; }
      }
    } catch (e) {
      // qrup alınmadı → yarıya böl, tək-tək yox (vaxt qənaəti); 1 key qalanda tək cəhd
      if (group.length > 1) {
        const mid = Math.ceil(group.length / 2);
        await processGroup(group.slice(0, mid));
        await processGroup(group.slice(mid));
        return;
      }
      failKeys++;
      console.log(`  ✗ ${group[0][0]}: ${e.message.slice(0, 100)}`);
    }
    doneCalls++;
    if (doneCalls % 5 === 0) {
      save();
      console.log(`  ${okKeys} açar | ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }

  let idx = 0;
  async function worker() { while (idx < groups.length) await processGroup(groups[idx++]); }
  await Promise.all(Array.from({ length: Math.min(CONC, groups.length) }, worker));
  save();
  console.log(`✓ UI kk bitdi: ${okKeys} uğurlu, ${failKeys} uğursuz | cəmi hazır: ${Object.keys(out).length}/${Object.keys(AZ).length} | ${Math.round((Date.now() - t0) / 1000)}s`);
})();

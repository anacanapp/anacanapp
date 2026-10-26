/**
 * kk-missing-keys.json → Azure → kk.out.json-a merge (resume-safe).
 * Mənbə dili açar-açar fərqlidir (az/ru/tr/en) — mənbə dilinə görə qruplaşdırılır.
 * İstifadə: node scripts/i18n/translate-ui-kk-missing.cjs [--conc 4] [--keys 35]
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

const args = process.argv.slice(2);
const getOpt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const CONC = getOpt('--conc', 4);
const KEYS_PER_CALL = getOpt('--keys', 35);

const MISSING = JSON.parse(fs.readFileSync(path.join(__dirname, 'kk-missing-keys.json'), 'utf8'));
const OUT_PATH = path.join(__dirname, 'kk.out.json');
const out = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));

const SRC_NAMES = { az: 'Azerbaijani', ru: 'Russian', tr: 'Turkish', en: 'English' };
const systemFor = (srcLang) => [
  'You are a professional UI-string translator for a pregnancy & motherhood mobile app (Anacan).',
  `Translate the JSON values from ${SRC_NAMES[srcLang]} to Kazakh (Cyrillic script, as used in Kazakhstan).`,
  'Rules:',
  '1) Return ONLY valid JSON with EXACTLY the same keys. No commentary, no markdown fences.',
  '2) Preserve placeholders like {name}, {n}, {days}, %s, and emojis, line breaks (\\n) EXACTLY.',
  '3) Keep brand names unchanged: Anacan (app name), Premium, Dr.Anacan. EXCEPTION: "Anacan" as an affectionate address to the mother → «Анашым».',
  '4) These are short UI strings (buttons, labels, toasts) — keep them concise and natural.',
  '5) Use the formal «Сіз» form. Use «етеккір» for period/menstruation, «бөпе» for baby, «ДДСҰ» for WHO. Emergency number is 103.',
  '6) Medical accuracy over literal wording; warm tone for mothers.',
].join('\n');

async function callAzure(system, user, maxTokens) {
  let body = {
    model: MODEL,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
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
  const todo = MISSING.filter((x) => x.src && x.srcLang && !out[x.key]);
  console.log(`Çatışmayan: ${MISSING.length}, tərcümə olunacaq: ${todo.length} | model: ${MODEL}`);
  if (!todo.length) { console.log('Hər şey hazırdır.'); return; }

  // Mənbə dilinə görə qruplaşdır
  const bySrc = {};
  for (const x of todo) (bySrc[x.srcLang] = bySrc[x.srcLang] || []).push(x);

  let okKeys = 0, failKeys = 0, doneCalls = 0;
  const t0 = Date.now();
  const save = () => fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 1), 'utf8');

  for (const [srcLang, items] of Object.entries(bySrc)) {
    const system = systemFor(srcLang);
    const groups = [];
    for (let i = 0; i < items.length; i += KEYS_PER_CALL) groups.push(items.slice(i, i + KEYS_PER_CALL));
    console.log(`— mənbə ${srcLang}: ${items.length} açar, ${groups.length} çağırış`);

    async function processGroup(group) {
      const payload = Object.fromEntries(group.map((x) => [x.key, x.src]));
      const est = JSON.stringify(payload).length;
      const maxTok = Math.min(16000, Math.max(2000, Math.round(est * 1.6)));
      try {
        const text = await callAzure(system, JSON.stringify(payload), maxTok);
        const parsed = JSON.parse(stripFences(text));
        for (const x of group) {
          const v = parsed[x.key];
          if (typeof v === 'string' && v.trim()) { out[x.key] = v; okKeys++; }
          else failKeys++;
        }
      } catch (e) {
        if (group.length > 1) {
          const mid = Math.ceil(group.length / 2);
          await processGroup(group.slice(0, mid));
          await processGroup(group.slice(mid));
          return;
        }
        failKeys++;
        console.log(`  ✗ ${group[0].key}: ${e.message.slice(0, 100)}`);
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
    idx = 0;
  }

  save();
  console.log(`✓ Bitdi: ${okKeys} uğurlu, ${failKeys} uğursuz | ${Math.round((Date.now() - t0) / 1000)}s`);
})();

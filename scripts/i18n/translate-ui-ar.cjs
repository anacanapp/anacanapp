/**
 * UI açarlarının ƏRƏB (ar) tərcüməsi — kanonik açar dəsti kk.seed.json-dur.
 * Mənbə prioriteti: az.json > en.json > ru.seed > tr.seed. Resume dəstəkli (ar.out.json).
 * İstifadə: node scripts/i18n/translate-ui-ar.cjs [--conc 4] [--keys 35] [--limit N]
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
if (!ENDPOINT || !API_KEY) { console.error('✗ .env.azure natamam'); process.exit(1); }

const args = process.argv.slice(2);
const getOpt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const CONC = getOpt('--conc', 4);
const KEYS_PER_CALL = getOpt('--keys', 35);
const LIMIT = getOpt('--limit', Infinity);

const KK = JSON.parse(fs.readFileSync(path.join(__dirname, 'kk.seed.json'), 'utf8'));
const AZ = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src/locales/az.json'), 'utf8'));
const EN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src/locales/en.json'), 'utf8'));
const RU = JSON.parse(fs.readFileSync(path.join(__dirname, 'ru.seed.json'), 'utf8'));
const TR = JSON.parse(fs.readFileSync(path.join(__dirname, 'tr.seed.json'), 'utf8'));

const OUT_PATH = path.join(__dirname, 'ar.out.json');
const out = fs.existsSync(OUT_PATH) ? JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')) : {};

const SRC_NAMES = { az: 'Azerbaijani', en: 'English', ru: 'Russian', tr: 'Turkish' };
const systemFor = (srcLang) => [
  'You are a professional UI-string translator for a pregnancy & motherhood mobile app (Anacan).',
  `Translate the JSON values from ${SRC_NAMES[srcLang]} to Modern Standard Arabic (فصحى).`,
  'Rules:',
  '1) Return ONLY valid JSON with EXACTLY the same keys. No commentary, no markdown fences.',
  '2) Preserve placeholders like {name}, {n}, {days}, {percent}, %s EXACTLY (Latin as-is). Preserve emojis and line breaks (\\n) EXACTLY.',
  '3) Keep brand names unchanged: Anacan (app name), Premium, Dr.Anacan. EXCEPTION: "Anacan" as an affectionate address to the mother → «ماما».',
  '4) These are short UI strings (buttons, labels, toasts) — keep them concise and natural.',
  '5) ALWAYS address the mother in the FEMININE second-person singular (أنتِ — اكتبي، تناولي، استشيري).',
  '6) «الدورة الشهرية» for period, «طفلكِ»/«رضيعكِ» for baby, «منظمة الصحة العالمية» for WHO. If a specific emergency number (103/112) appears, write «اتصلي بخدمات الطوارئ المحلية» instead.',
  '7) Numbers inside Arabic text may use Arabic-Indic numerals (٠١٢٣), but NOT inside placeholders.',
  '8) Medical accuracy over literal wording; warm tone for mothers.',
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
  const items = [];
  for (const k of Object.keys(KK)) {
    if (out[k]) continue;
    const src = AZ[k] ?? EN[k] ?? RU[k] ?? TR[k];
    const srcLang = AZ[k] ? 'az' : EN[k] ? 'en' : RU[k] ? 'ru' : TR[k] ? 'tr' : null;
    if (typeof src === 'string' && src.trim() && srcLang) items.push({ key: k, src, srcLang });
  }
  const todo = items.slice(0, LIMIT);
  console.log(`UI ar: kanonik ${Object.keys(KK).length}, hazır ${Object.keys(out).length}, tərcümə olunacaq ${todo.length} | model: ${MODEL}`);
  if (!todo.length) return;

  const bySrc = {};
  for (const x of todo) (bySrc[x.srcLang] = bySrc[x.srcLang] || []).push(x);

  let okKeys = 0, failKeys = 0, doneCalls = 0;
  const t0 = Date.now();
  // OneDrive/sync kilidlərinə davamlı atomic save (temp + rename, 3 retry)
  const save = () => {
    for (let a = 0; a < 3; a++) {
      try {
        const tmp = OUT_PATH + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(out, null, 1), 'utf8');
        fs.renameSync(tmp, OUT_PATH);
        return;
      } catch (e) {
        if (a === 2) console.log('  ⚠ save alınmadı:', e.code);
        else { const w = Date.now() + 400; while (Date.now() < w) { /* qısa gözləmə */ } }
      }
    }
  };

  for (const [srcLang, list] of Object.entries(bySrc)) {
    const system = systemFor(srcLang);
    const groups = [];
    for (let i = 0; i < list.length; i += KEYS_PER_CALL) groups.push(list.slice(i, i + KEYS_PER_CALL));
    console.log(`— mənbə ${srcLang}: ${list.length} açar, ${groups.length} çağırış`);

    async function processGroup(group) {
      const payload = Object.fromEntries(group.map((x) => [x.key, x.src]));
      const est = JSON.stringify(payload).length;
      const maxTok = Math.min(16000, Math.max(2000, Math.round(est * 1.8)));
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
  }

  save();
  console.log(`✓ UI ar bitdi: ${okKeys} uğurlu, ${failKeys} uğursuz | cəmi: ${Object.keys(out).length} | ${Math.round((Date.now() - t0) / 1000)}s`);
})();

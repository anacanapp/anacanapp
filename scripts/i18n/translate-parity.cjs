/**
 * PARİTET doldurma: en/ru/tr → kanonik dəst (kk.seed açarları).
 * en: 11 açar; ru/tr: 3743 açar hər biri. Mənbə: az.json ?? en.json.
 * Resume dəstəkli (hədəf seed-də olan açar ötürülür).
 * İstifadə: node scripts/i18n/translate-parity.cjs [--conc 5] [--keys 40]
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
const CONC = getOpt('--conc', 5);
const KEYS_PER_CALL = getOpt('--keys', 40);

const ROOT = path.join(__dirname, '..', '..');
const AZ = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/az.json'), 'utf8'));
const EN = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/en.json'), 'utf8'));
const KK = JSON.parse(fs.readFileSync(path.join(__dirname, 'kk.seed.json'), 'utf8'));
const CANON = Object.keys(KK);

const TARGETS = {
  en: { file: path.join(ROOT, 'src/locales/en.json'), style: 'English. Concise, natural product English.' },
  ru: { file: path.join(__dirname, 'ru.seed.json'), style: 'Russian. Use the formal «вы» form. «менструация» for period, «малыш» for baby, «ВОЗ» for WHO. Emergency 103.' },
  tr: { file: path.join(__dirname, 'tr.seed.json'), style: 'Turkish. Use the formal "siz" form. "regl" for period, "bebek" for baby, "DSÖ" for WHO. Emergency 112.' },
};

const SRC_NAMES = { az: 'Azerbaijani', en: 'English' };
const systemFor = (srcLang, tgt) => [
  'You are a professional UI-string translator for a pregnancy & motherhood mobile app (Anacan).',
  `Translate the JSON values from ${SRC_NAMES[srcLang]} to ${TARGETS[tgt].style}`,
  'Rules:',
  '1) Return ONLY valid JSON with EXACTLY the same keys. No commentary, no markdown fences.',
  '2) Preserve placeholders like {name}, {n}, {days}, {percent}, %s, emojis and line breaks (\\n) EXACTLY.',
  '3) Keep brand names unchanged: Anacan (app name), Premium, Dr.Anacan. EXCEPTION: "Anacan" as an affectionate address to the mother → ru «мамочка», tr "anneciğim", en "Mommy".',
  '4) Short UI strings (buttons, labels, toasts) — concise and natural.',
  '5) Medical accuracy over literal wording; warm tone for mothers.',
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
  for (const tgt of ['en', 'ru', 'tr']) {
    const filePath = TARGETS[tgt].file;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const items = [];
    for (const k of CANON) {
      if (data[k]) continue;
      const src = tgt === 'en' ? AZ[k] : (AZ[k] ?? EN[k]);
      const srcLang = tgt === 'en' ? 'az' : (AZ[k] ? 'az' : 'en');
      if (typeof src === 'string' && src.trim()) items.push({ key: k, src, srcLang });
    }
    console.log(`\n══ ${tgt}: çatışmır ${items.length} ══`);
    if (!items.length) continue;

    const bySrc = {};
    for (const x of items) (bySrc[x.srcLang] = bySrc[x.srcLang] || []).push(x);

    let ok = 0, fail = 0, calls = 0;
    const t0 = Date.now();
    const save = () => fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

    for (const [srcLang, list] of Object.entries(bySrc)) {
      const system = systemFor(srcLang, tgt);
      const groups = [];
      for (let i = 0; i < list.length; i += KEYS_PER_CALL) groups.push(list.slice(i, i + KEYS_PER_CALL));

      async function processGroup(group) {
        const payload = Object.fromEntries(group.map((x) => [x.key, x.src]));
        const est = JSON.stringify(payload).length;
        const maxTok = Math.min(16000, Math.max(2000, Math.round(est * 1.6)));
        try {
          const text = await callAzure(system, JSON.stringify(payload), maxTok);
          const parsed = JSON.parse(stripFences(text));
          for (const x of group) {
            const v = parsed[x.key];
            if (typeof v === 'string' && v.trim()) { data[x.key] = v; ok++; }
            else fail++;
          }
        } catch (e) {
          if (group.length > 1) {
            const mid = Math.ceil(group.length / 2);
            await processGroup(group.slice(0, mid));
            await processGroup(group.slice(mid));
            return;
          }
          fail++;
          console.log(`  ✗ ${group[0].key}: ${e.message.slice(0, 80)}`);
        }
        calls++;
        if (calls % 8 === 0) { save(); console.log(`  ${tgt}: ${ok} açar | ${Math.round((Date.now() - t0) / 1000)}s`); }
      }

      let idx = 0;
      async function worker() { while (idx < groups.length) await processGroup(groups[idx++]); }
      await Promise.all(Array.from({ length: Math.min(CONC, groups.length) }, worker));
    }
    save();
    console.log(`✓ ${tgt} bitdi: +${ok} (${fail} uğursuz) | cəmi: ${Object.keys(data).length} | ${Math.round((Date.now() - t0) / 1000)}s`);
  }
})();

/**
 * uz.seed.json GENERATORU — bütün statik UI açarlarının Özbəkcəyə tərcüməsi.
 *
 * Mənbə: ru.seed.json açar dəsti (kanonik, 8934 açar) + mətn mənbəyi kimi
 *   az.json (birinci) → en.json (ikinci) → ru.seed (son ehtiyat).
 * Çıxış: scripts/i18n/uz.out/batch_*.json (davam etdirilə bilən) →
 *   assemble addımı scripts/i18n/uz.seed.json yığır.
 *
 * İstifadə:
 *   node scripts/i18n/translate-seed-uz.cjs            # tərcümə (resume dəstəkli)
 *   node scripts/i18n/translate-seed-uz.cjs --assemble # yalnız yekun faylı yığ
 *
 * Kimlik: scripts/content-i18n/.env.azure (kk/de/ar seed-ləri ilə eyni boru xətti)
 */
const fs = require('fs');
const path = require('path');

// ── Env ──
const envPath = path.join(__dirname, '..', 'content-i18n', '.env.azure');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const ENDPOINT = (process.env.AZURE_OPENAI_V1_ENDPOINT || '').replace(/\/$/, '');
const API_KEY = process.env.AZURE_API_KEY;
const MODEL = process.env.AZURE_MODEL || 'gpt-5.6-sol';
if (!ENDPOINT || !API_KEY) { console.error('✗ .env.azure yoxdur'); process.exit(1); }

const ROOT = path.join(__dirname, '..', '..');
const OUT_DIR = path.join(__dirname, 'uz.out');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const az = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/az.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/en.json'), 'utf8'));
const ru = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/i18n/ru.seed.json'), 'utf8'));

// Kanonik açar dəsti: ru.seed ∪ az.json (hər ehtimala qarşı)
const keys = Array.from(new Set([...Object.keys(ru), ...Object.keys(az)])).sort();
const sourceOf = (k) => az[k] ?? en[k] ?? ru[k] ?? '';

const SYSTEM = [
  `You are a professional medical/parenting content translator for a pregnancy & motherhood app (Anacan).`,
  `Translate the JSON values to UZBEK (o'zbek tili, LATIN script, as used in Uzbekistan). Source values are Azerbaijani or English.`,
  `Rules:`,
  `1) Return ONLY valid JSON with EXACTLY the same keys. No extra keys, no commentary, no markdown fences.`,
  `2) Preserve emojis, line breaks (\\n), HTML/Markdown tags, numbers, units and placeholders like {n}, {name}, {x} EXACTLY as-is.`,
  `3) Keep brand/product names unchanged: Anacan (app name), Premium, Dr.Anacan, Google, Apple. EXCEPTION: when "Anacan" is an affectionate address to the mother (baby speaking to mom, e.g. "Anacan, ..."), translate it as "Onajon".`,
  `4) Use the polite "siz" form when addressing the user. Warm, natural, modern Uzbek — real sentences, not word-for-word.`,
  `5) Terminology: homiladorlik (pregnancy), chaqaloq (baby), hayz (period/menstruation), tug'ruq (birth), JSST (WHO). Emergency number is 103.`,
  `6) Use proper Uzbek Latin orthography: oʻ/gʻ may be written as o'/g' (apostrophe form). Keep translations similar in LENGTH to the source (UI labels must stay short).`,
].join('\n');

function stripFences(s) {
  const t = String(s).trim();
  if (t.startsWith('```')) return t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return t;
}

async function callAzure(user, maxTokens) {
  const url = `${ENDPOINT}/chat/completions`;
  let body = {
    model: MODEL,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
    max_completion_tokens: maxTokens,
    response_format: { type: 'json_object' },
  };
  for (let attempt = 1; attempt <= 6; attempt++) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body),
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
      throw new Error(`HTTP 400: ${t.slice(0, 300)}`);
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('empty response');
    return text;
  }
  throw new Error('retries exhausted');
}

const BATCH = 40;
const CONC = 5;

function loadDone() {
  const done = {};
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (!f.endsWith('.json')) continue;
    try { Object.assign(done, JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))); } catch {}
  }
  return done;
}

function assemble() {
  const done = loadDone();
  const out = {};
  let missing = 0;
  for (const k of keys) {
    if (done[k] && String(done[k]).trim()) out[k] = done[k];
    else missing++;
  }
  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(path.join(__dirname, 'uz.seed.json'), JSON.stringify(sorted, null, 2) + '\n');
  console.log(`uz.seed.json yazıldı: ${Object.keys(sorted).length} açar (çatışmayan: ${missing})`);
  return missing;
}

(async () => {
  if (process.argv.includes('--assemble')) { assemble(); return; }

  const done = loadDone();
  const todo = keys.filter((k) => !(k in done) && String(sourceOf(k)).trim());
  console.log(`Cəmi: ${keys.length} | hazır: ${Object.keys(done).length} | qalan: ${todo.length}`);

  const batches = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));

  let completed = 0, failed = 0;
  let idx = 0;
  async function worker(wid) {
    while (idx < batches.length) {
      const my = idx++;
      const batchKeys = batches[my];
      const payload = {};
      for (const k of batchKeys) payload[k] = sourceOf(k);
      const approxTokens = Math.min(16000, Math.max(2000, JSON.stringify(payload).length));
      try {
        const text = await callAzure(JSON.stringify(payload), approxTokens);
        const parsed = JSON.parse(stripFences(text));
        const ok = {};
        for (const k of batchKeys) {
          const v = parsed?.[k];
          if (typeof v === 'string' && v.trim()) ok[k] = v;
        }
        if (Object.keys(ok).length === 0) throw new Error('no valid keys in response');
        fs.writeFileSync(path.join(OUT_DIR, `batch_${String(my).padStart(4, '0')}.json`), JSON.stringify(ok, null, 1));
        completed++;
        const got = Object.keys(ok).length;
        console.log(`[w${wid}] batch ${my + 1}/${batches.length} ✓ (${got}/${batchKeys.length})${got < batchKeys.length ? ' — natamam, sonra retry' : ''}`);
      } catch (e) {
        failed++;
        console.log(`[w${wid}] batch ${my + 1}/${batches.length} ✗ ${e.message.slice(0, 120)}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONC }, (_, i) => worker(i + 1)));
  console.log(`Bitdi: ${completed} batch ✓, ${failed} ✗. Natamamlar üçün skripti təkrar işə salın.`);
  const missing = assemble();
  if (missing > 0) console.log(`⚠ ${missing} açar hələ boşdur — skripti yenidən işə salın (resume).`);
})();

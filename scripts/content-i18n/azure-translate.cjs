/**
 * Content i18n — Azure OpenAI ilə LOKAL toplu tərcümə (edge function TƏLƏB ETMİR).
 *
 * Axın: chunks/<table>.json (AZ mənbə) → Azure GPT → out/<lang>/_batchNNN.json →
 *       validate.cjs → build-sql.cjs → migrasiya (COALESCE, idempotent).
 *
 * Kimlik məlumatları: scripts/content-i18n/.env.azure (gitignore-dadır)
 *   AZURE_OPENAI_V1_ENDPOINT=https://<resource>.openai.azure.com/openai/v1
 *   AZURE_API_KEY=...
 *   AZURE_MODEL=gpt-5.6-sol   (və ya claude-sonnet-4-5 və s. — /openai/v1 üzərindən)
 *
 * İstifadə:
 *   node scripts/content-i18n/azure-translate.cjs <table> <lang> [--from N] [--to M] [--rows K] [--conc C] [--dry]
 *   node scripts/content-i18n/azure-translate.cjs baby_daily_info tr --from 185 --to 400
 *   node scripts/content-i18n/azure-translate.cjs mommy_daily_messages ru            (bütün qalanlar)
 *
 * Qeydlər:
 *   - Artıq out/<lang>/*.json-da olan sətirlər avtomatik ötürülür (dedupe) — əl tərcümələri toxunulmaz.
 *   - --from/--to _o (gün/sıra) sahəsinə görə filtrdir; _o yoxdursa bütün sətirlər.
 *   - Hər 5 uğurlu çağırışdan bir nəticə diskə yazılır (autosave).
 */
const fs = require('fs');
const path = require('path');

// ── Env yüklə ──
const envPath = path.join(__dirname, '.env.azure');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const ENDPOINT = (process.env.AZURE_OPENAI_V1_ENDPOINT || '').replace(/\/$/, '');
const API_KEY = process.env.AZURE_API_KEY;
const MODEL = process.env.AZURE_MODEL || 'gpt-5.6-sol';
if (!ENDPOINT || !API_KEY) {
  console.error('✗ .env.azure tapılmadı və ya natamamdır (AZURE_OPENAI_V1_ENDPOINT, AZURE_API_KEY)');
  process.exit(1);
}

// ── Cədvəl reyestri (translate-content edge fn ilə sinxron) ──
const REGISTRY = {
  pregnancy_daily_content: {
    text: ['baby_development', 'baby_message', 'baby_size_fruit', 'body_changes', 'daily_tip',
      'doctor_visit_tip', 'emotional_tip', 'exercise_tip', 'mother_tips', 'mother_warnings',
      'nutrition_tip', 'partner_tip'],
    arr: ['foods_to_avoid', 'mother_symptoms', 'recommended_exercises', 'recommended_foods', 'tests_to_do'],
  },
  weekly_tips: { text: ['title', 'content'], json: ['tips'] },
  baby_daily_info: { text: ['info'] },
  mommy_daily_messages: { text: ['message'] },
  admin_recipes: { text: ['title', 'description', 'category'], arr: ['tags'], json: ['ingredients', 'instructions'] },
  nutrition_tips: { text: ['title', 'content'] },
  trimester_tips: { text: ['tip_text'] },
  blog_posts: { text: ['title', 'excerpt', 'content'] },
  blog_categories: { text: ['name', 'description'] },
  faqs: { text: ['question', 'answer'] },
  development_tips: { text: ['title', 'content'] },
  partner_daily_tips: { text: ['tip_text'] },
  flow_insights: { text: ['title', 'content'] },
  flow_phase_tips: { text: ['tip_text'] },
  epds_questions: { text: ['question_text'] },
  hospital_bag_templates: { text: ['item_name', 'notes'] },
  onboarding_stages: { text: ['title', 'subtitle', 'description'] },
  first_aid_scenarios: { text: ['title', 'description'] },
  first_aid_steps: { text: ['title', 'instruction'] },
  play_activities: { text: ['title', 'description', 'instructions'] },
  baby_crisis_periods: { text: ['title', 'description'], arrText: ['symptoms', 'tips'] },
  mental_health_resources: { text: ['name', 'description'] },
  breathing_exercises: { text: ['name', 'description'] },
  vitamins: { text: ['dosage', 'name', 'description'], arr: ['benefits', 'food_sources'] }, // importance qəsdən yoxdur (badge məntiqi)
  exercises: { text: ['description'] },
  intro_slides: { text: ['title', 'subtitle', 'description'] },
  products: { text: ['name', 'description', 'category'] },
  cakes: { text: ['name', 'description', 'milestone_label'] },
  baby_names_db: { text: ['origin', 'meaning'] },
};

// Əlavə reyestr (scan-gaps nəticəsində yaradılan yeni cədvəllər)
const extraPath = path.join(__dirname, 'registry-extra.json');
if (fs.existsSync(extraPath)) {
  const extra = JSON.parse(fs.readFileSync(extraPath, 'utf8'));
  for (const [t, cfg] of Object.entries(extra)) REGISTRY[t] = REGISTRY[t] || cfg;
}

const LANG_NAMES = { ru: 'Russian', tr: 'Turkish', en: 'English', kk: 'Kazakh', de: 'German', ar: 'Arabic', uz: 'Uzbek', ka: 'Georgian' };

function buildSystemPrompt(lang) {
  const target = LANG_NAMES[lang];
  const style = lang === 'ru'
    ? 'Use the formal «вы» form when addressing the user. Use «менструация» for period, «малыш» for baby, «ВОЗ» for WHO. Emergency number is 103.'
    : lang === 'tr'
      ? 'Use the formal "siz" form when addressing the user. Use "regl" for period, "bebek" for baby, "DSÖ" for WHO. Emergency number is 112.'
      : lang === 'uz'
        ? 'Write natural modern Uzbek (LATIN script) as used in Uzbekistan. Use the formal "siz" form when addressing the user. Use "hayz" for period/menstruation, "chaqaloq" for baby, "JSST" for WHO. Emergency number is 103.'
      : lang === 'ka'
        ? 'Write natural modern Georgian (Mkhedruli script). Use the formal «თქვენ» form when addressing the user. Use «მენსტრუაცია» for period/menstruation, «ბავშვი» for baby, «ჯანმო» for WHO. Emergency number is 112.'
      : lang === 'kk'
        ? 'Write natural modern Kazakh (Cyrillic script) as used in Kazakhstan. Use the formal «Сіз» form when addressing the user. Use «етеккір» for period/menstruation, «бөпе» for baby, «ДДСҰ» for WHO. Emergency number is 103.'
        : lang === 'de'
          ? 'Write natural German as used in German parenting apps. Use the informal "du" form when addressing the user (warm, familiar tone — standard in German motherhood apps). Use "Baby" for baby, "Periode" for period, "WHO" for WHO. Emergency number is 112.'
          : lang === 'ar'
            ? 'Write Modern Standard Arabic (فصحى). ALWAYS address the mother in the FEMININE second-person singular (أنتِ — e.g. اكتبي، تناولي، استشيري). Use «الدورة الشهرية» for period, «طفلكِ»/«رضيعكِ» for baby, «منظمة الصحة العالمية» for WHO. Where the source mentions a specific emergency number (103/112), write «اتصلي بخدمات الطوارئ المحلية» instead (Arab countries differ). Numbers INSIDE Arabic sentences may use Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩), but placeholders like {n}, {days} must stay EXACTLY as-is.'
            : 'Use a warm, professional tone.';
  return [
    `You are a professional medical/parenting content translator for a pregnancy & motherhood app (Anacan).`,
    `Translate the JSON values from Azerbaijani to ${target}.`,
    `Rules:`,
    `1) Return ONLY valid JSON with EXACTLY the same keys and nested field names. No extra keys, no commentary, no markdown fences.`,
    `2) String values stay strings; array values stay arrays with the same length and order.`,
    `3) Preserve emojis, line breaks (\\n), HTML/Markdown formatting, numbers, units and placeholders like {x} exactly.`,
    `4) Keep brand/product names unchanged: Anacan (app name), Premium, Dr.Anacan. EXCEPTION: when "Anacan" is an affectionate address to the mother (baby speaking to mom, e.g. "Anacan, ..."), translate it: ru «мамочка», tr "anneciğim", kk «анашым», de "Mami", ar «ماما», en "Mommy", uz "Onajon" (capitalize at sentence start), ka «დედიკო».`,
    `5) Translate meaning naturally (real sentences, not word-for-word); adapt idioms; medical accuracy over literal wording; warm tone for mothers. ${style}`,
  ].join('\n');
}

function stripFences(s) {
  const t = String(s).trim();
  if (t.startsWith('```')) return t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return t;
}

// ── Azure çağırışı (retry + temperature fallback) ──
async function callAzure(system, user, maxTokens) {
  const url = `${ENDPOINT}/chat/completions`;
  let body = {
    model: MODEL,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    max_completion_tokens: maxTokens,
    response_format: { type: 'json_object' },
  };
  for (let attempt = 1; attempt <= 5; attempt++) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'api-key': API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (resp.status === 429 || resp.status >= 500) {
      const ra = Number(resp.headers.get('retry-after')) || attempt * 5;
      process.stdout.write(`  … HTTP ${resp.status}, ${ra}s gözlənilir\n`);
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
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('empty response');
    return text;
  }
  throw new Error('retries exhausted (429/5xx)');
}

// ── Nəticə yoxlaması ──
function validateOut(payload, out) {
  const fixed = {};
  for (const [field, src] of Object.entries(payload)) {
    const v = out?.[field];
    if (v === null || v === undefined) return { ok: false, why: `missing field ${field}` };
    if (Array.isArray(src)) {
      if (!Array.isArray(v) || v.length !== src.length) return { ok: false, why: `array mismatch ${field}` };
      fixed[field] = v.map(String);
    } else {
      if (typeof v !== 'string' || !v.trim()) return { ok: false, why: `empty ${field}` };
      fixed[field] = v;
    }
  }
  return { ok: true, value: fixed };
}

(async () => {
  const args = process.argv.slice(2);
  const table = args[0];
  const lang = args[1];
  const getOpt = (name, dflt) => {
    const i = args.indexOf(name);
    return i >= 0 ? Number(args[i + 1]) : dflt;
  };
  const FROM = getOpt('--from', -Infinity);
  const TO = getOpt('--to', Infinity);
  const ROWS_PER_CALL = getOpt('--rows', 6);
  const CONC = getOpt('--conc', 3);
  const DRY = args.includes('--dry');
  const FORCE = args.includes('--force'); // dedupe-u ötür (qismən sahə tərcüməsi üçün)
  const fieldsIdx = args.indexOf('--fields'); // yalnız bu sahələri tərcümə et
  const FIELDS_OVERRIDE = fieldsIdx >= 0 ? args[fieldsIdx + 1].split(',') : null;

  const cfg = REGISTRY[table];
  if (!cfg || !LANG_NAMES[lang]) {
    console.error(`İstifadə: node azure-translate.cjs <table> <ru|tr|en> [--from N] [--to M] [--rows K] [--conc C] [--dry]`);
    console.error(`Cədvəllər: ${Object.keys(REGISTRY).join(', ')}`);
    process.exit(1);
  }
  let allFields = [...(cfg.text || []), ...(cfg.arr || []), ...(cfg.json || []), ...(cfg.arrText || [])];
  if (FIELDS_OVERRIDE) allFields = FIELDS_OVERRIDE;

  // Mənbə
  const chunkPath = path.join(__dirname, 'chunks', `${table}.json`);
  if (!fs.existsSync(chunkPath)) { console.error(`✗ chunk yoxdur: ${chunkPath} (əvvəl export.cjs)`); process.exit(1); }
  let rows = JSON.parse(fs.readFileSync(chunkPath, 'utf8'));
  if (!Array.isArray(rows)) rows = rows.rows || Object.values(rows);
  rows.sort((a, b) => (a._o ?? 0) - (b._o ?? 0));
  rows = rows.filter((r) => (r._o === undefined) || (r._o >= FROM && r._o <= TO));

  // Dedupe: out/<lang>/*.json-dakı mövcud id-lər
  const outDir = path.join(__dirname, 'out', lang);
  fs.mkdirSync(outDir, { recursive: true });
  const done = new Set();
  let maxBatch = 0;
  for (const f of fs.readdirSync(outDir).filter((x) => x.endsWith('.json'))) {
    const m = f.match(/^_batch(\d+)\.json$/);
    if (m) maxBatch = Math.max(maxBatch, Number(m[1]));
    try {
      const d = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8'));
      const t = f.startsWith('_') ? d[table] : (f === `${table}.json` ? d : null);
      if (t) Object.keys(t).forEach((id) => done.add(id));
    } catch { /* skip */ }
  }
  const todo = FORCE ? rows : rows.filter((r) => !done.has(r.id));
  console.log(`${table} → ${lang} | aralıq: ${FROM === -Infinity ? 'başlanğıc' : FROM}–${TO === Infinity ? 'son' : TO} | mənbə: ${rows.length}, hazır: ${rows.length - todo.length}, tərcümə olunacaq: ${todo.length} | model: ${MODEL}`);
  if (!todo.length || DRY) { if (DRY) console.log('(dry run — çağırış yoxdur)'); return; }

  const outFile = path.join(outDir, `_batch${maxBatch + 1}.json`);
  const results = {};
  const save = () => fs.writeFileSync(outFile, JSON.stringify({ [table]: results }, null, 1), 'utf8');

  // Mini-batch qrupları
  const groups = [];
  for (let i = 0; i < todo.length; i += ROWS_PER_CALL) groups.push(todo.slice(i, i + ROWS_PER_CALL));

  const system = buildSystemPrompt(lang);
  let doneCalls = 0, okRows = 0, failRows = 0;
  const t0 = Date.now();

  async function processGroup(group, gi) {
    // payload: { "<id>": { field: value } }
    const payload = {};
    for (const r of group) {
      const p = {};
      for (const f of allFields) {
        // _az sütunu varsa o, AZ mənbəyidir (məs. safety_items-də base=EN); yoxdursa base
        const src = r[`${f}_az`] ?? r[f];
        if (src === null || src === undefined) continue;
        if (typeof src === 'string' && !src.trim()) continue;
        if (Array.isArray(src) && !src.length) continue;
        p[f] = src;
      }
      if (Object.keys(p).length) payload[r.id] = p;
    }
    if (!Object.keys(payload).length) return;
    const est = JSON.stringify(payload).length;
    const maxTok = Math.min(16000, Math.max(2000, Math.round(est * 1.2)));
    try {
      const text = await callAzure(system, JSON.stringify(payload), maxTok);
      const parsed = JSON.parse(stripFences(text));
      for (const [id, srcFields] of Object.entries(payload)) {
        const v = validateOut(srcFields, parsed[id]);
        if (v.ok) { results[id] = v.value; okRows++; }
        else { failRows++; console.log(`  ⚠ ${id}: ${v.why}`); }
      }
    } catch (e) {
      // qrup alınmadı → sətir-sətir cəhd
      for (const [id, srcFields] of Object.entries(payload)) {
        try {
          const text = await callAzure(system, JSON.stringify({ [id]: srcFields }), maxTok);
          const parsed = JSON.parse(stripFences(text));
          const v = validateOut(srcFields, parsed[id]);
          if (v.ok) { results[id] = v.value; okRows++; }
          else { failRows++; console.log(`  ⚠ ${id}: ${v.why}`); }
        } catch (e2) {
          failRows++; console.log(`  ✗ ${id}: ${e2.message.slice(0, 120)}`);
        }
      }
    }
    doneCalls++;
    if (doneCalls % 5 === 0) {
      save();
      const spent = Math.round((Date.now() - t0) / 1000);
      console.log(`  ${okRows}/${todo.length} sətir | ${doneCalls}/${groups.length} çağırış | ${spent}s`);
    }
  }

  // Sadə konkurrensiya hovuzu
  let idx = 0;
  async function worker() {
    while (idx < groups.length) {
      const my = idx++;
      await processGroup(groups[my], my);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONC, groups.length) }, worker));

  save();
  const spent = Math.round((Date.now() - t0) / 1000);
  console.log(`✓ Bitdi: ${okRows} uğurlu, ${failRows} uğursuz | ${spent}s | → ${path.relative(process.cwd(), outFile)}`);
  console.log(`Sonra: node scripts/content-i18n/validate.cjs && node scripts/content-i18n/build-sql.cjs`);
})();

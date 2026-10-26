/**
 * Community dinamik açarlarının tərcüməsi (template-literal açarlar statik skanlardan yayınmışdı):
 *   1) community_header_{bump,flow,trying,mommy} — Community başlığı (app_settings AZ dəyəri üçün overlay)
 *   2) group_name_<slug> / group_desc_<slug> — hazırkı 25 qrupun adı/təsviri (heç bir dildə yox idi!)
 *   3) köhnə 4 qrup açarı (yalnız en var idi) → ru/tr/kk
 * Slug JS ilə EYNİ: name.replace(/\s+/g,'_').toLowerCase()
 * Nəticə: supabase/qazax/Qazax9.sql + seed faylları (ru/tr/kk/en, yalnız boşluqlar).
 */
const fs = require('fs');
const path = require('path');

// Azure env
const envAz = path.join(__dirname, '..', 'content-i18n', '.env.azure');
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

const SRC_NAMES = { az: 'Azerbaijani', en: 'English' };
const TGT_STYLE = {
  en: 'English. Concise, natural product English.',
  ru: 'Russian. Use the formal «вы» form where applicable.',
  tr: 'Turkish. Use natural product Turkish.',
  kk: 'Kazakh (Cyrillic script, as used in Kazakhstan). Use the formal «Сіз» form where applicable.',
};

async function azureTranslate(payload, srcLang, tgtLang) {
  const system = [
    'You are a UI translator for a pregnancy & motherhood app (Anacan) community module.',
    `Translate the JSON values from ${SRC_NAMES[srcLang]} to ${TGT_STYLE[tgtLang]}`,
    'These are community group names, group descriptions and section headers.',
    'Rules: Return ONLY valid JSON with EXACTLY the same keys. Keep them short and natural.',
    'Keep year numbers and month-group patterns (e.g. "2026 Yanvar Anaları" = mothers who give birth in January 2026).',
  ].join('\n');
  let body = {
    model: MODEL,
    messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(payload) }],
    max_completion_tokens: 6000,
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
const slugOf = (name) => name.replace(/\s+/g, '_').toLowerCase();

(async () => {
  // ── 1) Qrupları oxu ──
  const su = await fetch(URL_ + '/auth/v1/signup', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'diag_' + Date.now() + '@anacan-test.dev', password: 'Test1234!diag' }) });
  const d = await su.json();
  const H = { apikey: KEY, Authorization: 'Bearer ' + d.access_token };
  const gr = await fetch(URL_ + '/rest/v1/community_groups?select=name,description&is_active=eq.true&order=name.asc', { headers: H });
  const groups = await gr.json();
  if (!Array.isArray(groups) || !groups.length) { console.error('✗ qruplar oxunmadı'); process.exit(1); }
  console.log(`Qruplar: ${groups.length}`);

  // ── 2) Tərcümə elementləri ──
  // { key, srcLang, src, targets[] }
  const items = [];
  items.push({ key: 'community_header_bump', srcLang: 'az', src: 'Digər hamilə analar ilə əlaqədə olun', targets: ['ru', 'tr', 'kk'] });
  items.push({ key: 'community_header_mommy', srcLang: 'az', src: 'Digər analar ilə əlaqədə olun', targets: ['en', 'ru', 'tr', 'kk'] });
  items.push({ key: 'community_header_flow', srcLang: 'en', src: 'Connect with others trying to conceive', targets: ['ru', 'tr', 'kk'] });
  items.push({ key: 'community_header_trying', srcLang: 'en', src: 'Connect with others trying to conceive', targets: ['ru', 'tr', 'kk'] });
  for (const g of groups) {
    const slug = slugOf(g.name);
    items.push({ key: `group_name_${slug}`, srcLang: 'az', src: g.name, targets: ['en', 'ru', 'tr', 'kk'] });
    if (g.description && g.description.trim()) {
      items.push({ key: `group_desc_${slug}`, srcLang: 'az', src: g.description, targets: ['en', 'ru', 'tr', 'kk'] });
    }
  }
  // Köhnə 4 açar (en mövcuddur) → ru/tr/kk
  const LEGACY = {
    'group_name_hamiləlik': 'Pregnancy',
    'group_desc_hamiləlik': 'Connect with other expectant mothers',
    'group_name_məsləhət': 'Advice',
    'group_desc_məsləhət': 'Ask questions and get advice from mothers',
    'group_name_təcrübəli_analar': 'Experienced Mothers',
    'group_desc_təcrübəli_analar': 'Share advice and experiences',
    'group_name_yeni_analar': 'New Mothers',
    'group_desc_yeni_analar': 'Share experiences about newborn care',
  };
  for (const [k, v] of Object.entries(LEGACY)) items.push({ key: k, srcLang: 'en', src: v, targets: ['ru', 'tr', 'kk'] });

  // ── 3) (srcLang → tgtLang) qrupları üzrə Azure çağırışları ──
  const results = {}; // key -> { lang: value }
  const jobs = new Map(); // "src>tgt" -> [{key,src}]
  for (const it of items) {
    for (const tgt of it.targets) {
      const jk = `${it.srcLang}>${tgt}`;
      if (!jobs.has(jk)) jobs.set(jk, []);
      jobs.get(jk).push(it);
    }
  }
  for (const [jk, list] of jobs) {
    const [srcLang, tgtLang] = jk.split('>');
    const payload = Object.fromEntries(list.map((x) => [x.key, x.src]));
    const out = await azureTranslate(payload, srcLang, tgtLang);
    let ok = 0;
    for (const x of list) {
      const v = out[x.key];
      if (typeof v === 'string' && v.trim()) {
        results[x.key] = results[x.key] || {};
        results[x.key][tgtLang] = v.trim();
        ok++;
      }
    }
    console.log(`✓ ${jk}: ${ok}/${list.length}`);
  }

  // ── 4) Qazax9.sql ──
  const rows = [];
  for (const [key, langs] of Object.entries(results)) {
    for (const [lang, val] of Object.entries(langs)) {
      rows.push(`  ('${esc(key)}', '${lang}', '${esc(val)}', 'common')`);
    }
  }
  const body = [
    '-- ============================================================',
    '-- Qazax9 — Community dinamik açarları (BÜTÜN dillər üçün kök düzəliş)',
    '-- 1) community_header_{bump,flow,trying,mommy} → en/ru/tr/kk',
    '--    (yalnız en var idi — ru/tr istifadəçilər də AZ görürdü!)',
    `-- 2) Hazırkı ${groups.length} qrupun group_name_*/group_desc_* açarları → en/ru/tr/kk`,
    '--    (heç bir dildə yox idi — köhnə açarlar köhnəlmiş qrup adlarına aid idi)',
    '-- 3) Köhnə 4 qrup açarı → ru/tr/kk. İdempotent (DO NOTHING).',
    '-- ============================================================',
    '',
    'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
    rows.join(',\n'),
    'ON CONFLICT (key, lang) DO NOTHING;',
    '',
  ].join('\n');
  const outPath = path.join(__dirname, '..', '..', 'supabase', 'qazax', 'Qazax9.sql');
  fs.writeFileSync(outPath, body, 'utf8');
  console.log(`✓ supabase/qazax/Qazax9.sql — ${rows.length} sətir`);

  // ── 5) Seed fayllarını yenilə (yalnız boşluqlar) ──
  const FILES = {
    en: path.join(__dirname, '..', '..', 'src/locales/en.json'),
    ru: path.join(__dirname, 'ru.seed.json'),
    tr: path.join(__dirname, 'tr.seed.json'),
    kk: path.join(__dirname, 'kk.seed.json'),
  };
  const added = {};
  for (const [lang, p] of Object.entries(FILES)) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    let n = 0;
    for (const [key, langs] of Object.entries(results)) {
      if (langs[lang] && !data[key]) { data[key] = langs[lang]; n++; }
    }
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    added[lang] = n;
  }
  // kk.out.json da sinxron saxla (gələcək rebuild-lər üçün)
  const kkOutPath = path.join(__dirname, 'kk.out.json');
  const kkOut = JSON.parse(fs.readFileSync(kkOutPath, 'utf8'));
  let kn = 0;
  for (const [key, langs] of Object.entries(results)) {
    if (langs.kk && !kkOut[key]) { kkOut[key] = langs.kk; kn++; }
  }
  fs.writeFileSync(kkOutPath, JSON.stringify(kkOut, null, 1), 'utf8');
  console.log(`Seed əlavələri: en=+${added.en} ru=+${added.ru} tr=+${added.tr} kk=+${added.kk} (kk.out=+${kn})`);

  // Nümunələr
  console.log('\nNümunələr:');
  for (const k of ['community_header_bump', 'group_name_hamilə_qadınlar', 'group_desc_2026_yanvar_anaları']) {
    if (results[k]) console.log(` ${k}:`, JSON.stringify(results[k]));
  }
})();

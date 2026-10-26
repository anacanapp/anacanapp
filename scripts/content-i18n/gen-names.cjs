/**
 * TR/RU körpə adları generatoru (Azure gpt-5.6-sol).
 * Hər dil üçün seqmentli sorğular → dedupe → 20260813150021_baby_names_tr_ru_seed.sql
 * INSERT-lər idempotentdir (name+lang üzrə WHERE NOT EXISTS).
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.azure');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const ENDPOINT = process.env.AZURE_OPENAI_V1_ENDPOINT.replace(/\/$/, '');
const KEY = process.env.AZURE_API_KEY;
const MODEL = process.env.AZURE_MODEL || 'gpt-5.6-sol';

async function ask(system, user) {
  for (let a = 1; a <= 4; a++) {
    const r = await fetch(`${ENDPOINT}/chat/completions`, {
      method: 'POST',
      headers: { 'api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_completion_tokens: 12000,
        response_format: { type: 'json_object' },
      }),
    });
    if (r.status === 429 || r.status >= 500) { await new Promise((x) => setTimeout(x, a * 5000)); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    return d.choices[0].message.content;
  }
  throw new Error('retries exhausted');
}

const SEGMENTS = {
  tr: [
    ['Klassik və çox populyar Türk qız adları', 'girl', 60],
    ['Klassik və çox populyar Türk oğlan adları', 'boy', 60],
    ['Türkiyədə geniş istifadə olunan müasir/qlobal qız adları (məs. Melisa, Lara, Mira kimi)', 'girl', 30],
    ['Türkiyədə geniş istifadə olunan müasir/qlobal oğlan adları', 'boy', 30],
    ['Türkiyədə istifadə olunan unisex adlar', 'unisex', 20],
  ],
  ru: [
    ['Klassik və çox populyar rus qız adları', 'girl', 60],
    ['Klassik və çox populyar rus oğlan adları', 'boy', 60],
    ['Rusdillilər arasında geniş yayılmış müasir/qlobal qız adları (məs. Ева, Мила, Алиса kimi)', 'girl', 30],
    ['Rusdillilər arasında geniş yayılmış müasir/qlobal oğlan adları (məs. Марк, Лев kimi)', 'boy', 30],
    ['Rusdillilərdə istifadə olunan unisex/qısa adlar', 'unisex', 20],
  ],
};

const LANGNAME = { tr: 'Turkish', ru: 'Russian' };

(async () => {
  const all = { tr: [], ru: [] };
  for (const lang of ['tr', 'ru']) {
    const seen = new Set();
    for (const [seg, gender, count] of SEGMENTS[lang]) {
      const system = [
        `You are an onomastics expert for a baby-names app.`,
        `Return ONLY valid JSON: {"names":[{"name":"...","gender":"${gender}","origin":"...","meaning":"...","popularity":50-99}]}.`,
        `"origin" and "meaning" must be written in ${LANGNAME[lang]}.`,
        `"name" must be in native ${LANGNAME[lang]} spelling${lang === 'ru' ? ' (Cyrillic)' : ''}.`,
        `Popularity: higher = more popular today. Real names only, no duplicates.`,
      ].join('\n');
      const user = `Segment: ${seg}. Count: ${count}.` + (seen.size ? ` Artıq istifadə olunub (təkrar etmə): ${[...seen].join(', ')}` : '');
      const text = await ask(system, user);
      let parsed;
      try { parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch { console.log(`⚠ ${lang}/${gender}: JSON parse xətası, ötürülür`); continue; }
      let added = 0;
      for (const n of parsed.names || []) {
        if (!n?.name || !n?.meaning || seen.has(n.name)) continue;
        seen.add(n.name);
        all[lang].push({
          name: String(n.name).trim(),
          gender: ['girl', 'boy', 'unisex'].includes(n.gender) ? n.gender : gender,
          origin: String(n.origin || '').trim(),
          meaning: String(n.meaning).trim(),
          popularity: Math.min(99, Math.max(40, Number(n.popularity) || 60)),
        });
        added++;
      }
      console.log(`✓ ${lang} | ${seg.slice(0, 40)}… → +${added}`);
    }
    console.log(`${lang} CƏMİ: ${all[lang].length} ad`);
  }

  const esc = (s) => String(s).replace(/'/g, "''");
  const lines = [
    '-- ============================================================',
    '-- Baby Names Seed: TR/RU ad dəstləri (lang sütunu ilə seqmentli)',
    '-- İdempotent: name+lang üzrə WHERE NOT EXISTS.',
    '-- ============================================================',
    '',
  ];
  for (const lang of ['tr', 'ru']) {
    lines.push(`-- ── ${lang.toUpperCase()} adları (${all[lang].length}) ──`);
    for (const n of all[lang]) {
      const mCol = `meaning_${lang}`, oCol = `origin_${lang}`;
      lines.push(
        `INSERT INTO public.baby_names_db (name, gender, origin, meaning, ${oCol}, ${mCol}, popularity, is_active, lang) ` +
        `SELECT '${esc(n.name)}', '${n.gender}', '${esc(n.origin)}', '${esc(n.meaning)}', '${esc(n.origin)}', '${esc(n.meaning)}', ${n.popularity}, true, '${lang}' ` +
        `WHERE NOT EXISTS (SELECT 1 FROM public.baby_names_db WHERE name = '${esc(n.name)}' AND lang = '${lang}');`
      );
    }
    lines.push('');
  }
  const out = path.join(__dirname, '..', '..', 'supabase', 'migrations', '20260813150021_baby_names_tr_ru_seed.sql');
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(`✓ ${out} — ${all.tr.length + all.ru.length} INSERT, ${Math.round(fs.statSync(out).size / 1024)} KB`);
})();

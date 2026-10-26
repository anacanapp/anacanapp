/**
 * Körpə adları — kk/de/ar üçün YENİ, mədəni cəhətdən uyğun ad siyahıları yaradır
 * (əvvəllər bu 3 dil "lang" seqmenti olaraq mövcud deyildi — kk istifadəçiləri az
 * siyahısını, de/ar istifadəçiləri isə en siyahısını görürdü, real Qazax/Alman/Ərəb
 * adları HEÇ göstərilmirdi). Bu skript tr/ru üçün istifadə olunan
 * `20260813150021_baby_names_tr_ru_seed.sql` idempotent INSERT nümunəsini təqib edir.
 *
 * İstifadə: node scripts/content-i18n/generate-baby-names.cjs <kk|de|ar>
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.azure');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const ENDPOINT = (process.env.AZURE_OPENAI_V1_ENDPOINT || '').replace(/\/$/, '');
const API_KEY = process.env.AZURE_API_KEY;
const MODEL = process.env.AZURE_MODEL || 'gpt-5.6-sol';

const LANG = process.argv[2];
const CONFIG = {
  kk: {
    label: 'Qazax (Kazakh)',
    scriptNote: 'Names MUST be written in Kazakh Cyrillic script (e.g. Айгерім, Нұрсұлтан), matching how Russian names are written in Cyrillic elsewhere in this same database.',
    nativeMeaningLang: 'Kazakh (Cyrillic)',
  },
  de: {
    label: 'German',
    scriptNote: 'Names are in standard Latin script as used in Germany (e.g. Lukas, Mia, Sophie).',
    nativeMeaningLang: 'German',
  },
  ar: {
    label: 'Arabic (Modern Standard / Gulf-common names)',
    scriptNote: 'Names MUST be written in Arabic script (e.g. محمد, فاطمة), matching how they would appear on an Arabic baby-names app.',
    nativeMeaningLang: 'Arabic',
  },
}[LANG];
if (!CONFIG) { console.error('İstifadə: node generate-baby-names.cjs <kk|de|ar>'); process.exit(1); }

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
      console.log(`  . HTTP ${resp.status}, ${ra}s gözlənilir`);
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
      throw new Error(`HTTP 400: ${t.slice(0, 500)}`);
    }
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 500)}`);
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '';
    if (!text) throw new Error('empty response');
    return text;
  }
  throw new Error('retries exhausted (429/5xx)');
}

const SYSTEM = `You are an expert in baby-name etymology and ${CONFIG.label} culture/onomastics.
Generate a JSON object with a "names" array of REAL, genuinely popular, currently-used ${CONFIG.label} baby names —
NOT invented/hallucinated names. Prefer well-documented, common names a native speaker would immediately recognize.

For EACH name provide:
{
  "name": "the name itself — ${CONFIG.scriptNote}",
  "gender": "boy" | "girl" | "unisex",
  "popularity": 40-95 (integer, relative popularity today),
  "origin_az": "short origin in Azerbaijani, e.g. 'Ərəb mənşəli'",
  "origin_en": "short origin in English, e.g. 'Arabic origin'",
  "origin_native": "short origin in ${CONFIG.nativeMeaningLang}",
  "meaning_az": "short accurate meaning in Azerbaijani (max ~90 chars)",
  "meaning_en": "short accurate meaning in English (max ~90 chars)",
  "meaning_native": "short accurate meaning in ${CONFIG.nativeMeaningLang} (max ~90 chars)"
}

Rules:
- Do NOT invent etymology you are not confident about — accuracy matters, this is a real parenting app.
- No duplicate names within the array.
- Balance: roughly 40% boy names, 40% girl names, 20% unisex names.
- Output ONLY the JSON object: {"names": [...]}. No commentary, no markdown fences.`;

(async () => {
  const allNames = [];
  const seenNames = new Set();
  // 3 batch (hər biri ~35 ad) — tək sorğuda 100 keyfiyyətli ad tələb etmək çox uzun/az etibarlı ola bilər
  const BATCHES = [
    'Generate 35 REAL, popular BOY names.',
    'Generate 35 REAL, popular GIRL names.',
    'Generate 20 REAL, popular UNISEX names (used for both boys and girls).',
  ];
  for (const [i, instruction] of BATCHES.entries()) {
    console.log(`[${LANG}] batch ${i + 1}/${BATCHES.length}: ${instruction}`);
    const already = allNames.length ? `\n\nAlready used (do NOT repeat): ${allNames.map((n) => n.name).join(', ')}` : '';
    const raw = await callAzure(SYSTEM, instruction + already, 8000);
    let parsed;
    try {
      const clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('  ✗ JSON parse xətası:', e.message, '\n', raw.slice(0, 300));
      continue;
    }
    const names = Array.isArray(parsed.names) ? parsed.names : [];
    let added = 0;
    for (const n of names) {
      if (!n.name || seenNames.has(n.name.toLowerCase())) continue;
      seenNames.add(n.name.toLowerCase());
      allNames.push(n);
      added++;
    }
    console.log(`  ✓ ${added} yeni ad (cəmi: ${allNames.length})`);
  }

  const outPath = path.join(__dirname, 'out-names', `${LANG}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(allNames, null, 2), 'utf8');
  console.log(`✓ ${outPath} — ${allNames.length} ad yazıldı`);
})();

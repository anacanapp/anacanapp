/**
 * Xəstəxana/Klinika "bot"-u — ölkəyə görə YALNIZ məşhur, sabit, asan-yoxlanıla bilən
 * flaqman xəstəxana/klinikaları generasiya edir (AI-nın uydurma telefon/ünvan riski
 * minimuma endirilib: əmin olmadığı sahələr üçün null qaytarmağa təşviq edilir).
 *
 * Bu, TƏKRAR İSTİFADƏ OLUNA BİLƏN skriptdir — yeni ölkə əlavə etmək üçün sadəcə:
 *   node scripts/content-i18n/generate-healthcare-providers.cjs <ISO2> "<Ölkə adı>"
 *
 * ⚠️ QEYD: AI-nın churn/ünvan/telefon məlumatları vaxtla dəyişə bilər və 100% dəqiq
 * olmaya bilər — canlıya keçirmədən əvvəl bir neçə sətri əl ilə yoxlamaq tövsiyə olunur.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '.env.azure');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const ENDPOINT = (process.env.AZURE_OPENAI_V1_ENDPOINT || '').replace(/\/$/, '');
const API_KEY = process.env.AZURE_API_KEY;
const MODEL = process.env.AZURE_MODEL || 'gpt-5.6-sol';

const ISO2 = process.argv[2];
const COUNTRY_NAME = process.argv[3];
if (!ISO2 || !COUNTRY_NAME) {
  console.error('İstifadə: node generate-healthcare-providers.cjs <ISO2> "<Ölkə adı>"');
  process.exit(1);
}

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

const SYSTEM = `You are a careful medical-directory researcher building a healthcare-facility database for a
pregnancy/motherhood app. Accuracy and caution matter MORE than completeness — this data may be shown to
pregnant women looking for real care, so NEVER invent a phone number, address, or website you are not
confident about.

Generate a JSON object {"providers": [...]} listing 6-10 of the MOST WELL-KNOWN, LARGEST, most
STABLE/LONG-ESTABLISHED maternity-relevant hospitals and women's/children's clinics in ${COUNTRY_NAME}
(prioritize university hospitals, national referral hospitals, and famous private hospital chains that
would appear in any official health-ministry directory or major international guide — NOT small/obscure
private clinics you are unsure about).

For EACH provider:
{
  "name": "Official name, in the LOCAL language/script as it is actually called",
  "name_en": "English name/transliteration",
  "provider_type": "hospital" | "clinic",
  "specialty": "short specialty in the LOCAL language, e.g. 'Qadın xəstəlikləri və doğum' style — for THIS provider use the local language of ${COUNTRY_NAME}",
  "specialty_en": "same in English, e.g. 'Obstetrics & Gynecology' or 'General Hospital'",
  "city": "the city it's actually located in",
  "phone": "official phone number WITH country code IF you are confident, else null — do not guess",
  "website": "official website URL IF you are confident it is correct and current, else null",
  "is_major_landmark": true
}

Output ONLY the JSON object. No commentary, no markdown fences. If you cannot confidently name 6 real
hospitals for this country, return fewer rather than inventing any.`;

(async () => {
  console.log(`[${ISO2}] ${COUNTRY_NAME} üçün xəstəxana siyahısı generasiya olunur...`);
  const raw = await callAzure(SYSTEM, `List major hospitals for ${COUNTRY_NAME} (ISO ${ISO2}).`, 4000);
  let parsed;
  try {
    const clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    parsed = JSON.parse(clean);
  } catch (e) {
    console.error('✗ JSON parse xətası:', e.message, '\n', raw.slice(0, 400));
    process.exit(1);
  }
  const providers = Array.isArray(parsed.providers) ? parsed.providers : [];
  console.log(`✓ ${providers.length} provider tapıldı:`);
  providers.forEach((p) => console.log(`  - ${p.name} (${p.city}) — ${p.provider_type}${p.phone ? ', tel: ' + p.phone : ' (tel: naməlum)'}`));

  const outPath = path.join(__dirname, 'out-hospitals', `${ISO2}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ country_code: ISO2, country_name: COUNTRY_NAME, providers }, null, 2), 'utf8');
  console.log(`✓ ${outPath}`);
})();

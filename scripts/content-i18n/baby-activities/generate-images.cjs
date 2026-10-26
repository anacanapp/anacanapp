#!/usr/bin/env node
// Körpə məşğələ illüstrasiyalarını Vertex AI (Nano Banana 2) ilə generasiya edir.
// generate-baby-photo edge function-ının EYNİ pattern-i (model sırası, auth, body,
// inlineData çıxarışı) — lokal Node variantı. Şəkillər images/<id>.png kimi yazılır.
//
// Auth (supabase/functions/_shared/vertex-ai.ts ilə eyni məntiq):
//   Vertex yolu (prioritet): GCP_SERVICE_ACCOUNT_JSON_PATH + GCP_PROJECT_ID [+ GCP_LOCATION=global]
//   Gemini API fallback:     GEMINI_API_KEY
// Açarlar scripts/content-i18n/baby-activities/.env.vertex faylından oxunur (gitignore-da).
//
// İşlətmə:
//   node generate-images.cjs                # hamısı (mövcud fayllar skip)
//   node generate-images.cjs --limit=3      # test üçün ilk 3
//   node generate-images.cjs --only=act_0_2m_04
//   node generate-images.cjs --force        # mövcudları da yenidən çək

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = __dirname;
const IMAGES_DIR = path.join(DIR, 'images');
const ENV_PATH = path.join(DIR, '.env.vertex');

// ── .env.vertex oxu (sadə KEY=VALUE parser) ──
function loadEnv(p) {
  const env = {};
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}
const ENV = { ...loadEnv(ENV_PATH), ...process.env };

const GEMINI_API_KEY = ENV.GEMINI_API_KEY || '';
const SA_PATH = ENV.GCP_SERVICE_ACCOUNT_JSON_PATH || '';
const GCP_PROJECT_ID = ENV.GCP_PROJECT_ID || '';
// Image modellər üçün global region (edge function şərhi ilə eyni)
const GCP_LOCATION = ENV.GCP_LOCATION || 'global';

// Nano Banana 2 (primary) → fallback sırası — generate-baby-photo/index.ts:379-392 ilə eyni
const VERTEX_MODELS = [
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image',
  'gemini-2.5-flash-image-preview',
];
const GEMINI_MODELS = [
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
  'gemini-2.5-flash-image',
];

// ── Vertex access token (vertex-ai.ts:40-84 ekvivalenti, node crypto ilə) ──
let cachedToken = null; // { token, exp }
function getVertexToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(claims)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(sa.private_key).toString('base64url');
  const jwt = `${unsigned}.${signature}`;

  return fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
    .then((r) => r.json())
    .then((d) => {
      if (!d.access_token) throw new Error('Token alınmadı: ' + JSON.stringify(d));
      cachedToken = { token: d.access_token, exp: now + (d.expires_in || 3600) };
      return cachedToken.token;
    });
}

// ── Bir model üçün generateContent çağırışı ──
async function callModel({ vertex, model, prompt, withImageConfig }) {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      ...(withImageConfig ? { imageConfig: { aspectRatio: '1:1' } } : {}),
    },
  };

  let url, headers;
  if (vertex) {
    const token = await getVertexToken();
    const host = GCP_LOCATION === 'global' ? 'aiplatform.googleapis.com' : `${GCP_LOCATION}-aiplatform.googleapis.com`;
    url = `https://${host}/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${model}:generateContent`;
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    headers = { 'Content-Type': 'application/json' };
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const status = res.status;
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data).slice(0, 300);
    return { status, error: msg };
  }
  // inlineData çıxarışı — generate-baby-photo/index.ts:469-494 ilə eyni
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    const inline = p.inlineData || p.inline_data;
    if (inline?.data) return { status, base64: inline.data, mime: inline.mimeType || inline.mime_type || 'image/png' };
  }
  return { status, error: 'Cavabda inlineData şəkil yoxdur' };
}

// ── Model fallback loop (503/404 → növbəti model; 400 imageConfig → onsuz təkrar) ──
async function generateOne(prompt) {
  const useVertex = !!(SA_PATH && GCP_PROJECT_ID);
  const models = useVertex ? VERTEX_MODELS : GEMINI_MODELS;
  if (!useVertex && !GEMINI_API_KEY) {
    throw new Error('.env.vertex-də nə GCP_SERVICE_ACCOUNT_JSON_PATH+GCP_PROJECT_ID, nə də GEMINI_API_KEY var');
  }

  const errors = [];
  const BACKOFFS = [15000, 30000, 60000]; // 429 (kvota) — eyni model üçün artan gözləmə
  for (const model of models) {
    let r;
    let attempt = 0;
    for (;;) {
      r = await callModel({ vertex: useVertex, model, prompt, withImageConfig: true });
      // Bəzi modellər imageConfig-i tanımır → onsuz bir dəfə təkrar
      if (r.error && r.status === 400 && /imageConfig|image_config|aspect/i.test(r.error)) {
        r = await callModel({ vertex: useVertex, model, prompt, withImageConfig: false });
      }
      if (r.base64) {
        if (process.env.DEBUG_MODELS) console.log(`\n   ✓ uğurlu model: ${model}`);
        return { ...r, model };
      }
      // 429 = kvota/sürət limiti — model İŞLƏKDİR, sadəcə gözləyib EYNİ modeli təkrar sına
      if (r.status === 429 && attempt < BACKOFFS.length) {
        const wait = BACKOFFS[attempt];
        process.stdout.write(`\n   ⏸ 429 (kvota) — ${model} üçün ${wait / 1000}s gözlənilir (cəhd ${attempt + 1}/${BACKOFFS.length})... `);
        await new Promise((res) => setTimeout(res, wait));
        attempt++;
        continue;
      }
      if (process.env.DEBUG_MODELS) console.log(`\n   ✗ ${model}: [${r.status}] ${r.error}`);
      errors.push(`${model}: [${r.status}] ${r.error}`);
      break; // 404 (model yoxdur) və ya 429 limiti bitdi → növbəti modelə keç
    }
  }
  throw new Error('Bütün modellər alınmadı:\n  ' + errors.join('\n  '));
}

// ── Main ──
(async () => {
  const args = process.argv.slice(2);
  const limit = parseInt((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || '0', 10);
  const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';
  const force = args.includes('--force');

  let prompts = JSON.parse(fs.readFileSync(path.join(DIR, 'image-prompts.json'), 'utf8'));
  if (only) prompts = prompts.filter((p) => p.id === only);
  if (limit > 0) prompts = prompts.slice(0, limit);

  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const useVertex = !!(SA_PATH && GCP_PROJECT_ID);
  console.log(`Rejim: ${useVertex ? `Vertex (${GCP_PROJECT_ID}, ${GCP_LOCATION})` : 'Gemini API'} | ${prompts.length} şəkil\n`);

  const failed = [];
  let done = 0;
  for (const p of prompts) {
    const outPath = path.join(IMAGES_DIR, `${p.id}.png`);
    if (!force && fs.existsSync(outPath)) {
      console.log(`↷ skip (mövcuddur): ${p.id}`);
      continue;
    }
    process.stdout.write(`⏳ ${p.id} — ${p.title_az} ... `);
    try {
      const r = await generateOne(p.full_prompt);
      fs.writeFileSync(outPath, Buffer.from(r.base64, 'base64'));
      const kb = Math.round(fs.statSync(outPath).size / 1024);
      console.log(`✓ ${kb}KB (${r.model})`);
      done++;
    } catch (e) {
      console.log('✗ XƏTA');
      console.log('   ' + String(e.message).split('\n').join('\n   '));
      failed.push(p.id);
    }
    // Rate limit üçün fasilə (bu layihənin kvotası azdır — 429-ları azaltmaq üçün)
    await new Promise((r) => setTimeout(r, 8000));
  }

  console.log(`\n═══ Nəticə: ${done} yeni, ${failed.length} xəta ═══`);
  if (failed.length) {
    console.log('Xətalılar (təkrar üçün --only=<id>):');
    failed.forEach((id) => console.log('  ' + id));
    process.exit(1);
  }
})();

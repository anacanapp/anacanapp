#!/usr/bin/env node
// 1–12 ay körpə inkişaf illüstrasiyalarını Nano Banana (Gemini image) ilə 0-dan generasiya edir
// və şəffaf fonlu PNG-yə çevirir.
// Auth, model sırası və inlineData çıxarışı scripts/content-i18n/baby-activities/generate-images.cjs
// (və supabase/functions/generate-baby-photo) ilə eynidir.
//
// Axın:
//   1) reference.png — personaj dizaynını təyin edən istinad şəkli (bir dəfə).
//   2) Hər ay üçün: prompt + reference.png → raw/ay-XX.png (ağ fon).
//   3) Ağ fon kənarlardan flood-fill ilə silinir → ay-XX.png (RGBA, şəffaf).
//
// Auth (.env.vertex — bu qovluqda və ya baby-activities qovluğunda, gitignore-dadır):
//   Vertex yolu (prioritet): GCP_SERVICE_ACCOUNT_JSON_PATH + GCP_PROJECT_ID [+ GCP_LOCATION=global]
//   Gemini API fallback:     GEMINI_API_KEY
//
// Asılılıq: sharp (npm i --no-save sharp)
//
// İşlətmə:
//   node generate-milestones.cjs                 # hamısı (mövcud fayllar skip)
//   node generate-milestones.cjs --only=4,9      # yalnız 4 və 9-cu aylar
//   node generate-milestones.cjs --force         # mövcudları da yenidən çək
//   node generate-milestones.cjs --no-ref        # istinad şəkli olmadan
//   node generate-milestones.cjs --cutout-only   # yalnız raw/ → şəffaf PNG emalı
//   node generate-milestones.cjs --style=3d --style-ref=nümunə.jpg
//                                                # 3D Pixar üslubu, Mərcan geyim; nümunə şəkil üslub istinadıdır
//   OUT_DIR=/path node generate-milestones.cjs   # çıxış qovluğu (default: ./output)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MONTHS, REFERENCE_PROMPT, REFERENCE_PROMPT_3D, buildPrompt } = require('./prompts.cjs');

let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('sharp tapılmadı: bu qovluqda "npm i --no-save sharp" işlədin.');
  process.exit(1);
}

const DIR = __dirname;
const OUT_DIR = process.env.OUT_DIR || path.join(DIR, 'output');
const RAW_DIR = path.join(OUT_DIR, 'raw');
const REF_PATH = path.join(OUT_DIR, 'reference.png');

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
const ENV = {
  ...loadEnv(path.join(DIR, '../content-i18n/baby-activities/.env.vertex')),
  ...loadEnv(path.join(DIR, '.env.vertex')),
  ...process.env,
};

const GEMINI_API_KEY = ENV.GEMINI_API_KEY || '';
const SA_PATH = ENV.GCP_SERVICE_ACCOUNT_JSON_PATH || '';
const SA_JSON = ENV.GCP_SERVICE_ACCOUNT_JSON || '';
const GCP_PROJECT_ID = ENV.GCP_PROJECT_ID || '';
const GCP_LOCATION = ENV.GCP_LOCATION || 'global';
const USE_VERTEX = !!((SA_PATH || SA_JSON) && GCP_PROJECT_ID);

// Nano Banana Pro (ən yüksək keyfiyyət) → Nano Banana 2 → Nano Banana.
// Vertex-də artıq stabil ID-lər işləyir; `-preview` ID-lər 404 qaytarır və yalnız son fallback-dır.
const VERTEX_MODELS = [
  'gemini-3-pro-image',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
];
const GEMINI_MODELS = ['gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image'];

// imageConfig variantları: əvvəl 2K, model tanımırsa sadəcə 1:1, sonra onsuz
const IMAGE_CONFIGS = [{ aspectRatio: '1:1', imageSize: '2K' }, { aspectRatio: '1:1' }, null];

// ── Vertex access token (vertex-ai.ts ekvivalenti, node crypto ilə) ──
let cachedToken = null;
async function getVertexToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;
  const sa = JSON.parse(SA_JSON || fs.readFileSync(SA_PATH, 'utf8'));
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${unsigned}.${signature}`,
  });
  const d = await res.json();
  if (!d.access_token) throw new Error('Token alınmadı: ' + JSON.stringify(d));
  cachedToken = { token: d.access_token, exp: now + (d.expires_in || 3600) };
  return cachedToken.token;
}

// ── Bir model üçün generateContent çağırışı ──
async function callModel({ model, prompt, refImage, imageConfig }) {
  const parts = [{ text: prompt }];
  if (refImage) parts.push({ inline_data: { mime_type: 'image/png', data: refImage.toString('base64') } });
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      ...(imageConfig ? { imageConfig } : {}),
    },
  };

  let url, headers;
  if (USE_VERTEX) {
    const host = GCP_LOCATION === 'global' ? 'aiplatform.googleapis.com' : `${GCP_LOCATION}-aiplatform.googleapis.com`;
    url = `https://${host}/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/publishers/google/models/${model}:generateContent`;
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${await getVertexToken()}` };
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    headers = { 'Content-Type': 'application/json' };
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { status: res.status, error: data?.error?.message || JSON.stringify(data).slice(0, 300) };
  for (const p of data?.candidates?.[0]?.content?.parts || []) {
    const inline = p.inlineData || p.inline_data;
    if (inline?.data) return { status: res.status, base64: inline.data };
  }
  return { status: res.status, error: 'Cavabda şəkil yoxdur: ' + (data?.candidates?.[0]?.finishReason || 'naməlum') };
}

// ── Model fallback loop: 429 → gözlə və təkrar; 400 imageConfig → sadə config; 404/503 → növbəti model ──
async function generateImage(prompt, refImage) {
  if (!USE_VERTEX && !GEMINI_API_KEY) {
    throw new Error('Açar yoxdur: GCP_SERVICE_ACCOUNT_JSON(_PATH)+GCP_PROJECT_ID və ya GEMINI_API_KEY təyin edin');
  }
  const errors = [];
  const BACKOFFS = [15000, 30000, 60000];
  for (const model of USE_VERTEX ? VERTEX_MODELS : GEMINI_MODELS) {
    let cfg = 0;
    let attempt = 0;
    for (;;) {
      const r = await callModel({ model, prompt, refImage, imageConfig: IMAGE_CONFIGS[cfg] });
      if (r.base64) return { buffer: Buffer.from(r.base64, 'base64'), model };
      if (r.status === 400 && /imageConfig|image_config|imageSize|image_size|aspect/i.test(r.error) && cfg < IMAGE_CONFIGS.length - 1) {
        cfg++;
        continue;
      }
      if ((r.status === 429 || r.status === 503) && attempt < BACKOFFS.length) {
        process.stdout.write(`\n   ⏸ ${r.status} — ${model}, ${BACKOFFS[attempt] / 1000}s gözlənilir... `);
        await new Promise((res) => setTimeout(res, BACKOFFS[attempt++]));
        continue;
      }
      // Şəkilsiz cavab (məs. təhlükəsizlik filtri) — eyni modeldə bir dəfə təkrar
      if (r.status === 200 && attempt < 1) {
        attempt++;
        continue;
      }
      errors.push(`${model}: [${r.status}] ${r.error}`);
      break;
    }
  }
  throw new Error('Bütün modellər alınmadı:\n  ' + errors.join('\n  '));
}

// ── Ağ fonu şəffaf et: kənarlardan başlayaraq açıq-ağ piksellərə flood-fill ──
// Personaj qalın qəhvəyi konturla əhatə olunduğu üçün daxildəki ağ (bez, yaxalıq) toxunulmaz qalır.
async function cutout(inputBuf, outPath) {
  const { data, info } = await sharp(inputBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const isBg = (i) => {
    const [r, g, b] = px(i);
    return Math.min(r, g, b) >= 232 && Math.max(r, g, b) - Math.min(r, g, b) <= 18;
  };

  const bg = new Uint8Array(W * H);
  const stack = [];
  const seed = (i) => {
    if (!bg[i] && isBg(i)) {
      bg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < W; x++) seed(x), seed((H - 1) * W + x);
  for (let y = 0; y < H; y++) seed(y * W), seed(y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    const x = i % W;
    if (x > 0) seed(i - 1);
    if (x < W - 1) seed(i + 1);
    if (i >= W) seed(i - W);
    if (i < W * (H - 1)) seed(i + W);
  }

  for (let i = 0; i < W * H; i++) {
    if (bg[i]) {
      data[i * 4 + 3] = 0;
      continue;
    }
    // Fona bitişik anti-alias pikselləri: ağlığa görə yarı-şəffaf et və rəngi ağdan "təmizlə"
    const x = i % W;
    const nearBg = (x > 0 && bg[i - 1]) || (x < W - 1 && bg[i + 1]) || (i >= W && bg[i - W]) || (i < W * (H - 1) && bg[i + W]);
    if (!nearBg) continue;
    const [r, g, b] = px(i);
    const a = Math.max(0.15, Math.min(1, (255 - Math.min(r, g, b)) / 120));
    data[i * 4] = Math.round(255 - (255 - r) / a);
    data[i * 4 + 1] = Math.round(255 - (255 - g) / a);
    data[i * 4 + 2] = Math.round(255 - (255 - b) / a);
    data[i * 4 + 3] = Math.round(a * 255);
  }

  await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(outPath);
}

const pad = (n) => String(n).padStart(2, '0');

(async () => {
  const args = process.argv.slice(2);
  const only = ((args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '')
    .split(',')
    .filter(Boolean)
    .map(Number);
  const force = args.includes('--force');
  const noRef = args.includes('--no-ref');
  const cutoutOnly = args.includes('--cutout-only');
  const style = (args.find((a) => a.startsWith('--style=')) || '').split('=')[1] || 'flat';
  const styleRef = (args.find((a) => a.startsWith('--style-ref=')) || '').split('=')[1] || '';
  const months = only.length ? MONTHS.filter((m) => only.includes(m.month)) : MONTHS;

  fs.mkdirSync(RAW_DIR, { recursive: true });

  if (!cutoutOnly) {
    console.log(`Rejim: ${USE_VERTEX ? `Vertex (${GCP_PROJECT_ID}, ${GCP_LOCATION})` : 'Gemini API'} | ${months.length} şəkil → ${OUT_DIR}\n`);
  }

  let refImage = null;
  if (!noRef && !cutoutOnly) {
    if (!fs.existsSync(REF_PATH)) {
      process.stdout.write('⏳ reference.png — personaj istinad şəkli ... ');
      const styleImage = styleRef ? await sharp(fs.readFileSync(styleRef)).resize({ width: 1024, height: 1024, fit: 'inside' }).png().toBuffer() : null;
      const r = await generateImage(style === '3d' ? REFERENCE_PROMPT_3D : REFERENCE_PROMPT, styleImage);
      fs.writeFileSync(REF_PATH, r.buffer);
      console.log(`✓ (${r.model})`);
    }
    refImage = await sharp(fs.readFileSync(REF_PATH)).png().toBuffer();
  }

  const failed = [];
  for (const m of months) {
    const rawPath = path.join(RAW_DIR, `ay-${pad(m.month)}.png`);
    const outPath = path.join(OUT_DIR, `ay-${pad(m.month)}.png`);
    try {
      if (!cutoutOnly && (force || !fs.existsSync(rawPath))) {
        process.stdout.write(`⏳ ${m.title_az} ... `);
        const r = await generateImage(buildPrompt(m, !!refImage, style), refImage);
        fs.writeFileSync(rawPath, await sharp(r.buffer).png().toBuffer());
        console.log(`✓ (${r.model})`);
        await new Promise((res) => setTimeout(res, 8000)); // kvota üçün fasilə
      }
      if (fs.existsSync(rawPath)) {
        await cutout(fs.readFileSync(rawPath), outPath);
        console.log(`   ↳ şəffaf PNG: ${outPath}`);
      }
    } catch (e) {
      console.log(`✗ XƏTA (${m.month} ay)\n   ` + String(e.message).split('\n').join('\n   '));
      failed.push(m.month);
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(
      MONTHS.map((m) => ({ month: m.month, file: `ay-${pad(m.month)}.png`, title_az: m.title_az, milestone_az: m.milestone_az })),
      null,
      2,
    ) + '\n',
  );

  console.log(`\n═══ Nəticə: ${months.length - failed.length} uğurlu, ${failed.length} xəta ═══`);
  if (failed.length) {
    console.log(`Təkrar üçün: node generate-milestones.cjs --only=${failed.join(',')}`);
    process.exit(1);
  }
})().catch((e) => {
  console.error('✗ ' + e.message);
  process.exit(1);
});

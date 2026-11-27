// Fail the build if the shipped web bundle (dist/, which Capacitor copies into the iOS/Android app)
// contains anything that must never leave our servers: internal docs, dev/preview build artifacts,
// source maps, or secret-looking material. Everything in dist/ is extractable from the signed app with
// `unzip` or jadx — obfuscation does not hide assets — so the only real protection is shipping nothing
// sensitive. Run automatically after `vite build` (see package.json "build").
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, basename, extname } from 'node:path';

const DIST = process.argv[2] || 'dist';

// Filenames / paths that must not ship inside the app bundle.
const FORBIDDEN_NAME = [
  /pitch-deck/i,                 // internal investor / business deck
  /preview-build/i,              // e.g. azure-preview-build.json (old dev admission artifact)
  /\.preview\./i,
  /\.(map)$/i,                   // source maps (reveal original TS/JSX)
  /^\.env/i, /\.env$/i,          // env files
  /keystore|\.jks$|\.keystore$/i,
  /\.(pem|p12|pfx|key)$/i,       // private keys / certs
  /credentials?\.json$/i, /service[-_]?account/i,
];
// Only internal Markdown is forbidden; ignore legit content dirs if any appear later.
const isRootMarkdown = (rel) => extname(rel).toLowerCase() === '.md';

// Secret material inside text files. The Supabase *anon/publishable* JWT is public by design, so we only
// flag the service_role key and real private credentials, not every "secret"-looking substring.
const SECRET_CONTENT = [
  { re: /"?role"?\s*:\s*"service_role"/i, what: 'Supabase service_role JWT' },
  { re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/, what: 'private key block' },
  { re: /\b(sk_live|rk_live|sk_test)_[A-Za-z0-9]{10,}/, what: 'Stripe-style secret key' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/, what: 'Slack token' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, what: 'AWS access key id' },
  { re: /\bAIza[0-9A-Za-z_\-]{35}\b(?![\s\S]*google-services)/, what: 'Google API key (outside google-services)' },
];

const TEXT_EXT = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.css', '.txt', '.md', '.xml', '.svg', '.map']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const problems = [];
let files;
try {
  files = walk(DIST);
} catch {
  console.error(`verify-bundle: cannot read "${DIST}" — run after the build.`);
  process.exit(1);
}

// Native packages download the 16 content-pack languages from https://app.anacan.az/content-packs/
// (scripts/i18n/content-packs.mjs); shipping them again would add ~100 MB to the app.
const NATIVE = process.env.VITE_NATIVE_BUILD === 'true';
// Matches the data files themselves ("schema":"…", also JSON-escaped inside a JS chunk), not runtime constants.
const CONTENT_BUNDLE_SCHEMAS = /\\?"schema\\?"\s*:\s*\\?"anacan-content-(?:translations|pack-shard)-v1/;

for (const p of files) {
  const rel = relative(DIST, p);
  const name = basename(p);
  if (NATIVE && rel.split(/[\\/]/)[0] === 'content-packs') {
    problems.push(`content pack in native bundle: ${rel}`);
    continue;
  }
  if (FORBIDDEN_NAME.some((re) => re.test(name) || re.test(rel)) || isRootMarkdown(rel)) {
    problems.push(`forbidden file in bundle: ${rel}`);
    continue;
  }
  if (TEXT_EXT.has(extname(p).toLowerCase())) {
    let text = '';
    try { text = readFileSync(p, 'utf8'); } catch { continue; }
    for (const { re, what } of SECRET_CONTENT) {
      if (re.test(text)) problems.push(`possible ${what} in: ${rel}`);
    }
    if (NATIVE && CONTENT_BUNDLE_SCHEMAS.test(text)) problems.push(`content translation bundle in native bundle: ${rel}`);
  }
}

// The sealed Source Supabase project must never be the build's backend. A Google build made without
// .env.google silently falls back to the root .env (Source URL + Source anon key): web login then posts to
// the sealed project and every web user is cut off (web p6, 26.11.2026). The Source *URL* may appear as a
// constant (legacy storage-key migration), but its anon key (JWT payload "ref":"tntbjulojatnrqmylorp")
// only ships when it was selected as the backend. Source-first native bundles (VITE_BACKEND_BOOTSTRAP=
// source-first-v1) carry the Source key on purpose for one-way session adoption, so they are exempt.
const SOURCE_FIRST = process.env.VITE_BACKEND_BOOTSTRAP === 'source-first-v1';
const SOURCE_KEY_PAYLOAD = /eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudGJqdWxvamF0bnJxbXlsb3JwI/;
const SOURCE_BACKEND_URL = /url\s*:\s*"https:\/\/tntbjulojatnrqmylorp\.supabase\.co"/;
for (const p of SOURCE_FIRST ? [] : files) {
  if (!/\.(m?js|html)$/i.test(p)) continue;
  let text = '';
  try { text = readFileSync(p, 'utf8'); } catch { continue; }
  if (SOURCE_KEY_PAYLOAD.test(text) || SOURCE_BACKEND_URL.test(text)) {
    problems.push(`sealed Source Supabase backend configured in: ${relative(DIST, p)} (missing .env.google? run node setup-env-google.mjs)`);
  }
}

// Native store bundles must keep RevenueCat enabled on the managed (azure-named) Google backend;
// otherwise purchases, restore and entitlement sync are silently off in the shipped app.
if (process.env.VITE_NATIVE_BUILD === 'true' && process.env.VITE_AZURE_REVENUECAT_ENABLED !== 'true') {
  problems.push('native build without VITE_AZURE_REVENUECAT_ENABLED=true (store purchases would be disabled)');
}

if (problems.length) {
  console.error('\n✗ verify-bundle: the web bundle contains material that must not ship:\n');
  for (const p of problems) console.error('  - ' + p);
  console.error('\nMove it out of public/ (or fix the secret), then rebuild. The app bundle is public: anyone can unzip the signed APK/IPA.\n');
  process.exit(1);
}
console.log(`✓ verify-bundle: ${files.length} files in ${DIST} — no internal docs, dev artifacts or secrets.`);

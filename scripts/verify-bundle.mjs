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

for (const p of files) {
  const rel = relative(DIST, p);
  const name = basename(p);
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
  }
}

if (problems.length) {
  console.error('\n✗ verify-bundle: the web bundle contains material that must not ship:\n');
  for (const p of problems) console.error('  - ' + p);
  console.error('\nMove it out of public/ (or fix the secret), then rebuild. The app bundle is public: anyone can unzip the signed APK/IPA.\n');
  process.exit(1);
}
console.log(`✓ verify-bundle: ${files.length} files in ${DIST} — no internal docs, dev artifacts or secrets.`);

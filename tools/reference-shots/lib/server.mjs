// Starts the Vite dev server for the native consumer entry with a dummy backend env.
// VITE_NATIVE_BUILD=true makes src/main.tsx skip the browser store-launcher (src/web-entry) and the
// app-entry plugin's launcher script; VITE_BACKEND_BOOTSTRAP is left unset so admission is not
// source-first and the SDK targets VITE_SUPABASE_URL directly (storage key sb-api-auth-token).
// Process env wins over the repo's .env files in Vite, so nothing is written to the repo root.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

export const REPO_ROOT = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '');

// Syntactically valid anon JWT that grants nothing anywhere (signature is not a real HMAC).
const FAKE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InJlZmVyZW5jZS1zaG90cyJ9.cmVmZXJlbmNlLXNob3Rz';

export function harnessEnv() {
  return {
    VITE_NATIVE_BUILD: 'true',
    VITE_SUPABASE_URL: 'https://api.anacan.az',
    VITE_SUPABASE_PUBLISHABLE_KEY: FAKE_ANON_KEY,
    VITE_SUPABASE_PROJECT_ID: 'api',
    VITE_APP_VERSION: '48.0',
    VITE_BACKEND_BOOTSTRAP: '',
    VITE_AUTH_CUTOVER: '',
    VITE_INITIAL_MANAGED_ADMISSION: '',
    VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY: '',
    VITE_CONTENT_PACKS_ORIGIN: '',
    // Third-party SDKs stay unconfigured (they no-op without keys).
    VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_APP_ID: '', VITE_FIREBASE_MEASUREMENT_ID: '', VITE_FIREBASE_AUTH_DOMAIN: '',
    VITE_FIREBASE_PROJECT_ID: '', VITE_FIREBASE_STORAGE_BUCKET: '', VITE_FIREBASE_MESSAGING_SENDER_ID: '',
    VITE_CUSTOMERIO_ENABLED: 'false',
    // Feature flags as in the store build's Codemagic group (docs/CODEMAGIC.md), so the auth screen offers
    // Google/Apple sign-in and partner pairing exactly like the shipped app.
    VITE_AZURE_PARTNER_PAIRING: 'true', VITE_AZURE_GOOGLE_OAUTH_ENABLED: 'true', VITE_AZURE_APPLE_OAUTH_ENABLED: 'true',
    VITE_AZURE_REVENUECAT_ENABLED: 'true',
    VITE_ADMOB_IOS_APP_ID: '', VITE_ADMOB_ANDROID_APP_ID: '',
    BROWSER: 'none',
  };
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  });
}

export async function startDevServer({ log = console.log, port } = {}) {
  port = port || await freePort();
  const child = spawn(`${REPO_ROOT}/node_modules/.bin/vite`, ['--mode', 'google', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
    cwd: REPO_ROOT, env: { ...process.env, ...harnessEnv() }, stdio: ['ignore', 'pipe', 'pipe'], detached: false,
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const stop = () => { try { child.kill('SIGTERM'); } catch { /* gone */ } };
  for (const sig of ['exit', 'SIGINT', 'SIGTERM']) process.on(sig, () => { stop(); if (sig !== 'exit') process.exit(130); });
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`vite exited early:\n${output}`);
    try { const r = await fetch(origin + '/'); if (r.ok) break; } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  log(`vite dev server ${origin}`);
  // Warm the module graph once so the first scenarios do not race the on-demand transform.
  return { origin, stop, child };
}

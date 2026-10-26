// Local-only helper: writes .env.google for `npm run dev` (Google mode).
// Takes the PUBLIC anon key the live web app already ships to every browser
// from https://api.anacan.az and never prints the key itself.
import { writeFileSync, existsSync } from 'node:fs';

const API = 'https://api.anacan.az';
const SOURCE_REF = 'tntbjulojatnrqmylorp'; // sealed old Supabase project: never use

const html = await (await fetch(API + '/admin/login')).text();
const scripts = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]);
if (!scripts.length) throw new Error('Live app script not found');

const claims = token => {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()); } catch { return null; }
};
const candidates = new Map();
const seen = new Set(), queue = [...scripts];
while (queue.length) {
  const path = queue.shift();
  if (seen.has(path)) continue;
  seen.add(path);
  const js = await (await fetch(API + path)).text();
  for (const [, chunk] of js.matchAll(/["'(/](?:\.\/|\/)?(?:assets\/)?([\w.-]+\.js)["']/g)) queue.push('/assets/' + chunk);
  for (const [token] of js.matchAll(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g)) {
    const c = claims(token);
    if (c?.role === 'anon' && c.ref !== SOURCE_REF) candidates.set(token, c);
  }
  for (const [token] of js.matchAll(/sb_publishable_[\w-]{10,}/g)) candidates.set(token, { role: 'anon', iss: 'publishable' });
}
console.log(`Scanned ${seen.size} script files.`);
if (candidates.size !== 1) {
  throw new Error(`Expected exactly 1 Google anon key, found ${candidates.size}. Nothing written.`);
}
const [[key, c]] = candidates;
if (existsSync('.env.google')) throw new Error('.env.google already exists. Nothing written.');
writeFileSync('.env.google', `VITE_SUPABASE_URL=${API}\nVITE_SUPABASE_PUBLISHABLE_KEY=${key}\n`);
console.log(`.env.google written (role=${c.role}, iss=${c.iss ?? '-'}). Key not shown.`);

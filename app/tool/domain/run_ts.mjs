// Bundles a TypeScript entry under app/tool/domain/entries/ that imports the ORIGINAL React-app modules from
// src/**, with the repo's own esbuild, and imports it. Used by gen_data.mjs (data tables -> Dart) and
// gen_fixtures.mjs (cross-language fixtures). Browser / native / network modules are stubbed so the pure code
// runs in Node: `tr` returns the Azerbaijani default, Capacitor and Supabase are inert.
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const toolDir = path.dirname(fileURLToPath(import.meta.url));
export const appDir = path.resolve(toolDir, '../..');
export const repoDir = path.resolve(appDir, '..');

// With keyedTr, tr() returns MARK + key + MARK + default so data tables keep their translation keys.
export const TR_MARK = '\u2063';
const stubs = (keyedTr) => ({
  '@/lib/tr': (keyedTr ? `export const tr = (k, d) => '${TR_MARK}' + k + '${TR_MARK}' + d;` : 'export const tr = (_k, d) => d;') + ` export const formatTr = (_k, d, v) => d.replace(/\\{([A-Za-z_][A-Za-z0-9_]*)\\}/g, (m, n) => Object.prototype.hasOwnProperty.call(v || {}, n) ? String(v[n]) : m); export const getPersistedLanguage = () => 'az'; export const mapRowTranslation = (r) => r;`,
  '@/integrations/supabase/client': 'export const supabase = {};',
  '@/integrations/supabase/backend-config': 'export const isAzurePairingBackend = () => false; export const getBackendConfig = () => ({});',
  '@capacitor/core': 'export const Capacitor = { isNativePlatform: () => false, isPluginAvailable: () => false }; export const registerPlugin = () => ({});',
  '@capacitor/local-notifications': 'export const LocalNotifications = {};',
  '@capacitor/app': 'export const App = {};',
});

const stubPlugin = (STUBS) => ({
  name: 'domain-stubs',
  setup(b) {
    const filter = new RegExp(`^(${Object.keys(STUBS).map((k) => k.replace(/[/@.]/g, (c) => `\\${c}`)).join('|')})$`);
    b.onResolve({ filter }, (args) => ({ path: args.path, namespace: 'domain-stub' }));
    b.onLoad({ filter: /.*/, namespace: 'domain-stub' }, (args) => ({ contents: STUBS[args.path], loader: 'js' }));
  },
});

export async function loadEntry(name, { keyedTr = false } = {}) {
  const outdir = mkdtempSync(path.join(process.env.DOMAIN_TMP || tmpdir(), 'anacan-domain-'));
  const outfile = path.join(outdir, `${name}.mjs`);
  await build({
    entryPoints: [path.join(toolDir, 'entries', `${name}.ts`)],
    bundle: true, platform: 'node', format: 'esm', target: 'node20', outfile, logLevel: 'error',
    alias: { '@': path.join(repoDir, 'src') },
    plugins: [stubPlugin(stubs(keyedTr))],
    loader: { '.webp': 'empty', '.png': 'empty', '.css': 'empty', '.svg': 'empty' },
  });
  return import(pathToFileURL(outfile).href);
}

/** Freezes `Date.now()` / `new Date()` (no arguments) at `ms`, like vi.setSystemTime. Returns a restore function. */
export function setSystemTime(ms) {
  const Real = globalThis.__RealDate ?? Date;
  globalThis.__RealDate = Real;
  class FakeDate extends Real {
    constructor(...args) { if (args.length === 0) super(ms); else super(...args); }
    static now() { return ms; }
  }
  globalThis.Date = FakeDate;
  return () => { globalThis.Date = Real; };
}

// Codemagic Flutter builds: converts the existing anacan_native VITE_* variables into a
// JSON file for `flutter build … --dart-define-from-file=<file>`. Dart reads them with
// String.fromEnvironment / bool.fromEnvironment (flags are "true" / "false").
//
// Deliberately NOT emitted: the Customer.io CDP write key and the AdMob app IDs. They go
// only into native configuration (apply_native_config.mjs), because every Dart define is
// compiled into the Dart snapshot as a constant. Firebase web values are not needed.
//
// Public client identifiers (RevenueCat SDK keys, Google OAuth client ids) are read from the committed files the
// Capacitor build already uses (public_ids.mjs), not from Codemagic variables.
//
// Usage: node app/tool/codemagic/write_dart_defines.mjs [output.json]
//        (default app/build/codemagic/dart_defines.json, inside Flutter's ignored build/)
// Prints define names only, never values.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPublicIds } from './public_ids.mjs';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const output = resolve(process.argv[2] ?? `${appDir}/build/codemagic/dart_defines.json`);
const env = process.env;
const fail = message => { console.error(`Dart defines failed: ${message}`); process.exit(1); };
const flag = name => (env[name] === 'true' ? 'true' : 'false');
let publicIds;
try {
  publicIds = readPublicIds(resolve(appDir, '..'), env);
} catch (error) {
  fail(error.message);
}
const text = name => env[name] ?? '';

// Dart define name <- value. Keep names in sync with app/lib (String/bool.fromEnvironment) and docs/CODEMAGIC.md.
const defines = {
  ANACAN_API_URL: text('VITE_SUPABASE_URL'),
  ANACAN_ANON_KEY: text('VITE_SUPABASE_PUBLISHABLE_KEY'),
  ANACAN_SOURCE_ANON_KEY: text('VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY'),
  ANACAN_APP_VERSION: text('APP_VERSION'),
  ANACAN_INITIAL_MANAGED_ADMISSION: text('VITE_INITIAL_MANAGED_ADMISSION'),
  ANACAN_BACKEND_BOOTSTRAP: text('VITE_BACKEND_BOOTSTRAP'),
  ANACAN_AUTH_CUTOVER: flag('VITE_AUTH_CUTOVER'),
  // Same mode as the Capacitor bundle (`vite build --mode google`)
  ANACAN_BUILD_MODE: 'google',
  ANACAN_AZURE_PARTNER_PAIRING: flag('VITE_AZURE_PARTNER_PAIRING'),
  ANACAN_AZURE_GOOGLE_OAUTH_ENABLED: flag('VITE_AZURE_GOOGLE_OAUTH_ENABLED'),
  ANACAN_AZURE_APPLE_OAUTH_ENABLED: flag('VITE_AZURE_APPLE_OAUTH_ENABLED'),
  ANACAN_AZURE_REVENUECAT_ENABLED: flag('VITE_AZURE_REVENUECAT_ENABLED'),
  // Customer.io non-secret identifiers (the write key stays native-only)
  ANACAN_CUSTOMERIO_ENABLED: flag('VITE_CUSTOMERIO_ENABLED'),
  ANACAN_CUSTOMERIO_ENVIRONMENT: text('VITE_CUSTOMERIO_ENVIRONMENT'),
  ANACAN_CUSTOMERIO_REGION: text('VITE_CUSTOMERIO_REGION'),
  ANACAN_CUSTOMERIO_WORKSPACE_ID: text('VITE_CUSTOMERIO_WORKSPACE_ID'),
  ANACAN_CUSTOMERIO_SOURCE_ID: text('VITE_CUSTOMERIO_SOURCE_ID'),
  // RevenueCat public SDK keys and Google OAuth client ids (committed sources, see public_ids.mjs)
  ANACAN_RC_ANDROID_API_KEY: publicIds.ANACAN_RC_ANDROID_API_KEY,
  ANACAN_RC_IOS_API_KEY: publicIds.ANACAN_RC_IOS_API_KEY,
  ANACAN_RC_FALLBACK_API_KEY: publicIds.ANACAN_RC_FALLBACK_API_KEY,
  ANACAN_GOOGLE_SERVER_CLIENT_ID: publicIds.ANACAN_GOOGLE_SERVER_CLIENT_ID,
  ANACAN_GOOGLE_IOS_CLIENT_ID: publicIds.ANACAN_GOOGLE_IOS_CLIENT_ID,
};

for (const name of ['ANACAN_API_URL', 'ANACAN_ANON_KEY', 'ANACAN_SOURCE_ANON_KEY', 'ANACAN_APP_VERSION',
  'ANACAN_INITIAL_MANAGED_ADMISSION', 'ANACAN_BACKEND_BOOTSTRAP']) {
  if (!defines[name]) fail(`${name} would be empty (run check_env.mjs first)`);
}

// Native-only values must never become Dart constants, not even as part of another value.
const nativeOnly = ['VITE_CUSTOMERIO_CDP_WRITE_KEY', 'VITE_ADMOB_IOS_APP_ID', 'VITE_ADMOB_ANDROID_APP_ID']
  .filter(name => env[name]);
for (const [name, value] of Object.entries(defines)) {
  for (const secretName of nativeOnly) {
    if (value.includes(env[secretName])) fail(`${name} contains the value of ${secretName}`);
  }
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(defines, null, 2) + '\n', { mode: 0o600 });
console.log(`Dart defines written (${Object.keys(defines).length}): ${Object.keys(defines).join(', ')}`);

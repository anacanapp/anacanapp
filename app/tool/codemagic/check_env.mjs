// Codemagic Flutter build guard (ios-flutter-store / android-flutter-store). Mirrors
// scripts/codemagic/check-native-env.mjs for the Flutter app: fails before any Flutter
// step when the private group anacan_native is missing or still points at the sealed
// Source backend, and also checks the live AdMob app ID and Customer.io settings that
// apply_native_config.mjs later writes into the native projects.
// Usage: node app/tool/codemagic/check_env.mjs ios|android
// Prints variable names and verdicts only, never values.
const SOURCE_REF = 'tntbjulojatnrqmylorp';
const ADMISSION_URL = 'https://api.anacan.az/.well-known/anacan-backend.json';
const TEST_ADMOB_PUBLISHER = 'ca-app-pub-3940256099942544~';
const platform = process.argv[2];
const env = process.env;
const errors = [];

if (!['ios', 'android'].includes(platform)) errors.push('platform argument must be ios or android');
// The Flutter workflows set APP_VERSION (60.0); VITE_APP_VERSION / VITE_NATIVE_BUILD belong to the Capacitor web build.
if (!/^\d+\.\d+$/.test(env.APP_VERSION ?? '')) errors.push('APP_VERSION must look like 60.0');
if (env.VITE_SUPABASE_URL !== 'https://api.anacan.az') errors.push('VITE_SUPABASE_URL must be https://api.anacan.az');
// RevenueCat stays off on the managed backend path unless explicitly enabled: a missing flag ships
// an app whose paywall can never sell.
if (env.VITE_AZURE_REVENUECAT_ENABLED !== 'true') errors.push('VITE_AZURE_REVENUECAT_ENABLED must be "true"');

const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
if (!key) errors.push('VITE_SUPABASE_PUBLISHABLE_KEY is missing');
else if (key.startsWith('eyJ')) {
  try {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (claims.role !== 'anon') errors.push('VITE_SUPABASE_PUBLISHABLE_KEY is not an anon key');
    if (claims.ref === SOURCE_REF) errors.push('VITE_SUPABASE_PUBLISHABLE_KEY belongs to the sealed Source project');
  } catch { errors.push('VITE_SUPABASE_PUBLISHABLE_KEY is not a readable JWT'); }
}

// Store natives keep source-first-v1 adoption: both distinct keys, no auth cutover.
if (env.VITE_BACKEND_BOOTSTRAP !== 'source-first-v1') errors.push('VITE_BACKEND_BOOTSTRAP must be "source-first-v1"');
if (env.VITE_AUTH_CUTOVER !== 'false') errors.push('VITE_AUTH_CUTOVER must be "false"');
const sourceKey = env.VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY ?? '';
if (!sourceKey) errors.push('VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY is missing');
else if (sourceKey === key) errors.push('VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY must differ from VITE_SUPABASE_PUBLISHABLE_KEY');

// Live AdMob app ID for this platform, never Google's sample publisher.
if (platform) {
  const admobName = platform === 'ios' ? 'VITE_ADMOB_IOS_APP_ID' : 'VITE_ADMOB_ANDROID_APP_ID';
  const admobId = env[admobName] ?? '';
  if (!/^ca-app-pub-\d{16}~\d{10}$/.test(admobId) || admobId.startsWith(TEST_ADMOB_PUBLISHER)) {
    errors.push(`${admobName} must be the live AdMob app ID`);
  }
}

// Customer.io Data In: same rule as apply-native-config.mjs.
if (env.VITE_CUSTOMERIO_ENABLED === 'true') {
  if (!['production', 'sandbox'].includes(env.VITE_CUSTOMERIO_ENVIRONMENT) || env.VITE_CUSTOMERIO_REGION !== 'EU'
    || !env.VITE_CUSTOMERIO_CDP_WRITE_KEY) {
    errors.push('Customer.io needs VITE_CUSTOMERIO_ENVIRONMENT, VITE_CUSTOMERIO_REGION=EU and VITE_CUSTOMERIO_CDP_WRITE_KEY');
  }
}

// The bundled offline admission must be the managed (azure-named) Google decision
// that the public control endpoint serves right now, field for field.
const FIELDS = ['schema', 'generation', 'phase', 'minNativeVersion', 'handoffSha256'];
const canonical = value => JSON.stringify(FIELDS.map(field => value?.[field]));
let bundled;
try {
  bundled = JSON.parse(env.VITE_INITIAL_MANAGED_ADMISSION ?? '');
  if (Object.keys(bundled).sort().join() !== [...FIELDS].sort().join()) errors.push('VITE_INITIAL_MANAGED_ADMISSION has unexpected fields');
  if (bundled.schema !== 'anacan-backend-admission-v1' || bundled.phase !== 'azure' || !(bundled.generation >= 2)) {
    errors.push('VITE_INITIAL_MANAGED_ADMISSION must be a managed azure admission, generation 2 or later');
  }
} catch { bundled = undefined; errors.push('VITE_INITIAL_MANAGED_ADMISSION is missing or not JSON'); }
if (bundled) {
  try {
    const response = await fetch(ADMISSION_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    if (canonical(await response.json()) !== canonical(bundled)) {
      errors.push('VITE_INITIAL_MANAGED_ADMISSION differs from the live admission at api.anacan.az');
    }
  } catch (error) { errors.push(`Live admission could not be read (${error.message})`); }
}

if (errors.length) {
  console.error('Flutter native environment check failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}
const names = Object.keys(env).filter(name => name.startsWith('VITE_')).sort();
console.log(`Flutter native environment OK for ${platform} (${names.length} VITE_ variables): ${names.join(', ')}`);

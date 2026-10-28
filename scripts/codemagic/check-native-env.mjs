// Codemagic native build guard: fails before Vite runs when the private native
// environment group is missing or still points at the sealed Source backend.
// Prints variable names and verdicts only, never values.
const SOURCE_REF = 'tntbjulojatnrqmylorp';
const env = process.env;
const errors = [];

if (env.VITE_NATIVE_BUILD !== 'true') errors.push('VITE_NATIVE_BUILD must be "true"');
if (env.VITE_SUPABASE_URL !== 'https://api.anacan.az') errors.push('VITE_SUPABASE_URL must be https://api.anacan.az');
if (!/^\d+\.\d+$/.test(env.VITE_APP_VERSION ?? '')) errors.push('VITE_APP_VERSION must look like 48.0');

const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';
if (!key) errors.push('VITE_SUPABASE_PUBLISHABLE_KEY is missing');
else if (key.startsWith('eyJ')) {
  try {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (claims.role !== 'anon') errors.push('VITE_SUPABASE_PUBLISHABLE_KEY is not an anon key');
    if (claims.ref === SOURCE_REF) errors.push('VITE_SUPABASE_PUBLISHABLE_KEY belongs to the sealed Source project');
  } catch { errors.push('VITE_SUPABASE_PUBLISHABLE_KEY is not a readable JWT'); }
}

// Store natives keep source-first-v1 adoption: selectAdmittedBackend() refuses to
// boot without both distinct keys and with VITE_AUTH_CUTOVER=true.
if (env.VITE_BACKEND_BOOTSTRAP !== 'source-first-v1') errors.push('VITE_BACKEND_BOOTSTRAP must be "source-first-v1"');
if (env.VITE_AUTH_CUTOVER !== 'false') errors.push('VITE_AUTH_CUTOVER must be "false"');
const sourceKey = env.VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY ?? '';
if (!sourceKey) errors.push('VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY is missing');
else if (sourceKey === key) errors.push('VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY must differ from VITE_SUPABASE_PUBLISHABLE_KEY');

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
} catch { errors.push('VITE_INITIAL_MANAGED_ADMISSION is missing or not JSON'); }
if (bundled) {
  try {
    const response = await fetch('https://api.anacan.az/.well-known/anacan-backend.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    if (canonical(await response.json()) !== canonical(bundled)) {
      errors.push('VITE_INITIAL_MANAGED_ADMISSION differs from the live admission at api.anacan.az');
    }
  } catch (error) { errors.push(`Live admission could not be read (${error.message})`); }
}

if (errors.length) {
  console.error('Native environment check failed:\n- ' + errors.join('\n- '));
  process.exit(1);
}
const names = Object.keys(env).filter(name => name.startsWith('VITE_')).sort();
console.log(`Native environment OK (${names.length} VITE_ variables): ${names.join(', ')}`);

// Codemagic native staging after `cap sync <platform>`: puts the live AdMob app ID
// into the native project and the Customer.io write key into the generated (ignored)
// capacitor.config.json, as the private candidate staging did for 47.
// Usage: node scripts/codemagic/apply-native-config.mjs ios|android
// Prints names and verdicts only, never values.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const platform = process.argv[2];
const env = process.env;
const fail = message => { console.error(`Native config failed: ${message}`); process.exit(1); };
if (!['ios', 'android'].includes(platform)) fail('platform must be ios or android');

const paths = platform === 'ios'
  ? { config: 'ios/App/App/capacitor.config.json', web: 'ios/App/App/public', plist: 'ios/App/App/Info.plist' }
  : { config: 'android/app/src/main/assets/capacitor.config.json', web: 'android/app/src/main/assets/public',
      admob: 'android/app/src/main/res/values/admob.xml' };
if (!existsSync(paths.config) || !existsSync(paths.web)) fail(`run "npx cap sync ${platform}" first`);

// AdMob: live app ID only, never Google's sample publisher.
const admobName = platform === 'ios' ? 'VITE_ADMOB_IOS_APP_ID' : 'VITE_ADMOB_ANDROID_APP_ID';
const admobId = env[admobName] ?? '';
if (!/^ca-app-pub-\d{16}~\d{10}$/.test(admobId) || admobId.startsWith('ca-app-pub-3940256099942544~')) {
  fail(`${admobName} must be the live AdMob app ID`);
}
if (platform === 'ios') {
  const plist = readFileSync(paths.plist, 'utf8');
  const pattern = /(<key>GADApplicationIdentifier<\/key>\s*<string>)[^<]*(<\/string>)/;
  if (!pattern.test(plist)) fail('GADApplicationIdentifier not found in Info.plist');
  writeFileSync(paths.plist, plist.replace(pattern, `$1${admobId}$2`));
} else {
  const xml = readFileSync(paths.admob, 'utf8');
  const pattern = /(<string name="admob_app_id"[^>]*>)[^<]*(<\/string>)/;
  if (!pattern.test(xml)) fail('admob_app_id not found in admob.xml');
  writeFileSync(paths.admob, xml.replace(pattern, `$1${admobId}$2`));
}

// Customer.io Data In: the write key lives only in native plugin configuration.
const config = JSON.parse(readFileSync(paths.config, 'utf8'));
config.plugins ??= {};
delete config.plugins.CustomerIoDataIn;
const writeKey = env.VITE_CUSTOMERIO_CDP_WRITE_KEY ?? '';
let customerIo = 'off';
if (env.VITE_CUSTOMERIO_ENABLED === 'true') {
  const environment = env.VITE_CUSTOMERIO_ENVIRONMENT;
  if (!['production', 'sandbox'].includes(environment) || env.VITE_CUSTOMERIO_REGION !== 'EU' || !writeKey) {
    fail('Customer.io needs VITE_CUSTOMERIO_ENVIRONMENT, VITE_CUSTOMERIO_REGION=EU and VITE_CUSTOMERIO_CDP_WRITE_KEY');
  }
  config.plugins.CustomerIoDataIn = { cdpApiKey: writeKey, enabled: true, region: 'EU', environment };
  customerIo = environment;
}
writeFileSync(paths.config, JSON.stringify(config, null, '\t') + '\n');

// The write key must never reach the JavaScript bundle.
if (writeKey) {
  const scan = dir => readdirSync(dir).some(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return scan(path);
    return /\.(js|html|json|css|map)$/.test(name) && readFileSync(path, 'utf8').includes(writeKey);
  });
  if (scan(paths.web)) fail('Customer.io write key found in the web bundle');
}

console.log(`Native config OK for ${platform}: AdMob live app ID set, Customer.io ${customerIo}.`);

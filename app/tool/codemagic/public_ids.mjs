// Public client identifiers the Capacitor app already ships from committed files. The Flutter build reads them
// from the same files at build time instead of new Codemagic variables (one source; nothing secret):
//
//   ANACAN_RC_ANDROID_API_KEY   src/lib/revenuecat.ts  REVENUECAT_CONFIG.ANDROID_API_KEY   (goog_…, public SDK key)
//   ANACAN_RC_IOS_API_KEY       src/lib/revenuecat.ts  REVENUECAT_CONFIG.IOS_API_KEY       (appl_…, public SDK key)
//   ANACAN_RC_FALLBACK_API_KEY  src/lib/revenuecat.ts  REVENUECAT_CONFIG.API_KEY           (used only without a platform key)
//   ANACAN_GOOGLE_SERVER_CLIENT_ID  android/app/google-services.json  oauth_client with client_type 3 (Web client;
//                                   the ID-token audience the Supabase Google provider accepts)
//   ANACAN_GOOGLE_IOS_CLIENT_ID     ios/App/App/GoogleService-Info.plist  CLIENT_ID
//   (iOS URL scheme)                ios/App/App/GoogleService-Info.plist  REVERSED_CLIENT_ID
//
// An environment variable of the same name overrides a value (e.g. a staging RevenueCat project).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const formats = {
  ANACAN_RC_ANDROID_API_KEY: /^goog_[A-Za-z0-9]+$/,
  ANACAN_RC_IOS_API_KEY: /^appl_[A-Za-z0-9]+$/,
  ANACAN_RC_FALLBACK_API_KEY: /^[a-z]+_[A-Za-z0-9]+$/,
  ANACAN_GOOGLE_SERVER_CLIENT_ID: /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/,
  ANACAN_GOOGLE_IOS_CLIENT_ID: /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/,
  ANACAN_GOOGLE_REVERSED_CLIENT_ID: /^com\.googleusercontent\.apps\.\d+-[a-z0-9]+$/,
};

function plistString(xml, key) {
  const match = xml.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`));
  return match ? match[1].trim() : '';
}

/** Reads the identifiers; throws with the name of a missing / malformed one. */
export function readPublicIds(repoRoot, env = process.env) {
  const revenuecat = readFileSync(resolve(repoRoot, 'src/lib/revenuecat.ts'), 'utf8');
  const rc = name => (revenuecat.match(new RegExp(`\\b${name}:\\s*'([^']*)'`)) ?? [])[1] ?? '';
  const services = JSON.parse(readFileSync(resolve(repoRoot, 'android/app/google-services.json'), 'utf8'));
  const app = (services.client ?? []).find(c => c.client_info?.android_client_info?.package_name === 'com.atlasoon.anacan');
  const web = (app?.oauth_client ?? []).find(o => o.client_type === 3)?.client_id ?? '';
  const plist = readFileSync(resolve(repoRoot, 'ios/App/App/GoogleService-Info.plist'), 'utf8');

  const ids = {
    ANACAN_RC_ANDROID_API_KEY: rc('ANDROID_API_KEY'),
    ANACAN_RC_IOS_API_KEY: rc('IOS_API_KEY'),
    ANACAN_RC_FALLBACK_API_KEY: rc('API_KEY'),
    ANACAN_GOOGLE_SERVER_CLIENT_ID: web,
    ANACAN_GOOGLE_IOS_CLIENT_ID: plistString(plist, 'CLIENT_ID'),
    ANACAN_GOOGLE_REVERSED_CLIENT_ID: plistString(plist, 'REVERSED_CLIENT_ID'),
  };
  for (const name of Object.keys(ids)) {
    if (env[name]) ids[name] = env[name];
    if (!formats[name].test(ids[name])) throw new Error(`${name} is missing or malformed in its committed source`);
  }
  return ids;
}

#!/usr/bin/env node
// Brings the Flutter iOS Runner to the Capacitor app's App Store–relevant configuration (docs/flutter/BUILD.md
// "Info.plist / entitlements parity backlog"): development region + CFBundleLocalizations, the 15 usage strings
// (base value Azerbaijani) and their 25 InfoPlist.strings translations, LSApplicationQueriesSchemes (non-Meta),
// PrivacyInfo.xcprivacy, and the Runner entitlements (push, Sign in with Apple, HealthKit, App Group).
// Sources: ios/App/App/{Info.plist,*.lproj/InfoPlist.strings,PrivacyInfo.xcprivacy,App*.entitlements}.
//   node app/tool/ios/apply_ios_parity.mjs          (idempotent: running it again changes nothing)
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const cap = join(root, 'ios/App/App');
const runner = join(root, 'app/ios/Runner');
const pbxPath = join(root, 'app/ios/Runner.xcodeproj/project.pbxproj');

// ── Info.plist ──────────────────────────────────────────────────────────────────────────────────────────────
const capPlist = readFileSync(join(cap, 'Info.plist'), 'utf8');
let plist = readFileSync(join(runner, 'Info.plist'), 'utf8');

/** The raw `<key>k</key>\n\t<value…>` block of [key] in the Capacitor plist (value may be a dict / array). */
function capBlock(key) {
  const start = capPlist.indexOf(`<key>${key}</key>`);
  if (start < 0) throw new Error(`missing in Capacitor Info.plist: ${key}`);
  const after = capPlist.slice(start + `<key>${key}</key>`.length);
  const m = /^\s*(<string>[\s\S]*?<\/string>|<true\/>|<false\/>|<array>[\s\S]*?<\/array>|<array\/>)/.exec(after);
  if (!m) throw new Error(`unsupported value for ${key}`);
  return `\t<key>${key}</key>\n\t${m[1].trim()}\n`;
}

const USAGE_KEYS = [
  'NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription',
  'NSMicrophoneUsageDescription', 'NSLocationWhenInUseUsageDescription', 'NSLocationAlwaysAndWhenInUseUsageDescription',
  'NSFaceIDUsageDescription', 'NSContactsUsageDescription', 'NSCalendarsUsageDescription', 'NSMotionUsageDescription',
  'NSHealthShareUsageDescription', 'NSHealthUpdateUsageDescription', 'NSBluetoothAlwaysUsageDescription',
  'NSLocalNetworkUsageDescription', 'NSUserTrackingUsageDescription',
];

const add = [];
for (const key of ['CFBundleLocalizations', ...USAGE_KEYS]) {
  if (!plist.includes(`<key>${key}</key>`)) add.push(capBlock(key));
}
if (!plist.includes('<key>LSApplicationQueriesSchemes</key>')) {
  // Meta schemes (fbapi, fb-messenger-share-api, fbauth2, fbshareextension) come with the Meta SDK feature.
  add.push('\t<key>LSApplicationQueriesSchemes</key>\n\t<array>\n\t\t<string>itms-apps</string>\n\t\t<string>mailto</string>\n\t\t<string>tel</string>\n\t\t<string>https</string>\n\t\t<string>http</string>\n\t</array>\n');
}
plist = plist.replace(/(<key>CFBundleDevelopmentRegion<\/key>\s*<string>)[^<]*(<\/string>)/, '$1az$2');
if (add.length) plist = plist.replace(/\n<\/dict>\s*<\/plist>\s*$/, `\n${add.join('')}</dict>\n</plist>\n`);
writeFileSync(join(runner, 'Info.plist'), plist);

// ── Resource files ──────────────────────────────────────────────────────────────────────────────────────────
const lprojs = readdirSync(cap).filter((d) => d.endsWith('.lproj') && existsSync(join(cap, d, 'InfoPlist.strings'))).sort();
for (const d of lprojs) {
  mkdirSync(join(runner, d), { recursive: true });
  copyFileSync(join(cap, d, 'InfoPlist.strings'), join(runner, d, 'InfoPlist.strings'));
}
copyFileSync(join(cap, 'PrivacyInfo.xcprivacy'), join(runner, 'PrivacyInfo.xcprivacy'));
copyFileSync(join(cap, 'App.entitlements'), join(runner, 'Runner.entitlements'));
copyFileSync(join(cap, 'App.Debug.entitlements'), join(runner, 'Runner.Debug.entitlements'));

// ── Xcode project ───────────────────────────────────────────────────────────────────────────────────────────
let pbx = readFileSync(pbxPath, 'utf8');
const id = (name) => createHash('sha1').update(`anacan-ios-parity:${name}`).digest('hex').slice(0, 24).toUpperCase();
const insertBefore = (marker, text) => {
  const i = pbx.indexOf(marker);
  if (i < 0) throw new Error(`marker not found: ${marker}`);
  pbx = pbx.slice(0, i) + text + pbx.slice(i);
};
/** Adds [line] to the `children`/`files` list that follows [header]. */
const addToList = (header, line) => {
  const i = pbx.indexOf(header);
  if (i < 0) throw new Error(`list not found: ${header}`);
  const close = pbx.indexOf('\t\t\t);', i);
  pbx = pbx.slice(0, close) + `\t\t\t\t${line}\n` + pbx.slice(close);
};

if (!pbx.includes('/* PrivacyInfo.xcprivacy */')) {
  const priv = id('privacy'), privBuild = id('privacy-build');
  const strings = id('infoplist-strings'), stringsBuild = id('infoplist-strings-build');
  const ent = id('entitlements'), entDebug = id('entitlements-debug');
  insertBefore('/* End PBXBuildFile section */',
    `\t\t${privBuild} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${priv} /* PrivacyInfo.xcprivacy */; };\n` +
    `\t\t${stringsBuild} /* InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = ${strings} /* InfoPlist.strings */; };\n`);
  let refs = `\t\t${priv} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n` +
    `\t\t${ent} /* Runner.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = Runner.entitlements; sourceTree = "<group>"; };\n` +
    `\t\t${entDebug} /* Runner.Debug.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = Runner.Debug.entitlements; sourceTree = "<group>"; };\n`;
  const regions = lprojs.map((d) => d.replace(/\.lproj$/, ''));
  for (const r of regions) {
    refs += `\t\t${id(`strings-${r}`)} /* ${r} */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ${r}; path = ${r}.lproj/InfoPlist.strings; sourceTree = "<group>"; };\n`;
  }
  insertBefore('/* End PBXFileReference section */', refs);
  insertBefore('/* End PBXVariantGroup section */',
    `\t\t${strings} /* InfoPlist.strings */ = {\n\t\t\tisa = PBXVariantGroup;\n\t\t\tchildren = (\n` +
    regions.map((r) => `\t\t\t\t${id(`strings-${r}`)} /* ${r} */,\n`).join('') +
    `\t\t\t);\n\t\t\tname = InfoPlist.strings;\n\t\t\tsourceTree = "<group>";\n\t\t};\n`);
  for (const line of [`${priv} /* PrivacyInfo.xcprivacy */,`, `${strings} /* InfoPlist.strings */,`, `${ent} /* Runner.entitlements */,`, `${entDebug} /* Runner.Debug.entitlements */,`]) {
    addToList('97C146F01CF9000F007C117D /* Runner */ = {', line);
  }
  for (const line of [`${privBuild} /* PrivacyInfo.xcprivacy in Resources */,`, `${stringsBuild} /* InfoPlist.strings in Resources */,`]) {
    addToList('97C146EC1CF9000F007C117D /* Resources */ = {', line);
  }
  // knownRegions: every localization (Xcode lists them for the variant group).
  pbx = pbx.replace(/knownRegions = \(\n([\s\S]*?)\t\t\t\);/, (m, body) => {
    const have = new Set(body.split('\n').map((l) => l.trim().replace(/[",]/g, '')).filter(Boolean));
    const extra = regions.filter((r) => !have.has(r)).map((r) => `\t\t\t\t${/^[a-z]+$/.test(r) ? r : `"${r}"`},\n`).join('');
    return `knownRegions = (\n${body}${extra}\t\t\t);`;
  });
  // Entitlements on the Runner configurations (the ones with INFOPLIST_FILE = Runner/Info.plist).
  pbx = pbx.replace(/(\t\t\tbuildSettings = \{\n)((?:(?!\t\t\t\};)[\s\S])*?INFOPLIST_FILE = Runner\/Info\.plist;[\s\S]*?\t\t\t\};\n\t\t\tname = (\w+);)/g,
    (m, open, body, name) => `${open}\t\t\t\tCODE_SIGN_ENTITLEMENTS = ${name === 'Debug' ? 'Runner/Runner.Debug.entitlements' : 'Runner/Runner.entitlements'};\n${body}`);
}
writeFileSync(pbxPath, pbx);
console.log(`Info.plist: +${add.length} keys; ${lprojs.length} InfoPlist.strings; PrivacyInfo + entitlements; project updated`);

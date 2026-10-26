import { execFileSync, spawn } from 'node:child_process';
import { access, copyFile, mkdir, mkdtemp, open, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import plistFormat from 'plist';
import path from 'node:path';
import { webManifest } from './release-evidence.mjs';

process.umask(0o077);
const root = fileURLToPath(new URL('../', import.meta.url));
const release = JSON.parse(await readFile(path.join(root, 'store/release.json'), 'utf8'));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (pkg.version !== release.version) throw new Error('Package and store release versions must match');
const platform = process.argv[2];
const exportOnly = process.argv[3] === '--export-only';
if (!['ios', 'android'].includes(platform)) throw new Error('Choose ios or android');
if (process.argv[3] && !(platform === 'ios' && exportOnly)) throw new Error('Only iOS supports --export-only');
await access(path.join(root, 'artifacts'));
const output = path.join(root, 'artifacts', `store-${release.version}`);
await mkdir(output, { recursive: true });
const report = { version: release.version, build: release.build, bundleId: release.bundleId, platform, phases: [], uploaded: false, result: 'pending' };
const reportPath = path.join(output, `${platform}-store-build.json`);
async function execute(command, args, label, cwd = root, env = process.env) {
  const log = path.join(output, `${label}.log`);
  const file = await open(log, 'w', 0o600);
  let launchFailed = false;
  const phase = { phase: label, exitCode: null, log: path.relative(root, log) };
  report.phases.push(phase);
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', file.fd, file.fd] });
    child.on('error', () => { launchFailed = true; resolve(null); }); child.on('close', resolve);
  });
  await file.close();
  phase.exitCode = exitCode;
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  if (launchFailed || exitCode !== 0) throw new Error(`${label} failed; inspect ${path.relative(root, log)}`);
  return readFile(log, 'utf8');
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const artifact = async filename => { const bytes = await readFile(filename); return { file: path.relative(root, filename), bytes: bytes.length, sha256: hash(bytes) }; };
const plist = bytes => plistFormat.parse(execFileSync('plutil', ['-convert', 'xml1', '-o', '-', '-'], { input: bytes, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' }));
const command = (name, args) => execFileSync(name, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const webFiles = [];
async function manifest(folder, prefix = '') {
  for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) await manifest(path.join(folder, entry.name), relative);
    else webFiles.push({ file: relative, sha256: hash(await readFile(path.join(folder, entry.name))) });
  }
}
async function verifyWeb(folder) {
  for (const file of webFiles) if (hash(await readFile(path.join(folder, file.file))) !== file.sha256) throw new Error(`Release web asset mismatch: ${file.file}`);
  return webFiles.length;
}
function verifyArchiveWeb(filename, prefix) {
  for (const file of webFiles) {
    const bytes = execFileSync('unzip', ['-p', filename, prefix + file.file], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
    if (hash(bytes) !== file.sha256) throw new Error(`Packaged release asset mismatch: ${file.file}`);
  }
  return webFiles.length;
}
async function verifyIOS(app, distribution = false) {
  const info = plist(await readFile(path.join(app, 'Info.plist')));
  if (info.CFBundleIdentifier !== release.bundleId || info.CFBundleShortVersionString !== release.version || info.CFBundleVersion !== String(release.build)) throw new Error('iOS release identity mismatch');
  const entitlements = plist(command('codesign', ['-d', '--entitlements', ':-', app]));
  if (entitlements['application-identifier'] !== `${release.appleTeam}.${release.bundleId}` || entitlements['com.apple.developer.team-identifier'] !== release.appleTeam) throw new Error('iOS signing team mismatch');
  const profile = plist(command('security', ['cms', '-D', '-i', path.join(app, 'embedded.mobileprovision')]));
  const profileId = profile.Entitlements?.['application-identifier'];
  const exactId = `${release.appleTeam}.${release.bundleId}`;
  if (!(profileId === exactId || !distribution && profileId === `${release.appleTeam}.*`) || !profile.TeamIdentifier?.includes(release.appleTeam) || new Date(profile.ExpirationDate) <= new Date()) throw new Error('iOS provisioning identity mismatch');
  if (distribution && (entitlements['get-task-allow'] !== false || profile.Entitlements?.['get-task-allow'] !== false || profile.ProvisionedDevices || profile.ProvisionsAllDevices)) throw new Error('App Store distribution provisioning is required');
  const config = JSON.parse(await readFile(path.join(app, 'capacitor.config.json'), 'utf8'));
  if (config.server?.url || config.appId !== release.bundleId || config.loggingBehavior !== 'debug') throw new Error('Bundled offline release configuration required');
  const privacy = plist(await readFile(path.join(app, 'PrivacyInfo.xcprivacy')));
  if (privacy.NSPrivacyTracking !== false || privacy.NSPrivacyTrackingDomains.length || privacy.NSPrivacyCollectedDataTypes.length) throw new Error('iOS no-tracking declarations mismatch');
  const assets = await verifyWeb(path.join(app, 'public'));
  return { identityVerified: true, teamVerified: true, signatureVerified: true, distributionProfileVerified: distribution, privacyManifestVerified: true, assetsVerified: assets };
}
try {
  await manifest(path.join(root, 'dist'));
  report.webManifestSha256 = (await webManifest()).sha256;
  report.assets = webFiles;
  if (platform === 'ios') {
    const archive = path.join(output, 'startup.io.xcarchive');
    if (exportOnly) await access(path.join(archive, 'Products/Applications/App.app'));
    else await execute('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Release', '-destination', 'generic/platform=iOS', '-derivedDataPath', 'artifacts/ios-store-derived', '-archivePath', archive, '-jobs', '2', '-allowProvisioningUpdates', 'archive'], 'ios-store-archive');
    report.archive = path.relative(root, archive);
    const archivedApp = path.join(archive, 'Products/Applications/App.app');
    await execute('codesign', ['--verify', '--deep', '--strict', archivedApp], 'ios-archive-signature');
    report.archiveAcceptance = await verifyIOS(archivedApp);
    const exported = path.join(output, 'app-store-export');
    await execute('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportOptionsPlist', 'store/ExportOptions-AppStore.plist', '-exportPath', exported, '-allowProvisioningUpdates'], 'ios-app-store-export');
    const ipa = (await readdir(exported)).find(name => name.endsWith('.ipa'));
    if (!ipa) throw new Error('App Store IPA missing');
    const destination = path.join(output, `startup-io-${release.version}-app-store.ipa`);
    await copyFile(path.join(exported, ipa), destination);
    const unpacked = await mkdtemp(path.join(output, '.ios-verification-'));
    try {
      command('ditto', ['-x', '-k', destination, unpacked]);
      const appName = (await readdir(path.join(unpacked, 'Payload'))).find(name => name.endsWith('.app'));
      if (!appName) throw new Error('Exported app missing');
      const app = path.join(unpacked, 'Payload', appName);
      await execute('codesign', ['--verify', '--deep', '--strict', app], 'ios-distribution-signature');
      report.acceptance = await verifyIOS(app, true);
    } finally { await rm(unpacked, { recursive: true, force: true }); }
    report.ipa = await artifact(destination);
  } else {
    const javaHome = process.env.JAVA_HOME ?? '/var/folders/63/23_9ghpd0zl_sty24xn_r_t80000gn/T/opencode/jdk-21.0.12.1+1/Contents/Home';
    await access(path.join(javaHome, 'bin/java'));
    const sdk = process.env.ANDROID_HOME ?? '/Users/jamilturkan/Library/Android/sdk';
    const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdk };
    await execute('./gradlew', [':app:assembleRelease', ':app:bundleRelease', ':app:lintRelease', '--console=plain', '--max-workers=2'], 'android-release', path.join(root, 'android'), env);
    const apk = path.join(output, `startup-io-${release.version}-android-release.apk`); const aab = path.join(output, `startup-io-${release.version}-play-store.aab`);
    await copyFile(path.join(root, 'android/app/build/outputs/apk/release/app-release.apk'), apk);
    await copyFile(path.join(root, 'android/app/build/outputs/bundle/release/app-release.aab'), aab);
    await execute(path.join(sdk, 'build-tools/36.0.0/apksigner'), ['verify', '--verbose', apk], 'android-signature', root, env);
    await execute(path.join(sdk, 'build-tools/36.0.0/zipalign'), ['-c', '-P', '16', '4', apk], 'android-alignment', root, env);
    const bundleSignature = await execute(path.join(javaHome, 'bin/jarsigner'), ['-verify', aab], 'android-bundle-signature', root, env);
    if (!bundleSignature.includes('jar verified.') || bundleSignature.includes('jar is unsigned.')) throw new Error('Signed Android bundle required');
    const badging = await execute(path.join(sdk, 'build-tools/36.0.0/aapt'), ['dump', 'badging', apk], 'android-package-identity', root, env);
    if (!badging.includes(`name='${release.bundleId}' versionCode='${release.build}' versionName='${release.version}'`) || badging.includes('application-debuggable')) throw new Error('Android release identity or debuggable flag mismatch');
    const androidConfig = JSON.parse(command('unzip', ['-p', apk, 'assets/capacitor.config.json']));
    if (androidConfig.server?.url || androidConfig.appId !== release.bundleId || androidConfig.android?.webContentsDebuggingEnabled !== false || androidConfig.android?.allowMixedContent !== false) throw new Error('Android release WebView configuration mismatch');
    const apkAssets = verifyArchiveWeb(apk, 'assets/public/');
    const aabAssets = verifyArchiveWeb(aab, 'base/assets/public/');
    const nativeLibraries = command('unzip', ['-Z1', apk]).split('\n').filter(name => /^lib\/.*\.so$/.test(name));
    report.acceptance = { identityVerified: true, signatureVerified: true, bundleSignatureVerified: true, zipAlignment16KB: true, debuggable: false, assetsVerified: apkAssets, bundleAssetsVerified: aabAssets, nativeLibraries: nativeLibraries.length, nativeELFAlignment: nativeLibraries.length ? 'requires ELF inspection' : 'not applicable; no bundled native libraries' };
    if (nativeLibraries.length) throw new Error('Bundled native libraries require ELF alignment acceptance');
    report.apk = await artifact(apk); report.aab = await artifact(aab);
  }
  report.result = 'passed';
} catch (error) { report.result = 'failed'; report.error = error.message; process.exitCode = 1; }
report.finishedAt = new Date().toISOString();
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

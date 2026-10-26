import { access, copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { webManifest } from './release-evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.umask(0o077);
const artifacts = path.join(root, 'artifacts');
await access(artifacts);
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const release = JSON.parse(await readFile(path.join(root, 'store/release.json'), 'utf8'));
if (release.version !== version) throw new Error('Release version must match package.json');
const { bundleId, build } = release;
const app = path.join(artifacts, 'ios-device/Build/Products/Debug-iphoneos/App.app');
const apk = path.join(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', path.join(app, 'Info.plist')], { encoding: 'utf8' }));
if (info.CFBundleIdentifier !== bundleId || info.CFBundleShortVersionString !== version || info.CFBundleVersion !== String(build)) throw new Error('Wrong startup.io native identity or version');
execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'pipe' });
const deviceBuild = JSON.parse(await readFile(path.join(artifacts, 'ios-device-receipt.json'), 'utf8'));
if (deviceBuild.result !== 'passed' || deviceBuild.version !== version || deviceBuild.build !== build) throw new Error('Current signed iPhone build acceptance required');
const nativeReceipt = JSON.parse(await readFile(path.join(artifacts, 'ios-test-receipt.json'), 'utf8'));
if (nativeReceipt.result !== 'passed') throw new Error('Completed native UI acceptance required');
const simulator = JSON.parse(execFileSync('xcrun', ['xcresulttool', 'get', 'test-results', 'summary', '--path', path.join(root, nativeReceipt.resultBundle)], { encoding: 'utf8' }));
if (simulator.result !== 'Passed' || simulator.failedTests !== 0 || simulator.skippedTests || simulator.passedTests !== release.acceptance.nativeTests || nativeReceipt.version !== version || nativeReceipt.build !== build) throw new Error('Current native UI acceptance required');
const browser = JSON.parse(await readFile(path.join(root, 'test-results/.last-run.json'), 'utf8'));
if (browser.status !== 'passed' || browser.failedTests.length) throw new Error('Mobile browser acceptance required');
const browserReport = JSON.parse(await readFile(path.join(artifacts, 'browser-acceptance.json'), 'utf8'));
if (browserReport.stats.expected !== release.acceptance.browserTests || browserReport.stats.unexpected || browserReport.stats.skipped || browserReport.stats.flaky || browserReport.errors.length) throw new Error('All current mobile browser scenarios must pass');
const mechanics = JSON.parse(await readFile(path.join(artifacts, 'mechanics-acceptance.json'), 'utf8'));
if (!mechanics.success || mechanics.numPassedTests !== release.acceptance.mechanicsTests || mechanics.numFailedTests || mechanics.numPendingTests) throw new Error('All current mechanics tests must pass');

const delivery = path.join(artifacts, `delivery-${version}`);
const packageRoot = await mkdtemp(path.join(artifacts, '.ipa-package-'));
const payload = path.join(packageRoot, 'Payload');
await mkdir(delivery, { recursive: true });
const ipaPath = path.join(delivery, `startup-io-${version}-ios-development.ipa`);
try {
  await mkdir(payload, { recursive: true });
  await cp(app, path.join(payload, 'App.app'), { recursive: true });
  execFileSync('ditto', ['-c', '-k', '--keepParent', payload, ipaPath], { stdio: 'pipe' });
} finally { await rm(packageRoot, { recursive: true, force: true }); }
const apkPath = path.join(delivery, `startup-io-${version}-android-debug.apk`);
await copyFile(apk, apkPath);
const sdk = process.env.ANDROID_HOME ?? '/Users/jamilturkan/Library/Android/sdk';
const badging = execFileSync(path.join(sdk, 'build-tools/36.0.0/aapt'), ['dump', 'badging', apkPath], { encoding: 'utf8' });
if (!badging.includes(`name='${bundleId}' versionCode='${build}' versionName='${version}'`) || !badging.includes('application-debuggable')) throw new Error('Current Android debug package identity required');
const javaHome = process.env.JAVA_HOME ?? '/var/folders/63/23_9ghpd0zl_sty24xn_r_t80000gn/T/opencode/jdk-21.0.12.1+1/Contents/Home';
execFileSync(path.join(sdk, 'build-tools/36.0.0/apksigner'), ['verify', apkPath], { stdio: 'pipe', env: { ...process.env, JAVA_HOME: javaHome } });

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const webFiles = [];
async function manifest(folder, prefix = '') {
  for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) await manifest(path.join(folder, entry.name), relative);
    else { const bytes = await readFile(path.join(folder, entry.name)); webFiles.push({ file: relative, bytes: bytes.length, sha256: sha256(bytes) }); }
  }
}
await manifest(path.join(root, 'dist'));
const web = await webManifest();
if (nativeReceipt.webManifestSha256 !== web.sha256) throw new Error('Native gameplay acceptance must be bound to the current web assets');
for (const file of webFiles) {
  for (const target of [path.join(app, 'public'), path.join(artifacts, 'ios-simulator/Build/Products/Debug-iphonesimulator/App.app/public'), path.join(root, 'android/app/src/main/assets/public')]) {
    if (sha256(await readFile(path.join(target, file.file))) !== file.sha256) throw new Error(`Native asset mismatch: ${file.file}`);
  }
  for (const [archive, prefix] of [[ipaPath, 'Payload/App.app/public/'], [apkPath, 'assets/public/']]) {
    const bytes = execFileSync('unzip', ['-p', archive, prefix + file.file], { maxBuffer: 10 * 1024 * 1024 });
    if (sha256(bytes) !== file.sha256) throw new Error(`Packaged asset mismatch: ${file.file}`);
  }
}
const packaged = async filename => { const bytes = await readFile(filename); return { file: path.relative(root, filename), bytes: bytes.length, sha256: sha256(bytes) }; };
let physicalAcceptance = { version, installed: false, status: 'pending device installation' };
try {
  const physical = JSON.parse(await readFile(path.join(artifacts, `iphone-j-${version}-direct-build.json`), 'utf8'));
  const hashes = new Map((physical.assets ?? []).map(item => [item.file, item.sha256]));
  if (physical.version === version && physical.build === build && physical.bundleIdentifier === bundleId && physical.installed && physical.runningConfirmed && physical.assetsVerified === webFiles.length && webFiles.every(file => hashes.get(file.file) === file.sha256)) {
    physicalAcceptance = { version, installed: true, launched: true, runningConfirmed: true, device: physical.device, receipt: `artifacts/iphone-j-${version}-direct-build.json`, physicalGameplayTests: physical.physicalGameplayTests };
  }
} catch { /* Device installation is reported separately from signed package acceptance. */ }
const receipt = {
  at: new Date().toISOString(), name: 'startup.io', version, build, bundleId, mode: 'unlimited', engine: release.engine, projection: 'isometric 2.5D',
  ios: { ...await packaged(ipaPath), signing: 'Apple Development', signatureVerified: true, nativeTests: simulator.passedTests, simulator: 'iPhone 17 Pro / iOS 26.2', physicalAcceptance },
  android: { ...await packaged(apkPath), signing: 'Android debug', signatureVerified: true, minSdk: 24, targetSdk: 36, physicalAcceptance: 'not run' },
  browserTests: browserReport.stats.expected, mechanicsTests: mechanics.numPassedTests, nativeAssetParity: true, assets: webFiles.length,
  nativeResultBundle: nativeReceipt.resultBundle, webFiles,
  webManifestSha256: web.sha256,
};
await writeFile(path.join(delivery, 'delivery-manifest.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ version, bundleId, ios: receipt.ios, android: receipt.android, assets: receipt.assets, nativeAssetParity: true }, null, 2));

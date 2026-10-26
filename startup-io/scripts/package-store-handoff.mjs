import { execFileSync } from 'node:child_process';
import { access, chmod, copyFile, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { sha256, webManifest, verifyWeb } from './release-evidence.mjs';

process.umask(0o077);
const root = fileURLToPath(new URL('../', import.meta.url));
const json = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const release = await json('store/release.json');
const allowSigningBlocker = process.argv.includes('--with-signing-blocker');
const store = `artifacts/store-${release.version}`;
const finalDestination = path.join(root, `artifacts/handoff-${release.version}`);
await access(path.join(root, 'artifacts'));
const handoffStaging = await mkdtemp(path.join(root, 'artifacts/.handoff-'));
const destination = path.join(handoffStaging, `handoff-${release.version}`);
await mkdir(destination, { recursive: true });
const web = await webManifest();
const checkRelease = value => {
  if (value.version !== release.version || value.build !== release.build) throw new Error('Handoff evidence belongs to a different release');
};
const ios = await json(`${store}/ios-store-build.json`);
const android = await json(`${store}/android-store-build.json`);
const development = await json(`artifacts/delivery-${release.version}/delivery-manifest.json`);
const native = await json('artifacts/ios-test-receipt.json');
for (const receipt of [ios, android, development, native]) checkRelease(receipt);
const iosDistributionPassed = ios.result === 'passed' && ios.acceptance?.distributionProfileVerified === true;
if (!iosDistributionPassed) {
  const exportLog = await readFile(path.join(root, store, 'ios-app-store-export.log'), 'utf8');
  if (!allowSigningBlocker || !ios.archiveAcceptance?.signatureVerified || !/No Accounts|No signing certificate/.test(exportLog)) throw new Error('Current iOS distribution acceptance or explicit operator-accepted signing blocker is required');
}
if (android.result !== 'passed' || !development.nativeAssetParity || native.result !== 'passed') throw new Error('Verified native packages and completed iOS acceptance are required');
if ([development, native].some(receipt => receipt.webManifestSha256 !== web.sha256)) throw new Error('Gameplay/package acceptance must match the current web assets');
const nativeSummary = JSON.parse(execFileSync('xcrun', ['xcresulttool', 'get', 'test-results', 'summary', '--path', path.join(root, native.resultBundle)], { encoding: 'utf8' }));
if (nativeSummary.result !== 'Passed' || nativeSummary.passedTests !== release.acceptance.nativeTests || nativeSummary.failedTests || nativeSummary.skippedTests) throw new Error('Completed native result bundle must pass');
const mechanics = await json('artifacts/mechanics-acceptance.json');
const browser = await json('artifacts/browser-acceptance.json');
if (!mechanics.success || mechanics.numPassedTests !== release.acceptance.mechanicsTests || mechanics.numFailedTests || mechanics.numPendingTests) throw new Error('Current mechanics acceptance is required');
if (browser.stats.expected !== release.acceptance.browserTests || browser.stats.unexpected || browser.stats.skipped || browser.stats.flaky || browser.errors.length) throw new Error('Current browser acceptance is required');
const captures = await json(`${store}/screenshots/screenshots.json`);
checkRelease(captures);
if (captures.result !== 'passed' || captures.images.length !== 10 || captures.webManifestSha256 !== web.sha256) throw new Error('Ten current native iPhone/iPad screenshots are required');
const publicPages = await json('artifacts/store-public-urls.json');
if (!publicPages.verified || publicPages.version !== release.version || publicPages.pages.length !== 7) throw new Error('Current public support/legal page acceptance is required');
const listing = await json('store/metadata.json');
checkRelease(listing);
const fields = [[listing.appStore.name, 30], [listing.appStore.subtitle, 30], [listing.appStore.keywords, 100], [listing.appStore.promotionalText, 170], [listing.appStore.description, 4000], [listing.playStore.name, 30], [listing.playStore.shortDescription, 80]];
if (fields.some(([value, maximum]) => [...value].length > maximum)) throw new Error('Store listing field exceeds its limit');
for (const [key, url] of Object.entries(listing.urls)) if (publicPages.urls[key] !== url) throw new Error('Listing public URL mismatch');

const packages = [];
for (const item of [...(iosDistributionPassed ? [ios.ipa] : []), android.aab, android.apk, development.ios, development.android]) {
  const bytes = await readFile(path.join(root, item.file));
  if (sha256(bytes) !== item.sha256 || bytes.length !== item.bytes) throw new Error(`Delivered package hash mismatch: ${item.file}`);
  const prefix = item.file.endsWith('.aab') ? 'base/assets/public/' : item.file.endsWith('.apk') ? 'assets/public/' : 'Payload/App.app/public/';
  for (const file of web.files) {
    const bundled = execFileSync('unzip', ['-p', path.join(root, item.file), prefix + file.file], { maxBuffer: 16 * 1024 * 1024 });
    if (sha256(bundled) !== file.sha256) throw new Error(`Handoff package has stale assets: ${item.file} / ${file.file}`);
  }
  const folder = path.join(destination, 'packages'); await mkdir(folder, { recursive: true });
  await copyFile(path.join(root, item.file), path.join(folder, path.basename(item.file)));
  packages.push({ file: `packages/${path.basename(item.file)}`, bytes: item.bytes, sha256: item.sha256 });
}
let iosArchive;
if (!iosDistributionPassed) {
  const archivedApp = path.join(root, ios.archive, 'Products/Applications/App.app');
  const identity = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', path.join(archivedApp, 'Info.plist')], { encoding: 'utf8' }));
  if (identity.CFBundleIdentifier !== release.bundleId || identity.CFBundleShortVersionString !== release.version || identity.CFBundleVersion !== String(release.build)) throw new Error('Current iOS archive identity is required');
  execFileSync('codesign', ['--verify', '--deep', '--strict', archivedApp], { stdio: 'pipe' });
  await verifyWeb(path.join(archivedApp, 'public'), web);
  await mkdir(path.join(destination, 'archive'), { recursive: true });
  const filename = `archive/startup-io-${release.version}-ios.xcarchive.zip`;
  execFileSync('ditto', ['-c', '-k', '--norsrc', '--noextattr', '--noqtn', '--keepParent', path.join(root, ios.archive), path.join(destination, filename)], { stdio: 'pipe' });
  iosArchive = { file: filename, sha256: sha256(await readFile(path.join(destination, filename))), signatureVerified: true, assetsVerified: web.files.length, signing: 'Apple Development archive; App Store distribution export pending' };
}
for (const image of captures.images) {
  const bytes = await readFile(path.join(root, image.file));
  const info = await sharp(bytes).metadata();
  if (sha256(bytes) !== image.sha256 || info.width !== image.width || info.height !== image.height || info.hasAlpha) throw new Error('Native screenshot verification failed');
  await mkdir(path.join(destination, 'screenshots/ios'), { recursive: true });
  await copyFile(path.join(root, image.file), path.join(destination, 'screenshots/ios', path.basename(image.file)));
}
let androidRuntime = { result: 'not run', checks: [], images: [] };
try { androidRuntime = await json(`${store}/android-acceptance/acceptance.json`); checkRelease(androidRuntime); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const androidNativePassed = androidRuntime.result === 'passed' && androidRuntime.apkSha256 === android.apk.sha256 && androidRuntime.images.length === 5;
if (androidNativePassed) {
  await mkdir(path.join(destination, 'screenshots/android'), { recursive: true });
  for (const image of androidRuntime.images.filter(item => !item.file.endsWith('failure.png'))) {
    const bytes = await readFile(path.join(root, image.file));
    if (sha256(bytes) !== image.sha256) throw new Error('Android native screenshot hash mismatch');
    await writeFile(path.join(destination, 'screenshots/android', path.basename(image.file)), await sharp(bytes).flatten({ background: '#080f1c' }).removeAlpha().png().toBuffer());
  }
}
await mkdir(path.join(destination, 'listing/assets'), { recursive: true });
const icon = await sharp(path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')).flatten({ background: '#080f1c' }).removeAlpha().png().toBuffer();
await writeFile(path.join(destination, 'listing/assets/app-store-icon-1024.png'), icon);
await writeFile(path.join(destination, 'listing/assets/play-store-icon-512.png'), await sharp(icon).resize(512, 512).png().toBuffer());
const graphic = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#203d42"/><stop offset="1" stop-color="#080f1c"/></linearGradient></defs><rect width="1024" height="500" fill="url(#bg)"/><circle cx="182" cy="250" r="165" fill="none" stroke="#b9ff6b" opacity=".12" stroke-width="3"/><text x="380" y="196" font-family="Space Grotesk,Arial,sans-serif" font-weight="700" font-size="76" fill="#eef6fc">startup<tspan fill="#c4e991">.io</tspan></text><text x="386" y="255" font-family="Manrope,Arial,sans-serif" font-size="25" fill="#aac2d2">Build in an endless city.</text><text x="386" y="318" font-family="Manrope,Arial,sans-serif" font-size="15" letter-spacing="3" fill="#8bada8">OFFLINE · UNLIMITED · 48 BOT RIVALS</text></svg>`);
const feature = await sharp(graphic).composite([{ input: await sharp(icon).resize(246, 246).png().toBuffer(), left: 59, top: 127 }]).removeAlpha().png().toBuffer();
await writeFile(path.join(destination, 'listing/assets/play-feature-graphic-1024x500.png'), feature);

const sourceFiles = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'startup-io'], { cwd: path.dirname(root.replace(/\/$/, '')), encoding: 'utf8' }).split('\0').filter(Boolean).map(file => file.slice('startup-io/'.length)).sort();
if (!sourceFiles.includes('package.json') || sourceFiles.some(file => /(?:^|\/)(?:artifacts|node_modules|dist|test-results|\.env[^/]*|keystore\.properties|ExportOptions\.private\.plist)(?:\/|$)|\.(?:p12|jks|keystore|mobileprovision)$/.test(file))) throw new Error('Source handoff must respect .gitignore and exclude private/build inputs');
const staging = await mkdtemp(path.join(root, 'artifacts/.source-handoff-'));
const sourceName = `startup-io-${release.version}-source.zip`;
try {
  const source = path.join(staging, 'startup-io'); await mkdir(source);
  for (const file of sourceFiles) {
    const info = await lstat(path.join(root, file));
    if (!info.isFile()) throw new Error(`Unexpected non-file in source handoff: ${file}`);
    await mkdir(path.dirname(path.join(source, file)), { recursive: true });
    await copyFile(path.join(root, file), path.join(source, file));
    await chmod(path.join(source, file), info.mode & 0o777);
  }
  execFileSync('ditto', ['-c', '-k', '--norsrc', '--noextattr', '--noqtn', '--keepParent', source, path.join(destination, sourceName)], { stdio: 'pipe' });
} finally { await rm(staging, { recursive: true, force: true }); }
await mkdir(path.join(destination, 'listing'), { recursive: true });
for (const file of ['store/metadata.json', 'store/REVIEW.md', 'store/release.json', 'docs/STORE_RELEASE_1.5.0.md', 'docs/TESTING.md']) await copyFile(path.join(root, file), path.join(destination, 'listing', path.basename(file)));
await mkdir(path.join(destination, 'acceptance'), { recursive: true });
for (const file of [`${store}/ios-store-build.json`, `${store}/android-store-build.json`, `${store}/screenshots/screenshots.json`, `${store}/android-acceptance/acceptance.json`, `artifacts/delivery-${release.version}/delivery-manifest.json`, 'artifacts/ios-test-receipt.json', 'artifacts/ios-device-receipt.json', 'artifacts/store-public-urls.json']) {
  await copyFile(path.join(root, file), path.join(destination, 'acceptance', path.basename(file)));
}
await writeFile(path.join(destination, 'acceptance/ios-native-summary.json'), JSON.stringify(nativeSummary, null, 2) + '\n');
await writeFile(path.join(destination, 'acceptance/test-summary.json'), JSON.stringify({ version: release.version, build: release.build, webManifestSha256: web.sha256, mechanics: { passed: mechanics.numPassedTests, failed: mechanics.numFailedTests, startTime: mechanics.startTime }, browser: browser.stats }, null, 2) + '\n');

const physical = await json(`artifacts/iphone-j-${release.version}-direct-build.json`).catch(error => { if (error.code !== 'ENOENT') throw error; return undefined; });
const report = {
  at: new Date().toISOString(), version: release.version, build: release.build, bundleId: release.bundleId,
  result: !iosDistributionPassed ? 'local handoff verified; App Store distribution export blocked by signing' : androidNativePassed ? 'local handoff verified' : 'packages verified; Android native gameplay/screenshot acceptance blocked',
  uploaded: false, submitted: false, published: false, webManifestSha256: web.sha256, assets: web.files,
  packages, iosArchive, source: { file: sourceName, files: sourceFiles.length, sha256: sha256(await readFile(path.join(destination, sourceName))) },
  acceptance: {
    mechanics: { result: 'passed', tests: mechanics.numPassedTests }, browser: { result: 'passed', tests: browser.stats.expected },
    iosNative: { result: 'passed', tests: release.acceptance.nativeTests, resultBundle: native.resultBundle },
    iosDistribution: iosDistributionPassed ? ios.acceptance : { result: 'blocked', reason: 'Xcode account and Apple Distribution certificate unavailable', operatorAccepted: true, archiveVerified: true }, androidPackage: android.acceptance,
    physicalIOS: { ...development.ios.physicalAcceptance, device: physical?.model, gameplay: development.ios.physicalAcceptance.physicalGameplayTests ?? 'not run' },
    physicalAndroid: 'not run', iosScreenshots: { result: 'passed', images: 10, language: captures.language },
    androidNative: { result: androidNativePassed ? 'passed' : androidRuntime.result, device: androidRuntime.device, checks: androidRuntime.checks, images: androidRuntime.images.length, fullscreenWebViewVerified: androidRuntime.fullscreenWebViewVerified, error: androidRuntime.error, failureKind: androidRuntime.failureKind },
    publicPages: { verified: true, pages: 7, urls: publicPages.urls, receipt: 'artifacts/store-public-urls.json' },
    listingAssets: ['app-store-icon-1024.png', 'play-store-icon-512.png', 'play-feature-graphic-1024x500.png'],
  },
  remaining: [...(iosDistributionPassed ? [] : ['Restore Xcode signing account/Apple Distribution certificate and export the current App Store IPA']), ...(androidNativePassed ? [] : ['Android native gameplay and store screenshots on a responsive emulator/device']), ...(development.ios.physicalAcceptance.installed ? [] : ['Unlock iPhone J for final development build install/launch']), 'Physical gameplay user acceptance', 'Store console records and age-rating questionnaires', 'App Store Connect / Play Console upload, submission, review and publication'],
};
await writeFile(path.join(root, store, 'store-readiness.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(path.join(destination, 'handoff-manifest.json'), JSON.stringify(report, null, 2) + '\n');
const readme = `# startup.io ${release.version} / build ${release.build}\n\nStatus: ${report.result}.\n\n${iosDistributionPassed ? `- App Store: packages/startup-io-${release.version}-app-store.ipa (Apple Distribution).` : `- Current Xcode archive: ${iosArchive.file}. Restore the existing Xcode signing account/certificate, then run npm run store:ios -- --export-only. App Store IPA export is pending.`}\n- Google Play: packages/startup-io-${release.version}-play-store.aab.\n- Direct Android testing: packages/startup-io-${release.version}-android-release.apk.\n- Development IPA and debug APK are separately named test packages.\n- Source archive respects .gitignore; run npm ci, then npm run native:sync. Native signing uses your existing private operator configuration.\n- English/Azerbaijani listing copy and release/testing notes are in listing/.\n- Current native captures are in screenshots/ios/ and screenshots/android/.\n- Exact SHA-256 hashes and outstanding acceptance are in handoff-manifest.json.\n\nUpload/submission/publication are pending in the respective store accounts.\n`;
await writeFile(path.join(destination, 'README.md'), readme);
const allFiles = [];
async function collect(folder, prefix = '') {
  for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) await collect(path.join(folder, entry.name), relative);
    else allFiles.push({ file: relative, sha256: sha256(await readFile(path.join(folder, entry.name))) });
  }
}
await collect(destination);
await writeFile(path.join(destination, 'SHA256SUMS.txt'), allFiles.filter(item => item.file !== 'SHA256SUMS.txt').map(item => `${item.sha256}  ${item.file}`).join('\n') + '\n');
try {
  await access(finalDestination);
  await rename(finalDestination, path.join(root, 'artifacts', `handoff-history-${release.version}-${Date.now()}`));
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await rename(destination, finalDestination);
await rm(handoffStaging, { recursive: true, force: true });
const archive = path.join(root, 'artifacts', `startup-io-${release.version}-handoff.zip`);
execFileSync('ditto', ['-c', '-k', '--norsrc', '--noextattr', '--noqtn', '--keepParent', finalDestination, archive], { stdio: 'pipe' });
console.log(JSON.stringify({ result: report.result, directory: path.relative(root, finalDestination), zip: path.relative(root, archive), sha256: sha256(await readFile(archive)), packages: packages.length, sourceFiles: sourceFiles.length, remaining: report.remaining }, null, 2));

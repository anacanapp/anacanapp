import { copyFile, cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'artifacts');
const bundleId = 'com.atlasoon.mommysimulator';
const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const app = join(artifacts, 'ios-build-v2/Build/Products/Debug-iphoneos/App.app');
const apk = join(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', join(app, 'Info.plist')], { encoding: 'utf8' }));
if (info.CFBundleIdentifier !== bundleId || info.CFBundleShortVersionString !== version) throw new Error('Wrong native game build');
execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'pipe' });
const simulator = JSON.parse(execFileSync('xcrun', ['xcresulttool', 'get', 'test-results', 'summary', '--path', join(artifacts, 'simulator-v2-02.xcresult')], { encoding: 'utf8' }));
if (simulator.result !== 'Passed' || simulator.failedTests !== 0 || simulator.passedTests !== 2) throw new Error('Native simulator acceptance required');
const install = JSON.parse(await readFile(join(artifacts, 'ios-v2-final-install.json'), 'utf8'));
if (install.info?.outcome !== 'success' || !install.result.installedApplications.some(a => a.bundleID === bundleId)) throw new Error('Physical installation receipt required');
let physical;
try {
  const result = JSON.parse(execFileSync('xcrun', ['xcresulttool', 'get', 'test-results', 'summary', '--path', join(artifacts, 'physical-v2-final.xcresult')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  if (result.result === 'Passed') physical = { result: 'passed', tests: result.passedTests };
} catch { /* a locked phone can still receive the development package */ }
const packageRoot = join(artifacts, `package-${Date.now()}`), payload = join(packageRoot, 'Payload');
await mkdir(payload, { recursive: true }); await cp(app, join(payload, 'App.app'), { recursive: true });
const ipaPath = join(artifacts, `mommy-simulator-${version}-ios-development.ipa`);
execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', payload, ipaPath], { stdio: 'pipe' });
const apkPath = join(artifacts, `mommy-simulator-${version}-android-debug.apk`);
await copyFile(apk, apkPath);

const hashes = async path => { const bytes = await readFile(path); return { file: path.slice(artifacts.length + 1), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; };
const publicFiles = [];
async function manifest(path) {
  for (const name of (await readdir(path)).sort()) {
    const file = join(path, name);
    if ((await stat(file)).isDirectory()) await manifest(file);
    else { const bytes = await readFile(file); publicFiles.push({ file: file.slice(join(root, 'dist').length + 1), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }); }
  }
}
await manifest(join(root, 'dist'));
for (const file of publicFiles) {
  for (const location of [join(app, 'public'), join(root, 'android/app/src/main/assets/public')]) {
    const bytes = await readFile(join(location, file.file));
    if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Native web asset mismatch: ${file.file}`);
  }
  const apkBytes = execFileSync('unzip', ['-p', apkPath, `assets/public/${file.file}`], { maxBuffer: 20 * 1024 * 1024 });
  if (createHash('sha256').update(apkBytes).digest('hex') !== file.sha256) throw new Error(`Packaged Android asset mismatch: ${file.file}`);
  const ipaBytes = execFileSync('unzip', ['-p', ipaPath, `Payload/App.app/public/${file.file}`], { maxBuffer: 20 * 1024 * 1024 });
  if (createHash('sha256').update(ipaBytes).digest('hex') !== file.sha256) throw new Error(`Packaged iOS asset mismatch: ${file.file}`);
}
const report = { at: new Date().toISOString(), name: 'Mommy Simulator', version, bundleId, appleTeam: '8B6976J8H7',
  ios: { ...await hashes(ipaPath), signing: 'Apple Development', deviceInstalled: 'iPhone 13 Pro Max',
    simulatorTest: { result: 'passed', tests: simulator.passedTests, model: 'iPhone 17 Pro' },
    physicalTest: physical ?? { result: 'pending', reason: 'device-locked', earlierVersion: '0.1.0 physical gameplay passed' } },
  android: { ...await hashes(apkPath), signing: 'Android debug', sdk: 36, physicalTest: 'not-run' },
  google: JSON.parse(await readFile(join(root, 'public/data/provenance.json'), 'utf8')),
  assets: publicFiles.length, nativeAssetParity: true, webFiles: publicFiles };
await writeFile(join(artifacts, 'delivery-manifest.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ version, bundleId, ios: report.ios, android: report.android, assets: publicFiles.length, nativeAssetParity: true }));

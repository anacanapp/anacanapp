import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'artifacts');
const app = join(artifacts, 'ios-build2/Build/Products/Debug-iphoneos/MetroSimulator.app');
const json = async file => JSON.parse(await readFile(join(artifacts, file), 'utf8'));
const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', join(app, 'Info.plist')], { encoding: 'utf8' }));
if (info.CFBundleIdentifier !== 'com.atlasoon.metrosimulator' || info.CFBundleShortVersionString !== '1.1.0' || String(info.CFBundleVersion) !== '2') throw new Error('METRO identity/version mismatch');
execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'pipe' });
const entitlement = execFileSync('codesign', ['--display', '--entitlements', ':-', app], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (!entitlement.includes('8B6976J8H7') || !entitlement.includes('com.atlasoon.metrosimulator')) throw new Error('METRO signature/team mismatch');
const install = await json('ios-v2-final-install.json');
const normal = await json('ios-v2-normal-launch.json');
if (install.info.outcome !== 'success' || normal.info.outcome !== 'success') throw new Error('Actual install and normal launch are required');
const installation = install.result.installedApplications.find(entry => entry.bundleID === info.CFBundleIdentifier);
if (!installation || !normal.result.process.executable.startsWith(installation.installationURL)) throw new Error('Normal launch is not from the installed package');
const runtime = await json('ios-v2-runtime.json');
if (!runtime.main_scene_ready || runtime.version !== '1.1.0' || runtime.driver !== 'metal' || !runtime.world.ready) throw new Error('Physical Metal scene readiness missing');
const physical = await json('physical-device-v2/acceptance.json');
if (!physical.physical_device || physical.version !== '1.1.0' || physical.checks.length < 309 || physical.failures.length) throw new Error('Physical 3D acceptance did not pass');
const build = JSON.parse(execFileSync('xcrun', ['xcresulttool', 'get', 'build-results', '--path', join(artifacts, 'ios-build2-delivery.xcresult')], { encoding: 'utf8' }));
if (build.status !== 'succeeded' || build.errorCount !== 0) throw new Error('iOS build did not pass');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pck = await readFile(join(artifacts, 'ios-v2/MetroSimulator.pck'));
if (hash(pck) !== hash(await readFile(join(app, 'MetroSimulator.pck')))) throw new Error('Signed native game PCK parity failed');
const packageInfo = await json('ios-v2-package.json');
const report = { at: new Date().toISOString(), bundleId: info.CFBundleIdentifier, version: info.CFBundleShortVersionString, build: info.CFBundleVersion,
  device: 'iPhone 13 Pro Max', os: 'iOS 26.6.2', installed: true, normalLaunch: true, nativeRenderer: 'Godot 4.7.2 / Metal',
  nativeBuild: { errors: build.errorCount, warnings: build.warningCount, signatureVerified: true },
  physicalChecks: physical.checks.length, physicalFailures: physical.failures, performance: physical.performance,
  pck: { bytes: pck.length, sha256: hash(pck), bundledParity: true }, package: packageInfo };
await writeFile(join(artifacts, 'DELIVERY.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ device: report.device, version: report.version, installed: true, normalLaunch: true, physicalChecks: report.physicalChecks, failures: 0, renderer: report.nativeRenderer }));

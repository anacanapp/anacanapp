import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'artifacts');
const presets = await readFile(join(root, 'godot/export_presets.cfg'), 'utf8');
const buildNumber = process.argv[2] ?? presets.match(/application\/version="(\d+)"/)[1];
if (!/^\d+$/.test(buildNumber)) throw new Error('Provide a numeric native candidate build');
const candidate = JSON.parse(await readFile(join(artifacts, `native-world-ios-build${buildNumber}-source/candidate.json`), 'utf8'));
const app = join(root, candidate.app);
const json = async name => JSON.parse(await readFile(join(artifacts, name), 'utf8'));
const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', join(app, 'Info.plist')], { encoding: 'utf8' }));
if (info.CFBundleIdentifier !== 'com.atlasoon.mommysimulator' || info.CFBundleShortVersionString !== candidate.version || String(info.CFBundleVersion) !== buildNumber) throw new Error('Native 3D identity mismatch');
execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'pipe' });
const entitlements = execFileSync('codesign', ['--display', '--entitlements', ':-', app], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (!entitlements.includes('8B6976J8H7')) throw new Error('Unexpected game signing team');
const build = JSON.parse(execFileSync('xcrun', ['xcresulttool', 'get', 'build-results', '--path', join(artifacts, `native-world-ios-build${buildNumber}-final.xcresult`)], { encoding: 'utf8' }));
if (build.status !== 'succeeded' || build.errorCount !== 0) throw new Error('Native build not accepted');
const install = await json(`native-world-ios-build${buildNumber}-install-final.json`);
const launch = await json(`native-world-ios-build${buildNumber}-normal-launch.json`);
if (install.info.outcome !== 'success' || launch.info.outcome !== 'success') throw new Error('Actual installation and normal launch required');
const launchedProcess = launch.result.process, installation = install.result.installedApplications.find(item => item.bundleID === info.CFBundleIdentifier);
if (!installation || !launchedProcess.executable.startsWith(installation.installationURL)) throw new Error('Launch belongs to another build');
const physical = await json(`native-world-physical-build${buildNumber}/native-world-acceptance.json`);
const local = await json('native-world-acceptance.json');
if (!physical.physicalDevice || physical.version !== candidate.version || physical.checks !== local.checks || physical.failures.length) throw new Error('Physical native acceptance did not pass');
const pck = await readFile(join(root, candidate.source, 'Mommy3D.pck'));
const bundled = await readFile(join(app, 'Mommy3D.pck'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
if (sha256(pck) !== sha256(bundled)) throw new Error('Native packed world mismatch');
const executable = await readFile(join(app, info.CFBundleExecutable));
const report = { at: new Date().toISOString(), version: info.CFBundleShortVersionString, build: String(info.CFBundleVersion), bundleId: info.CFBundleIdentifier,
  nativeEngine: 'Godot 4.7.2 / Metal mobile renderer', nativeBuild: { errors: build.errorCount, warnings: build.warningCount, signingVerified: true },
  device: { model: 'iPhone 13 Pro Max', installed: true, normalLaunch: true },
  physicalAcceptance: physical, pck: { bytes: pck.length, sha256: sha256(pck), bundledParity: true }, executableSHA256: sha256(executable) };
await writeFile(join(artifacts, `native-world-ios-build${buildNumber}-device-acceptance.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ version: report.version, build: report.build, device: report.device, checks: physical.checks, failures: physical.failures.length, bundledParity: true }));

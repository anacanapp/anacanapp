import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { basename, join, relative, resolve, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'artifacts');
const directory = resolve(root, process.argv[2] ?? '');
if (!directory.startsWith(artifacts + sep)) throw new Error('Provide this game’s isolated iOS build directory inside artifacts/');
const name = basename(directory), receipt = suffix => join(artifacts, `${name}-${suffix}.json`);
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const app = join(directory, 'Build/Products/Debug-iphoneos/App.app');
const bundleId = 'com.atlasoon.mommysimulator', team = '8B6976J8H7';
const version = (await json(join(root, 'package.json'))).version;
const info = JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', join(app, 'Info.plist')], { encoding: 'utf8' }));
if (info.CFBundleIdentifier !== bundleId || info.CFBundleShortVersionString !== version) throw new Error('Unexpected game identity or version');
execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'pipe' });
// Check signed entitlements without printing signing identities.
const signingTeam = execFileSync('codesign', ['--display', '--entitlements', ':-', app], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
if (!signingTeam.includes(team)) throw new Error('Unexpected Apple team');

const build = JSON.parse(execFileSync('xcrun', ['xcresulttool', 'get', 'build-results', '--path', `${directory}.xcresult`], { encoding: 'utf8' }));
if (build.status !== 'succeeded' || build.errorCount !== 0) throw new Error('Successful native build required');
const install = await json(receipt('install')), launch = await json(receipt('launch'));
const running = await json(receipt('running')), installed = await json(receipt('installed-app'));
const browser = await json(join(artifacts, 'luzern-life-browser-acceptance.json'));
for (const evidence of [install, launch, running, installed]) if (evidence.info?.outcome !== 'success') throw new Error('Successful device receipts required');
const device = install.result.deviceIdentifier;
if ([launch, running, installed].some(evidence => evidence.result.deviceIdentifier !== device)) throw new Error('Device receipt mismatch');
const installation = install.result.installedApplications.find(item => item.bundleID === bundleId);
const metadata = installed.result.apps.find(item => item.bundleIdentifier === bundleId);
if (!installation || metadata?.bundleVersion !== String(info.CFBundleVersion) || metadata.version !== version) throw new Error('Installed game version mismatch');
const launchedProcess = launch.result.process;
if (!launch.result.launchOptions.activatedWhenStarted || !launchedProcess.executable.startsWith(installation.installationURL)) throw new Error('The installed game must launch in the foreground');
if (!running.result.runningProcesses.some(item => item.processIdentifier === launchedProcess.processIdentifier && item.executable === launchedProcess.executable)) throw new Error('Launched game is not running');

const files = [], dist = join(root, 'dist');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function verify(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '.DS_Store') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await verify(path);
    else {
      const file = relative(dist, path), bytes = await readFile(path), hash = sha256(bytes);
      const bundled = await readFile(join(app, 'public', file));
      if (sha256(bundled) !== hash) throw new Error(`Bundled web asset mismatch: ${file}`);
      files.push({ file, bytes: bytes.length, sha256: hash });
    }
  }
}
await verify(dist);
const report = {
  at: new Date().toISOString(), version, build: String(info.CFBundleVersion), bundleId, appleTeam: team,
  device: { model: build.destination.modelName, osVersion: build.destination.osVersion, installed: true, launched: true, running: true },
  nativeBuild: { result: build.status, errors: build.errorCount, warnings: build.warningCount, signingVerified: true },
  webFiles: files, assets: files.length, nativeAssetParity: true,
  gameplayAcceptance: { browser: browser.stats, physical: 'not-run' },
};
await writeFile(receipt('device-acceptance'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ version, build: report.build, bundleId, device: report.device, assets: files.length, nativeAssetParity: true }));

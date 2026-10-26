import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const release = JSON.parse(await readFile(path.join(root, 'store/release.json'), 'utf8'));
if (release.version !== version) throw new Error('Release version must match package.json');
const { build, bundleId: id } = release;
const prefix = `iphone-j-${version}`;
const read = async name => JSON.parse(await readFile(path.join(root, 'artifacts', `${prefix}-${name}.json`), 'utf8'));
const install = await read('install'); const launch = await read('launch'); const apps = await read('app'); const running = await read('running');
const installed = install.result.installedApplications.find(app => app.bundleID === id);
const app = apps.result.apps.find(app => app.bundleIdentifier === id);
if ([install, launch, apps, running].some(receipt => receipt.info.outcome !== 'success')) throw new Error('Device receipts must all succeed');
if (!installed || app?.version !== version || app?.bundleVersion !== String(build)) throw new Error('Wrong installed app version');
const process = launch.result.process;
if (!launch.result.launchOptions.activatedWhenStarted || !running.result.runningProcesses.some(entry => entry.processIdentifier === process.processIdentifier && entry.executable === process.executable)) throw new Error('Installed game must be launched and remain running');
if (!process.executable.startsWith(installed.installationURL)) throw new Error('Launch must belong to the newly installed app');
const appPath = path.join(root, 'artifacts/ios-device/Build/Products/Debug-iphoneos/App.app');
execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'pipe' });
const assets = [];
async function verify(folder, prefix = '') {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) await verify(path.join(folder, entry.name), relative);
    else {
      const hash = bytes => createHash('sha256').update(bytes).digest('hex');
      const expected = hash(await readFile(path.join(folder, entry.name)));
      if (hash(await readFile(path.join(appPath, 'public', relative))) !== expected) throw new Error(`Embedded asset differs: ${relative}`);
      assets.push({ file: relative, sha256: expected });
    }
  }
}
await verify(path.join(root, 'dist'));
const receipt = {
  at: new Date().toISOString(), device: 'iPhone J', model: 'iPhone 13 Pro Max', version, build,
  bundleIdentifier: id, mode: 'unlimited', engine: release.engine, signatureVerified: true, installed: true,
  launchedInForeground: true, runningConfirmed: true, assetsVerified: assets.length,
  physicalGameplayTests: 'not run; install/foreground launch and running process verified separately',
  installReceipt: `artifacts/${prefix}-install.json`, launchReceipt: `artifacts/${prefix}-launch.json`,
  installedVersionReceipt: `artifacts/${prefix}-app.json`, runningReceipt: `artifacts/${prefix}-running.json`,
  assets,
};
await writeFile(path.join(root, 'artifacts', `${prefix}-direct-build.json`), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ device: receipt.device, version, build, installed: true, launchedInForeground: true, runningConfirmed: true, assetsVerified: assets.length }, null, 2));

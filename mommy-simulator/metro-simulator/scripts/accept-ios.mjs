import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'artifacts');
const device = process.env.METRO_DEVICE || '7DC5143E-C086-5810-A86D-204E4D68D549';
const bundle = 'com.atlasoon.metrosimulator';
const call = args => execFileSync('xcrun', ['devicectl', ...args], { cwd: root, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
const launchPath = join(artifacts, 'ios-v2-device-test-launch.json');
const copyPath = join(artifacts, 'ios-v2-device-copy.json');
const normalPath = join(artifacts, 'ios-v2-normal-launch.json');
const started = Date.now();
call(['device', 'process', 'launch', '--device', device, '--terminate-existing', '--environment-variables', '{"METRO_DEVICE_ACCEPTANCE":"1"}', bundle, '--json-output', launchPath, '--timeout', '30']);
console.log('METRO on-device TAP acceptance started.');
await new Promise(resolve => setTimeout(resolve, 45000));
const directory = join(artifacts, 'physical-device-v2');
await mkdir(directory, { recursive: true });
try {
  call(['device', 'copy', 'from', '--device', device, '--domain-type', 'appDataContainer', '--domain-identifier', bundle, '--source', 'Documents/metro-acceptance', '--destination', directory, '--json-output', copyPath, '--timeout', '60']);
  const report = JSON.parse(await readFile(join(directory, 'acceptance.json'), 'utf8'));
  if (!report.physical_device || Date.parse(report.at + 'Z') < started - 10000) throw new Error('Fresh physical-device report required');
  if (report.failures.length) throw new Error(`METRO device checks failed: ${report.failures.join('; ')}`);
  const app = join(artifacts, 'ios-build2/Build/Products/Debug-iphoneos/MetroSimulator.app');
  const packed = await readFile(join(artifacts, 'ios-v2/MetroSimulator.pck'));
  const bundled = await readFile(join(app, 'MetroSimulator.pck'));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  if (hash(packed) !== hash(bundled)) throw new Error('Installed build PCK mismatch');
  const verified = { at: new Date().toISOString(), bundleId: bundle, version: '1.1.0', build: '2', device: 'iPhone 13 Pro Max',
    physicalAcceptance: report, pck: { bytes: packed.length, sha256: hash(packed), bundledParity: true } };
  await writeFile(join(artifacts, 'ios-v2-device-acceptance.json'), JSON.stringify(verified, null, 2) + '\n');
  console.log(JSON.stringify({ physicalDevice: true, checks: report.checks.length, failures: report.failures.length, renderer: report.renderer, ui: report.ui_points }));
} finally {
  call(['device', 'process', 'launch', '--device', device, '--terminate-existing', bundle, '--json-output', normalPath, '--timeout', '30']);
  console.log('METRO Simulator normal foreground launch restored.');
}

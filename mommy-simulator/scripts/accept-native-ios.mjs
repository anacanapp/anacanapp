import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = join(root, 'artifacts');
const device = '7DC5143E-C086-5810-A86D-204E4D68D549';
const bundle = 'com.atlasoon.mommysimulator';
const presets = await readFile(join(root, 'godot/export_presets.cfg'), 'utf8');
const build = process.argv[2] ?? presets.match(/application\/version="(\d+)"/)[1];
if (!/^\d+$/.test(build)) throw new Error('Provide a numeric native candidate build');
const candidate = JSON.parse(await readFile(join(artifacts, `native-world-ios-build${build}-source/candidate.json`), 'utf8'));
const expected = JSON.parse(await readFile(join(artifacts, 'native-world-acceptance.json'), 'utf8'));
if (expected.failures.length) throw new Error('Local native acceptance must pass first');
const run = suffix => join(artifacts, `native-world-ios-build${build}-${suffix}.json`);
const call = args => execFileSync('xcrun', ['devicectl', ...args], { cwd: root, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
const launchedAt = Date.now();
call(['device', 'process', 'launch', '--device', device, '--terminate-existing', '--environment-variables', '{"MOMMY_ENGINE_ACCEPTANCE":"1"}', bundle, '--json-output', run('test-launch'), '--timeout', '30']);
console.log('Physical native world test started. Waiting for its on-device report.');
let report;
try {
  const directory = join(artifacts, `native-world-physical-build${build}`); await mkdir(directory, { recursive: true });
  await new Promise(resolve => setTimeout(resolve, 60000));
  const deadline = Date.now() + 90000;
  let complete = false;
  while (Date.now() < deadline) {
    call(['device', 'copy', 'from', '--device', device, '--domain-type', 'appDataContainer', '--domain-identifier', bundle,
      '--source', 'Documents/engine-acceptance/native-world-acceptance.json', '--destination', join(directory, 'native-world-acceptance.json'), '--json-output', run('report-copy'), '--timeout', '45']);
    report = JSON.parse(await readFile(join(directory, 'native-world-acceptance.json'), 'utf8'));
    if (report.version === candidate.version && report.checks === expected.checks && Date.parse(report.at + 'Z') >= launchedAt - 10000) { complete = true; break; }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  if (!complete) throw new Error('Device acceptance did not finish before the deadline');
  call(['device', 'copy', 'from', '--device', device, '--domain-type', 'appDataContainer', '--domain-identifier', bundle, '--source', 'Documents/engine-acceptance', '--destination', directory, '--json-output', run('copy'), '--timeout', '60']);
  const checkpoint = JSON.parse(await readFile(join(directory, 'test-progress.json'), 'utf8'));
  if (!report.physicalDevice || report.checks !== expected.checks || report.failures.length || !report.durationMS || checkpoint.stage !== 'measured-lakeside' || report.version !== candidate.version) throw new Error('Fresh complete on-device report required');
  if (Date.parse(report.at + 'Z') < launchedAt - 10000) throw new Error('Stale device report');
} finally {
  call(['device', 'process', 'launch', '--device', device, '--terminate-existing', bundle, '--json-output', run('normal-launch'), '--timeout', '30']);
}
await writeFile(run('acceptance'), JSON.stringify({ at: new Date().toISOString(), version: candidate.version, build, device: 'iPhone 13 Pro Max', bundleId: bundle, physical: report, normalLaunch: true }, null, 2) + '\n');
console.log(JSON.stringify({ version: candidate.version, build, checks: report.checks, failures: report.failures.length, performance: report.performance, normalLaunch: true }));

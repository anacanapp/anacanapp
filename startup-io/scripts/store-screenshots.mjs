import { spawn } from 'node:child_process';
import { access, mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { webManifest, verifyWeb } from './release-evidence.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const release = JSON.parse(await readFile(path.join(root, 'store/release.json'), 'utf8'));
await access(path.join(root, 'artifacts'));
const output = path.join(root, 'artifacts', `store-${release.version}`, 'screenshots');
await mkdir(output, { recursive: true });
const devices = [
  { id: 'C8183B35-C70D-4ACC-A456-4252F52DB2E7', name: 'iphone', model: 'iPhone 17 Pro', width: 1206, height: 2622 },
  { id: 'C680D36D-FE43-4F39-99D1-F43A13FFC509', name: 'ipad', model: 'iPad Pro 13-inch (M5)', width: 2064, height: 2752 },
];
const web = await webManifest();
const receipt = { at: new Date().toISOString(), version: release.version, build: release.build, source: 'bundled native app on iOS Simulator', language: 'en', webManifestSha256: web.sha256, assets: web.files, images: [], result: 'pending' };
const saveReceipt = () => writeFile(path.join(output, 'screenshots.json'), JSON.stringify(receipt, null, 2) + '\n');
await saveReceipt();
async function execute(command, args, logName) {
  if (logName) {
    const log = await open(path.join(output, logName), 'w', 0o600);
    const code = await new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd: root, stdio: ['ignore', log.fd, log.fd] });
      child.once('error', reject); child.once('close', resolve);
    });
    await log.close();
    if (code !== 0) throw new Error(`${command} failed; ${logName}`);
    return readFile(path.join(output, logName), 'utf8');
  }
  let text = '';
  const code = await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', bytes => { text += bytes; }); child.stderr.on('data', bytes => { text += bytes; });
    child.once('error', reject); child.once('close', resolve);
  });
  if (logName) await writeFile(path.join(output, logName), text, { mode: 0o600 });
  if (code !== 0) {
    if (!logName) await writeFile(path.join(output, 'capture-operation-error.log'), text, { mode: 0o600 });
    throw new Error(`${command} failed; ${logName ?? 'capture-operation-error.log'}`);
  }
  return text;
}
try {
  for (const device of devices) {
    const existing = process.env[`STARTUP_SCREENSHOT_${device.name.toUpperCase()}_RESULT`];
    if (!existing) {
      const states = JSON.parse(await execute('xcrun', ['simctl', 'list', 'devices', 'available', '--json']));
      const state = Object.values(states.devices).flat().find(item => item.udid === device.id);
      if (state?.state !== 'Booted') await execute('xcrun', ['simctl', 'boot', device.id]);
      await execute('xcrun', ['simctl', 'bootstatus', device.id, '-b']);
    }
    const results = existing ? path.resolve(root, existing) : path.join(output, `${device.name}-${Date.now()}.xcresult`);
    if (!results.startsWith(output + path.sep) || !results.endsWith('.xcresult')) throw new Error('Screenshot result must belong to this store candidate');
    receipt.activeCapture = { device: device.name, resultBundle: path.relative(root, results) };
    await saveReceipt();
    if (!existing) await execute('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Debug', '-destination', `platform=iOS Simulator,id=${device.id}`, '-derivedDataPath', 'artifacts/ios-simulator', '-resultBundlePath', results, '-parallel-testing-enabled', 'NO', '-collect-test-diagnostics', 'never', '-only-testing:StartupIOUITests/StartupIOStoreScreenshots', '-jobs', '2', 'CODE_SIGNING_ALLOWED=NO', 'test'], `${device.name}-capture.log`);
    await verifyWeb(path.join(root, 'artifacts/ios-simulator/Build/Products/Debug-iphonesimulator/App.app/public'), web);
    const summary = JSON.parse(await execute('xcrun', ['xcresulttool', 'get', 'test-results', 'summary', '--path', results]));
    if (summary.result !== 'Passed' || summary.passedTests !== 1 || summary.failedTests || !summary.devicesAndConfigurations.some(item => item.device.deviceId === device.id)) throw new Error('Native screenshot acceptance required for the selected device');
    const exported = path.join(output, `${path.basename(results, '.xcresult')}-attachments-${Date.now()}`);
    await execute('xcrun', ['xcresulttool', 'export', 'attachments', '--path', results, '--output-path', exported]);
    const attachments = JSON.parse(await readFile(path.join(exported, 'manifest.json'), 'utf8')).flatMap(test => test.attachments);
    const storeImages = attachments.filter(item => item.suggestedHumanReadableName.startsWith('store-') && item.exportedFileName.endsWith('.png'));
    if (storeImages.length !== 5) throw new Error('Five native store screenshots required per device');
    for (const attachment of storeImages) {
      const filename = `${device.name}-${attachment.suggestedHumanReadableName.split('_')[0]}.png`;
      const bytes = await sharp(path.join(exported, attachment.exportedFileName)).autoOrient().flatten({ background: '#10202d' }).removeAlpha().png().toBuffer();
      const metadata = await sharp(bytes).metadata();
      if (metadata.width !== device.width || metadata.height !== device.height || metadata.hasAlpha) throw new Error('Native screenshot dimension or alpha mismatch');
      await writeFile(path.join(output, filename), bytes);
      receipt.images.push({ file: path.relative(root, path.join(output, filename)), device: device.model, width: metadata.width, height: metadata.height, alpha: false, sha256: createHash('sha256').update(bytes).digest('hex'), nativeResultBundle: path.relative(root, results) });
    }
    await saveReceipt();
    if (!existing) await execute('xcrun', ['simctl', 'shutdown', device.id]);
  }
  delete receipt.activeCapture;
  receipt.result = 'passed';
} catch (error) { receipt.result = 'failed'; receipt.error = error.message; process.exitCode = 1; }
await saveReceipt();
console.log(JSON.stringify({ result: receipt.result, images: receipt.images.length, error: receipt.error, directory: path.relative(root, output) }, null, 2));

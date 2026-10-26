import { spawn } from 'node:child_process';
import { access, mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const release = JSON.parse(await readFile(path.join(root, 'store/release.json'), 'utf8'));
const sdk = process.env.ANDROID_HOME ?? '/Users/jamilturkan/Library/Android/sdk';
const java = process.env.JAVA_HOME ?? '/var/folders/63/23_9ghpd0zl_sty24xn_r_t80000gn/T/opencode/jdk-21.0.12.1+1/Contents/Home';
const api = Number(process.env.STARTUP_ANDROID_API ?? 35);
if (![35, 36].includes(api)) throw new Error('Native acceptance supports the dedicated API 35 or 36 emulator');
const avdName = `StartupIO${api}`;
const renderer = process.env.STARTUP_ANDROID_GPU ?? (process.platform === 'darwin' ? 'host' : 'software');
const guestAngle = process.env.STARTUP_ANDROID_GUEST_ANGLE ? process.env.STARTUP_ANDROID_GUEST_ANGLE === '1' : process.platform === 'darwin';
const serial = 'emulator-5580';
await access(path.join(root, 'artifacts'));
const avds = path.join(root, 'artifacts/android-avd');
const output = path.join(root, 'artifacts', `store-${release.version}`, 'android-acceptance');
await mkdir(avds, { recursive: true }); await mkdir(output, { recursive: true });
const env = { ...process.env, JAVA_HOME: java, ANDROID_HOME: sdk, ANDROID_AVD_HOME: avds };
const report = { at: new Date().toISOString(), version: release.version, build: release.build, bundleId: release.bundleId, device: `Pixel 7 / Android ${api === 36 ? 16 : 15} API ${api} emulator`, avd: avdName, images: [], checks: [], result: 'pending' };
const save = () => writeFile(path.join(output, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function execute(command, args, input) {
  const chunks = []; let error = '';
  let timedOut = false;
  const code = await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, args.includes('uiautomator') ? 20000 : 60000);
    child.stdout.on('data', bytes => chunks.push(bytes)); child.stderr.on('data', bytes => { error += bytes; });
    child.once('error', reason => { clearTimeout(timer); reject(reason); });
    child.once('close', status => { clearTimeout(timer); resolve(status); }); child.stdin.end(input);
  });
  if (timedOut) throw new Error(`${path.basename(command)} timed out during ${args.includes('uiautomator') ? 'native accessibility snapshot' : 'device operation'}`);
  if (code !== 0) throw new Error(`${path.basename(command)} failed: ${error.trim().slice(0, 400)}`);
  return Buffer.concat(chunks);
}
const adb = async (...args) => (await execute(path.join(sdk, 'platform-tools/adb'), ['-s', serial, ...args])).toString();
async function hierarchy() {
  const filename = `/sdcard/startupio-window-${process.pid}-${Date.now()}.xml`;
  try {
    const dumped = await adb('shell', 'CLASSPATH=/data/local/tmp/startupio-native-snapshot.jar', 'app_process', '/system/bin', 'com.atlasoon.startupio.acceptance.NativeSnapshot', filename);
    if (!dumped.includes(`Snapshot complete: ${filename}`)) {
      await writeFile(path.join(output, 'snapshot-command-failure.log'), dumped);
      throw new Error('Android accessibility did not produce a fresh snapshot');
    }
    const xml = await adb('exec-out', 'cat', filename);
    if (!xml.includes('<hierarchy')) throw new Error('Android accessibility snapshot is incomplete');
    if (/text="(?:System UI|Quickstep) (?:isn't responding|keeps stopping)"/.test(xml)) {
      await writeFile(path.join(output, 'environment-failure.xml'), xml);
      report.failureKind = 'emulator operating system';
      throw new Error('Android emulator System UI/launcher is unresponsive');
    }
    return xml;
  } finally { await adb('shell', 'rm', '-f', filename).catch(() => undefined); }
}
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
function controls(xml) {
  return [...xml.matchAll(/<node\b([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(item => [item[1], decode(item[2])])));
}
async function tap(title) {
  for (let attempt = 0; attempt < 15; attempt++) {
    const xml = await hierarchy();
    const overlay = controls(xml).find(item => item['resource-id'] === 'com.android.systemui:id/immersive_cling_confirm');
    if (overlay) {
      const [left, top, right, bottom] = [...overlay.bounds.matchAll(/\d+/g)].map(item => Number(item[0]));
      await adb('shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2))); await delay(500); continue;
    }
    const node = controls(xml).find(item => (item.text === title || item['content-desc'] === title) && item.enabled !== 'false' && item.clickable === 'true');
    if (node) {
      const [left, top, right, bottom] = [...node.bounds.matchAll(/\d+/g)].map(item => Number(item[0]));
      await adb('shell', 'input', 'tap', String(Math.round((left + right) / 2)), String(Math.round((top + bottom) / 2))); await delay(900); return;
    }
    await delay(600);
  }
  await writeFile(path.join(output, 'missing-control.xml'), await hierarchy());
  throw new Error(`Missing Android control: ${title}`);
}
async function capture(name) {
  await delay(600);
  const bytes = await execute(path.join(sdk, 'platform-tools/adb'), ['-s', serial, 'exec-out', 'screencap', '-p']);
  const filename = path.join(output, `android-${name}.png`);
  await writeFile(filename, bytes);
  const metadata = await sharp(bytes).metadata();
  report.images.push({ file: path.relative(root, filename), width: metadata.width, height: metadata.height, sha256: createHash('sha256').update(bytes).digest('hex') });
  await save();
}
async function closeModal() {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (!(await hierarchy()).includes('class="android.app.Dialog"')) return;
    await tap('Close');
  }
  throw new Error('Android modal must close before continuing');
}
try {
  let connected = false;
  try { connected = (await adb('get-state')).trim() === 'device'; } catch { /* The dedicated AVD is created on its first run. */ }
  if (!connected) {
    const avd = path.join(avds, `${avdName}.avd`);
    try { await access(path.join(avd, 'config.ini')); } catch {
      await execute(path.join(sdk, 'cmdline-tools/latest/bin/avdmanager'), ['create', 'avd', '-n', avdName, '-k', `system-images;android-${api};default;arm64-v8a`, '-d', 'pixel_7', '-p', avd], 'no\n');
    }
    const log = await open(path.join(output, 'emulator.log'), 'w', 0o600);
    const emulator = spawn(path.join(sdk, 'emulator/emulator'), ['-avd', avdName, '-port', '5580', '-no-window', '-no-audio', '-no-snapshot', '-no-boot-anim', '-gpu', renderer, ...(guestAngle ? ['-feature', 'GuestAngle', '-feature', 'Vulkan'] : ['-feature', '-Vulkan']), '-memory', '2560', '-cores', '4', '-no-metrics', ...(process.argv.includes('--reset-emulator') ? ['-wipe-data'] : [])], { cwd: root, env, detached: true, stdio: ['ignore', log.fd, log.fd] });
    emulator.unref(); await log.close();
  }
  const bootDeadline = Date.now() + 300000;
  while (Date.now() < bootDeadline) { try { if ((await adb('shell', 'getprop', 'sys.boot_completed')).trim() === '1') break; } catch { /* Wait for the dedicated emulator transport. */ } await delay(1500); }
  if ((await adb('shell', 'getprop', 'sys.boot_completed')).trim() !== '1') throw new Error('Android emulator boot timed out');
  await delay(15000);
  await adb('shell', 'input', 'keyevent', '82');
  await adb('shell', 'settings', 'put', 'secure', 'immersive_mode_confirmations', 'confirmed');
  await adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
  await adb('shell', 'settings', 'put', 'system', 'user_rotation', '0');
  const apk = path.join(root, 'artifacts', `store-${release.version}`, `startup-io-${release.version}-android-release.apk`);
  const apkBytes = await readFile(apk); report.apkSha256 = createHash('sha256').update(apkBytes).digest('hex');
  const ownedDevice = await adb('emu', 'avd', 'name');
  if (!ownedDevice.split(/\r?\n/).map(line => line.trim()).includes(avdName)) throw new Error('Acceptance must use the selected dedicated startup.io emulator');
  if (Number((await adb('shell', 'getprop', 'ro.build.version.sdk')).trim()) !== api) throw new Error('Android emulator API mismatch');
  report.renderer = renderer;
  report.guestEgl = (await adb('shell', 'getprop', 'ro.hardware.egl')).trim();
  const classes = path.join(output, 'snapshot-classes'); await mkdir(classes, { recursive: true });
  const platform = path.join(sdk, 'platforms/android-36');
  await execute(path.join(java, 'bin/javac'), ['-source', '8', '-target', '8', '-cp', `${platform}/android.jar`, '-d', classes, 'scripts/android/NativeSnapshot.java']);
  const snapshotJar = path.join(output, 'native-snapshot.jar');
  await execute(path.join(java, 'bin/jar'), ['cf', snapshotJar, '-C', classes, '.']);
  const dex = path.join(output, 'snapshot-dex'); await mkdir(dex, { recursive: true });
  await execute(path.join(sdk, 'build-tools/36.0.0/d8'), ['--min-api', '24', '--output', dex, snapshotJar]);
  const dexJar = path.join(output, 'native-snapshot-dex.jar');
  await execute(path.join(java, 'bin/jar'), ['cf', dexJar, '-C', dex, 'classes.dex']);
  await adb('push', dexJar, '/data/local/tmp/startupio-native-snapshot.jar');
  await hierarchy();
  const packages = await adb('shell', 'pm', 'list', 'packages', release.bundleId);
  if (packages.includes(`package:${release.bundleId}`)) await adb('uninstall', release.bundleId);
  await adb('install', '-r', apk);
  // This script owns a dedicated emulator; reset only its startup.io fixture between runs.
  await adb('shell', 'pm', 'clear', release.bundleId);
  const installed = await adb('shell', 'dumpsys', 'package', release.bundleId);
  if (!installed.includes(`versionName=${release.version}`) || !installed.includes(`versionCode=${release.build} `)) throw new Error('Android installed version mismatch');
  report.checks.push('signed release install/version'); await save();
  await adb('shell', 'am', 'force-stop', release.bundleId);
  await adb('shell', 'am', 'start', '-W', '-n', `${release.bundleId}/.MainActivity`);
  let home = '';
  for (let attempt = 0; attempt < 15; attempt++) {
    home = await hierarchy();
    if (home.includes('text="Settings"') || home.includes('text="Ayarlar"')) break;
    await delay(700);
  }
  report.activeStep = 'settings and home'; await save();
  const viewport = controls(home).find(item => item.class === 'android.webkit.WebView');
  if (!viewport?.bounds.startsWith('[0,0]')) throw new Error('Native Android WebView must reach the top edge without duplicate system-bar padding');
  report.checks.push('fullscreen native WebView');
  await tap(home.includes('text="Settings"') ? 'Settings' : 'Ayarlar'); await tap('EN'); await closeModal();
  await capture('01-home');
  report.activeStep = 'launch and real movement'; await save();
  await tap('Enter the arena'); await tap('Let’s go');
  await tap('Pause'); await tap('Back to the arena');
  await capture('02-arena');
  await adb('shell', 'input', 'touchscreen', 'swipe', '270', '1300', '420', '1390', '1800');
  await adb('shell', 'input', 'touchscreen', 'swipe', '270', '1300', '420', '1390', '1800');
  await tap('Pivot — escape shield');
  await capture('03-pivot');
  await tap('Pause');
  const paused = await hierarchy();
  await writeFile(path.join(output, 'pause-window.xml'), paused);
  if (!paused.includes('Take a breather.') || paused.includes('text="$10K"')) throw new Error('Android movement/pause acceptance failed');
  report.checks.push('real movement/growth', 'PIVOT control', 'native pause');
  report.activeStep = 'save, shop and studio'; await save();
  await tap('Save & leave');
  await tap('Marketplace'); await capture('04-marketplace');
  await tap('Customize'); await capture('05-customize');
  await adb('shell', 'am', 'force-stop', release.bundleId);
  await adb('shell', 'am', 'start', '-W', '-n', `${release.bundleId}/.MainActivity`);
  await tap('Continue'); await tap('Pause');
  if (!(await hierarchy()).includes('Take a breather.')) throw new Error('Android resume acceptance failed');
  report.checks.push('save/relaunch/resume', 'English setting persistence');
  report.activeStep = 'background pause'; await save();
  await tap('Back to the arena'); await adb('shell', 'input', 'keyevent', '3');
  let backgrounded = false;
  for (let attempt = 0; attempt < 15; attempt++) {
    const activities = await adb('shell', 'dumpsys', 'activity', 'activities');
    const activity = new RegExp(`packageName=${release.bundleId.replaceAll('.', '\\.')}[\\s\\S]*?\\bstate=(?:PAUSED|STOPPED)\\b`).test(activities);
    if (activity) { backgrounded = true; break; }
    await delay(500);
  }
  if (!backgrounded) throw new Error('Android Home transition must actually background the game activity');
  await adb('shell', 'am', 'start', '-W', '-n', `${release.bundleId}/.MainActivity`);
  if (!(await hierarchy()).includes('Take a breather.')) throw new Error('Android background pause failed');
  report.checks.push('background pause');
  await tap('Save & leave');
  report.result = 'passed';
  delete report.activeStep;
} catch (error) { report.result = 'failed'; report.error = error.message; await capture('failure').catch(() => undefined); process.exitCode = 1; }
report.finishedAt = new Date().toISOString(); await save();
console.log(JSON.stringify({ result: report.result, device: report.device, checks: report.checks, screenshots: report.images.length, error: report.error, receipt: path.relative(root, path.join(output, 'acceptance.json')) }, null, 2));

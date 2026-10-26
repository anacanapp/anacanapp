import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = spawn(process.execPath, ['scripts/serve-native-world.mjs'], { cwd: root, stdio: 'ignore' });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl'] });
const errors = [], results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => { window.MOMMY_TEST_INSPECT = true; });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /SCRIPT ERROR|SHADER ERROR|Parse Error|Invalid/.test(message.text())) errors.push(message.text()); });
  await page.goto('http://127.0.0.1:5178');
  await page.waitForFunction(() => !document.getElementById('status') || document.getElementById('status').style.visibility === 'hidden', null, { timeout: 90000 }).catch(async error => {
    await page.screenshot({ path: join(root, 'artifacts/native-world-browser-load-error.png') });
    console.log(JSON.stringify({ errors, status: await page.locator('body').innerText() }));
    throw error;
  });
  await page.waitForTimeout(2000);
  await page.waitForFunction(() => window.MOMMY_WORLD_INSPECT?.ready, null, { timeout: 30000 });
  const telemetry = () => page.evaluate(() => window.MOMMY_WORLD_INSPECT);
  const control = async text => {
    const state = await telemetry(), position = state.controls[text];
    if (!position) throw new Error(`Missing native UI control: ${text}`);
    await page.mouse.click(position[0], position[1]); await page.waitForTimeout(350);
  };
  const rendered = await page.locator('canvas').screenshot();
  const imageStats = await sharp(rendered).stats();
  if (imageStats.channels.every(channel => channel.stdev < 1)) throw new Error('Native world canvas did not render a visible scene');
  await page.screenshot({ path: join(root, 'artifacts/native-world-browser-welcome.png') });
  await control('Hamiləlikdən başla');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(root, 'artifacts/native-world-browser-play.png') });
  results.push({ check: 'Godot WASM world loads and starts', passed: !errors.length });
  // Verify free motion in the unobstructed hallway rather than walking into a partition.
  const before = (await telemetry()).player;
  await page.keyboard.down('w'); await page.waitForTimeout(800); await page.keyboard.up('w');
  await page.waitForTimeout(400);
  const after = (await telemetry()).player;
  results.push({ check: 'WASD continuously moves the native player', passed: Math.hypot(...before.map((value, index) => value - after[index])) > .20 });
  await page.mouse.move(750, 340); await page.mouse.down({ button: 'right' }); await page.mouse.move(900, 355, { steps: 10 }); await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(root, 'artifacts/native-world-browser-camera.png') });
  await control('Xəritə');
  await page.screenshot({ path: join(root, 'artifacts/native-world-browser-map.png') });
  await control('Quartiermarkt  →'); await page.waitForTimeout(1000);
  await page.screenshot({ path: join(root, 'artifacts/native-world-browser-market.png') });
  results.push({ check: 'native HUD map enters market', passed: (await telemetry()).location === 'market' && !errors.length });
  await control('Xəritə'); await control('Lakeview House  →');
  // The bathroom is reached by walking up the hall and opening its physical door.
  await page.keyboard.down('w'); await page.waitForTimeout(3600); await page.keyboard.up('w');
  await page.waitForTimeout(500);
  await page.keyboard.press('e'); await page.waitForTimeout(800);
  await page.keyboard.down('w'); await page.waitForTimeout(900); await page.keyboard.up('w');
  await control('→'); await page.waitForTimeout(500);
  const openTask = await telemetry();
  results.push({ check: 'walk, door and story reach the 3D pregnancy test', passed: openTask.task === 'test' });
  if (openTask.task === 'test') {
    const entries = Object.entries(openTask.taskItems).filter(([, item]) => item.valid && !item.done);
    if (entries.length) {
      const [, item] = entries[0]; await page.mouse.click(item.screen[0], item.screen[1]);
      await page.waitForTimeout(500);
      results.push({ check: 'pointer selects an actual 3D task object', passed: Object.values((await telemetry()).taskItems).some(item => item.done) });
    }
    await control('task-cancel');
    results.push({ check: 'task cancellation restores controls', passed: !(await telemetry()).taskLocked });
  }
  const layout = await page.evaluate(() => ({ horizontal: document.documentElement.scrollWidth > innerWidth, canvasWidth: document.querySelector('canvas').width, canvasHeight: document.querySelector('canvas').height }));
  results.push({ check: 'canvas fills landscape viewport', passed: !layout.horizontal && layout.canvasWidth > 0 && layout.canvasHeight > 0 });
  await page.setViewportSize({ width: 932, height: 430 }); await page.waitForTimeout(1000);
  await page.screenshot({ path: join(root, 'artifacts/native-world-browser-mobile.png') });
  const report = { at: new Date().toISOString(), renderer: 'Godot WebGL compatibility preview', physicalDevice: false, results, errors };
  await writeFile(join(root, 'artifacts/native-world-browser-acceptance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (errors.length || results.some(result => !result.passed)) process.exitCode = 1;
} finally { await browser.close(); server.kill(); }

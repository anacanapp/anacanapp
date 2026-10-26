import { chromium } from '@playwright/test';
import { build as buildVite, preview } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temp = '/var/folders/63/23_9ghpd0zl_sty24xn_r_t80000gn/T/opencode/anacan-two-friends';
await mkdir(temp, { recursive: true });
const catalog = JSON.parse(await readFile(join(root, 'src/components/games/iki-dost/catalog.json'), 'utf8'));
const languages = ['az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv'];
const report = { at: new Date().toISOString(), passed: false, productionBundle: true, checks: [], screenshots: [], languages: [] };
const assert = (value, code) => { if (!value) throw new Error(code); };
const output = join(root, 'azure-migration/two-friends-verification/preview');
process.env.VITE_NATIVE_BUILD = 'true';
await buildVite({ root, mode: 'google', logLevel: 'error', build: { outDir: output, emptyOutDir: true, rollupOptions: { input: join(root, 'scripts/iki-dost/preview.html') } } });
const server = await preview({ root, mode: 'google', build: { outDir: output }, preview: { host: '127.0.0.1', port: 5182, strictPort: true } });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let stage = 'first-game', lastPage;
const errors = [];
async function context(viewport, language = 'az', level = 1) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block', hasTouch: true });
  await context.addInitScript(({ language, revision, level }) => {
    localStorage.setItem('anacan-user-store', JSON.stringify({ state: { language, hasSeenIntro: true, hasSelectedLanguage: true }, version: 0 }));
    if (level > 1) localStorage.setItem(`anacan_two_friends_v1:${revision}`, JSON.stringify({ schema: 'anacan-two-friends-profile-v1', revision,
      progress: { unlocked: level, totalRescues: 0, bestScore: 0, levels: {} }, round: null }));
  }, { language, level, revision: catalog.revision });
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue()
    : route.fulfill({ status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"error":"acceptance-network-blocked"}' }));
  return context;
}
async function open(context, level = 1, hub = false) {
  const page = await context.newPage(); lastPage = page; page.setDefaultTimeout(25000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:5182/scripts/iki-dost/preview.html${hub ? '?hub' : ''}`, { waitUntil: 'domcontentloaded' });
  if (hub) await page.locator('[data-game-id="iki-dost"]').click();
  await page.locator(`[data-friends-level-button="${level}"]`).click(); await page.getByTestId('friends-boards').waitFor();
  return page;
}
async function screenshot(page, name) { const file = join(temp, `${name}.png`); await page.screenshot({ path: file }); report.screenshots.push(file); }
async function step(page, direction, touch = false) {
  await page.waitForTimeout(155);
  const button = page.locator(`[data-friends-direction="${direction}"]`);
  if (touch) await button.tap(); else await button.click();
}
async function progress(page) { return page.evaluate(revision => JSON.parse(localStorage.getItem(`anacan_two_friends_v1:${revision}`)), catalog.revision); }
try {
  const mobile = await context({ width: 390, height: 844 }); const page = await open(mobile);
  await screenshot(page, 'first-level');
  for (const direction of catalog.levels[0].solution) await step(page, direction, true);
  await page.locator('[role="dialog"]').waitFor();
  const won = await progress(page); assert(won.progress.unlocked === 2 && won.progress.totalRescues === 2 && won.round.awarded, 'TWO_FRIENDS_TOUCH_WIN_FAILED');
  await screenshot(page, 'first-win'); report.checks.push('real-touch-shared-control-win-and-once-only-rescue');
  await page.getByRole('button', { name: 'Növbəti səviyyə' }).click();
  await step(page, catalog.levels[1].solution[0]); const before = (await progress(page)).round.path;
  await page.reload(); await page.locator('.tf-play').click();
  assert(JSON.stringify((await progress(page)).round.path) === JSON.stringify(before), 'TWO_FRIENDS_RELOAD_RESUME_FAILED');
  await page.getByRole('button', { name: 'Geri al' }).click(); assert((await progress(page)).round.path.length === 0, 'TWO_FRIENDS_UNDO_FAILED');
  const swipe = catalog.levels[1].solution[0];
  const box = await page.getByTestId('friends-boards').boundingBox();
  assert(box, 'TWO_FRIENDS_SWIPE_BOARD_MISSING');
  const client = await page.context().newCDPSession(page);
  try {
    const origin = { x: box.x + box.width / 2, y: box.y + box.height / 3, id: 1 };
    const offset = { up: [0, -45], right: [45, 0], down: [0, 45], left: [-45, 0] }[swipe];
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [origin] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...origin, x: origin.x + offset[0], y: origin.y + offset[1] }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await client.detach(); }
  assert(JSON.stringify((await progress(page)).round.path) === JSON.stringify([swipe]), 'TWO_FRIENDS_REAL_SWIPE_FAILED');
  await page.getByRole('button', { name: 'Geri al' }).click();
  const keyboardDirection = catalog.levels[1].solution[0];
  const keyboardKey = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' }[keyboardDirection];
  await page.keyboard.press(keyboardKey);
  assert(JSON.stringify((await progress(page)).round.path) === JSON.stringify([keyboardDirection]), 'TWO_FRIENDS_KEYBOARD_FAILED');
  await page.getByRole('button', { name: 'Geri al' }).click();
  report.checks.push('real-touch-swipe-and-keyboard-shared-movement');
  await page.getByRole('button', { name: /İpucu/ }).click(); await page.locator('.tf-direction.is-hint').waitFor();
  assert((await progress(page)).round.hints === 1, 'TWO_FRIENDS_REAL_WORKER_HINT_FAILED');
  await screenshot(page, 'solver-hint'); report.checks.push('reload-resume-undo-and-real-worker-hint');
  await page.getByRole('button', { name: 'Fasilə' }).click();
  assert(await page.locator('[data-friends-direction="right"]').isDisabled(), 'TWO_FRIENDS_PAUSE_INPUT_NOT_BLOCKED');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Parametrlər' }).click(); await page.getByRole('switch', { name: 'Səslər' }).click(); await screenshot(page, 'settings');
  await page.keyboard.press('Escape'); report.checks.push('pause-modal-keyboard-settings');
  await mobile.close();
  for (const level of [12, 17, 29, 40]) {
    stage = `level-${level}`; console.log(JSON.stringify({ stage }));
    const current = await context({ width: 390, height: 844 }, 'az', level), page = await open(current, level);
    await screenshot(page, `level-${level}`);
    for (const direction of catalog.levels[level - 1].solution) await step(page, direction);
    assert((await progress(page)).round.awarded, 'TWO_FRIENDS_ADVANCED_LEVEL_NOT_SOLVED');
    report.checks.push(`playable-${level}-mirror-key-pressure-solution`); await current.close();
  }
  for (const [name, viewport, level, language] of [
    ['small-phone', { width: 320, height: 568 }, 40, 'az'], ['iphone-safe-area', { width: 428, height: 926 }, 29, 'az'],
    ['tablet', { width: 768, height: 1024 }, 17, 'en'], ['landscape', { width: 844, height: 390 }, 40, 'az'],
    ['arabic', { width: 390, height: 844 }, 29, 'ar'],
  ]) {
    stage = name; console.log(JSON.stringify({ stage }));
    const current = await context(viewport, language, level);
    if (name === 'iphone-safe-area') await current.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => { const style = document.createElement('style'); style.textContent = '.tf-screen{padding-top:47px!important;padding-bottom:34px!important}'; document.head.appendChild(style); }, { once: true });
    });
    const page = await open(current, level); await page.waitForTimeout(200);
    const measure = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('.tf-world,.tf-direction,.tf-game-dock')].map(node => { const b = node.getBoundingClientRect(); return { name: node.className, x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; });
      return { boxes, viewport: { width: innerWidth, height: innerHeight }, scrollWidth: document.documentElement.scrollWidth, cell: document.querySelector('.tf-tile')?.getBoundingClientRect().width };
    });
    assert(measure.scrollWidth <= viewport.width, 'TWO_FRIENDS_HORIZONTAL_OVERFLOW');
    assert(measure.boxes.every(box => box.x >= 0 && box.y >= 0 && box.right <= viewport.width && box.bottom <= viewport.height), 'TWO_FRIENDS_GAME_CLIPPED');
    assert(measure.boxes.filter(box => box.name.includes('tf-direction')).every(box => box.width >= 44 && box.height >= 44), 'TWO_FRIENDS_CONTROL_TOO_SMALL');
    assert(measure.cell >= 20, 'TWO_FRIENDS_GRID_TOO_SMALL');
    await screenshot(page, name); report.checks.push({ name, measure }); await current.close();
  }
  stage = '21-languages';
  for (const language of languages) {
    const current = await context({ width: 390, height: 844 }, language), page = await open(current, 1, true);
    const text = await page.locator('.tf-screen').innerText();
    assert(!/\{(?:count|level)\}|undefined/.test(text), 'TWO_FRIENDS_LANGUAGE_PLACEHOLDER');
    assert(await page.locator('.tf-screen').getAttribute('lang') === language, 'TWO_FRIENDS_LANGUAGE_WRONG');
    if (language !== 'az') assert(!text.includes('Səviyyə') && !text.includes('Yoldadır'), 'TWO_FRIENDS_AZ_COPY_LEAK');
    if (language === 'ar') assert(await page.locator('.tf-screen').getAttribute('dir') === 'rtl', 'TWO_FRIENDS_RTL_MISSING');
    report.languages.push(language); await current.close();
  }
  report.checks.push('all-21-offline-languages-and-real-hub-entry');
  assert(errors.length === 0, 'TWO_FRIENDS_UNHANDLED_BROWSER_ERROR'); report.passed = true; report.finishedAt = new Date().toISOString();
} catch (error) {
  report.error = String(error.message).split('\n')[0]; report.stage = stage; process.exitCode = 1;
  if (lastPage && !lastPage.isClosed()) await screenshot(lastPage, 'failure').catch(() => {});
} finally {
  await writeFile(join(temp, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, stage: report.stage, error: report.error, checks: report.checks.length, languages: report.languages.length, screenshots: report.screenshots.length }));
  await browser.close(); server.httpServer.closeAllConnections?.(); await new Promise(resolve => server.httpServer.close(resolve));
}

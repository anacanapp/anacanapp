import { chromium } from '@playwright/test';
import { build as buildVite, preview } from 'vite';
import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temp = '/var/folders/63/23_9ghpd0zl_sty24xn_r_t80000gn/T/opencode/anacan-flight-parking';
await mkdir(temp, { recursive: true });
const catalog = JSON.parse(await readFile(join(root, 'src/components/games/parking/catalog.json'), 'utf8'));
const bundle = await build({ stdin: { contents: 'export * from "./src/components/games/leaf-flight/engine.ts";', resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const flight = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
async function sourceHash() {
  const hash = createHash('sha256');
  for (const folder of ['casual', 'leaf-flight', 'parking']) for (const file of (await readdir(join(root, 'src/components/games', folder))).sort()) {
    if (file.includes('.test.')) continue;
    hash.update(`${folder}/${file}`); hash.update(await readFile(join(root, 'src/components/games', folder, file)));
  }
  hash.update(await readFile(join(root, 'src/components/games/MiniGamesHub.tsx')));
  return hash.digest('hex');
}
const fingerprint = await sourceHash(), progressFile = join(temp, 'browser-progress.json');
let previous;
try { previous = JSON.parse(await readFile(progressFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const report = previous?.sourceSha256 === fingerprint ? { ...previous, passed: false }
  : { at: new Date().toISOString(), passed: false, productionBundle: true, sourceSha256: fingerprint, checks: [], languages: [], screenshots: [], layout: [] };
const checkpoint = () => writeFile(progressFile, JSON.stringify(report, null, 2) + '\n');
const assert = (value, code) => { if (!value) throw new Error(code); };
const output = join(root, 'azure-migration/flight-parking-verification/preview');
process.env.VITE_NATIVE_BUILD = 'true';
if (previous?.sourceSha256 !== fingerprint) {
  await buildVite({ root, mode: 'google', logLevel: 'error', build: { outDir: output, emptyOutDir: true, rollupOptions: { input: join(root, 'scripts/new-games/preview.html') } } });
  await checkpoint();
}
const server = await preview({ root, mode: 'google', build: { outDir: output }, preview: { host: '127.0.0.1', port: 5183, strictPort: true } });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const languages = ['az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv'];
let stage = 'parking', lastPage;
const errors = [];
const storage = game => game === 'flight' ? 'anacan_casual_v1:leaf-flight:flight-202610-v1' : `anacan_casual_v1:clear-the-way:${catalog.revision}`;
async function context(viewport, language = 'az', level = 1, game = 'parking') {
  const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(({ language, level, game, key }) => {
    localStorage.setItem('anacan-user-store', JSON.stringify({ state: { language, hasSeenIntro: true, hasSelectedLanguage: true }, version: 0 }));
    if (level > 1 && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ schema: 'anacan-casual-profile-v1', game: game === 'flight' ? 'leaf-flight' : 'clear-the-way',
      revision: game === 'flight' ? 'flight-202610-v1' : 'parking-202610-v1', unlocked: level, levels: {}, round: null }));
  }, { language, level, game, key: storage(game) });
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue()
    : route.fulfill({ status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"error":"acceptance-network-blocked"}' }));
  return context;
}
async function open(context, game, level = 1, hub = false) {
  const page = await context.newPage(); lastPage = page; page.setDefaultTimeout(25000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:5183/scripts/new-games/preview.html${hub ? '' : `?game=${game}`}`, { waitUntil: 'domcontentloaded' });
  if (hub) await page.locator(`[data-game-id="${game === 'flight' ? 'leaf-flight' : 'clear-the-way'}"]`).click();
  await page.locator('.cg-play').waitFor({ state: 'visible' });
  const selector = `[data-casual-level="${level}"]`;
  for (let attempt = 0; attempt < 4 && !await page.locator(selector).count(); attempt++) {
    const heading = await page.locator('.cg-page h3').innerText();
    await page.locator('.cg-page > button').last().click();
    await page.waitForFunction(previous => document.querySelector('.cg-page h3')?.textContent !== previous, heading);
  }
  assert(await page.locator(selector).count() === 1, 'NEW_GAMES_REQUESTED_LEVEL_NOT_VISIBLE');
  await page.locator(selector).click();
  await page.getByTestId(game === 'flight' ? 'flight-canvas' : 'parking-board').waitFor();
  return page;
}
async function screenshot(page, name) { const file = join(temp, `${name}.png`); await page.screenshot({ path: file }); if (!report.screenshots.includes(file)) report.screenshots.push(file); }
const profile = (page, game) => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storage(game));
async function dragCar(page, level, move, touch = false) {
  const car = page.locator(`[data-parking-car="${move.car}"]`), rect = await car.boundingBox(), board = await page.getByTestId('parking-board').boundingBox();
  assert(rect && board, 'PARKING_DRAG_TARGET_MISSING');
  const from = Number(await car.getAttribute('data-car-position')), dx = level.cars[move.car].axis === 'h' ? (move.to - from) * (board.width - 6) / 6 : 0;
  const dy = level.cars[move.car].axis === 'v' ? (move.to - from) * (board.width - 6) / 6 : 0;
  // Finishing can go beyond the board, but stays within the actual viewport.
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  if (touch) {
    const client = await page.context().newCDPSession(page);
    try {
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      for (let i = 1; i <= 10; i++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 10, y: y + dy * i / 10, id: 1 }] });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await client.detach(); }
  } else {
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 12 }); await page.mouse.up();
  }
  await page.waitForTimeout(180);
}
async function fly(page, levelNumber, screenshotName) {
  const definition = flight.flightLevel(levelNumber);
  await page.clock.install({ time: new Date('2026-10-09T08:00:00Z') });
  await page.locator('.cg-modal .cg-primary').click();
  const surface = await page.locator('.flight-stage').boundingBox(); assert(surface, 'FLIGHT_SURFACE_MISSING');
  const client = await page.context().newCDPSession(page); let held = false;
  try {
    for (let frame = 0; frame < 450; frame++) {
      if (await page.getByTestId('leaf-flight-screen').getAttribute('data-game-phase') !== 'playing') break;
      const state = await page.locator('.flight-stage').evaluate(el => ({ y: Number(el.dataset.flightY), velocity: Number(el.dataset.flightVelocity), distance: Number(el.dataset.flightDistance), time: Number(el.dataset.flightTime) }));
      const gate = definition.gates.find(gate => gate.x + gate.width + 50 > state.distance + 100), target = gate ? flight.flightGateGaps(gate, state.time)[0].center : 360;
      const next = state.y + state.velocity * .35 > target;
      if (next !== held) {
        await client.send('Input.dispatchTouchEvent', { type: next ? 'touchStart' : 'touchEnd', touchPoints: next ? [{ x: surface.x + surface.width * .35, y: surface.y + surface.height * .5, id: 1 }] : [] }); held = next;
      }
      await page.clock.runFor(100);
      if (frame === 75) await screenshot(page, screenshotName);
    }
    if (held) await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await client.detach(); }
  assert(await page.getByTestId('leaf-flight-screen').getAttribute('data-game-phase') === 'won', 'FLIGHT_REAL_TOUCH_DID_NOT_FINISH');
  const saved = await profile(page, 'flight'); assert(saved.levels[String(levelNumber)]?.score > 0 && saved.round === null, 'FLIGHT_WIN_NOT_SAVED');
}
try {
  if (!report.checks.includes('parking-resume-undo-worker-hint-and-pause')) {
  const mobile = await context({ width: 390, height: 844 }); const page = await open(mobile, 'parking');
  await screenshot(page, 'parking-first');
  const first = catalog.levels[0];
  for (const move of first.solution) await dragCar(page, first, move, true);
  assert((await profile(page, 'parking')).unlocked === 2, 'PARKING_REAL_TOUCH_WIN_FAILED');
  await screenshot(page, 'parking-win'); report.checks.push('parking-real-touch-slide-and-completion');
  await page.getByRole('button', { name: 'Növbəti səviyyə' }).click();
  const second = catalog.levels[1], move = second.solution[0]; await dragCar(page, second, move);
  const before = (await profile(page, 'parking')).round;
  assert(before.path.length === 1 && before.moves === 1, 'PARKING_MULTI_CELL_DRAG_COUNT_WRONG');
  await page.reload(); await page.locator('.cg-play').click();
  assert(JSON.stringify((await profile(page, 'parking')).round) === JSON.stringify(before), 'PARKING_RESUME_FAILED');
  await page.getByRole('button', { name: 'Geri al' }).click(); assert((await profile(page, 'parking')).round.path.length === 0, 'PARKING_UNDO_FAILED');
  await page.getByRole('button', { name: /İpucu/ }).click(); await page.locator('.parking-car.is-hint').waitFor();
  assert((await profile(page, 'parking')).round.hints === 1, 'PARKING_WORKER_HINT_FAILED');
  await page.getByRole('button', { name: 'Fasilə' }).click(); assert(await page.locator('[data-parking-car="0"]').isDisabled(), 'PARKING_PAUSE_INPUT_NOT_BLOCKED');
  await page.keyboard.press('Escape'); report.checks.push('parking-resume-undo-worker-hint-and-pause'); await mobile.close(); await checkpoint();
  }
  for (const level of [25, 40]) {
    if (report.checks.includes(`parking-${level}-dragged-bus-and-key-gate-solution`)) continue;
    stage = `parking-${level}`; console.log(JSON.stringify({ stage }));
    const current = await context({ width: 390, height: 844 }, 'az', level), page = await open(current, 'parking', level);
    await screenshot(page, `parking-level-${level}`);
    for (const move of catalog.levels[level - 1].solution) await dragCar(page, catalog.levels[level - 1], move);
    assert((await profile(page, 'parking')).levels[String(level)], 'PARKING_KEY_GATE_LEVEL_NOT_SOLVED');
    report.checks.push(`parking-${level}-dragged-bus-and-key-gate-solution`); await current.close(); await checkpoint();
  }
  if (!report.checks.includes('flight-real-touch-hold-release-finish-and-reward')) {
  stage = 'flight-first'; console.log(JSON.stringify({ stage }));
  const firstFlight = await context({ width: 390, height: 844 }, 'az', 1, 'flight'), flightPage = await open(firstFlight, 'flight');
  await screenshot(flightPage, 'flight-ready'); await fly(flightPage, 1, 'flight-playing'); await screenshot(flightPage, 'flight-win');
  report.checks.push('flight-real-touch-hold-release-finish-and-reward'); await firstFlight.close(); await checkpoint();
  }
  if (!report.checks.includes('flight-keyboard-background-safe-pause-and-resume')) {
  stage = 'flight-resume'; console.log(JSON.stringify({ stage }));
  const resume = await context({ width: 390, height: 844 }, 'az', 7, 'flight'), resumePage = await open(resume, 'flight', 7);
  await resumePage.locator('.cg-modal .cg-primary').click(); await resumePage.keyboard.down('ArrowUp'); await resumePage.waitForTimeout(600); await resumePage.keyboard.up('ArrowUp');
  await resumePage.getByRole('button', { name: 'Fasilə' }).click(); const snapshot = (await profile(resumePage, 'flight')).round;
  assert(snapshot.distance > 0 && snapshot.y < 360, 'FLIGHT_KEYBOARD_CONTROL_FAILED');
  await resumePage.waitForTimeout(500); assert(JSON.stringify((await profile(resumePage, 'flight')).round) === JSON.stringify(snapshot), 'FLIGHT_PAUSE_CHANGED_STATE');
  await resumePage.reload(); await resumePage.locator('.cg-play').click();
  assert(JSON.stringify((await profile(resumePage, 'flight')).round) === JSON.stringify(snapshot), 'FLIGHT_RELOAD_CHANGED_STATE');
  report.checks.push('flight-keyboard-background-safe-pause-and-resume'); await resume.close(); await checkpoint();
  }
  if (!report.checks.includes('flight-30-moving-wind-secret-route-finish')) {
  stage = 'flight-late'; console.log(JSON.stringify({ stage }));
  const lateFlight = await context({ width: 390, height: 844 }, 'az', 30, 'flight'), latePage = await open(lateFlight, 'flight', 30);
  await fly(latePage, 30, 'flight-secret-and-moving'); report.checks.push('flight-30-moving-wind-secret-route-finish'); await lateFlight.close(); await checkpoint();
  }
  for (const [name, viewport] of [['small', { width: 320, height: 568 }], ['safe-area', { width: 428, height: 926 }], ['tablet', { width: 768, height: 1024 }], ['landscape', { width: 844, height: 390 }]]) {
    for (const game of ['flight', 'parking']) {
      if (report.layout.some(item => item.game === game && item.name === name)) continue;
      stage = `${game}-${name}`; console.log(JSON.stringify({ stage }));
      const current = await context(viewport, 'az', game === 'flight' ? 30 : 40, game);
      if (name === 'safe-area') await current.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const style = document.createElement('style'); style.textContent = '.cg-screen{padding-top:47px!important;padding-bottom:34px!important}'; document.head.appendChild(style); }, { once: true }));
      const page = await open(current, game, game === 'flight' ? 30 : 40); if (game === 'flight') await page.locator('.cg-modal .cg-primary').click();
      await page.waitForTimeout(120);
      const measure = await page.evaluate(game => {
        const selectors = game === 'flight' ? '.flight-stage,.flight-controls' : '.parking-lot,.parking-dock';
        return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
          boxes: [...document.querySelectorAll(selectors)].map(el => { const b = el.getBoundingClientRect(); return { class: el.className, x: b.x, y: b.y, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; }) };
      }, game);
      assert(measure.scrollWidth <= viewport.width && measure.boxes.every(b => b.x >= 0 && b.y >= 0 && b.right <= viewport.width && b.bottom <= viewport.height), 'NEW_GAMES_LAYOUT_CLIPPED');
      await screenshot(page, stage); report.layout.push({ game, name, ...measure }); await current.close(); await checkpoint();
    }
  }
  if (!report.checks.includes('both-games-320px-iphone-safe-area-tablet-landscape')) report.checks.push('both-games-320px-iphone-safe-area-tablet-landscape');
  stage = '21-languages'; console.log(JSON.stringify({ stage }));
  for (const language of languages) {
    if (report.languages.includes(language)) continue;
    for (const game of ['flight', 'parking']) {
      const current = await context({ width: 390, height: 844 }, language, 1, game), page = await open(current, game, 1, true);
      const screen = page.getByTestId(game === 'flight' ? 'leaf-flight-screen' : 'parking-screen'), text = await screen.innerText();
      assert(await screen.getAttribute('lang') === language && !/undefined|\{(?:count|level)\}/.test(text), 'NEW_GAMES_LANGUAGE_PLACEHOLDER');
      if (language !== 'az') assert(!text.includes('Səviyyə') && !text.includes('Yüksəl') && !text.includes('Maşınlar'), 'NEW_GAMES_AZ_LANGUAGE_LEAK');
      if (language === 'ar') { assert(await screen.getAttribute('dir') === 'rtl', 'NEW_GAMES_RTL_MISSING'); await screenshot(page, `arabic-${game}`); }
      await current.close();
    }
    report.languages.push(language); await checkpoint(); console.log(JSON.stringify({ language, passed: true }));
  }
  report.checks.push('42-real-hub-opens-in-21-offline-languages'); assert(errors.length === 0, 'NEW_GAMES_UNHANDLED_BROWSER_ERROR'); report.passed = true; report.finishedAt = new Date().toISOString();
} catch (error) {
  report.error = String(error.message).split('\n')[0]; report.stage = stage; report.browserErrors = errors; process.exitCode = 1;
  if (lastPage && !lastPage.isClosed()) await screenshot(lastPage, 'failure').catch(() => {});
} finally {
  await writeFile(join(temp, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, stage: report.stage, error: report.error, checks: report.checks.length, languages: report.languages.length, screenshots: report.screenshots.length }));
  await browser.close(); server.httpServer.closeAllConnections?.(); await new Promise(resolve => server.httpServer.close(resolve));
}

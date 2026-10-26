import { chromium } from '@playwright/test';
import { build as buildVite, createServer, preview } from 'vite';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const production = process.argv[2] === '--production';
if (process.argv.length !== (production ? 3 : 2)) throw new Error('WORD_GARDEN_BROWSER_ARGUMENT_INVALID');
const directory = '/var/folders/63/23_9ghpd0zl_sty24xn_r_t80000gn/T/opencode/anacan-word-garden';
await mkdir(directory, { recursive: true });
process.env.VITE_NATIVE_BUILD = 'true';
const bundled = await build({ stdin: { contents: 'export {generateGardenLevel,validateGardenLevel} from "./src/components/games/word-garden/generator.ts"; export {compileLexicon} from "./src/components/games/word-garden/lexicon.ts";',
  resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const engine = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const library = JSON.parse(await readFile(join(root, 'src/components/games/word-garden/data/az.json'), 'utf8'));
const lexicon = engine.compileLexicon(library, 'az');
const report = { at: new Date().toISOString(), passed: false, productionBundle: production, checks: [], screenshots: [] };
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const output = join(root, 'azure-migration/word-garden-verification/preview');
if (production) {
  await buildVite({ root, mode: 'google', logLevel: 'error', build: { outDir: output, emptyOutDir: true,
    rollupOptions: { input: join(root, 'scripts/word-garden/preview.html') } } });
}
const server = production ? await preview({ root, mode: 'google', build: { outDir: output },
  preview: { host: '127.0.0.1', port: 5181, strictPort: true } })
  : await createServer({ root, mode: 'google', optimizeDeps: { entries: ['scripts/word-garden/preview.html'] },
    server: { host: '127.0.0.1', port: 5181, strictPort: true }, logLevel: 'error' });
let browser;
let stage = 'server', lastPage;
try {
  console.log(JSON.stringify({ stage }));
  if (!production) await server.listen();
  stage = 'browser'; console.log(JSON.stringify({ stage }));
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const pageUrl = 'http://127.0.0.1:5181/scripts/word-garden/preview.html';
  async function context(viewport, seed) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.addInitScript(({ seed, revision }) => {
      localStorage.setItem('anacan-user-store', JSON.stringify({ state: { language: 'az', hasSeenIntro: true, hasSelectedLanguage: true }, version: 0 }));
      if (seed) localStorage.setItem(`anacan_word_garden_v1:az:${revision}:calm`, JSON.stringify(seed));
    }, { seed, revision: library.revision });
    await context.route('**/*', route => {
      if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
      return route.fulfill({ status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"error":"acceptance-network-blocked"}' });
    });
    return context;
  }
  function seedProfile(level) {
    return { schema: 'anacan-word-garden-profile-v1', language: 'az', revision: library.revision, mode: 'calm', round: null,
      progress: { unlockedLevel: level, coins: 75, totalWords: 0, totalBonusWords: 0, bestScore: 0, levels: {}, bonusClaims: { level, words: [] } } };
  }
  async function screenshot(page, name) {
    const path = join(directory, name + '.png');
    await page.screenshot({ path, timeout: 15000 }); report.screenshots.push(path);
  }
  async function layout(page) {
    return page.evaluate(() => {
      const screen = document.querySelector('.wg-screen'), shell = document.querySelector('.wg-game-shell');
      const boxes = [...document.querySelectorAll('.wg-letter, .wg-game-tools, .wg-crossword, .wg-board-panel, .wg-input-panel')].map(node => {
        const box = node.getBoundingClientRect(); return { name: node.className, x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      });
      const cells = [...document.querySelectorAll('.wg-cell')].map(node => node.getBoundingClientRect().width);
      return { screenWidth: screen?.clientWidth, viewport: { width: innerWidth, height: innerHeight }, scrollWidth: document.documentElement.scrollWidth,
        shellHeight: shell?.clientHeight, minimumCellWidth: Math.min(...cells), boxes };
    });
  }
  async function drawWord(page, word) {
    const positions = await page.locator('[data-letter-index]').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect(); return { index: Number(node.dataset.letterIndex), letter: node.dataset.letter, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }));
    const used = new Set();
    const points = [...word].map(letter => {
      const found = positions.find(value => value.letter === letter && !used.has(value.index));
      assert(found, 'BROWSER_WORD_LETTER_MISSING'); used.add(found.index); return found;
    });
    await page.mouse.move(points[0].x, points[0].y); await page.mouse.down();
    for (const point of points.slice(1)) await page.mouse.move(point.x, point.y, { steps: 10 });
    await page.mouse.up();
  }
  async function touchWord(page, word) {
    const positions = await page.locator('[data-letter-index]').evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect(); return { index: Number(node.dataset.letterIndex), letter: node.dataset.letter, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }));
    const used = new Set(), points = [...word].map(letter => {
      const point = positions.find(value => value.letter === letter && !used.has(value.index));
      assert(point, 'BROWSER_TOUCH_LETTER_MISSING'); used.add(point.index); return point;
    });
    const client = await page.context().newCDPSession(page);
    const send = (type, point) => client.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ x: point.x, y: point.y, id: 1 }] : [] });
    try {
      await send('touchStart', points[0]);
      for (let index = 1; index < points.length; index++) for (let step = 1; step <= 10; step++) {
        await send('touchMove', { x: points[index - 1].x + (points[index].x - points[index - 1].x) * step / 10,
          y: points[index - 1].y + (points[index].y - points[index - 1].y) * step / 10 });
      }
      await send('touchEnd');
    } finally { await client.detach(); }
  }
  const mobile = await context({ width: 390, height: 844 });
  const page = await mobile.newPage();
  lastPage = page;
  page.setDefaultTimeout(20000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  stage = 'menu'; console.log(JSON.stringify({ stage }));
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByRole('heading', { name: 'Söz bağı' }).waitFor();
  await screenshot(page, 'menu-mobile');
  stage = 'first-game'; console.log(JSON.stringify({ stage }));
  await page.getByRole('button', { name: /Oyna/ }).click(); await page.getByTestId('wordgarden-wheel').waitFor();
  await screenshot(page, 'game-mobile');
  const firstLevel = engine.generateGardenLevel(lexicon, 1);
  stage = 'pointer-game'; console.log(JSON.stringify({ stage, words: firstLevel.words.map(word => word.word) }));
  for (const word of firstLevel.words) { await drawWord(page, word.word); console.log(JSON.stringify({ stage, word: word.word })); }
  await page.getByRole('heading', { name: 'Bağın çiçəkləndi!' }).waitFor();
  const progress = await page.evaluate(revision => JSON.parse(localStorage.getItem(`anacan_word_garden_v1:az:${revision}:calm`)).progress, library.revision);
  assert(progress.unlockedLevel === 2 && progress.coins === 125, 'BROWSER_DRAG_COMPLETION_FAILED');
  await screenshot(page, 'win-mobile'); report.checks.push('real-pointer-crossword-completion-and-reward');
  await page.getByRole('button', { name: 'Növbəti səviyyə' }).click();
  await page.getByRole('heading', { name: 'Səviyyə 2' }).waitFor();
  await page.getByTestId('wordgarden-wheel').waitFor();
  const secondLevel = engine.generateGardenLevel(lexicon, 2);
  assert(!firstLevel.words.some(word => secondLevel.words.some(answer => answer.word === word.word)), 'BROWSER_ADJACENT_PUZZLE_REPEATED');
  await page.getByRole('button', { name: /1 nömrəli söz/ }).click();
  assert(await page.locator('.wg-cell.is-focused').count() === secondLevel.words[0].letters.length, 'BROWSER_WORD_FOCUS_FAILED');
  assert(await page.locator('[data-garden-cell][data-revealed="true"]').count() === 0, 'BROWSER_FOCUS_REVEALED_ANSWER');
  report.checks.push('answer-focus-and-distinct-next-puzzle');
  await touchWord(page, secondLevel.words[0].word);
  assert(await page.evaluate(({ revision, word }) => JSON.parse(localStorage.getItem(`anacan_word_garden_v1:az:${revision}:calm`)).round.found.includes(word),
    { revision: library.revision, word: secondLevel.words[0].word }), 'BROWSER_TOUCH_WORD_NOT_ACCEPTED');
  report.checks.push('native-touch-drag-and-repeated-letter-input');
  await page.getByRole('button', { name: 'Oyun parametrləri' }).click();
  await page.getByRole('button', { name: 'Ulduzlu gecə' }).click();
  await page.getByRole('switch', { name: 'Daha aydın görünüş' }).click();
  await screenshot(page, 'settings-mobile');
  await page.keyboard.press('Escape');
  assert(await page.locator('.wg-screen').evaluate(node => node.classList.contains('wg-theme-night') && node.classList.contains('wg-high-contrast')), 'BROWSER_SETTINGS_NOT_APPLIED');
  await page.reload(); await page.getByRole('button', { name: /Oyuna davam et/ }).click();
  await page.getByTestId('wordgarden-wheel').waitFor();
  assert(await page.locator('.wg-screen').evaluate(node => node.classList.contains('wg-theme-night')), 'BROWSER_SETTINGS_NOT_PERSISTED');
  const halfPlayed = await page.evaluate(revision => JSON.parse(localStorage.getItem(`anacan_word_garden_v1:az:${revision}:calm`)).round.found, library.revision);
  assert(halfPlayed.includes(secondLevel.words[0].word), 'BROWSER_HALF_PLAYED_ROUND_NOT_RESTORED');
  report.checks.push('settings-persist-reload-and-resume');
  await mobile.close();
  stage = 'short-timer'; console.log(JSON.stringify({ stage }));
  const timed = await context({ width: 390, height: 844 });
  const timedPage = await timed.newPage(); lastPage = timedPage; timedPage.setDefaultTimeout(20000);
  timedPage.on('pageerror', error => errors.push(error.message));
  await timedPage.goto(pageUrl); await timedPage.getByRole('button', { name: 'Vaxtlı' }).click();
  await timedPage.getByRole('button', { name: /Oyna/ }).click(); await timedPage.getByRole('button', { name: 'Oyuna başla' }).waitFor();
  const remaining = () => timedPage.evaluate(revision => JSON.parse(localStorage.getItem(`anacan_word_garden_v1:az:${revision}:timed`)).round.remainingSeconds, library.revision);
  const initialTime = await remaining(); assert(initialTime >= 25 && initialTime <= 35, 'BROWSER_INITIAL_TIMER_TOO_LONG');
  await timedPage.waitForTimeout(600); assert(await remaining() === initialTime, 'BROWSER_TIMER_RAN_BEFORE_START');
  await screenshot(timedPage, 'timed-ready');
  await timedPage.getByRole('button', { name: 'Oyuna başla' }).click();
  await timedPage.waitForTimeout(700); assert(await remaining() < initialTime, 'BROWSER_TIMER_NOT_RUNNING');
  await timedPage.getByRole('button', { name: /Fasilə/ }).click();
  const pausedTime = await remaining(); await timedPage.waitForTimeout(600);
  assert(await remaining() === pausedTime, 'BROWSER_PAUSED_TIMER_CHANGED');
  await timedPage.getByRole('button', { name: 'Oyuna davam et' }).click();
  const timedLevel = engine.generateGardenLevel(lexicon, 1, 'timed');
  for (const answer of timedLevel.words) await touchWord(timedPage, answer.word);
  await timedPage.getByRole('heading', { name: 'Bağın çiçəkləndi!' }).waitFor();
  await screenshot(timedPage, 'timed-win'); report.checks.push('short-timer-ready-pause-and-real-touch-win');
  await timed.close();
  stage = 'mini-games-hub'; console.log(JSON.stringify({ stage }));
  const hub = await context({ width: 390, height: 844 });
  const hubPage = await hub.newPage(); lastPage = hubPage; hubPage.setDefaultTimeout(20000);
  hubPage.on('pageerror', error => errors.push(error.message));
  await hubPage.goto(pageUrl + '?hub', { waitUntil: 'domcontentloaded' });
  await hubPage.locator('[data-game-id="word-garden"]').click();
  await hubPage.getByRole('heading', { name: 'Söz bağı' }).waitFor();
  await hubPage.getByRole('button', { name: 'Geri' }).click();
  const card = hubPage.locator('[data-game-id="word-garden"]');
  await card.waitFor();
  await hubPage.waitForFunction(() => {
    const card = document.querySelector('[data-game-id="word-garden"]');
    if (!card) return false;
    for (let node = card; node; node = node.parentElement) if (Number(getComputedStyle(node).opacity) < .9) return false;
    return true;
  });
  await screenshot(hubPage, 'hub-mobile');
  await card.click(); await hubPage.getByRole('button', { name: /Oyna/ }).click();
  await hubPage.getByTestId('wordgarden-wheel').waitFor();
  report.checks.push('real-mini-games-hub-open-return-reopen');
  await hub.close();
  for (const [name, viewport, level] of [
    ['small-mobile', { width: 320, height: 568 }, 1], ['small-late-level', { width: 320, height: 568 }, 221],
    ['late-level', { width: 390, height: 844 }, 221], ['iphone-safe-area', { width: 428, height: 926 }, 221],
    ['tablet', { width: 768, height: 1024 }, 41], ['desktop', { width: 1440, height: 900 }, 25],
    ['landscape', { width: 844, height: 390 }, 221],
  ]) {
    const current = await context(viewport, seedProfile(level));
    const page = await current.newPage();
    if (name === 'iphone-safe-area') await page.addInitScript(() => {
      const install = () => { const style = document.createElement('style'); style.textContent = '.wg-screen{padding-top:47px!important;padding-bottom:34px!important}'; document.head.appendChild(style); };
      if (document.head) install(); else document.addEventListener('DOMContentLoaded', install, { once: true });
    });
    lastPage = page; page.setDefaultTimeout(20000);
    stage = name; console.log(JSON.stringify({ stage }));
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pageUrl); await page.getByRole('button', { name: /Oyna/ }).click();
    await page.getByTestId('wordgarden-wheel').waitFor(); await page.waitForTimeout(150);
    const measure = await layout(page);
    assert(measure.scrollWidth <= viewport.width, 'BROWSER_HORIZONTAL_OVERFLOW');
    assert(measure.boxes.filter(box => box.name.includes('wg-letter')).every(box => box.width >= 44 && box.height >= 44), 'BROWSER_TOUCH_TARGET_TOO_SMALL');
    assert(measure.boxes.every(box => box.x >= 0 && box.right <= viewport.width && box.y >= 0 && box.bottom <= viewport.height), 'BROWSER_GAME_LAYOUT_CLIPPED');
    assert(measure.minimumCellWidth >= (viewport.height < 610 && viewport.width < 600 ? 17 : 22), 'BROWSER_BOARD_CELLS_TOO_SMALL');
    await screenshot(page, name); report.checks.push({ name, viewport, level, layout: measure });
    console.log(JSON.stringify({ stage: name, passed: true }));
    await current.close();
  }
  assert(errors.length === 0, 'BROWSER_UNHANDLED_GAME_ERROR');
  report.passed = true;
  report.finishedAt = new Date().toISOString();
} catch (error) {
  report.error = String(error.message).split('\n')[0];
  report.stage = stage;
  if (lastPage && !lastPage.isClosed()) {
    const path = join(directory, 'failure.png');
    await lastPage.screenshot({ path, timeout: 15000 }).then(() => report.screenshots.push(path)).catch(() => {});
    report.diagnostic = await lastPage.evaluate(() => ({ title: document.title, text: document.body.textContent?.slice(0, 500) })).catch(() => null);
  }
  process.exitCode = 1;
} finally {
  await writeFile(join(directory, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, productionBundle: production, error: report.error,
    stage: report.stage, checks: report.checks.length, screenshots: report.screenshots.length }));
  await Promise.race([browser?.close(), new Promise(resolve => { const timer = setTimeout(resolve, 5000); timer.unref(); })]);
  if (production) {
    server.httpServer.closeAllConnections?.();
    await new Promise(resolve => server.httpServer.close(resolve));
  } else await server.close();
}

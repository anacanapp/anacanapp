import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';

const artifacts = fileURLToPath(new URL('../artifacts/', import.meta.url));
type ButtonInfo = { x: number; y: number; width: number; height: number; disabled: boolean; text: string };
type State = {
  ready: boolean; view: string; route: string; coins: number; doors_completed: number;
  completed_stations: number; station: string; save_ok: boolean; modal: boolean;
  route_progress: Record<string, number>; upgrades: Record<string, number>;
  owned: string[]; equipped: Record<string, string>; stats: { power: number; size: number; speed: number };
  settings: Record<string, boolean>; buttons: Record<string, ButtonInfo>;
  world: { kind: string; meshes: number; rigged_commuters: number; player: {x: number; y: number; z: number}; doors_open: number };
  session: { mode: string; time: number; initial_time: number; progress: number; combo: number;
    best_combo: number;
    energy: number; door: number; doors: number; bonus_seconds: number; reward: number; taps: number;
    obstacle: { lane: number }; };
};

async function state(page: Page): Promise<State> {
  return page.evaluate(() => (window as any).__metroState);
}
async function load(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__metroState?.ready, null, { timeout: 90000 });
  await page.waitForTimeout(350);
}
async function clickCanvas(page: Page, id: string) {
  let button = (await state(page)).buttons[id];
  if (!button || button.disabled) {
    await page.waitForFunction(id => {
      const button = (window as any).__metroState?.buttons[id];
      return button && !button.disabled;
    }, id, { timeout: 15000 });
    button = (await state(page)).buttons[id];
  }
  const viewport = page.viewportSize()!;
  if (button.y + button.height / 2 >= viewport.height - 65 && !id.startsWith('nav:') && !['tap', 'burst', 'start'].includes(id) && !id.startsWith('lane:')) {
    const delta = button.y + button.height / 2 - viewport.height + 220;
    await page.mouse.move(viewport.width * 0.6, viewport.height * 0.55);
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(350);
  }
  const position = (await state(page)).buttons[id];
  const x = position.x + position.width / 2;
  const y = position.y + position.height / 2;
  expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(viewport.width);
  expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(viewport.height);
  await page.touchscreen.tap(x, y);
  if (id !== 'tap' && id !== 'burst' && !id.startsWith('lane:')) await page.waitForTimeout(200);
}
async function accessibleAction(page: Page, id: string) {
  await page.locator(`#game-controls button[data-action="${id}"]`).dispatchEvent('click');
  if (!['tap', 'burst'].includes(id) && !id.startsWith('lane:')) await page.waitForTimeout(150);
}
async function winDoor(page: Page) {
  await page.waitForFunction(() => (window as any).__metroState?.session.mode === 'playing', null, { timeout: 15000 });
  // Check actual touchscreen input, then continue through the screen-reader
  // button callback at a stable cadence without per-tap protocol round trips.
  for (let taps = 0; taps < 2; taps++) {
    const current = await state(page);
    if (current.session.mode !== 'playing') break;
    const button = current.buttons.tap;
    await page.touchscreen.tap(button.x + button.width / 2, button.y + button.height / 2);
    await page.waitForTimeout(130);
  }
  await page.evaluate(async () => {
    const game = window as any;
    for (let index = 0; index < 100 && game.__metroState.session.mode === 'playing'; index++) {
      const session = game.__metroState.session;
      game.metroAction(`lane:${(session.obstacle.lane + 1) % 3}`);
      if (session.energy >= 60 && !game.__metroState.buttons.burst.disabled) game.metroAction('burst');
      game.metroAction('tap');
      await new Promise(resolve => setTimeout(resolve, 175));
    }
  });
  await expect.poll(async () => (await state(page)).session.mode, { timeout: 1500 }).toBe('won');
  await expect.poll(async () => (await state(page)).session.reward).toBeGreaterThan(0);
}

test('real mobile TAP clears three doors, earns currency, buys visible gear, restores progress', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /ERROR:|SCRIPT ERROR|SHADER ERROR/.test(message.text())) errors.push(message.text()); });
  await load(page);
  expect((await state(page)).world.kind).toBe('native_3d');
  expect((await state(page)).world.rigged_commuters).toBeGreaterThanOrEqual(20);
  expect((await state(page)).world.meshes).toBeLessThan(700);
  expect((await state(page)).coins).toBe(0);
  await page.screenshot({ path: join(artifacts, 'metro-mobile-home.png') });
  await clickCanvas(page, 'start');
  const startZ = (await state(page)).world.player.z;
  await winDoor(page);
  let current = await state(page);
  expect(current.session.bonus_seconds).toBe(3);
  expect(current.doors_completed).toBe(1);
  expect(current.session.best_combo).toBeGreaterThan(2);
  expect(current.route_progress.green).toBe(0);
  expect(current.world.player.z).toBeLessThan(startZ);
  await page.screenshot({ path: join(artifacts, 'metro-mobile-first-door.png') });
  await clickCanvas(page, 'next');
  await winDoor(page);
  await clickCanvas(page, 'next');
  await winDoor(page);
  current = await state(page);
  expect(current.doors_completed).toBe(3);
  expect(current.completed_stations).toBe(1);
  expect(current.route_progress.green).toBe(1);
  expect(current.coins).toBeGreaterThanOrEqual(380);
  await clickCanvas(page, 'result-shop');
  await expect.poll(async () => (await state(page)).view).toBe('shop');
  await clickCanvas(page, 'buy:strength');
  await expect.poll(async () => (await state(page)).upgrades.strength).toBe(1);
  expect((await state(page)).stats.power).toBeGreaterThan(8);
  expect((await state(page)).stats.size).toBeGreaterThan(1);
  await clickCanvas(page, 'filter:clothing');
  await clickCanvas(page, 'buy:helmet');
  await expect.poll(async () => (await state(page)).equipped.head).toBe('helmet');
  await clickCanvas(page, 'nav:profile');
  await page.screenshot({ path: join(artifacts, 'metro-mobile-wardrobe.png') });
  current = await state(page);
  const coins = current.coins;
  await page.reload();
  await page.waitForFunction(() => (window as any).__metroState?.ready, null, { timeout: 90000 });
  await expect.poll(async () => (await state(page)).coins).toBe(coins);
  current = await state(page);
  expect(current.upgrades.strength).toBe(1);
  expect(current.equipped.head).toBe('helmet');
  expect(current.route_progress.green).toBe(1);
  expect(current.doors_completed).toBe(3);
  expect(current.save_ok).toBe(true);
  await clickCanvas(page, 'start');
  await expect.poll(async () => (await state(page)).session.mode).toBe('playing');
  await clickCanvas(page, 'pause');
  const frozen = (await state(page)).session.time;
  await page.waitForTimeout(1300);
  expect((await state(page)).session.time).toBeCloseTo(frozen, 4);
  await page.screenshot({ path: join(artifacts, 'metro-mobile-play.png') });
  await clickCanvas(page, 'resume');
  await winDoor(page);
  expect(errors).toEqual([]);
});

test('door deadline loses honestly, retry works, navigation preserves a won door', async ({ page }) => {
  await load(page);
  await clickCanvas(page, 'start');
  await expect.poll(async () => (await state(page)).session.mode).toBe('playing');
  await expect.poll(async () => (await state(page)).session.mode, { timeout: 15000 }).toBe('lost');
  expect((await state(page)).coins).toBe(0);
  expect((await state(page)).session.time).toBe(0);
  await page.screenshot({ path: join(artifacts, 'metro-mobile-missed-train.png') });
  await clickCanvas(page, 'retry');
  await winDoor(page);
  const reward = (await state(page)).coins;
  await clickCanvas(page, 'result-shop');
  await clickCanvas(page, 'nav:home');
  await clickCanvas(page, 'start');
  expect((await state(page)).session.mode).toBe('won');
  expect((await state(page)).coins).toBe(reward);
  await clickCanvas(page, 'next');
  expect((await state(page)).session.door).toBe(1);
});

test('all Baku routes show the correct station locks, accessible controls and saved settings', async ({ page }) => {
  await load(page);
  await clickCanvas(page, 'nav:map');
  let current = await state(page);
  expect(Object.keys(current.buttons).filter(key => key.startsWith('station:'))).toHaveLength(18);
  expect(current.buttons['station:0'].disabled).toBe(false);
  expect(current.buttons['station:17'].disabled).toBe(true);
  await clickCanvas(page, 'route:red');
  await expect.poll(async () => (await state(page)).route).toBe('red');
  expect(Object.keys((await state(page)).buttons).filter(key => key.startsWith('station:'))).toHaveLength(12);
  await accessibleAction(page, 'route:purple');
  await expect.poll(async () => (await state(page)).route).toBe('purple');
  await page.screenshot({ path: join(artifacts, 'metro-mobile-map.png') });
  await accessibleAction(page, 'route:shuttle');
  await expect.poll(async () => (await state(page)).route).toBe('shuttle');
  expect((await state(page)).station).toBe('Cəfər Cabbarlı');
  await accessibleAction(page, 'route:depot');
  await expect.poll(async () => (await state(page)).route).toBe('depot');
  expect((await state(page)).station).toBe('Bakmil');
  await clickCanvas(page, 'nav:settings');
  await clickCanvas(page, 'setting:sound');
  await clickCanvas(page, 'setting:reduced_motion');
  await clickCanvas(page, 'tutorial');
  await expect.poll(async () => (await state(page)).modal).toBe(true);
  await clickCanvas(page, 'close-help');
  await page.reload();
  await page.waitForFunction(() => (window as any).__metroState?.ready, null, { timeout: 90000 });
  expect((await state(page)).settings.sound).toBe(false);
  expect((await state(page)).settings.reduced_motion).toBe(true);
  expect((await state(page)).route).toBe('depot');
});

test('responsive Godot canvas and reachable controls at phone, tablet, desktop and landscape sizes', async ({ page }) => {
  test.setTimeout(150000);
  await load(page);
  for (const viewport of [{ width: 320, height: 700 }, { width: 360, height: 800 }, { width: 430, height: 932 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }, { width: 932, height: 430 }]) {
    const currentView = await state(page);
    if (!currentView.buttons['nav:home']) await accessibleAction(page, currentView.buttons.leave ? 'leave' : 'result-shop');
    await accessibleAction(page, 'nav:home');
    await page.setViewportSize(viewport);
    await page.waitForFunction(width => (window as any).__metroState?.viewport.width === width, viewport.width, { timeout: 15000 });
    await page.waitForTimeout(400);
    await expect.poll(async () => (await state(page)).view).toBe('home');
    const layout = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, inner: innerWidth, rect: document.querySelector('canvas')!.getBoundingClientRect().toJSON() }));
    expect(layout.width).toBeLessThanOrEqual(layout.inner);
    expect(layout.rect.width).toBeCloseTo(viewport.width, 0);
    await accessibleAction(page, 'start');
    await page.waitForTimeout(250);
    if ((await state(page)).session.mode === 'paused') await accessibleAction(page, 'resume');
    await expect.poll(async () => (await state(page)).session.mode).toBe('playing');
    await clickCanvas(page, 'pause');
    const current = await state(page);
    for (const id of ['tap', 'burst', 'lane:0', 'lane:1', 'lane:2', 'pause', 'resume']) {
      const button = current.buttons[id];
      expect(button.x, `${viewport.width} ${id} x`).toBeGreaterThanOrEqual(0);
      expect(button.y, `${viewport.width} ${id} y`).toBeGreaterThanOrEqual(0);
      expect(button.x + button.width, `${viewport.width} ${id} right`).toBeLessThanOrEqual(viewport.width + 1);
      expect(button.y + button.height, `${viewport.width} ${id} bottom`).toBeLessThanOrEqual(viewport.height + 1);
    }
    const stats = await sharp(await page.locator('canvas').screenshot()).stats();
    expect(stats.channels.some(channel => channel.stdev > 20)).toBe(true);
    await page.screenshot({ path: join(artifacts, `metro-layout-${viewport.width}x${viewport.height}.png`) });
  }
});

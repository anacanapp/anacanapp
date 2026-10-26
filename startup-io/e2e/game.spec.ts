import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

async function start(page: Page) {
  await page.goto('/?e2e=1');
  await page.getByTestId('play').click();
  if (await page.getByTestId('tutorial-start').isVisible()) await page.getByTestId('tutorial-start').click();
  await expect(page.getByTestId('game-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(window.__startupio)), { timeout: 30000 }).toBe(true);
  await expect(page.getByTestId('pause')).toBeVisible();
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__startupio!.game.started), { timeout: 30000 }).toBe(true);
  await page.keyboard.up('ArrowRight');
}

async function steer(page: Page, pointerId = 101, x = 110, y = 390, dx = 45, dy = 0) {
  await page.getByTestId('joystick').evaluate((element, values) => {
    element.dispatchEvent(new PointerEvent('pointerdown', { pointerId: values.pointerId, pointerType: 'touch', clientX: values.x, clientY: values.y, bubbles: true }));
    element.dispatchEvent(new PointerEvent('pointermove', { pointerId: values.pointerId, pointerType: 'touch', clientX: values.x + values.dx, clientY: values.y + values.dy, bubbles: true }));
  }, { pointerId, x, y, dx, dy });
}

test('name, free logo, custom color and tutorial persist locally', async ({ page }) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1') && !request.url().startsWith('data:')) external.push(request.url()); });
  await page.goto('/');
  await expect(page.getByTestId('open-levels')).toHaveCount(0);
  await page.getByTestId('nav-customize').click();
  await page.getByLabel('Startupının adı', { exact: true }).fill('Nova AI');
  await page.getByRole('button', { name: 'Sənin rəngin #66d5ff', exact: true }).click();
  await page.getByRole('button', { name: 'Seç Disrupt', exact: true }).click();
  await page.reload();
  await page.getByTestId('nav-customize').click();
  await expect(page.getByLabel('Startupının adı', { exact: true })).toHaveValue('Nova AI');
  await expect(page.getByRole('button', { name: 'Sənin rəngin #66d5ff', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Seç Disrupt', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Arenaya hazıram', exact: true }).click();
  await page.getByTestId('play').click();
  await expect(page.getByRole('dialog')).toContainText('İstənilən yerə toxun və sürüklə');
  await page.getByTestId('tutorial-start').click();
  await expect(page.getByTestId('game-screen')).toBeVisible();
  expect(external).toEqual([]);
});

test('floating touch steering, second-finger boost and background pause', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  const original = await page.evaluate(() => window.__startupio!.game.player.x);
  await steer(page);
  await expect(page.locator('.floating-stick.active')).toBeVisible();
  const joystick = await page.locator('.floating-stick').boundingBox();
  expect(joystick!.width).toBeGreaterThan(140); expect(joystick!.y).toBeLessThan(400);
  await expect.poll(() => page.evaluate(() => window.__startupio!.game.player.x), { timeout: 15000 }).toBeGreaterThan(original + 15);
  await page.getByTestId('joystick').dispatchEvent('pointerdown', { pointerId: 102, pointerType: 'touch', clientX: 250, clientY: 430 });
  await expect.poll(() => page.evaluate(() => window.__startupio!.game.energy), { timeout: 15000 }).toBeLessThan(100);
  await page.getByTestId('joystick').dispatchEvent('pointerup', { pointerId: 102 });
  await page.getByTestId('joystick').dispatchEvent('pointerup', { pointerId: 101 });
  await expect(page.locator('.floating-stick.active')).toHaveCount(0);
  await page.getByTestId('pause').click(); await expect(page.getByTestId('pause-dialog')).toBeVisible();
  const paused = await page.evaluate(() => window.__startupio!.game.elapsed);
  await page.waitForTimeout(250); expect(await page.evaluate(() => window.__startupio!.game.elapsed)).toBe(paused);
  await page.getByTestId('resume').click();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('pause-dialog')).toBeVisible();
  expect(errors).toEqual([]);
});

test('growth passes old caps and saves an endless company for resume', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const game = window.__startupio!.game; game.player.mass = 199; game.player.radius = 47;
    const pickup = game.pickups[0]; pickup.alive = true; pickup.spec = game.specs[0]; pickup.x = game.player.x; pickup.y = game.player.y; game.grid.insert(pickup);
  });
  await expect.poll(() => page.evaluate(() => window.__startupio!.game.player.mass)).toBeGreaterThan(200);
  await expect(page.getByTestId('result-dialog')).toHaveCount(0);
  await page.getByTestId('pause').click(); await page.getByTestId('save-exit').click();
  await expect(page.getByTestId('play')).toContainText('Davam et');
  const mass = await page.evaluate(() => JSON.parse(localStorage.getItem('startup.io.progress.v1')!).activeRun.player.mass);
  await page.reload(); await page.getByTestId('play').click();
  await expect.poll(() => page.evaluate(() => window.__startupio?.game.player.mass)).toBe(mass);
  await expect(page.getByTestId('timer')).toHaveCount(0);
});

test('Nimvale rival ends the run and retry keeps the earned wallet', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const game = window.__startupio!.game; game.shield = 0;
    for (const bot of game.bots) { bot.alive = false; bot.respawnAt = Number.MAX_VALUE; }
    const rival = game.bots[7]; rival.x = game.player.x; rival.y = game.player.y; rival.alive = true; rival.mass = 250;
    rival.radius = 12 + 6.4 * 250 ** .32; rival.ai.direction = { x: 0, y: 0 }; rival.ai.nextDecision = Number.MAX_VALUE; rival.ai.speed = 0;
  });
  await expect(page.getByTestId('result-dialog')).toContainText('Nimvale AI', { timeout: 15000 });
  await page.getByTestId('result-primary').click();
  await expect(page.getByTestId('result-dialog')).not.toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__startupio!.game.stats.peakMass)).toBe(10);
});

test('marketplace charges once, rejects unaffordable items and equips a bought logo', async ({ page }) => {
  await page.goto('/?e2e=1');
  await page.getByTestId('nav-marketplace').click();
  await page.getByTestId('shop-lotus').click(); await page.getByTestId('purchase-item').click();
  await expect(page.getByTestId('wallet')).toContainText('70');
  await page.getByTestId('shop-lotus').click(); await page.getByTestId('purchase-item').click();
  await expect(page.getByTestId('wallet')).toContainText('70');
  await page.getByTestId('shop-unicorn').click(); await page.getByTestId('purchase-item').click();
  await expect(page.getByRole('status')).toContainText('Xalın çatmır');
  await page.getByRole('button', { name: 'Bağla', exact: true }).click();
  await page.reload(); await page.getByTestId('play').click(); await page.getByTestId('tutorial-start').click();
  await expect.poll(() => page.evaluate(() => window.__startupio?.game.player.logo)).toBe('lotus');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('startup.io.progress.v1')!).credits)).toBe(70);
});

test('own image logo is decoded, resized and restored in the arena', async ({ page }) => {
  await page.goto('/?e2e=1'); await page.getByTestId('nav-customize').click();
  await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('../public/icon-192.png', import.meta.url)));
  await expect(page.locator('.studio-preview .custom-logo-image')).toBeVisible();
  await page.getByRole('button', { name: 'Arenaya hazıram', exact: true }).click();
  await page.getByTestId('play').click(); await page.getByTestId('tutorial-start').click();
  await expect.poll(() => page.evaluate(() => window.__startupio?.game.player.logo)).toBe('custom');
  const image = await page.evaluate(() => window.__startupio!.game.look.customImage);
  expect(image).toMatch(/^data:image\/png;base64,/); expect(image!.length).toBeLessThan(150000);
});

test('real steering collects funding and save-exit banks credits without ending the run', async ({ page }) => {
  await start(page);
  const direction = await page.evaluate(() => {
    const game = window.__startupio!.game;
    const target = game.pickups.filter(item => item.alive && item.spec.kind === 'investment').sort((a, b) => Math.hypot(a.x - game.player.x, a.y - game.player.y) - Math.hypot(b.x - game.player.x, b.y - game.player.y))[0];
    const x = (target.x - game.player.x - target.y + game.player.y) * Math.sqrt(3) / 2;
    const y = (target.x - game.player.x + target.y - game.player.y) * .52;
    const length = Math.hypot(x, y); return { dx: x / length * 45, dy: y / length * 45 };
  });
  await steer(page, 101, 110, 390, direction.dx, direction.dy);
  await expect.poll(() => page.evaluate(() => window.__startupio!.game.snapshot().credits)).toBeGreaterThan(0);
  await page.getByTestId('joystick').dispatchEvent('pointerup', { pointerId: 101 });
  const credits = await page.evaluate(() => window.__startupio!.game.snapshot().credits);
  expect(credits).toBeGreaterThan(0);
  await page.getByTestId('pause').click();
  await page.getByTestId('save-exit').click();
  await expect(page.getByTestId('wallet')).toContainText(String(250 + credits));
  await expect(page.getByTestId('play')).toContainText('Davam et');
});

test('Phaser owns the rendered 2.5D scene and reports bounded sprites across reloads', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  await expect(page.locator('.phaser-host canvas')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__startupio!.metrics().frames)).toBeGreaterThan(5);
  const metrics = await page.evaluate(() => window.__startupio!.metrics());
  expect(metrics.engine).toBe('Phaser 3.90.0'); expect(['WebGL', 'Canvas']).toContain(metrics.renderer);
  expect(metrics.sprites).toBeGreaterThan(100); expect(metrics.sprites).toBeLessThan(5000);
  await page.getByTestId('pause').click(); await page.getByTestId('save-exit').click();
  await expect(page.locator('.phaser-host canvas')).toHaveCount(0);
  await page.getByTestId('play').click(); await expect(page.locator('.phaser-host canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('phones and landscape keep launch visible and the center of the arena unobstructed', async ({ page }) => {
  test.setTimeout(180000);
  for (const size of [{ width: 320, height: 568, native: false, en: false }, { width: 390, height: 664, native: false, en: false }, { width: 390, height: 844, native: false, en: false }, { width: 844, height: 390, native: false, en: false }, { width: 402, height: 874, native: true, en: false }, { width: 402, height: 874, native: true, en: true }]) {
    await page.setViewportSize(size); await page.goto('/?e2e=1');
    if (size.native) await page.addStyleTag({ content: ':root { --safe-area-inset-top: 62px; --safe-area-inset-bottom: 34px; }' });
    if (size.en) { await page.getByTestId('settings').click(); await page.getByRole('button', { name: 'EN', exact: true }).click(); await page.getByRole('button', { name: 'Close', exact: true }).click(); }
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const play = await page.getByTestId('play').boundingBox(); const nav = await page.locator('.main-nav').boundingBox();
    if (size.height > size.width) {
      expect(play!.y + play!.height).toBeLessThanOrEqual(nav!.y);
      const profile = await page.getByTestId('open-customize').boundingBox(); const mode = await page.locator('.endless-mode-card').boundingBox();
      expect(profile!.y + profile!.height).toBeLessThanOrEqual(mode!.y);
    }
    await page.getByTestId('play').click();
    if (await page.getByTestId('tutorial-start').isVisible()) await page.getByTestId('tutorial-start').click();
    for (const control of [page.getByTestId('joystick'), page.getByTestId('boost'), page.getByTestId('pause')]) {
      const box = await control.boundingBox(); expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1); expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1);
    }
    if (size.native) {
      expect((await page.getByTestId('pause').boundingBox())!.y).toBeGreaterThanOrEqual(62);
      expect((await page.getByTestId('boost').boundingBox())!.y + (await page.getByTestId('boost').boundingBox())!.height).toBeLessThanOrEqual(size.height - 34);
    }
    expect(await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.className)).toBe('steering-surface');
  }
});

test('distant exploration streams a finite scene and keeps long-time play alive', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page);
  const first = await page.evaluate(() => [...window.__startupio!.game.world.chunks.keys()]);
  await page.evaluate(() => {
    const game = window.__startupio!.game;
    game.player.x += 200000; game.player.y -= 250000;
    game.elapsed = 36000; game.shield = 8;
  });
  await page.waitForTimeout(300);
  const scene = await page.evaluate(() => ({
    keys: [...window.__startupio!.game.world.chunks.keys()], count: window.__startupio!.game.world.activeCount,
    origin: window.__startupio!.game.world.originX.toString(), state: window.__startupio!.game.status,
  }));
  expect(scene.origin).not.toBe('0'); expect(scene.count).toBeLessThanOrEqual(81);
  expect(scene.keys.every(key => !first.includes(key))).toBe(true); expect(scene.state).toBe('playing');
  await expect(page.getByTestId('timer')).toHaveCount(0); await expect(page.getByTestId('open-levels')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('autosaved credits do not repeat across resume and new-company creation', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const game = window.__startupio!.game;
    game.stats.investments = 20; game.elapsed = 9;
  });
  await page.waitForTimeout(300);
  await page.getByTestId('pause').click(); await page.getByTestId('save-exit').click();
  await expect(page.getByTestId('wallet')).toContainText('355');
  await page.getByTestId('play').click(); await page.getByTestId('pause').click(); await page.getByTestId('save-exit').click();
  await expect(page.getByTestId('wallet')).toContainText('355');
  await page.getByRole('button', { name: 'Yeni startup', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yeni startup', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__startupio?.game.player.mass)).toBe(10);
});

test('venture fund collision grows the brand, grants protection and survives resume', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const game = window.__startupio!.game;
    game.market.opportunities.push({ id: 100, kind: 'fund', fund: 'series-a', x: game.player.x, y: game.player.y, radius: 15, value: 50, alive: true, expires: game.elapsed + 50 });
  });
  await page.waitForFunction(() => {
    const game = window.__startupio!.game;
    if (game.stats.funds !== 1) return false;
    game.pause(); return true;
  });
  await expect(page.getByTestId('pause-dialog')).toBeVisible();
  await expect(page.locator('.active-powers .power-firewall')).toBeVisible();
  const mass = await page.evaluate(() => window.__startupio!.game.player.mass); expect(mass).toBeGreaterThan(50);
  await page.getByTestId('save-exit').click();
  await page.getByTestId('play').click();
  await page.waitForFunction(() => {
    const game = window.__startupio?.game;
    if (!game || game.stats.funds !== 1) return false;
    game.pause(); return true;
  });
  await expect(page.locator('.active-powers .power-firewall')).toBeVisible();
});

test('PIVOT works through the native-facing control and enters a cooldown', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Pivot — qaçış sipəri', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__startupio!.game.snapshot().pivotCooldown)).toBeGreaterThan(20);
  await expect(page.getByRole('button', { name: 'Pivot — qaçış sipəri', exact: true })).toBeDisabled();
});

test('takeover warning gives a player a visible PIVOT escape window', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    const game = window.__startupio!.game; game.shield = 0; game.player.protectedUntil = 0; game.player.vx = game.player.vy = 0;
    for (const bot of game.bots) { bot.alive = false; bot.respawnAt = Number.MAX_VALUE; }
    const rival = game.bots[7]; rival.x = game.player.x; rival.y = game.player.y; rival.alive = true; rival.mass = 250; rival.vx = rival.vy = 0;
    rival.radius = 12 + 6.4 * 250 ** .32; rival.ai.direction = { x: 0, y: 0 }; rival.ai.nextDecision = Number.MAX_VALUE;
  });
  await expect(page.getByTestId('takeover-warning')).toContainText('Satınalma təhlükəsi');
  await page.getByRole('button', { name: 'Pivot — qaçış sipəri', exact: true }).click();
  await expect(page.getByTestId('takeover-warning')).not.toBeVisible();
  await expect(page.getByTestId('result-dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__startupio!.game.snapshot().pivotCooldown)).toBeGreaterThan(20);
});

test('store-facing privacy/support and local progress deletion are accessible', async ({ page }) => {
  await page.goto('/'); await page.getByTestId('settings').click();
  await page.getByRole('button', { name: 'Məxfilik', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Məlumatların cihazında qalır');
  await expect(page.getByRole('dialog').getByRole('link')).toHaveAttribute('href', 'mailto:jamil@anacan.az');
  await page.getByRole('button', { name: 'Bağla', exact: true }).click();
  await page.getByTestId('settings').click(); await page.getByRole('button', { name: 'Bütün gedişatı sil', exact: true }).click();
  await page.getByRole('button', { name: 'Sil və yenidən başla', exact: true }).click();
  await expect(page.getByTestId('wallet')).toContainText('250');
});

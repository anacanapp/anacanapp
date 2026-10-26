import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-webgl'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (/METRO_READY|SCRIPT ERROR|ERROR:/.test(message.text())) console.log(message.text());
  });
  await page.goto('http://127.0.0.1:5179');
  await page.waitForFunction(() => window.__metroState?.ready, null, { timeout: 90000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(root, 'artifacts/metro-desktop-home.png') });
  console.log(JSON.stringify(await page.evaluate(() => window.__metroState)));
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: join(root, 'artifacts/metro-mobile-home.png') });
  const button = await page.evaluate(() => window.__metroState.buttons.start);
  await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(root, 'artifacts/metro-mobile-play.png') });
  console.log(JSON.stringify({ errors, state: await page.evaluate(() => window.__metroState) }));
} finally { await browser.close(); }

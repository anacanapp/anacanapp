import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, 'artifacts', 'character-source'); await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ acceptDownloads: true });
  const game = process.argv[2] ?? 'universal-base-characters';
  if (!['universal-base-characters', 'universal-animation-library'].includes(game)) throw new Error('Unexpected character package');
  await page.goto(`https://quaternius.itch.io/${game}/purchase`);
  await page.getByText('No thanks, just take me to the downloads', { exact: true }).click();
  const rows = page.locator('.upload'); await rows.first().waitFor({ timeout: 30000 });
  const row = rows.filter({ hasText: '[Standard]' }).first();
  const downloading = page.waitForEvent('download', { timeout: 120000 }); await row.getByRole('link', { name: /Download/i }).click();
  const download = await downloading; await download.saveAs(join(directory, `${game}.zip`));
  if (await download.failure()) throw new Error('Character download failed');
  console.log(`${game}: downloaded official free Standard CC0 package`);
} finally { await browser.close(); }

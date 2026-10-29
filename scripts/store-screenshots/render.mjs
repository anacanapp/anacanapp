// Renders App Store screenshots (1290×2796, iPhone 6.7") from template.html and copy/<lang>.json.
// Usage: node scripts/store-screenshots/render.mjs <lang> [outDir]
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const lang = process.argv[2] || 'az';
const out = resolve(process.argv[3] || join(here, 'out', lang));
// Real app screens captured by capture.sh (390x863 each); without them the HTML mock screens are used.
const shots = process.env.SHOTS_DIR ? pathToFileURL(resolve(process.env.SHOTS_DIR)).href : null;
const copy = JSON.parse(readFileSync(join(here, 'copy', `${lang}.json`), 'utf8'));
const ORDER = ['hero', 'pregnancy', 'ai', 'flow', 'mommy', 'tools', 'community', 'partner', 'toolsGrid'];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  // CHROMIUM_PATH: use a preinstalled browser when the project's Playwright has none downloaded.
  executablePath: process.env.CHROMIUM_PATH || undefined,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, ignoreHTTPSErrors: true });
await page.addInitScript(([c, s]) => { window.COPY = c; window.SHOTS = s; }, [copy, shots]);
for (const [i, id] of ORDER.entries()) {
  await page.goto(`${pathToFileURL(join(here, 'template.html'))}?slide=${id}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  const file = join(out, `${String(i + 1).padStart(2, '0')}-${id}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}
await browser.close();

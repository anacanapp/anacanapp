// Renders store screenshots from template.html and copy/<lang>.json.
// FORMAT=ios (default): App Store 1290×2796 (iPhone 6.7"), into out/<lang>.
// FORMAT=android: Google Play 1080×1920 phone slides plus the 1024×500 feature graphic, into out-android/<lang>.
// Usage: [FORMAT=android] node scripts/store-screenshots/render.mjs <lang> [outDir]
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const lang = process.argv[2] || 'az';
const FORMAT = process.env.FORMAT || 'ios';
const out = resolve(process.argv[3] || join(here, FORMAT === 'android' ? 'out-android' : 'out', lang));
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
const VIEWPORTS = {
  ios: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 },
  android: { viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5 },
  feature: { viewport: { width: 512, height: 250 }, deviceScaleFactor: 2 },
};
const jobs = ORDER.map((id, i) => ({ format: FORMAT, query: `slide=${id}`, name: `${String(i + 1).padStart(2, '0')}-${id}.png` }));
if (FORMAT === 'android') jobs.push({ format: 'feature', query: '', name: 'feature-graphic.png' });
for (const job of jobs) {
  const page = await browser.newPage({ ...VIEWPORTS[job.format], ignoreHTTPSErrors: true });
  await page.addInitScript(([c, s]) => { window.COPY = c; window.SHOTS = s; }, [copy, shots]);
  await page.goto(`${pathToFileURL(join(here, 'template.html'))}?format=${job.format}&${job.query}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
  await page.waitForLoadState('networkidle');
  const file = join(out, job.name);
  await page.screenshot({ path: file });
  await page.close();
  console.log(file);
}
await browser.close();

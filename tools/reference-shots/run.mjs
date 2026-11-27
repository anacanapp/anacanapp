#!/usr/bin/env node
// Reference screenshots of the React/Capacitor consumer app for the Flutter parity port.
// Usage: node tools/reference-shots/run.mjs [--scenario a,b] [--persona p] [--lang az,en] [--theme light]
//        [--viewport 390x844] [--run name] [--workers 4] [--dpr 3] [--fonts auto|cached|fallback] [--list]
// See docs/flutter/REFERENCE_SHOTS.md.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startDevServer } from './lib/server.mjs';
import { loadPersona, makeContext } from './lib/fixtures.mjs';
import { MockBackend, installNetwork } from './lib/network.mjs';
import { setupContext, buildSession, FROZEN_TIME } from './lib/page-setup.mjs';
import { createHelpers, trackRequests } from './lib/helpers.mjs';

const HERE = new URL('.', import.meta.url).pathname;

export const VIEWPORTS = {
  '390x844': { width: 390, height: 844, platform: 'ios',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' },
  '360x800': { width: 360, height: 800, platform: 'android',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36' },
};
export const THEMES = ['light', 'dark'];
export const DETERMINISM_FLAGS = ['--force-color-profile=srgb', '--disable-lcd-text', '--font-render-hinting=none', '--disable-partial-raster',
  '--disable-gpu-rasterization', '--disable-checker-imaging', '--disable-threaded-animation', '--disable-threaded-scrolling',
  '--disable-image-animation-resync', '--num-raster-threads=1'];
export const LANGS = ['az', 'en', 'ru', 'ar'];
const LOCALES = { az: 'az-AZ', en: 'en-US', ru: 'ru-RU', ar: 'ar' };

function parseArgs(argv) {
  const args = { workers: 4, dpr: 3, fonts: 'auto', platform: 'native' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, inline] = a.slice(2).split('=');
    const v = inline ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true');
    args[k] = v;
  }
  const list = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : null);
  return {
    scenario: list(args.scenario), persona: list(args.persona), lang: list(args.lang) || LANGS,
    theme: list(args.theme) || THEMES, viewport: list(args.viewport) || Object.keys(VIEWPORTS),
    run: args.run, workers: Number(args.workers), dpr: Number(args.dpr), fonts: args.fonts,
    listOnly: args.list === 'true', retries: Number(args.retries ?? 1), verbose: args.verbose === 'true',
    port: args.port ? Number(args.port) : undefined, platform: args.platform, chromeFlags: args['chrome-flags'] || 'default',
  };
}

function loadPlaywright() {
  // Prefer the globally provisioned Playwright (its browsers are installed); fall back to the repo copy.
  const tries = [process.env.PLAYWRIGHT_MODULE, '/x.js', import.meta.url].filter(Boolean);
  for (const base of tries) {
    try {
      const req = createRequire(base.startsWith('file:') || base.startsWith('/') ? base : pathToFileURL(base).href);
      const pw = req('playwright');
      if (existsSync(pw.chromium.executablePath())) return pw;
    } catch { /* next */ }
  }
  throw new Error('playwright with an installed Chromium not found (set PLAYWRIGHT_MODULE)');
}

async function loadScenarios() {
  const dir = join(HERE, 'scenarios');
  const out = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    const items = Array.isArray(mod.default) ? mod.default : [mod.default];
    for (const s of items) out.push({ ...s, file: f });
  }
  const ids = new Set();
  for (const s of out) { if (ids.has(s.id)) throw new Error(`duplicate scenario id ${s.id}`); ids.add(s.id); }
  return out;
}

class Recorder {
  constructor() { this.entries = new Map(); this.byScenario = new Map(); }
  add(e) {
    const key = [e.kind, e.method, e.path, e.query ?? '', JSON.stringify(e.unsupported ?? e.args ?? '')].join(' ');
    const prev = this.entries.get(key);
    if (prev) { prev.count++; prev.scenarios.add(e.scenario); prev.personas.add(e.persona); }
    else this.entries.set(key, { ...e, count: 1, scenarios: new Set([e.scenario]), personas: new Set([e.persona]) });
    if (e.kind !== 'write' && e.kind !== 'filter') {
      const sk = `${e.persona}|${e.scenario}`;
      this.byScenario.set(sk, (this.byScenario.get(sk) || new Set()).add(key));
    }
  }
  countFor(scenario, persona) { return this.byScenario.get(`${persona}|${scenario}`)?.size ?? 0; }
  toJSON() {
    return [...this.entries.values()].map(({ scenario, persona, ...e }) => ({ ...e, scenarios: [...e.scenarios].sort(), personas: [...e.personas].sort() }))
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path));
  }
}

async function runCell(browser, origin, { scenario, persona, cell }, ctx) {
  const vp = VIEWPORTS[cell.viewport];
  const nowMs = Date.parse(FROZEN_TIME);
  const { session, user } = buildSession(persona, nowMs);
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: ctx.args.dpr, isMobile: true, hasTouch: true,
    userAgent: vp.userAgent, colorScheme: cell.theme, reducedMotion: 'reduce', locale: LOCALES[cell.lang],
    timezoneId: 'Asia/Baku', serviceWorkers: 'block',
    // An established user has allowed notifications; otherwise the web fallback shows a permission toast.
    permissions: persona.signedIn ? ['notifications'] : [],
  });
  const fixtureCtx = makeContext(persona, nowMs);
  const mock = new MockBackend({ persona, ctx: fixtureCtx, session, user, recorder: ctx.recorder, scenarioId: scenario.id });
  await setupContext(context, { persona, lang: cell.lang, theme: cell.theme, nowMs, session, platform: ctx.args.platform === 'web' ? 'web' : vp.platform });
  await installNetwork(context, mock, { appOrigin: origin, fontMode: ctx.args.fonts });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e.message).slice(0, 300)));
  const net = trackRequests(page);
  const h = createHelpers(page, { outDir: ctx.outDir, cell, scenario, persona, recorder: ctx.recorder, results: ctx.results, log: ctx.log, net });
  try {
    await page.goto(origin + (scenario.path || '/'), { waitUntil: 'domcontentloaded', timeout: 90000 });
    if (scenario.waitFor) await page.locator(scenario.waitFor).first().waitFor({ timeout: 60000 });
    else await page.waitForFunction(() => document.getElementById('root')?.childElementCount > 0, null, { timeout: 60000 });
    await scenario.steps(page, h);
    return { ok: true, consoleErrors };
  } catch (error) {
    const rel = join('_errors', cell.viewport, cell.theme, cell.lang, `${scenario.id}.png`);
    mkdirSync(join(ctx.outDir, '_errors', cell.viewport, cell.theme, cell.lang), { recursive: true });
    await page.screenshot({ path: join(ctx.outDir, rel) }).catch(() => {});
    return { ok: false, error: String(error.message || error).split('\n')[0].slice(0, 300), errorShot: rel, consoleErrors };
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scenarios = (await loadScenarios()).filter((s) => {
    if (args.scenario && !args.scenario.some((p) => s.id === p || (p.endsWith('*') && s.id.startsWith(p.slice(0, -1))))) return false;
    if (args.persona && !args.persona.includes(s.persona)) return false;
    return true;
  });
  const jobs = [];
  for (const s of scenarios) {
    const langs = s.langs ? args.lang.filter((l) => s.langs.includes(l)) : args.lang;
    const themes = s.themes ? args.theme.filter((t) => s.themes.includes(t)) : args.theme;
    for (const viewport of args.viewport) for (const theme of themes) for (const lang of langs) {
      jobs.push({ scenario: s, cell: { viewport, theme, lang } });
    }
  }
  if (args.listOnly) {
    for (const s of scenarios) console.log(`${s.id.padEnd(40)} ${s.persona.padEnd(16)} ${s.file}`);
    console.log(`${scenarios.length} scenarios, ${jobs.length} cells`);
    return;
  }
  if (!jobs.length) { console.error('nothing to run'); process.exit(2); }

  const runName = args.run || new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const outDir = join(HERE, 'out', runName);
  mkdirSync(outDir, { recursive: true });
  const log = (m) => console.log(m);
  const recorder = new Recorder();
  const results = [];
  const failures = [];
  const personas = new Map();
  const persona = (name) => { if (!personas.has(name)) personas.set(name, loadPersona(name)); return personas.get(name); };

  const t0 = Date.now();
  const server = await startDevServer({ log, port: args.port });
  const { chromium } = loadPlaywright();
  // sRGB output always; `--chrome-flags det` adds the raster-determinism flags (measured: no improvement, see docs).
  const browser = await chromium.launch({ args: args.chromeFlags === 'det' ? DETERMINISM_FLAGS : ['--force-color-profile=srgb'] });
  const ctx = { args, outDir, recorder, results, log, browserVersion: browser.version() };
  log(`${jobs.length} cells (${scenarios.length} scenarios) -> ${outDir}`);

  let next = 0, done = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const label = `${job.scenario.id} [${job.cell.viewport} ${job.cell.theme} ${job.cell.lang}]`;
      let res;
      for (let attempt = 0; attempt <= args.retries; attempt++) {
        const local = []; // shots of this attempt only; kept when the cell succeeds
        res = await runCell(browser, server.origin, { ...job, persona: persona(job.scenario.persona) }, { ...ctx, results: local });
        if (res.ok) { results.push(...local); break; }
        log(`  ✗ ${label}: ${res.error}${attempt < args.retries ? ' (retrying)' : ''}`);
      }
      done++;
      if (!res.ok) failures.push({ scenario: job.scenario.id, persona: job.scenario.persona, ...job.cell, error: res.error, errorShot: res.errorShot, pageErrors: res.consoleErrors });
      if (args.verbose && res.consoleErrors?.length) log(`  page errors: ${res.consoleErrors.join(' | ')}`);
      log(`[${done}/${jobs.length}] ${label} ${res.ok ? 'ok' : 'FAILED'}`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(args.workers, jobs.length)) }, worker));
  await browser.close();
  server.stop();

  results.sort((a, b) => a.file.localeCompare(b.file));
  const index = {
    schema: 'anacan-reference-shots-v1', run: runName, createdAt: new Date().toISOString(), frozenTime: FROZEN_TIME,
    renderer: { engine: 'chromium', version: ctx.browserVersion, deviceScaleFactor: args.dpr, fonts: args.fonts },
    viewports: Object.fromEntries(args.viewport.map((v) => [v, { ...VIEWPORTS[v], deviceScaleFactor: args.dpr }])),
    shots: results, failures, durationSec: Math.round((Date.now() - t0) / 1000),
  };
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(index, null, 2));
  writeFileSync(join(outDir, 'unmocked.json'), JSON.stringify(recorder.toJSON(), null, 2));
  log(`\n${results.length} shots, ${failures.length} failed cells, ${recorder.entries.size} distinct unmocked/logged requests, ${index.durationSec}s`);
  log(`index: ${join(outDir, 'index.json')}`);
  if (failures.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

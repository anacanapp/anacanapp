#!/usr/bin/env node
/**
 * Anacan Recap demo videos — rendered by the app's own renderer (src/lib/recap) in headless Chromium,
 * frame by frame (deterministic, not real time), then muxed with the music by ffmpeg.
 *
 *   node scripts/recap/render-demo.mjs --out <dir> --music <music.mp3> [--persona mommy,bump,flow] [--lang az] [--fps 30]
 *
 * Output per persona: recap-<persona>.mp4 (1080×1920, H.264 high/yuv420p, AAC, faststart) and
 * recap-<persona>-sheet.jpg (12-frame contact sheet). Nunito is downloaded once into <out>/.fonts
 * (the app loads the same family from Google Fonts). Nothing is written into the repository.
 */
import { build } from 'esbuild';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') ? 'true' : all[i + 1] ?? 'true']] : acc), []));
const OUT = resolve(args.out || join(ROOT, 'scratch', 'recap-out'));
const MUSIC = args.music ? resolve(args.music) : null;
const PERSONAS = (args.persona || 'mommy,bump,flow').split(',');
const LANG = args.lang || 'az';
const FPS = Number(args.fps || 30);
const ONLY = args.frames ? args.frames.split(',').map(Number) : null; // debug: render stills only
mkdirSync(OUT, { recursive: true });

async function fonts() {
  const dir = join(OUT, '.fonts');
  mkdirSync(dir, { recursive: true });
  const cssPath = join(dir, 'nunito.css');
  if (!existsSync(cssPath)) {
    const res = await fetch('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=block', {
      headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' },
    });
    if (!res.ok) throw new Error(`Google Fonts CSS ${res.status}`);
    writeFileSync(cssPath, await res.text());
  }
  let css = readFileSync(cssPath, 'utf8');
  const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
  for (const url of urls) {
    const file = join(dir, url.split('/').pop());
    if (!existsSync(file)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`font ${res.status}`);
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    }
    css = css.split(url).join(`data:font/woff2;base64,${readFileSync(file).toString('base64')}`);
  }
  return css;
}

async function bundle() {
  const result = await build({
    entryPoints: [join(ROOT, 'scripts/recap/demo-entry.ts')],
    bundle: true, write: false, format: 'iife', platform: 'browser', target: 'chrome110',
    alias: { '@': join(ROOT, 'src') }, loader: { '.json': 'json' }, logLevel: 'warning',
  });
  return result.outputFiles[0].text;
}

const dataUrl = (p) => `data:image/png;base64,${readFileSync(join(ROOT, p)).toString('base64')}`;
const dictFor = (lang) => {
  const file = ['az', 'en'].includes(lang) ? join(ROOT, `src/locales/${lang}.json`) : join(ROOT, `scripts/i18n/${lang}.seed.json`);
  const all = JSON.parse(readFileSync(file, 'utf8'));
  return Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('recap_')));
};

function ffmpeg(argv, input) {
  const p = spawn('ffmpeg', argv, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => p.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg ${code}`)))));
  return { stdin: p.stdin, done };
}

const write = (stream, buf) => new Promise((res) => (stream.write(buf) ? res() : stream.once('drain', res)));

async function main() {
  const { chromium } = require('playwright');
  const [css, js] = await Promise.all([fonts(), bundle()]);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css} html,body{margin:0;background:#000}</style></head>
<body><canvas id="c" width="1080" height="1920"></canvas><div style="font-family:Nunito;font-weight:900;position:absolute;opacity:0">Aə</div><script>${js}</script></body></html>`;
  const launchArgs = ['--disable-gpu-vsync', '--force-color-profile=srgb'];
  const browser = await chromium.launch({ args: launchArgs }).catch(() => {
    // The pre-installed browser may belong to another Playwright revision: use whichever Chromium is there.
    const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', join(process.env.HOME || '', '.cache/ms-playwright')].filter(Boolean);
    for (const root of roots) {
      if (!existsSync(root)) continue;
      for (const dir of readdirSync(root).sort().reverse()) {
        for (const rel of ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux64/chrome', 'chrome-linux/chrome']) {
          const exe = join(root, dir, rel);
          if (existsSync(exe)) return chromium.launch({ args: launchArgs, executablePath: process.env.RECAP_CHROMIUM || exe });
        }
      }
    }
    throw new Error('No Chromium found (set RECAP_CHROMIUM)');
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('page error:', e));
  await page.setContent(html, { waitUntil: 'load' });

  for (const persona of PERSONAS) {
    const info = await page.evaluate((o) => window.recapDemo.setup(o), {
      persona, language: LANG, dict: dictFor(LANG), logoWhite: dataUrl('public/brand-mark-white.png'), logoCoral: dataUrl('public/brand-mark-coral.png'),
    });
    if (!info.fontOk) throw new Error('Nunito did not load');
    const total = Math.round(info.duration * FPS);
    console.log(`${persona}: ${info.duration.toFixed(2)} s, ${total} frames, scenes: ${info.scenes.map((s) => `${s.id}@${s.start.toFixed(1)}`).join(' ')}`);
    const name = `recap-${persona}${LANG === 'az' ? '' : `-${LANG}`}`;

    if (args['sheets-only']) { makeSheet(join(OUT, `${name}.mp4`), join(OUT, `${name}-sheet.jpg`), info); continue; }
    if (ONLY) {
      const stills = await page.evaluate((ts) => window.recapDemo.frames(ts, 'image/png'), ONLY);
      stills.forEach((b64, i) => writeFileSync(join(OUT, `${name}-t${ONLY[i]}.png`), Buffer.from(b64, 'base64')));
      continue;
    }

    const mp4 = join(OUT, `${name}.mp4`);
    const audio = MUSIC ? ['-i', MUSIC] : ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo'];
    const fadeD = Math.max(0.5, info.duration - info.fadeStart);
    const enc = ffmpeg([
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', ...audio,
      '-map', '0:v', '-map', '1:a', '-t', info.duration.toFixed(3),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-maxrate', '10M', '-bufsize', '20M', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-af', `afade=t=out:st=${info.fadeStart.toFixed(2)}:d=${fadeD.toFixed(2)}`,
      '-movflags', '+faststart', mp4,
    ]);
    const batch = 15;
    const started = Date.now();
    for (let f = 0; f < total; f += batch) {
      const times = Array.from({ length: Math.min(batch, total - f) }, (_, i) => (f + i) / FPS);
      const frames = await page.evaluate((ts) => window.recapDemo.frames(ts, 'image/jpeg', 0.96), times);
      for (const b64 of frames) await write(enc.stdin, Buffer.from(b64, 'base64'));
      if ((f / batch) % 20 === 0) process.stdout.write(`  ${persona} ${Math.round((f / total) * 100)}% (${((Date.now() - started) / 1000).toFixed(0)} s)\r`);
    }
    enc.stdin.end();
    await enc.done;
    console.log(`  ${persona} → ${mp4} (${((Date.now() - started) / 1000).toFixed(0)} s)`);

    makeSheet(mp4, join(OUT, `${name}-sheet.jpg`), info);
  }
  await browser.close();
}

/** Contact sheet, 4×3: every scene once it is fully built (75 % in), plus the confetti hit, padded to 12. */
function makeSheet(mp4, sheet, info) {
  const times = info.scenes.map((sc) => sc.start + (sc.end - sc.start) * 0.75);
  const peak = info.scenes.find((sc) => sc.kind === 'peak');
  if (peak) times.push(peak.start + 2.6);
  while (times.length < 12) times.push(info.duration * (times.length / 12));
  const picked = times.slice(0, 12).sort((a, b) => a - b);
  {
    const fps = Number(args.fps || 30);
    const sel = [...new Set(picked.map((t) => Math.round(t * fps)))].map((n) => `eq(n\\,${n})`).join('+');
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf', `select='${sel}',scale=360:640,tile=4x3:padding=8:margin=8:color=white`, '-frames:v', '1', '-q:v', '3', sheet]);
    if (r.status !== 0) console.error(String(r.stderr));
    else console.log(`  sheet → ${sheet}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

// Google Fonts (Inter, Nunito, Plus Jakarta Sans imported by src/index.css and stories.css) are served from
// tools/reference-shots/.cache/fonts/ (gitignored). On a cache miss in `auto` mode the file is fetched once with
// curl (which honours the environment's HTTPS proxy) using a desktop-Chrome User-Agent, so the CSS points at
// woff2 files; later runs are fully offline. `--fonts=fallback` serves empty CSS instead (system fallback fonts),
// which is NOT parity-grade and is recorded as such in index.json.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const FONT_CACHE = new URL('../.cache/fonts/', import.meta.url).pathname;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const memo = new Map();
function cachePath(url) {
  const key = createHash('sha256').update(url.href).digest('hex').slice(0, 24);
  const ext = url.hostname === 'fonts.googleapis.com' ? 'css' : (url.pathname.split('.').pop() || 'bin');
  return join(FONT_CACHE, `${key}.${ext}`);
}

function fetchOnce(url, file) {
  mkdirSync(FONT_CACHE, { recursive: true });
  execFileSync('curl', ['-sSfL', '--max-time', '30', '-A', UA, '-o', file, url.href], { stdio: ['ignore', 'ignore', 'pipe'] });
}

export async function serveFont(url, mode = 'auto', recorder) {
  const isCss = url.hostname === 'fonts.googleapis.com';
  const headers = { 'access-control-allow-origin': '*', 'content-type': isCss ? 'text/css; charset=utf-8' : 'font/woff2' };
  if (mode === 'fallback') return { status: 200, headers, body: isCss ? '/* fonts disabled (--fonts=fallback) */' : '' };
  const file = cachePath(url);
  if (memo.has(file)) return { status: 200, headers, body: memo.get(file) };
  if (!existsSync(file)) {
    if (mode !== 'auto') {
      recorder?.add({ kind: 'font-miss', method: 'GET', path: url.href });
      return { status: 200, headers, body: isCss ? '' : Buffer.alloc(0) };
    }
    try { fetchOnce(url, file); } catch (error) {
      recorder?.add({ kind: 'font-miss', method: 'GET', path: url.href, error: String(error.stderr || error).slice(0, 200) });
      return { status: 200, headers, body: isCss ? '' : Buffer.alloc(0) };
    }
  }
  const body = readFileSync(file);
  memo.set(file, body);
  return { status: 200, headers, body };
}

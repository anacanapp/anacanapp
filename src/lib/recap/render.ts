/**
 * renderRecapFrame — draws one 1080×1920 frame of the Anacan Recap video at time t (seconds).
 * Pure Canvas 2D: no DOM, no clock, no Math.random. The same function draws the in-app player,
 * the exported MP4 and the demo videos, so a frame at t is identical everywhere (given the same fonts).
 *
 * Safe areas: logo lockup top-centre (~120 px from the top), story segments under it,
 * all critical content inside the central 1080×1420 band (y 250–1670).
 */
import { clamp01, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, easeOutExpo, easeOutQuint, lerp, mix, prng, prog, rgba } from './anim';
import { formatRecapNumber } from './model';
import { RECAP_FONTS, type RecapFonts } from './fonts';
import { PACE, sentenceEnd, statPlan, tokenize } from './pace';
import type {
  ColdScene, GrowthScene, JourneyScene, MilestonesScene, OutroScene, PeakScene, PersonaScene, RecapModel, RecapScene, RecapStat, StatScene, SummaryScene,
} from './types';

export const RECAP_W = 1080;
export const RECAP_H = 1920;
export const RECAP_FPS = 30;
const CX = RECAP_W / 2;
const SAFE_X = 96;
const SAFE_W = RECAP_W - SAFE_X * 2;


type C2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface RecapAssets {
  /** White Anacan mark (for dark/saturated backgrounds). */
  logoWhite?: CanvasImageSource | null;
  /** Coral Anacan mark (for light backgrounds). */
  logoCoral?: CanvasImageSource | null;
  /** A small tile of noise, drawn as film grain. */
  grain?: CanvasImageSource | null;
  /** Font family lists per role; defaults to the brand fonts (Plus Jakarta Sans / Switzer / Inter). */
  fonts?: Partial<RecapFonts>;
}

const imgSize = (img: CanvasImageSource): [number, number] => {
  const i = img as { naturalWidth?: number; naturalHeight?: number; width?: number | { baseVal: { value: number } }; height?: number | { baseVal: { value: number } } };
  const w = i.naturalWidth || (typeof i.width === 'number' ? i.width : 1);
  const h = i.naturalHeight || (typeof i.height === 'number' ? i.height : 1);
  return [w || 1, h || 1];
};

/** Index of the scene playing at t. */
export function sceneIndexAt(model: RecapModel, t: number): number {
  for (let i = 0; i < model.scenes.length; i++) if (t < model.scenes[i].end) return i;
  return model.scenes.length - 1;
}

// ── Colours ───────────────────────────────────────────────────────────────────────────────────
const INK = { light: '#FFFFFF', dark: '#2B1520' };
const inkSoft = (s: RecapScene, a = 0.8) => (s.look.ink === 'light' ? rgba('#FFFFFF', a) : rgba('#2B1520', a * 0.92));
const pillFill = (s: RecapScene) => (s.look.ink === 'light' ? 'rgba(255,255,255,0.16)' : 'rgba(43,21,32,0.07)');
const CORAL = '#FF5A5F';
const GOLD = '#FFC977';

// ── Text ──────────────────────────────────────────────────────────────────────────────────────
interface Word { text: string; width: number }
interface Line { words: Word[]; width: number }
interface Layout { lines: Line[]; size: number; weight: number; space: number }

const fontOf = (weight: number, size: number, family: string) => `${weight} ${Math.round(size)}px ${family}`;

function layoutText(ctx: C2D, text: string, size: number, weight: number, maxW: number, family: string, cjk: boolean): Layout {
  ctx.font = fontOf(weight, size, family);
  const space = cjk ? 0 : ctx.measureText(' ').width;
  const lines: Line[] = [];
  for (const para of text.split('\n')) {
    let cur: Line = { words: [], width: 0 };
    for (const tok of tokenize(para, cjk)) {
      const w = ctx.measureText(tok).width;
      const next = cur.words.length ? cur.width + space + w : w;
      if (next > maxW && cur.words.length) { lines.push(cur); cur = { words: [{ text: tok, width: w }], width: w }; } else { cur.words.push({ text: tok, width: w }); cur.width = next; }
    }
    if (cur.words.length) lines.push(cur);
  }
  return { lines, size, weight, space };
}

/** Largest size (step 2 px) at which the text fits into maxLines lines and every word fits the width. */
function fitText(ctx: C2D, text: string, opts: { max: number; min: number; weight: number; maxW: number; maxLines: number; family: string; cjk: boolean }): Layout {
  let size = opts.max;
  for (; size > opts.min; size -= 2) {
    const lay = layoutText(ctx, text, size, opts.weight, opts.maxW, opts.family, opts.cjk);
    if (lay.lines.length <= opts.maxLines && lay.lines.every((l) => l.width <= opts.maxW + 0.5)) return lay;
  }
  return layoutText(ctx, text, opts.min, opts.weight, opts.maxW, opts.family, opts.cjk);
}

interface DrawTextOpts { color: string; lineH?: number; delay?: number; stagger?: number; rise?: number; rtl: boolean; family: string; shadow?: string | null; cx?: number }

/** Kinetic typography: each word rises and fades in, staggered. Returns the block height. */
function drawKinetic(ctx: C2D, lay: Layout, top: number, lt: number, o: DrawTextOpts): number {
  const lineH = o.lineH ?? lay.size * 1.18;
  const delay = o.delay ?? 0, stagger = o.stagger ?? PACE.stagger, rise = o.rise ?? 0.42;
  const cx = o.cx ?? CX;
  ctx.font = fontOf(lay.weight, lay.size, o.family);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  let idx = 0;
  lay.lines.forEach((line, li) => {
    const baseline = top + li * lineH + lay.size * 0.92;
    let x = o.rtl ? cx + line.width / 2 : cx - line.width / 2;
    for (const word of line.words) {
      const p = easeOutCubic(prog(lt, delay + idx * stagger, PACE.word));
      idx++;
      const wx = o.rtl ? x - word.width : x;
      if (p > 0.001) {
        ctx.save();
        ctx.globalAlpha *= p;
        if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4; }
        ctx.fillStyle = o.color;
        ctx.fillText(word.text, wx, baseline + (1 - p) * lay.size * rise);
        ctx.restore();
      }
      x = o.rtl ? x - word.width - lay.space : x + word.width + lay.space;
    }
  });
  return lay.lines.length * lineH;
}


function roundRect(ctx: C2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Centered pills that wrap to rows; each pops in. Returns the height used. */
function drawPills(ctx: C2D, s: RecapScene, texts: string[], top: number, lt: number, delay: number, family: string, opts: { size?: number; fill?: string; color?: string; weight?: number; gap?: number } = {}): number {
  if (!texts.length) return 0;
  const size = opts.size ?? 40, padX = size * 0.75, h = size * 1.9, gap = 16;
  ctx.font = fontOf(opts.weight ?? 600, size, family);
  const items = texts.map((t) => {
    let text = t;
    while (ctx.measureText(text).width + padX * 2 > SAFE_W && text.length > 4) text = `${text.slice(0, -2)}…`;
    return { text, w: ctx.measureText(text).width + padX * 2 };
  });
  const rows: Array<typeof items> = [[]];
  let rowW = 0;
  for (const it of items) {
    if (rowW + it.w + (rows[rows.length - 1].length ? gap : 0) > SAFE_W && rows[rows.length - 1].length) { rows.push([]); rowW = 0; }
    rowW += it.w + (rows[rows.length - 1].length ? gap : 0);
    rows[rows.length - 1].push(it);
  }
  let i = 0;
  rows.forEach((row, ri) => {
    const total = row.reduce((sum, it) => sum + it.w, 0) + gap * (row.length - 1);
    let x = CX - total / 2;
    const y = top + ri * (h + gap);
    for (const it of row) {
      const p = prog(lt, delay + i * (opts.gap ?? PACE.chipGap), PACE.pill);
      i++;
      if (p > 0) {
        const k = easeOutBack(p, 1.4);
        ctx.save();
        ctx.globalAlpha *= clamp01(p * 1.6);
        ctx.translate(x + it.w / 2, y + h / 2);
        ctx.scale(lerp(0.7, 1, k), lerp(0.7, 1, k));
        roundRect(ctx, -it.w / 2, -h / 2, it.w, h, h / 2);
        ctx.fillStyle = opts.fill ?? pillFill(s);
        ctx.fill();
        ctx.fillStyle = opts.color ?? (s.look.ink === 'light' ? '#FFFFFF' : INK.dark);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.text, 0, size * 0.06);
        ctx.restore();
      }
      x += it.w + gap;
    }
  });
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  return rows.length * h + (rows.length - 1) * gap;
}

// ── Shapes ────────────────────────────────────────────────────────────────────────────────────
function heartPath(ctx: C2D, x: number, y: number, size: number) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.95);
  ctx.bezierCurveTo(x - s * 1.25, y + s * 0.1, x - s * 1.0, y - s * 1.05, x, y - s * 0.42);
  ctx.bezierCurveTo(x + s * 1.0, y - s * 1.05, x + s * 1.25, y + s * 0.1, x, y + s * 0.95);
  ctx.closePath();
}

function sparklePath(ctx: C2D, x: number, y: number, r: number) {
  const k = r * 0.22;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + k, y - k, x + r, y);
  ctx.quadraticCurveTo(x + k, y + k, x, y + r);
  ctx.quadraticCurveTo(x - k, y + k, x - r, y);
  ctx.quadraticCurveTo(x - k, y - k, x, y - r);
  ctx.closePath();
}

function crescent(ctx: C2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - r * 2, y - r * 2, r * 4, r * 4);
  ctx.arc(x + r * 0.42, y - r * 0.28, r * 0.86, 0, Math.PI * 2, true);
  ctx.clip('evenodd');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function glow(ctx: C2D, x: number, y: number, r: number, color: string, alpha: number) {
  if (alpha <= 0.002 || r <= 1) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(0.45, rgba(color, alpha * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Music beat envelope: 1 on the beat, decaying. */
const beatPulse = (t: number, period: number) => Math.exp(-((t % period) / period) * 5);

// ── Background ────────────────────────────────────────────────────────────────────────────────
function drawBackground(ctx: C2D, s: RecapScene, t: number) {
  const [top, bottom, glowC] = s.look.bg;
  const lt = t - s.start;
  const g = ctx.createLinearGradient(0, 0, RECAP_W * 0.35, RECAP_H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, RECAP_W, RECAP_H);
  const r = prng(s.seed);
  const a = r() * Math.PI * 2, b = r() * Math.PI * 2;
  let warm = 0.32;
  if (s.kind === 'cold') warm = lerp(0.05, 0.55, easeInOutCubic(prog(lt, 0.3, 4.2)));
  glow(ctx, RECAP_W * (0.25 + 0.12 * Math.sin(t * 0.21 + a)), RECAP_H * (0.3 + 0.06 * Math.cos(t * 0.17 + b)), 820, glowC, warm);
  glow(ctx, RECAP_W * (0.8 + 0.1 * Math.cos(t * 0.19 + b)), RECAP_H * (0.78 + 0.05 * Math.sin(t * 0.23 + a)), 900, glowC, warm * 0.8);
  if (s.kind === 'cold') glow(ctx, CX, RECAP_H * 1.02, 1300, '#FF7A59', lerp(0, 0.75, easeInOutCubic(prog(lt, 0.2, 4.6))));
}

function drawAmbient(ctx: C2D, s: RecapScene, t: number) {
  const r = prng(0xa11ce ^ s.seed);
  const n = s.kind === 'cold' ? 34 : 18;
  const color = s.look.ink === 'light' ? (s.kind === 'cold' ? '#FFB59E' : '#FFFFFF') : s.look.accent;
  for (let i = 0; i < n; i++) {
    const x0 = r() * RECAP_W, y0 = r() * (RECAP_H + 300), speed = 18 + r() * 46, size = (s.kind === 'cold' ? 6 : 26) + r() * (s.kind === 'cold' ? 16 : 70);
    const ph = r() * 6.28, alpha = (s.kind === 'cold' ? 0.35 : 0.06) + r() * (s.kind === 'cold' ? 0.4 : 0.1);
    const y = ((y0 - t * speed) % (RECAP_H + 300) + RECAP_H + 300) % (RECAP_H + 300) - 150;
    const x = x0 + Math.sin(t * 0.6 + ph) * 30;
    const tw = 0.6 + 0.4 * Math.sin(t * 1.7 + ph);
    glow(ctx, x, y, size, color, alpha * tw * (s.look.ink === 'dark' ? 0.9 : 1));
  }
}

const grainPatterns = new WeakMap<object, CanvasPattern | null>();
function drawGrain(ctx: C2D, assets: RecapAssets, t: number) {
  if (!assets.grain) return;
  let pattern = grainPatterns.get(assets.grain as object);
  if (pattern === undefined) {
    try { pattern = ctx.createPattern(assets.grain, 'repeat'); } catch { pattern = null; }
    grainPatterns.set(assets.grain as object, pattern);
  }
  if (!pattern) return;
  // Film-like grain that changes 10× a second (cheap to encode, still alive).
  const frame = Math.floor(t * 10);
  const r = prng(frame * 7919 + 13);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.translate(-Math.floor(r() * 256), -Math.floor(r() * 256));
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, RECAP_W + 256, RECAP_H + 256);
  ctx.restore();
}

function drawVignette(ctx: C2D) {
  const g = ctx.createRadialGradient(CX, RECAP_H * 0.48, RECAP_H * 0.28, CX, RECAP_H * 0.5, RECAP_H * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(20,4,12,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, RECAP_W, RECAP_H);
}

// ── Chrome: logo lockup + story segments (always on top) ───────────────────────────────────────
function drawLockup(ctx: C2D, assets: RecapAssets, ink: 'light' | 'dark', cy: number, markH: number, family: string, alpha: number) {
  if (alpha <= 0.001) return;
  const mark = ink === 'light' ? assets.logoWhite ?? assets.logoCoral : assets.logoCoral ?? assets.logoWhite;
  const textSize = markH * 0.78;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = fontOf(700, textSize, family);
  const wordW = ctx.measureText('Anacan').width;
  let markW = 0;
  if (mark) { const [w, h] = imgSize(mark); markW = (markH * w) / h; }
  const gap = mark ? markH * 0.22 : 0;
  const x0 = CX - (markW + gap + wordW) / 2;
  if (mark) {
    ctx.shadowColor = ink === 'light' ? 'rgba(40,0,10,0.25)' : 'rgba(0,0,0,0)';
    ctx.shadowBlur = ink === 'light' ? 12 : 0;
    ctx.drawImage(mark, x0, cy - markH / 2, markW, markH);
  }
  ctx.fillStyle = ink === 'light' ? '#FFFFFF' : CORAL;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('Anacan', x0 + markW + gap, cy + textSize * 0.04);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
}

function drawChrome(ctx: C2D, model: RecapModel, t: number, index: number, assets: RecapAssets, family: string) {
  const s = model.scenes[index];
  const lt = t - s.start;
  const prev = index > 0 ? model.scenes[index - 1] : null;
  void prev; void lt;
  // The logo is always fully opaque (it switches colour family at the cut, never fades).
  drawLockup(ctx, assets, s.look.ink, 124, 66, family, 1);
  const alpha = s.kind === 'outro' ? 1 - easeInOutCubic(prog(lt, 0.1, 0.5)) : 1;
  // Story segments (outro excluded).
  const segs = model.scenes.filter((x) => x.kind !== 'outro');
  if (!segs.length || alpha <= 0) return;
  const gap = 10, y = 196, h = 7;
  const w = (SAFE_W - gap * (segs.length - 1)) / segs.length;
  ctx.save();
  ctx.globalAlpha = alpha;
  segs.forEach((seg, i) => {
    const x = SAFE_X + i * (w + gap);
    const f = t >= seg.end ? 1 : t <= seg.start ? 0 : (t - seg.start) / (seg.end - seg.start);
    const light = s.look.ink === 'light';
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = light ? 'rgba(255,255,255,0.28)' : 'rgba(43,21,32,0.14)';
    ctx.fill();
    if (f > 0) {
      roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2);
      ctx.fillStyle = light ? '#FFFFFF' : CORAL;
      ctx.fill();
    }
  });
  ctx.restore();
}

/** Digit groups ("1 576"): the display face's spaces are too narrow, so groups are drawn with an explicit gap. */
const GROUP = '\u2009';
const bigDigits = (text: string) => text.replace(/(\d)[\u00A0\u202F\u2009 ](?=\d)/g, `$1${GROUP}`);
const groupGap = (ctx: C2D) => (Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1]) || 100) * 0.3;
function measureGrouped(ctx: C2D, text: string): number {
  const parts = text.split(GROUP);
  return parts.reduce((w, p) => w + ctx.measureText(p).width, 0) + groupGap(ctx) * (parts.length - 1);
}
/** fillText, centred on x, with the digit-group gap. */
function fillGrouped(ctx: C2D, text: string, x: number, y: number) {
  const parts = text.split(GROUP);
  if (parts.length === 1) { ctx.textAlign = 'center'; ctx.fillText(text, x, y); return; }
  const gap = groupGap(ctx);
  let cx = x - measureGrouped(ctx, text) / 2;
  ctx.textAlign = 'left';
  for (const part of parts) { ctx.fillText(part, cx, y); cx += ctx.measureText(part).width + gap; }
}

// ── Numbers ───────────────────────────────────────────────────────────────────────────────────
/** Value shown at local time lt: counts up with an expo ease, or a fixed text. */
function valueText(model: RecapModel, v: RecapStat, lt: number, start: number = PACE.numberStart, dur: number = PACE.numberCount): string {
  if (v.text) return v.text;
  const p = easeOutExpo(prog(lt, start, dur));
  const n = v.n * p;
  return formatRecapNumber(model.language, v.decimals ? Math.round(n * 10 ** v.decimals) / 10 ** v.decimals : Math.round(n), v.decimals);
}

function drawBigNumber(ctx: C2D, s: RecapScene, text: string, finalText: string, cx: number, baseline: number, maxSize: number, maxW: number, lt: number, family: string, start: number = PACE.numberStart, count: number = PACE.numberCount) {
  // Plus Jakarta Sans draws the no-break space very narrow: show the thousands gap as a visible thin space.
  text = bigDigits(text); finalText = bigDigits(finalText);
  ctx.font = fontOf(800, maxSize, family);
  const w = measureGrouped(ctx, finalText);
  const size = w > maxW ? (maxSize * maxW) / w : maxSize;
  const appear = easeOutCubic(prog(lt, start - 0.25, 0.5));
  const pop = prog(lt, start + count, PACE.numberPop);
  const scale = lerp(0.86, 1, easeOutBack(prog(lt, start - 0.25, 0.7), 1.2)) * (1 + 0.05 * Math.sin(Math.PI * pop) * (pop < 1 ? 1 : 0));
  ctx.save();
  ctx.globalAlpha *= appear;
  ctx.translate(cx, baseline - size * 0.35);
  ctx.scale(scale, scale);
  ctx.font = fontOf(800, size, family);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const g = ctx.createLinearGradient(0, -size * 0.75, 0, size * 0.35);
  if (s.look.ink === 'light') { g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, mix('#FFFFFF', s.look.accent, 0.75)); } else { g.addColorStop(0, '#FF6A5F'); g.addColorStop(1, '#D6304A'); }
  ctx.shadowColor = s.look.ink === 'light' ? 'rgba(30,0,10,0.28)' : 'rgba(230,62,75,0.18)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = g;
  fillGrouped(ctx, text, 0, size * 0.35);
  ctx.restore();
  return size;
}

// ── Motifs ────────────────────────────────────────────────────────────────────────────────────
const CAL = { cols: 26, rows: 14, step: 32, r: 6 };
function motifCalendar(ctx: C2D, s: StatScene, lt: number, top: number, delay: number) {
  const { cols, rows, step, r } = CAL;
  const x0 = CX - ((cols - 1) * step) / 2, y0 = top + r;
  const total = cols * rows; // 364 ≈ one dot per day
  const lit = Math.round(clamp01(s.param) * total);
  const order = Array.from({ length: total }, (_, i) => i);
  const rnd = prng(s.seed ^ 0x5eed);
  for (let i = total - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const rank = new Array<number>(total);
  order.forEach((d, i) => { rank[d] = i; });
  const appear = easeOutCubic(prog(lt, delay, 0.4));
  const shown = lit * easeOutCubic(prog(lt, delay + 0.1, PACE.calendar));
  const on = s.look.ink === 'light' ? '#FFFFFF' : CORAL;
  for (let d = 0; d < total; d++) {
    const cx = x0 + (d % cols) * step, cy = y0 + Math.floor(d / cols) * step;
    const isLit = rank[d] < shown;
    ctx.beginPath();
    ctx.arc(cx, cy, isLit ? r + 1.5 : r * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = isLit ? rgba(on, 0.92 * appear) : rgba(on, 0.2 * appear);
    ctx.fill();
  }
}
const CAL_H = CAL.rows * CAL.step;

function motifBloom(ctx: C2D, s: StatScene, lt: number, t: number, cy: number, beat: number) {
  const b = beatPulse(t, beat * 2);
  const appear = easeOutCubic(prog(lt, 0.1, 1.2));
  glow(ctx, CX, cy, 480, s.look.bg[2], 0.35 * appear);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(CX, cy, (200 + i * 62) * (0.92 + 0.08 * appear) + b * 10 * (3 - i), 0, Math.PI * 2);
    ctx.strokeStyle = rgba('#FFFFFF', (0.16 - i * 0.04) * appear);
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const dots = 28;
  for (let i = 0; i < dots; i++) {
    const p = prog(lt, 0.4 + i * 0.05, 0.4);
    if (p <= 0) continue;
    const a = (i / dots) * Math.PI * 2 + t * 0.25;
    const rr = 340 + Math.sin(i * 1.7 + t) * 8;
    ctx.beginPath();
    ctx.arc(CX + Math.cos(a) * rr, cy + Math.sin(a) * rr, 6 + 4 * ((i % 3) / 2), 0, Math.PI * 2);
    ctx.fillStyle = rgba(i % 4 === 0 ? GOLD : '#FFFFFF', 0.75 * easeOutCubic(p));
    ctx.fill();
  }
}

function motifMoons(ctx: C2D, s: StatScene, lt: number, t: number, arcY: number) {
  const r = prng(s.seed);
  for (let i = 0; i < 70; i++) {
    const x = r() * RECAP_W, y = 260 + r() * 1400, size = 1.5 + r() * 3.5, ph = r() * 6.28;
    const a = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 + ph))) * easeOutCubic(prog(lt, r() * 0.8, 0.6));
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = rgba('#FFFFFF', a * 0.85);
    ctx.fill();
  }
  const n = Math.max(3, Math.min(9, Math.round(s.param)));
  for (let i = 0; i < n; i++) {
    const p = easeOutBack(prog(lt, 0.3 + i * 0.12, 0.6), 1.5);
    if (p <= 0) continue;
    const f = n === 1 ? 0.5 : i / (n - 1);
    const x = lerp(200, 880, f), y = arcY + 110 - Math.sin(f * Math.PI) * 110 + Math.sin(t * 1.3 + i) * 6;
    const rr = (i % 2 ? 30 : 40) * p;
    glow(ctx, x, y, rr * 3, '#C9C0FF', 0.35 * p);
    crescent(ctx, x, y, rr, '#F4EEFF');
  }
}

function motifBubbles(ctx: C2D, s: StatScene, lt: number, t: number) {
  const r = prng(s.seed);
  for (let i = 0; i < 22; i++) {
    const x0 = 80 + r() * 920, speed = 60 + r() * 90, size = 18 + r() * 46, ph = r() * 6.28, y0 = r() * 1900;
    const y = RECAP_H + 100 - ((y0 + t * speed) % (RECAP_H + 200));
    const x = x0 + Math.sin(t * 1.4 + ph) * 26;
    const a = easeOutCubic(prog(lt, 0.1 + r() * 0.6, 0.6));
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = rgba('#FFFFFF', 0.45 * a);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(s.look.accent, 0.35 * a);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - size * 0.35, y - size * 0.35, size * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = rgba('#FFFFFF', 0.9 * a);
    ctx.fill();
  }
}

function motifPulse(ctx: C2D, s: StatScene, lt: number, t: number, cy: number, beat: number) {
  const period = beat * 2;
  const appear = easeOutCubic(prog(lt, 0.1, 0.8));
  for (let k = 0; k < 3; k++) {
    const ph = ((t / period) + k / 3) % 1;
    ctx.beginPath();
    ctx.arc(CX, cy, 220 + ph * 300, 0, Math.PI * 2);
    ctx.strokeStyle = rgba('#FFFFFF', (1 - ph) * 0.28 * appear);
    ctx.lineWidth = 6 * (1 - ph) + 1;
    ctx.stroke();
  }
  const b = beatPulse(t, period) + 0.6 * beatPulse(t - period * 0.22, period);
  const size = 500 * (0.96 + 0.05 * b) * lerp(0.6, 1, easeOutBack(prog(lt, 0.05, 0.8)));
  ctx.save();
  ctx.globalAlpha *= appear;
  heartPath(ctx, CX, cy - 10, size);
  const g = ctx.createRadialGradient(CX, cy - 80, 40, CX, cy, size * 0.7);
  g.addColorStop(0, 'rgba(255,255,255,0.32)');
  g.addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function motifRing(ctx: C2D, s: StatScene, lt: number, cy: number, radius: number) {
  const isWeeks = s.id === 'bump_weeks';
  const appear = easeOutCubic(prog(lt, 0.1, 0.7));
  ctx.save();
  ctx.globalAlpha *= appear;
  ctx.lineCap = 'round';
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.arc(CX, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.stroke();
  const start = -Math.PI / 2;
  if (isWeeks) {
    const from = clamp01(s.param / 40), to = clamp01(s.param2 / 40);
    const p = easeInOutCubic(prog(lt, 0.4, 1.8));
    const cur = lerp(from, to, p);
    if (from > 0.005) {
      ctx.beginPath();
      ctx.arc(CX, cy, radius, start, start + Math.PI * 2 * from);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(CX - radius, cy - radius, CX + radius, cy + radius);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(1, s.look.accent);
    ctx.beginPath();
    ctx.arc(CX, cy, radius, start + Math.PI * 2 * from, start + Math.PI * 2 * Math.max(from + 0.001, cur));
    ctx.strokeStyle = g;
    ctx.stroke();
    const ea = start + Math.PI * 2 * cur;
    glow(ctx, CX + Math.cos(ea) * radius, cy + Math.sin(ea) * radius, 70, '#FFFFFF', 0.6);
    // 40 week ticks
    for (let i = 0; i < 40; i++) {
      const a = start + (i / 40) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(a) * (radius - 46), cy + Math.sin(a) * (radius - 46));
      ctx.lineTo(CX + Math.cos(a) * (radius - (i % 10 === 0 ? 66 : 56)), cy + Math.sin(a) * (radius - (i % 10 === 0 ? 66 : 56)));
      ctx.lineWidth = i % 10 === 0 ? 4 : 2;
      ctx.strokeStyle = rgba('#FFFFFF', i / 40 <= cur ? 0.6 : 0.18);
      ctx.stroke();
    }
  } else {
    // Cycle wheel: period part (accent) + rest of the cycle; spins in once.
    const cycle = Math.max(15, s.param2 || 28), period = Math.max(1, Math.min(cycle, s.param || 5));
    const spin = easeOutQuint(prog(lt, 0.2, 1.8));
    const rot = start + (1 - spin) * -Math.PI;
    const frac = period / cycle;
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.arc(CX, cy, radius, rot + Math.PI * 2 * frac + 0.06, rot + Math.PI * 2 * spin - 0.06);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    if (spin > frac) ctx.stroke();
    ctx.beginPath();
    ctx.arc(CX, cy, radius, rot, rot + Math.PI * 2 * Math.min(frac, spin));
    ctx.strokeStyle = s.look.accent;
    ctx.stroke();
    for (let i = 0; i < Math.round(cycle); i++) {
      const a = rot + (i / cycle) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(CX + Math.cos(a) * (radius - 58), cy + Math.sin(a) * (radius - 58), i < period ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = rgba(i < period ? s.look.accent : '#FFFFFF', i / cycle <= spin ? 0.8 : 0.15);
      ctx.fill();
    }
  }
  ctx.restore();
}

function motifOrb(ctx: C2D, s: StatScene, lt: number, t: number, cy: number) {
  const appear = easeOutCubic(prog(lt, 0.05, 1.2));
  const breathe = 1 + 0.04 * Math.sin(t * 1.6);
  const r = 290 * breathe * lerp(0.7, 1, appear);
  const col = s.look.accent;
  glow(ctx, CX, cy, r * 1.7, col, 0.45 * appear);
  const g = ctx.createRadialGradient(CX - r * 0.3, cy - r * 0.35, r * 0.1, CX, cy, r);
  g.addColorStop(0, rgba('#FFFFFF', 0.85 * appear));
  g.addColorStop(0.35, rgba(col, 0.9 * appear));
  g.addColorStop(1, rgba(mix(col, '#2B1520', 0.45), 0.85 * appear));
  ctx.beginPath();
  ctx.arc(CX, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
}

function motifGlasses(ctx: C2D, s: StatScene, lt: number, top: number) {
  const n = 8, w = 74, h = 110, gap = 30;
  const x0 = CX - (n * w + (n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (w + gap);
    const p = easeInOutCubic(prog(lt, 0.4 + i * 0.1, 0.6));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + w, top);
    ctx.lineTo(x + w * 0.86, top + h);
    ctx.lineTo(x + w * 0.14, top + h);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = rgba(s.look.accent, 0.85);
    ctx.fillRect(x - 4, top + h - h * 0.85 * p, w + 8, h);
    ctx.restore();
  }
}

function motifClock(ctx: C2D, s: StatScene, lt: number, t: number, cy: number, r: number) {
  const ink = s.look.ink === 'light' ? '#FFFFFF' : INK.dark;
  const appear = easeOutCubic(prog(lt, 0.05, 0.7));
  ctx.save();
  ctx.globalAlpha *= appear;
  glow(ctx, CX, cy, r * 1.6, s.look.bg[2], 0.4);
  ctx.beginPath();
  ctx.arc(CX, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = s.look.ink === 'light' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.45)';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = rgba(ink, 0.85);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(CX + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
    ctx.lineTo(CX + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
    ctx.lineWidth = i % 3 === 0 ? 8 : 4;
    ctx.strokeStyle = rgba(ink, i % 3 === 0 ? 0.9 : 0.5);
    ctx.stroke();
  }
  // Hands sweep to the favourite hour.
  const hour = s.param;
  const p = easeOutQuint(prog(lt, 0.3, 1.8));
  const hourA = -Math.PI / 2 + ((hour % 12) / 12) * Math.PI * 2 * p + (1 - p) * -Math.PI * 2;
  const minA = -Math.PI / 2 + p * Math.PI * 2 * 3 + Math.sin(t) * 0.0;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(CX, cy);
  ctx.lineTo(CX + Math.cos(minA) * r * 0.72, cy + Math.sin(minA) * r * 0.72);
  ctx.lineWidth = 8;
  ctx.strokeStyle = rgba(ink, 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(CX, cy);
  ctx.lineTo(CX + Math.cos(hourA) * r * 0.5, cy + Math.sin(hourA) * r * 0.5);
  ctx.lineWidth = 16;
  ctx.strokeStyle = s.look.ink === 'light' ? GOLD : CORAL;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CX, cy, 16, 0, Math.PI * 2);
  ctx.fillStyle = ink;
  ctx.fill();
  if (hour >= 20 || hour < 6) { crescent(ctx, CX + r * 0.98, cy - r * 0.92, 44, '#FFE7C2'); }
  else { glow(ctx, CX + r * 0.98, cy - r * 0.92, 90, '#FFD36E', 0.9); }
  ctx.restore();
}

function motifSparkle(ctx: C2D, s: StatScene, lt: number, t: number) {
  const r = prng(s.seed);
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const x = CX + side * (400 + r() * 110), y = 320 + r() * 1320, size = 14 + r() * 30, ph = r() * 6.28;
    const a = (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.4 + ph))) * easeOutCubic(prog(lt, 0.2 + r() * 0.8, 0.5));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 0.7 + ph) * 0.3);
    sparklePath(ctx, 0, 0, size * (0.8 + 0.2 * Math.sin(t * 3 + ph)));
    ctx.fillStyle = rgba(i % 3 === 0 ? GOLD : '#FFFFFF', a);
    ctx.fill();
    ctx.restore();
  }
}

function motifHearts(ctx: C2D, s: StatScene, lt: number, t: number) {
  const r = prng(s.seed);
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const x0 = CX + side * (390 + r() * 120), speed = 50 + r() * 70, size = 30 + r() * 50, ph = r() * 6.28, y0 = r() * 1900;
    const y = RECAP_H + 100 - ((y0 + t * speed) % (RECAP_H + 200));
    const x = x0 + Math.sin(t * 1.1 + ph) * 24;
    const a = easeOutCubic(prog(lt, 0.1 + r() * 0.7, 0.6)) * (0.18 + r() * 0.25);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t + ph) * 0.25);
    heartPath(ctx, 0, 0, size);
    ctx.fillStyle = rgba(s.look.ink === 'light' ? '#FFFFFF' : CORAL, a * (s.look.ink === 'light' ? 1.6 : 1));
    ctx.fill();
    ctx.restore();
  }
}

function motifStars(ctx: C2D, s: StatScene, lt: number, t: number) {
  const r = prng(s.seed);
  for (let i = 0; i < 30; i++) {
    const a0 = r() * Math.PI * 2, dist = 260 + r() * 360, size = 10 + r() * 22, ph = r() * 6.28;
    const p = easeOutExpo(prog(lt, 0.3 + r() * 0.3, 1.2));
    const x = CX + Math.cos(a0 + t * 0.1) * dist * p, y = 830 + Math.sin(a0 + t * 0.1) * dist * p;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.8 + ph);
    sparklePath(ctx, 0, 0, size);
    ctx.fillStyle = rgba(i % 2 ? GOLD : '#FFFFFF', 0.75 * p);
    ctx.fill();
    ctx.restore();
  }
}

function motifGift(ctx: C2D, s: StatScene, lt: number, cy: number) {
  // A hospital bag: rounded body, handle, a row of ticks that fill in.
  const appear = easeOutBack(prog(lt, 0.05, 0.7), 1.3);
  const w = 360, h = 260;
  ctx.save();
  ctx.globalAlpha *= clamp01(appear * 1.4);
  ctx.translate(CX, cy);
  ctx.scale(lerp(0.7, 1, appear), lerp(0.7, 1, appear));
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.strokeStyle = CORAL;
  ctx.beginPath();
  ctx.arc(0, -h / 2 + 6, 74, Math.PI, 0);
  ctx.stroke();
  roundRect(ctx, -w / 2, -h / 2, w, h, 48);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, '#FF7A70');
  g.addColorStop(1, '#E63E4B');
  ctx.fillStyle = g;
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const p = easeOutBack(prog(lt, 0.7 + i * 0.25, 0.4), 2);
    const x = -100 + i * 100;
    ctx.beginPath();
    ctx.arc(x, 10, 32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    if (p > 0) {
      ctx.save();
      ctx.translate(x, 10);
      ctx.scale(p, p);
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-4, 11);
      ctx.lineTo(16, -12);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ── Scenes ────────────────────────────────────────────────────────────────────────────────────
interface RenderCtx { model: RecapModel; assets: RecapAssets; F: RecapFonts; t: number }

function drawEyebrow(ctx: C2D, s: RecapScene, text: string, top: number, lt: number, r: RenderCtx, delay = 0.05): number {
  const lay = fitText(ctx, text, { max: 52, min: 34, weight: 500, maxW: SAFE_W, maxLines: 2, family: r.F.body, cjk: r.model.cjk });
  return drawKinetic(ctx, lay, top, lt, { color: s.look.ink === 'light' ? rgba(s.look.accent === '#FFFFFF' ? '#FFFFFF' : mix('#FFFFFF', s.look.accent, 0.5), 0.95) : '#C8323F', delay, stagger: 0.03, rtl: r.model.rtl, family: r.F.body });
}

function drawLine(ctx: C2D, s: RecapScene, text: string, top: number, lt: number, r: RenderCtx, delay: number, maxSize = 66, maxLines = 3, body = false, stagger: number = PACE.stagger): number {
  const family = body ? r.F.body : r.F.display;
  const lay = fitText(ctx, text, { max: maxSize, min: 38, weight: body ? 500 : 700, maxW: SAFE_W, maxLines, family, cjk: r.model.cjk });
  return drawKinetic(ctx, lay, top, lt, { color: INK[s.look.ink], delay, stagger, rtl: r.model.rtl, family, shadow: s.look.ink === 'light' ? 'rgba(30,0,10,0.22)' : null });
}

function drawBadge(ctx: C2D, s: RecapScene, text: string, cy: number, lt: number, r: RenderCtx, delay: number) {
  const p = prog(lt, delay, 0.55);
  if (p <= 0) return;
  ctx.font = fontOf(700, 38, r.F.ui);
  const w = Math.min(SAFE_W, ctx.measureText(text).width + 130), h = 84;
  const k = easeOutBack(p, 1.8);
  ctx.save();
  ctx.globalAlpha *= clamp01(p * 1.5);
  ctx.translate(CX, cy);
  ctx.rotate(-0.025);
  ctx.scale(lerp(0.5, 1, k), lerp(0.5, 1, k));
  roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, '#FFD98A');
  g.addColorStop(1, '#FFB65C');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(60,10,20,0.25)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0)';
  sparklePath(ctx, -w / 2 + 46, 0, 18);
  ctx.fillStyle = '#7A2E10';
  ctx.fill();
  ctx.fillStyle = '#4A1A08';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 22, 2, w - 110);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

function pillsHeight(ctx: C2D, texts: string[], size: number, family: string): number {
  if (!texts.length) return 0;
  const padX = size * 0.75, h = size * 1.9, gap = 16;
  ctx.font = fontOf(600, size, family);
  let rows = 1, rowW = 0;
  for (const t of texts) {
    const w = Math.min(SAFE_W, ctx.measureText(t).width + padX * 2);
    if (rowW && rowW + gap + w > SAFE_W) { rows++; rowW = w; } else rowW += (rowW ? gap : 0) + w;
  }
  return rows * h + (rows - 1) * gap;
}

const lineHeight = (lay: Layout, k = 1.18) => lay.lines.length * lay.size * k;

function drawStat(ctx: C2D, s: StatScene, lt: number, r: RenderCtx) {
  const { model, t } = r;
  const m = s.motif;
  const fam = r.F.display, cjk = model.cjk;
  const plan = statPlan(s, cjk);
  const finalText = s.value.text ?? formatRecapNumber(model.language, s.value.n, s.value.decimals);
  // Background-level motifs
  if (m === 'bubbles') motifBubbles(ctx, s, lt, t);
  if (m === 'sparkle') motifSparkle(ctx, s, lt, t);
  if (m === 'hearts' || m === 'names') motifHearts(ctx, s, lt, t);
  if (m === 'stars') motifStars(ctx, s, lt, t);

  // ── Measure ──
  const eyebrow = fitText(ctx, s.eyebrow, { max: 52, min: 34, weight: 500, maxW: SAFE_W, maxLines: 2, family: r.F.body, cjk });
  const line = fitText(ctx, s.line, { max: 66, min: 40, weight: 700, maxW: SAFE_W, maxLines: 3, family: fam, cjk });
  const numMax = s.value.text ? (m === 'clock' ? 200 : 210) : m === 'ring' ? 220 : m === 'clock' || m === 'gift' ? 220 : 300;
  ctx.font = fontOf(800, numMax, fam);
  const numW = measureGrouped(ctx, bigDigits(finalText));
  const numMaxW = m === 'ring' ? 370 : SAFE_W;
  const numSize = numW > numMaxW ? (numMax * numMaxW) / numW : numMax;
  const showCal = m === 'calendar' && s.param * 365 >= 30;
  let heroH: number;
  switch (m) {
    case 'ring': heroH = 640; break;
    case 'bloom': heroH = 700; break;
    case 'pulse': heroH = 560; break;
    case 'orb': heroH = 620; break;
    case 'clock': heroH = 460 + 50 + numSize * 0.78; break;
    case 'gift': heroH = 360 + 50 + numSize * 0.78; break;
    case 'moons': heroH = 230 + numSize * 0.78; break;
    case 'glasses': heroH = numSize * 0.78 + 60 + 110; break;
    default: heroH = numSize * 0.8;
  }
  const subsH = s.subs.reduce((sum, x) => sum + pillsHeight(ctx, [x], 36, r.F.ui) + 18, 0);
  const chipsH = s.chips.length ? pillsHeight(ctx, s.chips, 34, r.F.ui) + 18 : 0;
  const badgeH = s.badge ? 84 + 30 : 0;
  const gapA = 46, gapB = 56, gapC = 40;
  const total = lineHeight(eyebrow) + gapA + heroH + gapB + lineHeight(line) + (showCal ? gapC + CAL_H : 0) + (subsH || chipsH ? gapC : 0) + subsH + chipsH + (badgeH ? 20 + badgeH : 0);
  let y = Math.max(280, 250 + (1420 - total) / 2);

  // ── Draw ──
  y += drawKinetic(ctx, eyebrow, y, lt, { color: s.look.ink === 'light' ? rgba(mix('#FFFFFF', s.look.accent, 0.5), 0.95) : '#C8323F', delay: 0.05, stagger: 0.03, rtl: model.rtl, family: r.F.body }) + gapA;
  const heroTop = y;
  const value = valueText(model, s.value, lt);
  if (m === 'ring') {
    const cy = heroTop + 320;
    motifRing(ctx, s, lt, cy, 290);
    drawBigNumber(ctx, s, value, finalText, CX, cy + numSize * 0.36, numSize, numMaxW + 1, lt, fam);
  } else if (m === 'bloom' || m === 'pulse' || m === 'orb') {
    const cy = heroTop + heroH / 2;
    if (m === 'bloom') motifBloom(ctx, s, lt, t, cy, model.beat);
    if (m === 'pulse') motifPulse(ctx, s, lt, t, cy, model.beat);
    if (m === 'orb') motifOrb(ctx, s, lt, t, cy);
    drawBigNumber(ctx, s, value, finalText, CX, cy + numSize * 0.36, numSize, SAFE_W + 1, lt, fam);
  } else if (m === 'clock' || m === 'gift') {
    if (m === 'clock') motifClock(ctx, s, lt, t, heroTop + 230, 220);
    else motifGift(ctx, s, lt, heroTop + 200);
    const top = heroTop + (m === 'clock' ? 460 : 360) + 50;
    drawBigNumber(ctx, s, value, finalText, CX, top + numSize * 0.74, numSize, SAFE_W + 1, lt, fam);
  } else if (m === 'moons') {
    motifMoons(ctx, s, lt, t, heroTop);
    drawBigNumber(ctx, s, value, finalText, CX, heroTop + 230 + numSize * 0.74, numSize, SAFE_W + 1, lt, fam);
  } else if (m === 'glasses') {
    drawBigNumber(ctx, s, value, finalText, CX, heroTop + numSize * 0.74, numSize, SAFE_W + 1, lt, fam);
    motifGlasses(ctx, s, lt, heroTop + numSize * 0.78 + 60);
  } else {
    drawBigNumber(ctx, s, value, finalText, CX, heroTop + numSize * 0.76, numSize, SAFE_W + 1, lt, fam);
  }
  y = heroTop + heroH + gapB;
  y += drawKinetic(ctx, line, y, lt, { color: INK[s.look.ink], delay: plan.line, rtl: model.rtl, family: fam, shadow: s.look.ink === 'light' ? 'rgba(30,0,10,0.22)' : null });
  if (showCal) { y += gapC; motifCalendar(ctx, s, lt, y, plan.calendar); y += CAL_H; }
  if (subsH || chipsH) y += gapC;
  s.subs.forEach((sub, i) => { y += drawPills(ctx, s, [sub], y, lt, plan.subs[i], r.F.ui, { size: 36, weight: 600 }) + 18; });
  if (s.chips.length) y += drawPills(ctx, s, s.chips, y, lt, plan.chips, r.F.ui, { size: 34, weight: 600, fill: s.look.ink === 'light' ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.7)' }) + 18;
  if (s.badge) drawBadge(ctx, s, s.badge, y + 20 + 42, lt, r, plan.badge);
}

function drawCold(ctx: C2D, s: ColdScene, lt: number, r: RenderCtx) {
  const kick = easeOutCubic(prog(lt, 0.3, 0.8));
  ctx.save();
  ctx.globalAlpha *= kick;
  ctx.font = fontOf(700, 40, r.F.body);
  ctx.fillStyle = rgba('#FFB59E', 0.95);
  ctx.textAlign = 'center';
  const label = 'ANACAN RECAP';
  // letter-spaced brand kicker
  const chars = [...label];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const track = 14;
  const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
  let x = CX - total / 2;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => { ctx.fillText(ch, x, 660 + (1 - kick) * 20); x += widths[i] + track; });
  ctx.restore();

  // The year, digit by digit.
  const year = String(s.year);
  const size = 320;
  ctx.font = fontOf(800, size, r.F.display);
  const ws = [...year].map((d) => ctx.measureText(d).width);
  const tw = ws.reduce((a, b) => a + b, 0);
  let dx = CX - tw / 2;
  [...year].forEach((d, i) => {
    const p = prog(lt, 0.5 + i * 0.12, 0.8);
    const k = easeOutBack(p, 1.3);
    ctx.save();
    ctx.globalAlpha *= clamp01(p * 1.5);
    ctx.translate(dx + ws[i] / 2, 960);
    ctx.scale(lerp(1.4, 1, k), lerp(1.4, 1, k));
    ctx.translate(0, (1 - k) * -80);
    const g = ctx.createLinearGradient(0, -size * 0.75, 0, 0);
    g.addColorStop(0, '#FFE3D3');
    g.addColorStop(0.55, '#FF9A7A');
    g.addColorStop(1, '#FF5A5F');
    ctx.fillStyle = g;
    ctx.shadowColor = 'rgba(255,90,95,0.55)';
    ctx.shadowBlur = 60 * easeOutCubic(prog(lt, 1.6, 2));
    ctx.textAlign = 'center';
    ctx.fillText(d, 0, 0);
    ctx.restore();
    dx += ws[i];
  });
  const lay = fitText(ctx, s.title, { max: 76, min: 46, weight: 700, maxW: SAFE_W, maxLines: 3, family: r.F.display, cjk: r.model.cjk });
  drawKinetic(ctx, lay, 1060, lt, { color: '#FFFFFF', delay: 1.2, stagger: 0.06, rtl: r.model.rtl, family: r.F.display, shadow: 'rgba(0,0,0,0.3)' });
}

function drawJourney(ctx: C2D, s: JourneyScene, lt: number, r: RenderCtx) {
  let y = 320;
  y += drawEyebrow(ctx, s, s.eyebrow, y, lt, r) + 60;
  const n = s.stages.length;
  const cy = 820;
  const xs = s.stages.map((_, i) => (n === 1 ? CX : lerp(250, 830, i / (n - 1))));
  // Path
  const p = easeInOutCubic(prog(lt, 0.3, 0.3 + (n - 1) * 0.45));
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(xs[0], cy);
  ctx.lineTo(xs[n - 1], cy);
  ctx.stroke();
  ctx.strokeStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(xs[0], cy);
  ctx.lineTo(lerp(xs[0], xs[n - 1], p), cy);
  ctx.stroke();
  ctx.restore();
  s.stages.forEach((label, i) => {
    const k = easeOutBack(prog(lt, 0.3 + i * 0.45, 0.6), 1.8);
    if (k <= 0) return;
    const rr = 74 * k;
    glow(ctx, xs[i], cy, rr * 2.4, GOLD, 0.45 * clamp01(k));
    ctx.beginPath();
    ctx.arc(xs[i], cy, rr, 0, Math.PI * 2);
    ctx.fillStyle = i === n - 1 ? GOLD : '#FFFFFF';
    ctx.fill();
    // Stage glyphs: drop (flow), heart (bump), mother+baby circles (mommy) — simple, brand-neutral shapes.
    ctx.save();
    ctx.translate(xs[i], cy);
    ctx.scale(k, k);
    ctx.fillStyle = i === n - 1 ? '#7A2E10' : CORAL;
    const stageKind = r.model.stage && i === n - 1 ? r.model.stage : null;
    void stageKind;
    heartPath(ctx, 0, 4, 64);
    ctx.fill();
    ctx.restore();
    const lay = fitText(ctx, label, { max: 50, min: 30, weight: 700, maxW: n === 3 ? 270 : 380, maxLines: 2, family: r.F.body, cjk: r.model.cjk });
    drawKinetic(ctx, lay, cy + 110, lt, { color: '#FFFFFF', delay: 0.35 + i * 0.45, rtl: r.model.rtl, family: r.F.body, cx: xs[i] });
  });
  drawLine(ctx, s, s.line, 1120, lt, r, 0.4 + n * 0.45, 72, 3);
}

function drawMilestones(ctx: C2D, s: MilestonesScene, lt: number, r: RenderCtx) {
  const { model } = r;
  const items = [...s.items, ...(s.more ? [s.more] : [])];
  const rowH = 96;
  const eyebrow = fitText(ctx, s.eyebrow, { max: 52, min: 34, weight: 500, maxW: SAFE_W, maxLines: 2, family: r.F.body, cjk: model.cjk });
  const line = fitText(ctx, s.line, { max: items.length ? 60 : 68, min: 38, weight: 700, maxW: SAFE_W, maxLines: items.length ? 2 : 3, family: r.F.display, cjk: model.cjk });
  const total = lineHeight(eyebrow) + 10 + 240 + 50 + (items.length ? items.length * rowH + 40 : 40) + lineHeight(line);
  let y = Math.max(280, 250 + (1420 - total) / 2);
  y += drawEyebrow(ctx, s, s.eyebrow, y, lt, r) + 10;
  const final = formatRecapNumber(model.language, s.value.n);
  const size = drawBigNumber(ctx, s, valueText(model, s.value, lt, 0.3, 1.0), final, CX, y + 210, 240, SAFE_W, lt, r.F.display, 0.3, 1.0);
  y += 210 + size * 0.15 + 30;
  const lineDelay = 0.9 + items.length * 0.22;
  if (items.length) {
    // Vertical timeline: dot + label, in the order they happened.
    const x0 = 250;
    const top = y;
    const p = easeInOutCubic(prog(lt, 0.8, 0.2 + 0.22 * items.length));
    ctx.save();
    ctx.strokeStyle = rgba(CORAL, 0.35);
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, top + rowH * 0.5);
    ctx.lineTo(x0, top + rowH * 0.5 + (items.length - 1) * rowH * p);
    ctx.stroke();
    ctx.restore();
    items.forEach((label, i) => {
      const k = easeOutBack(prog(lt, 0.8 + i * 0.22, 0.5), 1.6);
      if (k <= 0) return;
      const cy = top + rowH * 0.5 + i * rowH;
      const more = !!s.more && i === items.length - 1;
      ctx.beginPath();
      ctx.arc(x0, cy, 20 * k, 0, Math.PI * 2);
      ctx.fillStyle = more ? rgba(CORAL, 0.4) : CORAL;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x0, cy, 8 * k, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.save();
      ctx.globalAlpha *= clamp01(k);
      const lay = fitText(ctx, label, { max: 52, min: 32, weight: more ? 500 : 700, maxW: 600, maxLines: 1, family: r.F.body, cjk: model.cjk });
      ctx.font = fontOf(lay.weight, lay.size, r.F.body);
      ctx.fillStyle = more ? rgba(INK.dark, 0.6) : INK.dark;
      ctx.textBaseline = 'middle';
      ctx.textAlign = model.rtl ? 'right' : 'left';
      ctx.fillText(lay.lines.map((l) => l.words.map((w) => w.text).join(model.cjk ? '' : ' ')).join(' '), model.rtl ? x0 - 50 : x0 + 50 + (1 - k) * 30, cy + 2);
      ctx.restore();
    });
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    y = top + items.length * rowH + 40;
  } else y += 40;
  drawKinetic(ctx, line, Math.min(y, 1480), lt, { color: INK.dark, delay: lineDelay, rtl: model.rtl, family: r.F.display });
}

function drawGrowth(ctx: C2D, s: GrowthScene, lt: number, r: RenderCtx) {
  const fam = r.F.display, model = r.model;
  const eyebrow = fitText(ctx, s.eyebrow, { max: 54, min: 36, weight: 500, maxW: SAFE_W, maxLines: 2, family: r.F.body, cjk: model.cjk });
  const line = fitText(ctx, s.line, { max: 72, min: 44, weight: 700, maxW: SAFE_W, maxLines: 3, family: fam, cjk: model.cjk });
  const chartH = 640, gainH = 200;
  const total = lineHeight(eyebrow) + 30 + gainH + 30 + chartH + 60 + lineHeight(line);
  let y = Math.max(280, 250 + (1420 - total) / 2);
  y += drawKinetic(ctx, eyebrow, y, lt, { color: rgba(mix('#FFFFFF', s.look.accent, 0.5), 0.95), delay: 0.05, stagger: 0.03, rtl: model.rtl, family: r.F.body }) + 30;
  // Big gain ("+6,2 kq") counts up.
  const gainN = Math.round((s.to.n - s.from.n) * 10) / 10;
  drawBigNumber(ctx, s, s.gain.replace(formatRecapNumber(model.language, gainN, 1), formatRecapNumber(model.language, Math.round(gainN * easeOutExpo(prog(lt, 0.5, 1.1)) * 10) / 10, 1)),
    s.gain, CX, y + 170, 210, SAFE_W, lt, fam, 0.5, 1.1);
  y += gainH + 30;
  // Chart: axis, two bars (start of the year → now), value labels on top, captions under the axis.
  const axisY = y + chartH - 90, maxH = chartH - 200, bw = 250;
  const ratio = clamp01(s.from.n / Math.max(s.to.n, 0.1));
  const ap = easeOutCubic(prog(lt, 0.15, 0.5));
  ctx.save();
  ctx.globalAlpha *= ap;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(SAFE_X + 40, axisY); ctx.lineTo(RECAP_W - SAFE_X - 40, axisY); ctx.stroke();
  ctx.setLineDash([10, 12]);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  for (let i = 1; i <= 3; i++) { const gy = axisY - (maxH * i) / 3; ctx.beginPath(); ctx.moveTo(SAFE_X + 40, gy); ctx.lineTo(RECAP_W - SAFE_X - 40, gy); ctx.stroke(); }
  ctx.restore();
  const bars = [
    { x: CX - 190, h: maxH * Math.max(0.2, ratio), value: s.from.label, caption: s.fromLabel, delay: 0.2, strong: false },
    { x: CX + 190, h: maxH, value: s.to.label, caption: s.toLabel, delay: 0.6, strong: true },
  ];
  bars.forEach((b) => {
    const p = easeOutQuint(prog(lt, b.delay, 1.0));
    const h = Math.max(8, b.h * p);
    roundRect(ctx, b.x - bw / 2, axisY - h, bw, h, 36);
    const g = ctx.createLinearGradient(0, axisY - h, 0, axisY);
    g.addColorStop(0, b.strong ? '#FFFFFF' : 'rgba(255,255,255,0.6)');
    g.addColorStop(1, b.strong ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)');
    ctx.fillStyle = g;
    ctx.globalAlpha = ap;
    ctx.fill();
    ctx.globalAlpha = 1;
    const vp = easeOutCubic(prog(lt, b.delay + 0.4, 0.4));
    ctx.save();
    ctx.globalAlpha *= vp;
    ctx.textAlign = 'center';
    ctx.font = fontOf(800, 60, fam);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(80,10,0,0.25)'; ctx.shadowBlur = 12;
    ctx.fillText(b.value, b.x, axisY - h - 28, bw + 140);
    ctx.shadowBlur = 0;
    ctx.font = fontOf(600, 36, r.F.ui);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(b.caption, b.x, axisY + 60, bw + 140);
    ctx.restore();
  });
  y += chartH + 60;
  drawKinetic(ctx, line, y, lt, { color: '#FFFFFF', delay: 0.9, rtl: model.rtl, family: fam, shadow: 'rgba(80,10,0,0.3)' });
}

function drawConfetti(ctx: C2D, seed: number, tau: number, ox: number, oy: number) {
  if (tau < 0 || tau > 4.5) return;
  const r = prng(seed);
  const colors = ['#FFFFFF', GOLD, '#FFB59E', '#FF8FA3', '#FFE3D3'];
  for (let i = 0; i < 150; i++) {
    const a = r() * Math.PI * 2, v = 700 + r() * 1500, k = 1.6 + r() * 1.2;
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v - 500;
    const drag = (1 - Math.exp(-k * tau)) / k;
    const x = ox + vx * drag, y = oy + vy * drag + 0.5 * 900 * tau * tau * 0.55;
    const rot = r() * 6 + tau * (r() * 10 - 5);
    const size = 12 + r() * 18;
    const fade = 1 - clamp01((tau - 2.8) / 1.6);
    const col = colors[i % colors.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha *= fade;
    ctx.fillStyle = col;
    if (i % 3 === 0) { ctx.beginPath(); ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2); ctx.fill(); } else if (i % 3 === 1) ctx.fillRect(-size / 2, -size * 0.2, size, size * 0.4);
    else { sparklePath(ctx, 0, 0, size * 0.6); ctx.fill(); }
    ctx.restore();
  }
}

function drawPeak(ctx: C2D, s: PeakScene, lt: number, r: RenderCtx) {
  const { model } = r;
  const dim = 1 - easeOutCubic(prog(lt, s.burst - 0.2, 0.5));
  // During the breath the scene is darker and quieter.
  if (dim > 0) { ctx.fillStyle = `rgba(40,6,20,${(0.45 * dim).toFixed(3)})`; ctx.fillRect(0, 0, RECAP_W, RECAP_H); }
  const lay = fitText(ctx, s.lead, { max: 84, min: 50, weight: 800, maxW: SAFE_W, maxLines: 2, family: r.F.display, cjk: model.cjk });
  const close = fitText(ctx, s.close, { max: 80, min: 48, weight: 800, maxW: SAFE_W, maxLines: 2, family: r.F.display, cjk: model.cjk });
  const rowH = 262;
  const total = lineHeight(lay) + 40 + s.stats.length * rowH + 30 + lineHeight(close);
  let y = Math.max(280, 250 + (1420 - total) / 2);
  y += drawKinetic(ctx, lay, y, lt, { color: '#FFFFFF', delay: 0.15, stagger: 0.12, rtl: model.rtl, family: r.F.display, shadow: 'rgba(40,0,10,0.25)' }) + 40;
  s.stats.forEach((st, i) => {
    const at = s.burst + i * 0.25;
    const p = prog(lt, at, 0.6);
    if (p <= 0) return;
    const k = easeOutBack(p, 1.4);
    const cy = y + i * rowH;
    ctx.save();
    ctx.globalAlpha *= clamp01(p * 2);
    ctx.translate(CX, cy + 120);
    ctx.scale(lerp(1.5, 1, k), lerp(1.5, 1, k));
    ctx.translate(-CX, -(cy + 120));
    const text = valueText(model, st, lt, at, 0.8);
    drawBigNumber(ctx, s, text, formatRecapNumber(model.language, st.n, st.decimals), CX, cy + 150, 170, SAFE_W, 10, r.F.display, 0);
    const ll = fitText(ctx, st.label, { max: 46, min: 32, weight: 600, maxW: SAFE_W, maxLines: 1, family: r.F.ui, cjk: model.cjk });
    ctx.font = fontOf(600, ll.size, r.F.ui);
    ctx.fillStyle = rgba('#FFFFFF', 0.92);
    ctx.textAlign = 'center';
    ctx.fillText(st.label, CX, cy + 232, SAFE_W);
    ctx.restore();
  });
  y += s.stats.length * rowH + 30;
  drawKinetic(ctx, close, Math.min(y, 1520), lt, { color: '#FFFFFF', delay: s.burst + 0.2 + s.stats.length * 0.2, stagger: 0.06, rtl: model.rtl, family: r.F.display, shadow: 'rgba(40,0,10,0.3)' });
  drawConfetti(ctx, s.seed, lt - s.burst, CX, 900);
}

function personaGlyph(ctx: C2D, persona: PersonaScene['persona'], size: number, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (persona === 'night') { crescent(ctx, 0, 0, size * 0.55, color); sparklePath(ctx, size * 0.42, -size * 0.38, size * 0.16); ctx.fill(); }
  else if (persona === 'community') { heartPath(ctx, 0, size * 0.04, size * 1.05); ctx.fill(); }
  else if (persona === 'knowledge') { sparklePath(ctx, 0, 0, size * 0.62); ctx.fill(); sparklePath(ctx, size * 0.5, -size * 0.45, size * 0.2); ctx.fill(); }
  else if (persona === 'planner') {
    ctx.lineWidth = size * 0.12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(0, 0, size * 0.52, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-size * 0.24, size * 0.02); ctx.lineTo(-size * 0.05, size * 0.22); ctx.lineTo(size * 0.28, -size * 0.18); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = size * 0.08; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * size * 0.44, Math.sin(a) * size * 0.44); ctx.lineTo(Math.cos(a) * size * 0.62, Math.sin(a) * size * 0.62); ctx.stroke(); }
  }
}

function drawPersona(ctx: C2D, s: PersonaScene, lt: number, r: RenderCtx) {
  const { t } = r;
  let y = 320;
  y += drawEyebrow(ctx, s, s.eyebrow, y, lt, r) + 20;
  const cy = 740;
  const k = easeOutBack(prog(lt, 0.2, 0.9), 1.3);
  glow(ctx, CX, cy, 420, GOLD, 0.35 * clamp01(k));
  ctx.save();
  ctx.translate(CX, cy);
  ctx.globalAlpha *= clamp01(k);
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(t * (0.15 + i * 0.08) * (i % 2 ? -1 : 1));
    ctx.setLineDash([18 + i * 10, 14 + i * 6]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(GOLD, 0.55 - i * 0.13);
    ctx.beginPath();
    ctx.arc(0, 0, (180 + i * 50) * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(0, 0, 150 * k, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-40, -50, 10, 0, 0, 150 * k);
  g.addColorStop(0, '#FFE6B0');
  g.addColorStop(1, '#F2A33A');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.scale(k, k);
  personaGlyph(ctx, s.persona, 170, '#5A1A0C');
  ctx.restore();
  const title = fitText(ctx, s.title, { max: 124, min: 64, weight: 800, maxW: SAFE_W, maxLines: 2, family: r.F.display, cjk: r.model.cjk });
  ctx.save();
  // Gold title
  const ty = 1010;
  const th = drawKinetic(ctx, title, ty, lt, { color: GOLD, delay: 0.5, stagger: 0.1, rise: 0.3, rtl: r.model.rtl, family: r.F.display, shadow: 'rgba(255,201,119,0.35)' });
  ctx.restore();
  drawLine(ctx, s, s.reason, ty + th + 50, lt, r, 0.9, 52, 4, true, 0.03);
}

function drawSummary(ctx: C2D, s: SummaryScene, lt: number, r: RenderCtx) {
  const { model, assets } = r;
  const p = easeOutQuint(prog(lt, 0.05, 0.9));
  const x = 84, h = 1240, y = 250 + (1420 - h) / 2, w = RECAP_W - 168;
  ctx.save();
  ctx.translate(0, (1 - p) * 220);
  ctx.globalAlpha *= clamp01(p * 1.4);
  ctx.save();
  roundRect(ctx, x, y, w, h, 64);
  ctx.shadowColor = 'rgba(120,20,40,0.35)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = '#FFF8F4';
  ctx.fill();
  ctx.restore();
  // Card top: brand ribbon
  ctx.save();
  roundRect(ctx, x, y, w, h, 64);
  ctx.clip();
  const rib = ctx.createLinearGradient(x, y, x + w, y + 360);
  rib.addColorStop(0, '#FF5A5F');
  rib.addColorStop(1, '#FF9A7A');
  ctx.fillStyle = rib;
  ctx.fillRect(x, y, w, 360);
  glow(ctx, x + w * 0.85, y + 40, 300, '#FFC977', 0.55);
  ctx.restore();
  // Name and year on the ribbon
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = fontOf(600, 38, r.F.ui);
  ctx.fillStyle = rgba('#FFFFFF', 0.92);
  ctx.fillText(`${s.kicker} · ${s.year}`, CX, y + 100, w - 120);
  const nameText = s.name ?? `Anacan ${s.year}`;
  const nl = fitText(ctx, nameText, { max: 128, min: 64, weight: 800, maxW: w - 140, maxLines: 1, family: r.F.display, cjk: model.cjk });
  ctx.font = fontOf(800, nl.size, r.F.display);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(nameText, CX, y + 100 + 30 + nl.size * 0.95, w - 140);
  // Persona pill
  ctx.font = fontOf(700, 38, r.F.ui);
  const pw = Math.min(w - 160, ctx.measureText(s.persona).width + 120);
  const py = y + 360;
  ctx.save();
  roundRect(ctx, CX - pw / 2, py - 42, pw, 84, 42);
  ctx.fillStyle = '#2B1520';
  ctx.fill();
  sparklePath(ctx, CX - pw / 2 + 44, py, 16);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.persona, CX + 18, py + 2, pw - 110);
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
  // 2×2 stats
  const cellW = (w - 120) / 2, cellH = 330;
  const gx = x + 60, gy = y + 450;
  const stats = s.stats.slice(0, 4);
  stats.forEach((st, i) => {
    // 4 → 2×2; 3 → two on top and one wide below; 1–2 → one row.
    const wide = stats.length === 3 && i === 2 || stats.length === 1;
    const cx = wide ? CX : gx + (i % 2) * cellW + cellW / 2, top = gy + Math.floor(i / 2) * cellH;
    const cw = wide ? cellW * 2 : cellW;
    const k = easeOutBack(prog(lt, 0.4 + i * 0.15, 0.55), 1.4);
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha *= clamp01(k * 1.5);
    roundRect(ctx, cx - cw / 2 + 12, top, cw - 24, cellH - 30, 40);
    ctx.fillStyle = '#FFEDE6';
    ctx.fill();
    const text = bigDigits(valueText(model, st, lt, 0.6 + i * 0.15, 1.0));
    const final = bigDigits(formatRecapNumber(model.language, st.n, st.decimals));
    ctx.font = fontOf(800, 118, r.F.display);
    const fw = measureGrouped(ctx, final);
    const size = fw > cellW - 70 ? (118 * (cellW - 70)) / fw : 118;
    ctx.font = fontOf(800, size, r.F.display);
    const g = ctx.createLinearGradient(0, top + 40, 0, top + 170);
    g.addColorStop(0, '#FF6A5F');
    g.addColorStop(1, '#D6304A');
    ctx.fillStyle = g;
    fillGrouped(ctx, text, cx, top + 60 + size * 0.8);
    const ll = fitText(ctx, st.label, { max: 40, min: 28, weight: 600, maxW: cw - 70, maxLines: 2, family: r.F.ui, cjk: model.cjk });
    drawKinetic(ctx, ll, top + 60 + size * 0.8 + 22, 10, { color: rgba(INK.dark, 0.75), rtl: model.rtl, family: r.F.ui, cx });
    ctx.restore();
  });
  // Footer: mark + site
  const fy = y + h - 96;
  ctx.save();
  ctx.globalAlpha *= easeOutCubic(prog(lt, 1.0, 0.5));
  const mark = assets.logoCoral;
  ctx.font = fontOf(700, 44, r.F.body);
  const sw = ctx.measureText(s.site).width;
  let mw = 0;
  if (mark) { const [iw, ih] = imgSize(mark); mw = (56 * iw) / ih; }
  const fx = CX - (mw + (mark ? 16 : 0) + sw) / 2;
  if (mark) ctx.drawImage(mark, fx, fy - 28, mw, 56);
  ctx.fillStyle = CORAL;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(s.site, fx + mw + (mark ? 16 : 0), fy + 2);
  ctx.restore();
  ctx.restore();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

function drawOutro(ctx: C2D, s: OutroScene, lt: number, r: RenderCtx) {
  const { assets } = r;
  const cy = 740;
  // The white Anacan mark on its own (no disc, no rings).
  const k = easeOutBack(prog(lt, 0.2, 0.9), 1.4);
  const mark = assets.logoWhite ?? assets.logoCoral;
  if (mark && k > 0) {
    const [iw, ih] = imgSize(mark);
    const mh = 330, mw = (mh * iw) / ih;
    ctx.save();
    ctx.translate(CX, cy);
    ctx.scale(lerp(0.6, 1, k), lerp(0.6, 1, k));
    ctx.globalAlpha *= clamp01(k * 1.5);
    ctx.shadowColor = 'rgba(110,10,30,0.28)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.drawImage(mark, -mw / 2, -mh / 2, mw, mh);
    ctx.restore();
  }
  const wp = easeOutCubic(prog(lt, 0.5, 0.6));
  ctx.save();
  ctx.globalAlpha *= wp;
  ctx.font = fontOf(700, 150, r.F.body);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(80,0,20,0.25)';
  ctx.shadowBlur = 24;
  ctx.fillText('Anacan', CX, 1110 + (1 - wp) * 30);
  ctx.restore();
  const tl = fitText(ctx, s.tagline, { max: 62, min: 40, weight: 500, maxW: SAFE_W, maxLines: 2, family: r.F.body, cjk: r.model.cjk });
  const th = drawKinetic(ctx, tl, 1170, lt, { color: rgba('#FFFFFF', 0.95), delay: 0.7, stagger: 0.06, rtl: r.model.rtl, family: r.F.body });
  const sy = 1170 + th + 50;
  drawPills(ctx, s, [s.site], sy, lt, 1.1, r.F.ui, { size: 44, weight: 700, fill: '#FFFFFF', color: CORAL });
  const st = fitText(ctx, s.stores, { max: 38, min: 28, weight: 500, maxW: SAFE_W, maxLines: 1, family: r.F.ui, cjk: r.model.cjk });
  drawKinetic(ctx, st, sy + 44 * 1.9 + 40, lt, { color: rgba('#FFFFFF', 0.88), delay: 1.3, rtl: r.model.rtl, family: r.F.ui });
}

function drawSceneContent(ctx: C2D, s: RecapScene, lt: number, r: RenderCtx) {
  switch (s.kind) {
    case 'cold': return drawCold(ctx, s, lt, r);
    case 'stat': return drawStat(ctx, s, lt, r);
    case 'journey': return drawJourney(ctx, s, lt, r);
    case 'milestones': return drawMilestones(ctx, s, lt, r);
    case 'growth': return drawGrowth(ctx, s, lt, r);
    case 'peak': return drawPeak(ctx, s, lt, r);
    case 'persona': return drawPersona(ctx, s, lt, r);
    case 'summary': return drawSummary(ctx, s, lt, r);
    case 'outro': return drawOutro(ctx, s, lt, r);
  }
}

/** Draws the frame at time t (seconds) into a 1080×1920 context. */
export function renderRecapFrame(ctx: C2D, tSeconds: number, model: RecapModel, assets: RecapAssets = {}): void {
  const t = Math.max(0, Math.min(model.duration - 1e-4, tSeconds));
  const index = sceneIndexAt(model, t);
  const s = model.scenes[index];
  const lt = t - s.start;
  const dur = s.end - s.start;
  const F: RecapFonts = { ...RECAP_FONTS, ...(assets.fonts ?? {}) };
  const r: RenderCtx = { model, assets, F, t };

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.direction = 'ltr';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  const prev = index > 0 ? model.scenes[index - 1] : null;
  const mixIn = prev ? easeInOutCubic(prog(lt, 0, 0.55)) : 1;
  if (prev && mixIn < 1) drawBackground(ctx, prev, t);
  ctx.globalAlpha = mixIn;
  drawBackground(ctx, s, t);
  ctx.globalAlpha = 1;
  drawAmbient(ctx, s, t);

  const last = index === model.scenes.length - 1;
  const exit = last ? 0 : easeInCubic(prog(lt, dur - 0.36, 0.36));
  ctx.save();
  ctx.globalAlpha = 1 - exit;
  if (exit > 0) { ctx.translate(CX, RECAP_H / 2); ctx.scale(1 - 0.04 * exit, 1 - 0.04 * exit); ctx.translate(-CX, -RECAP_H / 2 - 50 * exit); }
  drawSceneContent(ctx, s, lt, r);
  ctx.restore();

  // Light flash on the musical hits.
  for (const hit of model.hits) {
    const f = t - hit;
    if (f >= 0 && f < 0.7) {
      const a = (1 - f / 0.7) ** 2;
      glow(ctx, CX, RECAP_H * 0.45, 1400 * (0.6 + f), '#FFFFFF', 0.55 * a);
    }
  }

  drawVignette(ctx);
  drawGrain(ctx, assets, t);
  drawChrome(ctx, model, t, index, assets, F.body);
  ctx.restore();
}

/** Time at which the summary card is fully on screen (for the "share as image" PNG). */
export function summaryStillTime(model: RecapModel): number {
  const s = model.scenes.find((x) => x.kind === 'summary');
  return s ? Math.min(s.end - 0.5, s.start + 2.6) : model.duration / 2;
}

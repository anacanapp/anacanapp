// Ported from: src/lib/recap/recap.test.ts (recordingContext) — fixture generator, not app code.
//
// Renders frames of the TypeScript-built recap models (app/test/domain/fixtures/recap.json) with
// src/lib/recap/render.ts into a recording context whose log format equals RecordingRecapCtx
// (app/lib/features/recap/recap_canvas.dart), and writes render_log.json.gz next to this file.
// Run from the repository root:  npx tsx app/test/features/recap/fixtures/gen_render_log.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { renderRecapFrame } from '../../../../../src/lib/recap/render';
import type { RecapModel } from '../../../../../src/lib/recap/types';

const here = resolve('app/test/features/recap/fixtures');
const cases = JSON.parse(readFileSync(resolve('app/test/domain/fixtures/recap.json'), 'utf8')) as Array<{ name: string; lang: string; model: RecapModel }>;

const fmt = (v: unknown): string => {
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.floor(v * 1000 + 0.5)) : String(v);
  if (v && typeof v === 'object' && 'kind' in (v as object)) {
    const g = v as { kind: string; args: number[]; stops: Array<[number, string]> };
    if (g.kind === 'pattern') return '[pattern]';
    return `${g.kind} ${g.args.map(fmt).join(',')} ${g.stops.map(([o, c]) => `${fmt(o)} ${c}`).join(';')}`;
  }
  if (v === undefined) return 'null';
  return String(v);
};

function recorder() {
  const log: string[] = [];
  type S = { alpha: number; composite: string; fill: unknown; stroke: unknown; lw: number; cap: string; join: string; dash: number[]; shc: string; shb: number; shy: number; font: string; ta: string; tb: string };
  let s: S = { alpha: 1, composite: 'source-over', fill: '#000000', stroke: '#000000', lw: 1, cap: 'butt', join: 'miter', dash: [], shc: 'rgba(0,0,0,0)', shb: 0, shy: 0, font: '400 10px sans-serif', ta: 'start', tb: 'alphabetic' };
  const stack: S[] = [];
  const L = (name: string, args: unknown[]) => log.push(`${name}(${args.map(fmt).join(',')})`);
  const state = () => `a=${fmt(s.alpha)} c=${s.composite} lw=${fmt(s.lw)} cap=${s.cap} dash=${s.dash.map(fmt).join('/')} sh=${s.shc}/${fmt(s.shb)}/${fmt(s.shy)} font=${s.font} ta=${s.ta} tb=${s.tb}`;
  const size = () => Number(/(\d+)px/.exec(s.font)?.[1] ?? 10);
  const gradient = (kind: string, args: number[]) => {
    const g = { kind, args, stops: [] as Array<[number, string]>, addColorStop: (o: number, c: string) => { g.stops.push([o, c]); } };
    return g;
  };
  const ctx = {
    get globalAlpha() { return s.alpha; }, set globalAlpha(v: number) { if (Number.isFinite(v) && v >= 0 && v <= 1) s.alpha = v; },
    get globalCompositeOperation() { return s.composite; }, set globalCompositeOperation(v: string) { s.composite = v; },
    get fillStyle() { return s.fill; }, set fillStyle(v: unknown) { s.fill = v; },
    get strokeStyle() { return s.stroke; }, set strokeStyle(v: unknown) { s.stroke = v; },
    get lineWidth() { return s.lw; }, set lineWidth(v: number) { if (Number.isFinite(v) && v > 0) s.lw = v; },
    get lineCap() { return s.cap; }, set lineCap(v: string) { s.cap = v; },
    get lineJoin() { return s.join; }, set lineJoin(v: string) { s.join = v; },
    get shadowColor() { return s.shc; }, set shadowColor(v: string) { s.shc = v; },
    get shadowBlur() { return s.shb; }, set shadowBlur(v: number) { if (Number.isFinite(v) && v >= 0) s.shb = v; },
    get shadowOffsetY() { return s.shy; }, set shadowOffsetY(v: number) { if (Number.isFinite(v)) s.shy = v; },
    get font() { return s.font; },
    set font(v: string) {
      // "700 66px \"Plus Jakarta Sans\", …" → "700 66px Plus Jakarta Sans" (RecapFont.css)
      const m = /^(\d+) (\d+(?:\.\d+)?)px (.*)$/.exec(v);
      s.font = m ? `${m[1]} ${m[2]}px ${m[3].split(',')[0].trim().replace(/^"|"$/g, '')}` : v;
    },
    get textAlign() { return s.ta; }, set textAlign(v: string) { s.ta = v; },
    get textBaseline() { return s.tb; }, set textBaseline(v: string) { s.tb = v; },
    direction: 'ltr',
    setTransform: () => undefined,
    setLineDash: (d: number[]) => { s.dash = d.length % 2 ? [...d, ...d] : [...d]; },
    save: () => { stack.push({ ...s, dash: [...s.dash] }); L('save', []); },
    restore: () => { if (!stack.length) return; s = stack.pop()!; L('restore', []); },
    beginPath: () => L('beginPath', []),
    moveTo: (x: number, y: number) => L('moveTo', [x, y]),
    lineTo: (x: number, y: number) => L('lineTo', [x, y]),
    bezierCurveTo: (...a: number[]) => L('bezierCurveTo', a),
    quadraticCurveTo: (...a: number[]) => L('quadraticCurveTo', a),
    arc: (x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean) => L('arc', [x, y, r, a0, a1, !!ccw]),
    arcTo: (...a: number[]) => L('arcTo', a),
    rect: (...a: number[]) => L('rect', a),
    closePath: () => L('closePath', []),
    translate: (x: number, y: number) => L('translate', [x, y]),
    scale: (x: number, y: number) => L('scale', [x, y]),
    rotate: (a: number) => L('rotate', [a]),
    fill: () => L('fill', [s.fill, state()]),
    stroke: () => L('stroke', [s.stroke, state()]),
    clip: (rule?: string) => L('clip', [rule === 'evenodd']),
    fillRect: (x: number, y: number, w: number, h: number) => L('fillRect', [x, y, w, h, s.fill, state()]),
    fillText: (text: string, x: number, y: number, maxWidth?: number) => L('fillText', [text, x, y, maxWidth, s.fill, state()]),
    measureText: (text: string) => ({ width: [...text].length * size() * 0.55 }),
    drawImage: (img: { width: number; height: number }, x: number, y: number, w: number, h: number) => L('drawImage', [img.width, img.height, x, y, w, h, state()]),
    createLinearGradient: (...a: number[]) => gradient('lg', a),
    createRadialGradient: (...a: number[]) => gradient('rg', a),
    createPattern: () => ({ kind: 'pattern' }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

const assets = { logoWhite: { width: 300, height: 200 }, logoCoral: { width: 300, height: 200 }, grain: { width: 256, height: 256 } } as never;

/** Times: the middle of every scene, plus (mommy az) the start and the exit of every scene. */
const pick = (name: string, lang: string, full: boolean) => {
  const c = cases.find((x) => x.name === name && x.lang === lang)!;
  const times: number[] = [];
  c.model.scenes.forEach((s) => {
    const d = s.end - s.start;
    if (full) times.push(s.start + 0.15, s.end - 0.2);
    times.push(s.start + Math.min(2.4, d / 2));
  });
  return { name, lang, times, frames: times.map((t) => { const r = recorder(); renderRecapFrame(r.ctx, t, c.model, assets); return r.log; }) };
};

const out = [pick('mommy', 'az', true), pick('bump', 'az', false), pick('flow', 'az', false), pick('light', 'az', false), pick('flow', 'ar', false), pick('flow', 'ja', false), pick('mommy', 'ru', false)];
writeFileSync(resolve(here, 'render_log.json.gz'), gzipSync(JSON.stringify(out), { level: 9 }));
console.log(out.map((o) => `${o.name}/${o.lang}: ${o.frames.length} frames, ${o.frames.reduce((n, f) => n + f.length, 0)} lines`).join('\n'));

/**
 * Renders one dashboard story slide to a 1080x1920 image (Instagram story size) on a canvas, so it can be saved
 * or shared. Drawn directly (no DOM screenshot) so it works the same in the iOS/Android WebView and on the web:
 * text with ==mark== / __accent__ / **bold** markers, list and myth boxes, quiz answer, CTA pill, our SVG art and
 * the brand mascot (bundled asset, same origin). Fonts: Plus Jakarta Sans for headlines, Inter for text.
 */
import { STORY_MODULE_LABEL, STORY_THEMES, fillStory, parseStoryText, type Story, type StorySlide, type StoryTextPart } from '@/lib/stories';
import { illustration } from '@/components/stories/illustrations';

export const STORY_EXPORT_W = 1080;
export const STORY_EXPORT_H = 1920;
const PAD = 84;
const DISPLAY = '"Plus Jakarta Sans", Inter, system-ui, sans-serif';
const TEXT = 'Inter, system-ui, sans-serif';

type Ctx = CanvasRenderingContext2D;
type Run = { text: string; kind: StoryTextPart['kind'] };

async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  await Promise.allSettled([
    document.fonts.load(`800 100px ${DISPLAY}`, 'Aəğış'), document.fonts.load(`600 40px ${TEXT}`, 'Aəğış'),
    document.fonts.load(`700 40px ${TEXT}`, 'Aəğış'), document.fonts.load(`800 40px ${TEXT}`, 'Aəğış'),
  ]);
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('STORY_IMAGE'));
  img.src = src;
});
const svgImage = (svg: string) => loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`);

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Word-wraps rich text into lines of styled runs. */
function wrap(ctx: Ctx, parts: StoryTextPart[], font: (bold: boolean) => string, maxW: number): Run[][] {
  const words: Run[] = [];
  for (const p of parts) p.text.split(/(\s+)/).filter(Boolean).forEach((w) => words.push({ text: w, kind: p.kind }));
  const lines: Run[][] = [[]];
  let width = 0;
  for (const w of words) {
    ctx.font = font(w.kind === 'bold');
    const ww = ctx.measureText(w.text).width;
    const isSpace = /^\s+$/.test(w.text);
    if (!isSpace && width + ww > maxW && lines[lines.length - 1].length) { lines.push([]); width = 0; }
    if (isSpace && width === 0) continue;
    lines[lines.length - 1].push(w); width += ww;
  }
  return lines.map((l) => { while (l.length && /^\s+$/.test(l[l.length - 1].text)) l.pop(); return l; });
}

interface Theme { bg: string; ink: string; pop: string; popInk: string; chip: string; ink2: string; bg2: string; light?: boolean }

/** Draws rich text; returns the y below it. */
function drawRich(ctx: Ctx, th: Theme, text: string, x: number, y: number, maxW: number, size: number, opts: { display?: boolean; weight?: number; lh?: number; color?: string } = {}): number {
  const weight = opts.weight ?? (opts.display ? 800 : 600);
  const family = opts.display ? DISPLAY : TEXT;
  const font = (bold: boolean) => `${bold ? Math.max(weight, 800) : weight} ${size}px ${family}`;
  const lh = size * (opts.lh ?? 1.12);
  const lines = wrap(ctx, parseStoryText(text), font, maxW);
  ctx.textBaseline = 'alphabetic';
  const padX = size * 0.14;
  lines.forEach((line, i) => {
    let cx = x;
    const base = y + i * lh + size * 0.92;
    for (let k = 0; k < line.length; k++) {
      const r = line[k];
      if (r.kind === 'mark') {
        // One chip per run of highlighted words on this line, with breathing room on both sides.
        let j = k; let w = 0;
        while (j < line.length && line[j].kind === 'mark') { ctx.font = font(false); w += ctx.measureText(line[j].text).width; j++; }
        if (k > 0) cx += padX * 0.6;
        ctx.fillStyle = th.pop; roundRect(ctx, cx - padX, base - size * 0.9, w + padX * 2, size * 1.12, size * 0.22); ctx.fill();
        ctx.fillStyle = th.popInk;
        for (let m = k; m < j; m++) { ctx.font = font(false); ctx.fillText(line[m].text, cx, base); cx += ctx.measureText(line[m].text).width; }
        cx += padX * 1.6;
        k = j - 1;
        continue;
      }
      ctx.font = font(r.kind === 'bold');
      const w = ctx.measureText(r.text).width;
      ctx.fillStyle = r.kind === 'hl' ? th.pop : (opts.color ?? th.ink);
      ctx.fillText(r.text, cx, base);
      cx += w;
    }
  });
  return y + lines.length * lh;
}

const boxH = (ctx: Ctx, text: string, size: number, maxW: number, weight = 600) =>
  wrap(ctx, parseStoryText(text), (b) => `${b ? 800 : weight} ${size}px ${TEXT}`, maxW).length * size * 1.25;

export interface StoryExportOptions { mascotSrc?: string | null; quizAnswer?: number | null }

export async function renderStorySlide(story: Story, slideIndex: number, vars: Record<string, string>, opts: StoryExportOptions = {}): Promise<Blob> {
  const sl: StorySlide = story.slides[slideIndex];
  const th = (STORY_THEMES as Record<string, Theme>)[story.theme] ?? STORY_THEMES.coral;
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = STORY_EXPORT_W; canvas.height = STORY_EXPORT_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('STORY_CANVAS');
  const W = STORY_EXPORT_W, H = STORY_EXPORT_H, maxW = W - PAD * 2;
  const f = (t?: string) => fillStory(t, vars);
  const artInk = th.light ? th.ink : '#ffffff';

  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);

  // Header: Anacan badge + module, like the in-app story.
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(PAD + 36, 120, 36, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FF5A5F'; ctx.font = `800 38px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillText('A', PAD + 36, 134); ctx.textAlign = 'left';
  ctx.fillStyle = th.ink; ctx.font = `700 34px ${TEXT}`; ctx.fillText('Anacan', PAD + 92, 132);
  const nameW = ctx.measureText('Anacan').width;
  ctx.globalAlpha = 0.72; ctx.font = `500 34px ${TEXT}`; ctx.fillText(`· ${STORY_MODULE_LABEL[story.module]}`, PAD + 104 + nameW, 132); ctx.globalAlpha = 1;

  let y = 230;
  const kicker = () => {
    if (!sl.kicker) return;
    ctx.globalAlpha = 0.8; ctx.fillStyle = th.ink; ctx.font = `700 32px ${TEXT}`;
    ctx.fillText(f(sl.kicker).toLocaleUpperCase('az-AZ').split('').join(' '), PAD, y + 30); ctx.globalAlpha = 1; y += 70;
  };
  const title = (size: number) => { if (sl.title) y = drawRich(ctx, th, f(sl.title), PAD, y, maxW, size, { display: true, lh: 1.08 }) + 24; };
  const source = () => {
    if (!story.source || !['list', 'alert', 'myth', 'fact'].includes(sl.t)) return;
    ctx.globalAlpha = 0.7; ctx.fillStyle = th.ink; ctx.font = `600 28px ${TEXT}`; ctx.fillText(`Mənbə: ${story.source}`, PAD, y + 36); ctx.globalAlpha = 1; y += 60;
  };
  const chipBox = (x: number, yy: number, w: number, h: number, r = 44) => { ctx.fillStyle = th.chip; roundRect(ctx, x, yy, w, h, r); ctx.fill(); };

  switch (sl.t) {
    case 'cover': kicker(); title(sl.size === 'm' ? 78 : sl.size === 'l' ? 92 : 112); break;
    case 'fact': {
      kicker();
      ctx.fillStyle = th.ink; ctx.font = `800 250px ${DISPLAY}`;
      const v = f(sl.value); ctx.fillText(v, PAD - 6, y + 220);
      const vw = ctx.measureText(v).width;
      if (sl.unit) { ctx.font = `800 60px ${DISPLAY}`; ctx.fillText(f(sl.unit), PAD + vw + 16, y + 220); }
      y += 270;
      y = drawRich(ctx, th, f(sl.body), PAD, y, maxW, 42, { lh: 1.35 }) + 10; source();
      break;
    }
    case 'list': {
      kicker(); title(84);
      (sl.items ?? []).forEach((it, i) => {
        const text = f(it), tw = maxW - 160, h = Math.max(110, boxH(ctx, text, 40, tw) + 56);
        chipBox(PAD, y, maxW, h, 48);
        ctx.fillStyle = th.pop; ctx.beginPath(); ctx.arc(PAD + 66, y + h / 2, 34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = th.popInk; ctx.font = `800 36px ${TEXT}`; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), PAD + 66, y + h / 2 + 13); ctx.textAlign = 'left';
        drawRich(ctx, th, text, PAD + 124, y + (h - boxH(ctx, text, 40, tw)) / 2 - 4, tw, 40, { lh: 1.25 });
        y += h + 22;
      });
      source();
      break;
    }
    case 'myth': {
      ctx.globalAlpha = 0.8; ctx.fillStyle = th.ink; ctx.font = `700 32px ${TEXT}`; ctx.fillText('MİF VƏ FAKT', PAD, y + 30); ctx.globalAlpha = 1; y += 70;
      for (const [lbl, text, fact] of [['MİF', f(sl.myth), false], ['FAKT', f(sl.fact), true]] as const) {
        const h = boxH(ctx, text, 46, maxW - 96, 700) + 150;
        chipBox(PAD, y, maxW, h, 60);
        ctx.font = `800 30px ${TEXT}`; const lw = ctx.measureText(lbl).width + 48;
        ctx.fillStyle = fact ? th.pop : th.ink2; roundRect(ctx, PAD + 48, y + 44, lw, 54, 27); ctx.fill();
        ctx.fillStyle = fact ? th.popInk : th.bg2; ctx.fillText(lbl, PAD + 72, y + 82);
        drawRich(ctx, th, text, PAD + 48, y + 120, maxW - 96, 46, { weight: 700, lh: 1.25 });
        y += h + 28;
      }
      source();
      break;
    }
    case 'quiz': {
      kicker(); title(80);
      (sl.options ?? []).forEach((o, i) => {
        const ok = i === sl.correct;
        const h = 128;
        ctx.lineWidth = 5; ctx.strokeStyle = ok ? th.pop : th.ink;
        if (ok) { ctx.fillStyle = th.pop; roundRect(ctx, PAD, y, maxW, h, 48); ctx.fill(); }
        else { ctx.globalAlpha = 0.5; roundRect(ctx, PAD, y, maxW, h, 48); ctx.stroke(); ctx.globalAlpha = 1; }
        drawRich(ctx, th, `${f(o)}${ok ? '  ✓' : ''}`, PAD + 44, y + 38, maxW - 88, 40, { weight: 700, color: ok ? th.popInk : th.ink });
        y += h + 22;
      });
      if (sl.explain) y = drawRich(ctx, th, f(sl.explain), PAD, y + 10, maxW, 38, { lh: 1.35 }) + 10;
      break;
    }
    case 'alert': {
      kicker(); title(80);
      (sl.items ?? []).forEach((it) => {
        const text = f(it), tw = maxW - 120, h = Math.max(104, boxH(ctx, text, 42, tw, 700) + 50);
        chipBox(PAD, y, maxW, h, 44);
        ctx.fillStyle = th.pop; ctx.beginPath(); ctx.arc(PAD + 52, y + h / 2, 14, 0, Math.PI * 2); ctx.fill();
        drawRich(ctx, th, text, PAD + 92, y + (h - boxH(ctx, text, 42, tw, 700)) / 2 - 4, tw, 42, { weight: 700, lh: 1.25 });
        y += h + 20;
      });
      source();
      break;
    }
    case 'quote': {
      if (sl.badge) { ctx.font = `800 32px ${TEXT}`; const bw = ctx.measureText(`✦ ${sl.badge}`).width + 56; chipBox(PAD, y, bw, 70, 35); ctx.fillStyle = th.ink; ctx.fillText(`✦ ${sl.badge}`, PAD + 28, y + 46); y += 110; }
      ctx.fillStyle = th.pop; ctx.font = `800 200px ${DISPLAY}`; ctx.fillText('“', PAD - 8, y + 150); y += 140;
      y = drawRich(ctx, th, f(sl.quote), PAD, y, maxW, 72, { display: true, lh: 1.18 }) + 20;
      if (sl.src) { ctx.globalAlpha = 0.7; ctx.fillStyle = th.ink; ctx.font = `600 30px ${TEXT}`; ctx.fillText(sl.src, PAD, y + 30); ctx.globalAlpha = 1; y += 60; }
      break;
    }
    case 'cta': {
      kicker(); title(84);
      y = drawRich(ctx, th, f(sl.body), PAD, y, maxW, 42, { lh: 1.35 }) + 30;
      if (sl.cta) {
        ctx.font = `800 40px ${TEXT}`; const label = `${sl.cta.label}  →`; const bw = ctx.measureText(label).width + 100;
        ctx.fillStyle = th.ink2; roundRect(ctx, PAD, y, bw, 120, 60); ctx.fill();
        ctx.fillStyle = th.bg2; ctx.fillText(label, PAD + 50, y + 74); y += 150;
      }
      break;
    }
  }

  // Art at the bottom: the mascot when the slide asks for it, else our SVG (skipped when the text needs the room).
  const footer = H - 110;
  const room = footer - y - 40;
  try {
    if (sl.mascot && opts.mascotSrc) {
      const img = await loadImage(opts.mascotSrc);
      const size = Math.min(W * 0.86, room);
      if (size > 300) ctx.drawImage(img, (W - size) / 2, footer - size + 40, size, size);
    } else {
      const name = sl.illus ?? (['fact', 'quote', 'myth'].includes(sl.t) || (sl.t === 'list' && (sl.items?.length ?? 0) <= 3) ? (sl.t === 'quote' ? 'blob' : story.illus) : null);
      if (name && room > 320) {
        const img = await svgImage(illustration(name, th.pop, artInk));
        const peek = sl.t === 'cover';
        const w = peek ? W : Math.min(W * 0.72, room * 1.44);
        const h = w * (img.height / img.width || 0.69);
        const drawH = Math.min(h, peek ? room + 110 : room);
        const drawW = drawH * (w / h);
        ctx.drawImage(img, (W - drawW) / 2, (peek ? H : footer) - drawH, drawW, drawH);
      }
    }
  } catch { /* art is decorative; the text still exports */ }

  // Brand footer.
  ctx.globalAlpha = 0.85; ctx.fillStyle = th.light ? th.ink : '#ffffff'; ctx.font = `700 30px ${TEXT}`; ctx.textAlign = 'right';
  ctx.fillText('anacan.az', W - PAD, H - 56); ctx.textAlign = 'left'; ctx.globalAlpha = 1;

  return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('STORY_EXPORT'))), 'image/jpeg', 0.93));
}

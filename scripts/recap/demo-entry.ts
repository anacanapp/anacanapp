/**
 * Browser entry for the Recap demo renderer (bundled by scripts/recap/render-demo.mjs with esbuild).
 * It exposes the very same renderer the app uses (src/lib/recap) on window.recapDemo.
 */
import { buildRecapModel, recapMusicNeeds, renderRecapFrame, RECAP_COPY, RECAP_H, RECAP_W, type RecapAssets, type RecapCopyKey, type RecapModel } from '@/lib/recap';
import { loadRecapFonts } from '@/lib/recap/font-loader';
import { RECAP_DEMO_LABELS_AZ, RECAP_PERSONAS } from '@/lib/recap/fixtures';

let model: RecapModel | null = null;
let assets: RecapAssets = {};
let ctx: CanvasRenderingContext2D | null = null;

function makeGrain(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d')!;
  const img = g.createImageData(256, 256);
  let a = 1234567;
  for (let i = 0; i < img.data.length; i += 4) {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    const v = a >>> 24;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

async function setup(opts: { persona: keyof typeof RECAP_PERSONAS; language: string; dict: Record<string, string>; logoWhite: string; logoCoral: string; fontUrls: Record<string, string> }) {
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  canvas.width = RECAP_W; canvas.height = RECAP_H;
  ctx = canvas.getContext('2d')!;
  const [logoWhite, logoCoral] = await Promise.all([loadImage(opts.logoWhite), loadImage(opts.logoCoral)]);
  assets = { logoWhite, logoCoral, grain: makeGrain() };
  const t = (key: RecapCopyKey) => opts.dict[key] ?? RECAP_COPY[key];
  model = buildRecapModel(RECAP_PERSONAS[opts.persona], opts.language, t, { labels: RECAP_DEMO_LABELS_AZ });
  const brand = await loadRecapFonts(model, { resolveUrl: (u) => opts.fontUrls[u] ?? u, timeoutMs: 15000 });
  await document.fonts.load('600 40px Inter', 'Aə2026');
  const fontOk = brand && document.fonts.check('700 64px Switzer', 'A') && document.fonts.check('600 40px Inter', 'A');
  const needs = recapMusicNeeds(RECAP_PERSONAS[opts.persona], opts.language, t, { labels: RECAP_DEMO_LABELS_AZ });
  return { duration: model.duration, fadeStart: model.fadeStart, scenes: model.scenes.map((s) => ({ id: s.id, kind: s.kind, start: s.start, end: s.end })), fontOk, needs, persona: model.persona };
}

function frame(t: number, type = 'image/jpeg', quality = 0.95): string {
  renderRecapFrame(ctx!, t, model!, assets);
  return (ctx!.canvas as HTMLCanvasElement).toDataURL(type, quality).split(',')[1];
}

(window as unknown as { recapDemo: unknown }).recapDemo = {
  setup,
  frames: (times: number[], type?: string, quality?: number) => times.map((t) => frame(t, type, quality)),
};

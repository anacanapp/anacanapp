/**
 * Registers the Recap brand fonts with FontFace and waits until the faces the video needs are loaded,
 * so the first rendered/exported frame already uses Plus Jakarta Sans / Switzer / Inter.
 * DOM only; shared by the in-app player, the exporter and the demo pipeline.
 */
import { RECAP_FONT_FACES, RECAP_FONT_PROBES } from './fonts';
import type { RecapModel } from './types';

let registered: Promise<void> | null = null;

function register(resolveUrl: (url: string) => string): Promise<void> {
  if (registered) return registered;
  registered = (async () => {
    if (typeof FontFace === 'undefined' || !document.fonts) return;
    for (const face of RECAP_FONT_FACES) {
      try {
        const ff = new FontFace(face.family, `url(${resolveUrl(face.url)})`, { weight: face.weight, style: 'normal', ...(face.unicodeRange ? { unicodeRange: face.unicodeRange } : {}) });
        document.fonts.add(ff);
      } catch { /* a missing face falls back to the next family */ }
    }
  })();
  return registered;
}

/** Every character the video will draw, so only the needed unicode-range subsets are fetched. */
export function recapTextSample(model: RecapModel): string {
  const chars = new Set<string>('Anacan0123456789 →+%:·—'.split(''));
  const add = (v: unknown) => {
    if (typeof v === 'string') for (const ch of v) chars.add(ch);
    else if (Array.isArray(v)) v.forEach(add);
    else if (v && typeof v === 'object') Object.values(v).forEach(add);
  };
  model.scenes.forEach(add);
  return [...chars].join('');
}

/**
 * Loads the brand fonts (and the Noto fallbacks the language needs). Resolves true when the display face is
 * ready; never throws and never waits longer than `timeoutMs`.
 */
export async function loadRecapFonts(model: RecapModel | null, opts: { resolveUrl?: (url: string) => string; timeoutMs?: number } = {}): Promise<boolean> {
  try {
    if (typeof document === 'undefined' || !document.fonts) return false;
    await register(opts.resolveUrl ?? ((u) => u));
    const sample = model ? recapTextSample(model) : 'Aə2026';
    const probes = [...RECAP_FONT_PROBES];
    if (model && /[Ѐ-ӿ]/.test(sample)) probes.push('400 64px "Recap Noto Sans"', '700 64px "Recap Noto Sans"');
    if (model?.rtl) probes.push('400 64px "Recap Noto Naskh Arabic"', '700 64px "Recap Noto Naskh Arabic"');
    await Promise.race([
      Promise.all(probes.map((p) => document.fonts.load(p, sample).catch(() => []))).then(() => document.fonts.ready),
      new Promise((r) => setTimeout(r, opts.timeoutMs ?? 4000)),
    ]);
    return document.fonts.check('800 64px "Plus Jakarta Sans"', 'A');
  } catch {
    return false;
  }
}

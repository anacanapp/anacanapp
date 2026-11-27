/** Easing, interpolation and a seeded PRNG for the recap renderer (no Math.random, no clock). */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0→1 progress of `t` inside [start, start + duration]. */
export const prog = (t: number, start: number, duration: number) => clamp01((t - start) / Math.max(1e-6, duration));

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t: number) => Math.pow(clamp01(t), 3);
export const easeInOutCubic = (t: number) => { const x = clamp01(t); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeOutExpo = (t: number) => { const x = clamp01(t); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
export const easeOutBack = (t: number, s = 1.6) => { const x = clamp01(t) - 1; return 1 + (s + 1) * x * x * x + s * x * x; };
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - clamp01(t), 5);

/** Mulberry32: fast, deterministic, good enough for visuals. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hex colour → rgba string with alpha. */
export function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

/** Mix two hex colours. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace('#', ''), 16), pb = parseInt(b.replace('#', ''), 16);
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, clamp01(t)));
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

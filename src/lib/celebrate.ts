import { hapticFeedback } from './native';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const lite = () => typeof document !== 'undefined' && document.documentElement.classList.contains('a-lite');

/** Brand-coloured confetti burst on a throwaway full-screen canvas. Skipped on reduced motion / low-end devices. */
export function confetti(): void {
  if (typeof document === 'undefined' || reduced() || lite()) return;
  const cv = document.createElement('canvas');
  cv.className = 'a3-confetti';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  const ctx = cv.getContext('2d');
  if (!ctx) { cv.remove(); return; }
  const cs = getComputedStyle(document.documentElement);
  const colors = ['--a-coral', '--a-pink-ink', '--a-lav-ink', '--a-yellow-2', '--a-green-2', '--a-blue-2'].map((v) => cs.getPropertyValue(v).trim() || '#ff5a5f');
  const W = cv.width, H = cv.height;
  const parts = Array.from({ length: 140 }, () => ({
    x: W / 2, y: H * 0.35, vx: (Math.random() - 0.5) * 18 * dpr, vy: (-Math.random() * 16 - 6) * dpr,
    s: (4 + Math.random() * 5) * dpr, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  void hapticFeedback.medium();
  const frame = (t: number) => {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.55 * dpr; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
    }
    if (t - t0 < 2200) requestAnimationFrame(frame); else cv.remove();
  };
  requestAnimationFrame(frame);
}

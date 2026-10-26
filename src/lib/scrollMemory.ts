/**
 * Scroll yaddaşı — alət/səhifə/bloqa keçəndə əvvəlki ekranın scroll
 * pozisiyasını saxlayır, GERİ qayıdanda bərpa edir.
 *
 * useScrollToTop mount-da 0/rAF/60ms-də yuxarı sıfırlayır — bərpa
 * cəhdləri 80ms və 180ms-də təkrarlanır ki, resetdən SONRA qalib gəlsin.
 */

const mem = new Map<string, number>();
let restoreGeneration = 0;

/** A new reader/navigation must not receive an earlier screen's delayed restore. */
export function cancelScrollRestoration(): void {
  restoreGeneration++;
}

const defaultContainer = (): HTMLElement | null =>
  (document.querySelector('[data-scroll-container]') as HTMLElement | null) ||
  (document.querySelector('.a-scope.overflow-y-auto') as HTMLElement | null);

/** Cari scroll pozisiyasını yadda saxla (keçiddən ƏVVƏL çağırılmalıdır). */
export function saveScroll(key: string, el?: HTMLElement | null): void {
  try {
    const c = el ?? defaultContainer();
    if (c) mem.set(key, c.scrollTop);
  } catch { /* boş */ }
}

/** Yadda saxlanan pozisiyanı bərpa et (remount resetlərinə davamlı). */
export function restoreScroll(key: string, el?: HTMLElement | null): void {
  const top = mem.get(key);
  if (top == null || top <= 0) return;
  const generation = ++restoreGeneration;
  const apply = () => {
    if (generation !== restoreGeneration) return;
    try {
      const c = el ?? defaultContainer();
      if (c && Math.abs(c.scrollTop - top) > 2) c.scrollTop = top;
    } catch { /* boş */ }
  };
  requestAnimationFrame(apply);
  window.setTimeout(apply, 80);
  window.setTimeout(apply, 180);
}

export function clearScroll(key: string): void {
  mem.delete(key);
}

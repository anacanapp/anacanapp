/**
 * RTL köməkçiləri — ərəb (və gələcək RTL dilləri) üçün istiqamət idarəetməsi.
 * Zero-flash prinsipi: dir İLK render-dən əvvəl (main.tsx bootstrap) təyin olunur.
 */
import { useUserStore } from '@/store/userStore';

export const RTL_LANGS = new Set(['ar']);

export const isRtlLang = (lang: string | null | undefined): boolean =>
  !!lang && RTL_LANGS.has(lang);

/** <html dir/lang> atributlarını təyin et — boot və dil dəyişmələrində çağırılır */
export function applyDocumentDirection(lang: string): void {
  try {
    const dir = isRtlLang(lang) ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
    if (dir === 'rtl') void ensureArabicWebFont();
  } catch { /* SSR-safe */ }
}

// ── Ərəb veb-şrifti (UI, PDF-dən ayrı) ──────────────────────────
// Noto Sans Arabic — Inter/Nunito ilə vizual uyğun, self-host (@fontsource, OFL-1.1).
// Yalnız ar dili aktiv olanda lazy yüklənir (Google Fonts CDN-dən asılı deyil —
// mobil şəbəkə/regional əlçatanlıq üçün daha etibarlı, PDF şriftləri ilə eyni prinsip).
let arabicWebFontLoaded = false;
async function ensureArabicWebFont(): Promise<void> {
  if (arabicWebFontLoaded) return;
  arabicWebFontLoaded = true;
  try {
    await Promise.all([
      import('@fontsource/noto-sans-arabic/arabic-400.css'),
      import('@fontsource/noto-sans-arabic/arabic-500.css'),
      import('@fontsource/noto-sans-arabic/arabic-600.css'),
      import('@fontsource/noto-sans-arabic/arabic-700.css'),
      import('@fontsource/noto-sans-arabic/arabic-800.css'),
    ]);
  } catch {
    arabicWebFontLoaded = false; // uğursuz olsa sonra yenidən cəhd edilə bilsin
  }
}

/** Reaktiv hook: cari dil RTL-dirmi? (komponent dil dəyişəndə yenidən render olunur) */
export function useIsRtl(): boolean {
  return useUserStore((s) => isRtlLang(s.language));
}

/**
 * Üfüqi (x) animasiya ofsetini RTL üçün güzgüləyir — "sağdan giriş" LTR-də sağdan,
 * RTL-də soldan olsun deyə. `motion.div`-lərin initial/animate/exit x dəyərləri üçün:
 *   x: rtlX(20, isRtl)  // LTR: 20 (sağdan), RTL: -20 (soldan)
 * Rəqəm və "N%"/"Npx" kimi string dəyərləri dəstəkləyir; digər dəyərlər toxunulmaz qalır.
 */
export function rtlX<T extends number | string>(value: T, isRtl: boolean): T {
  if (!isRtl) return value;
  if (typeof value === 'number') return -value as T;
  if (typeof value === 'string') {
    const m = value.match(/^(-?[\d.]+)(.*)$/);
    if (m) return (`${-parseFloat(m[1])}${m[2]}`) as T;
  }
  return value;
}

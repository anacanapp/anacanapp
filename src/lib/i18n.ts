import { supabase } from '@/integrations/supabase/client';
import azStatic from '@/locales/az.json';
import { ensureCopyLanguage } from './ui-copy';
import { writeStorageCache } from './local-storage';
import { APP_LANGUAGE_CODES, appLanguageLocale, normalizeAppLanguage, readAppLanguage, resolveAppLanguages, type AppLanguage } from './app-languages';
import { ensureContentLanguageReady } from './content-i18n';
export type { AppLanguage } from './app-languages';

// In-memory translation cache: { [lang]: { [key]: value } }
const translationCache: Record<string, Record<string, string>> = {};

// Synchronously seed ONLY the AZ cache from the bundled JSON so tr() returns
// expected language on the very first render after a reload — no waiting on
// the network. AZ is the universal default/fallback (localStorage.getItem
// ('language') || 'az' pattern used app-wide), so it alone must stay a
// STATIC import (eager, ~461KB in the main chunk).
//
// QEYD (bundle ölçüsü audit tapıntısı): əvvəllər EN də (~525KB) burada
// statik import edilirdi — 2 dil JSON-u BİRLİKDƏ əsas JS chunk-ın ~37%-ni
// təşkil edirdi, dilindən asılı olmayaraq HƏR istifadəçi bunu yükləyirdi.
// EN artıq aşağıdakı ru/tr/kk/de/ar ilə EYNİ "lazy seed" modelinə keçirilib
// (bax SEED_LANGS + loadLocalSeed) — yalnız EN seçən istifadəçilər yükləyir.
// PERF/yaddaş: bundle obyektinə BİRBAŞA istinad (spread ~461KB-lıq ikinci
// nüsxə yaradırdı). Təhlükəsizdir — translationCache dəyərləri heç vaxt yerində
// mutasiya olunmur; bütün birləşmələr yeni obyekt təyin edir (bax aşağı).
translationCache['az'] = azStatic as Record<string, string>;

// ── Zero-flash dil yüklənməsi ──
// Problem: ru/tr/kk əvvəllər YALNIZ DB-dən (şəbəkə) gəlirdi → ilk render AZ görünürdü,
// sonra seçilmiş dilə "sıçrayırdı" (zəif internetdə saniyələrlə). Həll — 3 qat:
//   1) localStorage keşi: son uğurlu dəst sinxron hidratasiya olunur (aşağıda, modul yüklənən an)
//   2) Lokal seed chunk-ları: en/ru/tr/kk/de/ar seed-ləri bundle-ın hissəsidir (dynamic import, şəbəkəsiz)
//   3) DB overlay: admin düzəlişləri arxa planda gəlir və keşə yazılır
const SEED_LANGS = new Set<string>(APP_LANGUAGE_CODES.filter(language => language !== 'az'));
const LS_CACHE_PREFIX = 'anacan_i18n_cache:';
const seedLoads = new Map<string, Promise<void>>();
const seedLoaders = import.meta.glob<Record<string, string>>('../../scripts/i18n/*.seed.json', { import: 'default' });
let cacheGeneration = 0;

function hydrateFromLocalStorage(lang: string): boolean {
  try {
    const raw = localStorage.getItem(LS_CACHE_PREFIX + lang);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
      translationCache[lang] = { ...(translationCache[lang] || {}), ...parsed };
      // Keş həqiqətən mövcuddur — onunla birlikdə yazılmış imzanı bərpa et.
      const signature = localStorage.getItem(LS_SIGNATURE_PREFIX + lang);
      if (signature) persistedSignature.set(lang, signature);
      return true;
    }
  } catch { /* korlanmış keş — seed/DB yolu işləyəcək */ }
  return false;
}

// Persist edilmiş lüğətin kiçik imzası ayrıca açarda saxlanılır ki, məzmun
// dəyişməyibsə hər açılışda 0.6–1MB-lıq JSON.stringify + yazı təkrarlanmasın.
const LS_SIGNATURE_PREFIX = 'anacan_i18n_sig:';
const persistedSignature = new Map<string, string>();

/** Ucuz (yalnız hash, serializasiya yox) məzmun imzası: açar sayı + FNV-1a. */
function dictionarySignature(data: Record<string, string>): string {
  let hash = 0x811c9dc5, count = 0;
  const mix = (text: string) => {
    hash = Math.imul(hash ^ text.length, 16777619);
    for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  };
  for (const key in data) { count++; mix(key); mix(String(data[key])); }
  return `v1:${count}:${(hash >>> 0).toString(36)}`;
}

function persistToLocalStorage(lang: string): void {
  try {
    const data = translationCache[lang];
    if (data && Object.keys(data).length > 0) {
      const signature = dictionarySignature(data);
      if (persistedSignature.get(lang) === signature) return; // dəyişməyib — yazma
      if (writeStorageCache(localStorage, LS_CACHE_PREFIX + lang, JSON.stringify(data))) {
        persistedSignature.set(lang, signature);
        try { localStorage.setItem(LS_SIGNATURE_PREFIX + lang, signature); } catch { /* imza ixtiyaridir */ }
      }
    }
  } catch { /* kvota dolub — keşsiz davam (seed onsuz da lokaldır) */ }
}

// Modul yüklənən AN (React-dan əvvəl) persist dil üçün sinxron hidratasiya —
// ikinci açılışdan etibarən heç bir await olmadan düzgün dildə render olunur.
try {
  const bootLang = normalizeAppLanguage(localStorage.getItem('language'));
  if (SEED_LANGS.has(bootLang)) hydrateFromLocalStorage(bootLang);
} catch { /* SSR-safe */ }

/** Lokal seed chunk-ını yüklə (şəbəkəsiz — bundle assets). Mövcud dəyərlər üstün qalır. */
async function loadLocalSeed(lang: string): Promise<void> {
  if (!SEED_LANGS.has(lang)) return;
  if (seedLoads.has(lang)) return seedLoads.get(lang);
  const generation = cacheGeneration;
  const loading = (async () => {
    try {
    const load = seedLoaders[`../../scripts/i18n/${lang}.seed.json`];
    if (lang !== 'en' && !load) throw new Error('BUNDLED_UI_LANGUAGE_MISSING');
    const seed: Record<string, string> = lang === 'en' ? (await import('@/locales/en.json')).default : await load();
    // seed ALTDA — localStorage keşi / DB overlay dəyərləri üstün qalsın
    if (generation === cacheGeneration) translationCache[lang] = { ...seed, ...(translationCache[lang] || {}) };
    } catch (error) {
      if (generation === cacheGeneration) seedLoads.delete(lang);
      throw error;
    }
  })();
  seedLoads.set(lang, loading);
  return loading;
}

/**
 * İlk render-dən ƏVVƏL dilin hazır olmasını təmin edir (main.tsx boot gate).
 * az/en → dərhal (bundle); ru/tr/kk → localStorage keşi varsa dərhal,
 * yoxdursa lokal seed chunk-ı gözlənilir (şəbəkəsiz, millisaniyələr).
 */
export async function ensureLanguageReady(lang: string): Promise<void> {
  lang = normalizeAppLanguage(lang);
  // Redesign / Aptek / baby-care copy is one small chunk per language (ui-copy.ts).
  const copyReady = ensureCopyLanguage(lang);
  if (!SEED_LANGS.has(lang)) { await copyReady; return; }
  // A previous release's cache can be large but still miss newly added screens.
  // Merge this release's local seed once before the first translated render.
  await Promise.all([loadLocalSeed(lang), ensureContentLanguageReady(lang), copyReady]);
  persistSoon(lang); // növbəti açılış sinxron olsun
}

// Persisting stringifies the whole dictionary (~0.6–1 MB) synchronously. Keep it
// off the startup critical path and coalesce repeated requests per language.
const persistPending = new Set<string>();
function persistSoon(lang: string): void {
  if (persistPending.has(lang)) return;
  persistPending.add(lang);
  const run = () => { persistPending.delete(lang); persistToLocalStorage(lang); };
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback;
  if (idle) idle(run, { timeout: 5000 }); else setTimeout(run, 1500);
}

const dbLoadedFor = new Set<string>();
const dbLoads = new Map<string, Promise<void>>();

/**
 * Overlay translations from the DB for a given language.
 * EN already has the static bundle preloaded; this just adds admin overrides.
 */
export async function loadTranslations(lang: string): Promise<void> {
  lang = normalizeAppLanguage(lang);
  if (dbLoadedFor.has(lang)) return;
  if (dbLoads.has(lang)) return dbLoads.get(lang);
  const generation = cacheGeneration;
  const dbPromise = (async () => {
    try {
      // Lokal seed HƏMİŞƏ birinci (prod daxil) — DB yalnız admin düzəlişləri üçün overlay-dır.
      await loadLocalSeed(lang);

      const overlay: Record<string, string> = {};
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;
      let succeeded = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('translations')
          .select('key, value')
          .eq('lang', lang)
          .range(from, from + batchSize - 1);
        if (error) { succeeded = false; break; }
        if (data) data.forEach(row => { overlay[row.key] = row.value; });
        hasMore = (data?.length ?? 0) === batchSize;
        from += batchSize;
      }
      if (generation !== cacheGeneration) return;
      translationCache[lang] = { ...(translationCache[lang] || {}), ...overlay };
      if (succeeded) dbLoadedFor.add(lang);
      // Birləşmiş dəsti keşlə — növbəti soyuq açılış sinxron və şəbəkəsiz olsun
      persistSoon(lang);
    } catch (err) {
      console.error('Translation load error:', err);
      // DB alınmasa belə seed-i keşlə (offline-first)
      persistSoon(lang);
    } finally {
      if (generation === cacheGeneration) dbLoads.delete(lang);
    }
  })();
  dbLoads.set(lang, dbPromise);
  return dbPromise;
}

export function getCachedTranslation(key: string, lang: string): string | undefined {
  return translationCache[lang]?.[key];
}

/** Bundled languages are available offline. Remote flags and tool restrictions
 * are merged by code without admitting languages missing from this build. */
export async function fetchActiveLanguages(): Promise<AppLanguage[]> {
  try {
    const { data, error } = await (supabase as any)
      .from('app_languages')
      .select('code, name, native_name, is_active, sort_order, disabled_tools')
      .order('sort_order', { ascending: true });
    if (error || !data?.length) return resolveAppLanguages();
    return resolveAppLanguages(data as AppLanguage[]);
  } catch {
    return resolveAppLanguages();
  }
}

/**
 * Cari seçilmiş dilin locale tag-ı (az-AZ / en-US / ru-RU / tr-TR).
 * Dil dəyişəndə tətbiq reload olunduğu üçün çağırış anında localStorage-dan oxumaq kifayətdir.
 */
export function getLocaleTag(): string {
  return appLanguageLocale(readAppLanguage());
}

export function clearTranslationCache(): void {
  cacheGeneration++;
  seedLoads.clear();
  Object.keys(translationCache).forEach(k => delete translationCache[k]);
  // Re-seed bundle (AZ yeganə statik idxaldır — bax yuxarı şərh). EN artıq
  // ru/tr/kk/de/ar kimi lazy seed-dir — çağıran kod (LanguageSelector.tsx/
  // InitialLanguageScreen.tsx) clearTranslationCache()-dən dərhal sonra
  // `code !== 'az'` olduqda `await ensureLanguageReady(code)` çağırır, bu da
  // EN daxil bütün lazy dilləri render-dən ƏVVƏL yenidən yükləyir.
  translationCache['az'] = azStatic as Record<string, string>;
  dbLoadedFor.clear();
  dbLoads.clear();
}

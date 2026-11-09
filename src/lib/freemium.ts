/**
 * Freemium siyasəti — bu BUILD-dən etibarən qüvvədədir.
 *
 * VACİB: Gating tamamilə klient kodundadır (DB flag-ları DƏYİŞMİR) —
 * köhnə versiyanı daşıyan cihazlara HEÇ BİR təsir yoxdur. Yeni siyasət
 * yalnız store update-dən sonra aktivləşir.
 *
 * FREE qalanlar (istifadəçi qərarı):
 *  - AI Chat, Community, Bloglar (tab/ekran səviyyəsində onsuz da açıqdır)
 *  - Daily infolar (hər 3 modulun dashboard məzmunu)
 *  - Bump dashboard: hero, tövsiyələr, bədən dəyişiklikləri, körpə inkişafı, trimester
 *  - Flow: hero, bugün üçün, gecikmə, period təqvimi, faza məsləhətləri, qarşıdan gələnlər
 *  - Alətlər: shop (ikinci əl), cakes, tövsiyə məhsullar, blog
 *  - first-aid free saxlanılıb (təcili tibbi məlumat — etik + App Store review).
 *  - 2026-11-05 (istifadəçi qərarı): Həkim və Klinikalar, Xəstəxana Çantası, Təhlükə Əlamətləri,
 *    Peyvənd Təqvimi, Körpə Albomu, Hamiləlik Albomu və Əhval Gündəliyi hamı üçün pulsuzdur
 *    (mərhələ aktivliyi tool_configs-də olduğu kimi qalır; DB is_premium da false edildi).
 *  - 2026-11-06: Süddən ayırma (weaning) pulsuz alətdir; içində yalnız fərdi plan təqvimi və
 *    xatırlatmalar Premium-dur.
 *  - 2026-11-09: Tərbiyə və Əlavə qida bələdçisi tam Premium-dur (aşağıdakı 2026-11-07 qeydi köhnədir).
 *  - 2026-11-07: Tərbiyə (parenting) pulsuz alətdir; içində tam kitabxana, bütün SOS kartları, proqramların
 *    4-cü günündən sonrası və testlərin ətraflı nəticələri Premium-dur (təhlükəsizlik siqnalları hamıya açıq).
 *  - mental-health (EPDS/əhval) free saxlanılıb — postpartum depressiya riski
 *    skrininqi first-aid ilə eyni etik prinsiplə pullu divarın arxasında qala bilməz
 *    (istifadəçi qərarı, Doğuşdan Sonra Sağalma planı).
 */

const FREE_TOOL_IDS = new Set<string>([
// Shop / kommersiya (cari vəziyyətdə qalır)
'cakes',
'secondhand-market', 'second-hand-market',
'affiliate', 'affiliate-products',
'blog',
// Mini oyunlar — pulsuz (istifadəçi qərarı)
'mini-games',
// Təhlükəsizlik istisnası
'first-aid',
// Əlavə qida bələdçisi 2026-11-04-dən Premium-dur (istifadəçi qərarı)
'mental-health',
// 2026-11-05: hamı üçün pulsuz (istifadəçi qərarı)
'doctors', 'hospital', 'danger-signs', 'vaccine-calendar', 'vaccines-calendar',
'baby-album', 'pregnancy-album', 'mood', 'mood-diary',
// 2026-11-06: Süddən ayırma — bələdçi, check-in və qırmızı bayraqlar pulsuz; fərdi plan təqvimi və
// xatırlatmalar alətin içində Premium-dur (PremiumBlurGate).
'weaning',
// 2026-11-09: Tərbiyə və Əlavə qida bələdçisi TAM Premium-dur (istifadəçi qərarı): free siyahıda deyil.
]
// Qeyd: Körpə izləyicisi (baby-tracker) 2026-11-08 istifadəçi qərarı ilə TAM Premium qalır.
);

/** Alət free siyahısındadır? */
export const isToolFree = (toolId: string): boolean => FREE_TOOL_IDS.has(toolId);

/**
 * 2026-11-08: "pulsuz · limitli" alətlər. Hamı aça bilər; alətin öz pulsuz limiti işləyir, qalanı alətin içindəki
 * Premium qapısının arxasındadır (Ağ səs: gündəlik dəqiqə limiti, Reseptlər və Əlavə qida: hər kateqoriyadan 3
 * resept, Bürc uyğunluğu: gündəlik analiz limiti).
 */
const FREE_LIMITED_TOOL_IDS = new Set<string>(['recipes', 'horoscope']);
/**
 * 2026-11-09: "Premium · baxış" alətləri (istifadəçi qərarı). Premium bölməsində durur, amma hamı açıb içinə baxa
 * bilir; səsi başlatmaq (Ağ səs) və ya foto yaratmaq (Fotosessiya) Premium tələb edir və paywall açır.
 */
const PREVIEW_TOOL_IDS = new Set<string>(['whitenoise', 'white-noise', 'photoshoot', 'baby-photoshoot']);
export const isPreviewTool = (toolId: string): boolean => PREVIEW_TOOL_IDS.has(toolId);
/**
 * Admin "limited_*" opens a tool for free users ONLY when the tool enforces its own free limit in code; otherwise a
 * limited setting would make it fully free (e.g. fairy-tale, noise-meter, weather-clothing, safety have no limit).
 */
const SELF_LIMITING_TOOL_IDS = new Set<string>([...FREE_LIMITED_TOOL_IDS]);
const adminLimited = (toolId: string, premiumType?: string | null) => isLimitedPremiumType(premiumType) && SELF_LIMITING_TOOL_IDS.has(toolId);

/** Admin "Premium tipi" (tool_configs.premium_type) dəyərləri: none | limited_total | limited_monthly | premium_only | full. */
export const isLimitedPremiumType = (premiumType?: string | null): boolean =>
  premiumType === 'limited_total' || premiumType === 'limited_monthly';

/** preview = Premium tool that free users may open and look at; its main action opens the paywall. */
export type ToolAccess = 'free' | 'limited' | 'preview' | 'premium';

/**
 * Hub-da aləti pulsuz istifadəçinin aça bilib-bilməyəcəyi:
 *  - mərhələ kilidi (flow/bump/mommy_locked) həmişə Premium;
 *  - kod free siyahısı + DB is_premium=false → 'free';
 *  - kod limitli siyahısı və ya admin premium_type limited_total/limited_monthly → 'limited' (alət açılır, limit içəridə);
 *  - qalan hər şey → 'premium'.
 */
export function toolAccess(input: { toolId: string; isPremiumFlag?: boolean | null; premiumType?: string | null; stageLocked?: boolean | null }): ToolAccess {
  if (input.stageLocked) return 'premium';
  if (isToolFree(input.toolId) && !input.isPremiumFlag) return 'free';
  if (PREVIEW_TOOL_IDS.has(input.toolId)) return 'preview';
  if (FREE_LIMITED_TOOL_IDS.has(input.toolId) || adminLimited(input.toolId, input.premiumType)) return 'limited';
  return 'premium';
}

/** Pulsuz istifadəçi aləti aça bilər (tam pulsuz və ya alət daxilində limitli). Yalnız tool id məlumdursa. */
export const canOpenToolFree = (toolId: string, premiumType?: string | null): boolean =>
  isToolFree(toolId) || FREE_LIMITED_TOOL_IDS.has(toolId) || PREVIEW_TOOL_IDS.has(toolId) || adminLimited(toolId, premiumType);

/**
 * Tortlar aləti yalnız Azərbaycan bazarı üçündür:
 * dil az/ru/kk/uz/ka VƏ ölkə AZ (ölkə seçilməyibsə köhnə AZ hesabları sayılır → açıq).
 * Qeyd: əsl məhdudiyyət ÖLKƏDİR (çatdırılma AZ-dadır); kk/uz/ka daxil edildi, çünki
 * cakes kontenti kk-ya tərcümə olunub (uz/ka ru körpüsü ilə görür) və AZ-dakı
 * kk/uz/ka-dilli istifadəçi sifariş verə bilər.
 */
export const isCakesAvailable = (countryCode?: string | null, language?: string | null): boolean => {
  const country = countryCode ?? null;
  const lang = language || 'az';
  const countryOk = country === null || country === 'AZ';
  const langOk = lang === 'az' || lang === 'ru' || lang === 'kk' || lang === 'uz' || lang === 'ka';
  return countryOk && langOk;
};

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
'weaning']
);

/** Alət free siyahısındadır? */
export const isToolFree = (toolId: string): boolean => FREE_TOOL_IDS.has(toolId);

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

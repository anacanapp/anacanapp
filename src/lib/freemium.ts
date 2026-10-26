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
 *    danger-signs istifadəçi qərarı ilə premium edildi.
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
'mental-health']
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

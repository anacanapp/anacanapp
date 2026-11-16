# Olivia.az mağazası (2026-11-16)

Sahibin tapşırığı: Olivia.az ilə e-commerce tərəfdaşlığı üçün Mağaza bölməsi və ana səhifə promoları, hələlik **yalnız admin üçün**,
Admin-dən 1 kliklə təmizlənə bilən.

## Necə qurulub

- **Məlumat:** `public.products`, `store = 'olivia'`, `is_active = false`. Sxem dəyişmədi (products artıq CDC + writer guard altındadır).
  RLS: "Anyone can view active products" aktiv olmayan sətirləri gizlədir, "Admins can manage products" adminlərə göstərir.
  Yoxlanıb: anon və adi istifadəçi 0 Olivia sətri görür, Aptek 52 sətri dəyişmədi.
- **Kataloq:** `src/data/olivia-products.json` (51 məhsul, 7 kolleksiya, qiymətlər olivia.az-dan 16.11.2026), şəkillər `public/olivia/<sku>.webp`.
  `oliviaImportRows()` və `supabase/migrations/20261116200000_olivia_admin_catalog.sql` eyni sətirləri yazır (seed `run-sql.py` ilə tətbiq olunub, passed).
- **Tətbiq:** `src/components/olivia/OliviaShop.tsx`
  - `OliviaShopSection`: mövcud `ShopScreen`-in yuxarısında, mərhələyə görə hero (`oliviaPlan` in `src/lib/olivia-shop.ts`), kolleksiyalar, axtarış, detal və səbət.
  - `OliviaHomeCard`: Bump (`Dashboard.tsx`), Mommy (`Dashboard.tsx`) və Flow (`FlowDashboard.tsx`) ana səhifələri; kart Mağazanı uyğun kolleksiyada açır.
  - Hamısı `isAdmin` yoxlayır; itki rejimində (`loss_recovery_active`) heç nə göstərilmir.
  - Səbət cihazda saxlanır (`anacan_olivia_basket_v1`). Birinci mərhələ: alış olivia.az-da, linklərdə `utm_source=anacan&utm_medium=app&utm_campaign=…`.
- **Admin:** Satış › "Olivia mağazası" (`AdminOliviaShop.tsx`): "Hamısını təmizlə" bütün Olivia sətirlərini 1 kliklə silir; "Kataloqu yüklə/yenilə"
  bundled kataloqu geri yazır (əvvəlcə silir, təkrar yaratmır). Qiymət/ad dəyişikliyi "Məhsullar" bölməsindən.
- **Analitika:** `olivia_shop_view`, `olivia_home_click`, `olivia_product_open`, `olivia_add`, `olivia_bundle_add`, `olivia_open_site`.

## Hamıya açmaq üçün (sahib təsdiqindən sonra)

1. Sətirləri `is_active = true` etmək (və ya importda `is_active: true`).
2. `OliviaShopSection`, `OliviaHomeCard`, `useOliviaProducts` və `ShopScreen`/`Index.tsx` `shop` ekranındakı `isAdmin` şərtlərini götürmək.
3. UI mətnləri hazırda yalnız Azərbaycancadır; digər dillər üçün `tr()` açarları lazımdır. Ölkə filtri (AZ) əlavə olunmalıdır.

## Deploy

- Gateway `sha256:09add35c…` (plan `olivia-web-plan.json`, version `50.0-olivia1`, index `4435c6c9…`), rollback:
  `sudo python3 /home/anacan-runner/deploy-current-web.py /home/anacan-runner/rollback-olivia-web-plan.json`, sonra `docker exec anacan-gateway nginx -s reload`.
- Native tətbiqdə növbəti build ilə gəlir.

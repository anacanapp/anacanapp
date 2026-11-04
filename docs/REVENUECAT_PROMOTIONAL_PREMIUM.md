# RevenueCat promotional Premium (hədiyyə Premium)

2026-11-04. İstifadəçiyə pulsuz/hədiyyə Premium vermək üçün **yeganə davamlı yol RevenueCat
promotional entitlement-dir**.

## Niyə profil bayrağı işləmir

- Tətbiq Premium-u `get_premium_access_v1` → `premium_grant_state_v1` ilə oxuyur.
  `subscriptions` sətri varsa o, avtoritetdir (`profiles.is_premium` yalnız sətir olmadıqda baxılır).
- Hər tətbiq açılışında `sync-revenuecat-entitlement` (`_shared/revenuecat-sync.ts`) RevenueCat-dən
  vəziyyəti oxuyur və `azure_apply_revenuecat_states` → `azure_sync_revenuecat_entitlement` ilə
  həm `subscriptions`-u, həm `profiles.is_premium/premium_until`-u yenidən yazır.
- Deməli bazada əl ilə (və ya admin panelindən) verilən Premium, RevenueCat-də hüquq yoxdursa,
  növbəti açılışda `free/expired` olur.

## Necə vermək

1. RevenueCat → Customers → App User ID = Supabase `auth.users.id` (tətbiq `Purchases.logIn(user.id)` edir).
2. **Grant entitlement** → `Anacan LLC Pro` (`ENTITLEMENT_ID`), istənilən müddət.
3. İstifadəçi tətbiqi açanda sinxronizasiya Premium-u yazır (bitmə tarixi RevenueCat-dən gəlir).

## Server konfiqurasiyası

RevenueCat promo hüququnu `rc_promo_<entitlement>_<duration>` məhsul adı ilə qaytarır
(məs. `rc_promo_Anacan LLC Pro_monthly`, `store: promotional`). `productConfiguration()` yalnız
`REVENUECAT_PRODUCT_PLANS_JSON`-dakı məhsulları qəbul edir, tanımadığını `unknown_product` ilə rədd edir.

Canlı Google functions env-ində (`/srv/anacan/runtime/secrets/functions.env`) bu map-a əlavə olunub
(eyni functions image `bb24700c…`, env-only recreate; əvvəlki env: `functions.env.before-rcpromo`):

| Məhsul | plan | kind |
| --- | --- | --- |
| `rc_promo_Anacan LLC Pro_{daily,three_day,weekly,monthly,two_month,three_month,six_month,yearly}` | `premium` | `subscription` |
| `rc_promo_Anacan LLC Pro_lifetime` | `premium` | `lifetime` |

Gələcək functions deploy-ları bu map girişlərini saxlamalıdır (env faylı yenidən qurularsa onları
itirməyin). Entitlement adı dəyişərsə məhsul adları da dəyişir — map yenilənməlidir.

Qeyd: promo `period_type: normal` olduğu üçün sinxronizasiya `confirm_referral=true` göndərir;
istifadəçinin referral qeydi varsa, promo da referral konversiyası sayıla bilər.

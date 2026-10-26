# İllik endirim və aylıq kofe təklifi — 2026-09-22

## Son istifadəçi qərarı

| Plan | İlk ödəniş | Yenilənmə |
| --- | --- | --- |
| İllik Premium | **$29.99 əvəzinə ilk il $19.99** | Sonra **$29.99/il** |
| Onboarding çıxış təklifi | Mövcud mağaza qiymətinə **aylıq Premium** (hazırkı müqavilədə $3.99) | Hər ay həmin mağaza qiyməti |

İllik seçili paywall X ilə bağlananda, yaxud illik store sheet ləğv ediləndə,
**“Bir fincan kofe qiymətinə Premium”** aylıq təklifi hesabda bir dəfə göstərilir.
Artıq aylıq seçilibsə yenidən aylıq təklif açılmır. Aylıq təklifdən X/imtina pulsuz
davama aparır. Əvvəl təklif edilmiş $14.99 illik çıxış variantı ləğv olunub.

Yeni free trial yoxdur. Qiymət/valyuta/period/eligibility mağazadan oxunur; UI daha
ucuz qiymət göstərib başqa paketi almır. Məhsul hazır deyilsə pulsuz davam mümkündür.
**Mağaza qiymət və offer konfiqurasiyasını konsolda tamamlamaq tələb olunur.**

## App Store Connect

**Apps → Anacan → Subscriptions → mövcud Premium subscription group**:

1. Mövcud illik məhsul: **`com.atlasoon.anacan.premium.yearly`**.
2. Adi qiymət: **$29.99 / 1 year**. Region qiymətlərini də yoxlayın.
3. **Subscription Prices → View all Subscription Pricing → Introductory Offers**:
   köhnə Free Trial təkliflərini bağlayın; gələcəyə planlananları da yoxlayın.
4. İllik məhsulda **Pay up front** introductory offer yaradın:
   **1 year / bir dövr / $19.99**. Sonra məhsulun adi **$29.99/year** qiyməti işləyir.
5. Aylıq məhsul **`com.atlasoon.anacan.premium.monthly`** aktiv qalır; aylıq paid
   qiymətini saxlayın (hazırkı plan $3.99). Ona free trial əlavə etməyin.
6. Aktivlik tarixləri, ölkələr, localization və lazım olan review məlumatlarını tamamlayın.

Apple introductory offer-i uyğun alıcıya avtomatik tətbiq edir. İndi endirim illik
planın özündə göstərildiyindən ayrıca illik exit məhsulu lazım deyil.
Eligibility uyğun deyilsə kod adi mağaza qiymətini göstərir; unknown olduqda
endirimi uydurmur. Alışdan əvvəl eligibility yenidən yoxlanır və sistem payment
sheet son şərtləri göstərir.

## Google Play Console

**Anacan → Monetize with Play → Products → Subscriptions**:

1. **`com.atlasoon.anacan.premium.yearly` → `yearly-plan`**:
   auto-renewing **1 year**, adi qiymət **$29.99**.
2. Köhnə free-trial offer-ləri **Deactivate** edin; base plan aktiv qalır.
3. Həmin base plan-da **`onboarding-first-year`** offer-i yaradın:
   - Mağazanın müəyyən etdiyi yeni müştəri uyğunluğu (*New customer acquisition*).
   - Birinci mərhələ: **bir illik tək ödəniş / $19.99**.
   - Sonra base plan: **$29.99/year**.
   - Free phase və installment əlavə etməyin.
4. Gözlənən SDK option ID-si: **`yearly-plan:onboarding-first-year`**.
   Kod məhz bu ödənişli option-u seçir. `rc-ignore-offer` tag-ı avtomatik default
   seçimini əngəlləmək üçün istifadə oluna bilər; explicit seçimi bloklamır.
5. Aylıq **`com.atlasoon.anacan.premium.monthly` → `monthly-plan`** paid base plan-ı
   aktiv saxlayın. Kofe təklifi ayrıca ucuz SKU deyil, bu mövcud aylıq planın təqdimatıdır.

Offer rədd ediləndə kod başqa qiymətə avtomatik fallback alış etmir.

## RevenueCat

Mövcud project **`a3647ee8`**, entitlement **`Anacan LLC Pro`**;
iOS app **`appaedb35b823`**, Android app **`appcbfb47e107`**.

1. **Product catalog → Products**: mövcud monthly/yearly məhsulları və Google
   base plan-larının düzgün import olunduğunu yoxlayın.
2. Hər ikisi **`Anacan LLC Pro`** entitlement-inə bağlı qalır.
3. **`pricing_2026`** offering-ində:
   - **Monthly / `$rc_monthly`** → monthly məhsulu / `monthly-plan`.
   - **Annual / `$rc_annual`** → yearly məhsulu / `yearly-plan`.
4. Başqa offering-i `current` etmək və ya ayrıca RevenueCat Paywall dizaynı yaratmaq
   lazım deyil. Tətbiq custom UI və explicit paket/option seçimini istifadə edir.
5. Əvvəlki `onboarding_last_chance_2026` / `yearly.onboarding` variantını bu axına
   bağlamayın. Əgər konsolda artıq yaratmısınızsa, onun $14.99 təklifini bağlayın;
   mövcud müştərinin hüququnu/receipt-ini silməyin. Backend köhnə ID-ni bərpa üçün tanıyır.

Alış və restore-dan əvvəl SDK-nın Anacan user UUID-sinə bağlı olduğu yoxlanır.
Premium yalnız server təsdiqindən sonra açılır. Pending alış zamanı yenidən
ödəniş əvəzinə status/bərpa yoxlaması işləyir.

## Reklamsız Premium

Tətbiqin ana səhifəsində, Premium modalında və onboarding paywall-ında
**“Reklamları dayandırmaq üçün Premium olun”** çağırışı var. Aktiv Premium/trial/
household Premium üçün app kartı gizlənir; reklam siyasəti də Premium istifadəçiyə
reklam göstərmir. Naməlum entitlement yüklənərkən kart göstərilmir.

## Mövcud abunəçilər və yoxlama

Free trial offer-ini bağlamaq artıq başlamış trial-ın son tarixini geriyə dönük
dəyişmir. Native store expiry/renewal məlumatı əsasdır. Köhnə istifadəçilərin
qiymət cohort-ları [trial/pricing qeydi](TRIAL_AND_PRICING.md)-ndə izah olunur.

Yeni sandbox/license-test hesabında sistem payment sheet-də illik üçün
**bu gün $19.99 / 1 il / sonra $29.99**, aylıq üçün **mağazanın aylıq qiyməti**
görünməlidir. Ləğv, bərpa, intro-ya uyğun olmayan hesab və yerli valyuta da yoxlanmalıdır.
Mağaza konfiqurasiyasının SDK-ya yayılması vaxt ala bilər; RevenueCat Apple offer-i
üçün 24 saata qədər yayılma ehtimalını qeyd edir.

## Rəsmi mənbələr

- [Apple introductory offers](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions/)
- [Apple subscription pricing](https://developer.apple.com/help/app-store-connect/manage-subscriptions/manage-pricing-for-auto-renewable-subscriptions/)
- [Google subscriptions and offers](https://support.google.com/googleplay/android-developer/answer/12154973?hl=en)
- [RevenueCat offer selection and eligibility](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers)

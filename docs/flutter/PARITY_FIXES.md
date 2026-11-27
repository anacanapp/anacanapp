# React ilə qəsdən fərqlər və tapılan qüsurlar

Qərar (2026-11-27): köçürmədə tapılan qüsurlar Flutter-də düzəldilir. "Saxlanıb" yazılanlar hələ düzəldilməyib.

| Nə | Harada | Vəziyyət |
|---|---|---|
| Admin paneli tətbiq daxilində açılmır, veb admin linki açılır | `ProfileScreen`, `Index.tsx` | qərarla dəyişdirilib |
| Android `HealthVitals` yazısı | `HealthVitalsPlugin.kt` | Flutter-də işlək olacaq; cihazda yoxlanmalıdır |
| Android taymer vidceti manifestdə yoxdur, əlavə edilə bilmir | `TimerWidgetProvider.kt` | 9-cu mərhələdə qərar |
| iOS söz vidceti yenilənmir | iOS widget plagini | 9-cu mərhələdə düzəldiləcək |
| Sürüşdürərək geri qayıtma baxılan profildən əvvəl ekranı bağlayır (geri düyməsi əksinə) | `Index.tsx` | saxlanıb |
| Eyni anda tab və ekran dəyişəndə scroll yeri əvvəlki tabın açarı ilə yadda qalır | `Index.tsx` | saxlanıb |
| 8 dildə ~2 300 inline mətnin tərcüməsi paketdə yoxdur, DB-də yoxdursa Azərbaycanca görünür | i18n toxumları | saxlanıb |
| Yuxu reqressiyası tarixləri yay/qış vaxtı keçidində 23:00 və ya 01:00-a düşür | `sleep-predict.ts` `upcomingRegressions` | saxlanıb, düzəldilməlidir |
| Yanlış saxlanmış doğuş tarixi üçün "qalan gün" NaN qaytarır | `pregnancy-utils.ts` `getDaysUntilDue` | saxlanıb, düzəldilməlidir |
| Alış yoxlaması NaN qiyməti keçirir | `onboarding-billing.ts` `validatePaidPurchase` | saxlanıb, düzəldilməlidir |
| Vitamin günləri mətn kimi sıralanır | `VitaminTracker` | saxlanıb, düzəldilməlidir |
| Partnyora "su hədəfi" bildirişi praktiki olaraq heç vaxt getmir (stəkan sayı 2000 ilə müqayisə olunur) | `useDailyLogs` | saxlanıb, düzəldilməlidir |
| İlk veb açılış ekranında ağ loqo krem fonda görünmür | `index.html` bootstrap splash | Flutter-də 96 px loqo ekranı göstərilir |
| Ödəniş tarixçəsində yenilənmələr heç vaxt görünmür: kod plaqinin CustomerInfo-da olmayan `allPurchaseDatesByProduct` açarını oxuyur | `BillingScreen.tsx` `fetchPaymentHistory` | Flutter-də SDK-nın `allPurchaseDates` sahəsi oxunur |
| Ödəniş tarixçəsinin xətti `borderLeft` ilə çəkilir, RTL-də (ərəb) nöqtələrin əks tərəfində qalır | `BillingScreen.tsx` | Flutter-də xətt başlanğıc tərəfdədir |
| Qeydiyyatda moderator şəbəkə məhdudiyyəti xətası moderator mətni ilə göstərilmirdi (Flutter-də qarmaq qoşulmamışdı) | `AuthScreen.tsx` → `moderatorError` | Flutter-də `registerModerationFeature` qoşur |

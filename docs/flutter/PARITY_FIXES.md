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
| Gecikmə banneri `/ai-chat?prompt=` ünvanına keçir, belə marşrut yoxdur (404) | `PeriodDelayBanner.tsx` | Flutter-də AI tabı sualla doldurulmuş açılır (göndərilmir) |
| Körpə söhbətində 30 s saat çatdırılma ortasında yenidən başladırdı, açılış mesajı iki dəfə düşə bilirdi | `useBabyChat.ts` | Flutter-də bir dəfə çatdırılır |
| Dekret kalkulyatoru: ata + atalıq qaydaları seçiləndə `benefitResult.dailySalary` oxunur, ekran çökür | `MaternityCalculator.tsx` | Flutter-də "Ödəniş Qaydaları" kartı göstərilir |
| Döl inkişafı: yanlış skan tarixində həftə NaN olur, ekran çökür | `FetalGrowthTracker.tsx` | Flutter-də həftə və persentil "bilinmir" |
| Təpik seanslarının vaxtı həmişə 24 saat formatındadır (React `toLocaleTimeString`) | `KickCounter` | fərq qalır (12 saatlıq dillərdə) |
| Nailiyyət açılarkən istifadəçinin nailiyyətləri hələ yüklənməyibsə yoxlama boş siyahıya baxırdı (DB dublikat xətasına güvənirdi) | `useAchievements.ts` | Flutter-də əvvəl yüklənir |
| Körpə albomunda silmə təsdiqi brauzerin `window.confirm`-i idi | `BabyMonthlyAlbum.tsx` | Flutter-də tətbiq daxili dialoq (Ləğv / Sil) |
| Böyümə ölçülərində onluq vergül ("5,2") yazmaq olmurdu (number input) | `BabyGrowthTracker.tsx` | Flutter-də qəbul olunur |
| Söhbət siyahısında oxunmayan `last_message_at` tarixi `RangeError` atırdı | `ConversationListScreen.tsx` | Flutter-də boş vaxt göstərilir |
| Mesajlar və partnyor söhbətində status bar boşluğu itir (`.a-topbar` `.safe-area-top`-u ləğv edir) | `MessagesScreen.tsx` | Flutter-də yuxarı boşluq var |
| Oxunmamış mesaj sayına yalnız `discovery_language`-i tətbiq dilinə uyğun qruplar daxil olur | `useUnreadMessages.ts` | saxlanıb; sahibin qərarı gözlənilir |
| Paneldən açılmayan alətdə (`initialTool`, `fromDashboard` yox) geri çıxmaq üçün iki dəfə basmaq lazımdır | `ToolsHub.tsx` `handleBack` | saxlanıb |
| Pulsuz istifadəçiyə ilkin Premium alət açılanda modal siyahı budağında qalır, alətdən çıxana qədər görünmür (o vaxta qədər `PremiumToolBoundary` paywall-u göstərir) | `ToolsHub.tsx` | saxlanıb |
| `PremiumToolBoundary` paywall-u Flutter-də sətir içində çəkilirdi (alətlər tabında layout çökürdü); React-dakı kimi tam ekran qat olur | `premium_gates.dart` | Flutter düzəlişi |
| Recap kətanı en `max-width: 100%`-ə çatanda uzanır (hündürlük 100% qalır), 9:16 nisbəti pozulur | `RecapScreen.tsx` | Flutter-də nisbət saxlanır |
| Recap böyümə səhnəsində barlardan sonra `globalAlpha = 1` səhnədən çıxış solmasını ləğv edir | `lib/recap/render.ts` `drawGrowth` | saxlanıb |
| Qeydiyyatda moderator şəbəkə məhdudiyyəti xətası moderator mətni ilə göstərilmirdi (Flutter-də qarmaq qoşulmamışdı) | `AuthScreen.tsx` → `moderatorError` | Flutter-də `registerModerationFeature` qoşur |

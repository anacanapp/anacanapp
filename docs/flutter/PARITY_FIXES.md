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
| Məşq seriyası dünən bitəndə bir gün artıq sayılırdı (dünən 1 qeyd → 2) | `useExerciseLogs.ts` `getStreak` | Flutter-də hər gün bir dəfə |
| Psixi sağlamlıq: uğursuz `addMoodCheckin` söz verişi tutulmurdu (unhandled rejection) | `MentalHealthTracker.tsx` | Flutter-də səssiz tutulur (istifadəçi üçün eyni) |
| Ağlama tərcüməçisi yalnız WebM göndərə bilirdi (iOS-da işləmirdi) | `CryTranslator.tsx`, `analyze-cry` | `analyze-cry` `mimeType` qəbul edir (m4a/Ogg/WebM; yoxdursa WebM), Flutter m4a-nı üstün tutur (sahibin qərarı 2026-11-27) |
| Nəcis skaneri: native kamera/qalereya ləğv ediləndə sonra veb fayl seçici açılırdı | `PoopScanner.tsx` | Flutter-də açılmır |
| Nağıl: JSON olmayan xəta cavabında istifadəçi JSON parse xətasını görürdü | `FairyTaleGenerator.tsx` | Flutter-də "Failed to generate story" |
| Dekret kalkulyatoru: ata + atalıq qaydaları seçiləndə `benefitResult.dailySalary` oxunur, ekran çökür | `MaternityCalculator.tsx` | Flutter-də "Ödəniş Qaydaları" kartı göstərilir |
| Döl inkişafı: yanlış skan tarixində həftə NaN olur, ekran çökür | `FetalGrowthTracker.tsx` | Flutter-də həftə və persentil "bilinmir" |
| Təpik seanslarının vaxtı həmişə 24 saat formatındadır (React `toLocaleTimeString`) | `KickCounter` | fərq qalır (12 saatlıq dillərdə) |
| Nailiyyət açılarkən istifadəçinin nailiyyətləri hələ yüklənməyibsə yoxlama boş siyahıya baxırdı (DB dublikat xətasına güvənirdi) | `useAchievements.ts` | Flutter-də əvvəl yüklənir |
| Körpə albomunda silmə təsdiqi brauzerin `window.confirm`-i idi | `BabyMonthlyAlbum.tsx` | Flutter-də tətbiq daxili dialoq (Ləğv / Sil) |
| Böyümə ölçülərində onluq vergül ("5,2") yazmaq olmurdu (number input) | `BabyGrowthTracker.tsx` | Flutter-də qəbul olunur |
| Tarixlər: ay/gün adları 25 dilin 13-də React-dan fərqli idi (məs. az "5 yanvar" ↔ React "5 Yanvar"); indi React-ın date-fns adları | `date_utils.dart` (Flutter qüsuru) | düzəldilib; `date_fns_parity_test.dart` |
| ~60 sərt yazılmış mətn (Match, SOS, PREMIUM, story etiketləri, placeholder-lər) React-da tərcümə olunurdu | Flutter qüsuru | `trInline` ilə düzəldilib |
| React məlumat qüsuru: `settingsscreen_sil_27792d` və `safetylookup_ai_ile_axtaris_edin_780816` az/de/ar/ka/kk/uz-da tək `\`; `appearancescreen_vurgu` az-da xarab ("VurÄŸu"); `usestoryreplies_i_stifadeci_b6bdd6` az-da escape kodları | `src/locales/az.json`, `scripts/i18n/*.seed.json` | Flutter-də müvəqqəti həll; əsl düzəliş React mənbəsində, sonra `export.mjs` |
| Yeniləmə: məxfilik razılığı (`anacan_privacy_consent_v1`) 53.0 ixracında yox idi və hər yeniləmədə itirdi; indi hər açılışda Preferences-dən bərpa olunur (React kimi) | `privacy-consent.ts` / importer | düzəldilib |
| Yeniləmə: yeniləmə anında çıxış etmiş istifadəçinin cihazdakı məlumatları (göndərilməmiş qeydlər, planlar) atılırdı; indi bütün hesabların açarları idxal olunur | Flutter importer | düzəldilib |
| Native reklam kartı: `offer` kartının qırıq xətli haşiyəsi düz çəkilir; `minimal` kartın vurğu zolağı vahid haşiyənin içindədir | `NativeAdCard.tsx` | Flutter məhdudiyyəti |
| Reseptlər çıxış reklamı bütün `recipes_banner` səthləri ilə qeydə alınır (siyahını detaldan ayırmaq olmur) — siyahı açıq olanda da əvvəlcədən yüklənə bilər | `AdExperienceProvider.tsx` | boşluq |
| Story fasiləsi səthi ilk `opportunity()`-dən sonuncudan 60 s sonraya qədər saxlanılır | `StoryViewer.tsx` | boşluq |
| Brend ölçməsi: görünürlük IntersectionObserver əvəzinə hər 250 ms yoxlanır; native kreativlər "şəkil yükləndi" sayılır | `brand-measurement.ts` | yaxın ekvivalent |
| Push xəta hesabatlarında `runtime` sahəsi yoxdur (`FunctionException` cavab başlıqlarını vermir) | `push.ts` | boşluq |
| `device_tokens.device_name`: `navigator.userAgent` əvəzinə `<platform> - Anacan-Flutter (<os> <versiya>)` | `useDeviceToken.ts` | qəsdən |
| Kodlaşdırma: bir neçə faylda UTF-8 mətn Windows-1252 kimi oxunub yenidən yazılmışdı (qrup "İstifadəçi" ehtiyat adı daxil) | Flutter qüsuru | düzəldilib; `test/tooling/no_mojibake_test.dart` qoruyur |
| Sağlam Səbət (ərəbcə): düşən əşyalar və səbət inline-start + LTR sürüşmə ilə ekrandan çıxırdı | `SaglamSebetGame.tsx` | Flutter-də soldan, toxunuş hesabı ilə eyni |
| Birləşdir (ərəbcə): lövhə güzgülənirdi, swipe hesabı LTR qalırdı, səhv qonşu dəyişirdi | `BirlesdirGame.tsx` | Flutter-də lövhə LTR |
| Oyunlar: xəta toast-unda "Yenidən cəhd et" düyməsi yoxdur (dizayn sistemi toast-unda əməliyyat yeri yoxdur); React error boundary-ləri yoxdur | `components/games/*` | boşluq, düzəliş deyil |
| Hamiləlik itkisi pəncərəsi: brauzer tarix sahəsi əvəzinə native tarix seçici (son 365 gün, bu gündən gec olmayan) | `PregnancyLossSheet.tsx` | qəsdən |
| Profil kartından doğuş onboarding-i bitəndə səhifə yenidən yüklənmir; analıq rejiminə keçid ekranları yeniləyir | `ProfilePregnancyCard.tsx` | qəsdən |
| Temperatur siferblatı dar ekranda daşırdı | `IllnessSheets.tsx` | Flutter-də kiçilir |
| Endirim QR-ı: serverin xəta cavabları (`premium_required`, `cooldown`) ümumi xəta kimi göstərilirdi | `RedemptionQRSheet.tsx` | Flutter-də öz mesajı |
| Dar ekranlarda partnyor mağaza qiyməti, partnyorlar CTA-sı, tort sifarişi sətirləri daşırdı | partner-shop, partners, cakes | Flutter-də sıxılır |
| Epoint: Capacitor Browser "bağlandı" hadisəsi yoxdur; Android Custom Tabs + tətbiqə qayıdanda yoxlama, iOS Safari | `in-app-epoint.ts` | cihazda yoxlanmalıdır |
| Bloq məqaləsi: hero və geri düyməsi status bar altına düşürdü | `BlogPostDetail.tsx` | Flutter-də yuxarı boşluq var |
| Albom sifarişi Alətlər tabında: göndər çubuğu ekranın altına sabitlənib nav altında qalırdı | `AlbumOrderScreen.tsx` | Flutter-də səhifənin sonunda |
| Qabıq: məqalə açılanda swipe söndürülür və alt qat sıfırdan qurulurdu (yazılmamış mesaj itirdi) | `shell_scaffold.dart` (Flutter qüsuru) | düzəldilib |
| Partnyor ekranlarında `YYYY-MM-DD` tarixləri UTC gecəyarısı kimi oxunurdu (Qrinviçdən qərbdə yanlış gün) | xülasə, həftəlik statistika, sürprizlər | Flutter-də yerli gün |
| SOS pəncərəsi: Android geri arxadakı ekrana təsir edirdi | `MotherSOSSheet.tsx` | Flutter-də pəncərəni bağlayır |
| Partnyor missiyaları: ana ekran kartı və profil xalı ayrı nüsxələr idi, profil səviyyəsi gecikirdi | `usePartnerMissions` | Flutter-də bir ortaq vəziyyət |
| `usePartnerData`: hər komponentdə ayrıca sorğu + ilk yükləmədən dərhal sonra ikinci sorğu | `usePartnerData.ts` | Flutter-də bir ortaq sorğu |
| Story baxışı: Android geri əvvəl baxanlar/cavablar pəncərəsini, sonra baxışı bağlayır (React-da geri işləyicisi yox idi) | `StoryViewer.tsx` | Flutter düzəlişi |
| Story baxışı: sürüşdürmə həm də toxunuş sayılırdı (iki dəfə keçid) | `StoryViewer.tsx` | Flutter-də bir dəfə |
| Story redaktoru: başlıq seçimləri 390 px-də daşırdı | `StoryCropEditor.tsx` | Flutter-də yana sürüşür |
| Story şəkilləri PNG-dir (React JPEG 0.93–0.94) | `story-export.ts` | JPEG kodlayıcı paketi gələnə qədər |
| Qrup söhbəti: qrupdan çıxanda/silinəndə/üzvlük itəndə açıq dialoqlar bağlanır | `GroupChatScreen.tsx` | Flutter düzəlişi |
| İkinci əl bazarı: şəkli silmə düyməsi yalnız hover-də görünür, toxunma ekranında əlçatmazdır | `SecondHandMarket.tsx` | Flutter-də həmişə görünür |
| İcma lenti: əl ilə pəncərələnmiş DOM əvəzinə tənbəl native siyahı; son kart qurulanda növbəti səhifə yüklənir | `CommunityPostFeed.tsx` | qəsdən (performans) |
| Karuseldə videolar yalnız oynadılanda dekod olunur (ilk kadr önizləməsi yoxdur) | `MediaCarousel.tsx` | görünmə aşkarlama paketi olmadığı üçün |
| Emoji seçici: emoji-picker-react əvəzinə tez-tez işlənən emojilərin kiçik şəbəkəsi | `CreatePostScreen.tsx` | Flutter portu yoxdur |
| Qalereyadan "Endir" qalereya saxlama paketi olmadığı üçün xəta toastı göstərir | `PhotoGalleryViewer.tsx` | 9-cu mərhələ (`gal`) |
| Söhbət siyahısında oxunmayan `last_message_at` tarixi `RangeError` atırdı | `ConversationListScreen.tsx` | Flutter-də boş vaxt göstərilir |
| Mesajlar və partnyor söhbətində status bar boşluğu itir (`.a-topbar` `.safe-area-top`-u ləğv edir) | `MessagesScreen.tsx` | Flutter-də yuxarı boşluq var |
| Oxunmamış mesaj sayına yalnız `discovery_language`-i tətbiq dilinə uyğun qruplar daxil olurdu (inbox isə hamısını göstərir) | `useUnreadMessages.ts` | Flutter-də inbox-dakı bütün qruplar sayılır (sahibin qərarı 2026-11-27) |
| Paneldən açılmayan alətdə (`initialTool`, `fromDashboard` yox) geri çıxmaq üçün iki dəfə basmaq lazımdır | `ToolsHub.tsx` `handleBack` | saxlanıb |
| Pulsuz istifadəçiyə ilkin Premium alət açılanda modal siyahı budağında qalır, alətdən çıxana qədər görünmür (o vaxta qədər `PremiumToolBoundary` paywall-u göstərir) | `ToolsHub.tsx` | saxlanıb |
| `PremiumToolBoundary` paywall-u Flutter-də sətir içində çəkilirdi (alətlər tabında layout çökürdü); React-dakı kimi tam ekran qat olur | `premium_gates.dart` | Flutter düzəlişi |
| Recap kətanı en `max-width: 100%`-ə çatanda uzanır (hündürlük 100% qalır), 9:16 nisbəti pozulur | `RecapScreen.tsx` | Flutter-də nisbət saxlanır |
| Recap böyümə səhnəsində barlardan sonra `globalAlpha = 1` səhnədən çıxış solmasını ləğv edir | `lib/recap/render.ts` `drawGrowth` | saxlanıb |
| Qeydiyyatda moderator şəbəkə məhdudiyyəti xətası moderator mətni ilə göstərilmirdi (Flutter-də qarmaq qoşulmamışdı) | `AuthScreen.tsx` → `moderatorError` | Flutter-də `registerModerationFeature` qoşur |

# iOS Native Xüsusiyyətlərin Tamamlanması: Apple Health + Kilid Ekranı Widget (Live Activity)

Bu sənəd iki müstəqil, lakin hər ikisi eyni səbəbdən "yarımçıq" qalan xüsusiyyəti əhatə edir:

1. **Apple Health (HealthKit) inteqrasiyası** — addım/kalori/məşq oxumaq + period yazmaq
2. **Kilid ekranı taymer widget-i (Live Activity)** — yuxu/əmizdirmə taymeri kilid ekranında canlı sayğac

## TL;DR — Vəziyyət xülasəsi

| | Kod (React/TS + Swift/Kotlin) | Android layihəsi | iOS layihəsi (.xcodeproj) | Apple Developer Portal |
|---|---|---|---|---|
| **Apple Health** | ✅ 100% yazılıb | ✅ tam bağlıdır (`capacitor-health` istisna, aşağı bax) | ❌ 3 addım çatışır | ❌ 1 addım çatışır |
| **Live Activity Widget** | ✅ 100% yazılıb | ✅ tam bağlıdır, heç nə lazım deyil | ❌ Widget target ümumiyyətlə yoxdur | ❌ App Group yaradılmalıdır |

**Əsas səbəb:** Bütün Swift/Kotlin mənbə faylları artıq repoda commit olunub, amma Xcode-un öz layihə faylı (`ios/App/App.xcodeproj/project.pbxproj`) bu yeni faylları "tanımır" — fayl sistemində olması kifayət etmir, Xcode-da GUI ilə target-lərə əlavə edilməlidir. Bu, mətn redaktoru/kодла düzəldilə bilməyən, mütləq **Mac + Xcode tələb edən** addımlardır.

**Zəruri ilkin şərtlər (hər ikisi üçün ortaq):**
- Mac kompüter + Xcode 15 və ya yuxarı (App Store-dan pulsuz)
- Apple Developer Program-a **ödənişli üzvlük** ($99/il) — komanda artıq mövcuddur: **Team ID `8B6976J8H7`**, Bundle ID `com.atlasoon.anacan`. App Groups və bəzi entitlement-lər pulsuz (personal) hesabla etibarlı işləməyə bilər.
- Terminal-da: `git pull --rebase --autostash && npm install && npm run build && npx cap sync ios && npx cap open ios` (bax `.agents/workflows/ios-build.md`)
- **Test yalnız FİZİKİ iPhone-da mənalıdır** — Simulator-da Health datası və Live Activity/Dynamic Island düzgün işləməyə bilər (aşağıda hər bölmədə ətraflı).

---

## HİSSƏ A — Apple Health (HealthKit)

### A.1 — Artıq hazır olan (heç nəyə toxunma)

**Kod tərəfi (JS/TS + Swift + Kotlin) tam yazılıb:**
- `src/lib/health.ts` — `capacitor-health` paketinin nazik wrapper-i: `isHealthAvailable()`, `requestHealthPermissions()`, `queryDaily()` (addım + aktiv kalori), `getRecentWorkouts()`, `openHealthSettings()`. Yalnız native platformada işləyir (`isNativeHealthPlatform()` gate-i), veb-də sakitcə heç nə etmir.
- `src/hooks/useHealthData.ts` — bu funksiyaların React Query hook-ları (`useHealthAvailability`, `useHealthDaily`, `useHealthWorkouts`).
- `src/components/HealthSyncScreen.tsx` — tam UI: qoşulma düyməsi, bugünkü addım/kalori/məşq triosu, 7-günlük bar chart, son 5 məşq, "Cycle-ı Apple Health-ə yaz" toggle-i (yalnız `flow` mərhələsində), parametrlər/ayır düymələri.
- `src/lib/healthCycle.ts` + `ios/App/App/HealthCyclePlugin.swift` + `android/.../HealthCyclePlugin.kt` — **ayrıca, əl ilə yazılmış custom plugin** (`capacitor-health`-dən fərqli) — istifadəçi period başladanda `HKCategorySample` (menstrualFlow) yaradıb Apple Health-ə/Health Connect-ə YAZIR. Kodun özü izah edir: bütün Health datası **yalnız cihazda qalır, serverə (Supabase-ə) heç vaxt göndərilmir**.
- `src/lib/healthVitals.ts` + `ios/App/App/HealthVitalsPlugin.swift` + `android/.../HealthVitalsPlugin.kt` — **YENİ (eyni nümunə ilə)** — Çəki/Qan Təzyiqi/Qan Şəkəri Tracker-lərində qeyd olunan ölçmələri Apple Health-ə/Health Connect-ə YAZIR (`capacitor-health` paketi bu tipləri dəstəkləmir). `HealthSyncScreen.tsx`-də "Ölçmələrimi Health-ə yaz" tək toggle-i ilə idarə olunur (bütün mərhələlərdə görünür, Flow-a xas deyil).
- `Info.plist` — `NSHealthShareUsageDescription` və `NSHealthUpdateUsageDescription` artıq düzgün mətnlə var (`ios/App/App/Info.plist:113-117`).
- `App.entitlements` / `App.Debug.entitlements` — `com.apple.developer.healthkit = true` artıq hər ikisində var.
- `PrivacyInfo.xcprivacy` — Health data bəyanatı məzmunu düzgün yazılıb (sadəcə hələ target-ə bağlanmayıb, aşağı A.2-yə bax).
- Android tərəfi tam bağlıdır: `HealthCyclePlugin.kt` + `HealthVitalsPlugin.kt` `MainActivity.java`-da qeydiyyatdan keçib, `AndroidManifest.xml`-də bütün Health Connect icazələri var (`androidx.health.connect:connect-client` asılılığı `WeightRecord`/`BloodPressureRecord`/`BloodGlucoseRecord`-u da əhatə edir, əlavə Gradle dəyişikliyi lazım deyil).

### A.2 — Xcode-da tamamlanmalı addımlar (bir dəfəlik)

Xcode-u aç: `npx cap open ios` (və ya `ios/App/App.xcworkspace`/`App.xcodeproj`).

**1) `capacitor-health` paketini native tərəfə bağla**
Bu paket (`package.json`-da `capacitor-health@8.1.2`) npm-də quraşdırılıb, AMMA onun Swift/Kotlin kodu hələ layihəyə bağlanmayıb (`ios/App/CapApp-SPM/Package.swift` bu paketi siyahıda göstərmir). Sadəcə:
```bash
npx cap sync ios
```
işlətmək kifayətdir — Capacitor CLI `CapApp-SPM/Package.swift`-i avtomatik yeniləyib `capacitor-health`-i əlavə edəcək (bu fayl "DO NOT MODIFY — managed by Capacitor CLI" başlığı ilə işarələnib, əl ilə redaktə etmə). Eyni səbəbdən Android üçün də `npx cap sync android` işlət.

**2) `HealthCyclePlugin.swift` və `HealthVitalsPlugin.swift`-i App target-inə əlavə et**
Bu fayllar artıq `ios/App/App/HealthCyclePlugin.swift` və `ios/App/App/HealthVitalsPlugin.swift`-də mövcuddur, amma Xcode layihəsi onları tanımır (heç bir target-in Sources fazasında deyil — özü də faylın başında bunu qeyd edir).
- Xcode-da Project Navigator-da `App` qovluğuna sağ klik → **Add Files to "App"…**
- Hər iki faylı (`HealthCyclePlugin.swift`, `HealthVitalsPlugin.swift`) birlikdə seç
- Aşağıdakı dialoqda **Target Membership: App** ✅ işarəli olduğundan əmin ol
- Add et

**3) `PrivacyInfo.xcprivacy`-ni App target-inin Resources-ına əlavə et**
Eyni məntiq — fayl `ios/App/App/PrivacyInfo.xcprivacy`-də var, amma target-ə bağlı deyil (`docs/STORE_COMPLIANCE.md`-də də açıq TODO kimi qeyd olunub).
- Add Files to "App"… → `PrivacyInfo.xcprivacy` seç → Target Membership: **App** ✅

**4) HealthKit capability-ni Xcode GUI ilə də əlavə et (təkrar təhlükəsizlik)**
Entitlements faylında `com.apple.developer.healthkit` artıq var, amma bunu **Signing & Capabilities** tab-ından əl ilə də əlavə etmək tövsiyə olunur — bu, provisioning profile ilə sinxron qalmasını təmin edir:
- `App` target seç → **Signing & Capabilities** → **+ Capability** → **HealthKit** axtar, əlavə et
- (Clinical Health Records / Background Delivery alt-seçimlərini AÇMA — bu app onlardan istifadə etmir)

**5) Build & Link yoxla**
- Bir dəfə build et (⌘B). Əgər `HealthKit.framework` linklənməyibsə (adətən "Link Frameworks Automatically" avtomatik edir), **Signing & Capabilities → Frameworks, Libraries, and Embedded Content** bölməsindən əl ilə əlavə et.

### A.3 — Apple Developer Portal-da tamamlanmalı addım

**HealthKit capability-ni App ID-yə aktivləşdir:**
1. https://developer.apple.com/account → **Certificates, Identifiers & Profiles → Identifiers**
2. `com.atlasoon.anacan` App ID-ni tap və seç (Team: `8B6976J8H7`)
3. Capabilities siyahısında **HealthKit** qutusunu işarələ, Save et
4. Provisioning profili yenilə — **Automatically manage signing** açıqdırsa (layihədə `CODE_SIGN_STYLE = Automatic` artıq belədir), Xcode bunu avtomatik ediləcək; yenidən açıb-bağla (Xcode → Preferences → Accounts → təkrar "Download Manual Profiles" və ya sadəcə layihəni yenidən aç).

> **Diqqət:** Əgər bu addım (portal-da capability aktivləşdirilməsi) edilmədən sign/build/archive edilməyə çalışılsa, Xcode "Provisioning profile doesn't support the HealthKit capability" xətası verəcək — entitlements faylının özü kifayət deyil, App ID-nin server tərəfində də uyğun olması lazımdır.

### A.4 — Test

- **Simulator-da HEALTH DATASI ETİBARLI DEYİL** — `HKHealthStore.isHealthDataAvailable()` bəzi Xcode versiyalarında `false` qaytarır və ya boş data gəlir. Mütləq **fiziki iPhone**-da test et (Development profillə ad-hoc build və ya TestFlight).
- Cihazda ilk dəfə "Qoşul" düyməsinə basanda standart Apple Health icazə ekranı çıxacaq — hər data növü (addım, aktiv enerji, məşq, ürək ritmi) üçün ayrıca aç.
- Apple Health app-ında əl ilə bir neçə addım/məşq qeydi olduğundan əmin ol ki, oxuma yolu test edilə bilsin.
- Period yazma funksiyasını yoxlamaq üçün: Flow mərhələsində "Cycle-ı Apple Health-ə yaz" toggle-ni aç → period başlat → Apple Health app-ında Cycle Tracking bölməsində həmin qeydin göründüyünü yoxla.
- Çəki/QT/QŞ yazma funksiyasını yoxlamaq üçün: "Ölçmələrimi Health-ə yaz" toggle-ni aç → Weight/Blood Pressure/Blood Sugar Tracker-lərdən birində yeni ölçmə qeyd et → Apple Health app-ında müvafiq bölmədə (Body Measurements → Weight, Heart → Blood Pressure, Nutrition → Blood Glucose) qeydin göründüyünü yoxla. Qan təzyiqi `HKCorrelation` kimi yazılır (sistolik+diastolik BİRGƏ) — Health app-ında tək cüt dəyər kimi görünməlidir, 2 ayrı qeyd kimi yox.

### A.5 — Mağaza təqdimatı (App Store Review)

Bu, artıq `docs/STORE_COMPLIANCE.md`-də tam yazılıb — bax o sənədin "2. App Store — Privacy & Health Disclosure" bölməsi. Qısaca:
- App Store Connect → **App Privacy** → Health & Fitness data toplama bəyan et
- App Store Connect → **App Review Information → Notes** — HealthKit istifadəsini izah edən hazır mətni yapışdır (`STORE_COMPLIANCE.md:56-60`)
- App təsvirinə (description) HealthKit istifadəsi barədə 1 cümlə əlavə et
- Privacy Policy səhifəsinə (anacanwebsitenew saytında) Health bölməsi əlavə et
- `docs/STORE_COMPLIANCE.md:65-71`-dəki yoxlama siyahısını tam işarələ

---

## HİSSƏ B — Kilid Ekranı Taymer Widget-i (Live Activity)

Bu xüsusiyyət üçün **`docs/LIVE_TIMER_SETUP.md`** faylı artıq mövcuddur və Xcode target-i necə yaradılacağını dəqiq izah edir — o sənəd faktiki koda qarşı yoxlanılıb və **tam düzgündür**. Bu bölmə onu TƏKRARLAMIR, əvəzinə **o sənəddə olmayan, amma tamamlama üçün zəruri olan hissələri** əlavə edir (Developer Portal App Group yaradılması, provisioning, test məhdudiyyətləri) və hər ikisini bir ardıcıllıqla birləşdirir.

### B.1 — Artıq hazır olan

- `src/store/timerStore.ts`, `src/lib/live-timer.ts`, `src/plugins/LiveActivityPlugin.ts`, `src/components/FloatingTimerWidget.tsx` — tam JS/TS körpü qatı, platform-agnostik.
- `ios/App/AnacanTimerWidget/` qovluğunda 4 Swift faylı — Live Activity-nin Lock Screen + Dynamic Island UI-si, `AnacanTimerStopIntent` (iOS 17 "Dayandır" düyməsi) daxil olmaqla tam yazılıb.
- `ios/App/App/Plugins/LiveActivityPlugin.swift` + `.m` — App target-i tərəfindən JS-ə körpü verən custom Capacitor plugin.
- `Info.plist` — `NSSupportsLiveActivities = true` artıq var.
- Android tərəfi **tam bağlıdır**, heç bir manual addım lazım deyil (`TimerForegroundService.kt`, `TimerWidgetPlugin.kt`, `MainActivity.java` qeydiyyatı, manifest icazələri — hamısı hazır). Sadəcə `npx cap sync android` + build.

### B.2 — `docs/LIVE_TIMER_SETUP.md`-dəki addımlar (xülasə — tam mətn üçün o sənədə bax)

> ⚠️ **Target-in adını `AnacanTimerWidget` YOX, `AnacanTimerWidgetExt` qoy** — real hadisədə
> tapılıb ki, `ios/App/AnacanTimerWidget/` qovluğu ilə eyni adlı target Xcode-a öz şablon
> fayllarını həmin qovluğa yazdırır, bizim real 4 Swift faylımızla ad toqquşması yaradır
> (tam izah `LIVE_TIMER_SETUP.md`-də).

1. Xcode → File → New → Target… → **Widget Extension**, adı `AnacanTimerWidgetExt`, "Include Live Activity" ✅
2. Xcode-un yaratdığı şablon Swift fayllarını sil
3. Repo-dakı 4 faylı (`ios/App/AnacanTimerWidget/` qovluğundan) düzgün target-lərə əlavə et (cədvəl o sənəddə var — 2 fayl HƏR İKİ target-ə, 2 fayl yalnız widget target-inə)
4. Əgər build zamanı "missing import of defining module 'AppIntents'" xətası çıxarsa: `AnacanTimerWidgetLiveActivity.swift`-in başında `import AppIntents` olduğunu yoxla (repo-da artıq düzəldilib)
5. **App Groups** capability-ni HƏR İKİ target-ə əlavə et: `group.com.atlasoon.anacan`
6. Widget target-in Minimum Deployment-ini **iOS 16.1** et
7. `npx cap sync ios` + build (App scheme ilə)

### B.3 — `LIVE_TIMER_SETUP.md`-də AÇIQ QALAN, əlavə diqqət tələb edən məqamlar

**App Group-u əvvəlcə Apple Developer Portal-da yaratmaq lazım ola bilər:**
1. https://developer.apple.com/account → **Identifiers** → sol üstdə filter-i **App Groups**-a keç → **+** düyməsi
2. Identifier: `group.com.atlasoon.anacan` (Swift kodunda `LiveActivityPlugin.swift:26` və `AnacanTimerStopIntent.swift:46`-da bu tam ID artıq hardcode olunub — DƏYİŞMƏ, eyni adla yarat)
3. Yaradıldıqdan sonra Xcode-a qayıt, hər iki target üçün Signing & Capabilities-də App Groups altında bu qrupu seç (əgər siyahıda görünmürsə, Xcode-da "Automatically manage signing" ilə adətən avtomatik yaradılır/bağlanır — portalda əl ilə yaratmaq yalnız avtomatik idarəetmə uğursuz olarsa lazımdır)
4. **Yeni widget-extension App ID-si üçün də provisioning profili** lazım olacaq (`com.atlasoon.anacan.AnacanTimerWidget`) — Automatic signing açıqdırsa Xcode bunu özü həll edir.

**Niyə vacibdir:** `App.entitlements` və `App.Debug.entitlements` faylları HAZIRDA `com.apple.security.application-groups` açarını **ehtiva ETMİR**. Bu addım edilmədən "Dayandır" düyməsi (widget-dən) ilə tətbiq arasındakı `UserDefaults(suiteName:)` məlumat mübadiləsi səssizcə uğursuz olacaq — yəni kilid ekranından dayandırılan sessiya tətbiqə heç vaxt "gəlib çatmayacaq".

### B.4 — Test məhdudiyyətləri

- Live Activity/Dynamic Island **yalnız fiziki cihazda və ya iOS 16.1+/Xcode 14+ Simulator-da** müşahidə edilə bilər. **Dynamic Island vizual olaraq yalnız iPhone 14 Pro və yuxarı** modellərdə (və onlara uyğun simulator-da) görünür — köhnə modellərdə Live Activity yalnız Lock Screen-də görünəcək (bu, gözlənilən davranışdır, xəta deyil).
- İlk build-dən sonra cihazda: Settings → Anacan → **Live Activities** aç olduğunu yoxla (`docs/LIVE_TIMER_SETUP.md`-nin öz troubleshooting bölməsində qeyd olunub).
- Tam ssenari: tətbiqdə taymer başlat → kilidlə → canlı sayğacı gör → (iOS 17+) qırmızı Dayandır düyməsinə bas → tətbiqi aç → sessiyanın tarixçəyə (`baby_logs`) yazıldığını yoxla.

---

## HİSSƏ C — Tövsiyə olunan ardıcıllıq (hər ikisini bir Xcode sessiyasında etmək)

Hər iki xüsusiyyət eyni Mac/Xcode sessiyasında tamamlana bilər, çünki bir neçə addım üst-üstə düşür (Signing & Capabilities ekranı, `npx cap sync ios`):

1. `git pull --rebase --autostash && npm install && npm run build && npx cap sync ios && npx cap open ios`
2. **[Health]** `HealthCyclePlugin.swift` və `PrivacyInfo.xcprivacy`-ni App target-inə əlavə et (A.2, addım 2-3)
3. **[Health]** Signing & Capabilities → HealthKit capability əlavə et (A.2, addım 4)
4. **[Widget]** File → New → Target → Widget Extension yarat (adı `AnacanTimerWidgetExt` — `AnacanTimerWidget` YOX, ad toqquşması üçün), şablonları sil, 4 faylı doğru target-lərə əlavə et (B.2, addım 1-3)
5. **[Widget]** Signing & Capabilities → hər iki target-ə App Groups əlavə et (B.2, addım 4 + B.3)
6. **[Widget]** Widget target-in Minimum Deployment-ini iOS 16.1 et (B.2, addım 5)
7. Build et (⌘B), xətaları düzəlt (adətən: unudulmuş target membership və ya HealthKit.framework link problemi)
8. **Developer Portal:** App ID-yə HealthKit capability aktivləşdir (A.3) + lazım gələrsə App Group yarat (B.3)
9. Provisioning-i yenilə (Automatic signing ilə adətən avtomatik)
10. Fiziki cihazda run et, hər iki xüsusiyyəti ayrı-ayrı test et (A.4 + B.4)

**Təxmini vaxt:** ~40-60 dəqiqə (əlavə tərtibatçı portalı gecikmələri istisna olmaqla).

---

## HİSSƏ D — Mağaza Təqdimatı Yoxlama Siyahısı

Bax `docs/STORE_COMPLIANCE.md` — Health inteqrasiyası üçün tam Play Store + App Store checklist artıq orada yazılıb (Data Safety forması, Health apps declaration, App Privacy labels, Review Notes mətni). Widget/Live Activity xüsusiyyəti üçün əlavə mağaza bəyanatı TƏLƏB OLUNMUR (istifadəçi datası yaratmır/toplamır, sadəcə UX xüsusiyyətidir) — yalnız App Store təsvirində/screenshot-larda istəyə görə vurğulana bilər.

---

## Problemlərin həlli (ümumi)

| Simptom | Səbəb / Həll |
|---|---|
| `Health.isHealthAvailable()` həmişə `false`/xəta qaytarır | `npx cap sync ios` işlədilməyib və ya `CapApp-SPM/Package.swift`-də `capacitor-health` görünmür — yenidən sync et, Xcode-u bağlayıb aç |
| Build zamanı "Cannot find HealthCyclePlugin in scope" | `HealthCyclePlugin.swift` App target-inin Sources fazasına əlavə edilməyib (A.2 addım 2) |
| Build zamanı "Cannot find HealthVitalsPlugin in scope" | `HealthVitalsPlugin.swift` App target-inin Sources fazasına əlavə edilməyib (A.2 addım 2, `HealthCyclePlugin.swift` ilə eyni addımda birlikdə edilməlidir) |
| "Ölçmələrimi Health-ə yaz" aktiv olmur, "Mövcud deyil" xətası | Yuxarıdakı səbəblə eyni — plugin hələ Xcode target-inə əlavə edilməyib, ya da köhnə (sync edilməmiş) native build işlədilir |
| Archive/sign zamanı "doesn't support HealthKit capability" | Developer Portal-da App ID-də HealthKit hələ aktivləşdirilməyib (A.3) |
| Live Activity heç görünmür | Settings → Anacan → Live Activities bağlıdır, YA DA Widget Extension target hələ yaradılmayıb (B.2 addım 1) |
| Widget-dəki "Dayandır" düyməsi sessiyanı tətbiqə çatdırmır | App Groups capability hər iki target-də yoxdur/fərqli ID-dədir (B.3) |
| Build: "initializer 'init(intent:label:)' is not available due to missing import of defining module 'AppIntents'" | `AnacanTimerWidgetLiveActivity.swift`-in başında `import AppIntents` yoxdur (repo-da düzəldilib, yoxla) |
| Widget Extension target yaradılandan sonra `ios/App/AnacanTimerWidget/`-dəki real fayllar yoxa çıxıb/qarışıb | Target `AnacanTimerWidget` adı ilə yaradılıb (eyni adlı qovluqla toqquşub) — `git fetch origin && git reset --hard origin/main` ilə bərpa et, target-i `AnacanTimerWidgetExt` adı ilə yenidən yarat |
| Simulator-da heç nə işləmir (Health və ya Live Activity) | Gözlənilən — hər ikisi üçün fiziki cihaz və ya müvafiq minimum versiyalı simulator lazımdır (A.4, B.4) |

## İstinad edilən fayllar

- `docs/LIVE_TIMER_SETUP.md` — Widget target yaratmanın addım-addım təlimatı (bu sənədlə birlikdə oxu)
- `docs/STORE_COMPLIANCE.md` — Mağaza (Play/App Store) Health bəyanatları üçün tam mətn və checklist
- `.agents/workflows/ios-build.md` — standart iOS build axını (pull → build → sync → Xcode aç)
- `src/lib/health.ts`, `src/hooks/useHealthData.ts`, `src/components/HealthSyncScreen.tsx` — Health JS/TS qatı
- `src/lib/healthCycle.ts`, `ios/App/App/HealthCyclePlugin.swift`, `android/app/src/main/java/com/atlasoon/anacan/HealthCyclePlugin.kt` — period yazma custom plugin-i
- `src/lib/healthVitals.ts`, `ios/App/App/HealthVitalsPlugin.swift`, `android/app/src/main/java/com/atlasoon/anacan/HealthVitalsPlugin.kt` — çəki/qan təzyiqi/qan şəkəri yazma custom plugin-i (`WeightTracker.tsx`, `BloodPressureTracker.tsx`, `BloodSugarTracker.tsx` uğurlu qeyddən sonra çağırır)
- `src/lib/live-timer.ts`, `src/plugins/LiveActivityPlugin.ts`, `src/store/timerStore.ts`, `src/components/FloatingTimerWidget.tsx` — Widget/Live Activity JS/TS qatı
- `ios/App/AnacanTimerWidget/*.swift`, `ios/App/App/Plugins/LiveActivityPlugin.swift(.m)` — Widget native Swift kodu

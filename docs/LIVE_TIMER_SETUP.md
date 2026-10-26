# Kilid Ekranı Taymer Widget-ləri — Quraşdırma Təlimatı

Süd vermə / yuxu taymerləri başlayanda telefonun kilid ekranında canlı sayğac göstərilir:
- **iOS 16.1+**: Live Activity (Lock Screen + Dynamic Island). iOS 17+-da widget üzərində **Dayandır** düyməsi.
- **Android 8+**: Foreground Service xronometr bildirişi — kilid ekranında görünür, **Dayandır** düyməsi və toxunuşla tətbiqə keçid.

Widget-dən dayandırılan sessiya itmir: native tərəf "pending stop" yazır, tətbiq növbəti açılışda/resume-da onu oxuyub `baby_logs`-a qeyd edir.

---

## Android — heç bir manual addım YOXDUR ✅

Hər şey kodda hazırdır: `TimerForegroundService.kt`, `TimerWidgetPlugin.kt`, manifest icazələri
(`FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`) və MainActivity qeydiyyatı.
Sadəcə:
```
npx cap sync android
```
və build. (Android 13+ üçün bildiriş icazəsi onsuz da soruşulur — mövcud axın dəyişməyib.)

---

## iOS — Xcode-da addımlar (bir dəfəlik, ~15-20 dəqiqə)

Fayllar artıq repo-dadır: `ios/App/AnacanTimerWidget/` (4 swift fayl) və
`ios/App/App/Plugins/LiveActivityPlugin.swift|.m`. `Info.plist`-ə `NSSupportsLiveActivities`
əlavə olunub.

### ⚠️ KRİTİK: Widget Extension target-inə `ios/App/AnacanTimerWidget/` ilə EYNİ ad VERMƏ

**Real bir hadisədə tapılan problem:** Xcode-da yeni Widget Extension target-i `AnacanTimerWidget`
adı ilə yaradanda, Xcode həmin adla `ios/App/AnacanTimerWidget/` qovluğuna ÖZ şablon fayllarını
yazır — bu qovluq artıq bizim 4 real Swift faylımızı ehtiva edir, və bəzi Xcode-şablon fayl adları
(`AnacanTimerWidgetBundle.swift`, `AnacanTimerWidgetLiveActivity.swift`) bizim real fayllarımızla
HƏRFİYYƏN eynidir → toqquşma, real fayllar üzərinə yazıla/qarışa bilər.

**Həll: target-in Product Name-ini `AnacanTimerWidgetExt` yaz** (`AnacanTimerWidget` YOX). Kodun
özündə heç yerdə bu adın hərfiyyən "AnacanTimerWidget" olması tələb OLUNMUR — yalnız Swift struct
adları (`AnacanTimerWidgetLiveActivity`, `AnacanTimerAttributes` və s., fayl daxilində) önəmlidir,
bunlar artıq düzgündür. Fərqli target adı = Xcode tamam ayrı, boş bir qovluq (`AnacanTimerWidgetExt/`)
yaradır, bizim real fayllarımızla heç bir ad toqquşması olmur.

### 1) Widget Extension target-i yarat
Xcode → File → New → Target… → **Widget Extension**
- Product Name: **`AnacanTimerWidgetExt`** (yuxarıdakı xəbərdarlığa bax — `AnacanTimerWidget` YAZMA)
- **Include Live Activity**: ✅
- **Include Configuration App Intent**: ❌
- "Activate scheme?" → Activate

### 2) Xcode-un generasiya etdiyi şablon faylları sil
Yeni `AnacanTimerWidgetExt` qovluğunda Xcode-un yaratdığı BÜTÜN `.swift` şablon fayllarını
**Move to Trash** et (indi ehtiyatsız ola bilərsən — bu qovluq bizim real fayllarımızla heç
əlaqəli deyil, qarışıqlıq mümkün deyil). `Assets.xcassets` və `Info.plist`-ə (Xcode-un öz
generasiya etdiyi) toxunma, saxla.

### 3) Repo-dakı 4 real faylı əlavə et
Sağ-klik (App və ya AnacanTimerWidgetExt qovluğuna) → **Add Files to "App"…** → Finder-də
`ios/App/AnacanTimerWidget/` qovluğuna get (bu qovluq indi toxunulmamış, orijinal 4 fayl ilə
olmalıdır) → 4 faylı birdən seç → **"Copy items if needed" ❌** (fayllar öz yerində qalsın) →
"Add to targets": App ✅ + AnacanTimerWidgetExt ✅ → Add.

Sonra hər faylın Target Membership-ni (File Inspector, sağ panel) fərdi yoxla/düzəlt:

| Fayl | App target | AnacanTimerWidgetExt target |
|---|---|---|
| `AnacanTimerWidgetBundle.swift` | ❌ | ✅ |
| `AnacanTimerWidgetLiveActivity.swift` | ❌ | ✅ |
| `AnacanTimerAttributes.swift` | ✅ | ✅ *(hər ikisi — vacib!)* |
| `AnacanTimerStopIntent.swift` | ✅ | ✅ *(hər ikisi — vacib!)* |

Həmçinin `ios/App/App/Plugins/LiveActivityPlugin.swift` və `.m` fayllarının **App**
target-inə üzv olduğunu yoxla (Plugins qovluğu artıq layihədədirsə avtomatik olacaq;
deyilsə Add Files ilə əlavə et).

### ⚠️ Build xətası: "initializer 'init(intent:label:)' is not available due to missing import of defining module 'AppIntents'"

Bu xəta çıxarsa (və ya əvvəlcədən bilmək üçün): `AnacanTimerWidgetLiveActivity.swift` faylı
`Button(intent: AnacanTimerStopIntent(...))` işlədir — bu SwiftUI API-si `AppIntents` modulunun
faylda import olunmasını tələb edir. **Repo-da artıq düzəldilib** (`AnacanTimerWidgetLiveActivity.swift`
başında `import AppIntents` var), amma köhnə/fərqli bir kopyada işləyirsənsə, faylın başındakı
import siyahısının tam bu cür olduğunu yoxla:
```swift
import ActivityKit
import AppIntents
import WidgetKit
import SwiftUI
```

### 4) App Group əlavə et (hər iki target-ə)
Signing & Capabilities → **+ Capability → App Groups** →
`group.com.atlasoon.anacan`
- **App** target-inə ✅
- **AnacanTimerWidgetExt** target-inə ✅
(Apple Developer portalda App Group ID-ni yaratmaq lazım gələ bilər — Identifiers → filtr:
App Groups → + → Identifier: `group.com.atlasoon.anacan`, kodda hardcode olunub, dəyişmə.)

### 5) Widget target deployment
`AnacanTimerWidgetExt` target → General → Minimum Deployments: **iOS 16.1**

### 6) Build
```
npx cap sync ios
```
Xcode-da **App** scheme ilə build & run (Widget scheme ilə yox — App scheme əsas tətbiqi
işə salır, widget avtomatik onunla bərabər qurulur).

### Yoxlama
1. Tətbiqdə yuxu və ya əmizdirmə taymerini başlat
2. Telefonu kilidlə → kilid ekranında canlı sayğac görünməlidir
3. iOS 17+: qırmızı ■ düyməsi ilə dayandır → tətbiqi aç → sessiya tarixçədə olmalıdır
4. Widget-ə toxun → tətbiq açılır

### Problemlərdə
- Live Activity görünmür → Settings → Anacan → **Live Activities** açıq olmalıdır
- "Dayandır" işləmir (iOS 17) → `AnacanTimerStopIntent.swift` hər iki target-də olmalıdır
- Sessiya yadda qalmır → App Group hər iki target-də eyni ID ilə olmalıdır
- Köhnə iOS (16.0-) → avtomatik fallback: adi davamlı bildiriş göstərilir
- Fayllar qəfil yoxa çıxıb / qarışıb → `git status` yoxla, `git fetch origin && git reset --hard origin/main`
  ilə repo-nu təmiz vəziyyətə qaytar (commit olunmamış BÜTÜN dəyişikliklər itir, Xcode target-i də
  yenidən yaradılmalı olacaq — amma bu, əvvəlki addımı sıfırdan, düzgün adla təkrarlamaq üçün ən
  təmiz yoldur)

# Anacan: Capacitor → Flutter keçid planı

Tarix: 2026-11-27. Status: **plan təsdiqlənib, icra başlamayıb.** Baza budağı: `main-630mc7` (52.0.2).

> **Baza haqqında düzəliş.** İlk analiz köhnə `main` budağı (2026-10-27) üzərində aparılmışdı. Aktiv iş
> `main-630mc7`-dədir, 469 commit irəlidədir. Arxitektura, protokollar və dizayn sistemi eynidir, ona görə
> planın quruluşu dəyişmir; lakin ekran və modul siyahısı natamamdır. Tam inventar 0-cı mərhələnin ilk işidir
> (bax 2.2).

## 1. Qısa cavab

Keçid mümkündür. Backend, verilənlər bazası, edge function-lar, admin paneli və veb sayt toxunulmaz qalır; yalnız iOS/Android istehlakçı tətbiqi Flutter ilə yenidən yazılır. Tətbiq eyni `com.atlasoon.anacan` identifikatoru ilə mağazada adi yeniləmə kimi çıxır, istifadəçi girişli qalır.

- Bu, "çevirmə" deyil, **yenidən yazmadır**. Mobil tətbiqə aid təxminən 180 min sətir React kodu (test, admin, veb sayt və məzmun faylları xaric) Dart-a əl ilə köçürülür.
- "Dizayn dəyişmir" ölçü, rəng, boşluq, animasiya və axın səviyyəsində təmin olunur. Mətnin hamarlanması WebView və Flutter mühərrikində bir qədər fərqlidir; hədəf "gözlə fərq görünmür"dür, "bit-bit eyni" deyil.

## 2. Mövcud vəziyyət

### 2.1 Yoxlanmış faktlar

| Sahə | Fakt |
|---|---|
| Kod | `src/` altında 1 600 qeyri-test TS/TSX faylı; istehlakçı tətbiqi ~180 min sətir |
| Naviqasiya | `react-router` yalnız xarici qabıqdır. Əsl tətbiq `src/pages/Index.tsx`-dəki vəziyyət maşınıdır: `activeTab`, `activeScreen`, `activeTool` |
| Rejimlər | `flow`, `bump`, `mommy` (qadın, 5 tab) və ayrıca partnyor qabığı (5 tab) |
| Dizayn | İki token sistemi: shadcn HSL (`src/index.css`) və əsas olan `--a-*` (`src/styles/anacan-design.css`). İşıqlı/qaranlıq tema, RTL (ərəb), minlərlə inline `style` |
| Animasiya | `framer-motion` ~190 faylda. Lottie/Rive yoxdur |
| Backend | Supabase-uyğun API `https://api.anacan.az`. 200+ cədvəl, 56+ RPC, realtime, 6 storage bucket, edge function-lar |
| Qəbul protokolu | `/.well-known/anacan-backend.json`, pin, maintenance, minimum native versiya, 60 saniyəlik izləmə |
| Sessiya | Backend-ə görə ayrı açar, Preferences-də ehtiyat nüsxə, logout tombstone, birtərəfli adoption qəbzi, refresh-before-use, oflayn sessiya və outbox |
| Dil | **25 dil** (veb sayt 21-də qalır). 16 dilin məzmun paketi tətbiqə daxil deyil: `https://app.anacan.az/content-packs/`-dan hissə-hissə yüklənir, IndexedDB-də saxlanır, sha256 ilə yoxlanır |
| iOS | 3 target: tətbiq, `AnacanTimerWidgetExt` (widget + Live Activity), `AnacanNotificationService` (push şəkilləri) |
| Android | Taymer foreground servisi, 3 ev ekranı vidceti (Journey, Care, Word), Health Connect |
| Yerli plaginlər | LiveActivity, HealthCycle, HealthVitals, ScreenshotGuard, AnacanWidgets, FbEvents, Customer.io və TikTok Events paketləri; AdMob-a native story reklamı əlavə edən patch |
| Testlər | 349 test faylı, 3 480 test |

### 2.2 Yenidən inventar tələb edənlər

Aktiv budaqda ilk analizdə olmayan modullar var: `stories`, `stickers`, `recap`, `qaygicash`, `partner-shop`, `books`, `illness`, `pregnancy-loss`, `recovery`, `ttc`, `sleep`, `baby-chat`, `consent`, `privacy`, `promo`, `appUpdate`, e-poçt təsdiqi, gündəlik viktorina, vidcet ayarları, mərkəzi bildiriş planlaşdırıcısı. `src/data/` altında ~180 min sətir məzmun var (valideynlik, məşqlər, əlavə qida bələdçisi və s.); bunlar kod deyil, Flutter-də asset kimi daşınır.

### 2.3 Performansın bugünkü ağrılı yerləri

- Zəif cihazlarda blur və sonsuz animasiyalar donma verir; `a-lite` rejimi ilə söndürülür.
- Uzun siyahıların heç biri virtuallaşdırılmayıb.
- `tr()` hər render-də minlərlə dəfə çağırılır, keşlə yamaqlanıb.
- Açılış JS paketinin yüklənmə sırasından asılıdır: 52.0.0 chunk dövrünə görə açılmırdı.
- Plagin körpüsü kövrəkdir: 52.0.1-də yerli xatırlatmalar iOS-də qurulmurdu.
- Native paket 67 MB veb fayl daşıyır.

Bunlar WebView arxitekturasının nəticəsidir və Flutter-də struktur olaraq aradan qalxır.

## 3. Əhatə və qəbul olunmuş qərarlar

**Flutter-ə keçir:** iOS və Android istehlakçı tətbiqi, bütün ekranları, alətləri, oyunları, vidcetləri və native inteqrasiyaları ilə.

**React-da qalır:** admin paneli, moderator konsolu, brend portalı, `anacan.az` saytı, açıq bloq, hüquqi səhifələr, veb funnel-lər, brauzer giriş səhifəsi.

**Dəyişmir:** backend, DB sxemi, RLS, edge function-lar, push göndərişi, RevenueCat məhsulları, AdMob vahidləri, Customer.io, Firebase layihəsi.

| # | Qərar (2026-11-27) |
|---|---|
| 1 | Admin paneli veb-də qalır. Tətbiqdə admin istifadəçi üçün profildəki düymə veb admin linkini açır |
| 2 | Flutter-dən əvvəl məlumat ixracı edən körpü buraxılışı (Capacitor) çıxır |
| 3 | Flutter buraxılışı **60.0**-dır. Körpü buraxılışı 52-dən sonrakı növbəti Capacitor versiyasıdır (53.0) |
| 4 | Keçid müddətində React tətbiqinə yeni funksiya əlavə olunmur (hələlik) |
| 5 | Köçürmədə tapılan qüsurlar Flutter-də düzəldilir (məs. Android-də `HealthVitals` işlək olur). Hər düzəliş siyahıya yazılır |
| 6 | Yığım Codemagic-də qalır, eyni dəyişən qrupları və eyni əl ilə başlatma qaydası ilə |

Köçürülməyən ölü kod: istifadə olunmayan shadcn komponentləri, `@lovable.dev/cloud-auth-js`, Mixpanel stub-ları, Lovable preview auth broker-i. Dəqiq siyahı 0-cı mərhələdə aktiv budaq üzrə təsdiqlənir.

## 4. Hədəf arxitektura

Flutter layihəsi eyni repozitoriyada `app/` qovluğunda yaradılır; lokalizasiya toxumları, şəkillər və token mənbələri React kodu ilə ortaq qalır.

```
app/
  lib/
    core/        admission, auth, session, storage, cache, i18n, content_packs, analytics, device_tier
    design/      tokens (generasiya), tema, a_* vidcetləri, sheet, toast, ikonlar, motion
    shell/       gate ardıcıllığı, tab qabığı, activeScreen maşını, deeplink, bildiriş toxunuşları
    features/    home, flow, bump, mommy, tools/*, community, chat, partner, commerce, blog, games/*
    native/      live_timer, widgets, health, screenshot_guard, ads, purchases
  test/          vitest-dən köçürülmüş testlər + golden testlər
  ios/ android/  mövcud widget, notification service və foreground service buraya daşınır
```

- **Vəziyyət:** Riverpod; mövcud zustand store-ları eyni sahələrlə.
- **Naviqasiya:** `go_router` yalnız xarici marşrut və deeplink üçün; daxildə `Index.tsx`-in vəziyyət maşını birə-bir saxlanır ki, geri düyməsi, scroll yaddaşı və swipe dəyişməsin.
- **Backend:** `supabase_flutter`; URL qəbul protokolundan gəlir, kodda sərt yazılmır. Server Google-dan AWS-ə keçsə, `api.anacan.az` DNS-i dəyişir, tətbiqə toxunulmur.
- **Keş və oflayn:** React Query davranışı (30 s stale, 7 gün disk keşi, eyni istisnalar), oflayn sessiya və outbox eyni qaydalarla.
- **Dil:** eyni `tr(key, default)` imzası və eyni açarlar; DB-dəki `translations` örtüyü dəyişmədən işləyir. Məzmun paketləri eyni ünvandan, eyni manifest və sha256 yoxlaması ilə yüklənir.

### Plagin uyğunluğu

| Capacitor | Flutter | Qeyd |
|---|---|---|
| admob (patch ilə) | `google_mobile_ads` | Banner, interstitial, rewarded, UMP. Native story reklamı `NativeAd` fabriki ilə yenidən qurulur |
| revenuecat + ui | `purchases_flutter`, `purchases_ui_flutter` | Eyni offering, entitlement, appUserID |
| firebase auth (Google) | `google_sign_in` → `signInWithIdToken` | Köhnə Android üçün brauzer ehtiyat yolu saxlanır |
| apple-sign-in | `sign_in_with_apple` | Eyni nonce sxemi |
| firebase messaging/analytics | `firebase_messaging`, `firebase_analytics` | `device_tokens` yazısı eyni |
| local-notifications | `flutter_local_notifications` | Mərkəzi planlaşdırıcı (ən yaxın 60) köçürülür |
| capacitor-health + 2 yerli plagin | `health` | Uyğun gəlməsə, mövcud Swift/Kotlin kanal ilə saxlanır |
| LiveActivity, AnacanWidgets | Mövcud Swift/Kotlin + MethodChannel | Widget kodları olduğu kimi qalır |
| Notification Service Extension | Olduğu kimi | Flutter-dən asılı deyil |
| ScreenshotGuard | MethodChannel port | |
| customerio, tiktok-events, FbEvents | `customer_io`, TikTok SDK kanalı, `facebook_app_events` | Açarlar yalnız native konfiqurasiyada |
| native-biometric | `local_auth` | PIN hash sxemi eyni |
| camera, geolocation, share, filesystem, haptics, review | `image_picker`, `geolocator`, `share_plus`, `path_provider`, `HapticFeedback`, `in_app_review` | |

### Veb kitabxanalarının əvəzi

| React | Flutter |
|---|---|
| recharts | `fl_chart` |
| jsPDF | `pdf` + `printing` |
| Bloq HTML | `flutter_widget_from_html` |
| react-markdown | `flutter_markdown` |
| vaul sheet | Xüsusi `ASheet` |
| lucide-react | Eyni versiyadan ixrac olunmuş SVG-lər |
| MediaRecorder, WebAudio, `<video>` | `record`, `just_audio`, `video_player`, `noise_meter` |
| Web Worker | Dart isolate |
| `<canvas>` | `CustomPainter` |
| IndexedDB (məzmun paketləri) | Fayl sistemi |

Paket versiyaları icranın əvvəlində son stabil buraxılışlara bərkidilir və real cihazda yoxlanır; bu cədvəllər niyyətdir, yoxlanmış uyğunluq deyil.

## 5. Dizaynın eyni qalması

1. **Tokenlər generasiya olunur:** skript CSS dəyişənlərini oxuyub Dart sabitləri yaradır. Əl ilə rəng yazılmır.
2. **`a-*` sinifləri vidcet kitabxanası olur,** ekranlar onlardan yığılır.
3. **Şriftlər tətbiqə daxil edilir** (Inter, Nunito, Noto Sans Arabic).
4. **Animasiya əyriləri** (`--a-ease`, `--a-spring`, `--a-bounce`) sabit kimi köçürülür.
5. **İstinad şəkilləri:** React tətbiqi Playwright ilə sabit məlumat üzərində işə salınır, hər ekran çəkilir: iki ölçü, işıqlı/qaranlıq, `az`/`en`/`ru`/`ar`, hər rejim. Bu infrastruktur hazırda yoxdur, 0-cı mərhələdə qurulur.
6. **Flutter golden testləri** həmin şəkillərlə müqayisə olunur; həddi keçən ekran əl ilə baxılır.
7. **Hər ekran üçün "hazırdır" tərifi:** golden keçir, 4 dildə daşma yoxdur, RTL və qaranlıq tema düzgündür, haptika, animasiya və analitika hadisələri orijinalla uyğundur.

## 6. Mövcud istifadəçilərin məlumatı

**Birbaşa oxunan.** Capacitor Preferences native anbardadır (iOS `UserDefaults`, `CapacitorStorage.` prefiksi; Android `CapacitorStorage` SharedPreferences). Sessiya, logout tombstone, adoption qəbzi, qəbul pini, dil bayraqları buradadır. Yəni **giriş WebView-suz qorunur.**

**WebView yaddaşında qalan.** `localStorage`: tətbiq kilidi PIN-i, oyun irəliləyişləri, aktiv taymerlər, ev planı, sağlamlıq açarları, reklam/premium keşi, oflayn outbox. IndexedDB: yüklənmiş məzmun paketləri (itsə, yenidən yüklənir).

**Həll:**

1. **Körpü buraxılışı 53.0 (Capacitor).** Açılışda vacib `localStorage` açarlarını Preferences-ə `anacan.migration.localstore.v1` kimi köçürür və hər dəyişiklikdə yeniləyir. Outbox boşaldılmış olmalıdır.
2. **Ehtiyat yol.** 53-ü ötürüb birbaşa 60-a keçənlər üçün ilk açılışda gizli WebView eyni origin ilə bir dəfə açılıb açarları oxuyur. 1-ci mərhələdə real quraşdırma üzərində sübut olunmalıdır.

Qəbul meyarı: 52 və 53 quraşdırılmış cihazda 60 üstünə yazılır; istifadəçi girişli qalır, PIN, oyun irəliləyişi, taymerlər və dil saxlanır.

## 7. Yığım: Codemagic

### Hazırkı mexanizm (`codemagic.yaml`, `docs/CODEMAGIC.md`)

- İki workflow, yalnız əl ilə **Start new build**: `ios-store` (IPA, App Store Connect-ə yüklənir, TestFlight-a avtomatik təqdim olunmur) və `android-store` (AAB + APK, Play-ə əl ilə yüklənir). `mac_mini_m2`.
- Dəyişən qrupları: `anacan_native`, `anacan_ios_signing`, `anacan_android_signing`.
- Addımlar: `npm ci` → `check-native-env.mjs` (qəbul JSON-u canlı cavabla sahə-sahə tutuşdurulur) → `vite build --mode google` → veb sayt və məzmun paketləri silinir → `cap sync` → `apply-native-config.mjs` (canlı AdMob ID-si, Customer.io açarı yalnız native konfiqurasiyaya) → imza → yığım.
- iOS: 3 bundle id üçün profil API ilə alınır; build nömrəsi App Store Connect-dəki son TestFlight build-i + 1.
- Android: `versionName = APP_VERSION.SEQ`, `versionCode = 5200 + SEQ`; `ANDROID_BUILD_SEQ` əl ilə artırılır.

### Flutter üçün (eyni qalan və dəyişən)

| | Vəziyyət |
|---|---|
| Əl ilə başlatma, `mac_mini_m2`, artifact və yükləmə qaydası | Eyni qalır |
| Üç dəyişən qrupu və içindəki adlar | Eyni qalır; yeni sirr tələb olunmur |
| iOS imzası (3 bundle id, eyni sertifikat açarı) | Eyni qalır |
| Android upload keystore | Eyni qalır |
| Versiya sxemi | `APP_VERSION: "60.0"`; Android `versionCode = 6000 + SEQ`; iOS 60.0.0-dan |
| Qəbul yoxlaması, canlı AdMob ID-si, Customer.io açarının paketə düşməməsi | Eyni yoxlamalar, eyni skriptlər Flutter yollarına uyğunlaşdırılır |
| `npm ci` + `vite build` + `cap sync` | `flutter pub get` + `flutter test` + `flutter build ipa` / `appbundle` ilə əvəz olunur |
| Mühit dəyərləri | `VITE_*` dəyişənləri build zamanı `--dart-define-from-file` faylına çevrilir |

Capacitor workflow-ları (`ios-store`, `android-store`) silinmir: körpü buraxılışı və geri qayıtma üçün qalır. Flutter üçün `ios-flutter-store` və `android-flutter-store` əlavə olunur. Codemagic-də layihə tipi dəyişdirilməlidirsə, bu, panel üzərindən sizin edəcəyiniz yeganə addımdır.

## 8. Performans işləri

- WebView yüklənməsi aradan qalxır; açılış bir mərhələli olur.
- Bütün uzun siyahılar tənbəl qurulur.
- Blur yalnız nav çubuğunda; `a-lite` səviyyəsi saxlanır.
- Lüğət, məzmun paketləri və oyun generatorları isolate-də işləyir.
- Şəkillər ölçüyə görə dekodlanır və diskdə keşlənir.
- Android-də R8 kiçiltməsi açılır.
- Ölçmə: soyuq açılış, scroll-da kadr vaxtı, yaddaş, paket ölçüsü. Əvvəl 52 Capacitor paketində, sonra Flutter-də eyni cihazlarda ölçülür.

## 9. Mərhələlər

Hər mərhələ ayrı PR-dır. Növbəti mərhələ əvvəlkinin qəbul meyarı keçmədən başlamır.

| # | Mərhələ | Məzmun | Qəbul meyarı |
|---|---|---|---|
| 0 | Hazırlıq | `main-630mc7` üzrə tam inventar və ekran uyğunluq cədvəli; istinad şəkilləri infrastrukturu; token, ikon, sətir ixrac skriptləri; Flutter skeleti; Codemagic Flutter workflow-ları | Hər ekranın sətri və istinad şəkli var; boş Flutter tətbiqi Codemagic-də imzalı yığılır |
| B | Körpü buraxılışı 53.0 | Capacitor tətbiqinə `localStorage` ixracı | 52 → 53 yeniləməsində ixrac açarı yazılır; mağazaya çıxır |
| 1 | Nüvə | Dizayn sistemi, dil qatı və məzmun paketləri, qəbul protokolu, auth, sessiya, oflayn, məlumat köçü, keş, tab qabığı | Protokol testləri Dart-da keçir; 52/53 üstünə yeniləmədə giriş və yerli məlumat qalır |
| 2 | Giriş axını | Splash, dil, razılıq qapısı, intro, auth, e-poçt təsdiqi, onboarding, paywall, RevenueCat | Sandbox alışı, bərpa, birdəfəlik təklif |
| 3 | Ana ekranlar | Flow, bump, mommy panelləri, stories, təqvim, profil, ayarlar, bildirişlər, tətbiq kilidi | Üç rejim golden keçir |
| 4 | Alətlər | Bütün alətlər dəstələrlə: hamiləlik, körpə, AI/media, həyat tərzi, valideynlik məzmunu | Hər alət üçün DoD |
| 5 | Sosial | İcma, stories, qruplar, mesajlar, stikerlər, AI çat (axın, Dayandır) | Realtime və media yükləmə |
| 6 | Partnyor | Partnyor qabığı, qoşulma, SOS, canlı sancılar, missiyalar | İki cihazla cüt sınaq |
| 7 | Ticarət və məzmun | Aptek, tortlar, mağaza, partnyor mağazaları, QayğıCash, kitablar, bloq, Epoint | Sifariş axını başdan sona |
| 8 | Oyunlar | Bütün mini oyunlar; mühərrik və testlər əvvəl, UI sonra | Mühərrik testləri keçir; saxlanmış irəliləyiş oxunur |
| 9 | Native tamamlama | Push və toxunuşlar, yerli bildirişlər, Live Activity, vidcetlər, Health, reklamlar, ekran qoruması, Customer.io, TikTok, deeplink | Fiziki iOS və Android cihazda yoxlama siyahısı |
| 10 | Sərtləşdirmə və buraxılış | 25 dil yoxlaması, performans ölçümü, yeniləmə sınaqları, TestFlight və daxili test, mərhələli yayım | Aşağıdakı qapılar |

Körpü buraxılışı (B) 0-cı mərhələ ilə paralel gedir: nə qədər tez çıxsa, 60.0-a qədər o qədər çox istifadəçi onu alır. 4–8 mərhələləri nüvə hazır olandan sonra paralel aparıla bilər.

### Buraxılış qapıları

- Uyğunluq cədvəlində açıq sətir yoxdur.
- 52 və 53-dən yeniləmə sınağı hər iki platformada keçir.
- Yeni Google və Apple girişi, alış, bərpa, push, reklam, Health, vidcetlər real cihazda yoxlanıb.
- Android 16 KB səhifə uyğunluğu, target 36 / min 26, eyni upload açarı.
- iOS: komanda `8B6976J8H7`, 3 bundle id, App Group, production entitlement-lər.
- Mərhələli yayım; çökmə və giriş itkisi göstəriciləri izlənir.
- Geri qayıtma: Capacitor workflow-ları saxlanır; problem olarsa daha yüksək versiya ilə yenidən buraxıla bilər. Bunun üçün Flutter-in yazdığı sessiya formatı Capacitor-un oxuduğu ilə eyni qalmalıdır.

## 10. İcra modeli

- Planlama və mərhələ baxışı Fable 5.2, icra Opus 5.5 ilə.
- Əvvəl təmiz məntiq və onun testləri (hesablamalar, protokol, oyun mühərrikləri), sonra UI. React faylı həqiqət mənbəyidir; Dart faylının başında onun yolu qeyd olunur.
- Tapılan qüsurlar Flutter-də düzəldilir və `docs/FLUTTER_PARITY_FIXES.md`-də qeyd olunur ki, fərq qəsdən olduğu bilinsin.
- React-da funksiya dondurması qüvvədədir; təcili düzəliş olarsa, uyğunluq cədvəlinə düşür.

## 11. Risklər

| Risk | Azaltma |
|---|---|
| `localStorage` köçü alınmır (PIN, oyun irəliləyişi itir) | Körpü buraxılışı + gizli WebView; 1-ci mərhələdə sübut |
| Bulud icra mühitində Xcode yoxdur | iOS yalnız Codemagic-də yığılır və yoxlanır; hər iOS dəyişikliyi bir build dəqiqəsi xərcləyir |
| AdMob native story reklamının hazır əvəzi yoxdur | 9-cu mərhələdə native fabrik kimi yazılır |
| Inline lokalizasiya açarları React fayl yoluna bağlıdır | Açarlar ixrac olunub olduğu kimi saxlanır |
| Health sync identifikatorları | Uyğun gəlməsə, mövcud native kod saxlanır |
| Uzun müddət iki kod bazası | Mərhələli qəbul, funksiya dondurması |

Yoxlanmamış qalan: `mommy-simulator/` (ayrı layihə) tətbiqə necə qoşulur; yeni modulların tam siyahısı və ölü kod; Codemagic-də layihə tipinin dəyişdirilməsinin tələb olunub-olunmadığı.

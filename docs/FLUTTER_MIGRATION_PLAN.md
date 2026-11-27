# Anacan: Capacitor → Flutter keçid planı

Tarix: 2026-11-27. Status: **plan, icra başlamayıb.** Bu sənəd analizin nəticəsi və icra üçün müqavilədir.

## 1. Qısa cavab

Bəli, keçid mümkündür. Backend, verilənlər bazası, edge function-lar, admin paneli və veb sayt toxunulmaz qalır; yalnız iOS/Android istehlakçı tətbiqi Flutter ilə yenidən yazılır. Tətbiq eyni `com.atlasoon.anacan` identifikatoru ilə mağazada adi yeniləmə kimi çıxır, istifadəçi girişli qalır.

İki şeyi əvvəlcədən dürüst demək lazımdır:

- Bu, "çevirmə" deyil, **yenidən yazmadır**. Mobil tətbiqə aid təxminən 140 min sətir React kodu Dart-a əl ilə köçürülməlidir; avtomatik çevirici yoxdur.
- "Dizayn dəyişmir" ölçü, rəng, boşluq, animasiya və axın səviyyəsində təmin olunur. Mətnin piksel səviyyəsində hamarlanması WebView və Flutter mühərrikində bir qədər fərqlidir, ona görə hədəf "gözlə fərq görünmür"dür, "bit-bit eyni" deyil.

## 2. Analizin nəticəsi (mövcud vəziyyət)

| Sahə | Fakt |
|---|---|
| Kod | `src/` 1 177 fayl, ~194 min sətir. Bundan ~36 min admin, ~5 min shadcn; veb sayt, brend portalı, açıq bloq ayrıdır |
| Naviqasiya | `react-router` yalnız xarici qabıqdır. Əsl tətbiq `src/pages/Index.tsx`-dəki vəziyyət maşınıdır: `activeTab`, `activeScreen`, `activeTool` |
| Rejimlər | `flow`, `bump`, `mommy` (qadın, 5 tab) və ayrıca partnyor qabığı (5 tab) |
| Ekranlar | ~35 alt ekran, 44 alət, icma/stories/çat, partnyor v2, aptek/tortlar/mağaza, bloq, 7 mini oyun |
| Dizayn | İki token sistemi: shadcn HSL (`src/index.css`) və əsas olan `--a-*` (`src/styles/anacan-design.css`, 2 918 sətir, 272 sinif). ~4 300 inline `style`, işıqlı/qaranlıq tema, RTL (ərəb) |
| Animasiya | `framer-motion` 193 faylda, 19 Tailwind keyframe. Lottie/Rive yoxdur |
| Backend | Supabase-uyğun API `https://api.anacan.az` (Google-da). 203 cədvəl, 56 RPC, 23 realtime kanal, 6 storage bucket, 36 edge function |
| Qəbul protokolu | `/.well-known/anacan-backend.json`, pin, maintenance, minimum native versiya, 60 saniyəlik izləmə |
| Sessiya | Backend-ə görə ayrı açar, Preferences-də ehtiyat nüsxə, logout tombstone, birtərəfli adoption qəbzi, refresh-before-use |
| Dil | 21 dil, 4 qat: açar lüğəti (7 600–11 400 açar), build zamanı inline lokalizasiya, bölmə mətnləri, DB sətir məzmunu (12 dil üçün 64 MB paket) |
| Native | 20+ Capacitor plagini, 4 yerli plagin (LiveActivity, HealthCycle, HealthVitals, ScreenshotGuard), Customer.io paketi, 3 patch (AdMob-a native story reklamı daxil) |
| Testlər | 158 vitest faylı, ~788 test; protokol, hesablama və oyun mühərrikləri təmiz məntiqdir |

### Performansın bugünkü ağrılı yerləri (kodda qeyd olunub)

- Zəif cihazlarda blur və sonsuz animasiyalar donma verir; `a-lite` rejimi ilə söndürülür.
- Tab keçidində `AnimatePresence` scroll-u kilidləyirdi, çıxarılıb.
- Uzun siyahıların heç biri virtuallaşdırılmayıb (icma lenti, adlar).
- `tr()` hər render-də minlərlə dəfə çağırılır, keşlə yamaqlanıb.
- iOS 45-də WKWebView toxunuş donması olub (46-da düzəldilib).
- Splash üç mərhələlidir: native → HTML → React.

Bunların hamısı WebView arxitekturasının nəticəsidir və Flutter-də struktur olaraq aradan qalxır.

## 3. Əhatə

**Flutter-ə keçir:** iOS və Android istehlakçı tətbiqi, bütün ekranları, alətləri, oyunları və native inteqrasiyaları ilə.

**React-da qalır (toxunulmur):** admin paneli, moderator veb konsolu, brend portalı, `anacan.az` saytı, açıq bloq, hüquqi səhifələr, brauzer giriş/launcher səhifəsi. Bunlar onsuz da veb üçündür.

**Dəyişmir:** backend, DB sxemi, RLS, edge function-lar, push göndərişi, RevenueCat məhsulları, AdMob vahidləri, Customer.io, Firebase layihəsi `anacan-mobile`.

**Köçürülmür (ölü kod, istifadəçiyə görünmür):** `funnel/` köhnə addımları, istifadə olunmayan 29 shadcn komponenti, `@lovable.dev/cloud-auth-js`, Mixpanel stub-ları, Lovable preview auth broker-i, Android-də manifestə qoşulmamış `TimerWidgetProvider`.

## 4. Hədəf arxitektura

Flutter layihəsi eyni repozitoriyada `app/` qovluğunda yaradılır; lokalizasiya toxumları, şəkillər və token mənbələri React kodu ilə ortaq qalır.

```
app/
  lib/
    core/        admission, auth, session, storage, cache, i18n, analytics, device_tier
    design/      tokens (generasiya), tema, a_* vidcetləri, sheet, toast, ikonlar, motion
    shell/       gate ardıcıllığı, tab qabığı, activeScreen maşını, deeplink, pushNav
    features/    home, flow, bump, mommy, tools/*, community, chat, partner, commerce, blog, games/*
    native/      live_timer, health, screenshot_guard, ads, purchases
  test/          vitest-dən köçürülmüş testlər + golden testlər
  ios/ android/  mövcud widget extension və foreground service buraya daşınır
```

Əsas seçimlər:

- **Vəziyyət:** Riverpod. `userStore`, `childStore`, `timerStore`, `homePlanStore` eyni sahələrlə notifier olur.
- **Naviqasiya:** `go_router` yalnız xarici marşrutlar və deeplink üçün; daxildə `Index.tsx`-in vəziyyət maşını birə-bir saxlanır ki, geri düyməsi, scroll yaddaşı və swipe davranışı dəyişməsin.
- **Backend:** `supabase_flutter`, URL qəbul protokolundan sonra seçilir; sessiya anbarı mövcud açar sxemini yazan xüsusi `LocalStorage`-dır.
- **Keş:** React Query-nin davranışını təkrarlayan qat: 30 s stale, 7 gün disk keşi, eyni istisna siyasəti (`query-persist-policy.ts`).
- **Dil:** eyni `tr(key, default)` imzası və eyni açarlar, beləliklə DB-dəki `translations` örtüyü dəyişmədən işləyir.

### Plagin uyğunluğu

| Capacitor | Flutter | Qeyd |
|---|---|---|
| admob (patch ilə) | `google_mobile_ads` | Banner, interstitial, rewarded, UMP daxildir. Native story reklamı `NativeAd` fabriki ilə yenidən qurulur |
| revenuecat + ui | `purchases_flutter`, `purchases_ui_flutter` | Eyni offering `pricing_2026`, entitlement, appUserID = Supabase UUID |
| firebase auth (Google) | `google_sign_in` → `signInWithIdToken` | Firebase sessiyası onsuz da atılırdı |
| apple-sign-in | `sign_in_with_apple` | Eyni nonce sxemi |
| firebase messaging/analytics | `firebase_messaging`, `firebase_analytics` | `device_tokens` yazısı eyni |
| local-notifications | `flutter_local_notifications` | Eyni id-lər: 101, 200, 91201, timer hash |
| capacitor-health + 2 yerli plagin | `health` | HealthKit və Health Connect yazıları; sync id-lər yoxlanmalıdır |
| LiveActivity plagini | Mövcud Swift widget + kiçik MethodChannel | Widget extension olduğu kimi qalır |
| TimerForegroundService | Mövcud Kotlin + MethodChannel | Olduğu kimi qalır |
| ScreenshotGuard | MethodChannel port | ~230 sətir native |
| customerio-data-in | `customer_io` | Rəsmi Flutter SDK |
| facebook-events, ATT | `facebook_app_events`, `app_tracking_transparency` | |
| native-biometric | `local_auth` | PIN hash sxemi eyni: SHA-256(salt + PIN) |
| camera, geolocation, share, filesystem, haptics, review, status-bar, splash | `image_picker`, `geolocator`, `share_plus`, `path_provider`, `HapticFeedback`, `in_app_review`, `SystemChrome`, `flutter_native_splash` | |

### Veb kitabxanalarının əvəzi

| React | Flutter |
|---|---|
| recharts (5 fayl) | `fl_chart` |
| jsPDF (həkim hesabatı) | `pdf` + `printing`, eyni Noto şriftləri |
| Bloq HTML (marked + DOMPurify) | `flutter_widget_from_html`; server onsuz da təmizlənmiş HTML verir |
| react-markdown | `flutter_markdown` |
| vaul sheet | Xüsusi `ASheet`: grabber, 28 px radius, arxa fonun kiçilməsi |
| sonner + radix toast | Bir toast qatı, iki görünüş saxlanır |
| lucide-react (~360 ikon) | 0.462 versiyasından ixrac olunmuş SVG-lər, kompilyasiya edilmiş vektor |
| qrcode, emoji-picker, confetti | `qr_flutter`, `emoji_picker_flutter`, `confetti` |
| MediaRecorder, WebAudio, `<video>` | `record`, `just_audio`/sintez, `video_player`, `noise_meter` |
| Web Worker (oyunlar) | Dart isolate |
| `<canvas>` (Leaf Flight, story kəsimi) | `CustomPainter` + sabit 60 Hz addım |

Paket versiyaları icranın əvvəlində son stabil buraxılışlara bərkidilir və hər biri real cihazda yoxlanır; bu cədvəl niyyətdir, yoxlanmış uyğunluq deyil.

## 5. Dizaynın eyni qalması necə təmin olunur

1. **Tokenlər generasiya olunur.** Skript `index.css`, `anacan-design.css` və `tailwind.config.ts`-dən bütün dəyişənləri oxuyub Dart sabitləri yaradır. Əl ilə rəng yazılmır.
2. **`a-*` sinifləri vidcet kitabxanası olur.** 272 sinif bir dəfə, mərkəzləşmiş şəkildə köçürülür; ekranlar onlardan yığılır.
3. **Şriftlər tətbiqə daxil edilir:** Inter, Nunito, Noto Sans Arabic. Hazırda Google Fonts CDN-dən yüklənir; daxil etmək görünüşü dəyişmir, oflayn açılışı düzəldir.
4. **Animasiyalar eyni əyrilərlə:** `--a-ease`, `--a-spring`, `--a-bounce` və ən çox işlənən spring (300/25) sabit kimi köçürülür.
5. **İstinad şəkilləri.** Mövcud React tətbiqi Playwright ilə sabit məlumat üzərində işə salınır və hər ekranın şəkli çəkilir: 390×844 və 360×800, işıqlı/qaranlıq, `az`/`en`/`ru`/`ar`, 3 rejim və partnyor. Hazırda belə infrastruktur yoxdur, 0-cı mərhələdə qurulur.
6. **Flutter golden testləri** həmin şəkillərlə piksel fərqi üzrə müqayisə olunur. Mətn hamarlanmasına görə hədd sıfır deyil; həddi keçən hər ekran əl ilə baxılır.
7. **Hər ekran üçün "hazırdır" tərifi:** golden keçir, 4 dildə daşma yoxdur, RTL düzgündür, qaranlıq tema düzgündür, haptika və animasiya orijinalla uyğundur, analitika hadisələri eynidir.

## 6. Mövcud istifadəçilərin məlumatı (ən kritik hissə)

Yeniləmədən sonra istifadəçi girişli qalmalı və yerli məlumatını itirməməlidir.

**Birbaşa oxunan məlumat.** Capacitor Preferences native anbardadır: iOS-da `UserDefaults` (`CapacitorStorage.` prefiksi), Android-də `CapacitorStorage` SharedPreferences. Flutter bunları birbaşa oxuyur:

- `anacan.auth.session.v2:<realm>` — sessiya və logout tombstone
- `anacan.auth.adoption.v1:…` — adoption qəbzi
- `anacan.backend-admission.v1` — qəbul pini
- dil və intro bayraqları, `anacan-pending-timer-stops`

Yəni **giriş vəziyyəti WebView-suz qorunur**; refresh token ilə sessiya bərpa olunur.

**WebView `localStorage`-də qalan məlumat.** Flutter bunu birbaşa oxuya bilmir:

- tətbiq kilidi PIN-i (`anacan_lock_*`)
- oyun irəliləyişləri (Söz bağı, İki dost, Color Sort və s.)
- aktiv taymerlər, ev planı işarələri, sağlamlıq açarları
- reklam və premium keşi, görülmüş postlar, onboarding vəziyyəti

Profil məlumatı (`anacan-user-store`) serverdən bərpa olunur, itki riski yoxdur.

**Həll, iki qatlı:**

1. **Körpü buraxılışı (tövsiyə).** Son Capacitor versiyası (48) açılışda vacib `localStorage` açarlarını Preferences-ə `anacan.migration.localstore.v1` kimi köçürür. Flutter onu native oxuyur.
2. **Ehtiyat yol.** 48-i ötürüb birbaşa Flutter-ə keçənlər üçün ilk açılışda gizli WebView eyni origin ilə (`app.anacan.az`) bir dəfə açılır, açarları oxuyur və bağlanır. Bu, hər iki platformada kiçik native kod tələb edir və 1-ci mərhələdə real 47 quraşdırması üzərində sübut olunmalıdır.

Qəbul meyarı: 47 Store paketi quraşdırılmış cihazda Flutter paketi üstünə yazılır; istifadəçi girişli qalır, PIN, oyun irəliləyişi və dil saxlanır.

## 7. Performans işləri

Funksional dəyişiklik yoxdur; bunlar arxitekturadan gələn qazanclardır.

- WebView yüklənməsi aradan qalxır; splash bir mərhələli olur.
- Bütün uzun siyahılar tənbəl qurulur (lent, adlar, bloq, çat).
- Blur yalnız nav çubuğunda, scroll zamanı yenidən hesablanmadan; `a-lite` səviyyəsi saxlanır.
- Lüğət, 64 MB məzmun paketi və Söz bağı leksikonu isolate-də açılır, dilə görə tənbəl yüklənir.
- Şəkillər ölçüyə görə dekodlanır və diskdə keşlənir.
- Oyun generatorları isolate-də işləyir.
- Android-də R8 kiçiltməsi açılır (hazırda `minifyEnabled false`).
- Ölçmə: soyuq açılış, lent scroll-unda kadr vaxtı, yaddaş, paket ölçüsü. Əvvəl 47 Capacitor paketində, sonra Flutter-də eyni cihazlarda ölçülür və nəticə yazılır.

## 8. Mərhələlər

Hər mərhələ ayrı budaq və baxış üçün ayrı PR-dır. Növbəti mərhələ əvvəlkinin qəbul meyarı keçmədən başlamır.

| # | Mərhələ | Məzmun | Qəbul meyarı |
|---|---|---|---|
| 0 | Hazırlıq | React bazasının dondurulması; istinad şəkilləri infrastrukturu; token, ikon, sətir ixrac skriptləri; ekran uyğunluq cədvəli (hər ekran bir sətir); Flutter skeleti; CI | Bütün ekranların istinad şəkli var; ixraclar təkrarlanandır |
| 1 | Nüvə | Dizayn sistemi, dil qatı, qəbul protokolu, auth, sessiya, məlumat köçü, keş, tab qabığı | Protokol testləri Dart-da keçir; 47 üstünə yeniləmədə giriş qalır |
| 2 | Giriş axını | Splash, dil seçimi, intro, auth, ölkə qapısı, onboarding, paywall, RevenueCat | Sandbox alışı, bərpa və birdəfəlik təklif işləyir |
| 3 | Ana ekranlar | Flow, bump, mommy panelləri; təqvim; profil; ayarlar; bildirişlər; tətbiq kilidi | Üç rejim golden keçir |
| 4 | Alətlər | 44 alət, 4 dəstədə: hamiləlik, körpə, AI/media, həyat tərzi və bazar | Hər alət üçün DoD |
| 5 | Sosial | İcma lenti, stories, qruplar, birbaşa mesajlar, AI çat (SSE), moderasiya təsiri | Realtime və media yükləmə işləyir |
| 6 | Partnyor | Partnyor qabığı v2, qoşulma, SOS, canlı sancılar, sürprizlər | İki cihazla cüt sınaq |
| 7 | Ticarət və məzmun | Aptek, tortlar, mağaza, endirim partnyorları, bloq, Epoint ödənişi, hüquqi səhifələr | Sifariş axını başdan sona |
| 8 | Oyunlar | 7 oyun; mühərriklər və testləri əvvəl, UI sonra | Mühərrik testləri keçir; saxlanmış irəliləyiş oxunur |
| 9 | Native tamamlama | Push və keçidlər, yerli bildirişlər, Live Activity, Android taymer servisi, Health, reklamlar, ekran görüntüsü qoruması, Customer.io, deeplink | Fiziki iOS və Android cihazda yoxlama siyahısı |
| 10 | Sərtləşdirmə və buraxılış | 21 dil yoxlaması, performans ölçümü, yeniləmə sınaqları, TestFlight və daxili test, mərhələli yayım | Aşağıdakı buraxılış qapıları |

Həcm baxımından ən ağır hissələr 4 (alətlər, ~22 min sətir), 1 (nüvə, hər şey ondan asılıdır) və 5-dir (sosial). 4–8 mərhələləri nüvə hazır olandan sonra paralel aparıla bilər.

### Buraxılış qapıları

- Uyğunluq cədvəlində açıq sətir yoxdur.
- 47-dən yeniləmə sınağı hər iki platformada keçir.
- Yeni Google və Apple girişi, alış, bərpa, push, reklam, Health real cihazda yoxlanıb.
- Android 16 KB səhifə uyğunluğu, target 36 / min 26, eyni imza açarı.
- iOS: komanda `8B6976J8H7`, widget bundle id, App Group, production entitlement-lər.
- Mərhələli yayım: Play-də 5% → 20% → 100%, App Store-da mərhələli buraxılış. Çökmə və giriş itkisi göstəriciləri izlənir.
- Geri qayıtma: son Capacitor paketi saxlanır; problem olarsa daha yüksək versiya nömrəsi ilə yenidən buraxıla bilər. Bunun üçün Flutter-in yazdığı sessiya formatı Capacitor-un oxuduğu formatla eyni qalmalıdır.

## 9. İcra modeli

- Planlama və mərhələ baxışı Fable 5.2, icra Opus 5.5 ilə.
- Hər mərhələnin əvvəlində qısa texniki brif, sonunda uyğunluq cədvəlinin yenilənməsi.
- Köçürmə qaydası: əvvəl təmiz məntiq və onun testləri (hesablamalar, protokol, oyun mühərrikləri), sonra UI. React faylı "həqiqət mənbəyi"dir; Dart faylının başında onun yolu qeyd olunur.
- Köçürmə zamanı React-da tapılan səhvlər düzəldilmir, ayrıca siyahıya yazılır; davranış eyni saxlanır. Düzəliş ayrıca qərardır.
- Keçid müddətində React tətbiqinə yeni funksiya əlavə olunarsa, uyğunluq cədvəlinə düşməlidir. Ən yaxşısı həmin müddətdə funksiya dondurmasıdır.

## 10. Risklər

| Risk | Təsir | Azaltma |
|---|---|---|
| `localStorage` köçü alınmır | PIN və oyun irəliləyişi itir | Körpü buraxılışı + gizli WebView; 1-ci mərhələdə sübut |
| Buraxılış alətləri bu repoda yoxdur | Repodakı native layihələr 24/25 versiyasındadır, Store 47-dir; canlı AdMob/Customer.io açarları və imza `azure-migration/` qovluğundadır | İcra üçün həmin qovluğa və imza materialına giriş lazımdır |
| iOS yığımı | Bulud mühitində Xcode yoxdur | Mac və ya bulud Mac CI tələb olunur |
| AdMob native story reklamı | Patch ilə yazılıb, hazır əvəzi yoxdur | 9-cu mərhələdə native fabrik kimi yenidən yazılır |
| 64 MB məzmun paketi | Paket ölçüsü | Dilə görə sıxılmış və tənbəl; hazırkı çatdırılma üsulu 0-cı mərhələdə dəqiqləşdirilir |
| Inline lokalizasiya açarları fayl yoluna bağlıdır | 7 köhnə dildə tərcümə itə bilər | Açarlar ixrac olunub olduğu kimi saxlanır; köhnə dillərin örtüyü DB-dən yoxlanır |
| Health sync identifikatorları | Təkrarlanan qeydlər | Paket uyğun gəlməsə, mövcud Swift/Kotlin kodu kanal ilə saxlanır |
| Həcm | Uzun müddət iki kod bazası | Mərhələli qəbul, funksiya dondurması |

Yoxlanmamış qalan məqamlar: `mommy-simulator/` (ayrı Godot layihəsi) tətbiqə necə qoşulur; 7 köhnə dildə inline açarların mənbəyi; 48.x inkişaf paketlərinin (Söz bağı və digər oyunlar) Store-a çıxıb-çıxmayacağı.

## 11. Sizdən gözlənilən qərarlar

1. **Tətbiq daxilində admin paneli.** Hazırda admin istifadəçi profildən admin panelini tətbiqin içində aça bilir. Tövsiyə: Flutter-ə köçürmədən veb-də saxlamaq, tətbiqdən brauzerdə açmaq (36 min sətir qənaət). Moderator konsolu üçün də eyni sual.
2. **Körpü buraxılışı.** Flutter-dən əvvəl son Capacitor versiyası (48) məlumat ixracı ilə buraxılsın? Tövsiyə: bəli.
3. **Versiya nömrəsi.** Flutter buraxılışı üçün 50.0 təklif olunur ki, 48.x ilə qarışmasın.
4. **Funksiya dondurması.** Keçid müddətində React tətbiqinə yeni funksiya əlavə olunacaq?
5. **Köçürmə zamanı tapılan qüsurlar.** Məsələn, Android-də `HealthVitals` plagini qeydiyyatdan keçmədiyi üçün işləmir. Olduğu kimi saxlanılsın, yoxsa Flutter-də işlək olsun?
6. **Buraxılış materialı.** `azure-migration/` qovluğuna, imza açarlarına və Mac yığım mühitinə giriş necə təmin olunacaq?

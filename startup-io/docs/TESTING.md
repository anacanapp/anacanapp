# startup.io Unlimited 1.5.0 — test qəbulu

Tarix: **2026-10-08–09**. Native build **6**, `com.atlasoon.startupio`.

| Yoxlama | Cari nəticə |
| --- | --- |
| Mexanika, deterministik dünya, save/wallet migration | **66/66 PASS** |
| iPhone WebKit + Android Chromium | **30/30 PASS**, skipped/flaky0 |
| TypeScript + production web build + Capacitor sync | **PASS** |
| npm audit / production dependencies | **0 vulnerabilities** |
| İmzalı iPhoneOS arm64 development build | **PASS**, 0 xəta / 0 xəbərdarlıq |
| Final iOS archive | **PASS**, exact identity/signature və36asset |
| Final App Store distribution IPA | **BLOKLANIB**, Xcode account/distribution certificate unavailable; user-accepted |
| Android signed APK/AAB, lint,16KB zip alignment | **PASS**, SDK36, release non-debuggable |
| Final iPhone J install/launch | **Pending**, phone locked; earlier1.5.0 install/launch is historical |
| Final iOS native gameplay | **3/3 PASS**, current36asset hash-bound |
| Native iPhone/iPad store screenshots | **10/10 PASS**, EN, current36asset hash-bound |
| Native Android gameplay/store screenshots | **PASS**, API35 signed release,5native captures/background pause |
| Fiziki gameplay | iOS/Android avtomatik gameplay hələ keçirilməyib |

## Mexanika və brauzer

- Unlimited: dünya sərhədi, countdown, level seçimi və growth cap yoxdur.
  Maksimum81 aktiv chunk/192 recent qeyd cache həcmidir. BigInt origin uzun
  səyahətdə dəqiqliyi saxlayır; yenidən ziyarət və checkpoint deterministikdir.
-48 orijinal uydurma rəqib/dörd Venture fondu; köhnə durable botID/mövqe/dəyər,
  wallet və kosmetik kolleksiya saxlanır. Credit ledger təkrar ödənişi önləyir.
-1.1s görünən takeover windup, contact-u kəsən escape/PIVOT,24s cooldown,
  qısa sipər, resume protection və nəhəng rəqiblərin bounded render ölçüləri.
- AI/Fintech/Cloud, market fazaları, Venture powers və birdəfəlik founder bonusları.
- Real steering funding toplayır; ikinci barmaq BOOST, PIVOT və pause/background
  lifecycle yoxlanır. Save-exit/reload/resume və təkrar kosmetik alış bankı qoruyur.
-320px telefonlardan üfüqi rejimə qədər launch/profile/HUD/safe-area ölçüləri,
  local image decode, hüquqi səhifələr və local progress deletion yoxlanır.
- Son browser run2026-10-09 **06:52–06:55UTC**,30passed/0skipped/0flaky.
  Engine readiness və hərəkət fixed timing əvəzinə müşahidə edilən nəticə ilə gözlənilir.

Receipts: `artifacts/mechanics-acceptance.json`, `artifacts/browser-acceptance.json`,
`test-results/.last-run.json`.

## Native iOS və fiziki cihaz

`npm run ios:test` yalnız üç gameplay/lifecycle UI ssenarisini işlədir;
`StartupIOStoreScreenshots` ayrıca capture class-dır. Testin DEBUG storage açarı
`startup.io.ui-test.v1`-dir; oyunçu gedişatı ayrıca saxlanır.

Native testlər: real drag/growth, PIVOT cooldown, pause/landscape/save-resume,
Lotus AI alışı250→70/persistence və EN/background pause. Final status üçün
`artifacts/ios-test-receipt.json` və onun tamamlanmış `.xcresult` summary-si əsasdır.
Hər receipt cari36web asset manifest-inə bağlanır.

Final run **`artifacts/ios-test-1791529857689.xcresult`**:3passed/0failed/0skipped,
2026-10-09 07:16UTC tamamlanıb. Web manifest:
`076e550776a4d3a60dfaf9e9ef8345b1bdb6e05d5395dbad7fec483082a7f0eb`.
Yalnız AppIntents metadata extraction warning var; native test error yoxdur.

Native store captures: iPhone17 Pro1206×2622 və iPadPro13-inch(M5)2064×2752,
beşEnglish ekran/platform (home/arena/PIVOT/marketplace/customize). Hər PNG
alpha-sızdır və hash/dimensions yoxlanıb. Final source üçün captures yenidən
çəkilib; image editing və synthetic gameplay injection istifadə edilməyib.
Receipt: `artifacts/store-1.5.0/screenshots/screenshots.json`.
Final nativecapturebundles: `iphone-1791530462268.xcresult` və
`ipad-1791530841979.xcresult`, hərəsində1passed/0failed; finaliPad07:41UTC-də keçib.

Əvvəlki1.5.0/build6 candidate iPhone J / iPhone13 Pro Max-da quraşdırılıb,
foreground-da açılıb və running process təsdiqlənib. Bu proof son safe-area/pause
fix-dən əvvəldir; final package həmin install proof-u current qəbul kimi istifadə etmir:

- `artifacts/iphone-j-1.5.0-install.json`
- `artifacts/iphone-j-1.5.0-launch.json`
- `artifacts/iphone-j-1.5.0-app.json`
- `artifacts/iphone-j-1.5.0-running.json`
- `artifacts/iphone-j-1.5.0-direct-build.json`

Final telefona install/launch device lock səbəbi ilə pending-dir; istifadəçi
signing/device blocker ilə təhvili seçib. Fiziki gameplay sınağı keçirilməyib.

## Native Android mühiti

İmzalı release APK/AAB, lintRelease, identity/signature,16KB zip alignment,
non-debuggable WebView və APK/AAB36asset parity keçib; bundled `.so` yoxdur.
Əvvəlki software-rendered API35/36 AOSP emulyatorları System UI/Quickstep ANR
göstərib. Son API35 host-MoltenVK/guestANGLE cihazı stabil olduğundan signed
release gameplay qəbulu tamamlanıb: real drag/growth,PIVOT,pause,save/relaunch/
resume,ENpersistence və Home-backgroundpause. Beş native1080×2400 şəkil var.

`scripts/android-acceptance.mjs` ayrıca`StartupIO35`/`StartupIO36` AVD-ni istifadə
edir; macOS defaultAPI35/hostGuestANGLE-dir. `scripts/android/NativeSnapshot.java`
shellUiAutomation root-u animation-idle gözləmədən oxuyur; test JAR oyun bundle-ına
daxil deyil. Snapshot hər dəfə yeni XML yolundadır; stale hierarchy qəbul edilmir.
Final WebView top-edge0/fullscreen, HUD cutout-safeCSSvə immediateApppause listener
keçir. Son run2026-10-09 **06:27–06:30UTC**,7checks/5screenshotsPASS.
Receipt: `artifacts/store-1.5.0/android-acceptance/acceptance.json`.

## Paket və public qəbul

`npm run package:test` exact native identity/version/signature,66/30/3test və
dist/simulator/device/Android/IPA/APK asset hash-lərini yoxlayır.
`npm run store:handoff -- --with-signing-blocker` verifiedPlayAAB/APK/testpackages,
currentiOSarchive/native screenshots,listing və `.gitignore`-a uyğun clean source
archive hazırlayır. User-accepted signing blocker final AppStoreIPA-nı pending saxlayır.

Yeddi Google Cloud Run public support/legal səhifəsi HTTP200, content-hash və
session-free response ilə yenidən təsdiqlənib; tətbiq oflayn işləyir.
Receipt: `artifacts/store-public-urls.json`.

## Qəbul tarixçəsi

- `ios-test-1791477037102.xcresult`: external timeout/BUILD INTERRUPTED, tamamlanmayıb.
- `ios-test-1791479085895.xcresult`: ilk cold WebKit launch timeout; digər2testPASS.
- `ios-test-1791480040404.xcresult`: prolonged active automation zamanı idle company
  rəqibə uduzub; native pause action sonradan hittable deyil. Digər2testPASS.
- `ios-test-1791480625163.xcresult`: real growth/PIVOT/landscape/savePASS;
  relaunch-da Continue accessibility tap lobby-ni dəyişməyib. Digər2testPASS.
- `screenshots/ipad-1791482144827.xcresult`: ilk iPad drag movement-u başlamayıb,
  PIVOT disabled qalıb. Capture təkrar real drag/started yoxlaması ilə düzəlib;
  final `ipad-1791522942174.xcresult`1/1PASS.
- `ios-test-1791529139923.xcresult`: launch accessibility tap lobby-ni dəyişməyib;
  digər2testPASS. Final launch helper realarenaopen yoxlaması ilə3/3PASS verir.
-2026-10-09 current AppStoreexport `No Accounts`/`No signing certificate` göstərib.
  Əvvəlki071983f3… IPA son source deyil; təhvil onu currentpackage saymır.

Bu cəhdlər final pass kimi istifadə edilmir. Native automation pause hit point-i
time stopped ikən götürür və Continue-nin həqiqətən arena açmasını təsdiqləyir.

Əvvəlki finalized təhvil/test tarixçəsi: [1.2.0](TESTING_1.2.0.md),
[1.1.0](TESTING_1.1.0.md).1.4.0 və köhnə binaries ayrıca saxlanır.

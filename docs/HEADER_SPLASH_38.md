# Header və açılış görünüşü — v38 / native41

Azure-da yayımlanıb: `https://api.anacan.az`, gateway **v38 / `--0000039`**.
Image: `anacanregistry.azurecr.io/test-gateway@sha256:a26e52f6c5ec708553354404580158a131b36ff1d520629b8fb2c91f2fb5ba5b`
(ACR `cb1y`, tag `v38-header-splash-20260926-r5`). Functions12 /Storage9 /SQL31
və Source/generation0 müqaviləsi saxlanır.

## Düzəlişlər

- Orijinal `src/assets/logo.png` saxlanır. Ondan şəffaf kənarlı, düzgün boşluqlu
  `brand-mark.png` hazırlanır: `scripts/prepare-brand-assets.py`.
- HTML bootstrap, React splash və loading eyni96px loqo/wordmark təqdimatından
  istifadə edir. Loqo fırlanmır, böyüyüb-kiçilmir; reduced-motion dəstəyi var.
- React splash ilk açılışda350ms-dir, daxili route yenidən açılarkən təkrarlanmır.
- Native launch React-in ilk çəkilmiş kadrından sonra180ms fade ilə bağlanır.
  `launchAutoHide:false` və müsbət `launchShowDuration` birlikdə saxlanır:
  Capacitor-da müddət0 olarsa launch overlay ümumiyyətlə göstərilmir.
- Alt səhifələrin scroll sahəsi status-bar/safe-area boşluğundan ayrılır.
  Billing-in əlavə safe-top-u təkrarlanmır; header düymələri ən az44px,
  uzun tool başlıqları isə kəsilmədən sətirə keçir.
- Klaviatura açıldıqda alt səhifə visual viewport ölçüsünə uyğunlaşır.

## Native41

İzolə workspace:
`azure-migration/native-preview/native-20260926t051303-30913459/workspace/`.
Xcode: `ios/App/App.xcodeproj`.

Yalnız bu yeni namizəddə launch storyboard, `AnacanLaunchMark` asset-i və Android
`anacan_launch` drawable hazırlanır. Android sabit96dp drawable-ı `CENTER` ilə
göstərir; ekranı dolduracaq şəkildə böyütmür. Hazırlayan skript:
`azure-migration/ops/prepare-header38-native.mjs`.

Source-first və RevenueCat/AdMob müqavilələri saxlanır. Source prerequisite-ləri
[SUPABASE_FOLLOWUP_37.md](SUPABASE_FOLLOWUP_37.md)-dədir; yeni SQL tələb olunmur.
Store39 və development40 ayrıca saxlanır. Fiziki native launch/capture qəbulu
cihaz üzərində aparılmalıdır; brauzer və paket yoxlamaları bunun əvəzi deyil.

## Yoxlamalar

-81 əlaqəli app testi və app TypeScript yoxlaması keçir.
- JavaScript söndürülmüş halda bootstrap:320×640,390×844,844×390 ölçülərində
  loqo96×96, horizontal mərkəzdə və düzgün decoded.
-6 header ekranı,320/390/768px və47px simulated safe-area; bütün21 dilin local və
  deployed header geometriyası keçir. Fokuslanmış input ilə420px visual-viewport,
  RTL və səhifə dəyişmələri də yoxlanıb.
- Əvvəlki Premium/blog/Mommy/keyboard axınlarının AZ browser regressiyası keçir.

Ops: `verify-startup38.mjs`, `verify-followup36-web.mjs --header38 --headers-only`,
`header38-tests.log`, `header38-all-languages.log`, `header38-deployed.log`.
Son native nəticə run-dakı `build-ios.json`, `build-android.json` və
`header38-native-build.json` ilə təsdiqlənir; ilkin Xcode sistem kitabxanası problemi
və Android signature alətinin uğursuz cəhdi loglarda ayrıca saxlanır.

## Yekun native paketləri

Hər iki platformanın build, imza və paket yoxlaması keçib. Hərəsində496 JS/CSS asset,
57 onboarding artwork və yeni startup loqosunun hash-i təsdiqlənib. iOS launch
storyboard ayrıca `ibtool` ilə də sıfır xəta/xəbərdarlıqla kompilyasiya olunub.
Paketlər `native-20260926t051303-30913459/artifacts/` qovluğundadır:

| Fayl | Bayt | SHA-256 |
|---|---:|---|
| `anacan-source-first-41.0-development.ipa` | 50071137 | `c5c817b5d0030c8cc68c1ff760ad43d6033ffd16dcecbec328ac22276ce59f01` |
| `anacan-source-first-41.0.apk` | 61939358 | `cf00635b238eadca9c5fc29d0363c17e74ddf3568bb3cb53576437ae081ab41b` |
| `anacan-source-first-41.0.aab` | 60682250 | `a04757bc5075e09700877d37aaba958e6d7e432ba224ef8696f25734a0198ac1` |

iOS development arxivi: `AnacanSourceFirst-41.0.xcarchive`. Store upload edilməyib.
Son fiziki readiness yoxlaması `ios-device-test-1790414961901.json`:
`IOS_TEST_DEVICE_NOT_CONNECTED`. Native launch/capture cihaz qəbulu açıqdır.
Store39/development39/40 qorunan orijinal fayllar üçün `changed:[]` təsdiqlənib.

Veb sübutlarının toplu faylı: `azure-migration/ops/header38-release.json`.
Yekun handoff pointer-i: `azure-migration/handoffs/LATEST.json` /`VERIFIED.json`.

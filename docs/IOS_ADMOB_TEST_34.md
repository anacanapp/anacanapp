# iOS 34.0 — real AdMob ID və kvota düzəlişi

## Cihaz nəticəsi — 2026-09-21

**34.0 development paketi USB ilə qoşulmuş iPhone-a quraşdırılıb və açılıb.**
İstifadəçi son sınaqda **“Giriş və reklam işləyir”** nəticəsini təsdiqləyib:
girişdə kvota xətası yoxdur, əsas ekranda banner görünür.

- Run: `native-20260921t093354-24682b2a`.
- App/Bundle ID: `com.atlasoon.anacan`; team `8B6976J8H7`.
- WebView: `app.anacan.az`, bundled assets; source-first / refresh-before-use-v1.
- Canlı native admission: **source / generation 0**. Auth və tətbiq datası Source-dadır;
  AdMob konfiqurasiyası vahid Azure public control endpoint-indən oxunur.
- Real iOS App ID: `ca-app-pub-2615305918015147~8076918608`.
- Server reklam konfiqurasiyası: revision **59**, `live`, enabled, 13 aktiv iOS yerinin
  real ID-ləri doldurulub. Build input revision 58-dəki App ID eynidir.
- UMP mesajı ilk sınaqda yaradılmamışdı. İstifadəçi sonradan Anacan iOS üçün
  **Published** statusunu təsdiqləyib. 34.0-dakı uğurlu banner sınağı bundan sonradır.

Bu, **giriş + banner cihaz qəbuludur**. Bütün giriş provider-lərinin ayrıca native
qəbulu, interstitial/rewarded/native-story cihaz matrisi, gəlir hesabatı və store
publication nəticəsi kimi təqdim edilmir.

## Artefaktlar

- [Development IPA](../azure-migration/native-preview/native-20260921t093354-24682b2a/artifacts/anacan-source-first-34.0-development.ipa)
- [Xcode project](../azure-migration/native-preview/native-20260921t093354-24682b2a/workspace/ios/App/App.xcodeproj)
- Ölçü: **20,089,706 byte**.
- IPA SHA-256: `e6a0a5dfed1426b0ab1425e1b51d984292ac323c4c8f43483f522674b2d11853`.
- Development app/widget profilləri test cihazını əhatə edir; son tarix
  **2027-08-20**. Development push entitlement-i yalnız isolated test nüsxəsindədir.
- Bu IPA cihaz testi üçündür. Store upload ayrıca production-entitlement
  `--ios-store` workspace-i və distribution signing tələb edir.

Cari store tarixçəsi və qorunan 31.0 layihəsi: [IOS_RELEASE_31.md](IOS_RELEASE_31.md).
Yeni test paketi həmin workspace və yayımlanmış artefaktların üstünə yazılmayıb.

## Kvota probleminin düzəlişi

İstifadəçi 33.0-da hər üç giriş üsulunda **“The quota has been exceeded”** bildirdi.
Real Supabase Auth SDK ilə uğurlu server cavabından sonra raw localStorage yazısının
eyni `QuotaExceededError` yaratması təkrarlandı.

- `src/lib/local-storage.ts`: yalnız tərcümə və serverdən yenidən alına bilən offline
  keşlərdən yer açılır; kritik auth/pin yazısı təkrar edilir.
- Sessiyalar, digər realm token-ləri, admission/adoption pin-ləri, logout marker-ləri,
  saxlanmamış draftlar, səbət, taymer, health seçimləri və oyun datası eviction siyahısına daxil deyil.
- Optional keşlər üçün ümumi **2 MiB** limit və ümumi Web Storage-də headroom var.
- Kritik yazı yenə mümkün deyilsə xəta gizlədilmir. Yalnız non-authoritative Zustand
  UI snapshot-ı yaddaşa yazıla bilmədikdə auth callback-ini dayandırmır.
- Broker-in origin/namespace qaydası, Source-first seçimi və native backup/adoption
  müqaviləsi saxlanılıb. Heç bir app-container/session məzmunu oxunmayıb.

## Yoxlama sübutları

- **152 test**, 9 fayl: raw-quota reproducer, password/Google/Apple SDK grants,
  refresh/restart/logout, protected data, cache budget, UI callback, native session/
  adoption və subscription reqressiyası. İlk test-run-da Node/jsdom BroadcastChannel
  uyğunsuzluğu düzəldilib; yekun run unhandled error olmadan keçib.
- Hər iki TypeScript layihəsi keçib.
- Real yığılmış native web bundle-də **13 ssenari**, o cümlədən browser localStorage-ni
  real kvotaya qədər doldurub source auth/refresh və saxlanmamış draftı qoruma testi keçib.
  Bu şəbəkəsi mock edilmiş bundle sınağıdır, yeni production session cutover deyil.
- **338 embedded asset**, 7 native class/bridge marker-i, real App ID, arm64, Apple/
  Health/widget capabilities, development imzaları və cihaz provisioning-i yoxlanıb.
- Archive/export/codesign keçib; cihazda 34.0 metadata-sı və launch-dan 5 saniyə
  sonra prosesin işləməsi təsdiqlənib.
- Original native assets və signing hash-lərinin müqayisəsi: `changed: []`.

Əsas fayllar:

- `azure-migration/native-preview/native-20260921t093354-24682b2a/web-ios.json`
- `azure-migration/native-preview/native-20260921t093354-24682b2a/build-ios.json`
- `azure-migration/ops/ios-device-test-1789984797831.json` — avtomatik paket/install/launch;
  `physicalDeliveryVerified:false` həmin avtomatik yoxlamanın sərhədidir.
- `azure-migration/ops/ios-admob-acceptance-20260921.json` — ayrıca istifadəçi təsdiqi.

## Davam

- Tək yenidən açılış: `node azure-migration/ops/verify-ios-device-build.mjs native-20260921t093354-24682b2a --launch`.
- Quraşdırma tələb olunarsa eyni əmrdə `--install --launch`; əvvəl signature, App ID,
  profil, cihaz və canlı konfiqurasiya yenidən yoxlanır. App uninstall/data reset edilmir.
- Native hazırlıq aləti Source-first development build üçün əvvəlki reviewed Xcode
  project-i qəbul edir. Build alətinin `--swift-cache RUN_ID` seçimi pinned paketləri
  təkrar yükləmədən istifadə edir; bu Mac-da `ANACAN_LOW_MEMORY_BUILD=1` işlədilib.
- Kvota düzəlişi cari `src/` və 34.0 test paketindədir. Bu native işdə Azure v22 web
  image-i yenidən deploy edilməyib. Final backend admission ayrıca idarə olunur.

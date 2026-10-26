# Söz bağı — iOS 48.0 development cihaz sınağı

**48.0 imzalanmış development paketi iPhone 13 Pro Max-a quraşdırılıb və açılıb.**
Qəbul vaxtı: **2026-10-08 17:39 UTC**. Cihazdakı əvvəlki versiya 47.0 idi.
Paketdə app/widget build 48.0, quraşdırmadan sonra cihazdakı tətbiq versiyası
48.0 olaraq yoxlanıb. Tətbiq prosesi açılışdan beş saniyə sonra işləyirdi.

## Oyuna giriş və sınaq

Tətbiq dili **Azərbaycan dili** → **Alətlər → Mini Oyunlar → Söz bağı**.

1. **Rahat** rejimdə hərfləri barmaqla birləşdirib söz tamamlayın; ayrıca hərflərə
   toxunaraq giriş və pulsuz ilk ipucunu sınayın.
2. Parametrlərdə mənzərəni dəyişin, oyundan geri qayıdıb yenidən açın və
   irəliləyişin saxlanmasını yoxlayın.
3. **Vaxtlı** rejimdə fasiləni və tətbiqi arxa plana keçirib qayıtmağı sınayın.

Quraşdırma/açılış cihaz aləti ilə təsdiqlənib. Fiziki gameplay, toxunuş hissi və
istifadəçinin oyun barədə təsdiqi hələ qeydə alınmayıb.

## Təhvil faylı

Qovluq: **`azure-migration/releases/48.0/`**.

| Fayl | Bayt | SHA-256 |
|---|---:|---|
| `Anacan-48.0-iOS-Development.ipa` |51604262|`e8312afbf70b7fb5c3604e37e1a0e200e534e574e62dda171c7d85b8e987604c`|

İzolə namizəd: `native-20261008t162105-fc36dca2`.

- Arxiv:
  `azure-migration/native-preview/native-20261008t162105-fc36dca2/artifacts/AnacanSourceFirst-48.0.xcarchive`.
- Mənbə layihəsi:
  `azure-migration/native-preview/native-20261008t162105-fc36dca2/workspace/ios/App/App.xcodeproj`.
- Paket development imzası və qeydiyyatlı cihaz profilləri ilədir. App Store47
  təhvili [RELEASE_47_GOOGLE.md](RELEASE_47_GOOGLE.md)-dədir; ümumi Store pointer47
  olaraq qalır, növbəti ümumi native versiya48-dir.

## Build və paket qəbulu

- iOS Release/iPhoneOS/arm64 archive və export exit0, **0 xəta /0 xəbərdarlıq**;
  main app/widget imzası, profil və profil sertifikatı uyğunluğu keçir.
- `com.atlasoon.anacan`, team`8B6976J8H7`, widget
  `com.atlasoon.anacan.AnacanTimerWidgetExt`, App Group`group.com.atlasoon.anacan`
  və WebView hostname`app.anacan.az` təsdiqlənib.
- Development push, HealthKit, Apple Sign-In və widget/App Group entitlement-ləri
  saxlanıb; iki development profil2027-08-20-dək qüvvədədir.
- **17 bundled routing case**, **517 JS/CSS asset** hash-i,21 tətbiq dili,
  Söz bağı lazy chunk və ES module worker bundle-i keçir. Oyun Azərbaycan-only,
  library revision`az-202610-v1`-dir; library SHA256:
  `acdab0987fb4dde5bf009746a69ba55fd465cc5f560cb0fdfb871508bf57d4ac`.
- Customer.io224149:93570 rəsmi native SDK/bridge qəbulu keçir; SDK açarı
  JavaScript-də yoxdur. Live AdMob revision61/13 iOS placement və compiled App ID
  uyğunluğu yoxlanıb; real reklam göstərilməsi ayrıca fiziki sınaqdır.
- Google active canonical`https://api.anacan.az` və offline managed default,
  admission`azure`/generation2,`refresh-before-use-v1`, logout tombstone və
  one-way adoption müqaviləsi saxlanır.
- 47-nin dörd təhvil paketinin SHA-ları yenidən yoxlanıb. Original assets/signing
  qəbulu keçir; Source sealed3/cron0 və tamamlanmış Google authority qorunur.
- Cihaz aləti mövcud tətbiqin üzərinə quraşdırıb; istifadəçi konteyneri oxunmayıb
  və tətbiq silinməyib. Local-network bağlantısı ilə install/launch qəbulu keçir.

## Qəbul qeydləri və davam

- Yekun cihaz təhvili: `azure-migration/ops/word-garden-ios-test.json`.
- Fiziki install/launch:
  `azure-migration/ops/ios-device-test-1791481184645.json`.
- Customer.io paketi: `azure-migration/ops/customerio-ios-package-48.json`.
- Namizəd daxilində `preparation.json`, `web-ios.json`, `build-ios.json` və
  `device-test-completion.json`; təhvil qovluğunda`manifest.json`/`SHA256SUMS.txt`.
- Oyun kodu və lokal20test/4806səviyyə/browser qəbulu:
  [WORD_GARDEN.md](WORD_GARDEN.md),`scripts/word-garden/acceptance.json`.

Bu48 development paketi və workspace final cihaz sınaq artefaktı kimi saxlanır.
Yeni düzəlişlər ayrıca izolə namizəddə edilir. İstifadəçi gameplay nəticəsi bu
quraşdırma qəbuluna ayrıca addendum-dur; Store48 production build/publication
və canlı web yayımı ayrıca buraxılış addımlarıdır.

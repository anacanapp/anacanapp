# startup.io 1.1.0 — arxiv test qəbulu

Tarix: **2026-10-06**. Native build **2**, `com.atlasoon.startupio`.

## Keçən yoxlamalar

| Yoxlama | Nəticə |
| --- | --- |
| Simulyasiya və lokal kampaniya/marketplace | **30/30** |
| iPhone WebKit + Android Chromium | **16/16** |
| TypeScript + production web build | **PASS** |
| iOS simulator native UI | **3/3**, iPhone 17 Pro / iOS 26.2 |
| iPhoneOS arm64 development build və imza | **PASS** |
| 1.1.0-ın iPhone J-a quraşdırılması və açılması | **PASS**, iPhone 13 Pro Max / iOS 26.6.2 |
| Android debug APK, SDK 36 | **PASS** |

Brauzer sınaqları tam ekran joystick, ikinci barmaqla BOOST, fasilə,
arxa plan, real yatırım toplama, OpenAI tərəfindən udulma, qalibiyyət/səviyyə
açılması, xal toplama, ikiqat alışın qarşısı, kifayətsiz balans, öz logo
şəklinin decode/saxlanması və 320–844px portret/üfüqi layout-u yoxlayır.

Native simulator sınaqları:

1. Ortadan sürükləmə ilə real böyümə, fasilə, resume, üfüqi arena, menyuya qayıtma.
2. Lotus AI alışı (**250 → 70 xal**), kolleksiyada seçilmiş logo və relaunch sonrası saxlanma.
3. EN ayarının relaunch sonrası saxlanması, Home düyməsi ilə arxa plana keçəndə
   fasilə və sonrakı real resume.

Native UI testin lokal kampaniyası ayrıca `startup.io.ui-test.v1` açarı ilə
izolə edilir; oyunçunun `startup.io.progress.v1` kampaniyası əvəz edilmir.

Əsas qəbul nəticəsi:
`artifacts/ios-test-1791301617623.xcresult`.
`artifacts/ios-test-receipt.json`: passed, failedTests 0, passedTests 3.
Native ekranlar: `artifacts/native-acceptance-v1.1.0/`.
Son brauzer qəbulu: `test-results/.last-run.json` — passed.

## Paket qəbulu

`scripts/package-test-builds.mjs` iOS kimliyi/version/build, native simulator
və brauzer qəbulunu tələb edir; imzanı yoxlayır, IPA/APK yaradır və hər web asset-in
SHA-256 hash-ini dist, simulator app, imzalı iPhone app, Android assets və hər
iki paket arasında müqayisə edir.

Təhvil: `artifacts/delivery-1.1.0/`.

## Fiziki cihaz

- **1.0.0** development tətbiqi iPhone 13 Pro Max-a quraşdırılıb və açılıb:
  `artifacts/ios-device-install.json`, `artifacts/ios-device-launch.json`.
- **1.1.0, build 2** istifadəçinin birbaşa cihaz build göstərişi ilə
  **iPhone J** üçün yenidən yığılıb, imzası və cari JS/CSS hash-ləri yoxlanıb,
  telefona quraşdırılıb və foreground-da açılıb. Quraşdırılmış version/build
  cihazdan təsdiqlənib; ayrıca proses yoxlamasında tətbiq işləyir.
  Build: `artifacts/ios-device-1791302930709.xcresult`.
  Qəbul: `artifacts/iphone-j-1.1.0-direct-build.json`;
  install/launch/app/running sübutları həmin prefix-li JSON fayllarıdır.
  Bu qəbul quraşdırma/açılış üçündür; avtomatik fiziki gameplay sınağı ayrıca qalır.
- Əvvəlki avtomatik fiziki sınaq iOS authentication prompt-unun ləğvi ilə
  dayanıb; fiziki gameplay PASS kimi qeydə alınmır.
- Android fiziki cihaz sınağı keçirilməyib.

1.1.0-ı telefonda sınamaq üçün iPhone-u qoşub aç, Xcode-da
`ios/App/App.xcodeproj` → **App** → iPhone → **Run**.
Apple Development IPA yalnız həmin development profile-ın cihazlarında işləyir.

## Əl ilə yoxlama

- Həm sol, həm sağ əllə ekranın ortasından sürüklə; uzun sürükləmədə
  joystick bazası barmağı izləməlidir.
- İkinci barmaq və BOOST enerji sərf etməli; buraxanda yenidən dolmalıdır.
- GPU kilidi $60K-də açılmalı, Garage $200K-də tamamlanmalıdır.
- Yeni logo/iz/çərçivəni seçib arena aç; görünüş dərhal tətbiq edilməlidir.
- Şəkil logo yüklə, tətbiqi bağla/aç; şəkil və balans qalmalıdır.

## Davam nöqtəsi

Müstəqil oyun `startup-io/` daxilindədir. Son web və hər iki native asset bundle-ı
1.1.0 ilə uyğunlaşdırılıb. Yeni test işlərini eyni oyunun mənbəyində davam etdir;
digər oyun/tətbiqlərin finalized native paketləri bu buraxılışın bazası deyil.

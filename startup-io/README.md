# startup.io

**Sərhədsiz böyü. Dünya və oynayış davam edir.**

Müstəqil iOS/Android **Unlimited** arena oyunu. Oflayn botlara qarşı yatırım
toplayıb texnologiya imperiyanı qur. Level seçimi, böyümə həddi və vaxt limiti yoxdur.
Tətbiq kimliyi: `com.atlasoon.startupio`.

## Oynayış

- Ekranın **istənilən yerinə toxun və sürüklə**. Böyük, sərbəst joystick
  barmağın altında yaranır və uzun sürükləmədə səni izləyir.
- İkinci barmağı ekrana toxundur və ya **BOOST** düyməsini saxla. Enerji yenilənir.
- Yatırım topla; böyüdükcə GPU, ofis, server, data mərkəzi və binaları ud.
- Yaşıl çərçivəli kiçik rəqibləri ud; qırmızı nəhənglərdən qaç.
- Botlar ilk hərəkətdə başlayır. İlk 8 saniyə başlanğıc sipəri var.
- **PIVOT** qısa qaçış sipəri verir; 24 saniyə cooldown-dan sonra yenidən işləyir.
  Böyük rəqibin satınalmasından əvvəl görünən xəbərdarlıq qaçmaq üçün vaxt verir.
- AI, Fintech və Cloud sahələrini seç; Venture fondları, müvəqqəti üstünlüklər,
  bazar fazaları və beş founder missiyası əlavə oyun xalları qazandırır.
- Minixəritə, geniş baxış düyməsi və açılıb-bağlanan liderlər paneli mövcuddur.
- Desktop: WASD/oxlar — hərəkət, Space/Shift — BOOST, Esc — fasilə.

## Limitsiz dünya

Dünya hər istiqamətdə deterministik şəhər blokları ilə yaranır. Yalnız yaxın
ərazi yaddaşda saxlanır: uzaq bloklar boşaldılır, hərəkət etdikcə yeniləri yüklənir.
BigInt koordinat başlanğıcı uzun səyahətdə lokal koordinat dəqiqliyini saxlayır.

- Parklar: ağaclar, skamyalar, fontanlar və oyun meydançaları.
- Startup/texnoloji məhəllələr: ofislər, server/GPU fürsətləri və həyətlər.
- Mərkəz: binalar, dayanacaqlar, küçə işıqları və piyada keçidləri.
- Sahil: su hövzələri, körpücük və bulvar.
- Sakit rənglər, yollar boyu sistemli yatırım sıraları və seyrək binalar.
- Böyüdükcə yeni ərazinin resurs dəyəri və rəqib ölçüləri uyğunlaşır.

Hər 8 saniyədən bir, fasilədə və arxa plana keçəndə **avtomatik saxlanır**.
**Saxla və çıx** şirkəti bitirmir; menyudakı **Davam et** həmin dünyanı bərpa edir.
**Yeni startup** ilə yeni gediş başlayır. Məğlubiyyətdə rekord və xallar qalır.

## Logo və marketplace

48 rəqib şirkət və dörd Venture fondu **orijinal uydurma kimliklərdən** istifadə edir.
Vektor nişanları bundle-a daxildir; oyunçu və rəqiblər birlikdə 49 şirkətdir.
[Kimlik sistemi və save-ID davamlılığı](docs/VENTURE_CITY_IDENTITIES.md).

**Özəlləşdir** bölməsində ad, səkkiz rəng və öz rəngin, hazır logo,
1–3 hərfli monoqram və ya öz şəklin seçilir. PNG/JPG/WebP logo cihazda saxlanır.

Marketplace-də **14 hazır logo, 6 iz və 4 çərçivə** var. Alışlar oyun xalları ilədir:

- Başlanğıc balansı: **250 xal**.
- Yatırım: **+3**, aktiv: **+18**, şirkət satınalması: **+45**.
- Topladığın xallar oynayışda avtomatik banklanır; davam etdikdə təkrar yazılmır.
- Məğlubiyyətdə və yeni startup başladıqda qazandığın xallar saxlanır.
- Əvvəl alınmış əşyanı yenidən seçmək xal çıxmır.

Aktiv dünya, rekordlar, balans və kolleksiya versiyalı lokal yaddaşdadır.
Əvvəlki versiyalardan yenilənəndə alışlar, balans və ad/rəng saxlanır;
köhnə level nailiyyətləri arxivlənir, əvvəlki ən böyük dəyər rekord kimi daşınır.
1.5.0-da rəqiblərin ad/nişanları dəyişir, onların durable ID-ləri və checkpoint
mövqeləri/dəyərləri saxlanır.
AZ/EN interfeys, portret/üfüqi ekran, native titrəyiş və seçilə bilən səs dəstəklənir.

## İşə salmaq

Bu qovluqda:

```sh
npm install
npm run dev
```

Brauzer: **http://localhost:5188**

```sh
npm test
npm run test:e2e
npm run build
```

İlk Playwright quruluşunda `npx playwright install webkit chromium`.

## iOS

Xcode layihəsi: **`ios/App/App.xcodeproj`**, scheme **App**, team **8B6976J8H7**.

```sh
npm run ios
npm run ios:test
npm run ios:device
```

`npm run ios` web bundle-ı yeniləyir və Xcode-u açır. Xcode-da qoşulmuş
iPhone-u seçib **Run** et. `ios:device` imzalı development binary yaradır;
fiziki avtomatik test üçün cihaz açıq və qoşulu olmalıdır.

Simulyator seçimini `STARTUP_IOS_SIMULATOR`, cihaz seçimini
`STARTUP_IOS_DEVICE` dəyişəni ilə vermək olar.

## Android

```sh
npm run android
```

Android Studio-da `android/` layihəsini aç; JDK 21 və Android SDK 36 istifadə et.
Test APK-sı `android/app/build/outputs/apk/debug/app-debug.apk`-də yaranır.

## Cari buraxılış — Unlimited 1.5.0, build 6

- [iOS development IPA](artifacts/delivery-1.5.0/startup-io-1.5.0-ios-development.ipa)
- [Google Play AAB](artifacts/store-1.5.0/startup-io-1.5.0-play-store.aab)
- [İmzalı Android release APK](artifacts/store-1.5.0/startup-io-1.5.0-android-release.apk)
- [Yoxlamalar, paket hash-ləri və təhvil](docs/STORE_RELEASE_1.5.0.md)
- [Test nəticələri və fiziki cihaz vəziyyəti](docs/TESTING.md)

Final AppStoreIPAexport Xcodeaccount/distributioncertificate bərpasını gözləyir;
currentarchive/devIPA təhvilə daxildir. Store listing/upload/submission/publication
vəziyyəti təhvil receipt-ində göstərilir.
`npm run store:ios` və `npm run store:android` lokal store paketləri yaradır;
`npm run store:screenshots` native iPhone/iPad ekranlarını çəkir.
Android native qəbul üçün `npm run android:acceptance` ayrıca oyun emulatorunu istifadə edir;
macOS defaultAPI35/hostVulkan+guestANGLE-dir;`STARTUP_ANDROID_API=36` ayrıca
API36uyğunluq cihazını seçir. Compile/target SDK36 qalır.

## Əvvəlki test təhvili — Unlimited 1.2.0, build 3

- [iOS development IPA](artifacts/delivery-1.2.0/startup-io-1.2.0-ios-development.ipa)
- [Android debug APK](artifacts/delivery-1.2.0/startup-io-1.2.0-android-debug.apk)
- [Hash və asset-parity qəbulu](artifacts/delivery-1.2.0/delivery-manifest.json)
- [Test nəticələri və fiziki cihaz vəziyyəti](docs/TESTING.md)

## Quruluş

- `src/game/world.ts`: sərhədsiz chunk streaming, BigInt origin, detallar və resurs generasiyası.
- `src/game/`: fixed-step simulyasiya, spatial grid, bot AI, Phaser3.90 izometrik
  2.5D renderer və sakit şəhər artwork-ü.
- `src/components/`: arena, sərbəst joystick, logo, lobby, marketplace/studio.
- `src/persistence.ts`, `src/economy.ts`: dünya checkpoint-i, idempotent kredit bankı və marketplace.
- `ios/`, `android/`: ayrıca native layihələr.
- `artifacts/`: lokal paketlər, nəticələr və ekran şəkilləri; Git-də yoxdur.

`src/game/fictional-brands.ts` orijinal ad/nişan roster-inin mənbəyidir.
`npm run assets:brands` unikallığı yoxlayır və nişan contact sheet-i yaradır.

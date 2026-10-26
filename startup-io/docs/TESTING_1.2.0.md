# startup.io Unlimited 1.2.0 — test qəbulu

Bu sənəd əvvəlki1.2.0 təhvilinin tarixçəsidir. Cari qəbul [TESTING.md](TESTING.md)-dədir.

Tarix: **2026-10-06**. Native build **3**, `com.atlasoon.startupio`.

| Yoxlama | Nəticə |
| --- | --- |
| Limitsiz simulyasiya, streaming dünya, yaddaş/marketplace | **38/38** |
| iPhone WebKit + Android Chromium | **20/20** |
| TypeScript + production web build | **PASS** |
| Native iOS simulator UI | **3/3**, iPhone 17 Pro / iOS 26.2 |
| İmzalı iPhoneOS arm64 build | **PASS**, 0 xəta / 0 xəbərdarlıq |
| iPhone J-a 1.2.0 quraşdırılması və açılması | **PASS**, iPhone 13 Pro Max |
| Android debug APK / SDK 36 | **PASS** |

## Limitsiz dünya qəbulu

- Köhnə bütün böyümə hədlərindən, o cümlədən 180000, 10⁹ və 10¹⁵ mass-dan sonra
  şirkət böyüməyə və oynayışa davam edir; vaxt limiti yoxdur.
- Müsbət/mənfi istiqamətlərə səyahət yeni chunk-lar yaradır. Aktiv working set
  maksimum81 chunk, durable recent state maksimum192 qeyd ilə bounded-dir;
  bunlar dünya sərhədi deyil, yalnız cache həcmidir.
- Yenidən ziyarət olunan blokların layout-u deterministikdir. Resurs consume
  cooldown-u unload/reload və checkpoint sonrası saxlanır.
- BigInt origin Number.MAX_SAFE_INTEGER-dən kənar səyahət ünvanlarını dəstəkləyir;
  local-origin rebase eyni resource ID/layout-u saxlayır.
- Böyük şirkətlərə uyğun resurs dəyərləri və detal miqyası generasiya olunur.
- Gedişatın bərpası elapsed/mass/origin/bot/consume vəziyyətini saxlayır.

## Mobil brauzer qəbulu

20 sınaq ad/rəng/logo, öz şəkil decode-u, sərbəst joystick, ikinci barmaqla BOOST,
fasilə/arxa plan, real yatırımla böyümə, şirkət udulması, limitsiz cap keçidi,
davam etmə, marketplace balansı/ikiqat alış, distant exploration, checkpoint
credit-in təkrar yazılmaması və320–844px portret/üfüqi layout-u yoxlayır.

Son receipt: `test-results/.last-run.json` — passed.

## Native iOS qəbulu

Əsas nəticə: **`artifacts/ios-test-1791306587364.xcresult`**, passed3, failed0.
`artifacts/native-acceptance-v1.2.0/` native ekran attachment-lərini saxlayır.

1. Real orta-ekran sürükləməsi ilə yatırım toplama, pause/resume, üfüqi rejim,
   **Saxla və çıx**, relaunch sonrası **Davam et** və eyni şirkətin bərpası.
2. Lotus AI alışı (**250 → 70**), kolleksiyada görünməsi və relaunch sonrası saxlanma.
3. EN ayarının saxlanması, Home düyməsi ilə arxa plan fasiləsi və real resume.

Native test öz `startup.io.ui-test.v1` storage açarını istifadə edir. Oyunçunun
kampaniyası ayrıca saxlanır. İlk cəhdin son test cleanup-ında runner SIGTERM
dayanması vardı; cari tamamlanmış run3/3PASS-dır.

## Fiziki cihaz qəbulu

**iPhone J** üçün build `artifacts/ios-device-1791305617685.xcresult`-dədir.
1.2.0 build3 telefona quraşdırılıb, foreground-da açılıb; cihazın installed-app
və running-process sorğularından təsdiq alınıb.

- `artifacts/iphone-j-1.2.0-install.json`
- `artifacts/iphone-j-1.2.0-launch.json`
- `artifacts/iphone-j-1.2.0-app.json`
- `artifacts/iphone-j-1.2.0-running.json`
- `artifacts/iphone-j-1.2.0-direct-build.json` — 35 asset/signature/device binding qəbulu.

Bu sübutlar fiziki install/launch-a aiddir; avtomatik fiziki gameplay sınağı
bu buraxılışda keçirilməyib. Android fiziki cihaz sınağı da keçirilməyib.

## Paket qəbulu

`npm run package:test` iOS kimliyi/version/build, imzanı,3native/20browser
qəbulunu və hər35web asset-in SHA-256 hash-ini dist, simulator app, imzalı
iPhone app, Android assets, IPA və APK arasında yoxlayır.

Təhvil: **`artifacts/delivery-1.2.0/`**. Əvvəlki1.1.0 paketləri ayrıca qalır.

## Davam nöqtəsi

Oyunun cari rejimi yalnız **Unlimited**-dir. `src/game/levels.ts` çıxarılıb.
Kampaniya schema-v3 əvvəlki wallet, kolleksiya, ad/rəng və nailiyyət arxivini
qoruyur. Aktiv dünya8s/pause/background checkpoint ilə banklanır; repeated
checkpoint/result reward-ları təkrar hesablamır.

Əvvəlki buraxılış test tarixçəsi: [1.1.0](TESTING_1.1.0.md).

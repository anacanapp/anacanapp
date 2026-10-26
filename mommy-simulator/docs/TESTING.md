# Mommy Simulator — qəbul və cihaz testi

## METRO Simulator — ayrıca oyun, 1.1.0/build2, 2026-10-05

`metro-simulator/` daxilindəki Godot3D TAP oyunu **iPhone13 Pro Max-a faktiki
quraşdırılıb və normal foreground-da açılıb**. Identity
`com.atlasoon.metrosimulator`; native Metal build0 xəta/0 xəbərdarlıq,
simulation281 PASS, mobile browser4 PASS və fiziki native309-check acceptance
0 failure. SignedPCK parity təsdiqlənib.

Yekun receipt: `metro-simulator/artifacts/DELIVERY.json`.
Dəqiq ssenarilər, paket və frame-interval ölçməsi:
[METRO qəbul sənədi](../metro-simulator/docs/TESTING.md).

## Realistik 3D mərhələ — 0.3.1/build5, 2026-10-05

| Yoxlama | Nəticə |
|---|---|
| Native logic/physics/direct-input self-test | **124 PASS** |
| Native browser: hərəkət/qapı/3D pointer/cancel/layout | **7 PASS,0 page/script error** |
| Xcode arm64 və Apple Development signature | **PASS,0 error,0 warning** |
| iPhone13 Pro Max-da quraşdırma və normal foreground launch | **PASS** |
| Fiziki iPhone-da3D self-test | **124 PASS,0 failure** |
| SignedPCK/source packed-world SHA-256 uyğunluğu | PASS |
| TS simulyasiya və production build | 24 PASS / build PASS |
| Mobil Playwright17 | PASS; host timeout-dan sonra qalan3 ayrıca keçir |

Fiziki report `artifacts/native-world-physical-build5/native-world-acceptance.json`,
yekun build/install/launch/hash receipt
`artifacts/native-world-ios-build5-device-acceptance.json`-dır. Sınaq72.907s.
Ev/market/göl3s frame-interval ölçməsi97.7/119.5/118.7 interval/s;
p95 11.123/9.586/9.736ms. Uzun thermal performance profile icra olunmayıb.
Mənbə/rebuild/davam qaydası: [REALISM_031.md](REALISM_031.md).

## Native 3D dünya — 0.3.0/build4, 2026-10-05

| Yoxlama | Nəticə |
|---|---|
| Godot4.7.2 native simulation/physics/3D sequence | **108 yoxlama PASS** |
| WebGL native-preview browser sınağı | **4 yoxlama PASS,0 page/script error** |
| Xcode arm64 / Apple Development imzası | **PASS,0 error,0 warning** |
| iPhone13 Pro Max-a faktiki quraşdırma | PASS |
| Fiziki iPhone-da108-check Godot acceptance | **108 PASS,0 failure** |
| Son normal foreground launch | **PASS** |
| İmzalı `.app` daxilində nativePCK hash uyğunluğu | PASS |
| Ev/market/göl — hərəsinə3s stationary ölçmə | **60 FPS** |

Fiziki acceptance müddəti34.747s; nəticələr:
`artifacts/native-world-physical-complete/native-world-acceptance.json`.
Yekun signed-build/install/launch/packed-world receipt-i:
`artifacts/native-world-ios-device-acceptance.json`.

Kamera collision, fiziki hərəkət/qapı, pickup/drop, ocaq istiliyi ilə3D yemək,
paltar yükü və14-fəsil reducer progression bu sınaqdadır. p95 frame interval:
ev16.858ms, market16.873ms, göl17.124ms. Uzun thermal sessiya profili icra olunmayıb.

Native oyun mənbəyi və rebuild qaydası: [NATIVE_3D.md](NATIVE_3D.md).
Qısa native acceptance son PUBG/COD vizual keyfiyyətinin qəbulu kimi qeyd edilmir.
Əvvəlki build3 və build2 nəticələri aşağıda tarixçə kimi qalır.

## Cari Luzern mənbəsinin web qəbulu — 2026-10-05

| Yoxlama | Nəticə |
|---|---|
| `npm test` — story/navigation/save/CHF/pantry/laundry/day/family | **24 test PASS** |
| `npm run build` — TypeScript + production Vite | **PASS** |
| `npm run test:e2e` — mobil Chrome, touch/iPhone430×932 | **17 ssenari PASS,0 failure** |
| Altı canlı otaq; əşyaya raycast toxunuşu; orbit və iki barmaqla zoom | PASS |
| Ayrı real-time market/kafe/klinika/göl məkanları | PASS |
| CHF alış-veriş → görünən ehtiyat → yemək sərfi → relaunch | PASS |
| Boş pantry, az pul və dolu rəf üzrə UI/reducer guard-ları | PASS |
| Qismən3-paltar yükü: çeşidləmə/proqram/yuma/qurutma/qatlama/save | PASS |
| Təmizlik → yemək → göl gəzintisi → dəstək → hədiyyə → sabah | PASS |
| Canlı3D foto və albomun relaunch-dan sonra bərpası | PASS |
| 320/360/430/768/1280px və932×430 landscape | PASS |
| Cari Luzern mənbəsinin iOS build3 quraşdırılması/açılışı | **PASS — iPhone13 Pro Max** |
| Cari Luzern mənbəsinin fiziki cihazda tam oynanış testi | İcra edilməyib |

Tam17-test receipt-i `artifacts/luzern-life-browser-acceptance.json`-dadır
(`--reporter=list,json`,6.1dəq). Mövcud hamiləlik testi, dörd mərhələli yemək,
ultrasəs/beşik, hər iki doğuş yolu, çanta/rutin, dekor və offline kitabxana da
həmin tam sınaqda keçir. Canlı otaq şəkilləri:
`artifacts/luzern-live-nursery-final.png`, `artifacts/luzern-live-kitchen-final.png`.

## iOS cihazına köçürülmə — 2026-10-05, build3

İstifadəçinin cihazına köçürmə göstərişi ilə cari Luzern dist-i `npx cap sync ios`
ilə native layihəyə daxil edilib. Ayrı `artifacts/ios-luzern-build3` build directory
istifadə olunub: **0.2.0 / CFBundleVersion3**, `com.atlasoon.mommysimulator`,
team `8B6976J8H7`, Apple Development imzası.

| Cihaz yoxlaması | Nəticə |
|---|---|
| Xcode26.2 / arm64 build | **PASS,0 error,0 warning** |
| `codesign --verify --deep --strict` və team entitlements | PASS |
| İmzalı `.app` daxilində85 web/data/art/font faylının dist SHA-256 uyğunluğu | PASS |
| iPhone13 Pro Max / iOS26.6.2 quraşdırılması | **PASS** |
| Normal foreground launch və işləyən proses | **PASS** |
| Cihaz metadata-sında0.2.0/build3 | PASS |

Receipt-lər:
- `artifacts/ios-luzern-build3.xcresult`
- `artifacts/ios-luzern-build3-install.json`
- `artifacts/ios-luzern-build3-launch.json`
- `artifacts/ios-luzern-build3-running.json`
- `artifacts/ios-luzern-build3-device-acceptance.json`

Yoxlama helper-i `node scripts/verify-ios-device.mjs artifacts/ios-luzern-build3`.
Bu qəbul faktiki quraşdırma və açılış üçündür; native tam oynanış XCTest-i ayrıca
icra olunmayıb. Aşağıdakı tarixçə əvvəlki0.2.0/build2 paketlərinə aiddir.

## Təsdiqlənmiş vəziyyət — 2026-10-04

| Yoxlama | Nəticə |
|---|---|
| TypeScript və production web build | PASS |
| Simulyasiya / save / iqtisadiyyat / navigation | 13 test PASS |
| Brauzerdə hamiləlik testi → yemək → növbəti fəsil | PASS |
| Klinikaya yol → prob/depth/focus → üç ultrasəs kadrı → save | PASS |
| Beşik hissələrinin rotasiyası və həqiqi drag-and-drop | PASS |
| Vaginal və keysəriyyə beş səhnəli doğuş → yeni doğulmuş | PASS |
| Doğum çantası, rutin, doğuş planının davamlı seçimləri | PASS |
| Körpə qayğısı, dekor, foto albomu, offline Google kitabxanası | PASS |
| 320/360/430/768/1280px və landscape overlay alignment | PASS |
| Android SDK 36 / JDK 21 Debug APK | PASS |
| iOS arm64 development compile + signature | PASS |
| iPhone 17 Pro iOS 26.2 native XCTest | **2 test PASS, 0 failure** |
| iPhone 13 Pro Max 0.2.0 quraşdırılması | **PASS** |
| 0.2.0 fiziki telefonda son oynanış testi | **Kilid açılmasını gözləyir** |

**Native simulator qəbulu** `artifacts/simulator-v2-02.xcresult` və
`artifacts/simulator-v2-02.log`-dadır. Bu testdə:

1. İzolə hamiləlik hekayəsi, real 3D ev, test və dörd mərhələli yemək oynanılıb.
2. Foto çəkilib, alboma yazılıb və real native relaunch-dan sonra bərpa olunub.
3. Google kataloqu WKWebView-dan canlı GET ilə yenilənib.
4. İzolə keysəriyyə ssenarisi hazırlıq/ritm/ilk qucaqdan yeni doğulmuş fəsilə keçib.

Əvvəlki **0.1.0** real iPhone 13 Pro Max testi keçmişdi
(`artifacts/physical-test-01.xcresult`). Bu əvvəlki qəbul **0.2.0-un fiziki
oynanış sübutu kimi təqdim edilmir**. 0.2.0 fiziki launch/test cəhdi telefonun
kilidi səbəbindən gözləmişdi; `physical-v2-01.log` buna dair qeydi saxlayır.

## Fiziki iPhone-da yenidən yoxlama

Telefonu kabeldə saxla, kilidini aç. Xcode-da `ios/App/App.xcodeproj` və **App**
sxemini seç. Test ssenarisi mövcud user save-i ayrı ehtiyatda saxlayır, öz izolə
fixture-i ilə işləyir və normal launch zamanı orijinal user save-i geri qoyur.

```bash
npm run native:fixtures
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination 'id=00008110-000E41D01190401E' \
  -derivedDataPath artifacts/ios-build-v2 \
  -resultBundlePath artifacts/physical-v2-final.xcresult \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  -parallel-testing-enabled NO test
```

Normal oyunu sonda yenidən açmaq üçün:

```bash
xcrun devicectl device process launch --device \
  7DC5143E-C086-5810-A86D-204E4D68D549 com.atlasoon.mommysimulator
```

İzolə test fixture-ləri yalnız test runner-in resursudur. Normal tətbiqdə
başlamaq üçün gizli debug fəsil düyməsi yoxdur.

## Manual sınaq ardıcıllığı

- Yeni hamiləlik hekayəsi → test, səhər yeməyi, paylaşma, gündəlik.
- Yeni fəsil → görüş, şəhər xəritəsi, klinika, ultrasəs, evə dönüş.
- Fəsilləri missiya ardıcıllığı ilə irəlilət; 34 həftə mərhələsində beşik yığılır.
- Doğuş planını seç; hər iki yolun öz hazırlıq və görüş səhnəsi var.
- 39–40 həftədə dalğa zamanı, dəstək, klinika və beş səhnəli doğuş.
- Yeni doğulmuşda qidalandırma üsulu, bez qayğısı, oturacaq və evə dönüş.
- Foto, albom paylaşımı, oyun save export/import, relaunch.

## Paket statusu

IPA Apple Development imzası, APK Android debug imzasıdır.
`delivery-manifest.json` hər iki **paket daxilindəki** web/kataloq baytlarını
dist snapshot ilə müqayisə edir. Store publication və son fiziki acceptance
bir-birindən ayrı qeyd olunur.

Son təhvil: **0.2.0 / build2**, paketlərdə **66 web/kataloq/font faylı**
dist ilə tam SHA-256 uyğunluğundadır.

- iOS development IPA:2,691,633 bayt,
  `5aa54b6a5a93dbe12e1ca9165456e216f9f871a7d473a15d301e2ff736342fa5`.
- Android debug APK:6,586,985 bayt,
  `667b4895d5657af0278d7fb26b0dd2295e69b3e3cc78ba6451c0280fe4d5ae64`.
- Son fiziki quraşdırma receipt-i `artifacts/ios-v2-final-install.json`-dır;
  installation success var, launch kilidə görə pending qalır.

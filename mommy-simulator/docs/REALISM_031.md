# Realistik dünya və oynanış — 0.3.1 / build 5

2026-10-05 istifadəçi həm görüntünü, həm oynanışı daha realistik etməyi, sonra
cari versiyanı iOS cihazına yükləməyi istədi. Yeni native mənbə `godot/`-dadır.

## Tamamlanmış dəyişikliklər

- Əvvəlki konus dağlar yerinə normal/texture və qar xətti olan procedural Alp
  silsiləsi; yarpaqlı instanced ağaclar, teksturalı sahil qayaları, yığcam dalğalar.
- HDR panorama mühiti, ACES tone mapping, zəifləşdirilmiş divar relief-i, linen
  parça, wood/ceramic/metal səthlər və işıq gücünün oyun saatına uyğunlaşdırılması.
- Mətbəxdə soba, kran, doğrama lövhəsi/bıçaq, qablar/rəflər; yataqda parça
  qatları/yastıqlar; real wicker səbətlər, yuma maşını/qurutma guşəsi; körpə
  otağında mobile/komod/qayğı əşyaları; frame-lər, glazing və hallway runner.
- Quaternius bədənindən rig/UV saxlanaraq yaradılan ayrıca yumşaq jersey/şalvar
  mesh-ləri, cotton normal, ayaqqabılar. Geyim dəriyə rəng vurmaqdan ayrı qatlardır.
- `direct_tasks.gd`: task kamerasında əşyaya həqiqi raycast toxunuşu; ərzaq
  seçimi, doğrama, ocaq istiliyi, süfrə; düzgün paltar rəngi, yuma/qurutma/qatlama;
  tozlu səthdə sürüşdürmə. Məqsəd yerinə yetirilmədən next düyməsi açılmır.
- Task zamanı gəzinti/panel düymələri kilidlənir; cancel orijinal mövqe, kamera,
  idarəetmə və household state-i bərpa edir. Köhnə async timer yeni task-a təsir etmir.
- Daşınan əşya skeletli əl socket-inə bağlanır, qoyularkən fiziki səth tapılır.
  Kamera çox yaxın olanda personaj gizlənir; əyilmədən qalxma baş boşluğunu yoxlayır.
- Həyat yoldaşı collision-aware ev marşrutunda gəzir və məkan keçidində ailə ilə
  birlikdə hərəkət edir. Yeni doğulmuş üçün qucaq pozası/səyahət davranışı var.
- Orijinal sakit footstep/object foley; Manrope font/OFL və public asset provenance.
- Statik səhnə **89 batch** ilə birləşdirilir; yarpaq cards MultiMesh istifadə edir.

## Cihaz və build

- **iPhone 13 Pro Max**, bundle `com.atlasoon.mommysimulator`, team `8B6976J8H7`.
- **0.3.1 / CFBundleVersion5**, Apple Development imzası.
- Xcode: `artifacts/native-world-ios-build5-source/Mommy3D.xcodeproj`, **Mommy3D**.
- Signed app: `artifacts/native-world-ios-build5/Build/Products/Debug-iphoneos/Mommy3D.app`.
- Compile/signature0 error/0 warning. SignedPCK78,353,064 bayt;
  SHA-256 `4851a50b487b39cd3f8076dad896a815e8cbe044fc0ef60f698fdd86ecb2ec29`
  source export-u ilə tam uyğundur.
- Son quraşdırma `native-world-ios-build5-install-final.json`, normal açılış
  `native-world-ios-build5-normal-launch.json` ilə faktiki təsdiqlənib.

## Qəbul

| Yoxlama | Nəticə |
|---|---|
| `npm test` | 24 PASS |
| `npm run build` | PASS |
| Mobil React Playwright | 17 ssenari PASS; host timeout-dan sonra qalan3 ayrıca tamamlanıb |
| `npm run engine:test` | 124 PASS |
| `npm run engine:test:browser` | 7 PASS,0 page/script error |
| Fiziki iPhone native self-test | **124 PASS,0 failure** |
| Fiziki quraşdırma + son normal foreground launch | **PASS** |

Fiziki sınaq72.907s çəkib. Əşyaya toxunma/gesture testləri, wrong-colour guard,
cancel, clothing meshes, navigation/camera, save və14-fəsil simulyasiyası daxildir.
Son3s stationary frame-interval ölçməsi:

| Səhnə | Ortalama interval/s | p95 interval | Draw calls |
|---|---:|---:|---:|
| Ev | 97.7 | 11.123ms | 957 |
| Market | 119.5 | 9.586ms | 614 |
| Gölkənarı | 118.7 | 9.736ms | 98 |

Bu qısa profile uzun thermal/battery sessiya və bütün hərəkətli səhnələrin FPS
qəbulu deyil. Əvvəlki build4 ölçmələri ilə birləşdirilmir.

Yekun receipt: `artifacts/native-world-ios-build5-device-acceptance.json`.
Physical screenshot/report: `artifacts/native-world-physical-build5/`.

## Davam qaydası

- `engine:*` script-ləri ilə `godot/` mənbəsindən davam et. Export helper cari
  build nömrəsi ilə ayrıca `native-world-ios-buildN-source` qovluğu yaradır.
- Cari debug iOS export-u verified `ios-device.zip` template-idir; yalnız arm64
  cihaz slice-i var. Simulator/release üçün uyğun official template ayrıca lazımdır.
- `accept-native-ios.mjs N` və `verify-engine-ios.mjs N` artıq candidate-bound
  receipt/report istifadə edir. Mövcud native oyun state-i acceptance zamanı
  persist=false ilə qorunur və sonda normal launch edilir.
- Disk sıxlığında yalnız game's own generated IDE caches və checksum-la təsdiqlənmiş
  təkrarlanan engine kitabxanaları yığcamlaşdırılıb. Build4 və köhnə signed oyun
  tətbiqləri/qəbul receipt-ləri saxlanır.
- Növbəti art xətti: daha təbii üz/saç/gevşək geyim modeli, richer ailə animasiyası,
  terrain LOD/occlusion/baked işıq və uzun fiziki sessiya. Cari görünüş realizm
  istiqamətində təkmilləşdirilmiş native mərhələdir, final AAA art qəbul deyil.

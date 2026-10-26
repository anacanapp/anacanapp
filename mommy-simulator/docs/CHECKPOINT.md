# Davam nöqtəsi — Mommy Simulator / Luzern Life

2026-10-04 istifadəçi ayrıca folder-də Anacan Google məlumatına əsaslanan,
iOS/Android mobil simulator istədi; sonra daha peşəkar Sims üslubu və
hamiləlikdən doğuşa ardıcıl oynanış tələb etdi. Cari oyun bu directory-dədir.

## Son davam — realistik 3D / iOS build5, 2026-10-05

- **0.3.1/build5** iPhone13 Pro Max-a yüklənib, son normal foreground launch
  keçir. Fiziki124 self-test PASS,0 failure. Receipt:
  `artifacts/native-world-ios-build5-device-acceptance.json`.
- Hazır yeni mənbə: detallı interyer, HDR/ACES, təbii terrain/leaf-card ağaclar,
  ayrıca rigged geyim mesh-ləri; `direct_tasks.gd` əşya raycast/gesture oynanışı.
- Cancel/controls/pointer, wrong laundry colour, ocaq istiliyi, əl socket pickup,
  A*/camera və14-fəsil native reducer yoxlanıb. Native browser7, TS24, mobile17,
  build PASS. Qəbul/davam: [REALISM_031.md](REALISM_031.md).
- Xcode `artifacts/native-world-ios-build5-source/Mommy3D.xcodeproj`, **Mommy3D**;
  signed app `artifacts/native-world-ios-build5/Build/Products/Debug-iphoneos/Mommy3D.app`.
- Fiziki profile72.907s; 3s stationary ev97.7/market119.5/göl118.7 interval/s.
  Uzun thermal/battery profile və final AAA art qəbul ayrıca qalır.
- Native test/report helpers cari candidateN-ə bağlıdır; yalnız debug iOS device
  template istifadə olunur. Build4/3 signed tətbiqləri və qəbul tarixçəsi saxlanır.

## Əvvəlki native 3D baza — build4, 2026-10-05

- İstifadəçinin PUBG/COD keyfiyyət hədəfi ilə yeni native oyun mərhələsi `godot/`
  daxilindədir: Godot4.7.2 / iOS Metal Mobile renderer. Müqavilə:
  [NATIVE_3D.md](NATIVE_3D.md).
- Joystick/WASD üçüncü/birinci şəxs, sərbəst hərəkət/sürətli addım/əyilmə/atılma,
  fiziki qapılar, camera sphere-sweep, collision-aware A* və pickup/drop işləyir.
- CC0 Quaternius rig/animation-lar və Poly HavenPBR asset-ləri; bunların public
  provenance/license/hash-i `godot/assets/` daxilindədir.
- Yemək/paltar/qayğı fəaliyyəti world's own3D sequence-də; uyğun14-fəsil TS
  definition-ları `scripts/native-content.ts` ilə native simulyasiyaya gətirilir.
- Native game save ilə world pose/doors/props ayrıdır. Game's own Capacitor
  Preferences migration-i generated Xcode-a `scripts/export-native-world.mjs`
  vasitəsilə əlavə edilir. Physical self-test izolədir və persist=false istifadə edir.
- **0.3.0/build4** iPhone13 Pro Max-da quraşdırılıb,108 native yoxlama PASS və
  normal launch PASS. Ev/market/göl3s ölçməsi60 FPS. Son report:
  `artifacts/native-world-ios-device-acceptance.json`.
- Native Xcode: `artifacts/native-world-ios/Mommy3D.xcodeproj`, **Mommy3D** sxemi.
  Signed app: `artifacts/native-world-ios-build4/Build/Products/Debug-iphoneos/Mommy3D.app`.
- Native browser4, React mobile Playwright17, TS tests24 və build PASS.
- Vizual keyfiyyət hələ prototipdir: terrain/dağ/küçə və bəzən household əşyalar
  placeholder geometriyadır. PUBG/COD final art/uzun device profile növbəti mərhələdir.

## Əvvəlki Luzern WebView mərhələsi — 2026-10-05

- Luzern otaq-perspektivli UI `src/luzern.css`, `LuzernHUD.tsx` və
  `LuzernScene.tsx` üzərindədir. Səhnə görünüşü, canlı 3D və ev planı seçimləri var.
- `src/world/InteriorScene.ts` altı ev otağını, market/kafe/klinika/göl səhnələrini
  ayrıca real-time interyerlə qurur: ağac/parça, rəflər, qablar, işıqlar, paltar
  səbəti, yuma maşını, beşik və oynanış əşyaları.
- `src/game/interior.ts` ailənin görünüşünü, otaqda fəaliyyət yerini, ehtiyat
  detallarını, gün/hava işığını və toxunuş düymələrinin yerləşməsini hesablayır.
  Hamiləlikdə körpə görünmür; doğuşdan sonra qucaq/oturan körpə/yeriyən uşaq var.
- Schema **3**: CHF centime büdcə, ərzaq, təmizlik, çirkli/təmiz/qatlanmış paltar,
  münasibət, günlük işlər. Schema1→2→3 migrasiyası `persistence.ts` ilə işləyir.
- Yemək tərəvəz/süd/çörəkdən bir pay sərf edir; boş ehtiyat market keçidini açır.
  Alış-verişdə qiymət, pul və40-pay rəf limiti birlikdə yoxlanır. Paltar oyunu
  real yükə uyğun çeşidləmə/proqram/yuma/qurutma/qatlama mərhələlərindən keçir.
- Otaq əşyasına həqiqi raycast toxunuşu, əşya düymələri, orbit/pinch, otaq
  dəyişmə və canlı 3D foto/albom save-i mobil brauzerdə qəbul olunub.
- `npm test`: **24 PASS**; `npm run build`: **PASS**;
  `npm run test:e2e`: **17 PASS**,0 failure. Receipt:
  `artifacts/luzern-life-browser-acceptance.json`.
- Cari Luzern mənbəsi **0.2.0/build3** kimi iPhone13 Pro Max-a quraşdırılıb və
  normal foreground launch keçir. Ayrı build: `artifacts/ios-luzern-build3`;
  build0 error/0 warning,85 embedded web faylı dist ilə SHA-256 uyğundur.
  Qəbul: `artifacts/ios-luzern-build3-device-acceptance.json`. Tam fiziki oynanış
  XCTest-i bu mərhələdə icra olunmayıb. Köhnə IPA/APK təhvili0.2.0/build2-dir.

## Ortaq hekayə bazası

- 14 chapter / ordered mission chain `src/game/scenario.ts`.
- State schema3; v1/v2 local/native save migrasiyası `progression.ts` / `persistence.ts`.
- Doğuş chapter8, ilk körpə chapter9; evə dönüş chapter10.
- Missiya addımı yalnız uyğun activity, location və tələb edilən interaktiv
  oyun tamamlandıqdan sonra irəliləyir. Birth öz ayrı reducer guard-ları ilədir.
- Google public snapshot:908 qeyd, SHA
  `02c1cd6a6a9230152a4dd380954b466c69e12e9bee01b8528f107361998c930e`.
- Ana 3D propor­siya/limb joints, həftəlik belly; klinika və ev ayrıca məkan.
- Cari otaq UI `src/luzern.css`, `LuzernHUD.tsx`; `src/simulator.css` və əsas
  layout CSS-si paylaşılmış panellərin baza üslubudur.
- Development app `com.atlasoon.mommysimulator`, team `8B6976J8H7`.

## Əvvəlki qəbul tarixçəsi

-24 simulation/navigation/save/household testi keçir.
- Playwright interaktiv doğrama, temperatur, ultrasəs, beşik drag/rotate,
  iki doğuş yolu, qayğı, dekor, foto, routine və layout sınaqları keçir.
- iOS Simulator native 2/2 qəbul `simulator-v2-02.xcresult`.
- 0.1 real-device qəbul keçir; 0.2 son physical test kilidə görə pending.
- Cari iPhone-da Luzern0.2.0/build3 quraşdırma və açılışı keçir.
  `TESTING.md` son receipt-ləri göstərir.
- 0.2.0/build2 paketləndirməsi66 bundled faylı real IPA/APK daxilindən oxuyaraq həmin dist-lə
  hash müqayisəsi edib. Təhvil paketləri və SHA-lar `delivery-manifest.json`-dadır.

## Davam edərkən

1. Son fizik test varsa nəticəsini oxu; pending-i özbaşına PASS etmə.
2. Native3D işi üçün `godot/` və `engine:*` script-lərindən davam et; export/build
   nömrəsi açıq seçilir. Son normal launch receipt-i `native-world-ios-build5-normal-launch.json`.
3. React/Capacitor tarixçəsində UI-test isolation user save-i normal launch-da
   `AppDelegate.swift` ilə bərpa olunur. Köhnə native asset sync-dən sonra yeni dəyişiklik varsa packages rebuild et.
   Cari build3 `CURRENT_PROJECT_VERSION=3 MARKETING_VERSION=0.2.0` override ilə
   yığılıb; project default-u build2 olduğundan növbəti build nömrəsini açıq seç.
4. Paket script-i immutable SHA və real IPA/APK contents yoxlayır.
   Native3D PCK/install/launch qəbulu `scripts/verify-engine-ios.mjs`-dədir.
5. Parent Anacan `src/`, Source writer/lineage, Google DNS və finalized
   native45/44/43 workspaces bu müstəqil oyunun işi ilə əvəz edilmir.

Bu iş üçün ayrıca backend relation açılmayıb. Cloud account save gələcək
istifadəçi qərarı tələb edən ayrıca feature-dir; CDC/writer contract orada tətbiq edilir.

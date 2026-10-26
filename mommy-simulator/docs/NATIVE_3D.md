# Mommy Simulator — native 3D dünya, 0.3.1 / build 5

## İstifadəçi istiqaməti

2026-10-05 istifadəçi oyunun bütün hərəkət və obyektlərini tam 3D dünyada,
PUBG Mobile / COD Mobile səviyyəsində vizual keyfiyyət hədəfi ilə yaratmağı istədi.
Yeni native oyun mənbəyi `godot/` directory-sindədir. Hazır mərhələ işləyən,
real-time 3D prototipdir; son AAA vizual keyfiyyət hələ əldə edilməyib.

## Hazır native mərhələ

- **0.3.1/build5:** ayrıca skeletli jersey/şalvar geometriyası, ayaqqabılar,
  zənginləşdirilmiş interyer və birbaşa əşya ilə oynanış. Qəbul və mənbə:
  [REALISM_031.md](REALISM_031.md).
- **Godot 4.7.2**, iOS-da Metal Mobile renderer; oyun görüntüsü native mühərrikdədir.
- Eyni dünyada evin otaqları/terrası, məhəllə marketi, kafe, klinika və gölkənarı.
- Üçüncü/birinci şəxs kamera, sol joystick/WASD, sağ sürüşdürmə, sürətli addım,
  əyilmə və fiziki atılma. Capsule toqquşması və kamera sphere-sweep qorunması.
- Qapılar menteşədə açılır, bağlı qapı hərəkəti dayandırır. Yaxın obyekt prompt-u
  məsafə/görünüş xətti ilə seçilir; bağlı divarın arxasındakı əşya seçilmir.
- Taxta oyuncaq/qazan kimi əşyalar götürülür, daşınır və qoyulduğu yer saxlanır.
  Obyektə gediş üçün collision-aware A* yol hesablanır.
- Quaternius CC0 skeletli ana/həyat yoldaşı, uyğun humanoid animation library:
  idle/walk/jog/interact/pickup/sit/talk/kneel. Ayrıca skeletli yumşaq geyim qatları,
  rəng seçimləri, ayaqqabılar və hamiləlik deformasiya shader-i var.
- Poly Haven CC0 teksturalı mebel, albedo/normal/roughness döşəmə/divar/parça/
  ot/səki; yumşaq işıq, kölgələr, reflection probe-lar və animasiyalı göl materialı.
- Yemək/paltar/təmizlik/qayğı kimi fəaliyyətlər dünyanın içində mərhələli
  əşya/animasiya ardıcıllığı ilə işləyir. Yaxın task kamerasında əsl 3D əşyaya
  raycast toxunuşu, doğrama/silmə sürüşdürməsi, ocağın istiliyi və nəfəs ritmi oynanır.
  Görüş/ad/büdcə/ultrasəs kimi seçimlər native HUD panellərindədir.
- Eyni14-fəsilli story definition-ları və908 ictimai Google kataloq sətri native
  data bundle-dədir. CHF/pantry/laundry/needs/mission/birth state renderer-dən ayrıdır.
- Dünya mövqeyi, qapılar və daşınan əşyalar native local save-dədir. Bu game's
  əvvəlki Capacitor Preferences-i export helper-dəki `SaveContinuity.mm` ilə
  `Documents/capacitor-save-v3.json`-a bir dəfə ötürülür; native validator sonra oxuyur.

## Fayllar

| Mənbə | Məqsəd |
|---|---|
| `godot/project.godot` | Native renderer və landscape oyun konfiqurasiyası |
| `godot/scripts/world.gd` | Dünya/HUD/fəaliyyət inteqrasiyası |
| `godot/scripts/world_builder.gd` | Məkan geometriyası, mebel, işıq və household detallar |
| `godot/scripts/player.gd`, `navigator.gd` | Hərəkət, kamera collision və A* |
| `godot/scripts/actor.gd`, `shaders/clothing.gdshader` | Skelet, animasiya və görünüş |
| `godot/scripts/interactable.gd`, `world_sequence.gd` | Qapı, daşınan əşya və 3D fəaliyyət |
| `godot/scripts/life.gd` | Native simulyasiya və validated local save |
| `godot/scripts/hud.gd`, `world_games.gd` | Native interfeys və seçimli oyunlar |
| `godot/assets/*/provenance.json` | Model/texture mənbə, license və SHA-256 |
| `godot/data/` | İctimai kataloq və TS-dən yaradılmış simulation definition-ları |

Godot export-u `artifacts/native-world-ios-build5-source/Mommy3D.xcodeproj` daxilindədir.
Signed build: `artifacts/native-world-ios-build5/Build/Products/Debug-iphoneos/Mommy3D.app`.
Identity `com.atlasoon.mommysimulator`, team `8B6976J8H7`; **0.3.1/build5**.

## İcra

```bash
npm run engine:setup
npm run engine:content
npm run engine:assets
npm run engine:test
npm run engine:dev
```

İzolə iOS export və build:

```bash
npm run engine:ios
xcodebuild -project artifacts/native-world-ios-build5-source/Mommy3D.xcodeproj \
  -scheme Mommy3D -configuration Debug -destination 'generic/platform=iOS' \
  -derivedDataPath artifacts/native-world-ios-build5 \
  -allowProvisioningUpdates CODE_SIGN_IDENTITY='Apple Development' \
  CURRENT_PROJECT_VERSION=5 MARKETING_VERSION=0.3.1 COMPILER_INDEX_STORE_ENABLE=NO build
```

Yeni dəyişiklikdən sonra yeni build nömrəsi və ayrıca acceptance receipt-i seç.
İki platforma export-unu eyni anda işlətmə: Godot-un müvəqqəti project faylı ortaqdır;
helper `artifacts/engine/export.lock` ilə paralel export-u dayandırır.

Brauzer preview native iOS renderer-dən fərqli WebGL Compatibility istifadə edir:

```bash
npm run engine:web
npm run engine:test:browser
npm run engine:preview
```

Preview: `http://localhost:5178`. Əvvəlki React versiyası `http://localhost:5177`.

## Faktiki qəbul — 2026-10-05

- `npm test`:24 PASS; `npm run build`:PASS; mobil Playwright17 PASS.
- `npm run engine:test`:124 native logic/physics/direct-input yoxlaması PASS.
- Native browser preview:7 yoxlama PASS, script/page error0.
- iPhone13 Pro Max-da native launch ilə124 yoxlama PASS; son normal launch PASS.
- Xcode arm64 compile/signature:0 error/0 warning. NativePCK78,353,064 bayt,
  SHA-256 `4851a50b487b39cd3f8076dad896a815e8cbe044fc0ef60f698fdd86ecb2ec29`;
  imzalı tətbiq daxilindəki PCK ilə tam uyğunluq.
- Ev/market/göl üzrə hərəsində3 saniyəlik stationary-frame ölçməsi:
  ev97.7, market119.5, göl118.7 frame interval/s; p95 müvafiq11.123/9.586/9.736ms.
  Bu qısa stationary ölçmə uzun sessiyanın
  thermal/battery və bütün hərəkətli səhnələrin performance qəbulunu əvəz etmir.

Yekun receipt: `artifacts/native-world-ios-build5-device-acceptance.json`.
Fiziki şəkillər/report: `artifacts/native-world-physical-build5/`.
Əvvəlki build4 qəbulu `docs/TESTING.md`-də tarixçə kimi saxlanır.

## Vizual keyfiyyətin növbəti mərhələsi

Növbəti art işi: üz/saç və geyimin əl ilə modellənməsi, daha zəngin ailə animasiyaları,
terrain/vegetation LOD-ları, baked işıq/occlusion və uzun fiziki sessiya profillənməsi.
Yeni dağ silsiləsi procedural terrain, bitkilər instanced leaf-card, interyer real
teksturalı və qarışıq procedural geometriyadır. Bu native mərhələ final AAA vizual
qəbul kimi qeyd edilmir. Android native Godot package-i bu mərhələdə hazırlanmayıb.

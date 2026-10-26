# Mommy Simulator · Hamiləlikdən Analığa

**0.3.1 — native 3D dünya üçün iOS development mərhələsi.**

Anacan-ın Google kitabxanasından ilham alan, öz 3D personajınla oynadığın
hamiləlik, doğuş və ailə həyatı oyunu. Layihənin bütün kodu və native iş
qovluqları `mommy-simulator/` daxilindədir.

## Yeni native 3D dünya

Godot/Metal ilə tam ekran sərbəst idarə edilən ana personajı: joystick, üçüncü/
birinci şəxs kamera, toqquşmalar, açılan qapılar, daşınan əşyalar və animasiyalı
ev işləri. Ev, market, kafe, klinika və gölkənarı eyni3D dünyadadır.

**0.3.1/build5 iPhone13 Pro Max-da quraşdırılıb və açılıb**;124 native yoxlama
keçir. HDR işıq, əsl parça/geyim qatları, detallı interyer və təbii dağ/göl səhnəsi
əlavə olunub. Qısa stationary ölçmə97–119 interval/s. Cari vizual mərhələ prototipdir;
PUBG/COD səviyyəsində final art keyfiyyəti gələcək inkişaf hədəfidir.
[Native mənbə, qəbul və rebuild](docs/NATIVE_3D.md).

Telefonda sol joystick ilə hərəkət et, sağ tərəfdə sürüşdürərək kameranı çevir.
Əşyaya yaxınlaş və altdakı əməl düyməsinə toxun. Qapını açaraq otaqlara gir;
**Xəritə**, **Günüm**, **Ailə** panelləri yuxarıdadır. **1P / 3P** kamera seçir.

```bash
npm run engine:dev
npm run engine:test
npm run engine:ios
```

Yaxın task kamerasında birbaşa ərzağa/paltara toxun, lövhədə doğramaq və səthi
silmək üçün sürüşdür. Son dəyişiklik və qəbul: [REALISM_031.md](docs/REALISM_031.md).

Native Xcode layihəsi: `artifacts/native-world-ios-build5-source/Mommy3D.xcodeproj` — **Mommy3D**.
Brauzer preview: `npm run engine:web && npm run engine:preview`, port5178.
`src/` və aşağıdakı0.2.0 funksiyaları əvvəlki React/Capacitor bazasıdır.

## Oyunda nə var?

- **14 ardıcıl fəsil:** hamiləlik testindən, ilk ultrasəsdən və trimestrlərdən
  körpə otağına, doğuşa, ilk qucağa, evə qayıdışa və ilk yaşa qədər.
- Həftəyə görə böyüyən qarın; fərdiləşdirilən 3D ana; həyat yoldaşı, klinika
  həkimi; yeni doğulmuş, oturan körpə və yeriyən uşaq görünüşü.
- 3D ev, bağ və ailə klinikası; maneələri nəzərə alan hərəkət, yaxın kamera,
  gündüz/axşam işığı, animasiyalı personajlar və interaktiv əşyalar.
- Hər fəslin çoxaddımlı missiyası. Səhnələri sıra ilə oyna, ailə ehtiyaclarını
  bərpa et, missiya mükafatını al, yeni fəsilə keç.
- **15 mini-oyun növü və ayrıca doğuş səhnəsi:** test; görüş planlaması; probla ultrasəs;
  nəfəs ritmi; doğrama/ocaq/süfrə; beşik yığma; çanta yerləşdirmə; ad seçimi;
  doğuş planı; dalğa zamanlayıcısı; körpə qayğısı; avtomobil oturacağı;
  günlük rutin; layla; oyuncaq cütləri. Doğuş ayrıca beş mərhələli 3D səhnədir.
- Vaginal doğuş və planlı keysəriyyə ssenariləri; seçimlər oyun save-ində qalır.
- Ev dekorasiyası, geyim/saç/personaj seçimləri, bacarıqlar, ailə dialoqları,
  foto rejimi və paylaşıla bilən xatirə albomu.
- **908 ictimai Google qeydindən** offline kitabxana: 294 hamiləlik günü,
  229 resept, 338 ad, 31 çanta elementi, 10 inkişaf mərhələsi, 6 həftəlik qeyd.
- Azərbaycan, ingilis və türk UI. Kataloq mətnlərində mövcud tərcümələr oxunur.
- **Luzern Life:** altı detallı canlı3D ev otağı, ayrıca market/kafe/klinika/göl,
  CHF büdcəsi, görünən ərzaq/paltar/təmizlik vəziyyəti və günlük ailə planı.
- Paltar üçün çeşidləmə, proqram, yuma, qurutma və qatlama; yeməkdə ehtiyat
  sərfi; marketdə qiymət/pul/rəf limiti. Orbit/pinch və canlı3D xatirə fotosu.
- Cihazda avtomatik save və ehtiyat nüsxə. Köhnə save-lər schema3-ə uyğunlaşdırılır.

Cari mənbənin yoxlaması: **24 unit/simulyasiya testi,17 mobil Playwright ssenarisi,
production build PASS**. Davam nöqtəsi: [docs/CHECKPOINT.md](docs/CHECKPOINT.md).

## Əvvəlki0.2.0 versiyasında başlamaq

1. Telefonda **Mommy Simulator** ikonunu aç.
2. Əvvəlki sınaq hekayən varsa, istəsən **Ayarlar → Yeni hekayə başlat** seç.
3. Personajını yarat və **Hamiləlik** yolundan başla.
4. Ekranın altındakı **Növbəti addım** kartına toxun. Ana səhnənin əşyasına
   gedir; **Səhnəni oyna** ilə interaktiv oyun başlayır.
5. İlk missiya: test → səhər yeməyi → xəbəri paylaş → xatirə dəftəri.
6. Fəsli bitirəndə **Missiyalar → mükafat → Yeni fəsilə keç**.
7. Klinikaya getmək üçün **Şəhər** xəritəsindən məkanı seç.

Kameranı bir barmaqla çevir, iki barmaqla yaxınlaşdır. Xəritə, albom,
kitabxana və ayarlar ayrıca panellərdir. Oyun vaxtı hekayə üçün sürətləndirilir.
Sağdakı kreslo düyməsi **Canlı3D** görünüşünü açır; altdakı otaq düymələri ilə
gəz. **Günlük həyat** panelində ehtiyata, paltarlara və bugünün4 işinə bax.

## Paketlər

`artifacts/` Git-ə daxil edilmir. Hazır fayllar:

- `artifacts/mommy-simulator-0.2.0-ios-development.ipa`
- `artifacts/mommy-simulator-0.2.0-android-debug.apk`
- `artifacts/delivery-manifest.json` — SHA-256, native asset parity, test statusu.
- iOS layihəsi: `ios/App/App.xcodeproj` — **App** sxemi.

Bu paketlər0.2.0/build2 təhvilidir. Cari Luzern mənbəsinin web qəbulu
[docs/TESTING.md](docs/TESTING.md)-də ayrıca qeyd olunub.
**2026-10-05:** yeni Luzern mənbəsi0.2.0/build3 kimi iPhone13 Pro Max-a
quraşdırılıb və açılıb;85 embedded web faylının hash uyğunluğu təsdiqlənib.
Native build qovluğu: `artifacts/ios-luzern-build3`.

iOS identity: `com.atlasoon.mommysimulator`, team `8B6976J8H7`.
Paket development test üçündür. Qurulmuş iPhone-da ikon mövcuddur.
Dəqiq yoxlama və fiziki cihaz statusu: [docs/TESTING.md](docs/TESTING.md).

## İnkişaf

```bash
npm ci
npm run dev
```

Brauzerdə: **http://localhost:5177**.

```bash
npm test
npm run test:e2e
npm run build
npm run native:sync
```

- `npm run ios` — yığ, native sync et, Xcode-da aç.
- `npm run android` — yığ, native sync et, Android Studio-da aç.
- Android üçün JDK 21 / SDK 36 lazımdır.
- `npm run content:sync` — valideyn Anacan layihəsinin mövcud **ictimai anon**
  konfiqurasiyası ilə yalnız whitelist kataloqları Google-dan oxuyur.
- `npm run native:fixtures` — izolə native test ssenarilərini hazırlayır.
- `npm run package:test` — hazırlanmış imzalı native build-lərin həqiqi
  paket baytlarını yoxlayır və test IPA/APK-si hazırlayır.

## Struktur

| Qovluq | Məqsəd |
|---|---|
| `src/game/` | reducer, missiya/story progression, kataloq, save, səs |
| `src/world/` | ev, klinika, 3D personajlar, materiallar, kamera |
| `src/components/` | UI, mini-oyunlar, doğuş təcrübəsi |
| `public/data/` | ictimai Google snapshot və mənbə hash-i |
| `ios/`, `android/` | ayrıca native layihələr |
| `e2e/` | mənalı oynanış qəbulu |
| `docs/` | dizayn, test və davam nöqtəsi |

Google data mənşəyi `https://gcp.anacan.az`, project
`ninth-park-492111-m4`-dir. Anacan şəxsi hesabları bu oyunun məlumatı deyil.
Oyun irəliləyişi bu mərhələdə local save-dədir.

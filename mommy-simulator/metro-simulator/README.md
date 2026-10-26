# METRO Simulator · Bakı

**1.1.0 / build 2 — native Godot 3D mobil TAP oyunu.**

İzdihamı aş, qapılar bağlanmadan vaqona çat, bütün Bakı metro stansiyalarını
keç və qazandığın jetonlarla sərnişinini gücləndir.

## Telefonda oyna

**2026-10-05: iPhone 13 Pro Max-a quraşdırılıb və normal oyun açılıb.**

1. **METRO Simulator** tətbiqini aç və **OYNA** seç.
2. **TAP** düyməsinə ritmik toxun. Ardıcıl toxunuşlar kombo və əlavə güc verir.
3. **SOL / ORTA / SAĞ** ilə boş zolaqdan keç.
4. Sarı vaxt fürsətləri **+1 və +2 saniyə** qazandırır.
5. 60 enerji toplayanda **YOL AÇ** seç: qısa müddət üçün **×2.6 güc**.
6. Stansiyanın üç qapısını tamamla. Final stansiyalarda dörd qapı var.
7. Jetonlarla **AVADANLIQ** mağazasından güc, sürət, əlcək, ayaqqabı, kask,
   saat, gödəkçə, qulaqlıq və bel çantası al.

Güc personajın ölçüsünü də artırır. Geyim/aksesuarlar 3D modeldə görünür.
Kask və qulaqlıq eyni baş slotundadır. İrəliləyiş, avadanlıq və ayarlar cihazda
avtomatik saxlanır; tamamlanmış stansiyaları yenidən oynamaq olar.

## Yeni 3D səhnə və oyun interfeysi

- İnsan ölçülü, PBR mərmər/metal/parça materiallı platforma və vaqon.
- Altı sürüşən qapı qanadı; qapı animasiyası həqiqi raund taymerinə bağlıdır.
- Vaqonun içərisində oturacaqlar, əl tutacaqları, borular və işıqlar.
- Relslər, şpallar, təhlükəsizlik zolağı, taktil nöqtələr, mozaikalar,
  stansiya nişanları, saat, skamyalar, zibil qabları və uzaq pilləkənlər.
- 20 animasiyalı fon sərnişini; ayrıca maneə personajları, çamadanlar,
  sürüşkən döşəmə və izdiham dalğası.
- Skeletə bağlı ayrıca sviter/şalvar geometriyası, ayaqqabılar və avadanlıq.
- Qapıya doğru hərəkət edən personaj və onu izləyən üçüncü şəxs kamera.
- Tam ekran oyun lobbisi, dairəvi TAP, dairəvi vaxt göstəricisi, enerji/
  kombo və qapı irəliləyişi; notch və home-indicator təhlükəsiz sahələri.
- iOS-da **Metal** render, MSAA, dinamik kölgələr və 60 FPS hədəfi.
- Statik detalları birləşdirən mesh batching: ilkin1693 mesh-dən458 render
  mesh-inə; animasiyalar və sürüşən qapılar ayrıca idarə olunur.

## Bakı kampaniyası

**27 ayrı stansiya platforması · 5 marşrut · 37 stansiya mərhələsi · 116 qapı.**

### Həzi Aslanov → Dərnəgül

Həzi Aslanov → Əhmədli → Xalqlar Dostluğu → Neftçilər → Qara Qarayev →
Koroğlu → Ulduz → Nəriman Nərimanov → Gənclik → 28 May → Nizami →
Elmlər Akademiyası → İnşaatçılar → 20 Yanvar → Memar Əcəmi → Nəsimi →
Azadlıq prospekti → Dərnəgül.

### Həzi Aslanov → İçərişəhər

Eyni ilk10 dayanacaqdan sonra: 28 May → Sahil → İçərişəhər.

### Əlavə marşrutlar

- **Bakmil ekspresi:** Nərimanov qolunun Bakmil mərhələsi.
- **Xətai keçidi:** Cəfər Cabbarlı → Şah İsmayıl Xətai.
- **Bənövşəyi:** Xocəsən → Avtovağzal → Memar Əcəmi2 → 8 Noyabr.

Adlar və xətt ardıcıllığı [rəsmi Qırmızı](https://metro.gov.az/az/about-lines/2),
[Yaşıl](https://metro.gov.az/az/about-lines/3) və
[Bənövşəyi](https://metro.gov.az/az/about-lines/5) xətt məlumatlarından yoxlanıb.
Oyun klassik kampaniya marşrutudur; müvəqqəti tikinti/hərəkət cədvəli modelləşdirilmir.

## İşə salmaq

Bu əmrləri əhatə edən `mommy-simulator/` directory-sində icra et:

```bash
npm run metro:dev
npm run metro:test
npm run metro:build
npm run metro:preview
npm run metro:test:e2e
```

Brauzer preview: **http://localhost:5179**. Godot editor-də
`metro-simulator/project.godot` açılır. Mühərrik üçün mövcud
`artifacts/engine/Godot.app` istifadə olunur; alternativ `GODOT_BIN` qəbul edilir.

Assetləri yenidən hazırlamaq:

```bash
npm run metro:assets
npm run metro:assets:3d
```

3D mənbələr: Quaternius CC0 personaj/animasiya, Poly Haven CC0 materiallar,
oyunun öz vaqon/platforma/aksesuar/geyim geometriyası. Manifestlər
`assets/3d-provenance.json` və `assets/characters/GARMENT_PROVENANCE.json`-dadır.
Font lisenziyaları da bundle-dədir.

## iOS mənbə və paket

- **Identity:** `com.atlasoon.metrosimulator` · team `8B6976J8H7`.
- **Xcode:** `artifacts/ios-v2/MetroSimulator.xcodeproj` · **MetroSimulator**.
- **İmzalı tətbiq:** `artifacts/ios-build2/Build/Products/Debug-iphoneos/MetroSimulator.app`.
- **IPA:** `artifacts/metro-simulator-1.1.0-ios-development.ipa`.
- **Yekun receipt:** `artifacts/DELIVERY.json`.

```bash
npm run metro:ios
xcodebuild -project metro-simulator/artifacts/ios-v2/MetroSimulator.xcodeproj \
  -scheme MetroSimulator -configuration Debug -destination 'generic/platform=iOS' \
  -derivedDataPath metro-simulator/artifacts/ios-build2 \
  -allowProvisioningUpdates DEVELOPMENT_TEAM=8B6976J8H7 \
  CODE_SIGN_IDENTITY='Apple Development' CURRENT_PROJECT_VERSION=2 \
  MARKETING_VERSION=1.1.0 build
npm run metro:test:ios
```

Cari iOS debug template-i yoxlanmış `artifacts/engine/templates/ios-device.zip`-dir.
Yeni native dəyişikliklər üçün növbəti build nömrəsi və ayrıca nəticə receipt-i seç.

## Yoxlama

**281 simulyasiya yoxlaması · 4 mobil browser ssenarisi · fiziki iPhone-da
309 yoxlama · native build0 xəta/0 xəbərdarlıq.**

TAP/bonus/iqtisadiyyat/save, bütün116 kampaniya qapısı, real3D hərəkət,
notch sahəsi, ilk3-qapılı stansiya, güc/kask alışı və normal launch yoxlanılıb.
Dəqiq sübutlar: [docs/TESTING.md](docs/TESTING.md).

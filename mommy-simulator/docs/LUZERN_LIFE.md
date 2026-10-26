# Luzern Life — 0.3 vizual / simulyasiya istiqaməti

İstifadəçinin göndərdiyi nümunələrdəki keyfiyyət: real ağac/parça detallarını,
isti günəş işığını, yumşaq sage/cream interyerini və canlı ailə emosiyasını
əsas götürən realist-stilizə 3D ailə həyatı.

## Məkan

Luzern, İsveçrə, gölə yaxın sakit townhouse. Eyni ailənin qonaq otağı,
mətbəxi, yataq otağı, hamamı, körpə otağı və terrası. Şəhər səhnələri:
Kapellbrücke / gölkənarı promenade, yerli ərzaq-bakery, cafe və Anacan klinika.

## Oyunun gündəlik həyatı

- Oyun təqvimi, Europe/Zurich ritmi, dəyişən oyun havası, gün işığı/axşam.
- CHF ailə büdcəsi, evdə ərzaq ehtiyatı, market səbəti, yemək hazırlama.
- Çirkli paltar, yuma/qurutma/qatlama, təmizlik və ailə iş bölgüsü.
- Göl gəzintisi, ailə vaxtı, şəxsi fasilə və ananın öz ehtiyacları.
- Hamiləlik və doğuşun hazır14-fəsilli hekayəsi bu gündəlik həyatla yanaşıdır.
- Otaq perspektivi əsasdır; ümumi 3D ev planı və əşya yerləşdirmə də açılır.
- Hazır səhnə artwork-ları ayrı kinematik 3D renderlərdir. İnteraktiv dünyada
  real-time 3D obyektlər, animasiya, kamera, oyun mexanikası ayrıca işləyir.

## Vizual təməl

Əl ilə qurulan Three.js interyer + Google Gemini image modeli ilə yaradılan yüksək
keyfiyyətli ailə/otaq səhnələri. Screenshot/reference-ə uyğun art direction,
oyun daxilində pre-rendered cinematic və realtime room baxışları ayrıdır.
Art yaratmaq üçün mövcud private Google credential-reference istifadə olunur;
paketdə yalnız final şəkillər və public provenance var.

## Tamamlanmış canlı interyer — 2026-10-05

- Qonaq otağı: parça divan/yastıqlar, kitab rəfi, çay qabları, dəftər, təmizlik
  guşəsi. Mətbəx: sage dolablar, ocaq/soba, kran, rəflər, asma lampalar, taburelər.
- Körpə otağı: hazırlanmış beşik və əvvəlki yığılmamış hissələr, mobile, dəyişmə
  komodu, yumşaq kreslo və oyun döşəyi. Yataq: parça örtük, komod, paltar səbəti.
- Hamam: plitələr, vanna/kran, güzgü, yuma maşını və dəsmallar. Terras: göl
  mənzərəsi, bitkilər, məhəccər, fincanlar və taxta döşəmə.
- Market, kafe, klinika və gölkənarı ayrıca real-time məkanlardır.
- Ərzaq miqdarı mətbəxdəki məhsulları; çirkli/qatlanmış paltar səbəti/rəfi;
  təmizlik görünən tozu dəyişir. Gün işığı oyun saatı və havadan gəlir.
- Ailə animasiyası save-dəki doğuş və yaş mərhələsinə uyğundur. Fiziki əşyaya
  toxunma, orbit/pinch və real-time foto işləyir; görünən düymələr üst-üstə düşmür.
- Günlük hədiyyə bütün4 işi tələb edir və gündə bir dəfə alınır. Bitirilmiş
  paltar məqsədi dəyişmir; boş səbətlə başlayan gündə təmizlik məqsədi göstərilir.

Qəbul:24 simulyasiya testi,17 mobil Playwright ssenarisi və production build.
Ətraflı nəticə: [TESTING.md](TESTING.md).

## Məhdudiyyətlər

Oyun personaj görünüşü local seçimdən gəlir; bəzi cinematic kadrlar həmin
ailənin sabit art direction-ını göstərir. Hesablararası save gələcək ayrıca
feature-dir. Bu buraxılış local offline ailə simulyatorudur.

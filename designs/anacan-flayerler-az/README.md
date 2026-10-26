# Anacan — Azərbaycan dilində yeni flayerlər

Altı fərqli kompozisiya: iri başlıqlar, incə rəng keçidləri və abstrakt həndəsi
formalar. İnsan, körpə, maskot və personaj illüstrasiyası istifadə edilməyib.
Brend adı tipoqrafik “anacan” yazısı ilə təqdim olunur.

## Konseptlər

1. **Hər mərhələdə səninlə** — mərcan, çəhrayı və bənövşəyi halqalar.
2. **Həyatın öz ritmi var** — tünd gavalı tonu və ritm dairəsi.
3. **Yeni bir hekayə başlayır** — kağız qatları, adaçayı və günəş tonları.
4. **Böyük sevgi. Kiçik anlar** — səma rəngləri və yumşaq həndəsi formalar.
5. **Qayğı paylaşdıqca böyüyür** — dərin yaşıl fon və birləşən lentlər.
6. **Danışmaq da qayğıdır** — isti sarı fon və söhbət formaları.

## Hazır fayllar

- `goruntule.html` — bütün dizaynları açmaq və ayrı faylları endirmək üçün qalereya.
- `butun-flayerler.png` — ümumi baxış şəkli.
- `png/` — paylaşım üçün 2160 × 2700 ölçülü altı şəkil (4:5).
- `svg/` — 1080 × 1350 ölçülü, mətnləri redaktə edilə bilən vektor mənbələr.
- `cap/` — hər konsept üçün ayrıca A5 PDF və A5 SVG.
- `anacan-flayerler-a5.pdf` — altı səhifəli A5 PDF, 148 × 210 mm.
- `anacan-flayerler-az.zip` — hazır dəstin hamısı.
- `yoxlama.json` — ölçü, mətn sərhədi, şrift simvolları və PDF səhifə yoxlamaları.

SVG fayllarında şriftlər daxil edilib. Şrift dəstəkli brauzerdə görünüş şəbəkəsiz
açılır; redaktə proqramında Noto Sans tələb oluna bilər. Fayllar RGB rəng məkanındadır.

QR kodların hədəfi: **https://api.anacan.az**. Çap PDF-lərində kənar interfeys,
brauzer başlığı və ya naviqasiya yoxdur. Hər səhifə bütöv flayerdir.

## Yenidən hazırlamaq

Repository kökündə:

```sh
node designs/anacan-flayerler-az/render.mjs
```

Mətn və kompozisiyalar `konseptler.mjs` faylındadır. Şəkillər və PDF-lər `hazir/`
qovluğuna yazılır. A5 kompozisiyaları ayrıca hündürlüyə uyğunlaşdırılır.

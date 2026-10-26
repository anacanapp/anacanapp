# Anacan saytı — Google, 21 dil və xarakterli dizayn

**2026-10-08 Markdown düzəlişi:**87canlıməqalə/1 827dilversiyası üçün CommonMark/GFM,
HTML vəqarışıqmətnrenderi, bütünproseelementləri/mobilRTLvəserverHTML qəbulu
tamamlanıb. [Cari renderer vəyayım](WEBSITE_MARKDOWN_20261008.md);receipt
`ops/website-markdown-delivery.json`. Aşağıdakı75məqalə rəqəmləri ilkinyayım tarixçəsidir.

## Canlı sayt

- Əsas sayt: **https://anacan.az/az/**.
- İngilis: **https://anacan.az/en/**. Bütün 21 dil öz `/dil/` başlanğıcını istifadə edir.
- `www.anacan.az` əsas `anacan.az` ünvanına 301 verir.
- İstifadəçi `@` və `www` A qeydlərini **34.49.16.103** ünvanına yönləndirib.
- Google Certificate Manager `anacan-website` sertifikatı və `anacan-public-map`
  xəritəsində hər iki host **ACTIVE** vəziyyətindədir.

Google layihəsi `ninth-park-492111-m4`-dir. Tanıtım saytı artıq Lovable yayımından
asılı deyil. Mövcud Lovable marketing layihəsinə hazırlanmış reviewed handoff
kredit çatışmazlığına görə qəbul edilməyib; onun köhnə publication-u yeni saytın
yayımlandığına dair sübut deyil.

## Son istifadəçi dizayn qərarı

Portrait tipli açıq, yumru kartlı və rahat boşluqlu quruluş saxlanılır. Göyqurşağı
rəngləri çıxarılıb; əsas UI aksenti tətbiqin **#FF5A5F** koral rəngi,
**#FFE7E1** şaftalı səthidir. Hero mətnində yalnız Anacan tonlu gradient var.

Hero və mərhələ kartları tətbiqin hazır xarakterlərini istifadə edir:

- Dövr — **Ritm**.
- Hamiləlik — **Tumurcuq**.
- Analıq — **Qucaq**.

Orijinal onboarding şəkilləri `src/assets/onboarding/` daxilindədir. Sayt üçün
hash-verified nüsxələr `public/website/characters/` daxilində saxlanılır.
Başlanğıc/əsas funksiya təsvirlərində lifestyle foto əvəzinə bu xarakterlərdən
istifadə edilir. Jurnalın məqalə şəkilləri öz mövzuları ilə qalır.

## Daxili səhifələr

Hər bölmə bütün 21 dildə tərcümə olunmuş məzmun və ayrıca slug ilə mövcuddur.
Azərbaycan ünvanları:

| Bölmə | URL |
|---|---|
| Dövr | `/az/dovr-izleme/` |
| Hamiləlik | `/az/hamilelik/` |
| Analıq | `/az/analiq/` |
| Partnyor | `/az/partnyor/` |
| Albomlar və xatirələr | `/az/albomlar-ve-xatireler/` |
| Dr. Anacan | `/az/dr-anacan/` |
| İcma | `/az/anacan-icmasi/` |
| Sağlamlıq qeydləri | `/az/saglamliq-qeydleri/` |

Bu 8 bölmə cəmi **168** daxili səhifədir. Hər səhifədə dörd fayda, üç başlanğıc
addımı, uyğun xarakter, əlaqəli bölmələr, məqalələr və tətbiq keçidi var.
Hero, naviqasiya və funksiya kartları bu səhifələrə birbaşa keçir.

## Məzmun, URL və SEO

- Google-dakı **75** published məqalə bütün 21 dildədir: **1 575** dil versiyası.
- `src/website/article-routes.json` məqalə ID-si, köhnə slug və 21 dilin yeni
  slug xəritəsini saxlayır. Köhnə `blog_posts.slug` dəyişdirilməyib.
- Yeni canonical məqalə ünvanı `/dil/tərcümə-olunmuş-slug/` formasındadır.
- Slug maksimum180 UTF-8 baytdır; Unicode/CJK/Gürcü/Ərəb/Hindi dilləri saxlanır.
- Əvvəlki `/blog/slug`, `/en/blog/slug` və `/blog/dil/slug` ünvanları uyğun
  canonical səhifəyə bir addımlı **301** verir. Query parametrləri saxlanır.
- Bütün **143** əvvəlki sitemap ünvanı canlıda yoxlanılıb.
- Server həqiqi404 verir; başqa dilin mətnini həmin URL-də göstərmir.
- Canonical host `https://anacan.az`-dır. Hər canonical səhifədə qarşılıqlı21
  `hreflang` və `x-default`, lokal başlıq/təsvir və OG/Twitter metadata var.
- `BlogPosting`, `BreadcrumbList`, `Organization`, `WebSite`, görünən sual-cavab
  ilə uyğun `FAQPage` və kalkulyator `WebApplication` schema-ları yaradılır.
- `sitemap-blog.xml`:1 575; `sitemap-pages.xml`:567 canonical URL.
- Build2 163 HTML yaradır:1 575məqalə+567əsas/daxili/pagination+21lokal404.
- Mətnlər JavaScript yüklənməzdən əvvəl tam HTML-dədir.
- Şriftlər və şəkillər self-hosted-dir. Məqalə şəkilləri WebP-yə optimallaşdırılıb.

## Google canlı məlumat oxusu

`anacan-website` ayrıca Node SSR container-idir. Şəxsi application/brand session-u
başlatmadan Google PostgREST-dən published-only anonymous RLS oxusu edir.

- Runtime: `scripts/website/server.mjs`, build edilmiş renderer ilə.
- Metaməlumat və məqalə cache müddəti **60 saniyə**dir.
- Yeni published məqalə, redaktə və silinmə HTML/JSON/sitemap-də avtomatik görünür.
- Yalnız cached HTML nüsxəsini göstərən SPA deyil: server Google-dan məzmunu
  oxuyub HTTP cavabında render edir.
- Operator testi draftın göstərilmədiyini, publish/edit/delete dəyişikliklərinin
  təxminən63–64saniyədə göründüyünü və fixture cleanup-ı təsdiqləyib.
- `public/website/backend.json` yalnız public anonymous frontend açarını saxlayır.
  Consumer JWT, cookie və sağlamlıq tarixi bu oxulara göndərilmir.

75 məqalənin permalink məlumatı mövcud `editorial_metadata.website` JSON sahəsinə
Google-da əlavə edilib. Ayrı data relation və yeni cron yaradılmayıb. Mövcud
`anacan_gcp_writer_guard`, `anacan_gcp_change`, `anacan_gcp_truncate` aktivdir;
qalan content sahələri və migration control eyni qalıb. Əvvəlki Source snapshot
və accepted/pending chain replay edilməyib.

## İşlək alətlər

- Ovulyasiya: son menstruasiya + dövr uzunluğu − luteal faza; fertil pəncərə,
  növbəti menstruasiya, test tarixi, lokal təqvim və `.ics` ixracı.
- Doğuş tarixi: son menstruasiya +280 gün, müntəzəm dövr uzunluğuna uyğun fərq;
  həftə/gün, trimestr və qalan günlər.
- Date-only hesab UTC calendar günləri ilədir; DST və leap-day testləri keçir.
- Gələcək/imkansız tarix, NaN və fraksiyalı uzunluq yoxlanır.
- Kalkulyator tarixləri yalnız brauzerdə emal edilir.
-14hamiləlik əlaməti və trimestr filtri; beş suallı partnyor hazırlıq testi.
- Jurnal axtarış/kateqoriya/mərhələ/pagination; məqalə mündəricatı, paylaşma,
  əlaqəli yazılar və tətbiq module linkləri.
- App Store `6758301924`, Google Play `com.atlasoon.anacan`, QR yükləmə səhifəsi.
- Əlaqə forması hazırlanmış məktubu istifadəçinin e-poçt tətbiqində açır;
  serverə mesaj göndərildiyini iddia etmir.

## Yoxlama və ops receipts

Operator receipt-ləri ignored `azure-migration/website/` daxilindədir:

- `live-html-verification.json`:1 575məqalə/168daxili/143legacy/iki sitemap PASS.
- `browser-anacan.az-*.json`:21 dil üzrə mobil menu/kalkulyator/axtarış/məqalə/dil
  keçidi PASS.
- `final-browser-verification.json`:320/390/768/1024/1440px overflow0, üç xarakter,
  daxili kartlar, partnyor testi, real `.ics` faylı və mağaza keçidləri PASS.
- `live-data-verification.json`:draft exclusion/publish/edit/delete və cleanup PASS.
- `details-verification.json`:168locale detail məzmun/canonical/hreflang PASS.
- `google-slug-install.json`, `runtime-build.json`, `runtime-deployment.json` və
  son gateway/static image receipts.
- Yekun receipt: `azure-migration/ops/website-google-delivery.json`.

## Build və gələcək iş

```bash
npm run build:website
node scripts/website/build-server.mjs
```

Saytın mətni `src/website/copy/` və `src/website/details/` daxilindədir. URL copy-dən
asılı deyil: `src/website/routes.ts`/`detail-routes.json` published müqavilədir.
Mövcud məqalə slug-larını dəyişərkən uyğun durable301 xəritəsi saxlanmalıdır.
Gələcək yeni məqalələrdə `editorial_metadata.website.slugs`-ın sabit permalink kimi
saxlanması title redaktəsindən yaranan URL dəyişmələrinin qarşısını alır.

Gateway dəyişikliklərində canlı current image/konfiqurasiya və CAS predecessor-i
oxuyun: application entry/operator və native routing ayrıca worktree işi ilə
yenilənə bilər. Köhnə pinned gateway-nin bütün konfiqurasiyasını təkrar kopyalamayın.
Public `anacan.az` Google SSR route-u ilə app/api entry route-ları ayrıdır.

Bu sayt yayımı app-build/final population cutover deyil. Source writer və session
authority, delivered45/44/43, native entitlements və api/app DNS handoff-u öz
mövcud müqavilələrinə tabedir. Private operator/signing/session input-ları kod
handoff-a daxil edilmir.

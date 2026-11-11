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

## MilliNet participant badge (2026-11-05)
- Footer bottom row on every language page carries the MilliNet 2026 ownership badge
  (`<script src="https://millinet.az/banner.js?id=755">`), component `MilliNetBadge` in
  `src/website/components.tsx`, styles `.site-footer-badge` in `website.css`.
- The vendor script uses `document.write`, so it is rendered only in the SSR HTML via
  `dangerouslySetInnerHTML` and `suppressHydrationWarning`; client-side renders never execute it.
- Website runtime `website@sha256:7f1a9a8ace8a…` (FROM `cc4610ba…`, rollback
  `website-runtime-plan.before-millinet.json`); gateway `gateway@sha256:ffb5337e8b0a…` (FROM `d1db0162…`,
  website assets and `az/index.html` only, app untouched; rollback `rollback-millinet-web-plan.json`).

## Header "Hesabım" icon and runtime copy rule (2026-11-06)

- The header has a small account icon (`.site-nav-account`) before the download
  button. It opens the web Premium cabinet `/website/premium/hesab/index.html`.
  Copy key `account` exists in all 21 copy files (key count guard is 307).
- Website runtime images built `FROM` the live digest must also
  `COPY src/website/copy/ /app/website/copy/` whenever a copy key is added. The
  SSR renderer reads copy from `/app/website/copy/`; a missing key crashes the
  render and the server answers 503 `Anacan` for every page (healthz stays 200).
  On 2026-11-06 image `078dab2c…` did this; it was rolled back to `7f1a9a8a…`,
  then `fda8ad55…` (with copy files) went live.
- Before swapping, smoke-render every language inside the image build
  (`node /tmp/smoke.mjs` calling `renderWebsite` + `renderWebsiteHtml`) and run a
  canary container on `127.0.0.1:9299` against the same network/env.

## Home page shop block (AZ only, 2026-11-06)

- `src/website/HomeShop.tsx` + `home-shop.css`, mounted on `/az/` after the stage cards: hero slider
  (PDF books, monthly bento cakes, special-day cakes; autoplay 6.5 s, pauses on hover/focus, swipe, reduced
  motion respected), a 5-column PDF book grid (10 books; 4 columns on tablet, 2 on phone) and a cake carousel
  (scroll-snap, arrows). Texts are Azerbaijani inline like the shop pages (no copy keys); catalogue images load in
  the browser after hydration, SSR keeps texts and links.
- Live: website runtime `949bdabe…` (rollback plan `website-runtime-plan.before-hshop.json`), gateway `453d6d8a…`
  (plan `home-shop-web-plan.json`, rollback `rollback-home-shop-web-plan.json` → `5c180b47…`).

## Xəbərlər (news) and partner strip (2026-11-10)

- AZ-only `/az/xeberler/` list and `/az/xeberler/<slug>/` detail pages (other languages 404). Content lives in
  `src/website/news.ts` (`NEWS`, newest first; plain text blocks, optional `link`/`source`), partner logos in `PARTNERS`
  (files under `public/website/partners/`, served by the gateway at `/website/partners/`). No copy keys added.
- Home: news cards after the journal on `/az/`; ecosystem/partner strip after the journal on every language.
- `scripts/website/server.mjs` imports `NEWS` from the renderer for sitemaps, so server and renderer ship together.
- Live: website runtime `55cc80ab…` (FROM `61dbffa2…`, rollback `website-runtime-plan.before-news.json`); gateway
  `10d00b14…` (FROM `a2abead9…`, plan `news-web-plan.json`, rollback `rollback-news-web-plan.json`). The gateway also
  carries website assets/az shell and `/usr/share/nginx/website/website/partners/`.
- Facts in news are limited to owner-confirmed items and the The Tech article (22.10.2026); program acceptance dates
  and the Inmerge/Anthropic relationship still need owner confirmation before any news mentions them.
- 2026-11-10 (later): owner-confirmed dates (Microsoft 3 Jul, Google 5 Jul, Anthropic 1 Sep), AWS Activate and Inmerge
  summit items; minimal 1200x630 covers from `scripts/website/news-covers.mjs` (`public/website/news/<slug>.jpg`, also
  og:image). Never show the Anacan logo inside a circle on the website: use `/website/brand-glyph-coral.png`.
  Compact scale tokens live on `.anacan-public-website` (`--site-section-gap`, `--site-card-pad`, `--site-control-h`…).
  Live: website `832ce991…` (rollback `website-runtime-plan.before-compact.json`), gateway `0cff031c…`
  (plan `compact-web-plan.json`, rollback `rollback-compact-web-plan.json`). Gateway copies only `website/news`,
  `website/partners` and `brand-glyph-coral.png` into `/usr/share/nginx/website/website/`.

- 2026-11-10 (not deployed): English news `/en/news/` and `/en/news/<en-slug>/` (data in `NewsItem.en`, labels in
  `NEWS_LABELS`, routes `NEWS_SLUGS`). Every item except the PDF books item is translated; the books item stays
  az-only (shop not promoted outside AZ). hreflang az↔en + x-default→az; sitemaps from `newsSitemapEntries()`.
  Partner covers are shared; art covers with text get `public/website/news/en/<en-slug>.jpg`. /en/ home shows the
  three newest English items; footer/mobile menu "News" on en. Other languages still 404.

## Uşaq adları and dekret pulu kalkulyatoru (2026-11-10, not deployed)

- Code: `src/website/tools/` (texts inline, no copy keys). Names data are bundled snapshots of the app's
  `baby_names_db` (`tools/data/names-<lang>.json`, rows with a meaning only; Dəniz/Ülvi duplicates merged, origin
  `Yun`→`Yunan`, long dashes in ka meanings → comma). The browser loads the data chunk before hydration
  (`tool-data-client.ts`); the SSR renderer registers everything at import (`tool-data-server.ts`).
- Names: enabled languages `NAMES_ENABLED = ['az','ka']` (tr/ru/kk/en prepared, 404 until enabled). az: `/az/usaq-adlari/`,
  `qiz-adlari/`, `oglan-adlari/`, `herf/<letter>/` (letters with ≥5 names), `/<name-slug>/`; ka: `/ka/ბავშვის-სახელები/…`
  (`გოგოს-სახელები`, `ბიჭის-სახელები`, `ასო/<letter>/`). az letter slugs keep every letter distinct: ç→ch, ə→ae, ğ→gh,
  ı→ii, ö→oe, ş→sh, ü→ue. hreflang only hub↔hub and gender list↔gender list.
- Dekret: `/az/dekret-pulu-kalkulyatoru/`, days/percentage from `src/data/maternityRules.ts` (AZ). Multiple births use
  70 + 70 per Əmək Məcəlləsi 125.1 (`MULTIPLE_BIRTH_BASIS` in `tools/dekret.ts`); the AZ rule's 84 + 110 needs review.
- Sitemaps: `toolSitemapEntries()` from the renderer feeds `sitemap-pages.xml` and `sitemap-az/ka.xml` (server.mjs).
  The static prerender does not emit these pages (SSR only, like news). Runtime image must ship server and renderer together.
- "Tətbiqdə aç": iOS `anacan://tool/<id>?src=…`, Android `intent://…;package=com.atlasoon.anacan;S.browser_fallback_url=<Play>`,
  desktop/no-JS → `/<lang>/yukle/`. Tool ids `names`, `maternity-calculator`.
- 2026-11-10: baby names (az 329 + ka 80 name pages, gender/letter lists) and the AZ dekret pulu calculator
  (src/website/tools/) live. Website `55d9d58c…` (rollback `website-runtime-plan.before-names.json`), gateway
  `4202d187…` (plan `names-web-plan.json`, rollback `rollback-names-web-plan.json`). Sitemaps resubmitted in
  Search Console (service account anacan-search-console@…, keyless, impersonated by info@anacan.az).
- 2026-11-10 (SEO 1): four calculators in 21 languages (pregnancy weight, conception, period calendar, WHO baby
  growth), technical SEO (audits, Organization/BlogPosting schema, journal pagination, image sitemaps, sitemap index,
  font preload), hidden AZ pregnancy weeks 1–42 (`PREGNANCY_WEEKS_PUBLISHED=false`, noindex + X-Robots-Tag, out of
  sitemaps). Shop pages stay out of sitemaps (`SHOP_IN_SITEMAP=false` in server.mjs). Website `26e3c904…`
  (rollback `website-runtime-plan.before-seo1.json`), gateway `5b09d9aa…` (plan `seo1-web-plan.json`, rollback
  `rollback-seo1-web-plan.json`). Runtime also ships prerender.mjs and llm-policy.mjs now.
- 2026-11-10: owner switched the pregnancy week pages off (`PREGNANCY_WEEKS_ENABLED=false`, all week URLs 404;
  week content lives in the app). Website `32ddac1f…` (rollback `website-runtime-plan.before-weeksoff.json`),
  gateway `132dd27d…` (plan `weeksoff-web-plan.json`, rollback `rollback-weeksoff-web-plan.json`).
- 2026-11-10: English news `/en/news/` (7 items; the PDF books item stays az-only). Website `0c464bbb…`
  (rollback `website-runtime-plan.before-newsen.json`), gateway `6fe1793d…` (plan `newsen-web-plan.json`, rollback
  `rollback-newsen-web-plan.json`; adds `website/news/en/`).
- 2026-11-10: 11.11 web Premium campaign. app_settings.web_premium_campaign = name `1111-2026`, 2026-11-11
  00:00–23:59:59 (+04), yearly 18.89 AZN (was 50.98), monthly 3.99 (previous value saved on the server as
  `campaign-before-1111.json`). Page `/website/premium/1111/` shows USD at 1 USD = 1.70 AZN ($11.11 / $29.99) and states
  the AZN charge; `kampaniya.js?v=7` forwards to it on 11.11 (Baku) and for bank returns. Gateway `9001e19b…` (plan
  `c1111-web-plan.json`, rollback `rollback-c1111-web-plan.json` → `6fe1793d…`). Poz-Aç redesign (scratch card, 11 reasons, yearly only): gateway `6edca313…` (plan `c1111poz-web-plan.json`, rollback `rollback-c1111poz-web-plan.json` → `9001e19b…`).
- 2026-11-10: 11.11 page in en/tr/kk/uz (Dodo, USD; `?lang=` switcher; Asia/Baku timezone or -AZ locale stays az/Epoint).
  dodo-checkout applies `app_settings.dodo_campaign` {code 1111, yearly, 11 Nov Baku} when the page sends
  `campaign:'1111'` (functions image `ba6d3524…`, script `functions-dodo-campaign.py`, env unchanged). Dodo funnel
  shows live prices $3.99/$29.99. Gateway `6518f8cb…` (plan `c1111i18n-web-plan.json`, rollback
  `rollback-c1111i18n-web-plan.json` → `6edca313…`).

## Epoint compliance evidence (2026-11-11)
- Book checkout (website `src/website/Shop.tsx`, app `BookStoreScreen` CartSheet) requires the digital-delivery
  consent (`digital-delivery-v1`, Terms 6.6); `web-shop` refuses website book orders without it and stores
  `book_orders.consent_at/consent_version`. Premium pages send `premium-autorenew-v1`, stored on the subscription.
- `book-download` logs every PDF hand-out in `book_download_events` (time, email link or account, IP, user agent).
- Admin → "Epoint sübutu" (`AdminEpointEvidence`, RPC `admin_epoint_evidence_v1`): search by Epoint transaction,
  order ID or e-mail; "Sübut PDF" prints one transaction's evidence. Migration `20261111090000_epoint_evidence.sql`.
- Site phone +994 10 321 65 07 (`SITE_PHONE` in `src/website/components.tsx`): contact page and footer.
- Live: website runtime `98bd1884…`, gateway (site + app) `c4f8372e…` (plan `appev-web-plan.json`, rollbacks
  `rollback-appev-web-plan.json`, `rollback-compl-web-plan.json`, `website-runtime-plan.before-compl.json`),
  functions `2d74b24b…` (`functions-compliance.py`, previous `7ce98857…`).
- Evidence archive (`20261111110000_epoint_evidence_archive.sql`): `epoint_evidence_archive` keeps a SHA-256-stamped
  snapshot of every Epoint payment, taken by row triggers when `paid_at` is set (book_orders, web_premium_charges,
  cake_orders) and when a PDF order's `email_sent_at` is set; past payments back-filled (2 books, 4 Premium).
  Trigger errors only raise a warning. Admin card shows the snapshots. App gateway `3a9ce7b0…` (plan `apparch-web-plan.json`).
- 2026-11-11: Anacan AI Premium-only (`free_limits.ai_chat_count_per_day` = 0; paywall on entry), Instagram-style
  comment sheet, Community search removed. App gateway `b2c2256d…` (plan `appig-web-plan.json`, rollback
  `rollback-appig-web-plan.json` to `3a9ce7b0…`).

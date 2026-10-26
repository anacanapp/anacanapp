# Sayt bloqlarında Markdown — canlı düzəliş, 2026-10-08

**Düzəliş `https://anacan.az` üzərində yayımlanıb.** Qəbul zamanı Google-da
87 published məqalə, bütün 21 dildə **1 827 məqalə səhifəsi** mövcuddur.

## Problem və düzəliş

Əvvəlki website renderer Google `content`/`content_<language>` sahələrini yalnız
HTML kimi təmizləyirdi. Halbuki published mətnlər arasında Markdown, HTML və
HTML abzaslarına yapışdırılmış Markdown var. Buna görə `##`, `**`, cədvəl və
sitat işarələri bəzən oxucuya hərfi mətn kimi görünürdü.

`src/website/article-content.ts` CommonMark/GFM + HTML məzmununu eyni parser ilə
render edir. Bu parser Google SSR-də, statik prerender-də və lazım olduqda
website browser fallback-də istifadə olunur.

- Başlıqların bütün səviyyələri; məqalə daxilindəki H1 səhifənin ayrıca başlığını
  təkrarlamamaq üçün H2 kimi göstərilir. H2 mündəricat keçidləri deterministikdir.
- Qalın/kursiv/üstündən xətt, abzas, sətir keçidi, ayırıcı xətt.
- Nömrəli/nömrəsiz/iç-içə siyahılar və disabled GFM task checkbox-ları.
- Solda/ortada/sağda alignment ilə cədvəllər, klaviatura ilə fokuslanan mobil
  üfüqi scroll container-i; səhifəni genişləndirmir.
- Sitatlar, fenced/indented kod, inline code və hərfi escaped Markdown.
- Adi/reference/autolink/e-poçt keçidləri, şəkillər, figure/caption.
- Footnote/ref/backref və lokallaşdırılmış mənbə etiketi; HTML definition list,
  abbr, sup/sub, kbd, mark, details/summary elementləri.
- Köhnə HTML-dəki ardıcıl `-` abzasları siyahı olur, boş/sitat-marker abzasları
  çıxarılır. Tərcümələrdə `**标题：**正文` kimi punctuation-adjacent emphasis və
  məlum yarımçıq bold-wrapper nümunəsi mətn itkisi olmadan düzəlir.

`src/website/article-prose.css` website-only üslubları və RTL qaydalarını saxlayır.
Mövcud shared `BlogContent` komponentinin `prepared` parametri website-in artıq
render/təmizlənmiş HTML-ni əlavə Markdown çevirməsindən keçirmədən göstərir.

## SSR və browser müqaviləsi

Hazırlanmış public projection `contentFormat: "anacan-article-html-v1"` daşıyır.
Bu marker yalnız render nəticəsində yaranır; database content sahəsinə yazılmır.
`ArticlePage` həmin HTML-ni yenidən parse etmir: escaped mətn, kod, heading/footnote
ID-ləri və SSR hydration eyni qalır. Raw fallback parser-dən keçir.

Parser HTML-ni allowlist ilə təmizləyir; unsafe URL, script, style, event attribute,
iframe və form elementləri çıxarılır. Code text HTML kimi icra edilmir. Task input
yalnız disabled checkbox kimi qalır. Consumer/brand session tələb olunmur.

Google metadata/article cache **60 saniyə** olaraq qalır. Public DB oxuları
published-only anonymous RLS müqaviləsinə tabedir. Məqalə content/title/permalink
və editorial metadata sahələri bu düzəlişdə dəyişdirilməyib; read-back hash parity
canlıda təsdiqlənib.

## Canlı yayım və qəbullar

- Gateway immutable: `europe-west1-docker.pkg.dev/ninth-park-492111-m4/anacan-runtime/gateway@sha256:5e78780395037d7b60bad3cefd2cc60b8c76f2c23e6d253ac39e90074ebe43c5`.
- Website SSR immutable: `europe-west1-docker.pkg.dev/ninth-park-492111-m4/anacan-runtime/website@sha256:85b0b3d12e9777a4954af69dbcc782d4d4cc4b2b72fc93dd3f9cd79e8a962ad9`.
- Gateway Cloud Build: `612fe6df-3111-4b41-952f-223621778bd2`, SUCCESS.
- Website Cloud Build: `6d973233-8212-4b79-b043-c1d718931c7b`, SUCCESS.
- Yeni gateway cari active `bd637cbd…` üzərində yalnız public website/static
  asset layer-i əlavə edir. Nginx config və consumer app index hash-ləri eynidir.
- SSR əvvəlcə port9201-də canary ilə, sonra mövcud `anacan-website:9200` kimi
  işlədilib; real Markdown başlıq və cədvəl qəbulu keçir.
- Bütün **1 827 canlı HTML** parser nəticəsi ilə hash-parity, canonical,
  22 hreflang/x-default, **8 772 H2** və **351 cədvəl** yoxlamasından keçib.
- Məqalə sitemap1 827, mövcud legacy301, canlı JS/CSS hash-ləri PASS.
- Bütün elementli fixture: AZ/Arabic RTL ×320/390/768/1440px, overflow0.
- Altı real bloq ×320/390/1440px, mündəricat və HTML/Markdown/cədvəl nümunələri,
  browser error0 və overflow0 PASS.
-9 parser regression +3 route testi, app TypeScript, fokuslanmış ESLint,
  Node/Python syntax və `git diff --check` keçir.

Active Google admission `azure`/generation2, read-only control mount, beş digər
backend image-i, səkkiz enabled timer, canonical app və rezerv edilmiş IP-lər
qorunub. Cutover və finalized native workspace/package-lər öz mövcud müqavilələrinə
tabedir. Source capture/apply/seal/activate əməliyyatları replay edilməyib.

## Davam və receipt

Ignored operator workspace: `azure-migration/website/markdown/`.
Yekun hash-bound receipt: `azure-migration/ops/website-markdown-delivery.json`.

`scripts/website/build.mjs` optional ikinci arqumentlə təzə public catalog qəbul
edir; `build-server.mjs` optional output directory qəbul edir. Bu düzəlişin
fallback catalog-u canlı published-only oxularla87məqalədən hazırlanıb.

```bash
node scripts/website/build-server.mjs azure-migration/website/markdown/server
node scripts/website/build.mjs azure-migration/website/markdown/dist azure-migration/website/markdown/catalog
```

Gələcək deploy cari canlı gateway predecessor-i və active admission-u yenidən
yoxlamalıdır; köhnə pinned website/app-entry gateway konfiqurasiyası ilə əvəz
edilməməlidir. Bu sənəd və receipt əvvəlki website/cutover/content-plan qəbul
receipt-lərini əvəz etmir.

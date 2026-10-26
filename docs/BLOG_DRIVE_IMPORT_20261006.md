# Drive bloqları — 18 məqalə, 21 dil, realistik şəkillər

## Məzmun

İstifadəçinin paylaşdığı `1ug1g5FDdSK862pq23dyLsVhq4zDU13Ux` Drive qovluğundakı
18 Google Docs məqaləsi Anacan-ın mövcud bloq bazasına əlavə edilib. Eyni məqalə
identifikatorları Source/Lovable və Google-da saxlanır. Əvvəlki 62 məqalə silinmir.

- Hər məqalədə 21 dil üzrə başlıq, qısa mətn və tam məzmun; cəmi 378 dil versiyası.
- Yerli dilə uyğun SEO başlığı/təsviri, açar sözlər, şəkil alt mətni, dörd FAQ,
  mənbələr və əlaqəli məqalələr.
- Ana və Hamilə mərhələləri, qidalanma/yuxu/bez/böyümə/doğum çantası/təqvim əlaqələri.
- Məqalələrin tibbi məlumatları dəqiqləşdirilib: günəşlə sarılıq müalicəsi,
  məcburi döş boşaltma, mastit riskinin sıfırlanması və başqa əsassız iddialar çıxarılıb.
  Məqalələrə uydurma həkim təsdiqi və ya reviewer təyin edilməyib.
- İstifadəçinin əlavə göstərişi ilə hər mövzu üçün Anacan-ın şaftalı/krem rəng
  palitrasına uyğun AI-yaradılmış realistik şəkil hazırlanıb. 18 şəkil 1200×630
  WebP-dir; ümumi ölçü 620 116 baytdır. Fayl adları məzmun hash-i daşıyır.

## Web və SEO

Sonrakı istifadəçi giriş siyasəti Google/API app-host brauzer baxışını mobile
launcher/admin gate-ə keçirib;399SEO HTML/məzmun metadata-sı saxlanır. Public
marketing məqalələri `anacan.az`-da GoogleSSR ilə işləyir. Cari host/nəşr vəziyyəti
və kredit-bloklu Lovable davamı: [app entry müqaviləsi](APP_ENTRY_20261006.md).
Aşağıdakı browser qəbulu bu entry siyasətindən əvvəlki blog nəşrinin tarixçəsidir.

- Canlı Lovable: **https://app.anacan.az/blog/**.
- Canlı Google: **https://gcp.anacan.az/blog/**.
- Azərbaycan: `/blog/`, `/blog/<slug>/`.
- Digər dillər: `/blog/<language>/`, `/blog/<language>/<slug>/`.
- 399 əvvəlcədən yaradılmış HTML səhifəsi: 378 məqalə və 21 siyahı səhifəsi.
- Canonical origin: `https://app.anacan.az`; Google nüsxəsi həmin canonical-ı saxlayır.
- Qarşılıqlı 21 `hreflang` və `x-default`, `BlogPosting`, `BreadcrumbList`, görünən
  FAQ ilə uyğun `FAQPage`, Open Graph/Twitter, `sitemap-blog.xml`/`sitemap.xml`/robots.
- Mətn və şəkillər JavaScript olmadan HTML-də mövcuddur. İnteraktiv axtarış,
  kateqoriya/mərhələ filtri, mündəricat, FAQ, dil keçidi və paylaşma işləyir.
- Public bloq başlanğıcı anonymous REST oxusundan istifadə edir; consumer və brand
  sessiyasını refresh etmir. Tətbiqin əsas `/` ekranı öz mövcud giriş qaydalarını saxlayır.
- Köhnə native tətbiqlərin tanıdığı `/blog/:slug` app linki saxlanır; məqalə
  paylaşımının web linki lokallaşdırılmış canonical səhifəni göstərir.
- İn-app bloqda like/save/comment və Community `/Blog` kart identifikatorları
  mövcud cədvəl/RPC axınını istifadə edir.

## Database və davamlılıq

Yeni ayrıca relation yaradılmayıb. Mövcud `blog_posts` cədvəlinə yalnız nullable
`editorial_metadata jsonb` əlavə edilib. Mənbə migration:
`supabase/migrations/20261005180000_blog_editorial_metadata.sql`.

Source quraşdırıcısı əlavə sütunu və yalnız həmin relation-un dəyişməsini
yoxlayaraq CDC shape/writer guarding/catalog qeydini eyni transaction-da yeniləyib.

- Runtime: `source-blog-editorial-v1`.
- Runtime SQL hash: `230e4fc184a5bf6d80ee3f02939f27fb87fcaca0dee75dd98c54b8cd48111f6a`.
- Yeni Source catalog:
  `3ff2e8032f7852fca4b6a7a95366d977a5d214941201966d7ae09091ef6c545d`.
- Accepted: `8e22f4f9-23ed-49b6-9069-75c2793e3c83`.
- Pending: `94533cb9-7d21-4bed-b496-76f65be49773`.
- Writer `open/generation0`, 5 cron, əvvəlki runtime receipts saxlanır.
- Google `shadow` və bütün üç relation-un mövcud writer/CDC trigger-ləri saxlanır.
- Google-da kateqoriya UUID-ləri bəzi Source UUID-lərindən fərqli olduğuna görə
  mövcud slug-larla uyğunlaşdırılıb. Dublikat kateqoriya yaradılmayıb.
- Bu nəşr final snapshot/Source acceptance/admission/job/provider/DNS handoff-u deyil.
  Növbəti migration yeni Source catalog-u oxumalıdır; əvvəlki completed refresh replay edilmir.

## Yoxlamalar və sübutlar

`azure-migration/blog-import/` ignored operator sahəsidir. Private girişlər kod
handoff-una daxil deyil. Əsas receipts:

- `source-schema.json`, `google-schema.json`, rollback edilmiş schema dry-run-ları.
- `source-import.json`, `google-import.json`, məqalə import dry-run-ları.
- `realistic-image-manifest.json`, `realistic-attached-source.json`,
  `realistic-attached-google.json`, 378 alt mətn üçün `realistic-alt-text.json`.
- `data-verification-source.json`, `data-verification-google.json`: bütün 18 sətrin
  məzmun/metadata uyğunluğu və 21 dildə real anonymous REST oxusu keçir.
- `web-verification-127.0.0.1.json`, `web-verification-gcp.anacan.az.json`:
  hərəsində 378 HTML və 21 mobil browser dili, real şəkil decode, mündəricat,
  FAQ/axtarış/dil/modul keçidləri keçir.
- 43 focused app testi və 10 Node SEO/lokallaşdırma testi keçir; app/node
  TypeScript və explicit Source production build qəbul edilib.

Google web image:
`gateway@sha256:171224ac564a116420576b305fdacd4b104b8a87e47aad3a637673f104370959`.
Cloud Build: `96dd2904-82e7-49ef-a15c-151113bf33f7`.
Canlıda 1061 statik faylın bayt/hash və 5 servis health yoxlaması keçir.

Lovable reviewed 97-file delta həmin mövcud layihəyə göndərilib:
`e07ee1f9-3d58-48fe-a7a0-068ecf028173`. Nəşr tamamlanıb; commit
`8a44167b6c2eb26f25217f7b708d7f424c55e235`,97/97 persisted hash parity,
Source production build399HTML/399sitemap URL və real app host yayımı qəbul edilib.
Platformanın generated Source types yeniləməsi yalnız yeni metadata sütununun
üç Row/Insert/Update declaration-udur; application-owned compatibility saxlanır.

Hər iki canlı hostda378HTML və21browser dili qəbulu keçir.18şəklin hər hostda
HTTP MIME/SHA/1200×630 decode yoxlaması — cəmi36 — keçir. Source və Google-da
owned hesablarla in-app bloq, real like/save/comment persistence, qidalanma
bölməsinə geri keçid və doğum çantası əlaqəli məqalələri qəbul edilib; hər iki
fixture cleanup təsdiqlənib, real push recipient0.

Lovable focused test mühitində43sınaqdan42-si keçir; qalan köhnə Index navigation
testinin `afterEach fetch` assertion-u həmin platformada əvvəlki kodla da
uğursuzdur. Eyni test/setup/config baytları lokalda43/43 keçir, canlı hər iki
backend-in owned naviqasiya qəbulu keçir. Bu ayrı test-environment nəticəsi
remote report-da açıq saxlanır; “remote bütün testlər keçir” kimi yazılmır.

Nəşr receipt-ləri `lovable-web.json`, `lovable-independent-review.json`,
`lovable-finish-review-status.json`-dadır. Yekun hash-bound delivery:
`azure-migration/ops/blog-drive-delivery.json`.

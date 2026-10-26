# App/Android bloqları — Markdown və mobil göstərim, 2026-10-09

**Bloq göstərimi aktiv Google app/API-də yayımlanıb.** Markdown,HTML vəqarışıq
legacy mətnlər oxunaqlı göstərilir; cədvəllər dar ekranda öz daxilində sürüşdürülür.
Mövcud87published məqalə/1 827dilversiyası əhatə edilir.

Saytın ayrıca Markdown təhvili [WEBSITE_MARKDOWN_20261008.md](WEBSITE_MARKDOWN_20261008.md)
üzrədir. Bu app düzəlişi həmin canlı SSR xidmətini vəmarketinqpermalink-lərini saxlayır.

## Reader və responsivlik

- `src/lib/blog-content.mjs`:marked15GFM,sanitizedHTML,qarışıqrich-text,exportfence,
  escapedHTML,başlıq/qalın/kursiv/siyahı/link/cədvəl/kod/şəkil-captions.
- Köhnə HTML daxilindəMarkdownabzasları,ayrı`<p>`-lərdətable-row/siyahı,
  CJKpunctuation-adjacentbold vəorphanmarkers göstərimdə düzəlir. Storedmətn
  dəyişmir;rəqəmlər,negation,linklər vəcaptionlər tərcümə edilmir.
- H1→H2,deterministic`section-N`mündəricat,köhnəheadinganchor-link uyğunluğu;
  code/pre/a içindəMarkdownikinci dəfəişlənmir. HazırlanmışHTMLidempotentdir.
- `BlogContent.tsx`app/public-blogreader üçündür;website-in sanitized`prepared`
  parametri qalır. SSR-dərawinput-u kor-koranəHTMLsaymaq əvəzinəformatter tələb edilir.
- `src/styles/blog-content.css`:320/360/390/412px,shell/card/title/tag/actions,
  images/figuremax-width,longwordwrap,localtable/pre-scroll vəexplicitblogtipoqrafiyası.
  Başlıqlar,siyahılar vəabzaslar Tailwindtypographyplugin-in mövcudluğundan asılı deyil.
- Bəyənmə/saxlama/şərh düymələri,min-widthcomment/reply vəmüəllifqutusu dar ekrana
  uyğunlaşdırılıb. Əvvəlki conversation draft/overlay/back davranışı saxlanır.

## Mövcud Android paketlərinə çatdırılma

DeliverednativepaketlərinembeddedJS/CSS-iwebdeploymentilə yenilənmir. Buna görə
Googlegateway-dəyalnız`/rest/v1/blog_posts`vətrailing-slashroute üçün **read-only
HTMLpresentation** xidməti əlavə edilib:

- Container:`anacan-blog-projection`,Docker`anacan`şəbəkəsi,port9210,host-da yalnız
  `127.0.0.1:9210`,512MB/1CPU,`unless-stopped`. Auth/key/DBcredential saxlamır.
- Eyniquery/Authorization/apikey/Range/Prefer müvafiqPostgREST-ə ötürülür;
  **RLSvəidentityauthorityPostgREST olaraqqalır**. InvalidJWT401saxlanır.
- YalnızGET200/206JSONpublishedbody`content`/`content_<language>`sahələri çevrilir.
  Metadata,ID,slug,başlıq,FAQ,counter vəjoinedcomment dəyişmir. Draftlar,source-
  representation,privateAccept-Profile,errors vəwritecavabları olduğu kimi keçir.
- Mövcud87post/1 827unique sourcebodyhash üçün immutableprojectionseed var;
  gələcəkpublicmətnlərsanitizedformatter+boundedcache istifadə edir.
- `nativeCompatibility`rejimiuntrustedstyles-içıxardıqdan sonrafiniteownedinline
  table/image/pre/wraprules əlavə edir. Köhnə`HtmlContent`bunları saxlayır.
  Currentapp bunları strip edib öz responsiveCSS-ni istifadə edir.
- Source/rawoxu:`X-Anacan-Blog-Format: source-v1`. Cariadminhookbuheader-i qoyur;
  CORS,rawparity vəwritepassthrough testləri keçir. Publicresultheader:
  `X-Anacan-Blog-Format: native-html-v1`,`Cache-Control:no-store`.
- Googlepreviewpublic-mediaorigincontract saxlanır. apiresponsecanonicalmedia,
  gcpresponsemövcudpreviewmediahost göstərir;DBcanonicalvalues eynidir.

## Faktiki qəbul

-9formattertest+5HTTP/RLS-forwarding/projectiontest;TypeScript vəfocusedESLint keçir.
-1 857storedbodyvariant/1 827uniquelocaleprojection audit:idempotency,
  **rawMarkdownmarker0/missingimage0**.1857sayıbase/`content_az`alias-larını dadahil edir.
-14localproductionlayoutcheck:AZ/RTL320–1440px,uzunbaşlıq/teq/comment,
  clinicalrəqəmlər,TOC/FAQ vəreallegacypostlar.
- **32livecheck**:finalizedAndroid47-nin realembeddedbundle-i iləAZ/AR×
  320/360/390/412px×4məqalə. Fullbody/headings/localtablescroll/overflow0.
  Capacitorbridge testdouble vəbrowserAndroidtouch işlədilib;physicalAndroid
  cihazqəbulu kimi təqdim edilmir. Nativepackage/workspace dəyişdirilməyib.
- **124liveappreaderlayoutcheck**,bütün21dil;AZ/AR320–1440px,widerlayout,
  fullbody,headingstyle,table/imagebounds,TOC/FAQ vəverifiedadminpreview.
- İkiGoogleserverhostu üzrə **3 714bodyfield** exactprojectionSHA/parity;
  rawrepresentation,singleobject,invalidsession vəCORS qəbulu.
- Publicapp/api/gcplauncher və2realstorelink;website1 827sitemap vəreported
  legacypageheading/table yenidən qəbul edilib.
-8ownedfixtureaccount və11residualtable **0**. Migrationcontrol/content/categoryhash,
  activeguards,Googlemanagedadmission`azure`generation2,8timer qorunub.
- Signed47-nin4paketi və48.0/48.1/48.2developmentIPA olmaqla **7packageSHA** eynidir.
  CommonStorepointer47/nextcommon48 qalır.

## Deployment və davam

- Finalgateway:
  `europe-west1-docker.pkg.dev/ninth-park-492111-m4/anacan-runtime/gateway@sha256:fd69a5d25d993ab7c18481f5c2a28007cd15ec9d958df617c145fb1140abe964`.
- Blogprojection:
  `europe-west1-docker.pkg.dev/ninth-park-492111-m4/anacan-runtime/blog-projection@sha256:83dc8c6ea94b38778438492ecd7a1237b7b2218186bbf73d32bfad8b2e31bc1c`.
- WebsitesameSSR`85b0b3d1…`;nginxexistingcontrol/marketing/headers/media mappings
  currentimage-dən götürülüb. SonlayoutCSS:
  `/assets/blog-app-layout-737e41c1943e18c0.css`,indexlink ilə yayımlanır.
- Work:`azure-migration/blog-rendering/`;receipt`delivery.json`,ops
  `azure-migration/ops/blog-rendering-delivery.json`.
- **24allowlistedcode/receiptfaylı** privateGCSgeneration/read-backhashverified:
  `gs://anacan-migration-ninth-park-492111-m4/content-rendering-checkpoints/app-blog-rendering-20261009-v1/`.
- Futurewebbuild cari`src/`renderer/CSS-ni bundle edir. Currentgatewaynginxoverlay,
  separateprojectioncontainer vəwebsiteəlaqəsini qoruyun;köhnəgatewayconfig replay
  etməyin. Runtimeimagepointer`ops/google-cloud-runtime.json`.
- Storedblogcontent/sourcehashreceipt-lərini re-materialize/re-publish etməyin.
  Növbətikontentmövzuları:[doqquzluğuncheckpoint-i](BLOG_CONTENT_PLAN_NINE_20261009.md).

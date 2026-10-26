# Azure dayananda native tətbiq — 2026-09-22

## Qısa cavab

**Hazırkı Source-first native build-də, Supabase/Source işləkdirsə əsas tətbiq
Azure əlçatmaz olanda da Source ilə davam edə bilir.** Əsas data hələ Source-dadır;
Azure-un əsas inkişaf/deploy bazası seçilməsi final data/traffic cutover deyil.

- UI native bundle daxilindədir; `app.anacan.az` WebView-in lokal hostname-idir,
  remote `server.url` deyil.
- Auth, profil, uşaqlar, qeydlər, chat, storage və Source edge functions seçilmiş
  Source SDK üzərindən işləyir.
- Başlanğıcdakı Azure admission sorğusunun limiti **4 saniyədir**. Şəbəkə/DNS/
  timeout, 401/403/404/408/429 və 5xx hallarında cihaz son authority-ni saxlayır;
  pin olmayan Source-first quraşdırma ilkin Source siyasətini seçir.
- Azure-un `api.anacan.az` veb saytı və əsas reklam redaktə paneli dayanır.
  Yeni **39.0 / `source-mirror-v1`** müqaviləsi reklam konfiqurasiyasını Source-da
  saxlayır və Azure kəsiləndə son təsdiqlənmiş nüsxə ilə davam edir; Source admininin
  ayrıca sticky emergency açarı var. [Reklam davamlılığı və təhvil](ADMOB_CONTINUITY_39.md).
  Əvvəlki 38.0 paketləri Azure config yolundadır və bu dəyişiklik üçün yenilənməlidir.
- Source da əlçatmazdırsa config error/75s freshness guard-ı reklamı dayandırır.
  Azure coarse telemetriyası outage zamanı natamam qala bilər; bu, Google AdMob
  gəlir hesabatı ilə eyni deyil.
- RevenueCat, Apple/Google mağazaları və Source entitlement function-ları ayrıca
  xidmətlərdir; onların da işlək olması alış/bərpa üçün lazımdır.

## Sərhədlər

Bu, tam offline rejim deyil: internet və Supabase dayanarsa yalnız lokal/cache
imkanları qalır. Azure-a **artıq qəbul olunmuş** cihaz Azure pin-ini saxlayır və
Source-a özbaşına qayıtmır. Maintenance pin-i də özbaşına açılmır; bu, split-writer
və köhnə session replay-in qarşısını alır. 200 cavabında pozulmuş admission sənədi
və ya korlanmış yerli pin availability xətası kimi qəbul edilmir.

Yayımlanmış köhnə build-in hər detalı həmin build-in protokolundan asılıdır. Bu
qəbul cari Source-first namizədinə aiddir; final Azure admission-dan sonra eyni
fallback fərziyyəsi ilə Azure-u söndürmək olmaz.

## Yoxlama

- `backend-bootstrap.test.ts`: Source fallback, yeni quraşdırma, 403/503,
  4 saniyə timeout, Azure/maintenance pin-lərinin saxlanması.
- `verify-native-web-routing.mjs`: real bundled SDK ilə Azure DNS kəsilməsi,
  disabled-account 403, service 503 və yeni quraşdırma ssenariləri.
- `ANACAN_AZURE_OUTAGE=1 ... --onboarding-native`: bütün Azure brauzer sorğuları
  bloklanarkən real Source onboarding/data/reload qəbulunu aparır.

Yeni 39.0 reklam nəticələri:

- Run `native-20260922t142744-d625d7ad`: hər iki platformada **24/24 bundled routing**
  ssenarisi keçib. Real bundled API/AdMob adapter kodu Source mirror-u oxuyur;
  network/403/503 Azure kəsilmələrində native transport test bannerini göstərir.
- Source emergency update-dən sonra banner götürülür; Premium, UMP imtinası,
  Source-un özü əlçatmaz və global-disabled hallarında ad request yaranmır.
- SQL səviyyəsində last-good nüsxə, stale/conflicting revision rejection,
  ayrıca sticky emergency və frozen read-only davranışı **11 testlə** yoxlanıb.
- Live Source V61 və deployed Azure adminin real Source public oxuları ayrıca
  təsdiqlənib. Tam sübutlar və signed paketlər: [39.0 təhvil](ADMOB_CONTINUITY_39.md).

Əvvəlki 38.0 core/onboarding nəticələri:

- Hər platformada **17/17 bundled routing ssenarisi**, o cümlədən Azure DNS/network,
  403 account-disabled, 503 unavailable və fresh-install Source fallback keçib.
  Run: `native-20260922t052417-209d75c8`, `web-ios.json` / `web-android.json`.
- `communications-live-source-1790064416223.json`: **Azure-a bütün brauzer sorğuları
  bloklanmışkən** real Source-da bump/mommy/flow onboarding, data read-back, reload,
  reklamsız Premium kartının/modalının açılıb-bağlanması keçib. 3 fixture hesabı
  təmizlənib, cross-backend credential sorğusu 0, Source catalog/checkpoint qorunub.
- `onboarding-checks-1790064127169.json`: bu Source qəbulunu, platforma routing-i
  və Azure v29 kodunun eyni üç mərhələdə qəbulunu birləşdirən runner nəticəsi.

Bu browser/native-transport sınağıdır; real iPhone/Android hardware və store purchase
qəbulu ayrıca [onboarding təhvili](ONBOARDING_38.md)-ndə qeyd olunur.

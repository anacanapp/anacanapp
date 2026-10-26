# Community reklam moderasiyası — v40

**Azure yayımı:** 27 sentyabr 2026, gateway `anacan-gateway--0000041`, ACR cb23,
`sha256:c50b9a33501301d60094f5caa0e8e33587304dce96db036248c7c8964772a5ff`.
SQL32 quraşdırılıb. Worker cb22:
`sha256:ab33907d754c47a3790895617b842472bc0928e7e557202e5e6f74ac813ed30f`.

## Müqavilə

- Admin bölməsi: `https://api.anacan.az/admin/ad-moderation`.
- Bütün **21 dil**: az, en, tr, ru, de, ar, ka, kk, uz, zh, id, fr, es, pt, vi, hi, ja, ko, pl, nl, sv.
- Hər yeni paylaşım və məzmun/qoşma dəyişikliyi PostgreSQL trigger-i ilə əvvəlcə
  `checking`, `is_active=false` olur. Birbaşa REST və köhnə tətbiq yazıları da bu
  qaydaya tabedir. Premium, anonim paylaşım və admin rolu avtomatik istisna deyil.
- Aydın şəxsi sual/təcrübə avtomatik təsdiqlənir. Reklam və qeyri-müəyyən nəticə
  `review` olur; yalnız səlahiyyətli admin həmin dəqiq versiyanı təsdiq/rədd edə bilər.
- Həkim adı, qiymət sualı, dərman, məhsul tövsiyəsi, pulsuz şəxsi hədiyyə və reklamdan
  şikayət etmək öz-özlüyündə reklam hesab olunmur. Satış/xidmət çağırışı, kommersiya
  əlaqəsi, affiliate/referal kodu, gəlir/MLM cəlbetməsi, kənar kanal reklamı və
  gizlədilmiş təbliğat ayrıca səbəb kodları ilə göstərilir.

## Aşkarlama və media

Eyni Node.js worker Azure və reviewed Source müqaviləsində istifadə olunur.
`policy.mjs` Unicode/21-dil siqnallarını hazırlayır; `engine.mjs` mövcud Google
Vertex/Gemini konfiqurasiyası ilə postun mənasını və dəstəklənən şəkilləri yoxlayır.
Mətn, şəkil və onların içindəki əmrlər model üçün etibarsız məlumatdır.

- Avtomatik dərc: `allow`, reklam balı **0–19**, təsnifat əminliyi **≥0.9**, yalnız
  `not_advertising`, bütün qoşmalar yoxlanılmış və mövcud olmalıdır.
- Bal modelin təxminidir; statistik cəhətdən kalibrə edilmiş ehtimal deyil.
- Mətn maksimum20 000 simvol;10 qoşma. Bir yoxlamada maksimum4 PNG/JPEG/WebP,
  hər şəkil3MiB, cəmi8MiB. Video, animasiya və oxunmayan/böyük/əlavə qoşma insan
  yoxlaması tələb edir; yalnız ilk kadr və ya caption əsasında avtomatik təsdiq yoxdur.
- Şəkildən çıxarılan mətn ayrıca **AI təxmini** kimi göstərilir; müəllifin yazdığı
  mətndən dəqiq sitatlarla qarışdırılmır. Tibbi diaqnoz və məsləhət yaradılmır.
- Yeni qoşma yalnız cari backend-in `community-media/<hesab UUID>/<unikal fayl>`
  ünvanından qəbul edilir. Kənar/mutable URL və percent-encoded alias təsdiqə yol deyil.
- İstinad edilən media faylının silinib eyni URL-də reklamla əvəz edilməsi, yenidən
  upload edilməsi və storage versiyasının dəyişdirilməsi serverdə bloklanır. Owner
  postu sildikdən sonra fayl silinə bilər; mövcud service-role hesab silmə axını qalır.
- Tarixi Source media-sını Azure-da redaktə/təsdiq etmək üçün cari backend-ə yenidən
  upload tələb oluna bilər. Mövcud Source-first işində Source ünvanı öz backend-idir.

## Növbə və versiya təhlükəsizliyi

SQL32 üç nullable post sütunu və dörd qorunan relation əlavə edir:
`community_ad_reviews`, `community_ad_review_events`, `community_ad_deliveries`,
`community_ad_worker_state`. Mövcud `storage.objects` üzərində istinad qoruması əlavə olunur.
Private cədvəllər adi istifadəçi/admin REST SELECT/UPDATE üçün açılmır; server RPC-ləri
rol və hesabı hər əməliyyatda yoxlayır.

- `submit_community_post_v1`: hesab bağlaması və eyni ID/məzmun üçün idempotent yazı.
- `edit_community_post_v1`: owner və gözlənilən post versiyası; köhnə redaktə yenisini əvəz etmir.
- Worker `FOR UPDATE SKIP LOCKED`,4 dəqiqəlik lease, post versiyası və məzmun hash-i ilə işləyir.
- Gecikmiş worker, artıq silinmiş post, sonrakı redaktə və ya adminin əvvəlki qərarı
  yeni məzmunu təsdiqləyə bilmir. Qərarlar post → case lock sırası ilə atomikdir.
- Admin qərarı `revision + updated_at + request UUID` ilə bağlanır. Təsdiq/rədd/
  yenidən yoxlama və qərar dəyişikliyi audit tarixçəsinə düşür.
- Müvəqqəti AI xətası ən çox3 cəhd; uğursuz yoxlama avtomatik dərc etmir, moderatora keçir.
- Hesab başına saatda60 məzmun versiyası həddi; worker hər icrada maksimum10 postu,
  eyni anda2 təsnifatı işləyir. Mətn dəyişməyən like/count update yeni yoxlama yaratmır.
- Public feed/search/profile/RLS, translation cache və like/comment/bookmark yolları
  gizli postu başqa istifadəçiyə açmır. Müəllif `Paylaşımlarım` və bildiriş keçidində statusu görür.
- Moderasiya query-ləri `meta.persist=false` ilə diskdəki React Query cache-ə yazılmır.

## Bildirişlər və e-poçt

Reklam şübhəsində müəllifin hesab dilində tətbiqdaxili bildiriş eyni DB transaction-da yaranır:

> Paylaşımınız reklam xarakteri daşıya biləcəyi üçün moderasiyaya göndərildi.
> Yoxlama tamamlananadək Cəmiyyətdə görünməyəcək. Qərar barədə sizə bildiriş göndərəcəyik.

Texniki/media qeyri-müəyyənliyi reklam ittihamı kimi göstərilmir. Təsdiq/rədd də
lokallaşdırılmış bildiriş yaradır; şəxsi moderator qeydi istifadəçiyə göndərilmir.

- Admin e-poçtu serverdə sabit **`jamil@anacan.az`** ünvanıdır.
- E-poçt case ID, dil, versiya, siqnal balı və qorunan Admin keçidini daşıyır;
  postun şəxsi mətni, müəllif məlumatları və media faylı mailə köçürülmür.
- E-poçt və push ayrıca durable outbox-dadır. Bir case/qərar mərhələsi/cihaz bir dəfədir.
- Push öncəsi tokenin son sahibi, hesabın bildiriş/Community opt-out-u və mövcud
  `Asia/Baku` səssiz saatları yenidən yoxlanır. Raw device token auditə/loga yazılmır.
- SMTP TLS sertifikatı yoxlanır; SMTP qəbul cavabı və FCM2xx provider qəbulu deməkdir,
  məktubun telefonda göstərilməsi/oxunması sübutu deyil.
- Təsdiqlənmiş xəta bounded retry alır. Göndəriş nəticəsi qeyri-müəyyəndirsə `unknown`
  saxlanır və avtomatik təkrar yoxdur. Admin yalnız `failed` çatdırılmanı yenidən növbəyə ala bilər.

## İşləmə və sərhədlər

Azure üçün ayrıca `anacan-community-ad-moderation` Container Apps Job-u hər dəqiqə
növbəni yoxlayır; açıq istifadəçi/admin browser-i tələb olunmur. Mövcud population,
daily/bulk notification schedule-ları bu worker üçün aktivləşdirilmir. Functions12-də
23 route, Storage9, backend admission Source/generation0 ayrıca bazadır.

Worker yalnız öz managed identity-si ilə mövcud Key Vault secret references-i oxuyur:
Service role, Google AI, Firebase və mövcud SMTP user/pass. Parol/token/şəxsi mətnlər
image, frontend, kod arxivi və əməliyyat loguna yazılmır.

Source quraşdırılması: [SOURCE_COMMUNITY_AD_MODERATION.md](SOURCE_COMMUNITY_AD_MODERATION.md).
Bu web/backend işi finalized native41 və Store39 artefaktlarını yenidən yaratmır.
Növbəti native namizəd eyni mənbə kodundan ayrıca hazırlanmalıdır.

## Qəbul sübutları

- `azure-migration/ops/community-ad-sql-tests.log`: real disposable PostgreSQL15,
  RLS, CDC/writer freeze,16 verilənlər bazası ssenarisi,21 bildiriş dili.
- `community-ad-worker-tests.log`:32 worker/policy/SMTP/URI ssenarisi.
- App testləri: submission/retry/account switch,122-açarlı21-dil müqaviləsi,
  admin qərarı/konflikt/pagination, Community/deep-link regressiyaları.
- `community-moderation-model-check.json`: canlı AI,49 sintetik mətn ssenarisi/21 dil;
  şəxsi istifadəçi postları oxunmur, e-poçt və push göndərilmir.
- `community-moderation-vision.json`: real AI ilə3 sintetik şəkil; reklam, şəxsi
  mərhələ paylaşımı və klinika əlaqəsi olan tibbi sənədin ayrılması.
- `community-moderation-web-local.json`, `community-moderation-web-deployed.json`:
  real bundle, synthetic backend,21 dil və320/390/768/1440px.
- `community-moderation-api.json`: real Azure Auth/RPC/Storage, yalnız owned fixtures,
  sıfır real push/e-poçt və təsdiqlənmiş cleanup.
- `community-moderation-canary.json`: faktiki scheduled container və real model
  normal postu19 saniyədə, bir cəhddə avtomatik dərc edib; sıfır bildiriş/e-poçt,
  owned account/post cleanup təsdiqlənib.
- `community-moderation-release-email.json`: `jamil@anacan.az` ünvanına bir dəfəlik
  aktivləşmə məlumatı **27 sentyabr09:44 UTC**-də SMTP tərəfindən qəbul olunub.
- Cari yayımın yekun nəticəsi və image/hash-lər: `community-moderation-release.json`.
  Hazırlıq/build nəticəsi özü ayrıca live deployment və ya Source acceptance sübutu deyil.

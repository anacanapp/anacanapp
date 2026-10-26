# Source uyğunluğu — Community reklam moderasiyası

## Qəbul edilmiş release43 yeniləməsi — 2026-09-30

SQL32 Source wrapper-i quraşdırılıb; hash
`78311387049b4e4473414a365517079670d38d60323a22e4aa05de972e10afe3`.
`anacan-source-ad-moderation` hər dəqiqə işləyir; real owned post Gemini yoxlamasından
sonra avtomatik dərc olunub və əlavə alert yaratmayıb. Eyni kodun Source paneli:
`https://anacan-source-release.grayocean-6fd65b89.westeurope.azurecontainerapps.io/admin/ad-moderation`.

Source service-role credential tələb etməyən reviewed transport əlavə edilib:
`source-community-worker-v1`, `source_community_worker_v1(text,jsonb)`.
`SUPABASE_ANON_KEY` + private `COMMUNITY_MODERATION_WORKER_TOKEN` yalnız sabit
claim/finish/delivery/heartbeat RPC allowlist-inə giriş verir. Yeni control relation
CDC/writer guard-a daxil edilib; əvvəlki Source cron-lar dəyişməyib.
Hazırlıq: `prepare-community-worker.mjs`; deploy/status: `ops/source-community-worker.mjs`.
Tam qəbul və image hash-ləri: [RELEASE_43_SOURCE.md](RELEASE_43_SOURCE.md).

Aşağıdakı service-role konfiqurasiyası əvvəlki operator yolu olaraq qalır;
cari yerləşdirmə yuxarıdakı məhdud transportdan istifadə edir.

Əsas yayım hədəfi Azure-dur. Source-first tətbiqin eyni müqavilədə işləməsi üçün bu
paket hazırlanır; Source SQL/worker/UI operator qəbulu ayrıca təsdiqlənməlidir.

## Quraşdırma sırası

1. Əvvəl [SUPABASE_FOLLOWUP_37.md](SUPABASE_FOLLOWUP_37.md)-dəki localization21,
   admin21, regional/community-language, followup36 və followup37 prerequisite-lərini
   öz sırası ilə tamamlayın. Əvvəlki309 SQL/18 function handoff bu paketin daxilindədir.
2. **Hər əvvəlki DDL-dən sonra** növbəti catalog-pinned installer-i regenerate edin.
   Reklam moderasiyası üçün repository/full credential-free code handoff daxilində:
   ```sh
   node azure-migration/source-compat/prepare-community-ad-moderation.mjs
   ```
3. Source/Supabase SQL Editor-da yalnız tam generated faylı icra edin:
   `azure-migration/source-compat/RUN_SOURCE_COMMUNITY_AD_MODERATION_INSTALL.sql`.
   `32-community-ad-moderation.sql` və notice-copy raw faylları Source-da ayrı-ayrı
   icra edilmir; bunlar renderer-in mənbələridir.
4. Eyni application source-dan Source backend-i istifadə edən Admin UI-ni hazırlayın.
   Yeni `/admin/ad-moderation` bölməsi, istifadəçi statusu və122 mətn açarı21 dildədir.
   Azure Admin-in öz DB-si Source növbəsini avtomatik oxumur.
5. Eyni `azure-migration/community-moderation/` worker-ni ayrıca operator idarəli
   Node22/Container Apps Job/scheduler-də hər dəqiqə işlədin. Source pg_cron-a yeni
   iş əlavə etmək lazım deyil; mövcud5 cron və notification sender-ları saxlanılır.

## Source worker konfiqurasiyası

Runtime server secret store-da (frontend, image və Git daxilində yox):

| Dəyişən | Müqavilə |
|---|---|
| `MODERATION_BACKEND` | `source` |
| `SUPABASE_URL` | `https://tntbjulojatnrqmylorp.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Source layihəsinin mövcud server service-role secret-i |
| `GCP_SERVICE_ACCOUNT_JSON`, `GCP_PROJECT_ID`, `GCP_LOCATION` | Mövcud təsdiqlənmiş Google AI konfiqurasiyası; alternativ `GEMINI_API_KEY` |
| `COMMUNITY_MODERATION_MODEL` | `gemini-2.5-flash` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Mövcud push layihəsinin server service account-u |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Təsdiqlənmiş SMTP konfiqurasiyası;465 TLS və ya587 STARTTLS |
| `COMMUNITY_MODERATION_ADMIN_URL` | Yuxarıda hazırlanmış **Source-backed** tətbiqin HTTPS `/admin/ad-moderation` ünvanı |

`SUPABASE_*` public/anon açarı service-role yerinə istifadə olunmur. Worker backend
origin-i və DB contract-ının `backend` dəyərini tutuşdurur. Source e-poçtu yanlışlıqla
Azure növbəsinə keçid göndərməsin deyə Source üçün Admin URL məcburidir və
`https://api.anacan.az` qəbul edilmir. Faktiki Source-backed UI ünvanı operator
tərəfindən yoxlanmalıdır; bu sənəd legacy frontend-in avtomatik yeniləndiyini iddia etmir.

Worker eyni fayllardır, ayrıca fork deyil:

```sh
npm ci --omit=dev --ignore-scripts
node worker.mjs
```

Qovluq: `azure-migration/community-moderation/`. Dockerfile də buradadır. Eyni
database üçün əlavə paralel scheduler yaratmayın; distributed lease qoruması
qəza/üst-üstə düşən icra üçün nəzərdə tutulub. SMTP/Firebase yoxluğu moderator
qərarını və tətbiqdaxili bildirişi ləğv etmir; outbox-da görünən xəta yaradır.

## Source guard və qəbul

- Runtime receipt: `source-community-ad-moderation-v1`.
- Dörd yeni relation və `community_posts`-un üç nullable sütunu commit-dən əvvəl
  CDC/writer guarding-ə daxil edilir. `storage.objects`-un mövcud guard enrollment-i tələb olunur.
- Media istinadının silinib başqa şəkillə əvəzlənməsinə qarşı trigger/DELETE policy var.
- Accepted/pending runs, bridge identity, writer generation və cron-lar rebase edilmir.
- Frozen Source submission/claim/receipt/heartbeat yazılarını bloklayır.
- Quraşdırılmış runtime-ın hash-i sonradan eyni version altında dəyişdirilmir.
- `get_community_ad_moderation_contract_v1()` Source/21 dil qaytarmalıdır.
- Adi hesab admin case/queue/worker RPC-sinə girə bilməməli; gizli post digər hesaba,
  translation cache-ə və public feed-ə çıxmamalıdır.
- Canlı qəbul yalnız öz test hesab/post/media-ları ilə, gerçek istifadəçilərə push
  göndərmədən və test mail/outbox-ları cleanup-dan əvvəl dispatch etmədən aparılır.
- Worker son check-in-i, normal postun dərc olunması, reklamın saxlanması, admin
  qərarı, account-language bildirişi, SMTP provider qəbulu və cleanup ayrıca yoxlanır.

Prepared installer və arxiv **installed/accepted** demək deyil. Mövcud native
artefaktlar bu yeni UI-ni daşımır; native təhvili yeni izolə namizəddə aparılır.

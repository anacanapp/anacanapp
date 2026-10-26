# Google Database — tamamlanmış canlı keçid, 2026-10-07

**Sonrakı native47Storetəhvili:**2026-10-07 hazır47.0iOS/Androidpaketləri
`azure-migration/releases/47.0/`-dadır. [Release47 və upload](RELEASE_47_GOOGLE.md).
Bu cutover/checkpoint qəbulunun ardınca yeni nativebuild-dir;Sourcewriter/data
əməliyyatları təkrarlanmayıb. Növbətiümuminative48,Store47publicationpending.

**Anacan-ın canlı database/Auth/media və runtime authority-si Google-dadır.**
İstifadəçi iOS46 scroll/düymə hotfix-ini fiziki cihazda qəbul etdikdən sonra bütün
cari app-lərin və gələcək build-lərin Google Database-ə keçməsini istəyib. Son
Source/Azure uzlaşdırılması və vahid-writer handoff həmin göstərişlə tamamlanıb.

## Cari authority və ünvanlar

| Sahə | Qəbul edilmiş vəziyyət |
|---|---|
| Google layihəsi | `ninth-park-492111-m4` / `809704677731` |
| Database | `anacan`, self-hosted PostgreSQL17.6 |
| VM | `anacan-gcp-candidate`, `europe-west1-b`, instance `5337342976864358679` |
| API / app / preview | `api.anacan.az`, `app.anacan.az`, `gcp.anacan.az` — Google, public HTTPS |
| Rezerv edilmiş giriş / çıxış | **34.49.16.103** / **35.240.81.111** |
| Cutover | `ecdae836-9073-498e-aad0-4f53c34bd716`, `active`, `completed:true` |
| Aktivləşmə | `2026-10-07T13:02:20.099Z` |
| Source | writer **sealed / generation3**, active/running cron **0**, pending **null** |
| Son accepted Source run | `52d3634b-d1d1-48d5-9383-4c11736953fb` |

DNS-i istifadəçi yönləndirib. Database Cloud SQL deyil; VM-dəki mövcud PostgreSQL
deployment-i saxlanır. Firebase Google giriş/push layihəsi `anacan-mobile` olaraq qalır.

Canonical public admission hər üç hostda `Cache-Control: no-store` və
`X-Anacan-Hosting: google` ilə təqdim olunur:

```json
{"schema":"anacan-backend-admission-v1","generation":2,"phase":"azure","minNativeVersion":"29.0","handoffSha256":"fccce226a426f6525b9849b2390d48ee0376ca8584c6c57d52b725bdd4fea7d2"}
```

**`azure` burada native managed authority/session realm-in protokol adıdır.** Fiziki
hosting Google-dır. Enum, auth namespace və adoption receipt-ləri `google` ilə
əvəz edilmir. Mövcud Source-first29+ klientlər admission-u növbəti tam bootstrap-da
oxuyur və ilk managed istifadədən əvvəl Google refresh alır; minimumdan köhnə
klientlər update gate-inə tabedir.

## Data, Auth və media qəbulu

- Əvvəlki `d1c93425-8b85-45ed-ae0f-3aed6a248e97` parent-dən initial delta
  `1d91969c-8bd5-4a7a-ad14-d01db093c86c`, closure
  `748707ff-4e36-4e3d-9d3c-9b09b6102de4`-dır. Durable primary commit
  `c87e12f1-543c-4e19-8dd0-9368745eb16e`: **28,013 insert /11,606 update /408 delete**.
  İtmiş cavab matching COMMIT receipt-dən bərpa edilib; data təkrar tətbiq edilməyib.
- Frozen final Source sərhədi **`2026-10-07T12:22:00.674093+00:00`**-dır. Final25
  cədvəldə **219 insert /91 update**, FK validation və writer/CDC qorunması keçir.
  Azure-only drift ayrıca reviewed merge ilə qəbul edilib.
- Son Source checkpoint qəbul edilib və writer seal olunub. Receipt SHA256:
  `4db00e18f21b40b8482800d5c49831c1a2bdea26f820d2ba114f60c5e6db85f7`.
- `2026-10-07T13:22:03.743Z` qəbul snapshot-ı: **14,868 user /15,110 session /
  167,912 refresh token /2,793 storage object**. Google287 guarded relation,
  disabled guard0, moderation content-hash mismatch0. Missing Source user,
  mismatched session/refresh və resurrected revocation saylarının hamısı0-dır.
- Real Source refresh Google-da eyni user/session UUID ilə keçir; revoked refresh
  rədd olunur. Subsequent rotation, canonical Auth və RLS qəbul edilib.
- **2,788 Source media faylı /5,124,435,887 bayt** verified; MIME/cache mismatch0.
  Google-only obyektlər saxlanıb. Source media, DB storage object və physical backup
  sayları ayrı inventarlardır.
- Keçiddən sonra fiziki iPhone-da əvvəlki hesab/məlumat və scroll/düymələr istifadəçi
  tərəfindən **“Bəli, hər şey işləyir”** kimi qəbul edilib.

## Runtime, provider və scheduler sahibliyi

Köhnə Azure gateway/Auth/REST/Storage/Realtime/Functions **Stopped**, doqquz Azure
job **Manual**-dır. Source cron0-dır. Google-da aşağıdakı səkkiz timer enabled/active-dir:

1. `anacan-job-daily-notif-slots`
2. `anacan-job-daily-notif-halfhour`
3. `anacan-job-flow-reminders`
4. `anacan-job-vitamin-reminders`
5. `anacan-job-expire-partner-links`
6. `anacan-community-ad-moderation`
7. `anacan-customerio-source-sync`
8. `anacan-customerio-billing-sync`

Customer.io destination **224149:93570**, daxili sync gate `enabled:true`-dur.
Source/Lovable/Azure hostları bloklanmış11 runtime/provider yoxlaması keçir:
Vertex, FCM validate-only, RevenueCatv1, moderation, Google Auth/RLS, notification
job Google TLS və Customer.io Google RPC. Acceptance fixture-ləri təmizlənib;
real push recipient/store transaction0.

Cari immutable gateway:
`europe-west1-docker.pkg.dev/ninth-park-492111-m4/anacan-runtime/gateway@sha256:bd637cbd0366a10f5e3daa5f54a553a14a2a5bf93c1747f2cd351d5a686c0bb7`.
Website/app-entry overlays,75 marketing permalink metadata-sı və Google SSR60s
published-only oxuları qorunub. Admission faylı
`/srv/anacan/runtime/control/anacan-backend.json`, bind mount
`/srv/anacan-control:ro`-dur. Public directory0755/file0644 müqaviləsi qorunur.

## Gələcək development, deploy və native build

- `npm run dev` və `npm run build` default olaraq **Google mode** istifadə edir.
  Lokal `.env.google` canonical API və public managed anon key saxlayır;
  frontend-də private runtime credential yoxdur. Azure işi explicit Azure mode tələb edir.
- Gələcək Google-native build verified `VITE_INITIAL_MANAGED_ADMISSION` bundle edir.
  Control offline olsa fresh install Google-a başlayır, əvvəlki Source pin adoption-a
  keçir. Observed maintenance saxlanır; köhnə/yeni Source cavabı rollback kimi rədd edilir.
- Native staging cari Vite-in `scripts/app-entry`/`scripts/blog` plugin asılılıqlarını
  da köçürür. Admission JSON dotenv round-trip-i keçir. Marketing public asset-ləri,
  web launcher/admin entry/brand portal/public-blog prerender native output-dan çıxarılır.
- İzolə iOS və Android web verification: **hər platformada17 routing case /508
  JS-CSS asset**,21 dil; eyni refresh namespace, tombstone və retry/adoption keçir.
  Bu acceptance sonradan47Storebuild-də də keçib;47signedpaketləri hazırdır.
- **156 focused app testi**, app/node TypeScript,14 Node tooling testi və4 Python
  active-deployment contract testi keçir. Yeni Python/Node helper syntax-i yoxlanıb.
- Read-only host yoxlaması altı active service, səkkiz enabled timer, private snapshot
  hash-ləri/database password uyğunluğu, public admission permissions və read-only mount-u
  təsdiqləyir. Future restart/deploy code ayrıca production restart ilə sınaq edilməyib.
- `prepare-runtime` active Google cache/credential-larını saxlayır; active rejimdə Azure
  recapture və missing/replaced database passwords rədd olunur. Shadow prerequisite SQL
  active startup-da tətbiq edilmir. Web build cari gateway-dən başlayır, control/website
  config-i saxlayır; deploy live phase/current image/admission müqaviləsini tələb edir.
  Job reinstall əvvəlcə bütün job identity/enabled gate-lərini yoxlayır və8 timer-i saxlayır.
- Private runtime snapshot Secret Manager **`anacan-runtime-env/versions/5`**, job
  snapshot **`anacan-job-config/versions/3`**-dədir. Private value-lar log/Git/handoff-a çıxmır.
- Consumer21dil/real-store pricing/restore/pending/one-time offers saxlanır. `/brands`
  və `/brands/manage` web-only, ayrıca managed session/cache və server membership-dir;
  legacy Source brand cache ayrıca namespace-də qalır.

## Backup, receipt və davam qaydası

- Cutover database backup: **`base_0000000100000026000000F6`**.
- Cutover physical file backup: **2,795 fayl /5,131,480,303 bayt**;
  `gcp-backups/files/manifests/2b5d6385-3943-4ad5-9847-2f3cf8d30d89.json`.
- Continuous WAL arxivi, daily03:15UTC DB və hourly:05UTC file timer-ləri aktivdir.
  İlkin real PITR/full-file restore qəbulu əvvəlki migration sənədində saxlanır.
- Authoritative receipt: **`azure-migration/ops/google-population-cutover.json`**.
  Əsas hash-bound acceptance receipt-ləri həmin fayldakı `receipts`-dədir.
- Post-cutover runtime/default-build/native-routing/live-web/docs sübutları:
  `azure-migration/ops/google-cutover-continuity.json`; authority-də hash-bound
  `continuityEvidence` pointer-i. Lokal checkpoint
  `azure-migration/google-cutover/final-checkpoint/`, private GCS:
  `gs://anacan-migration-ninth-park-492111-m4/population-checkpoints/ecdae836-9073-498e-aad0-4f53c34bd716`.
- `google-cloud-current-refresh.json` **historical/superseded** snapshot-dır. Cari
  production status həmin shadow pointer-indən oxunmur. `acceptance-status.mjs`
  active receipts/hash-ləri və live canonical admission-u yoxlayıb active status yazır.

Tamamlanmış capture/apply/freeze/accept/seal/activate əməliyyatları replay edilmir;
Source accepted chain reset/prune olunmur, Source writer/cron yenidən açılmır.
`post-approval-sync.mjs` active population-da
`GCP_POPULATION_ALREADY_ACTIVE_NO_SOURCE_REPLAY` qaytarır. Production yeni
data/session qəbul etdiyinə görə rollback ayrıca reconciliation tələb edir.
Bu davam işi üçün `finish.mjs` yenidən işlədilmir; əlavə sübutlar ayrıca checkpoint addendum-dur.

## Ayrı qalan buraxılış qəbulu

- iOS46hotfixpaketləri saxlanır;**cari47 Store upload/submission/publication pending**.
  [47.0təhvili](RELEASE_47_GOOGLE.md).46İmzalı paket və expedited
  review mətni `azure-migration/releases/46.0/`-dadır;
  [hotfix müqaviləsi](IOS_INPUT_HOTFIX_46.md). Store45-in bundled input bug-u yeni
  hotfix yayımı ilə çatdırılır.
- Ümumi Google-native pointer47,45historical vəiOS46ayrısuccessor saxlanır. Növbəti ümumi versiya
  **48**; identity `com.atlasoon.anacan`, team`8B6976J8H7`, widget/App Group və
  WebView hostname`app.anacan.az` saxlanır.43/44/45/46 finalized paket/workspace-lər qorunur.
- Yeni real native Google/Apple login və Android physical cutover ayrıca acceptance
  tələb edir. Google redirect302 və Apple official-SDK/native ID-token audience/callback
  keçir, tam real login sübutu deyil. Apple browser preflight
  `apple-browser-start-1791379100289.json` **`APPLE_BROWSER_PREFLIGHT_FAILED`**-dır.
- RevenueCatv2 metrics permission və tarixi Source Auth-hook/IP binding operator
  asılılıqlarıdır; yeni activation yalnız live proof-la qeydə alınır.

Canlı keçiddən sonrakı web regressiyası: canonical986 asset/399blogHTML/18image,
21legal language,3brand language və system return-to-launcher qəbulu keçir.

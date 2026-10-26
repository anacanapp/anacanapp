# Dinamik push düzəlişi və Source → Google yenilənməsi

## Yekun vəziyyət — 2026-10-07

Cari native45/44/43 Source-first build-lərinin gündəlik/dinamik push problemi
serverdə düzəldilib. Mövcud tətbiq paketlərini dəyişmədən Source göndəriciləri
yenilənib. Normal12:00/14:00/14:30 Bakı cron axınlarında canlı göndəriş təsdiqlənib.

**10:38 UTC qəbulunda14 631 gündəlik bildiriş FCM tərəfindən qəbul edilib:**

- Analıq gün bildirişi:2 590.
- Hamiləlik gün bildirişi:1 981.
- Planlaşdırılmış digər bildirişlər:10 060.
- Vitamin xatırlatmaları da yenidən göndərilir.

Bu say FCM-in server qəbuludur; hər telefonun ekranda göstərməsi ayrıca cihaz
qəbuludur. Event mesaj/like/şərh göndəricisi əvvəl işləyirdi və saxlanıb.

Source databaza və şəkillərinin Google yenilənməsi əvvəlki `94533cb9…`
checkpoint-indən davam edərək tamamlanıb. Yeni snapshot sərhədi
**2026-10-07 09:44:04.03558 UTC**-dir. Bu sərhəddən sonrakı Source yazıları növbəti
delta-ya aiddir.

## Push nasazlığının səbəbi və düzəliş

Beş orijinal Source cron job-u aktiv idi və SQL icrası `succeeded` göstərirdi,
lakin `net._http_response` tətbiq göndəricilərində401 qaytarırdı. Eyni qüvvədə olan
reviewed Source cron açarı platformanın cari function environment-indəki qəbul
edilən açar dəsti ilə uyğun gəlmədiyi üçün iş başlamırdı. Notification run log-u
30 sentyabrdan sonra yenilənmirdi.

Əlavə köhnə completion xətası: gündəlik göndərici mövcud olmayan
`mommyNotifsByDay` dəyişəninə müraciət edirdi.

Düzəlişlər:

1. `supabase/functions/_shared/notification-auth.ts`: yalnız dörd orijinal Source
   cron funksiyası üçün async uyğunluq yoxlaması. JWT payload-ını etibarlı saymır;
   mövcud açarın dəqiq SHA256-si service-role-only SQL RPC ilə yoxlanır.
2. Source `verify_source_notification_cron_v2(text,text)` mövcud cron açarının
   pinned digest-ini, function allowlist-i və açıq writer vəziyyətini yoxlayır.
   Anonymous/ordinary hesablar bu verifier-i çağıra bilmir.
3. Gündəlik göndərici200profil üzrə davamlı parçalanır. Cihaz/uşaq/preferences və
   dedup log oxuları yalnız həmin parça istifadəçilərini əhatə edir; böyük event
   send log-u hər parçada yenidən oxunmur. Tokensiz parça da davam edir.
4. Davam çağırışı original Authorization/apikey/cron header-i saxlayır və
   `EdgeRuntime.waitUntil` ilə qorunur. Boş/yeni sample cron secret istifadə edilmir.
5. Completion həqiqi `mommyIndex.daily.size` istifadə edir.
6. `push_enabled=false` bütün gündəlik göndərişi dayandırır, ayrıca daily toggle
   true qalsa belə. Eyni davranış Google Node job-da saxlanıb.

Yerləşdirilmiş dörd Source function:
`send-daily-notifications`, `send-flow-reminders`, `send-vitamin-reminders`,
`expire-partner-links`. Mövcud provider secrets və verify_jwt parametrləri saxlanıb.
Reviewed bundle commit:
`213e4bac7c1d757cf782134f2eb47860b2ce69bc`.
ZIP SHA256:
`599a794bde72bdff2abacffbecdecbe05fa597c728442eb4b3b52667cac890f0`.

Source runtime `source-notification-auth-v2`, SQL body hash:
`8b58ae62ea960c44f66844443bbebb9c88c36255c2ae5a28a41ea9f52b1f571e`.
Data relation əlavə edilməyib; catalog, CDC/writer relation shape dəyişməyib.
Mövcud5cron hash-i:
`61656259a601a364671c89971c139fcdbe7aaa26f617b12059465ec4ef9fd231`.

Google notification-job image:
`notification-jobs@sha256:9cb94250a3f6e3e37ed6d9fa462830a5c2a81d40b60be13d5fb320a755cc5ebb`.
Build `61fe5a4e-f9c5-458a-98f2-9b0616075249`; beş notification job-un image-i
yenilənib, mövcud environment/TLS/schedule saxlanıb. Google shadow mərhələsində
business timer-lər disabled və runtime paused guard aktivdir; Source canlı
cron sahibidir. Google job activation final təsdiqli handoff pəncərəsinə aiddir.

## Google databaza və fayl delta-sı

- Run: **`bf8521b1-aa14-4e29-bf7f-cb9658c70fb8`**.
- Policy: `shadow-refresh-only`, `source-only-preserve-google`.
- Parent: `94533cb9-7d21-4bed-b496-76f65be49773`.
- Stream: `d14e8e1b-dbba-42d5-a80b-e90a5319d497`.
- Yeni closure / Source pending / Google base və last_closed_run:
  **`d1c93425-8b85-45ed-ae0f-3aed6a248e97`**.
- 282Source cədvəli,292 973stream sətri və8 254closing delta frame.
- Primary commit: `c7bfb529-5600-4efc-a1af-c41c1f13c910`.
- 233 203insert /53 921update /5 456delete; rollback dry-run və169FK yoxlaması keçib.
- 141post-commit sətr/data yoxlaması: uyğunsuzluq0.
- 14 867user /15 107session /167 196refresh row. Missing Source user/session/
  refresh mismatch və resurrected revocation0; disabled writer/CDC guard0.
- 227current moderation review: payload/post hash uyğunsuzluğu0.
- 2 786Source Storage obyekti /5 113 850 993bayt uyğunluğu və HTTP MIME/cache
  qəbulu keçir.105fayl yüklənib;2638əvvəlki proof təkrar istifadə edilib.
- Mövcud Google-only məlumat və marketinq75məqaləsinin permalink metadata-sı
  qorunub. Yeni Azure delta tətbiq edilməyib; drift read-only qeydə alınıb.
- 62plan konflikti scoped auditlə həll olunub:57Google website metadata-nın yeni
  nullable Source field-dən qorunması,2monotonic save counter,2Source silinməsi və
 1unleased CRM queue revision/resend. Uydurulmuş overwrite yoxdur.

Source qəbul edilmiş authority ancestor-u
`8e22f4f9-23ed-49b6-9069-75c2793e3c83` eynidir. Source writeropen/generation0,
catalog `3ff2e8032f7852fca4b6a7a95366d977a5d214941201966d7ae09091ef6c545d` və5cron
saxlanıb. Source accepted checkpoint/admission/DNS/provider/job cutover edilməyib.

## Source bağlantısının kəsilməsi və resume

Export78cədvəl/106 448sətrə çatanda Source Auth/REST və SQL connection-pooler yolu
timeout/504/522 qaytardı. Edge OPTIONS işləyirdi. Lovable read-only diaqnostikası
pooler bağlantısının əlçatmaz olduğunu təsdiqlədi; səbəb barədə tam resource/lock
sübutu alınmadı.

İstifadəçi qısa restartı təsdiqlədi. Restartdan əvvəl `SELECT1` artıq keçdiyi üçün
**restart icra edilmədi**. No-lock/52connection/unchanged cron-writer-stream qəbulu
alındı. Eyni stream/page hash/cursor-dan davam edilərək delta tamamlandı; başqa
Source stream başlanmadı. Bu kəsilmə Google runtime-ini dayandırmadı.

## Yekun yoxlama və backup

- 19hədəfli cron/pipeline/SQL test,25event-push safety testi,7stream/handoff testi,
 1scoped konflikt-preservation testi; dörd Source function TypeScript diagnostic0.
- Google current image və Source/Azure hostlar bloklanmış11runtime/provider check:
  Auth/DB/AI, event push/inbox/scope, FCMAndroid/APNs validate-only, RevenueCatv1,
  moderation/private group, scheduled-job TLS, Customer.io vəSMTP keçir.
- Google scheduled-job: real Google DB və recipient dil mətni ilə FCMvalidate-only,
  opt-out və legacy-host-blocked yoxlamaları keçir; owned fixture cleanup confirmed.
- Google veb986asset hash/399blogHTML/18şəkil/21legal dil və protected handler-lər,
  marketinqSSR/sitemap/media overlay saxlanıb.
- 12delivered43/44/45package SHA və4finalized workspace `changed:[]` təsdiqlənib.
  Yeni native/store package yığılmayıb.
- Yenilənmədən sonrakı DB full backup:
  **`base_000000010000002300000070`**.
- Fiziki file backup:2 793fayl /5 120 895 409bayt,
  `gcp-backups/files/manifests/3210e2cb-06b4-4644-8a7a-b0ab92cc6a30.json`,
  SHA `17daabae72ef0c2870f446f6511d5e9e6dc382b33d40841c991c977614b9bb92`.
- Source export və checkpoint privateGCS-də:
  `source-refresh/bf8521b1-aa14-4e29-bf7f-cb9658c70fb8` və
  `refresh-checkpoints/bf8521b1-aa14-4e29-bf7f-cb9658c70fb8`.

## Davam nöqtəsi

Current snapshot:
`azure-migration/ops/google-cloud-current-refresh.json`.
Birgə hash-bound delivery:
`azure-migration/ops/push-google-refresh-delivery.json`.
Tooling/receipts ignored `azure-migration/push-repair/` və run-un ops qovluğundadır.
Private keys,parol,sessiya və migration raw inputs handoff/Git/chat-a daxil deyil.

```bash
node azure-migration/google-cloud/refresh-worker.mjs status bf8521b1-aa14-4e29-bf7f-cb9658c70fb8
node azure-migration/google-cloud/finalize-refresh.mjs bf8521b1-aa14-4e29-bf7f-cb9658c70fb8
```

Bu run tamamlanıb; replay/restart etməyin. Növbəti istifadəçi-authorized shadow
refresh yeni UUID və təzə Source catalog/preflight ilə **d1c93425…parent-dən**
başlayır. Google runtime current gateway `a539f3ac…` və functions `f60fe67b…`-dir;
mövcud marketinqSSR/app-entry overlay saxlanmalıdır. Native build təsdiqi,
Source final writer/provider/job handoff-u və istifadəçinin api/app DNS keçidi
əvvəlki approval-gated müqavilə üzrə ayrıca qalır.

Source function yayımı Lovable task-i ilə bu dəfə qəbul edilib. Əvvəlki app-entry
ZIP-i `8a44167b…` before-hash bazasına bağlıdır; gələcək app-entry nəşrində cari
Source project commit-i yenidən oxunmalı və ayrıca reviewed delta hazırlanmalıdır.
Push/SQL yayımları köhnə app-entry arxivinin avtomatik nəşri kimi qəbul edilmir.

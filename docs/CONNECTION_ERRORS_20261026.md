# "Bağlantı" xətaları — server tərəfli düzəliş (2026-10-26)

Simptom: bəzi istifadəçilər (cari native buildlər daxil) açılışda "Bağlantı hazırlanır… sonra yenidən cəhd
edin" ekranını və ya tətbiq daxilində sorğu xətalarını görür. `src/main.tsx`-də açılış zamanı istənilən
istisna bu ekranı göstərir; tətbiqin daxilində isə 5xx, 504 və 429 cavabları uğursuz sorğu kimi görünür.

## Sübut (Cloud Monitoring, LB, 7 gün)
- 4.6 milyon sorğunun xətaları: 429: 5816, 500: 2690, cavabsız (0): 2888, 504: 1853, 503: 224.
- Hər gün **08:00 UTC** (Bakı 12:00, `anacan-job-daily-notif-slots` push) 504/500/0 partlayışı (10-19: 1047×504).
- VM `e2-standard-4` CPU-su hər saat **:05–:12**-də 99–100% olur (median 27%). Səbəb `anacan-files-backup`
  (`*:05`): 3625 fayl / 6.26 GB yenidən işlənir, dəyişən cəmi 0–2 faylıdır; hər dəfə ~9–10 dəq CPU vaxtı.
- nginx rate-limit açarı `$binary_remote_addr` idi, yəni Google Front End-in IP-si. Gateway-ə
  65–69 GFE IP-si (`35.191.0.0/16`) qoşulur, ona görə minlərlə istifadəçi eyni limiti paylaşırdı.

## Düzəlişlər (canlı; client dəyişikliyi tələb etmir — cari buildlərə də təsir edir)
1. `/etc/systemd/system/anacan-files-backup.service.d/10-low-priority.conf`: `Nice=19`, `CPUWeight=5`,
   `IOSchedulingClass=idle`, `IOWeight=10`. Backup məntiqi və cədvəli dəyişməyib.
   İlk sınaqda `CPUQuota=100%` də var idi: 07:05 run-ı ~9.5 dəq uzandı və
   `GCP_BACKUP_SOURCE_CHANGED_RETRY_REQUIRED` ilə rədd edildi (əvvəl də arabir olurdu, 2 gündə 2/32).
   Sərt limit götürüldü, 07:19-da əl ilə run uğurlu oldu (200 s). CPU pikinin 99% → 51%-ə düşməsi ölçüldü.
   Geri qaytarmaq: faylı silib `systemctl daemon-reload`.
2. Gateway `gateway@sha256:1139061f…` (Cloud Build, overlay əvvəlki `e7f844a8…` üzərində):
   `map $anacan_client_ip $anacan_limit_ip` — limitlər LB-nin attest etdiyi real istifadəçi IP-sinə görə;
   LB-dən kənar trafikdə köhnə peer IP. Limit dəyərləri və `refresh_token` istisnası dəyişməyib.
   İzolə test konteyneri canlı ilə eyni; `deploy-current-web.py ratelimit-web-plan.json` passed.
   Rollback konteyneri: `anacan-gateway-before-refresh-1792996149`.

3. `/srv/anacan/runtime/backup/backup-files.py` (sha256 `51de9ba7…`; əvvəlki `backup-files.py.bak-20261026`,
   `a1f478ef…`; `/home/anacan-runner/` surəti və testləri də yenilənib):
   - **Əsl CPU səbəbi** hash deyil, hər HTTPS sorğusunda yeni `SSLContext` (CA store yenidən yüklənir):
     ölçülüb 69.7 ms/sorğu → ortaq kontekstlə 8.6 ms. İndi bir yoxlanmış `TLS` konteksti istifadə olunur.
   - Hash keşi (`/srv/anacan/backups/files-backup-hash-cache.json`, 0600): ölçü/mtime/ctime/inode dəyişməyibsə,
     fayl yenidən oxunmur. Buludda blob-un ölçüsü və MD5-i hər run-da yoxlanır; blob yoxdursa və ya fayl
     dəyişibsə, hash edilib yüklənir. Keş yalnız manifest saxlandıqdan sonra yazılır. 02:00 UTC-də,
     `--verify` ilə və ya keş etibarsızdırsa, tam hash aparılır.
   - Nəticə: hər saatlıq run **4 dəq → 21 s**, CPU **~9–10 dəq → 25 s**; VM-də 9/9 test keçir.
   Geri qaytarmaq: `.bak-20261026` faylını `backup-files.py` yerinə kopyalamaq (root, 0600).

## 2026-10-26 08:00 UTC ölçüsü (düzəlişlərdən sonra)
- 08:05 backup: 3726 fayl, 4 yükləndi, 3722 təkrar istifadə; **26.8 s CPU**, passed.
- CPU 08:02–08:05 arası 85–92%-ə qalxdı, yəni backup başlamazdan əvvəl. Bu pik push işindən
  (`anacan-job-daily-notif-slots`) gəlir. 08:07-dən sonra 20–35%-dir və :05–:12 doyması artıq yoxdur.
- 08:00–09:00 LB-də 504: 168 (10-19: 1047, 10-24: 168), 5xx+0: 224 (10-19: 1372), 429: 8.

4. Gündəlik push 10 dəqiqəyə yayılır (09:01 UTC-dən canlıdır). Image:
   `notification-jobs@sha256:13333201…` (Cloud Build `61e43ad9`), əvvəlki image `c4ae4731…` üzərində overlay-dir.
   Yalnız `send-daily-notifications.mjs` dəyişib (sha256 `95e87695…`); bu VM-də iki image-in faylları müqayisə
   edilərək yoxlanıb.
   - İstifadəçilər `sha256(user_id)` sırası ilə sabit qruplara bölünür: eyni istifadəçi hər gün pəncərənin eyni
     hissəsinə düşür. 25 nəfərlik hər batch pəncərədəki öz payına qədər gözləyir; iş yavaş gedirsə, gözləmir.
   - Pəncərə default olaraq 600 s-dir. `DAILY_PUSH_SPREAD_SECONDS` ilə dəyişdirilə bilər (0 = söndürülür,
     maksimum 900, çünki `run-job.py`-nin timeout-u 1100 s-dir). Admin test göndərişi (`TEST_USER_ID`) gözləmir.
     Slot uyğunlaşdırması, dedup və göndərişdən əvvəlki preference yoxlaması dəyişməyib.
   - Testlər (4/4) build zamanı image-in içində işləyir. Mənbə və testlər:
     `merge-pending/2026-10-26-push-spread/`.
   - `anacan-job-daily-notif-slots.json` və `…-halfhour.json` dəyişib, timer-lər dəyişməyib.
     Geri qaytarmaq: `*.json.before-push-spread-20261026` fayllarını geri kopyalamaq (root, 0600).

## 2026-10-26 10:00 UTC ölçüsü (push yayıldıqdan sonra)
- Run 10:00:01–10:10:16 davam etdi, `spreadSeconds=600`, 5293 bildiriş göndərildi, exit 0.
- CPU maksimumu 42%-dir (08:00-da 92% idi).
- 10:00–10:14 LB-də 5xx: **0**, cavabsız: 8, 2xx: 6244.

## Qalan tövsiyələr
- LB loglamasını (aşağı sample rate ilə) açmaq; gateway log rotasiyası cəmi bir neçə saatı saxlayır.

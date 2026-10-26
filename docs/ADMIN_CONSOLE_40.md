# Admin mərkəzi və cəmiyyət UI — 2026-09-23

## İlkin Azure admin yayımı

- [Dashboard](https://api.anacan.az/admin)
- [Ayrıca Premium mərkəzi](https://api.anacan.az/admin/premium)
- [Bildiriş kampaniyaları](https://api.anacan.az/admin/push-notifications)
- Gateway **v31 / `anacan-gateway--0000029`**, ACR **cb1g**,
  `sha256:526287f3414075bb74ed9e0e250b50c4869d634214045f299e6a69f3fd673da6`.
- Functions **`anacan-functions--0000008`**, ACR **cb1f**,
  `sha256:89af94a3da711a737892360f070aaf3aa93c45f0de65b6209f2d05cf9cf30f9a`.
  23 aktiv route: mövcud21 + `admin-revenue-metrics`, `admin-notification-dispatch`.
  Legacy `send-bulk-push`, maliyyə/population gate-ləri əvvəlki kimi qorunur.

Sonrakı 21 dil yayımı hazırda gateway **v33 / `--0000031`**, Functions **`--0000010`**
üzərindədir. [Cari dil təhvili və sübutlar](LOCALIZATION_21.md).

## İnterfeys və məlumatlar

- 320/390/768/1440px layout, mobil focus-trap menyu, işlək menyu axtarışı,
  desktop collapse, lokal table scroll, safe area və ayrı content scroll.
- Admin bölmələri tələbə görə lazy-load olunur; bütün mövcud menu bölmələri qalır.
- Premium/aktiv trial/aylıq/illik/ləğv/bitmiş/manual/ailə hüquqları ayrıca göstərilir.
  Tarix pəncərəsi hadisələr üçündür, cari hüquqlar isə serverin cari vaxtına əsaslanır.
- Trial iki dəfə sayılmır; ləğv olunub hələ qüvvədə olan və artıq bitmiş hüquqlar
  ayrıdır. Household/manual hüquqları ödənişli mağaza abunəsi kimi göstərilmir.
- Product ID olmayan köhnə Premium kodu aylıq legacy təsnifatla göstərilir;
  köhnə Premium+ **illik/ömürlük** olaraq ayrıca qeyd olunur. Dəqiq olmayan bölünmə
  və subscription-count × qiymət əsasında gəlir yaradılmır.
- Period/ölkə/modul/dil filtrləri, serverdə səhifələnən30-luq üzv cədvəli, ad/email
  axtarışı, ölkə CSV-si, tool açılma/istifadə/unikal/cari Premium istifadə statistikası.
- SQL24 aggregate RPC-ləri bütün uyğun sətirləri serverdə sayır; əvvəlki1000/5000/
  10000 client limitinə əsaslanan dashboard hesablamaları çıxarılıb.
- Daxili analytics optional Firebase SDK xətasından asılı deyil.
- Cəmiyyətdə action gap **8px**, toxunma ölçüsü ən azı44px. Şərh qutusu boş44px,
  mətnə görə maksimum180px; siləndə/göndərəndə kiçilir, en dəyişəndə yenidən ölçülür.

## Bildiriş seqmentlərinin müqaviləsi

`admin_notification_segment_v1` daxilində:

- Dillər, modullar və ölkələr ayrı-ayrılıqda və ya istənilən kombinasiya ilə işləyir.
- Eyni kateqoriyanın seçimləri **OR**, kateqoriyalar bir-biri ilə **AND** birləşir.
- Əlavə: Premium/hüquq statusu, iOS/Android, qeydiyyat tarixləri.
- Boş seçim həmin kateqoriyanın hamısıdır; naməlum açar/dəyər rədd olunur.
- Eyni SQL predicate həm preview, həm creation, həm də göndəriş öncəsi yoxlamadadır.
- Notification/push/daily-push opt-out, uyğun cihazın olmaması və səssiz saatlar
  çıxarılır. Mövcud preference modelinin səssiz saat müqayisəsi **Asia/Baku**-dur.
- Tokenin ən son sahibi bütün token cədvəlində müəyyən edilir, sonra seqment tətbiq
  olunur. Eyni kampaniyada token hash-i bir dəfədir; raw token audit cədvəlinə yazılmır.
- Preview fingerprint recipient snapshot-a bağlanır. İstifadəçi/token dəsti dəyişibsə
  yenidən preview tələb olunur. Eyni create UUID-si başqa məzmuna tətbiq edilmir.
- SQL snapshot-dan sonrakı yeni uyğun istifadəçi bu kampaniyaya əlavə olunmur;
  sonradan opt-out edən və token sahibi dəyişənlər göndərişdən əvvəl çıxarılır.
- Worker yalnız service-role claim RPC-sindən aldığı maksimum40 recipient-i işləyir,
  maksimum8 paralel FCM sorğusu. Adi admin RPC-dən raw device token oxuya bilmir.
- FCM2xx qəbulu `sent`-dir, telefonda göstərilmə/oxunma zəmanəti deyil. Confirmed
  rejection `failed`, şəbəkə nəticəsi qeyri-müəyyən olarsa `unknown` olur və avtomatik
  təkrarlanmır. Yarımçıq claim5dəqiqədən sonra unknown olur, yenidən pending olmur.
- Eyni istifadəçi üçün uğurlu kampaniya inbox qeydi bir dəfə yaradılır. Ləğv pending
  göndərişləri saxlayır; artıq provider-ə ötürülmüş push geri çağırılmır.
- Yeni cron yoxdur. Source-da yeni/dəyişən relation-lar commit-dən əvvəl CDC və
  writer guard-a qoşulur. Frozen Source kampaniya creation/claim/receipt yazılarını bloklayır.

## Gəlir — operator addımı qalır

RevenueCat `GET /v2/projects/a3647ee8/metrics/overview` mövcud server açarına
**403 / authorization_error** qaytarır. Panel `permission_required` göstərir;
gəlir/MRR/ARPU/LTV üçün təxmini/fake rəqəm hesablamır.

RevenueCat console-da həmin server açarının layihə metrics/overview **read** icazəsi
tamamlanmalıdır. Secret yalnız mövcud private input/Key Vault references vasitəsilə
idarə olunur, chat/VITE/frontend-ə yazılmır. İcazə verildikdən sonra paneldə **Yenilə**.
Provider metrics-i layihə səviyyəsidir, öz pəncərə/ölçü vahidinə malikdir; DB ölkə/
tarix filtrlərinin nəticəsi kimi təqdim edilmir.

## Source operator quraşdırılması — hələ təsdiq gözləyir

Eyni tətbiq kodunun Source-native uyğunluğu üçün:

1. `node azure-migration/source-compat/prepare-admin-console21.mjs` ilə cari
   catalog-a bağlı installer-i yaradın. Source/Supabase SQL Editor-da tam
   `azure-migration/source-compat/RUN_ADMIN_CONSOLE_21_INSTALL.sql` faylını icra edin.
2. Yeni **`admin-notification-dispatch`** Edge Function-a
   `azure-migration/source-compat/ADMIN_NOTIFICATION_DISPATCH_SOURCE.ts` yerləşdirin.
3. Yeni **`admin-revenue-metrics`** Edge Function-a
   `azure-migration/source-compat/ADMIN_REVENUE_METRICS_SOURCE.ts` yerləşdirin.
4. Source asymmetric Auth JWT-ləri üçün gateway **Verify JWT** seçimi söndürülə
   bilər; hər iki handler özündə `requireAdmin` ilə real Auth user/role yoxlayır.
   Mövcud Source `SUPABASE_*`, Firebase və RevenueCat server secret-ləri istifadə olunur.
5. `node azure-migration/ops/verify-admin-console-source.mjs` ilə qəbulu yoxlayın.

Cari generated installer **`source-admin-console-v3`**-dür; 21 dil üçün filter
müqaviləsini də saxlayır. Runtime SQL hash:
`210ad2e24b9491f363085b3836b87ab753369b9fcbb014e30e85ca3d619383d6`.
Localization sxemi də quraşdırılacaqsa, birinci quraşdırmadan sonra ikinci
installer öz prepare skripti ilə cari catalog əsasında yenidən yaradılmalıdır.
[21 dil təhvili və quraşdırma ardıcıllığı](LOCALIZATION_21.md).
Mövcud bulk cədvəlinə iki nullable JSONB sütunu; yeni `admin_notification_deliveries`
cədvəli. Gözlənilən Source nəticə260 table /256 guarded relation; accepted/pending,
writer open/generation0 və5cron qorunur. Köhnə Source sender və native39 tarixi
workspaceləri dəyişdirilmir; yeni kampaniyalar ayrıca endpoint/protokol istifadə edir.

## Qəbul sübutları

- **92 fayl / 961 app testi**, TypeScript app yoxlaması.
- **11 disposable PostgreSQL/Source CDC testi** — rights/cancellation/expiry,
  bütün7dil/modul/ölkə kombinasiya qrupu, opt-out, token owner, immutable audience,
  concurrency, idempotent receipts/inbox, unknown outcomes, freeze.
- **24 router/packaging testi +7 yeni worker testi**; real FCM mesajı göndərilməyib.
- `admin-console-data-1790173481261.json`: Azure readonly aggregate, dəqiq premium
  total ilə member page total bərabərliyi;31tool /42country hesabatı.
- `admin-console-api-1790174865518.json`: özadmin/ordinary fixtures ilə real Auth,
  admin/RLS, segment-create replay və live worker. Fake device dispatch-dən əvvəl
  silinib: **0 real FCM recipient**, skipped=1; hər iki hesab və kampaniya təmizlənib.
- `admin-console-web-1790174726605.json`: local bundle responsiv/UI testi.
- `admin-console-web-1790175209609.json`: yayımlanmış bundle, synthetic API/actors;
  bütün4ölçü, pagination/filter, mobilmenyu, kombinə preview və44→180→44comment.
- `web-artifact-1790175199876.json`:6entry/HTML,4health,10route gate yoxlaması.
- Son davam yoxlamasında hər iki TypeScript layihəsi və dəyişmiş faylların whitespace
  yoxlaması keçib. `admin-console-source-1790175642087.json` Source runtime-ın hələ
  quraşdırılmadığını (`PGRST202`) göstərir; RevenueCat overview yenidən403 qaytarıb.

Credential-free təhvil arxivi və bütün üzvlərin hash yoxlaması
`azure-migration/handoffs/LATEST.json` / `VERIFIED.json`-dadır; native/signing/private
session materialı həmin arxivə daxil edilmir.

Azure admin DB hesabatları öz backend-in məlumat sərhədini göstərir. Source data
cutover baş verməyib; Azure pre-sync tarixi bütün mobil population-un bu günkü
göstəricisi kimi təqdim edilmir. RevenueCat read icazəsi və Source operator qəbulu
qalan xarici addımlardır. Native UI üçün sonrakı izolə40+ build tələb olunur;
yekun39.0 Store/development workspacelərinə bu dəyişikliklər yazılmır.

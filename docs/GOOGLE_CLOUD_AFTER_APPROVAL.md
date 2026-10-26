# Google Cloud — tamamlanmış approval və canlı keçid

## Cari vəziyyət — 2026-10-07

**App təsdiqindən sonrakı final data/authority keçidi tamamlanıb.** İstifadəçi
iOS46physicalscroll/düymə qəbulundan sonra bütün cariapp/gələcəkbuild-ləriGoogleDatabase-ə
keçirməyi istəyib. Authority:`ops/google-population-cutover.json`,ID
`ecdae836-9073-498e-aad0-4f53c34bd716`,active/completed.
[Yekun müqavilə və davam](GOOGLE_POPULATION_CUTOVER_20261007.md).

Sourcewritersealed/generation3,cron0,accepted`52d3634b…`,pendingnull. Google active,
managednativeadmission`azure`/generation2/min29.0,Google8timer/Customer.ioenabled.
api/app/gcpDNS/TLS artıqGooglereserved34.49.16.103-ə bağlıdır;egress35.240.81.111 qalır.
RealSource→Googlerefresh/UUID/revocation vəexistingaccount/data/physicaliOS46 keçir.

`google-cloud-current-refresh.json` tarixi snapshot-dır. Aşağıdakı approve-build/
capture/sync/freeze/checkpoint/activate/DNS ardıcıllığı artıq completed tarixçədir:
**replay etməyin və Sourcewriter/cron-u açmayın.** `post-approval-sync.mjs`active
rejimdə`GCP_POPULATION_ALREADY_ACTIVE_NO_SOURCE_REPLAY` iləpreparation/run/refresh-i rədd edir.

Gələcəkdeploy/native üçün currentGoogleprivatecredential/SM5-3,canonicalsignup/API,
website/controlmount və8enabledtimer saxlanır. Defaultdev/buildGoogle vəbundled
managedofflineadmission işləyir. Sonrakı47signedStoreIPA/AAB hazırdır;
[Release47](RELEASE_47_GOOGLE.md),nextcommon48. Store47upload/publication və
realnewGoogle/Applenativelogin/Androidphysicalacceptance ayrıca qalan addımlardır.

## Əvvəlki approval-gated preparation tarixçəsi

**Son ayrıca sorğu:**2026-10-04 istifadəçi Google shadow nüsxəsini yeniləməyi
istəyib. Bu məhdud refresh üçün ayrıca run-bound authorization mövcuddur;
app-build approval kimi qeydə alınmayıb. [Cari davam nöqtəsi](GOOGLE_CLOUD_CONTINUITY.md).
`post-approval-sync.mjs refresh <id>` bu səlahiyyəti yoxlayır. Aşağıdakı `run`
və production handoff qaydaları əvvəlki build approval şərtini saxlayır.

## O vaxtkı sərhəd

2026-10-04 istifadəçi build-ləri göndərdiyini bildirib. Google core runtime-ı
Source/Lovable/Azure hostları bloklanmış11 canary ilə qəbul edilib; operator
credential-larının Key Vault asılılığı çıxarılıb. Dəqiq status:
[GOOGLE_CLOUD_INDEPENDENCE.md](GOOGLE_CLOUD_INDEPENDENCE.md).
Cari8 business timer-i və Customer.io daxili `enabled` gate-i hələ bağlıdır;
handoff-da hər ikisi koordinasiya edilir. Native45 paketləri yenidən yığılmayıb.

İstifadəçinin son göstərişi: əvvəlcə cari native build yoxlanır; `api.anacan.az` və
`app.anacan.az` hazırkı yönləndirmədə qalır. Son database/Auth/fayl sinxronu və
canlı keçid build təsdiqindən sonra edilir. DNS-i istifadəçi özü yönləndirir.

Son ayrıca şəbəkə qərarı ilə `gcp.anacan.az` HTTPS web/API internetdən public-dir.
Giriş **34.49.16.103**, VM çıxışı **35.240.81.111** statik rezervasiya kimi pin edilib.
Operator-IP allowlist artıq yoxdur. Public giriş final məlumat/admission qəbulunu
və ya app-build təsdiqini əvəz etmir.

Private policy: `azure-migration/ops/google-cloud-release-policy.json`.
Cari `buildApproved:false` səbəbilə `run` komandası **database bağlantısı və
Source capture-dan əvvəl** `GCP_APP_BUILD_APPROVAL_REQUIRED` qaytarır.

## Hazırlığın read-only yoxlanması

Repo kökündən, mövcud private credential/reference-lər və yoxlanmış IAP bağlantısı ilə:

```bash
node azure-migration/google-cloud/post-approval-sync.mjs prepare
node azure-migration/google-cloud/backup-operations.mjs status
node azure-migration/google-cloud/public-network.mjs status
```

`prepare` exact native package bytes, Source bridge/catalog/parent və target
staging uyğunluğunu yoxlayır. `readyForApprovedSync:true` bu preflight nəticəsidir;
final data freshness, canlı qəbul və ya istifadəçi təsdiqi deyil.

2026-10-04 verified shadow baseline:

- Cari native run `native-20261003t163726-4000073c`; paketlər
  [Release45](RELEASE_45_GOOGLE.md)-dədir. Əvvəlki44 təhvili ayrıca qorunur.
- Source accepted `8e22f4f9-23ed-49b6-9069-75c2793e3c83`.
- Cari pending/Google base `94533cb9-7d21-4bed-b496-76f65be49773`; əvvəlki
  `27c99c9d-c789-4528-897d-019434ad37a4` ancestor kimi qorunur.
- Catalog `e17e792d8f5b6ce4c380a7ecb01589dac18f7c3ff81d1427b52fd8d296c5e76d`.
- Source writer open/generation0; GCP phase shadow; business timers disabled.

## Yalnız real build təsdiqindən sonra

İstifadəçinin həmin build üçün faktiki təsdiqinə istinadla approval qeyd edilir:

```bash
node azure-migration/google-cloud/post-approval-sync.mjs approve-build native-20261003t163726-4000073c "<istifadəçinin faktiki build təsdiqinə istinad>"
node azure-migration/google-cloud/post-approval-sync.mjs run
```

Approval exact APK/AAB/Store IPA SHA-larına bağlanır; dəyişmiş paket, başqa run,
bridge/catalog/parent və ya davam edən stream qəbul edilmir. Faylların öz baytları
da receipt-lərlə tutuşdurulur. Development IPA həmin iOS archive/assets-in ayrıca
cihaz-sınaq export-udur.

İlk `run` UUID-si terminal progress/state-də görünür. Davam və status:

```bash
node azure-migration/google-cloud/post-approval-sync.mjs status <sync-uuid>
node azure-migration/google-cloud/post-approval-sync.mjs run <eyni-sync-uuid>
```

Private inputs `azure-migration/provider-inputs/google-cloud/sync-runs/<uuid>/`,
receipts `azure-migration/ops/google-cloud-sync-runs/<uuid>/` altında saxlanır.
Yeni capture-dan əvvəl kifayət qədər lokal/target disk yeri və private backup
sağlamlığı yoxlanmalıdır; mövcud protected native/release qovluqları silinmir.

## Alətin gördüyü iş

1. Qəbul edilmiş warm receipt-dən target-private Source base checkpoint.
2. Eyni Source ancestor-dan resumable MVCC stream və closing delta.
3. Exact catalog/closure ilə target staging; təzə Google target before-image.
4. Three-way reconciliation, Auth identity/refresh/revocation rules, conflict review.
5. FK validation, rollback dry-run, compare-and-swap primary apply və durable receipt.
6. Tam data/identity yoxlaması; Source media fingerprint/hash cache; Google private
   Storage sync və HTTPS size/MIME/cache qəbulu. Writer/CDC guard-ları saxlanır.
7. Target-private shadow checkpoint və `shadow-sync-verified` receipt.

Primary before/after dəyişiklikləri `_anacan_sync_target.primary_changes`-dədir.
COMMIT cavabı itərsə, yalnız eyni Source closure və target snapshot-a aid completed
receipt ilə bərpa edilir. Plan əməliyyatları köhnə Google planner ilə eyni advisory
lock-u bölüşür. Qəbulsuz yeni Source parent/catalog-a kor-koranə keçilmir.

`conflict-review` çıxarsa, həmin run-un private report/plan-ı nəzərdən keçirilir;
yalnız explicit reviewed resolution-dan sonra eyni UUID ilə davam edilir. Köhnə
warm `reconcile.mjs plan`/`resolve-reviewed.mjs` əmrləri yeni run-a avtomatik həll
kimi tətbiq olunmur. Media failure-də eyni closure/cache saxlanır; lazımdırsa
`ANACAN_GCP_SYNC_RUN=<uuid>` ilə `source-media.mjs resume` işlədilir və eyni əsas run
davam etdirilir. Başqa run-un remote status-u qəbul sübutu sayılmır.

## Final handoff ayrıca koordinasiya edilir

Bu wrapper **Source → Google shadow** sinxronudur. Warm Azure restore-dan sonra
canlı Azure-da yaranmış Azure-only database/config/fayl dəyişikliklərini ayrıca
inventarlaşdırıb Google ilə reconcile etmək lazımdır; wrapper canlı Azure-nu
yenidən oxumur. Source accepted checkpoint/admission/DNS/provider/jobs sahibliyini
dəyişdirmir. `shadow-sync-verified` canlı keçid receipt-i deyil.

Final pəncərə üçün ardıcıllıq:

1. Dəqiq təsdiqlənmiş build, provider callback/webhook və signup/IP canary qəbulu;
   təzə Google backup və restore evidence.
2. Aktiv Azure-only dəyişikliklərin uzlaşdırılması; Source/provider job owner-ları
   üzrə vahid-writer freeze/drain pəncərəsinin razılaşdırılması.
3. Koordinasiyalı son Source delta/Auth/media qəbulu; boşalan outbox/lease-lərin və
   real session refresh/revocation-un yenidən yoxlanması. Source ancestor/receipt-lər
   reset/prune edilmir.
4. Final Source checkpoint qəbulunun Google receipt-i ilə bağlanması; target
   authority/admission manifestinin və tək provider/job sahibi üçün handoff-un
   hazırlanması. Managed admission köhnə canonical API-də vaxtından əvvəl
   yayımlanmır; aktivləşmə canonical Google endpoint-in qəbulu ilə koordinasiya edilir.
   Legacy Azure-pinned checkpoint CLI-si Google hostuna yönləndirilmir.
5. Operator qəbulundan sonra **istifadəçi** `api`/`app` DNS-i Google LB
   **34.49.16.103** ünvanına yönləndirir; TLS, Auth, realtime, private media və
   native Source→managed ilk refresh canlı canonical ünvanlarla yoxlanır.

Native logical managed realm hələ `azure` adlanır; fiziki Google hosting səbəbi ilə
enum/session namespace-ləri dəyişdirilmir. Google yeni production data/Auth refresh
aldıqdan sonra rollback ayrıca data/session reconciliation tələb edir.

Bu dated hazırlıqda Source və cron/worker-ləri owner idi.2026-10-07finalhandoff-dan
sonra Source sealed3/cron0 vəGoogleactive/8enabledtimer-dir. Yeni işlər həmincompleted
cutover və activecontinuity receipt-lərinə əsaslanır.

# Source → Azure: tam və təkrarlanan data sinxronu

## Tamamlanmış sinxron — 2026-09-16

**Database/Auth və storage sinxronu tamamlanıb, Source checkpoint-i qəbul edib.**

- Consistent Source sərhədi: **2026-09-16 07:21:12 UTC / 11:21:12 AZT**.
- Scope: `public`, `auth`, `storage`; **252 cədvəl, 2,138,253 Source sətri**.
- Azure primary dəyişiklikləri: **861,050 insert, 19,650 update, 1,752 delete**.
- **1,847 fayl / 3,095,087,788 byte** fiziki oxunuş/checksum ilə yoxlanıb.
  316 yeni və 15 dəyişmiş fayl köçürülüb; Azure-a məxsus 4 əlavə obyekt saxlanıb.
- Source user/session UUID coverage itkisizdir; refresh ID-ləri target-local
  sequence-ə bağlanıb, revoked tokenlər aktivləşdirilməyib. Source Auth `v2.197.0`,
  Azure Auth `v2.189.0`; target signer/configuration qorunub.
- SQL09–12, əlavə Azure sahələri, 85 calendar qaydası, follow/bookmark datası və
  runtime ayarları saxlanıb. Birləşmiş social counter-lər yenidən hesablanıb.
- 5 real data konflikti istifadəçinin **Source məlumatı** seçimi ilə həll edilib.
  İlkin Auth export-da sahibi çatışmadığına görə atlanmış 33 qeyd bərpa olunub.
- Private before-image, immutable change journal və 7 günlük Azure PITR mövcuddur.
- Source admission **`source`, generation 0**-dır. Data pre-sync tamamlanıb;
  mobile writer admission/store release ayrıca mərhələdir.

Qəbul: `azure-migration/ops/data-sync-receipt-8e22f4f9-23ed-49b6-9069-75c2793e3c83.json`.
SHA-256: `4f9ab4e5a19f4b30de66629f3f0978d625e74fe7e80e2ccef7faf2efe2d85c69`.
Pointer: `azure-migration/ops/data-sync-latest.json`.

### Növbəti istəyə bağlı delta

**2026-09-20 Source compatibility dəyişiklikləri sonrası:** Source catalog artıq
255 cədvəldir. Accepted `8e22f4f9-23ed-49b6-9069-75c2793e3c83` və pending
`755ec961-7566-42d7-8e34-fb94eec834e1` qorunub, amma step 7-dəki warm plan köhnə
catalog-a aiddir. Aşağıdakı normal pipeline əmri indi təhlükəsiz schema gate-də
`SOURCE_SCHEMA_EVOLUTION_REQUIRES_REPLAN` ilə dayanır. Direct `apply-plan` və
`checkpoint` CLI-ləri də eyni gate-i yoxlayır.

Cari read-only replan yoxlaması:

```sh
node azure-migration/sync/inspect-schema-replan.mjs
```

`schema-replan-1789926222392.json`: private before-image
`6f543333-7cc8-4b6d-be27-28a2f67d0c20`, köhnə export directory
`a2d1ed84-c3ec-469a-b54b-9881a0169e50` və pending chain saxlanır; pending primary run 0.
Yeni stream-in və target stage-in parent-i **pending `755ec961-…`** olmalıdır;
accepted `8e22f4f9-…` üçtərəfli merge bazası kimi qalır.

Replan üçün əvvəl private target before-image/plan/resolution/metadata və
`next-sync.json`-un dəyişməz arxivi hazırlanmalıdır. Sonra yeni linked stream +
closure, changed/new relation-lərin exact `replace` frame-ləri, yeni target
before-image və reconciliation/Auth/FK/storage planı tələb olunur. `base_rows`,
key/refresh mapping-lər və accepted receipt-lər qorunmalıdır. Tarixi 5 konflikt
təsdiqi yeni identity/data konfliktlərinə avtomatik tətbiq edilmir.
State-i silmək və ya step-i əllə azaltmaq qəbul olunmuş recovery yolu deyil;
`prepare-next-cycle.mjs` hazırda tələb etdiyi accepted-head şərtini ödəmir.
Yeni archived replan hazırlığı və Auth identity collision həlli hələ icra edilməyib.

[Source runtime müqaviləsi və quraşdırma sübutları](SOURCE_RUNTIME_COMPATIBILITY.md).

Schema replan tamamlandıqdan sonra normal on-demand pipeline:

```sh
node azure-migration/sync/sync-next.mjs
```

Bu komanda qəbul edilmiş checkpoint-dən yeni/dəyişmiş/silinmiş açarları stream
edir, kiçik closing delta ilə bağlayır, Azure before-image və merge planını yeniləyir,
DB/Auth/storage yoxlamalarından sonra yeni checkpoint saxlayır. Eyni komanda
yarımçıq işin mərhələsindən davam edir. Yeni real konflikt/schema problemi varsa
apply/checkpoint-dən qabaq dayanır; nəticə araşdırılıb davam etdirilməlidir.

Source timestamp-i davam nöqtəsidir, əməliyyatın bitdiyi divar saatı deyil. Bu
sərhəddən sonra işləyən Source-da yaranan məlumat növbəti deltaya daxil olacaq.
Cron/net/realtime/vault kimi provider-operational sxemlər Azure runtime ayarları
ilə kor-koranə əvəz edilmir; tətbiq chat/məlumat cədvəlləri `public` scope-dadır.
Source boş MFA/SCIM və platform migration metadata-sı private snapshot-da saxlanır;
başqa Auth runtime-nın migration ledger-i kimi tətbiq edilmir.

Ətraflı qəbul: [DATA-SYNC-2026-09-16](../azure-migration/ops/DATA-SYNC-2026-09-16.md).

## Tarixi hazırlıq və bərpa qeydləri

Aşağıdakı qeydlər hazırlıqda keçilən mərhələləri saxlayır. Cari nəticə və növbəti
operator əmri yuxarıdakı tamamlanmış sinxron bölməsindədir.

İstifadəçi bütün yeni database/Auth və storage məlumatlarını Azure-a köçürməyi,
sonrakı sinxronları isə son doğrulanmış davam nöqtəsindən aparmağı istəyib.
Source admin/DB bağlantısı bu mühitdə yoxdur; istifadəçi **SQL Editor** yolunu seçib.

Source körpüsü **quraşdırılıb və canlı preflight keçib**: 252 cədvəl,
`source-sync-preflight-1789533436970.json`, quraşdırma vaxtı
`2026-09-16T04:36:41.013916Z`. Bu hazırlıq mərhələsində bulk export/import və checkpoint hələ yox idi.
İlk böyük capture `503/PGRST002`, bərpadan sonrakı tək təkrar isə **53100 / disk_full**
qaytardı. Böyük capture təkrarlanmır: Source-da müvəqqəti tam surət bu həcmə uyğun deyil.
`sync/source-clear-failed-capture.sql` yalnız boş run vəziyyətində uğursuz staging
həcmini təmizlədi: Source database **1,145,449,619 byte**, staging **16,384 byte**,
primary key-siz cədvəl **0**. Read-only default üçün yalnız cleanup transaction-ı
`BEGIN READ WRITE` ilə açıldı. Stream + delta closure yolu hazırlanıb/test edilib.
Uğursuz `18b0407e-74dc-45e9-8b48-a346c3e38303` intent-i private
`source-sync-export/failed-capture-intent-18b0407e.json`-da saxlanır.
Bu uğursuz cəhddə tamamlanmış Source run və qəbul edilmiş checkpoint yox idi.
Əvvəlki export manifesti `2026-09-09T07:37:03.370Z` olaraq qalır.

Legacy database export RPC-si `404/PGRST202` qaytarır. Mövcud storage download
funksiyasından bir real fayl uğurla oxunub: yalnız ölçü/SHA-256 olan sübut
`azure-migration/ops/source-sync-access-1789503241552.json`-dadır.
Storage təkrar yoxlaması: `source-sync-access-1789505251826.json`. Əvvəlki preflight
`source-sync-preflight-1789505257414.json` Azure bağlantısını və SQL09–12 schema
əlamətlərini təsdiqləmiş, Source quraşdırılana qədər `404/PGRST202` qaytarmışdı.

Operator cəhdləri `auth.schema_migrations`, sonra `storage.buckets_vectors` və
`storage.vector_indexes` üçün icazə yoxlamasında dayanıb. Hazır SQL yenilənib:
bu cədvəllər və `storage.migrations` read-only hash snapshot ilə ixrac olunur. Köhnə editor
mətninin yerinə aşağıdakı faylın yenilənmiş tam məzmununu işlətmək lazımdır.

## Tamamlanmış birdəfəlik Source quraşdırması

İlkin bridge və diskə uyğun stream əlavəsi quraşdırılıb. İstifadə edilmiş fayl:
`azure-migration/provider-inputs/source-sync-stream-install.sql` Source SQL Editor-da
işlədilib; `source_stream_installation.streamInstalled = true` təsdiqi alınıb.
Bu əlavə Source-da tam data surəti yaratmır: yalnız cursor/hash receipt-lər saxlanır.
`databaseDefaultReadOnly` nəticəsi də Source-un disk müdafiəsi rejimini göstərir.

1. Köhnə Lovable/Supabase **`tntbjulojatnrqmylorp`** layihəsinin SQL Editor-unu açın.
2. Bu hazır faylın **tam məzmununu** orada işlədin:
    [`azure-migration/provider-inputs/source-sync-stream-install.sql`](../azure-migration/provider-inputs/source-sync-stream-install.sql).
3. Son nəticədə `source_stream_installation` altında `streamInstalled: true` görünməlidir.
   Bu təsdiq şəxsi data/credential ehtiva etmir. Agentə addımın tamamlandığını bildirin.

Quraşdırma şəxsi `_anacan_source_sync` sxemini, dəyişən açarları izləyən trigger-ləri
və məxfi başlıqla açılan `public.anacan_source_sync_v1` RPC-sini yaradır.
Mövcud tətbiq/Auth sətirlərinə DML etmir. Qısa DDL kilidi 5 saniyədə alınmasa
transaction geri qaytarılır; həmin hazır fayl yenidən işlədilə bilər.

`source-sync.json` lokal məxfi girişdir; çata və code arxivinə göndərilməməlidir.
SQL-də raw giriş açarı deyil, onun SHA-256 hash-i var. Hər iki fayl `0600`,
parent qovluq `0700` hüquqları ilə saxlanır. İcazənin müddəti hazırlanmadan 1 ildir.

Hazır faylı eyni girişlə yenidən yoxlamaq/yaratmaq:

```sh
node azure-migration/sync/prepare-source.mjs
node azure-migration/sync/prepare-stream.mjs
```

## Agentin quraşdırmadan sonrakı əmrləri

Repository kökündən:

```sh
node azure-migration/sync/preflight.mjs
node azure-migration/sync/export-stream.mjs
```

- Preflight Source körpüsünü, Azure read-only bağlantısını, SQL09–12 schema
  əlamətlərini və canlı source-first admission-u yoxlayır.
- İlk ixrac `public`, `auth`, `storage` cədvəllərini primary-key keyset səhifələri
  ilə birbaşa lokal private fayllara gətirir. Source-da sətirlərin ikinci tam surəti
  saxlanmır. Fayl yazılıb yoxlanandan sonra yalnız cursor/hash acknowledgement verilir.
- Başlanğıc watermark-dan sonra dəyişən/silinən açarlar son **REPEATABLE READ delta**
  ilə bağlanır. Tək stream baseline consistent snapshot deyil: ona closing delta
  tətbiq edilməli, yekun cədvəl sayları/PK coverage yoxlanmalıdır.
- Köhnə tam materialization əmri bu Source üçün bloklanıb (32 MiB-dən böyük
  baseline). Delta payload-u insert-dən qabaq yoxlanır: 32 MiB/100,000 sətir həddi;
  böyük table reset yenidən stream tələb edir. Auth sessions, refresh lineage/MFA
  və bucket/object metadata-sı əhatədədir.
- Sonrakı cədvəl dəyişiklikləri/silinmələri primary key üzrə toplanır. Snapshot
  davam nöqtəsi PostgreSQL transaction visibility-sidir; tarix və ya artan ID
  cutoff-u gec commit olunan transaction-ı ötürmür.
- Sonrakı stream son captured/accepted run-dan dəyişən açarları oxuyur; böyük
  delta da Source-da tam materializə edilmir. Son kiçik closing delta həmin
  axının vaxtında yaranan dəyişiklikləri bir consistent nöqtəyə bağlayır.
- İki qorunan platforma ledger-i (`auth.schema_migrations`, `storage.migrations`)
  üçün yalnız SELECT tələb olunur. Hər snapshot-da sıralanmış məzmun hash-i
  müqayisə edilir; dəyişməyibsə onların sətirləri təkrar ixrac edilmir.
  Dəyişiklik/silinmə varsa tam kiçik snapshot qaytarılır. Manifest bunları
  `captureMode: snapshot`, `targetUsage: platform-metadata` kimi işarələyir:
  Source versiya tarixçəsi arxivlənir, Azure Auth/Storage migration ledger-i üzərinə yazılmır.
- `storage.buckets_vectors` və `storage.vector_indexes` də SELECT-only hash
  snapshot istifadə edir; dəyişmiş metadata və silinmələr ixracda saxlanır.
  Bunlar `targetUsage: provider-storage` kimi işarələnir. Qeydlər varsa
  `requiresProviderStorageExport: true` olur: hosted vektorların payload-u
  PostgreSQL-dən kənardadır və ayrıca köçürülüb yoxlanmalıdır. SQL metadata
  ixracı bütün vektor bytes-ının köçürülməsi sayılmır.
- Keyless cədvəl dəyişibsə multiset kimi tam ixrac edilir; TRUNCATE table-reset
  marker-i yaradır. Azure-da `replace` strategiyası avtomatik `TRUNCATE` icazəsi deyil.
- Saxlanmış lokal səhifələr dəyişməzdir. Connection itərsə eyni komanda
  eyni stream ID və yoxlanmış səhifədən davam edir. Hash və cədvəl sayları yoxlanır.
- Raw PostgreSQL JSON `frameText` kimi saxlanır: böyük bigint/numeric dəyərlər
  JavaScript-də yenidən JSON-a çevrilərək yuvarlaqlaşdırılmır.
- Lokal çıxış private `provider-inputs/source-sync-stream/` altındadır; password
  hash/refresh token/user data ehtiva etdiyi üçün private-dir.

Yeni tam baseline `provider-inputs/source-sync-stream/` altındadır. Burada
definition, sıxılmış səhifələr, server page-chain receipt-ləri və closing delta
ayrılıqda yoxlanır. Source yalnız son delta sətirlərini müvəqqəti saxlayır.

Canlı Source storage-də fayl dəyişibsə, cari pending run-un ardınca yeni delta:

```sh
node azure-migration/sync/export-stream.mjs --next
```

Bu, hələ qəbul edilməmiş run zəncirini genişləndirir. `storage_state` RPC-si
download-dan əvvəl/sonra mövcud object version/metadata-nı yoxlamağa imkan verir.
Beləliklə fayl yenilənərkən köhnə run-u tələsik “tamamlandı” işarələmək lazım deyil.

## Azure apply və checkpoint-in tamamlanma şərti

**Hazır ixrac əmri Azure importer deyil.** Source quraşdırıldıqdan sonra alınan
real catalog/data üzrə aşağıdakı mərhələ icra edilməlidir:

1. Azure backup, Source/target schema və UUID/natural-key konflikt planı.
   Source SQL funksiyaları/RLS/provider ayarları kor-koranə target-a tətbiq edilmir.
   SQL09–12, 85 calendar notification düzəlişi, target-only social/story data,
   media URL-ləri və işlək Azure konfiqurasiyası qorunur.
2. Inserts/updates/deletes reconciliation, FK/trigger/counter və Auth uyğunluğu.
   `auth.refresh_tokens.id` target-local serial mapping tələb edir; token/session
   lineage saxlanır. Target signer və mövcud revocation/adoption vəziyyəti qorunur.
3. Storage bytes, bucket privacy/ownership, mövcud object versions və checksums.
   Source faylları canlıdır: metadata snapshot-ı onların bytes snapshot-ı deyil.
   Dəyişmiş/silinmiş fayllar əlavə delta ilə uzlaşdırılmalıdır.
4. Bütün tətbiq edilmiş run zənciri üçün doğrulanmış target receipt.
   Yalnız sonra `accept` əməliyyatı `baseRunId`, ardıcıl `runIds`, son manifest
   SHA-256 və target receipt SHA-256 ilə davam nöqtəsini irəlilədir.
   Ardınca `prune` yalnız həmin snapshot-da görünən köhnə dirty keys/pages-i silir.

Cədvəl/sütun/PK/partition quruluşundakı dəyişikliklər və itmiş/disabled capture
trigger-ləri yeni capture-ı dayandırır; həmin halda nəzərdən keçirilmiş baseline lazımdır. Source-da
trigger-ləri bypass edən inzibati import/DDL capture ilə paralel aparılmamalıdır.
Core scope-dan kənar relation-lar catalog-da ayrıca görünür; onların tətbiq datası
olub-olmadığı yoxlanmadan “bütün database köçürüldü” nəticəsi çıxarılmır.
Private dirty-key queue aralıq dəyişiklikləri saxladığı üçün Source disk istifadəsi
izlənməlidir; uğurlu checkpoint-dən sonra onun köhnə hissəsi təmizlənir.

Bu pre-sync store release/admission və ya writer cutover deyil. Son consistent
handoff/writer freeze qaydası [final sync planında](AZURE_FINAL_SYNC_AFTER_APPROVAL.md) qalır.

## Keçən yoxlamalar

```sh
node --test azure-migration/sync/contract.test.mjs azure-migration/sync/source-bridge.test.mjs azure-migration/sync/source-stream.test.mjs
```

31 yoxlama keçib: private ACL/header auth, adi app writer, real PostgreSQL
snapshot, gec commit + prune, PK dəyişməsi/silinmə, keyless/partition TRUNCATE,
Auth rotation, storage version, bigint/numeric dəqiqliyi, yarımçıq download,
itmiş capture response, hash corruption, pending chain/receipt, schema drift və expiry.
Müvəqqəti Unix-socket PostgreSQL 14.17 klasteri təmizlənib. Source-da RPC-nin canlı
qəbulu yalnız operatorun SQL addımından sonra yoxlanacaq.
Testdə `postgres` NOSUPERUSER/BYPASSRLS-dir; Auth/Storage cədvəllərinin sahibi ayrı
platforma rollarıdır. Qorunan ledger-lərə SELECT var, TRIGGER yoxdur. Bildirilən
42501 xətası təkrarlanıb; yeni installer və tam/delta ixrac həmin icazələrlə keçib.
Vektor cədvəllərində Supabase-in `0045-vector-buckets.sql` icazələri modelləşdirilib:
`anon`/`authenticated`/`service_role` rollarında yalnız SELECT, editor rolunda bu
icazənin inheritance-i, RLS və TRIGGER qadağası. Dolu/boş cədvəl, eyni sayla
metadata dəyişməsi, silinmə və çatışmayan SELECT ayrıca yoxlanıb. SELECT və TRIGGER
çatışmazlıqları artıq ayrı xəta kodları ilə qaytarılır.
Stream sınağı concurrent insert/update/delete/PK move/Auth rotation zamanı
baseline + closing delta-nın Source ilə tam bərabərliyini, itmiş ack-dən
filesystem resume-u və böyük baseline/delta üçün staging allocation-dan qabaq
capacity guard-ını yoxlayır. Komandaya `azure-migration/sync/source-stream.test.mjs`
də əlavə edilir.

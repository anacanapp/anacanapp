# Customer.io — davamlı avtomatik sinxronizasiya

2026-09-29 tələbi: **mövcud istifadəçilər və sonrakı dəyişikliklər avtomatik
Customer.io-ya getməlidir**. Əsas iş axını server sinxronizasiyasıdır.

**2026-09-30: canlı aktivdir.** İlkin14,728 hesabın hamısı Source və Customer.io
üzrə qarşılaşdırılıb. Gözləyən və xətalı qeyd0-dır. Dəqiqəlik server işi davam edir.

Sonrakı seqment genişlənməsi: **33 canlı dinamik seqment**, real tətbiq aktivliyi
və RevenueCat ilə yoxlanmış billing/trial tarixçəsi. Mənbə və nəticələr:
[CUSTOMERIO_SEGMENTS.md](CUSTOMERIO_SEGMENTS.md). Bu genişlənmə ayrıca Source runtime
və billing worker-i əlavə edir; aşağıdakı SQL34 qeydi ilkin sinxronizasiya tarixçəsidir.

## İş prinsipi

1. Quraşdırma mövcud Source Auth hesablarını davamlı növbəyə daxil edir.
2. Qeydiyyat və dəyişikliklər öz database transaction-ı daxilində növbəyə yazılır.
3. `anacan-customerio-source-sync` Azure Container Apps Job hər dəqiqə işləyir.
4. İşçi proses son profil vəziyyətini Customer.io EU API-yə göndərir; bir sorğu
   ən çox100 istifadəçi və64,000 UTF-8 baytdır.
5. Şəbəkə/API xətaları zamanı məlumat növbədə qalır və avtomatik təkrar sınanır.
   Gündəlik əlavə yoxlama itmiş növbə sətirlərini və dəyişiklikləri bərpa edir.

Tətbiqin açıq qalması, istifadəçinin yenidən login olması və ya kompüterin işləməsi
tələb olunmur. İlkin toplu ötürmə tamamlandıqdan sonra eyni xidmət davam edir.

### İzlənən məlumatlar

- `auth.users`: köhnə/yeni hesablar, e-poçt/telefon, qeydiyyat və son giriş,
  mənbədə saxlanılan şəxsi doğum tarixi, hesabın silinməsi;
- `profiles`: ad, avatar, ölkə, həyat mərhələsi, hamiləlik/uşaq/təqvim sahələri,
  onboarding tamamlanması, Premium və verified göstəriciləri;
- `user_preferences`: dil, bildiriş və məxfilik seçimləri;
- `user_children`: uşaqların məlumatları, aktiv uşaq və sahiblik dəyişiklikləri;
- `subscriptions`: son abunəliyin plan/status/başlama/bitmə/trial məlumatı;
- `user_roles`: hesab rolları.

Bu, hesabların cari vəziyyətini sinxronlaşdırır. Keçmiş alış/login hadisələri
uydurulmur. Mövcud SDK davranış/screen hadisələrinin razılıq müqaviləsi
`CUSTOMERIO_DATA_IN.md`-dədir. Uşağın doğum tarixi valideynin doğum tarixi kimi
göndərilmir. Şifrə, refresh/session token, ödəniş identifikatoru və yazışmalar
profil atributlarına daxil deyil. Customer.io unsubscribe/topic seçimləri sıfırlanmır.

## Etibarlılıq

- Auth UUID sabit Customer.io `userId`-dir; profil dəyişiklikləri həmin hesabı yeniləyir.
- Bir neçə dəyişiklik son vəziyyətdə birləşdirilir. Məzmun hash-i eynidirsə adi
  dəyişikliklərdə artıq HTTP çağırışı edilmir; cavabı itmiş ötürmələr və gündəlik
  bərpa yoxlaması cari vəziyyəti yenidən göndərir. Silinmə qeydləri də periodik
  bərpaya daxildir. Mənbədən silinən custom atributlar `null` ilə təmizlənir.
- Böyük ailələr Customer.io-nun1,000-bayt atribut limitinə uyğun hissələrə bölünür:
  `children`, `children_part_2` və davamı; `children_parts` hissə sayıdır,
  `children_count` bütün uşaqların sayıdır. Bütün dolu sahələr saxlanır; köhnəlmiş
  hissələr `null` ilə silinir. Eyni uşağın boş optional sahələri ötürmədə buraxılır.
- Global və istifadəçi üzrə lease paralel işlərin bir-birini keçməsinə mane olur.
  Köhnə cavab daha yeni dəyişiklikləri növbədən silə bilməz.
- Qəza sonrası ötürmə ən azı bir dəfə prinsipi ilə davam edir; sabit message ID-lər
  və UUID üzrə upsert təkrar cəhddə yeni istifadəçi yaratmır.
-400/413/422 alan batch bölünür ki, problemli profil digər hesabları saxlamasın.
  Böyük/etibarsız atribut görünən xəta ilə növbədə qalır.401/403,429 və5xx üçün
  gecikdirilmiş avtomatik təkrar var. Təkcə permissive HTTP200 uğur sayılmır.
- Hesab silinməsi `User Deleted` əmri ilə ötürülür; saxta davranış hadisəsi deyil.
- Customer.io mənbəsi dəyişəndə köhnə worker sorğuları dayandırılır və istifadəçilər
  yeni konfiqurasiya üçün yenidən növbələnir.

## Bir dəfəlik avtomatik aktivləşdirmə

**Cari yol Lovable OAuth-dur; ayrıca Supabase bağlantısı lazım deyil.**
Giriş və quraşdırma: [CUSTOMERIO_LOVABLE_CONNECTION.md](CUSTOMERIO_LOVABLE_CONNECTION.md).
Source quraşdırması2026-09-30 tarixində bu yolla tamamlanıb.

Customer.io üçün private `.env.customerio-sync.local` faylında:

```dotenv
CUSTOMERIO_CDP_WRITE_KEY=<Customer.io Pipelines API açarı>
CUSTOMERIO_SOURCE_ID=<bu açarın source ID-si>
```

Workspace224149, source93570 və EU region istifadə olunur. Hesab yoxlamasında əvvəlki
93520 istinadının yanlış olduğu və yerli köhnə açarın cari açarla uyğun gəlmədiyi
təsdiqləndi. Cari açar Customer.io OAuth ilə alınıb, strict HTTP200 və People
görünüşündə yoxlanıb. Lovable girişi avtomatik seçilir. Köhnə
operator bağlantıları üçün `SOURCE_DATABASE_URL`/`SUPABASE_ACCESS_TOKEN` dəstəyi
qalır, lakin cari Lovable yolunda onlara ehtiyac yoxdur.

```sh
node azure-migration/ops/customerio-sync.mjs activate
```

Bu komanda bağlantıları yoxlayır, eyni source-dan dəyişməz worker image-i hazırlayır,
Source runtime-ını Lovable bağlantısı ilə quraşdırır, server açarlarını Azure Key Vault-a
yerləşdirir, managed identity icazələrini bağlayır və dəqiqəlik işi aktivləşdirir.
İlkin ötürməni də özü başladır. İnsan tərəfindən istifadəçi məlumatı çıxarma/yükləmə
addımı yoxdur. Server worker-i üçün ayrıca Supabase service-role açarı tələb olunmur:
yalnız bu sinxronizasiya RPC-si üçün ayrıca təsadüfi server tokeni yaradılır.

Status: `node azure-migration/ops/customerio-sync.mjs status`.
`backfill_remaining=0` ilkin növbənin qəbulunu, `pending` sonrakı dəyişiklikləri,
`failed` və `last_error` təkrar gözləyən problemləri göstərir. Bunlar HTTP qəbul
göstəriciləridir. Qarşılaşdırma:
`node azure-migration/ops/customerio-destination-verification.mjs`.
Bu yoxlama yalnız profil və uşaq saylarını hesabatlandırır.

## Source/Azure müqaviləsi

Paylaşılan runtime: `azure-migration/sql/34-customerio-sync.sql`.
Source renderer: `azure-migration/source-compat/prepare-customerio-sync.mjs`.
Worker: `azure-migration/customerio-sync/`.

İki yeni relation — `customerio_sync_control` və `customerio_sync_queue` — Source
commit-indən əvvəl CDC və writer guard-a daxil edilir. Mövcud altı relation-ın
guard/capture vəziyyəti tələb olunur. Accepted/pending sync zənciri saxlanılır.
Source cron inventarına iş əlavə edilmir; scheduler Azure-da ayrıca idarə olunur.
Source writer bağlananda işçi dayanır. Sonrakı Azure data cutover-u ayrıca təsdiqlənən
əməliyyatdır; hazırkı worker Source istifadəçi məlumatlarına bağlıdır.

## Faktiki qəbul vəziyyəti

**Tam canlı qəbul —2026-09-30,06:37 UTC:**

- Lovable OAuth ilə Source quraşdırma girişi təsdiqlənib və runtime quraşdırılıb.
- **14 728 hesab** avtomatik ilkin növbəyə alınıb; canlı qeydiyyat/profil/silinmə
  sınağı keçib. Sınaq hesabının dəyişiklikləri geri qaytarılıb.
- **Customer.io-da14,728 profil** `sync_schema=anacan-customerio-sync-v1` və
  `data_source=source` ilə təsdiqlənib; Source hesab sayı ilə tam uyğun gəlir.
- İlkin növbə, gözləyən dəyişikliklər və xətalar **0**.
- Ən böyük5 ailədə uşaq sayları Source/Customer.io üzrə tam uyğun gəlir.20 obyektlik
  ayrıca sintetik JSON sınağının hamısı3 hissədə saxlanıb və sınaq atributları təmizlənib.
- Azure job: `anacan-customerio-source-sync`, schedule `* * * * *`.
- İşləyən immutable image:
  `anacanregistry.azurecr.io/customerio-sync@sha256:943b531803b3e5862b993be1df0f0c72ac1424efc2b2ce8a5b1c9cb121ef0ea4`.
- Source runtime hash-i dəyişməyib:
  `f9f1a7c20cbc963c8b0b92d479611b069b0b8cbcf2807ddfa66596281df802dd`.

Yoxlama: `azure-migration/ops/customerio-sync-preflight.json`.
Quraşdırma sübutu: `customerio-sync-source-installed.json`;
canlı sınaq: `customerio-sync-source-canary.json`.
Qəbul: `customerio-sync-activation.json`, `customerio-sync-backfill.json`,
`customerio-destination-verification.json`, `customerio-source-key.json`,
`customerio-json-probe.json` və `customerio-sync-status.json`.
Private açarlar və istifadəçi məlumatları hesabatlara daxil edilmir.

Testlər:

2026-09-30 tarixində **31 SQL/CDC/worker/deployment testi** və OAuth/MCP körpüsünün
**11 testi** uğurla keçib. Bunlara real Source və Customer.io yoxlamaları əlavədir.

```sh
node --test azure-migration/source-compat/customerio-sync.test.mjs azure-migration/customerio-sync/protocol.test.mjs azure-migration/customerio-sync/deployment.test.mjs
```

Real disposable PostgreSQL üzərində Source sync/CDC/writer guard, ilkin ötürmə,
dəyişikliklər, silinmə, lease/crash recovery, HTTP xətaları və deployment müqaviləsi
yoxlanır. HTTP hissəsində sintetik provider cavabları istifadə edilir.

# Source / Supabase — followup37 təhvili

**2026-09-30 yeniləməsi:** followup37 və prerequisite-ləri Source-da quraşdırılıb;
Premium cancellation/expiry/account-scope/30s lease canlı qəbuldan keçib. Edge
functions release43 paketi ilə yenilənib. [Cari status](RELEASE_43_SOURCE.md).

Bu dəyişikliklər eyni Azure tətbiqinin Source-first uyğunluğudur. Source operator
qəbulu açıqdır; generated fayl və ZIP quraşdırılma sübutu deyil.

## SQL sırası

Əvvəl [SUPABASE_FOLLOWUP_36.md](SUPABASE_FOLLOWUP_36.md)-dəki 1–10 sırasını tamamlayın.
Artıq qəbul edilmiş runtime-lərin version/hash receipt-lərini dəyişdirməyin.
Hər pending schema installer əvvəlki DDL-dən sonra yenidən generate edilməlidir.
Sonra:

```sh
node azure-migration/source-compat/prepare-followup37.mjs
```

Source SQL Editor-da **tam**
`azure-migration/source-compat/RUN_SOURCE_FOLLOWUP37_INSTALL.sql` faylını icra edin.
`azure-migration/sql/31-premium-blog-continuity.sql` Azure üçündür; Source wrapper-i
catalog/CDC/writer/receipt yoxlamalarını da ehtiva edir.

- Bir nullable `community_posts.blog_post_id` sütunu; yeni relation və cron yoxdur.
- Mövcud `community_posts`, `profiles`, `subscriptions`, `blog_posts` CDC/writer
  enrollment-i tələb edilir; accepted/pending chain və writer generation qorunur.
- Subscription row authoritative-dir. Bitmiş/refund edilmiş row-u köhnə
  `profiles.is_premium` yenidən aktiv etmir. Müddəti gələcək cancelled subscription
  vaxtı bitənədək aktivdir; cancelled + tarixsiz row aktiv sayılmır.
- `get_premium_access_v1()` cari istifadəçi və qarşılıqlı bağlı ailə üzvü üçün
  30 saniyəlik grant qaytarır. Normal istifadəçi başqa hesabı sorğulaya bilməz.
- Blog search/reference yalnız published və istifadəçinin ölkəsinə görünən məqalələri
  qaytarır. Title/excerpt və axtarış article reader-in dil qaydasına uyğundur.
- Mommy period qeydləri mövcud SQL09 `record_period_days` axınından istifadə edir;
  əsas `life_stage`, hamiləlik tarixləri və profil cycle anchors dəyişmir.

## Source Edge Functions

SQL qəbulundan sonra eyni adlı funksiyaları hazırlamaq üçün:

```sh
node azure-migration/source-compat/prepare-followup37-functions.mjs
```

- Yenilənmiş14 funksiya: `azure-migration/source-compat/localization21-functions/*.ts`.
- Əlavə2 funksiya:
  `azure-migration/source-compat/followup37-functions/sync-revenuecat-entitlement.ts`
  və `azure-migration/source-compat/followup37-functions/revenuecat-webhook.ts`.
- Dəqiq ad/hash siyahısı: `azure-migration/ops/followup37-source-functions.json`.
- Əvvəlki admin2 funksiya da birləşdirilmiş ZIP-dədir. Cəmi **18 Source function**.
- Provider secrets və RevenueCat webhook Authorization konfiqurasiyası mövcud
  operator secret references-dən istifadə edir; ZIP sirr daşımır. Client sync real
  user auth tələb edir; webhook öz ayrıca secret yoxlamasını saxlayır.
- Refund current purchase-a aiddirsə gələcək expiry/grace Premium saxlamır;
  refund-dan sonrakı yeni purchase ayrıca tanınır. Uğursuz DB write activation
  uğuru kimi qaytarılmır. Server AI quota reader cari access RPC-ni istifadə edir.

## Qəbul və native asılılığı

- `get_followup37_contract_v1()` → `anacan-followup37-v1`, `premiumLeaseSeconds:30`.
- Öz hesabı ilə `get_premium_access_v1()`; başqa hesabla normal auth → denied.
- Cancelled müddət/expiry/refund/household, published/country-visible blog reference,
  dil fallback/search və Mommy profilinin qorunması disposable SQL testlərində keçir.
- `assert_catalog()`/writer/accepted/pending vəziyyəti install öncəsi ilə uyğun qalır.
- Yeni40.0 native namizədi **Source-first** olduğuna görə bu SQL/function qəbulu
  vacibdir. RPC mövcud olmadıqda client köhnə Premium cache-nə arxalanmır; paid
  alətlər bağlanır və yeni blog axtarışı işləməz. Qəbulsuz namizədi tam funksional
  production yeniləməsi kimi yaymayın.

## Paket

`azure-migration/handoffs/SOURCE_FOLLOWUP37_LATEST.json` → verified ZIP/hash.
Paket əvvəlki299 data batch daxil **309 SQL /18 function**, əvvəlki və yeni sıra
sənədlərini və hash manifestlərini birləşdirir. Generatorlar hazır repo/full code
handoff-dan işlədilir; private Source bridge inputs daxil edilmir.

Azure/nəticələr: [FOLLOWUP_37.md](FOLLOWUP_37.md).
Native namizəd: [NATIVE_40.md](NATIVE_40.md).

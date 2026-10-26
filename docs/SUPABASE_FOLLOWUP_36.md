# Supabase / Source — 21 dil və followup36 SQL təhvili

**2026-09-30 yeniləməsi:** aşağıdakı Source schema/data sırası release43 üçün
Lovable OAuth/MCP ilə quraşdırılıb və yoxlanıb. Cari receipt-lər və native qəbul:
[RELEASE_43_SOURCE.md](RELEASE_43_SOURCE.md). Aşağıdakı sıra tarixi/reproduction
müqaviləsidir; qəbul edilmiş köhnə installer-ləri sonrakı catalog üzərində yenidən
icra etmək olmaz.

Bu fayldakı yollar repo kökünə nisbidir. Məqsəd eyni tətbiq kodunun Source-da
uyğun işləməsidir. Source operator qəbulu ayrıca aparılır; aşağıdakı faylların
hazırlanması onların Source-da quraşdırıldığı demək deyil.

SQL/Source Functions ZIP pointer-i:
`azure-migration/handoffs/SOURCE_FOLLOWUP36_LATEST.json`.
Paket308 SQL faylı (299 əvvəlki data hissəsi +9 schema/data faylı),16 Source function,
ardıcıllıq və hash manifestlərini bir yerdə saxlayır. Generator əmrləri hazır repo /
full code handoff-dan işlədilir; private Source bridge inputs ZIP-ə daxil edilmir.

## Quraşdırma ardıcıllığı

Hər **schema installer** əvvəlki DDL tətbiq olunduqdan sonra cari Source catalog-a
yenidən bağlanmalıdır. Generate əmri yalnız SQL hazırlayır; əmrdən sonra göstərilən
tam SQL faylı Source SQL Editor-da icra olunur. Artıq quraşdırılmış runtime-in
version/hash receipt-i dəyişdirilmir. Açıq sync stream varsa wrapper onu bildirir;
accepted/pending run chain və writer generation qorunmalıdır.

| Sıra | Generate əmri | Source SQL Editor-da icra edilən fayl |
|---|---|---|
| 1 | `node azure-migration/source-compat/prepare-localization21.mjs` | `azure-migration/source-compat/RUN_SOURCE_LOCALIZATION_21_INSTALL.sql` |
| 2 | Hazır, manifest-pinned data | `azure-migration/source-compat/localization21-data/LOCALIZATION_DATA_001.sql` … manifestdəki son hissə; **299 fayl**, ad sırası ilə |
| 3 | `node azure-migration/source-compat/prepare-admin-console21.mjs` | `azure-migration/source-compat/RUN_ADMIN_CONSOLE_21_INSTALL.sql` |
| 4 | `node azure-migration/source-compat/prepare-regional21.mjs` | `azure-migration/source-compat/RUN_SOURCE_REGIONAL21_INSTALL.sql` |
| 5 | Hazır reviewed data | `azure-migration/source-compat/REGIONAL21_HEALTHCARE_DATA.sql` |
| 6 | Hazır reviewed data | `azure-migration/source-compat/REGIONAL21_VACCINE_DATA.sql` |
| 7 | `node azure-migration/source-compat/prepare-community-language.mjs` | `azure-migration/source-compat/RUN_SOURCE_COMMUNITY_LANGUAGE_INSTALL.sql` |
| 8 | `node azure-migration/source-compat/prepare-followup36.mjs` | `azure-migration/source-compat/RUN_SOURCE_FOLLOWUP36_INSTALL.sql` |
| 9 | Hazır source-bound data | `azure-migration/source-compat/FOLLOWUP36_CONTENT_DATA.sql` |
| 10 | Hazır insert-only data | `azure-migration/source-compat/FOLLOWUP36_NAMES_DATA.sql` |

SQL24–30 Azure fayllarıdır. Source üçün cədvəldəki generated wrapper-lər
catalog, CDC/writer enrollment və receipt yoxlamalarını da ehtiva edir.
Schema dəyişiklikləri arasında köhnə catalog-a pinned faylları ardıcıl icra etmək
əvəzinə, göstərilən növbəti generate əmri işlədilir.

Data manifesti: `azure-migration/source-compat/localization21-data/manifest.json`.
Source və Azure-nin 9 exercise /34 phase-tip mənbə tuple-ləri followup36 hazırlığında
tutuşdurulub. Non-empty operator tərcümələri saxlanır. Gürcü `steps_ka` sütununun
mövcud `text[]` tipi dəyişdirilmir; digər yeni steps sütunları nullable `jsonb`-dir.

## Yeni followup SQL nə edir?

- Kegel/exercise ad, təsvir və addımları; menstrual faza başlıq və mətnləri —21 dil.
- `user_children.vaccine_country_code`: ayrıca, təsdiqlənmiş vaksin proqramı seçimi.
  İlkin seçim hesab ölkəsidir. Uşağın baza ölkəsi və vurulmuş vaksin tarixçəsi dəyişmir.
- `user_roles.show_admin_badge` və `set_admin_badge_visibility_v1`: yalnız adminin
  idarə etdiyi görünən etiket. Real admin/moderator və link paylaşma hüquqları saxlanır.
- Official blog keçidləri normal istifadəçi şərhlərində də paylaşılır; başqa
  xarici linklərin mövcud staff-only qaydası saxlanır.
- 12 yeni dil/ölkə kataloquna hərəsində140, cəmi1680 ad. Mənası və populyarlığı
  uydurulmur. MIT attribution: `followup36-name-sources/LICENSE.faker.txt`.

## Edge Functions və frontend

SQL-dən sonra eyni adlı Source Edge Functions üçün hazır single-file paket:

```sh
node azure-migration/source-compat/prepare-localization-functions.mjs --wave=21
```

- Fayllar: `azure-migration/source-compat/localization21-functions/*.ts` —14 funksiya.
- Hash siyahısı: `azure-migration/ops/localization21-source-functions.json`.
- `baby-insight` optional `section` ilə bir bölməni analiz edir; köhnə clientin
  all-three sorğusu dəstəklənir. Limit bir dəfə serverdə sayılır; yeni client yalnız oxuyur.
- Admin console-un əlavə iki Source function-u:
  `azure-migration/source-compat/ADMIN_NOTIFICATION_DISPATCH_SOURCE.ts` və
  `azure-migration/source-compat/ADMIN_REVENUE_METRICS_SOURCE.ts`.
  Provider secret references mövcud operator konfiqurasiyasından istifadə edir.

Onboarding/profil mətnləri, klaviatura, paylaşım pəncərəsi, media lease yenilənməsi,
su halqası, 21-dil nağıl formu və ölkəyə uyğun dekret qaydaları frontend bundle-dədir.
Dekret qaydaları `src/data/maternity-regional.json` və onun source/hash sübutundadır;
bu kalkulyator üçün şəxsi məlumat cədvəlinə yeni yazı əlavə olunmur.

Yeni12 `app_languages` server sətri legacy clientlər üçün inactive qalır; yeni
bundle 21 dili öz registry-si ilə göstərir. Native39 arxivləri ayrıca finalized-dir.
Sonrakı native namizəd bu SQL/function qəbulundan sonra yeni izolə workspace-də hazırlanır.

## Qəbul

- `get_localization_contract_v1()` —21 dil.
- `get_regional_catalog_contract_v1()` — civil-calendar vaksin müqaviləsi.
- `get_followup36_contract_v1()` — exercise steps, badge visibility və vaccine override.
- Hər12 yeni name collection ən az100 aktiv ada malikdir; reviewed import hərəsinə140 əlavə edir.
- Source `assert_catalog()`/writer status, accepted/pending lineage və generation qorunur.
- Source SQL davranışı disposable PostgreSQL testlərində yoxlanıb; canlı Source
  qəbulu operator tərəfindən ayrıca təsdiqlənməlidir.

Azure buraxılışı və qəbul sübutları: [FOLLOWUP_36.md](FOLLOWUP_36.md).

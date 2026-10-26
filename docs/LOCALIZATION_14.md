# Anacan — 14 dil müqaviləsi

2026-09-24-də [21 dil buraxılışı](LOCALIZATION_21.md) yayımlanıb. Cari Source
operator faylları localization v2/admin v3-dür; aşağıdakı14-dil sübutları əvvəlki
buraxılışın tarixçəsidir.

## Dillər

Mövcud Azərbaycan, İngilis, Türk, Rus, Alman, Ərəb, Gürcü, Qazax və Özbək
dillərinə beş dil əlavə olunur:

| Kod | Dil | Format locale-i |
| --- | --- | --- |
| `zh` | Mandarin Çin — sadələşdirilmiş yazı | `zh-CN` |
| `id` | İndoneziya | `id-ID` |
| `fr` | Fransız | `fr-FR` |
| `es` | İspan | `es-ES` |
| `pt` | Avropa Portuqalcası | `pt-PT` |

Dil hesabın ölkəsini dəyişmir. Regionlu dil kodları tətbiqin qısa koduna
normallaşdırılır. Ərəb dilinin RTL və Qriqorian təqvim davranışı saxlanır.

## Yayımlanmış Azure təhvili — 2026-09-23

- Əsas UI paketləri: hər yeni dildə **11 389 açar**. Onboarding, çat/qruplar,
  Color Sort, Premium, admin və serverin sabit bildiriş/xəta mətnləri daxildir.
- Public məzmun inventarı: Azure və Source üzərində **110 relation**, **11 110
  unikal mətn**, **14 290 mənbəyə bağlı sahə variantı**. Bütün beş paket tamamlanıb,
  strukturu və mənbə uyğunluğu yoxlanıb; `localization-content-progress.json` complete-dir.
- Azure-da SQL26 quraşdırılıb: **110 cədvəldə 1 130 nullable dil sütunu**, 14 dilli
  admin/notification filter və community post translation cache müqaviləsi.
- Functions **`anacan-functions--0000009`**, ACR **cb1h**:
  `sha256:6a9ab0f16b0d7f3fd53093054dc044070657cc78397af75859fccdfbb57361b4`.
  Mövcud **23 aktiv route**, gate-lər və secret references qorunub.
- Web gateway **v32 / `anacan-gateway--0000030`**, ACR **cb1j**:
  `sha256:26b665d17bb2fd39c3bd9c11b9275a33907d70950f4e1406c50b4919e30fddb6`.
  Beş dildə ilk seçim, ölkə, onboarding, admin və public məzmun həm local, həm
  yayımlanmış bundle-da 320/390/768/1440px yoxlanıb. Bütün 10 yeni locale chunk-ı
  hər iki gateway ünvanında byte/hash ilə təsdiqlənib.
- Azure məzmunu 236 idempotent SQL hissəsi ilə tamamlanıb: **13 974 uyğun sahə-sətir**
  yenilənib. Mövcud operator tərcümələri və mənbəsi dəyişmiş sətirlər əvəz edilməyib.
- Hər beş dil canlı Azure Auth ilə yoxlanılıb: admin filter, public UI cümləsinin
  tərcüməsi və lokallaşdırılmış self-diagnostic inbox mətni. Fixture cihazı yoxdur,
  real FCM recipient **0**, hesab təmizlənib.
- Native 39.0 Store/development paketləri bu işi daşımır; native təhvil yeni izolə
  workspace/build ilə edilir. Bu sənəd native Store publication təsdiqi deyil.

## Offline və Source uyğunluğu

`src/lib/app-languages.ts` bu build-in dəstəklədiyi dil siyahısıdır. Yeni beş
`app_languages` sətri qəsdən **`is_active=false`** saxlanır: köhnə klientlər
`is_active=true` siyahısını oxuyur və bu dillərin onboarding/seed müqaviləsini
daşımır. Yeni bundle registry-si bütün 14 dili təqdim edir. Bu, artıq tətbiq
olunan TR/RU rollout davranışını davam etdirir; `disabled_tools` serverdən gəlir.

İlk dil ekranının mətnləri və bayraqları lokal paketdədir. Seçilmiş UI və content
chunk-ları React ekranlarından əvvəl hazır olur; tərcümə DB-si overlay üçündür.
Əvvəlki versiyanın böyük localStorage keşi yeni açarların yüklənməsini dayandırmır.
Cache yazıları auth/session/pin/draft məlumatlarını sıxışdırmır.

Public content fallback-i `id + field + SHA-256(base, _az, _en)` ilə bağlanır.
Source-un köhnə sxemində yeni dil sütunu olmasa da həmin mətnin paket tərcüməsi
göstərilə bilir. Mənbə dəyişibsə köhnə variant istifadə edilmir. Serverdə mövcud
lokallaşdırılmış dəyər üstün qalır. Array/JSON tipləri, score/status kodları və
uzun mətnlərin paraqraf sərhədləri saxlanır.

Kompilyasiya zamanı `scripts/i18n/inline-localization.mjs` yalnız literal JSX
mətnlərini, display/aria prop-larını, göstərilən şablonları və toast mətnlərini
`tr()` çağırışlarına çevirir. Data value/ID, event serialization, istifadəçi
mesajı və kod blokları dəyişdirilmir. Extractor və Vite/Vitest eyni analizdən
istifadə edir. Display tarixləri seçilmiş locale ilə formatlanır.

## Tərcümə və qəbul alətləri

```sh
node azure-migration/scripts/localization-expansion.mjs --inventory
node azure-migration/ops/run-localization-job.mjs --start ui
node azure-migration/ops/run-localization-job.mjs --start content
node azure-migration/scripts/localization-expansion.mjs --audit
node azure-migration/scripts/localization-expansion.mjs --audit-content
node azure-migration/scripts/localization-expansion.mjs --finalize-server
node azure-migration/scripts/localization-expansion.mjs --finalize-bundles
node scripts/i18n/verify-bundles.mjs
```

Provider konfiqurasiyası mövcud private `scripts/content-i18n/.env.azure`-dan
oxunur. Checkpoint-lər source hash ilə resumable-dır; paralel yazılar serialize
olunur, worker heap-i 512 MB ilə məhdudlaşdırılır. Parol/key və şəxsi sağlamlıq
qeydləri tərcümə inventarına daxil edilmir. Public export hər iki backend-in
anon-read siyasəti ilə, təsdiqlənmiş cədvəl/sahə siyahısı üzərindən aparılıb.

Placeholders, saylar, linklər, HTML tag-ları və struktur yoxlanılır. Çin ay
qısaltmaları/trimester adları üçün `localization-overrides.json` mənbəyə dəqiq
bağlanmış terminoloji istisnaları saxlayır. Qiymət/trial müqaviləsi yeni təklif
yaratmır: store qiymətləri yenə mağazadan gəlir.

`translation-manifest.json` bütün beş UI/content faylının byte/hash və key-set
qəbulunu saxlayır. Azure və yeni native build alətləri həmin qəbul olmadan build-i
dayandırır. Source-bound public fixture-lər browser qəbulunda istifadə olunur.

## Source operator addımları

Source quraşdırılması **hələ qəbul edilməyib**. Hazır sxem faylı:
`azure-migration/source-compat/RUN_SOURCE_LOCALIZATION_INSTALL.sql`.
Runtime SQL hash:
`31f9f8ef635001c652deccf8dcd3cddf26fbd4cae475598ca6b1bd70a1644603`.

1. Quraşdırmadan əvvəl `node azure-migration/source-compat/prepare-localization.mjs`
   ilə cari catalog-a bağlanmış faylı yaradın və tam generated faylı SQL Editor-da
   icra edin. AdMob installer-i və ya raw SQL template-i istifadə edilmir.
2. `prepare-localization-data.mjs` ilə yaradılmış 236 manifestlə hash-lənmiş
   `source-compat/localization-data/LOCALIZATION_DATA_*.sql` hissəsi hazırdır.
   Hissələr exact-source match və `COALESCE` ilə mövcud operator tərcüməsini
   əvəz etmir; yarımçıq icra təkrar edilə bilər.
3. `source-compat/localization-functions/` içindəki 14 single-file Edge Function
   eyni adlı Source function-a operator tərəfindən yerləşdirilir. Fayl/hash siyahısı:
   `ops/localization-source-functions.json`. Mövcud server secret references istifadə
   edilir. Handler-lərin real Auth/role/visibility yoxlamaları saxlanır.
4. Admin console installer-i ayrıca **`source-admin-console-v2`**-dir və 14 dili
   qəbul edir. İki sxem installer-i catalog-a pinlidir: birini quraşdırdıqdan sonra
   digərini öz prepare skripti ilə **yenidən yaradın**. Eyni köhnə catalog-a bağlı
   iki faylı ardıcıl kor-koranə icra etməyin.

Localization yeni data relation/cron yaratmır. Dəyişən relation-lar commit-dən
əvvəl CDC və writer guarding-ə yenidən daxil edilir. Accepted/pending, receipt
zənciri və open/generation0 qorunur; frozen Source quraşdırma/yazını rədd edir.
Bu, population/Auth/data cutover deyil. AdMob-un installed runtime hash-i dəyişmir.

## Yoxlamalar

- **93 fayl / 985 app testi**, hər iki TypeScript layihəsi.
- **24 yeni dil/cache testi**, 6 compile-time i18n/DOM testi.
- **6 PostgreSQL/Source testi**: bütün 1 130 sütun, replay, 14 dil, view options və
  private-column sərhədi, exact-source data updates, existing override və freeze.
- **32 push/admin worker testi**: real handler + disposable SQL; 14 dildə server
  bildiriş mətnləri, user-written mesajların qorunması, claim/opt-out/receipt.
- **35 router/packaging/admin SQL testi**, 2 translation assembly testi.
- Canlı API: `ops/localization-api-*.json`; Source son probe:
  `ops/admin-console-source-1790190218389.json` (`404 / PGRST202`).
- Local browser: `ops/localization-web-1790195191369.json`; deployed browser:
  `ops/localization-web-1790195504153.json` — hərəsi beş dildə 15 qəbul qrupu.
- Yayımlanmış locale chunk-ları: `ops/localization-assets-1790195434251.json`
  (20 byte/hash müqayisəsi); ümumi entry/health/gates:
  `ops/web-artifact-1790195434399.json` (6 asset, 4 health, 10 gate).
- Azure schema/data: `ops/localization-schema-azure-1790191200759.json`,
  `ops/localization-data-azure-1790194856008.json`.
- Admission yenidən oxunub: `source / generation 0`, minimum native28.0,
  handoff hash null. Language release population/data cutover-u elan etmir.

Son browser, deployment və məzmun qəbulunun hesabatları `ops/localization-*.json`,
credential-free təhvil isə `handoffs/LATEST.json` / `VERIFIED.json` ilə göstərilir.

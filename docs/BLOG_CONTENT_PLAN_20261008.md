# Kontent planı — ilk üç məqalə, 2026-10-08

**Sonrakı davam:** əlavə9məqalə21dildə qəbul edilib; planın12mövzusu hazırdır,
16mövzu qalır. Cari pointer vənext14/15/16:
[Doqquzluğun təhvili](BLOG_CONTENT_PLAN_NINE_20261009.md). Aşağıdakı ilk3receipt-lər
tarixi və dəyişməzdir.

**İlk üç məqalə Google bloqunda yayımlanıb və bütün 21 dildə yoxlanılıb.**
CSV planında 28 dolu mövzu və bir boş sətir var. Bu təhvil yalnız sıra **1, 2, 3**
üçündür. Qalan 25 mövzu üçün istifadəçinin növbəti **“davam et”** göstərişi gözlənilir.

## Canlı məqalələr

| FAQ | Məqalə | Azərbaycan dilində keçid |
|---|---|---|
| FAQ015 | Ürəkbulanma və qusma olmadan hamiləlik keçirmək normaldırmı? | [Oxu](https://anacan.az/az/urekbulanma-ve-qusma-olmadan-hamilelik-kecirmek-normaldirmi/) |
| FAQ016 | Ürəkbulanma və digər əlamətlərin birdən azalması nə deməkdir? | [Oxu](https://anacan.az/az/urekbulanma-ve-diger-elametlerin-birden-azalmasi-ne-demekdir/) |
| FAQ009 | USM-də döl kisəsi görünür, embrion görünmür: bu nə deməkdir? | [Oxu](https://anacan.az/az/usm-de-dol-kisesi-gorunur-embrion-gorunmur-bu-ne-demekdir/) |

Sabit tətbiqdaxili slug-lar:

- `urekbulanma-qusma-olmadan-hamilelik`
- `hamilelik-elametlerinin-birden-azalmasi`
- `usm-dol-kisesi-var-embrion-gorunmur`

Marketinq permalink-ləri `editorial_metadata.website.slugs` daxilində 21 dil üçün
saxlanılıb. Tətbiqdaxili reader mövcud Google cədvəlindən eyni məqalələri oxuyur.

## Mətn, mənbələr və şəkillər

- **3 məqalə × 21 dil = 63 tam versiya**. Başlıq, mətn, FAQ, SEO, tag, alt,
  caption və mənbə başlıqları lokallaşdırılıb; English fallback təhvil sayılmır.
- Azərbaycan mətnlərində müvafiq olaraq **8, 8, 10 bölmə**, təxminən
  **877, 925, 1 156 söz**, ayrıca **5, 6, 6 FAQ** var.
- NHS, RCOG və NICE-in **7 mənbəsi** oxunub. NICE NG126-nın 17 iyun 2026
  yenilənməsindəki faktiki diaqnostika bölməsi istifadə edilib.
- Redaksiya və mənbə–tərcümə yoxlaması aparılıb. Model auditinin qeydləri real
  saxlanmış mətnlə müqayisə edilib; yanlış “itmiş mətn” iddiaları ayrıca
  adjudication ilə qeydə alınıb, həqiqi tərcümə səhvləri düzəldilib.
- Mətnlər simptomların olmaması/azalmasını diaqnoz kimi təqdim etmir. Erkən USM
  qeyri-müəyyənliyi, üsul/ölçü, minimum təkrar interval, yeni əlamətlərdə müraciət
  və praktik qəbul sualları izah edilir. İnsan həkim təsdiqi/reviewer uydurulmayıb.
- **3 featured + 6 məqalədaxili şəkil**, cəmi **358 558 bayt WebP**.
  Featured **1200×630**, inline **1200×675**, localized alt/caption və lazy loading.
- Şəkillər süni intellektlə yaradılmış, uydurma şəxsləri göstərən redaksiya
  fotolarıdır. Həqiqi diaqnostik USM görüntüsü kimi təqdim edilmir. Erkən
  hamiləlik mövzusuna uyğun crop və təbii anatomiya vizual yoxlanılıb.
- Media mövcud public `assets` bucket-inin
  `editorial/content-plan-20261008/` yolundadır; hər fayl hash-named-dir.

## Google nəşri və yoxlama

Google active project `ninth-park-492111-m4`, database `anacan` istifadə edilib.
Yeni relation və ya DDL tələb olunmayıb. Mövcud guarded `blog_posts`,
`blog_post_categories`, `storage.objects` üzərindən iş görülüb.

- Scope-bound/idempotent publication: üç sabit UUID, **6 category relation**,
  əvvəlcə rollback olunan transaction sınağı, sonra verified COMMIT.
- Published bloq sayı **75 → 78**; marketinq article sitemap **1 575 → 1 638**.
- **63 HTML**, **63 marketinq browser məqaləsi**, **63 anonymous API locale**:
  tam mətn, şəkil/caption, görünən FAQ və FAQ schema uyğunluğu, canonical,
  22 hreflang/x-default, OG/Twitter, mənbələr və sitemap keçib.
- **320/390/768/1440px**, Arabic RTL, mündəricat/FAQ açılışı, jurnal axtarışı və
  tərcümə olunmuş permalink ilə dil dəyişmə yoxlanılıb. Public oxu consumer
  Auth/brand session-u yaratmır.
- **63 tətbiqdaxili məqalə** serverdə yoxlanmış owned-admin web preview-də
  açılıb: tam localized body, 3 şəkil/məqalə, alt/caption, FAQ və mənbələr keçir.
  Bəyənmə, saxlama, şərh persistence və Təqvimə keçid də qəbul edilib.
- Tətbiqdaxili qəbul mövcud web UI/Google reader testidir; fiziki iOS/Android
  Store package qəbulu kimi qeyd edilmir.
- Owned sınaq hesabları, şəxsi preference-ləri və yaratdıqları outbox qalıqları
  təmizlənib. Yekun user/residual count **0**.
- Əvvəlki 75 məqalənin mətn/metaməlumat hash-ləri, əvvəlki category relation-lar
  və migration control eyni qalıb. Source sealed3/cron0 və active Google
  authority müqaviləsi qüvvədədir.

## Receipt və davam nöqtəsi

Ignored operator workspace: `azure-migration/blog-plan/`.

- Batch: `anacan-content-plan-batch-1-20261008`.
- CSV SHA256: `72d6ee59f4b606e159a14044a9ac12f5b5038bc26c147364483ed65d81bbf603`.
- Rows SHA256: `cfdab9b05dcce2f4a8eebb30e2fea4bb69f7b6481e21ff26011f4affc446fde2`.
- `delivery.json`, `checkpoint.json`, `materialized.json`, `publication.json`,
  `live-verification.json`, `in-app-verification.json` hash-bound qəbul saxlayır.
- Ops pointer: `azure-migration/ops/blog-content-plan-delivery.json`.
- `checkpoint-content/` yalnız allowlisted published mətn/media və safe receipt
  nüsxəsidir; operator credentials, session və raw private input daxil deyil.
- Həmin **39 faylın** private Google ehtiyat nüsxəsi upload/read-back SHA256 ilə
  təsdiqlənib: `content-plan-checkpoints/anacan-content-plan-batch-1-20261008/`
  prefix-i, `anacan-migration-ninth-park-492111-m4` bucket-i.
  Lokal receipt: `checkpoint-backup.json`.

Yekun status: **`completed-awaiting-user-continue`**.

İstifadəçi davam istəyəndə növbəti üçlük:

1. **Sıra 4 / FAQ010** — Körpənin ürək döyüntüsü neçə həftədə görünür və ya eşidilir?
2. **Sıra 6 / FAQ012** — Hamilə olduğumu yeni öyrənmişəm: ilk həkim qəbuluna nə vaxt gedim?
3. **Sıra 7 / FAQ021** — Hamiləlikdə qəhvəyi və ya çəhrayı ləkələnmə olanda nə etməliyəm?

CSV-də sıra 5-in yerindəki boş sətir üçün məqalə yaradılmır. Birinci üçlüyün
publication-u və completed Google cutover addımları replay edilmir.

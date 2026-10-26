# 21 dil — Premium, ölkə kataloqları və Community

Bu sənəddəki `ops/`, `source-compat/` və `handoffs/` yolları `azure-migration/`
qovluğuna nisbidir.

## İstifadəçi tələbi — 2026-09-24

- Premium və abunəlik səhifəsi seçilmiş dildə göstərilsin.
- Yeni12 dilin əsas ölkələri üçün xəstəxana/klinika məlumatları tamamlansın:
  CN, ID, FR, ES, PT, VN, IN, JP, KR, PL, NL, SE.
- Həmin ölkələrin uşaq vaksin təqvimləri rəsmi mənbələrlə tamamlansın.
- Community postları seçilmiş dilə görə filtrlənsin; qrup siyahısı da yaradıcının
  dilinə uyğun olsun. Əvvəlki ölkəyə görə prioritetləndirmə bu tələb ilə əvəz olunur.

## Cari Azure yayımı

**2026-09-24 13:59 UTC:** gateway **v35 / `anacan-gateway--0000033`**, ACR **cb1p**,
tag `v35-regional21-community-20260924`:
`sha256:0144730b55fb3dffdda27b5fce75c99489ee79c2eccd44923688b0af81075b23`.
Functions **`--0000010`**,23 aktiv route; SQL28/29 və regional public data Azure-dadır.
Əsas ünvan: **https://api.anacan.az**.

## Əvvəlki Premium düzəlişi

Gateway **v34 / `anacan-gateway--0000032`**, ACR **cb1n**:
`sha256:8579ce99f13f34ce90124652ff8d316e9a98a13bb6b99e68b7e575c9e1bf4f23`.
Functions10 və23 aktiv route qalır; dəyişiklik frontend/public copy qatındadır.

Təkdilli `premium_paywall_config` mətni artıq digər dillərin lokal mətnlərini
əvəz etmir. Explicit admin tərcüməsi üstün qalır, yoxdursa seçilmiş dilin default-u
göstərilir. Rənglər/iconlar saxlanır; retired trial təqdimatı yenidən açılmır.
Premium feature/plan sətirləri raw saxlanıb render zamanı lokallaşdırılır;
BillingScreen ikinci dəfə EN/AZ fallback tətbiq etmir.

`scripts/i18n/premium-copy.json` 27 public mətn üçün20 qeyri-AZ dil,36 exact-source
binding saxlayır. Georgian/Kazakh/Uzbek də Source sxemində öz dillərində işləyir.
Source tuple redaktə edilərsə köhnə tərcümə istifadə edilmir. Faylın byte/hash
qəbulu `translation-manifest.json.publicPremiumCopy`-dədir.

Qəbul:
- 27 focused Premium/purchase testi və TypeScript app yoxlaması keçib.
- Mövcud v33 paketində Russian paywall problemi reproduksiya edilib.
- Yeni local bundle **Source və Azure public-data şəkilləri ilə 21 dil**,
  320/390/768/1440px yoxlamasından keçib.
- Yayımlanmış v34 **21 dil** yoxlamasından keçib;48 locale asset hash,
  6 entry asset,4 health,10 closed-route yoxlaması PASS.
- `ops/verify-premium-localization.mjs`, `ops/premium-localization-*.json`.

## Build yaddaşı

Mac-də 2 GB Vite heap limitinə düşən locale build-i üçün
`scripts/i18n/public-content-assets.mjs` əlavə edilib. Public content dictionary-lər
hash-lənmiş ESM asset kimi yazılır; default export yenə əvvəlki JSON obyektidir.
Rollup böyük locale string-lərini AST/minification pipeline-da saxlamır. Real
Rollup testi və full21 browser yoxlaması keçir; heap limiti artırılmayıb.
Native workspace generator-u bütün `scripts/i18n` qovluğunu kopyalayır.

## Xəstəxana və klinikalar

- **48 müəssisə/klinika/campus qeydi**, hər12 ölkədə4. Mövcud270 qeyd saxlanıb.
- Kurasiya: `source-compat/regional21-providers.json`; hər qeydin rəsmi `source_url`-u
  və capture sübutu var.47 telefon və44 ünvan mənbə ilə tutuşdurulub; təsdiqsiz
  əlaqə sahələri `null` saxlanır.
- Ad və ünvanlar orijinaldır; ixtisas və məlumat təsviri bütün21 dildədir.
  Reytinq/rəy sayı0, reservation/featured flag-ləri false; saxta həkim, xidmət
  qiyməti və tövsiyə reytinqi yoxdur. Rəysiz müəssisə0-ulduzlu kimi göstərilmir.
- Ölkə hesab profilindən gəlir; ölkə seçilməyibsə dilin əsas ölkəsi təklif olunur.
  Dil dəyişəndə seçilmiş müəssisənin təsviri və növ label-ləri də yenilənir.
- Repeat apply operator redaktələrini saxlayır, ID/ad/ölkə konfliktində dayanır.
  Sübut: `ops/regional21-healthcare-azure-1790254674252.json`.

## Vaksin təqvimləri

**12 ölkə / 138 vaksin kataloq qeydi / 342 təqvim sətri**. Bunlar138 fərqli vaksin
məhsulu və ya342 hamıya lazım olan inyeksiya demək deyil: eyni vaksin müxtəlif
ölkələrdə ayrıca qeyd olunur; şərti və mövsümi proqramlar ayrıca təsnif edilir.
ID/PT/VN/NL əlavə edilib; digər8 ölkənin mövcud190 schedule ID-si və şəxsi qeydlərin
FK-ləri qorunub. Digər ölkələrin kataloqu dəyişdirilməyib.

| Ölkə | Vaksin qeydi | Təqvim sətri |
| --- | ---: | ---: |
| CN | 10 | 23 |
| ID | 12 | 26 |
| FR | 13 | 34 |
| ES | 13 | 31 |
| PT | 13 | 32 |
| VN | 11 | 19 |
| IN | 11 | 33 |
| JP | 12 | 34 |
| KR | 14 | 37 |
| PL | 11 | 30 |
| NL | 8 | 17 |
| SE | 10 | 26 |

Mənbələrin **öz versiyaları** ekranda və hər dozanın linkində göstərilir:
- WHO/JRF2025 public workbook: `ops/regional21-who-schedules.json` (599 seçilmiş sətir).
- ECDC-nin version-pinned2026 cədvəlləri: `ops/regional21-schedule-{FR,ES,PT,PL,NL,SE}.json`.
- Japan Pediatric Society May2025, RIVM2025 və KDCA2026 materialları:
  `ops/regional21-reference-downloads.json`; binary fayllar approved temp qovluğundadır.

Kurasiya `source-compat/regional21-vaccines.mjs`, tətbiq planı
`source-compat/regional21-vaccine-plan.json`-dadır. Mənbə ili proqramın avtomatik
2026 yenilənməsi kimi təqdim edilmir. Yerli keçid/cohort, məhsul, risk və catch-up
istisnaları doza qeydlərində saxlanır; vitamin əlavələri vaksin kimi import edilmir.

- SQL28 yalnız iki nullable `schedule_meta` sütunu əlavə edir.
- Ay/il hədləri30/365 gün təxminindən yox, real təqvimdən hesablanır. Nisbi interval
  əvvəlki dozanın **faktiki** vurulma tarixinə bağlanır; tarix yoxdursa ayrıca status var.
- Risk, alternativ məhsul və mövsümi sətirlər avtomatik “gecikib” sayğacına daxil deyil.
  Mənbədə son hədd yoxdursa yeni reviewed sətrə uydurma60-gün deadline əlavə edilmir.
- Uşaq ölkəsi → hesab ölkəsi → saxlanmış ölkə → dilin ilkin təklifi. Uşaq dəyişəndə
  əvvəlki uşağın ölkəsi daşınmır; ölkə yazısı serverdə təsdiqlənmədən dəyişmiş göstərilmir.
- Əvvəlki mənbə ilə exact match tələb olunur. Operatorun əlavə etdiyi eyni kodlu vaksin
  və ya doza ayrıca ID altında dublikat yaradılaraq örtülmür; review xətası verir.
- Vaksin adları, doza/yaş label-ləri və yeni proqram qeydləri21 dil üzrə yoxlanıb.
  JP/IN-də MR proqramına legacy MMR/mumps təsviri əlavə edilmir.
- Son SQL data SHA:
  `1496e2a9c7b87819bd41d956772f47a444165b712fc99196188e47d116023e31`.
  İlk apply və qoruyucu collision yoxlamalı replay: `ops/regional21-vaccines-azure-*.json`.

## Community dil müqaviləsi

- `get_community_feed_v2(p_language,...)` seçilmiş dili **LIMIT/OFFSET-dən əvvəl**
  tətbiq edir: recent/popular/mine/saved/following/profile, axtarış və pinned postlar.
  Digər dilə və null/unknown dilə fallback yoxdur. Mövcud country/group RLS qalır.
- Query cache-ləri dilə bağlıdır; səhv dil qaytaran feed cavabı cache-ə qəbul edilmir.
  Legacy group feed də server-side `language=...` filtrindən istifadə edir.
- `chat_create_group_v4` yaradıcının yaratma anındakı seçilmiş dilini
  `community_groups.discovery_language`-də saxlayır. Sonrakı UI dili və sahib transferi
  bunu dəyişmir. Köhnə qruplar tanınmış `created_by` language preference-dən backfill
  olunur; naməlum dildəki qrup AZ kimi uydurulmur.
- `chat_groups_v4` / `chat_group_cards_v4` discovery və post tag preview-lərini bu dilə
  bağlayır. Inbox/konkret söhbət mövcud v3 membership müqaviləsi ilə açılır; private
  approval, dəvət, ban və owner hüquqları qorunur. Public preference dump yoxdur.
- Unread state, last-seen və realtime subscription backend+hesab+dil ilə ayrılır.
  RU “oxundu” AZ-ni oxunmuş etmir; global preference timestamp yazılmır. Mövcud
  per-post server read receipt-ləri saxlanır; UUID sorğuları100-lük batch-lərlədir.
- Dil/hesab dəyişəndə gecikmiş hydration nəticəsi yeni sayğacı əvəz etmir; təkrar
  realtime event eyni postu iki dəfə saymır.
- Azure real SQL qəbulu21 dil, creator-language, preview və membership yollarını
  owned fixture savepoint-də yoxlayıb, bütün fixture-ləri commit-dən əvvəl geri alıb:
  `ops/community-language-azure-1790257192849.json`.

## Qəbul və təhvil

- **100 fayl / 1059 app testi**, hər iki TypeScript layihəsi və `git diff --check` PASS.
- Healthcare5 + vaksin7 + Community6 = **18 disposable PostgreSQL/Source testi**:
  CDC/writer enrollment, freeze, accepted/pending lineage, replay/operator redaktəsi,
  private access və exact-language pagination daxildir.
- Yeni actual bundle **local və deployed21 dil**,320/390/768/1440px:
  `ops/regional21-web-1790258125876.json` və `ops/regional21-web-1790258640608.json`.
  Brauzerdə Auth/Community/uşaq data-sı synthetic, tibbi public rows qəbul edilmiş
  anonim Azure snapshot-ıdır; bu nəticə Source server install-ı deyil.
-12 expansion dilinin onboarding/admin/recipe/source-bound regression-u48 qəbul qrupu:
  `ops/localization-web-1790258325375.json`.
- v35 Premium/Billing bütün21 dildə PASS:
  `ops/premium-localization-source-1790258869593.json`.
-48 locale chunk hash,6 entry asset,4 health,10 route yoxlaması PASS:
  `ops/web-artifact-1790258485331.json`.
- Native39 iki workspace `--verify-source` → `changed:[]`. Source reklam runtime61,
  13 placement və259/255/open0/5-cron zənciri yenidən keçib:
  `ops/admob-continuity-live-1790258358225.json`.

### Source operator sırası — hələ qəbul edilməyib

1. Cari21 dil sxemini `RUN_SOURCE_LOCALIZATION_21_INSTALL.sql` ilə qəbul et;
   [lokallaşdırma təhvilinin](LOCALIZATION_21.md) data/Functions addımlarını izlə.
2. **Bu addımdan sonra** `source-compat/prepare-regional21.mjs`-i işlə və yeni
   `RUN_SOURCE_REGIONAL21_INSTALL.sql`-i quraşdır.
3. `REGIONAL21_HEALTHCARE_DATA.sql`, sonra `REGIONAL21_VACCINE_DATA.sql` tətbiq et.
4. Cari catalog ilə `source-compat/prepare-community-language.mjs`-i işlə, yeni
   `RUN_SOURCE_COMMUNITY_LANGUAGE_INSTALL.sql`-i quraşdır və public contract/read
   yoxlamalarını qəbul et. Admin v3 sonradan quraşdırılırsa onun installer-ini də
   həmin anın catalog-u ilə yenidən generate et.

Hazırlanmış runtime template SHA-ları:
- `source-regional21-v1`: `db1d75a612474bd0385d5caba9e1bbb7bc8ac99b74d07999245723727a939093`.
- `source-community-language-v1`: `7f397f70b6e6361cfc91717428019c97a7b8e55fdc4415d0430ed3efa7d8ace6`.

Hazır fayllar əvvəlki Source catalog-a pinned-dir; aralıq DDL-dən sonra onları
kor-koranə tətbiq etmə. Yeni data relation/cron yoxdur. Quraşdırılmış runtime hash-i
eyni versiyada dəyişdirilmir. Source qəbulundan sonra yeni native workspace hazırlanır;
published30/finalized39 bu21-dil veb yayımı deyil. Admission hələ **source/generation0**,
population cutover **NO-GO**. Credential-free təhvil: `handoffs/LATEST.json`, archive
qəbulu `handoffs/VERIFIED.json`.

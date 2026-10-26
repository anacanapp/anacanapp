# Customer.io — Anacan dinamik seqmentləri

2026-09-30 tarixində workspace224149-də **33 dinamik seqment** yaradılıb.
Üzvlər qaydalara uyğun avtomatik daxil olur/çıxır; əl ilə sabit üzv siyahısı deyil.

## Əsas seqmentlər

Aşağıdakı saylar2026-09-30,12:23–12:28 UTC yoxlamasındandır və canlı dəyişir.
Aktivsizlik real foreground tətbiq hadisələri və Auth giriş tarixinin maksimumudur.
Bildirişin arxa planda alınması və Customer.io-ya server sinxronizasiyası aktivlik
sayılmır. 1 ay30 gün,2 ay60 gün kimi götürülüb.

| Modul / qeyri-Premium | 7+ gün | 14+ gün | 30+ gün | 60+ gün |
|---|---:|---:|---:|---:|
| Analar (`mommy`) | 3,889 | 3,153 | 541 | 137 |
| Hamilələr (`bump`) | 4,685 | 3,780 | 993 | 260 |
| Menstruasiya (`flow`) | 854 | 708 | 335 | 239 |

IDs: Analar22–25, Hamilələr26–29, Menstruasiya30–33.

**Hədlər kumulyativdir:**60+ gün istifadəçisi eyni modulun7+/14+/30+ gün
seqmentlərinə də uyğundur. Bu siyahıların sayları toplanaraq unikal auditoriya
hesablanmır. Naməlum aktivlik tarixi olan hesablar aktivsizlik qruplarına salınmır.

| Seqment | ID | Say |
|---|---:|---:|
| Aktiv aylıq ödənişli Premium | 34 | 64 |
| Aktiv illik ödənişli Premium | 35 | 19 |
| Aktiv ömürlük ödənişli Premium | 36 | 0 |
| Trial alıb, heç ödəniş etməyib — təsdiqlənmiş | 37 | 289 |
| Premium/trial heç istifadə etməyib | 38 | 14,257 |
| Heç ödəniş etməyib — trial daxil | 39 | 14,561 |
| Hazırda aktiv trial | 40 | 12 |
| Trial bitib, ödəniş etməyib, aktiv hüququ yoxdur | 41 | 288 |
| Əvvəl ödəniş edib, hazırda Premium deyil | 42 | 14 |
| Ödənişli Premium aktivdir, yenilənmə ləğv edilib | 43 | 28 |
| Ödənişli Premium7 günə bitir | 44 | 17 |
| RevenueCat-da billing issue qeydi var | 45 | 246 |
| Hədiyyə/manual Premium | 46 | 1 |
| Ailə paylaşımı ilə Premium | 47 | 1 |
| Son7 gündə aktiv qeyri-Premium | 48 | 4,973 |
| Son7 gündə qeydiyyat, qeyri-Premium | 49 | 346 |
| Bütün aktiv Premium hüquqları | 50 | 97 |
| Bütün qeyri-Premium istifadəçilər | 51 | 14,633 |
| Ödəniş tarixçəsi tam təsdiqlənmir | 52 | 72 |
| Aktivlik tarixi yoxdur | 53 | 5 |
| Modul seçilməyib | 54 | 258 |

Seqment ünvanı:
`https://eu.fly.customer.io/workspaces/224149/journeys/segments/<ID>`.
Üzvlər: həmin URL-in sonuna `/people` əlavə edilir.

## Dəqiqlik qaydaları

- Yalnız Source-dan sinxronlaşan, `crm_segment_version=anacan-audiences-v1` olan
  uyğun hesablar götürülür. Test/anonymous və cari sandbox hesabları ayrılır.
- Cari Premium sadəcə `profiles.is_premium` deyil: müddət, mağaza hüququ, Source
  hüququ və təsdiqlənmiş qarşılıqlı ailə bağlantısı nəzərə alınır. Aktiv trial
  qeyri-Premium deyil. Yenilənməsi ləğv edilən, lakin müddəti bitməyən ödənişli
  abunəlik aktiv Premium olaraq qalır.
- Aylıq/illik ayrılığı real RevenueCat product ID-si ilə edilir; `premium_plus`
  təkbaşına illik kimi təxmin edilmir. Sandbox və store-family-shared hüququ
  istifadəçinin öz ödənişi sayılmır.
- Müsbət məbləğli mağaza alışının sübutu `ever_paid` üçün istifadə edilir. Refund
  cari hüququ bitirə bilər, amma keçmiş ödənişi tarixçədən silmir.
- RevenueCat v1 hər məhsulun son periodunu göstərir. Son period pulsuz olduqda,
  amma daha əvvəlki period varsa, keçmiş ödənişin olmaması buradan sübut edilmir.
  Bu səbəbdən72 hesab “heç ödəniş etməyib” kimi təqdim olunmayıb və ayrıca
  yoxlama seqmentinə alınıb. Onların *cari* Premium hüququ ayrıca məlum ola bilər.
- Ödəniş problemi seqmenti RevenueCat-dakı issue qeydini göstərir; bütün246
  hesabın hazırda aktiv ödənişli abunəliyi olduğu mənasına gəlmir.
- Customer.io timestamp index-i olmayan son tarixləri yalnız tərs tarix filtri
  ilə düzgün daxil etmədi. Buna görə qeyri-Premium şərti **son tarix yoxdur OR
  son tarix keçib**, üstəlik daimi hüquq yoxdur şəklində qurulub və canlı yoxlanıb.

## Davamlı məlumat axını

- Source `source-customerio-audiences-v1` quraşdırılıb. Yeni
  `customerio_audience_facts` relation-ı commit-dən əvvəl CDC/writer guard-a daxil
  edilib. Köhnə SQL34 projeksiyası qorunan base funksiyaya çıxarılıb; onun
  mənbə faylı və ilk runtime receipt-i dəyişdirilməyib.
- `analytics_events` daxilində real tətbiq hadisələri, abunəlik və əlaqəli profil
  dəyişiklikləri uyğun hesabı növbəyə salır. Customer.io profillərinə `crm_*`
  atributları mövcud dəqiqəlik profil worker-i ilə gedir.
- Yeni **`anacan-customerio-billing-sync`** Azure işi hər dəqiqə lazımi hesabların
  RevenueCat vəziyyətini yeniləyir. Aktiv hüquqlar saatlıq, boş tarixçə gündəlik
  təkrar yoxlanır; Source alış/abunəlik siqnalları yoxlamanı dərhal növbələyir.
- Provider sorğusu gedərkən yeni dəyişiklik gəlsə, köhnə cavab yeni reviziyanı
  təsdiqlənmiş saymır. Alış/trial sübutları sticky saxlanır. Hesab silinərkən
  əlavə billing facts silinir və adi Customer.io silinmə əmri davam edir.

Source runtime hash:
`543a37f81fcbc685d50b7a2fa47a27e292591a1e8da0448ec6a485e5b510a68b`.
Billing worker image:
`anacanregistry.azurecr.io/customerio-billing@sha256:5ace3da199df58e3a3beedfea19e1c1f8138970440129edf3969844cc0577822`.

RevenueCat v1 subscriber oxuması işləyir; v2 project-list icazəsi403 qaytarır.
Yoxlama bunun ətrafından keçmir və v2 tarixçəsini oxumuş kimi təqdim etmir.

## Yoxlama və təkrar icra

**14,735 hesab** üzrə provider yoxlaması tamamlanıb; yoxlanmamış/texniki xətalı
hesab0-dır. “Tarixçə məlum deyil” qrupu texniki sorğu xətası ilə eyni şey deyil.

**33/33 qayda və say** Source-dan hesablanan nəticələrlə qarşılaşdırılıb.
**27 üzvlük-kəsişmə yoxlaması** yanlış üzv göstərməyib: Premium ilə qeyri-Premium,
aylıq ilə illik, trial-only ilə ödəniş tarixçəsi və mərhələ/vaxt alt-qrupları yoxlanıb.
Rolling zaman sərhədləri hər seqmentin faktiki yoxlama vaxtına görə hesablanır.

```sh
node azure-migration/ops/customerio-audiences.mjs status
node azure-migration/ops/customerio-segments.mjs verify
node azure-migration/ops/customerio-segments.mjs verify-recent
node azure-migration/ops/customerio-segment-membership-audit.mjs
```

Təkrar yaratma yalnız eyni ownership marker-li tərifləri tanıyır. Başqa şəxsin
dəyişdirdiyi və ya eyni adlı fərqli tərif avtomatik üzərindən yazılmır.

Kod: `azure-migration/customerio-segments/`, `customerio-sync/billing-*.mjs`,
`sql/35-customerio-audiences.sql`, `source-compat/prepare-customerio-audiences.mjs`.
**37 test keçib.** Sübutlar `azure-migration/ops/` daxilində:
`customerio-segments-created.json`, `customerio-segments-verified.json`,
`customerio-segment-membership-audit.json`, `customerio-audiences-installed.json`,
`customerio-audiences-deployed.json`, `customerio-audiences-backfill.json`,
`customerio-billing-evidence-audit.json`.

İstifadəçi adları, e-poçtlar, store transaction ID-ləri və açarlar hesabatlara
çıxarılmır. İstinad edilən saylar canlıdır və zaman/dəyişikliklə yenilənir.

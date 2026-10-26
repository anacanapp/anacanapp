# Community görünürlük düzəlişi — 2026-10-04

## Səbəb və tətbiq

Canlı Source moderasiya worker-i sağlam idi, gözləyən növbə yox idi. Avtomatik
dil təyini bəzi postları yanlış lentə salırdı: ortaq `bir/bu/var` sözləri
azərbaycanca ASCII mətni türkcə, bəzi tək sözlər ingiliscə, standart rus
klaviaturası ilə yazılmış qazaxca mətn isə rusca seçilirdi. Exact-language feed
həmin postları müəllifin seçilmiş dilində gizlədirdi.

- `langDetect.ts` ortaq sözləri dil dəyişməsi üçün kifayət saymır; AZ/UZ Latin və
  KK/UZ Kiril sübutları əlavə edilib. Bütün21 dil saxlanır.
- `submit_community_post_v2` avtomatik təxminlə manual dil seçimini ayırır.
- Köhnə native v1/direct insert/edit üçün ehtiyatlı server düzəlişi moderasiya
  payload/hash yaradılmasından əvvəl işləyir. Retry ID, edit CAS, moderation və
  RLS qorunur.
- Source və Google runtime quraşdırılıb. Source version
  `source-community-language-inference-v1`, hash
  `e8afbec4d61465218945e9aba677df6eae170baa823ccf59d470dad2953ac8cc`.
  Yeni data relation/cron yoxdur; əvvəlki runtime receipt-ləri saxlanıb.

## Mövcud data

Repair ID **`bd429c4c-8354-467f-aa1b-6efd1e8bcef6`**.
229 dil/preference fərqi,173 ayrıca dil təsnifatı yoxlanıb. Yeni detektor,
məzmun və istifadəçi dili uyğun, confidence ən az0.98 olan **137 post /86 müəllif**
üçün düzəliş qəbul edilib:

| Dəyişmə | Post |
|---|---:|
| tr → az |94|
| en → az |8|
| az → uz |19|
| tr → uz |5|
| ru → uz |2|
| ru → kk |9|

Hər iki backend-də rollback dry-run, CAS commit və137/137 son yoxlama keçir.
Mətn, publication/moderator qərarı və interaction sayğacları saxlanıb;
hər backend-də25 köhnə törəmə tərcümə keş qeydi təmizlənib. Google-dakı3 fərqli
mövcud media istinadı qorunub.8 ortaq audit qeydi Source-un canonical ID/vaxtı
ilə uyğunlaşdırılıb; növbəti delta eyni düzəlişi konflikt saymır.

Source-da AZ/UZ/KK üzrə seçilmiş düzəldilmiş postlar real authenticated RLS ilə
`mine` feed-də görünür.12:57 UTC: checking0, worker sağlam, writer open/generation0,
əvvəlki5 cron, accepted/pending/catalog eynidir.

## Miqrasiya hash düzəlişi

Google-da13 təsdiqlənmiş review-un public media URL-i canonical API-yə çevrilmiş,
hash isə Source payload-ına aid qalmışdı. Hər13 hal immutable Source staging-də
orijinal hash və yalnız public-origin çevrilməsi ilə təsdiqlənib.

- Yalnız törəmə hash yenilənib; payload/post/approval qərarı saxlanıb.
-113 cari review üzrə payload/post hash uyğunsuzluğu **0**.
- `sync/reconcile-functions.sql` normalized Source/base payload dəyişəndə hash-i
  də yeniləyir. Raw Source/export hash-ləri saxlanır; ilkin hash səhvdirsə rədd edir.
- `google-cloud/verify-data.mjs` növbəti sinxronlarda hər iki invariantı yoxlayır.

## Qəbul və təhvil

-82 app testi,22 real PostgreSQL moderation/CDC/CAS testi və ayrıca media-hash
  normalizasiya regressiyası keçir.
- Google web45 build `69895b99-5b30-46ea-bfba-c7c1630d77be`, image
  `gateway@sha256:99c7745c33d806013f967ae59ec5ac6eb197687876a50aeaf7fcbe6b3d38c204`.
  611 asset/21 dil/5 health route qəbul edilib.
- Mövcud native45 v1 çağırışı Google-da real canary ilə keçib; dörd paket
  checksum-u saxlanıb. Cari frontend düzəlişi Google web-dədir; ayrıca Lovable
  publication və yeni native frontend təhvili kimi təqdim edilmir.

Private receipts (`azure-migration/ops/`):
`community-language-inference-{source,google}-installed.json`,
`community-language-repair-bd429c4c-8354-467f-aa1b-6efd1e8bcef6-{source,google}-apply.json`,
`community-visibility-live-verification.json`, `google-cloud-community-hash-repair.json`.
Plan/before-images private `provider-inputs/community-language-repair/<id>/` və
`provider-inputs/google-cloud/` altındadır; chat/Git/code arxivinə çıxarılmır.

Bu korrektiv iş full snapshot/final handoff deyil. Pending/Google base94533…,
05:57 UTC snapshot sərhədi və approval/DNS hold qalır.

## Hesab dili followup-u — 2026-10-04 14:46 UTC

İstifadəçi scope-u **yalnız AZ hesabları** kimi təsdiqləyib. Əvvəl düzəldilmiş86
müəllifin59-u AZ,19-u UZ,8-i KK qrupundadır. Source və Google-da59 AZ hesabının
hamısının `user_preferences.language='az'` olduğu yenidən təsdiqlənib;
dəyişiklik tələb edən hesab0, DML0. Digər27 hesabın mövcud seçimi qorunub.

Hesab dili artıq AZ olduğu halda postun yanlış etiketlənməsinə qarşı əvvəlki
detektor/server inference düzəlişi tətbiq olunur; hesabı daim kilidləyən yeni
qayda yaradılmayıb. Private receipts:
`azure-migration/ops/repaired-account-languages-source-apply-az.json`,
`azure-migration/ops/repaired-account-languages-google-apply-az.json`.

# Story / tərcümə / Premium — 37.0

## Dəyişikliklər

- Story səhnəsində əlavə daimi ürək/say pill-i çıxarılıb. Like düyməsinə toxunanda
  Instagram tipli qısa ürək animasiyası göstərilir; əvvəl bəyənilmiş story açılarkən
  təkrarlanmır, unlike-da göstərilmir. Story dəyişməsi/unmount timer-i təmizləyir,
  pending yazı zamanı ikinci like bloklanır və reduced-motion seçimi nəzərə alınır.
- Qrup terminləri **Qurucu / İdarəçi** kimi yenilənib. Public/Private, ümumi idarələr
  və Story control-ları 9 tətbiq dilində tam fallback-lərə malikdir.
- Yeni chat/group/story səthlərində literal UI açarları yoxlanıb: **41 çatışmayan
  dil/açar cütü** (Story pause/resume/mute/unmute/delete) tamamlanıb. Bütün feature
  dictionary-ləri, placeholder-lər və komponentlərdə istifadə edilən açarlar test olunur.
- Community post/şərh/profil Premium nişanı server hesablamasına bağlıdır. İzləyici
  siyahısı da artıq eyni effective public-card RPC-si ilə badge göstərir. Server
  entitlement sync-dən sonra feed/comment/profile cache-ləri yenilənir.

## Premium auditinin sərhədi

Azure datasında cari hesablama **153 aktiv Premium/household profil**, **0 çatışmayan
public card**, **149 fərqli köhnə badge label-i** göstərib. Son rəqəm tək saxlanan
`badge_type`-a güvənməməyin səbəbidir; yeni UI `get_public_community_profiles_v2`-nin
`is_premium` nəticəsini istifadə edir. Read-only counts report:
`azure-migration/ops/community-premium-audit-20260921.json`.

Aktiv trial və ləğv edilmiş, amma müddəti bitməmiş entitlement Premium-a daxildir;
household da hesablanır. Anonim paylaşımda şəxsiyyəti qorumaq üçün badge göstərilmir.
Bu audit bütün live Source population-un sayını və ya köhnə store build-in UI-sini
təsdiqləmir. Yeni Azure vebdə faktiki Premium nişanı canlı fixture ilə göstərilib.

## Supabase Storage sxema uyğunlaşması

Source platforması `storage.buckets`-a nullable `lifecycle_configuration jsonb` və
`lifecycle_configuration_generation uuid`, onların check constraint-lərini əlavə
edib; `storage.objects` indekslərini yeniləyib. Rəsmi Storage migration-ləri:
0065/0066/0067 version/current/null-version unique indeksləri, 0068/0069 lifecycle,
0072 köhnə `bucketid_objname` indeksinin çıxarılması.

İlk adoption cəhdi unikal indeks çıxarıldığı üçün rollback olub. Yenilənmiş paket
yalnız həmin bir köhnə indeksin yerinə üç rəsmi unikal indeksin **PostgreSQL tərəfindən
kanonikləşdirilmiş tərifini**, ready/valid statusunu, operatorun exact catalog hash-ini,
mövcud sütun/constraint/owner/RLS/CDC/writer sərhədlərini yoxlayır.

- Source operator `source-compat/source-storage-platform-v1.sql`-ni tətbiq edib.
- SQL SHA-256: `cfa8aca72b2d6b66324310be0d9138a2a84ed14db7aa89c20ca58f19b8722148`.
- Yeni Source catalog: `7b7ce25316afb9ed0b899710bf7b9ea93cec77ccc751c432c176a1ca5e15050d`.
- **259 cədvəl / 255 guarded relation**, writer open/generation 0, 5 Source cron.
- Accepted `8e22f4f9-23ed-49b6-9069-75c2793e3c83`, pending
  `755ec961-7566-42d7-8e34-fb94eec834e1` dəyişməyib. Hər iki Storage relation üçün
  whole-table replacement marker-i qeyd olunub. App sətirləri dəyişdirilməyib.
- Azure SQL23 yalnız lifecycle metadata-nı itirməmək üçün nullable sütunları əlavə
  edir; lifecycle worker və yeni fayl/versiya layout-u aktivləşdirmir.
- Tarixi warm delta hələ reviewed replan tələb edir. Source-un versioned-object
  semantikasını köhnə Azure runtime-a kor köçürmək/unikal indeksləri silmək olmaz.

Qeyd: `azure-migration/ops/source-storage-platform-20260921.json`.
Canlı yekun status: `source-runtime-live-1790020840159.json` və
`communications-source-1790020841192.json` — hər ikisi PASS.

## Delivery və yoxlamalar

- Gateway **v27 / `anacan-gateway--0000025`**, ACR `cb1b`:
  `test-gateway@sha256:cfe34c42751ac97fb42903382f289fae45b11988e04da031851b958e0c628974`.
- **76 əlaqəli unit/UI/hook yoxlaması**, hər iki TypeScript layihəsi keçib.
- **10 SQL/CDC/platform-adoption ssenarisi** keçib. Lokal PostgreSQL pre-15 forması
  və 15+ üçün rəsmi index forması renderer-də ayrıca nəzərə alınır.
- Canlı Azure **11 qrup**, o cümlədən `authoritativePremiumBadgeVisible=true`:
  `communications-live-azure-1790020098149.json`. Üç hesab/beş fayl və 100 cədvəl
  üzrə fixture cleanup təsdiqlənib. Əvvəlki run realtime event timeout almışdı;
  təkrar tam run uğurla keçib.
- 37.0 Android bundle-i ilə canlı Source **10 mesajlaşma/media ssenarisi**:
  `communications-live-source-1790021883065.json`. Reply/reaksiya, AAC/MP4 səs preview
  və göndərmə, şəkil/video decode, private media, realtime və back yoxlanıb.
  Üç hesab/beş fayl təmizlənib; Source catalog/accepted/pending zənciri qorunub.
- Həmin bundle ilə canlı Source **5 qrup ssenarisi**:
  `communications-live-source-1790021709094.json`. Qurucu təsdiqi, mesaj silmə,
  inbox-dan dəqiq qrup və post etiketindən keçid yoxlanıb; üç fixture hesabı təmizlənib.
- İlk Source UI run-u (`communications-live-source-1790021635718.json`) reaksiya
  yazısını API-də görüb brauzerin mutation/refetch-i bitməmiş ikinci menyu klikini
  edirdi. Verifier indi seçilmiş badge və picker-in bağlanmasını gözləyir; son tam
  run keçib. İlk run-un cleanup-u da təsdiqlənib.
- Web bytes/health/gates: `web-artifact-1790019689356.json`.
- Native run **`native-20260921t193406-1f369da0`**, version **37.0**; Source-first,
  real AdMob IDs, unchanged app/team/widget/hostname; platforma başına **345 code
  asset / 13 bundled session-admission ssenarisi** keçib.
- Signed artifact verifiers: `native-ios-verification-1790020809592.json` və
  `native-android-verification-1790020833989.json` — PASS. IPA/APK/AAB hash-ləri,
  native identity və 345 code asset təsdiqlənib. Android original signer, permission
  bridge, keyboard resize və 16 KB native library/ZIP alignment yoxlamaları keçib.

Native build/package nəticələri run qovluğundakı `build-ios.json`, `build-android.json`
və `artifacts/` altında saxlanılır. Store publication və final population admission
bu işin nəticəsi deyil; native admission Source/generation 0-dır.

| Paket | Byte | SHA-256 |
| --- | ---: | --- |
| [Android APK](../azure-migration/native-preview/native-20260921t193406-1f369da0/artifacts/anacan-source-first-37.0.apk) | 32,030,980 | `26ba82a7802fe9fbf9bdcd5253134b9a7e087f3ff306704c019b6db16efb859e` |
| [Android AAB](../azure-migration/native-preview/native-20260921t193406-1f369da0/artifacts/anacan-source-first-37.0.aab) | 30,750,438 | `1c8e63e5156528723b92dffac5dadcd731547e7a74640c48e57524c753c36994` |
| [Development IPA](../azure-migration/native-preview/native-20260921t193406-1f369da0/artifacts/anacan-source-first-37.0-development.ipa) | 20,116,993 | `ba1c6732248c7612bbac8e3bc7ad2af658e8f67c47a47145baf97ccd01a9247b` |

Native archive/export/release imzalama tamamlanıb. Fiziki cihazda install/launch və
reklam/permission acceptance ayrıca təsdiqlənir; test IPA store upload paketi deyil.
`ios-device-test-1790021560069.json`: compiled main/widget capabilities, 7 bridge
metodu, real AdMob revision **59** / 13 iOS placement və Source/generation 0 uyğunluğu
keçib; cihaz mərhələsi **`IOS_TEST_DEVICE_NOT_CONNECTED`** ilə dayanıb. Install/launch
edilməyib. Source browser sınaqlarında native transport və mikrofon input-u simulyasiya
olunub; bu nəticə fiziki cihaz qəbulunu əvəz etmir.

Credential-free kod/sübut təhvili: [LATEST.json](../azure-migration/handoffs/LATEST.json)
və [VERIFIED.json](../azure-migration/handoffs/VERIFIED.json). Native paketlər ayrıca
yuxarıdakı workspace-də saxlanılır.

## Trial / illik qiymət / növbəti onboarding

[Trial və qiymət dəyişməsi təlimatı](TRIAL_AND_PRICING.md) App Store Connect və
Google Play yollarını, mövcud trial-ların davamını və fərqli qiymət cohort qaydalarını
izah edir. Mağaza təklifləri/qiymətləri və mövcud subscription hüquqları bu taskda
dəyişdirilməyib. Yeni illik məbləğ/valyuta və tarix hələ verilməyib.

İstifadəçi yeni onboarding nümunəsini **növbəti taskda** verəcək. Hazırkı onboarding
bu işdə dəyişdirilmir; yeni nümunə alınandan sonra ayrıca tətbiq olunacaq.

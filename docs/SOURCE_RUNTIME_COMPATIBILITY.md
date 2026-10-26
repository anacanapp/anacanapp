# Source-first uyğunluq müqaviləsi — 2026-09-24

**Eyni tətbiq kodu Source/Lovable-da işləyir; Azure əsas inkişaf/deploy bazasıdır.**
Native admission `source / generation 0` olduğu müddətdə istifadəçi Auth, REST,
storage və tətbiq funksiyaları `tntbjulojatnrqmylorp.supabase.co` ünvanında qalır.
Əsas reklam redaktəsi Azure-dadır; yeni 39.0 client reklam konfiqurasiyasını Source-da
saxlanan təsdiqlənmiş nüsxədən oxuyur. [Reklam davamlılığı](ADMOB_CONTINUITY_39.md).

## Tətbiq edilmiş backend müqavilələri

**Followup36:** Azure gateway v36 / Functions11 / Storage9 və SQL30 qəbul edilib.
Yeni21-dil exercise/phase data,1680 ad, ayrıca vaksin ölkəsi, per-admin public etiket,
klaviatura/media və article-share düzəlişləri eyni tətbiq kodundadır. Source üçün
`source-followup36-v1` wrapper7 disposable SQL testindən keçib, operator qəbulu açıqdır.
Köhnə `steps_ka text[]` tipi, child country/history, real admin icazəsi və
CDC/accepted/pending/writer zənciri qorunur. `baby-insight` optional section contract-ı
üçün14-function paketi də yenilənib. [Tam SQL/function sırası](SUPABASE_FOLLOWUP_36.md)
və [buraxılış sübutu](FOLLOWUP_36.md). Finalized39 yeni21-dil native buraxılışı deyil.

**Regional/Community v35:** SQL28/29,48 healthcare və138 vaksin/342 schedule sətri
Azure-da qəbul edilib; bütün21 dildə browser və1059 app testi keçir. Source üçün
`source-regional21-v1` və `source-community-language-v1` catalog/CDC/writer wrapper-ləri
hazırdır, **operator qəbulu yoxdur**. Localization21 prerequisite və hər DDL-dən sonra
növbəti pending installer-in yenidən hazırlanması: [regional təhvil](REGIONAL_21.md).
Yeni Source-first native namizəd bu qəbul ilə koordinasiya edilir. Finalized39
əvvəlki müqavilədə qalır; yeni web yayımı native Store release sayılmır.

**21 dil genişləndirilməsi:** Azure web v33 / Functions10 yayımlanıb. Source üçün
`source-localization-v2` sxem/data və 14 Edge Function bundle-i, ayrıca admin v3
installer-i hazırlanıb; bunlar hələ Source operator qəbulu sayılmır.
Yeni client Source-un köhnə sxemində də exact-source-bound paket tərcümələrindən
istifadə edir. Serverdəki yeni dil sətirləri legacy siyahıda inactive saxlanır.
Quraşdırma ardıcıllığı və native39-dan ayrı scope: [21 dil təhvili](LOCALIZATION_21.md).

`source-admob-continuity-v1` canlıdır: `get_source_admob_contract_v1()` və public
snapshot V61 təsdiqlənib. Mövcud guarded/CDC `app_settings` üzərindədir; yeni relation
və cron yoxdur. Catalog/accepted/pending/writer/5-cron vəziyyəti qorunub:
`admob-continuity-live-1790086561748.json`.

38.0 onboarding mövcud `profiles.onboarding_answers`, `user_children` və
`user_preferences` üzərində işləyir; Source DDL və əlavə relation yoxdur.
Bütün 9 dil × 3 mərhələ real Source UI/data/reload yoxlamasından keçib:
`communications-live-source-1790058770352.json`. [38.0 qeydi](ONBOARDING_38.md).
Son əlavə `communications-live-source-1790064416223.json` bütün Azure sorğuları
bloklanmışkən üç mərhələnin Source-da saxlanıb yenidən açıldığını təsdiqləyir.
[Azure-outage sərhədləri](AZURE_OUTAGE_SOURCE_FIRST.md).

Cari Source **259 cədvəl / 255 writer-guarded relation**-dır; catalog SHA-256
`7b7ce25316afb9ed0b899710bf7b9ea93cec77ccc751c432c176a1ca5e15050d`.
Supabase Storage lifecycle/version-index yeniləməsi `source-storage-platform-v1.sql`
ilə reviewed catalog adoption-dan keçib; Source status/writer yoxlaması yenidən PASS.
[37.0 qeydi](COMMUNITY_POLISH_37.md).
`source-group-chats-v3.sql` ilə Public/Private admission, owner controls, inbox və
post etiketləri aktivdir; 26 kateqoriya qrupu çıxarılıb. [36.0 müqaviləsi](GROUP_CHATS_36.md).
`source-communications-v2.sql`, canonical event-push bundle-i və
`source-account-projections-communications-20260921.sql` operator tərəfindən
tətbiq edilib. `get_chat_contract_v2()` və hesab-silmə projection müqaviləsi canlıda
yoxlanıb. [Mesajlaşma 35.0 və qəbul sübutları](COMMUNICATIONS_35.md).

Əvvəlki core v1 quraşdırılması:

Source SQL Editor-da `azure-migration/source-compat/source-runtime-v1.sql` tətbiq edilib:

- Versiya `source-compat-v1`, SQL SHA-256
  `9bc1445a127b24feda381cdadfc28e8a949e4203d3f5485f408ce45fdead6125`.
- Source catalog: **255 cədvəl**, **251 writer-guarded relation**.
- Catalog SHA-256 `1036dfe94658c0e7c6e8cbc29fe4ca7b5f865b877c5122b5f9c64202bf642522`.
- Writer `open`, generation 0, mövcud 5 cron aktivdir.
- `get_anacan_runtime_contract_v1()` bu versiya və feature müqavilələrini göstərir.

| Sahə | Source və Azure davranışı |
| --- | --- |
| Gündəlik dövr qeydləri | SQL09 RPC-ləri, no-flow/clear, ovulation-test və expected-user yoxlaması |
| Cəmiyyət | SQL11 follow/bookmark/feed/profile RPC-ləri və owner/RLS sərhədləri |
| Story editor | SQL12 layout/save; Source variantında yalnız actor-owned Source `community-media` URL-ləri |
| Mini oyun reytinqi | SQL15 `submit_game_score_v1`, atomik rekord/sayğac, actor+submission UUID ilə idempotent retry |
| Aylıq/illik bildiriş | Eyni canonical calendar helper, 85 reviewed şablon, real ay tamamlanması və gün sayı |
| Reklamlar | 39.0 Source üçün yerli mirror RPC / sticky emergency; Azure üçün mövcud seçilmiş SDK/RPC |
| DM / partner / qrup | SQL18: reply, reaction, private media, bounded history və üzvlük/owner RPC-ləri |
| Badge / staff links | SQL19: authoritative Premium/household və administrator/moderator icazəsi |
| Reply bildirişi | SQL20/21: tək producer, durable claim və atomik inbox yazısı |
| Hesab silinməsi | SQL17: public kart və game score projection-ları Auth delete ilə təmizlənir |

Source-da yeni `community_follows`, `community_post_bookmarks`, `game_score_receipts`
cədvəlləri CDC və statement writer guard-a transaction daxilində qoşulub.
`flow_daily_logs`, `community_stories`, `mommy_day_notifications`, `community_posts`,
`notifications` dəyişiklikləri də registry-dədir. Dəyişmiş row-shape üçün `replace`
marker-ləri var. Quraşdırılmış v1 SQL-in mətnini dəyişib eyni versiya kimi işlətmək
olmaz; sonrakı DDL ayrıca reviewed versiya və schema replan tələb edir.

Azure-da SQL15 və SQL16 da tətbiq edilib. SQL13/14/16 Source-a birbaşa tətbiq edilmir;
Source davamlılığı ayrıca reviewed `source-admob-continuity-v1` wrapper-i ilə qurulub.

## Source bildiriş deployment-i

Operator mövcud `send-daily-notifications` funksiyasına bu bundle-i yerləşdirib:
`azure-migration/source-compat/send-daily-notifications.source.ts`.
Sonra `source-calendar-activate-v1.sql` ilə 85 mövcud şablon aktivləşdirilib.

- Təhlükəsiz readiness: **OPTIONS** `/functions/v1/send-daily-notifications`.
- Header: `X-Anacan-Notification-Runtime: source-calendar-v1`.
- `get_anacan_notification_contract_v1()` → `source-calendar-v1`, rule version 1.
- Repair SHA-256 `ef79581fa4c08789e1d96f741e30ad8742fe0d0e72170edeaa7fd60f4af8a2be`.
- Source `_shared/mommy-calendar.mjs` və Azure helper-i byte-identicaldır:
  `ce269e81a87532bdbb37e9ca1bfc3c6985b570e57bccee5811a0828e94244ae5`.

Legacy funksiyanın GET/POST çağırışı notification dispatch edə bilər. Readiness
üçün OPTIONS istifadə edilir. Bu yoxlamada real push göndərilməyib.

## Reklam control plane-i

- 39.0 Source client seçilmiş SDK ilə `get_source_admob_configuration_v1()` oxuyur;
  Azure əlçatmaz olsa last-good nüsxə saxlanır. Köhnə 38.0 transportu aşağıdakı public
  Azure JSON-u birbaşa oxuyur və upgrade tələb edir.
- `GET https://api.anacan.az/.well-known/anacan-admob.json` — public JSON, `no-store`.
  Yeni müqavilədə bunu Source `pg_net` sabit anonim URL/headers ilə oxuyur.
- `POST https://api.anacan.az/admob/events` — yalnız bounded coarse native telemetry.
- Client `credentials: omit`, `redirect: error`; Source JWT, cookie və API açarı
  bu sorğulara daxil edilmir. Gateway həmin credential header-lərini də silir.
- Seçilmiş backend konfiqurasiyası əlçatmaz/köhnədirsə yeni reklam göstərilmir.
  Source-un uğurlu oxusu fresh sayılır; upstream sync tarixi ayrıca göstərilir.
- Admin: **https://api.anacan.az/admin/ads**, Source mirror ready/pending/retry daxil.
  Source adminində ayrıca sticky emergency stop var; əsas redaktə üçün Azure linki
  saxlanır. Backend-lər arasında istifadəçi sessiyası daşınmır.
- Native UMP razılığı və privacy options hər iki backend-də işləyən eyni SDK yoludur.
- Premium/household Premium, naməlum entitlement, qorunan ekran və cadence/cap
  qaydaları qüvvədədir. Reklam datasına tibbi profil və mesaj məzmunu əlavə edilmir.

**Cari konfiqurasiya: revision 61, `live`, enabled** (`ios-device-test-1790066027853.json`). Native input revision 58-dəki
real App ID-ləri istifadə olunur:

- iOS `ca-app-pub-2615305918015147~8076918608`.
- Android `ca-app-pub-2615305918015147~3154755256`.

İstifadəçi UMP mesajını yayımlayıb və iOS 34.0-da giriş/home banner qəbulu verib:
[34.0 cihaz qeydi](IOS_ADMOB_TEST_34.md). Digər formatlar/platformalar ayrıca cihaz
qəbulu tələb edir. Telemetry gəlir və ya server-side mükafat authority-si deyil.

## Reytinq davranışı

- Oyun local-first qalır. Hesabsız oyunçu cihazdakı irəliləyişi saxlayır və
  reytinqdə giriş çağırışı görür.
- Reytinq cache-i backend realm, oyun və hesaba bağlıdır.
- Adlar `public_profile_cards` safe projection-ından authenticated oxunur;
  köhnə verification sütunları olmayan schema üçün uyğun fallback var.
- Sorğu xətası boş reytinq/generic ad kimi gizlədilmir; istifadəçi retry edə bilir.
- Nəticə expected actor, realm və submission UUID-yə bağlanır; təkrar göndəriş
  oyunu ikinci dəfə saymır. Aşağı nəticə əvvəlki rekordu silmir.
- Köhnə anonymous local nəticələr sonradan başqa hesaba avtomatik yazılmır.
- Login/error/success/retry mətnləri bütün 9 tətbiq dilindədir.

## Canlı və lokal qəbul sübutları

- Cari Source runtime/read-only: `source-runtime-live-1790060020879.json` və
  `communications-source-1790020841192.json` — **259/255**, qrup v3, hesab-silmə
  projection müqaviləsi və dəyişməyən accepted/pending zənciri.
- 37.0 native bundle + canlı Source: `communications-live-source-1790021883065.json`,
  **10/10** communications/media ssenarisi; `communications-live-source-1790021709094.json`,
  **5/5** qrup ssenarisi. Fixture cleanup və Source checkpoint qorunması təsdiqlənib.
- Cari Azure v27: `communications-live-azure-1790020098149.json`, **11/11**.
- Reviewed Storage adoption qeydiyyatı: `source-storage-platform-20260921.json`.

Əvvəlki core/reklam qəbul tarixçəsi:

- `source-runtime-live-1789922802201.json`: Source runtime, calendar readiness,
  catalog, writer və Source 0 admission, read-only.
- `source-feature-access-1789923668005.json`: real Source hesabı/giriş, icazəli ad
  oxunuşu, score RPC actor/validation rejection; fixture hesabı silinib və refresh rədd edilib.
- `admob-web-1789924517155.json`: lokal yeni bundle + real Azure, 4/4.
- `admob-web-1789924770742.json`: yayımlanmış bundle + real Azure, **6/6**.
  Oyunun real control-ları ilə 760 xal yazılıb, retry `totalPlays=1` saxlayıb,
  adlar/error-retry/anonymous gate yoxlanıb; fixture-lər silinib.
- `public-admob-1789924999002.json`: **6/6**, public CORS/header stripping,
  stale-event rejection və test-only diagnostic, Source 0 admission.
- `web-artifact-1789924667046.json`: 6 byte/4 health/10 closed-route yoxlaması.
- `color-sort-web-1789924918409.json`: 4/4 live UI/worker/RTL smoke.
- 170 frontend/SDK/policy/auth/game test; 38 backend/SQL/config test keçib.
  Lokal nginx executable testi skipped-dir; yeni gateway-in real deployment/readiness
  və public proxy yoxlamaları keçib.

Report-lar `azure-migration/ops/` altındadır. Source-un uğurlu score/period/social/story
mutasiyaları disposable Source-shaped PostgreSQL fixture-də yoxlanıb. Son canlı
communications sınaqları öz müvəqqəti hesabları/faylları ilə aparılıb. Source-da
game score/public card cleanup artıq aktivdir; replay tombstone-ları ayrıca qalır.
Fiziki reklam/push/store qəbulu ayrıca mərhələdir.

## Migration davamlılığı

Quraşdırmadan əvvəl/sonra eyni checkpoint-lər qorunub:

- Accepted: `8e22f4f9-23ed-49b6-9069-75c2793e3c83`.
- Pending: `755ec961-7566-42d7-8e34-fb94eec834e1`.
- Target before-image: `6f543333-7cc8-4b6d-be27-28a2f67d0c20`.
- Köhnə warm state: step 7; həmin pending üçün primary apply run **0**.

259-cədvəlli Source catalog köhnə 252-cədvəlli warm plan-dan fərqlənir. `sync-next`,
direct `apply-plan` və `checkpoint` CLI-ləri köhnə schema ilə davamı
`SOURCE_SCHEMA_EVOLUTION_REQUIRES_REPLAN` ilə saxlayır.

Read-only vəziyyət yoxlaması:

```sh
node azure-migration/sync/inspect-schema-replan.mjs
```

Qəbul sübutu `schema-replan-1789926222392.json`; **bu replan icrası deyil**.
Növbəti migration işi private before-image/plan/state arxivini saxlamalı, pending
head-dən yeni linked stream və closure almalı, exact replacement frame-ləri stage
etməli, yeni target before-image ilə plan/Auth/FK/storage qəbulunu yenidən qurmalıdır.
`next-sync.json`-u silmək/özbaşına geri çəkmək və ya `prepare-next-cycle.mjs`-i
bu yarımçıq cycle-ə tətbiq etmək olmaz.

Ətraflı sıra: [təkrarlanan sync](AZURE_INCREMENTAL_SYNC.md) və
[final admission/handoff](AZURE_FINAL_SYNC_AFTER_APPROVAL.md).

# Anacan

## Əsas tətbiq — Google Database aktiv

**2026-10-07: canlı database/Auth/media və runtime Google-a keçirilib.**
Əsas ünvan: **https://api.anacan.az**, app: **https://app.anacan.az**.
Layihə `ninth-park-492111-m4`; PostgreSQL `anacan-gcp-candidate` VM-dədir.
[Cari baza və faktiki keçid statusu](docs/APPLICATION_BASELINE.md).

- Source writer sealed/generation3, cron0; Google admission managed realm
  `azure`/generation2-dir. Son data/session/writer/job/DNS qəbulu tamamlanıb.
- Google-da8 business timer-i, daily DB/hourly file backup və Customer.io224149:93570 aktivdir.
- Son native **47.0** iOS App Store IPA və Android Google Play AAB imzalanıb:
  `azure-migration/releases/47.0/`. iOS46scroll/klik hotfix-i daxildir;Store yayımı pending-dir.
- Gələcək build-lər Google default istifadə edir;17 native routing case/platform,
  156 focused app testi, TypeScript və active deploy müqavilələri keçir.
- [Yekun keçid və davam qaydası](docs/GOOGLE_POPULATION_CUTOVER_20261007.md) ·
  [iOS46 hotfix və Store təhvili](docs/IOS_INPUT_HOTFIX_46.md) ·
  [47.0 Store paketləri və upload](docs/RELEASE_47_GOOGLE.md) ·
  [21-dilli Google marketinq saytı](docs/WEBSITE_GOOGLE_20261006.md).

### Əvvəlki veb yeniləmə — Community reklam moderasiyası, 2026-09-27

- Gateway **v40 / `--0000041`**, SQL32 və hər dəqiqə işləyən ayrıca moderasiya worker-i.
- Post/redaktə reklam yoxlamasından əvvəl yayımlanmır;21 dil, şəkil yoxlaması,
  moderator qərarı, müəllif bildirişi və `jamil@anacan.az` e-poçt növbəsi.
- [Reklam moderasiyası paneli](https://api.anacan.az/admin/ad-moderation) ·
  [Müqavilə və qəbul](docs/COMMUNITY_AD_MODERATION.md) ·
  [Source operator quraşdırması](docs/SOURCE_COMMUNITY_AD_MODERATION.md).
-198 focused app testi,16 SQL/CDC və32 worker testi;49 mətn/3 şəkil real-AI sınağı,
  21 dildə deployed browser və real scheduled-worker canary keçib.

### Əvvəlki veb yeniləmə — Premium təklifinin yeri, 2026-09-26

- Gateway **v39 / `--0000040`**: reklamsız Premium kartı ilk görünmədə yuxarıda,
  sonrakı ana səhifə açılışlarında isə ən aşağıda göstərilir.
- “Premium-suz darıxdıq / 3 gün pulsuz geri qayıdın” bloku dashboard və Billing-dən çıxarılıb.
- [Davranış, yaddaş və yoxlama sübutları](docs/PREMIUM_OFFER_PLACEMENT.md).

### Əvvəlki veb yeniləmə — header və splash, 2026-09-26

- Gateway **v38 / `--0000039`**: şəffaf kənarlı loqo, vahid HTML/React açılışı,
  status-bar boşluğundan ayrılmış alt səhifələr, daha rahat header düymələri.
-81 əlaqəli test,21 dildə6 header ekranı və mobil/RTL/klaviatura yoxlamaları keçib.
- Native splash yeni41.0 izolə namizədindədir; Source-first şərtləri və native
  paketlərin faktiki statusu [header/splash təhvilində](docs/HEADER_SPLASH_38.md) göstərilir.

### Əvvəlki veb yeniləmə — Premium / blog / Mommy period, 2026-09-25

- Gateway **v37 / `--0000037`**, Functions **`--0000012`**, Storage **`--0000009`**;23 aktiv route, SQL31.
- Premium expiry/refund standart paywall-a qaytarır; açıq alət, partner AI və
  arxa fondakı ağ səs köhnə Premium cache-i ilə davam etmir.
- Community `/Blog` axtarışı, cover/title kartı, caption və exact in-app məqalə.
- Mommy modulu dəyişmədən period tracker/calendar; dashboard istisnası ilə native
  qara capture qoruması üçün yeni40.0 test namizədi.
- **1113 app testi**,21 dildə deployed UI və canlı owned-fixture qəbul keçib.
- [Buraxılış](docs/FOLLOWUP_37.md) · [309 SQL /18 Source function və sıra](docs/SUPABASE_FOLLOWUP_37.md) · [Native40 və fiziki capture qəbulunun statusu](docs/NATIVE_40.md).

### Əvvəlki veb yeniləmə — 16 düzəliş / 21 dil, 2026-09-24

- Gateway **v36 / `--0000034`**, Functions **`--0000011`**, Storage **`--0000009`**;23 aktiv route.
- Klaviatura və mesaj mediası, konkret bloq paylaşımı, ayrıca AI analizləri,
  admin etiketi, yeni stage adları və **10000+** Premium mətni.
-12 yeni ölkənin hərəsində140 ad; Kegel/faza mətnləri və ölkə üzrə dekret planlaması21 dildə.
- **1097 app testi**,13 canlı API/brauzer yoxlaması və21 dildə deployed qəbul keçib.
- [Buraxılış və sübutlar](docs/FOLLOWUP_36.md) · [Bütün Supabase SQL/function faylları və sıra](docs/SUPABASE_FOLLOWUP_36.md).

### Əvvəlki veb yeniləmə — regional kataloq və Community, 2026-09-24

- Gateway **v35 / `--0000033`**, Functions **`--0000010`**,23 aktiv route.
-12 ölkədə **48 xəstəxana/klinika/campus qeydi**, **138 vaksin qeydi / 342 təqvim sətri**;
  rəsmi mənbələr,21 dil və uşağa görə düzgün ölkə/təqvim hesabı.
- Community postları seçilmiş dilə görə, səhifələmədən əvvəl filtrlənir. Qrup
  kəşfi yaradılma dilinə, unread/cache isə backend+hesab+dilə bağlıdır.
- **1059 app testi**,21 dildə local/deployed browser,320–1440px layout və canlı
  Azure SQL yoxlamaları keçib. Premium/Billing bütün21 dildə təsdiqlənib.
- [Müqavilə, ölkə cədvəli və Source operator təhvili](docs/REGIONAL_21.md).

### Əvvəlki veb yeniləmə — 21 dil, 2026-09-24

- Vyetnam, Hindi, Yapon, Koreya, Polyak, Niderland və İsveç dilləri əlavə edilib.
- Hər yeni dildə **11 389 UI açarı**, **14 290 mənbəyə bağlı public məzmun sahəsi**;
  onboarding, Premium, admin, mesajlaşma, bildirişlər, tarixlər və PDF dəstəyi.
- Gateway **v33 / `--0000031`**, Functions **`--0000010`**. Bütün12 əlavə dilin
  browser/API qəbulu, 48 locale-chunk hash yoxlaması və **1010 app testi** keçib.
- [Tam təhvil və Source operator quraşdırması](docs/LOCALIZATION_21.md).

### Əvvəlki veb yeniləmə — 14 dil, 2026-09-23

- Mandarin (sadələşdirilmiş Çin), İndoneziya, Fransız, İspan və Avropa Portuqalcası.
- Hər yeni dildə **11 389 UI açarı** və **14 290 mənbəyə bağlı public məzmun sahəsi**;
  offline seçim, onboarding, admin, cəmiyyət və server bildiriş mətnləri.
- Gateway **v32 / `--0000030`**, Functions **`--0000009`**. Bütün beş dil browser-də,
  320–1440px ölçülərdə və canlı Azure API-də yoxlanıb; **985 app testi** keçib.
- [Tərcümə təhvili, Source operator faylları və native mərhələsi](docs/LOCALIZATION_14.md).

### Əvvəlki veb yeniləmə — admin mərkəzi, 2026-09-23

- Responsiv admin paneli, ayrıca [Premium mərkəzi](https://api.anacan.az/admin/premium),
  serverdə düzgün sayımlar və [bildiriş seqmentləri](https://api.anacan.az/admin/push-notifications).
- Dil/modul/ölkə birlikdə və ayrıca; Premium/platforma/qeydiyyat filtrləri,
  auditoriya snapshot-u, opt-out və idempotent batch göndərişi.
- Cəmiyyət like/rəy aralıqları və44–180px avtomatik şərh qutusu.
- Gateway **v31 / `--0000029`**, Functions **`--0000008`**. **961 app testi** və
  4 ekran ölçüsü qəbuldan keçib. Source quraşdırılması və RevenueCat metrics
  icazəsinin qalan addımları: [təhvil qeydi](docs/ADMIN_CONSOLE_40.md).

### Əvvəlki yeniləmə — reklam davamlılığı, 39.0

- Azure dayansa Source-first reklam konfiqurasiyası Source-dakı təsdiqlənmiş
  nüsxədən işləyir. Source adminində ayrıca dayandırma, Azure adminində sync statusu var.
- Gateway **v30 / `anacan-gateway--0000028`** yayımlanıb; real Source mirror və admin
  CORS/key yoxlamaları keçib. **959 app testi**, platforma başına **24 native routing**
  ssenarisi keçib; **39.0 APK/AAB və development IPA hazırdır**.
- [39.0 reklam müqaviləsi və təhvil](docs/ADMOB_CONTINUITY_39.md).
- [Tarixi iOS 39.0 Xcode / App Store göndərişi](docs/IOS_STORE_39.md).

### Əvvəlki yeniləmə — xarakterli onboarding, 38.0

- Ritm, Tumurcuq, Qucaq; 3 mərhələ və 9 dildə bütöv onboarding. Bütün cavablar,
  tarixlər, körpə qeydləri və dil/bildiriş seçimləri təsdiqlə saxlanır.
- Trial təqdimatı çıxarılıb; illik plan **$29.99 əvəzinə ilk il $19.99**,
  sonra $29.99/il. İllikdən çıxışda aylıq kofe təklifi hesabda bir dəfə göstərilir.
- Ana səhifədə və Premium axınında reklamsız Premium çağırışı əlavə edilib.
- **926 app testi**, hər backend-də **27 canlı UI/data/reload ssenarisi** keçib.
  Gateway **v29 / `anacan-gateway--0000027`**, Functions `--0000007`.
- [38.0 workspace və qəbul](docs/ONBOARDING_38.md) · [App Store / Play / RevenueCat quraşdırması](docs/ONBOARDING_STORE_OFFER.md).
- [Azure dayananda Source-first native davranışı](docs/AZURE_OUTAGE_SOURCE_FIRST.md).

### Əvvəlki yeniləmə — Story / tərcümə / Premium, 37.0

- Story like animasiyası və 9 dildə yeni funksiyaların tam tərcümələri; **Qurucu / İdarəçi**.
- Premium badge server entitlement-i ilə göstərilir və alış/bərpadan sonra yenilənir.
- Source Storage schema uyğunsuzluğu qəbul zənciri qorunaraq həll edilib.
- [37.0 paketləri və qəbul](docs/COMMUNITY_POLISH_37.md) · [Trial/illik qiymət təlimatı](docs/TRIAL_AND_PRICING.md).

### Əvvəlki yeniləmə — Public/Private qruplar / 36.0, 2026-09-21

- Köhnə kateqoriya qrupları çıxarılıb. **Public** qruplara hər kəs qoşula bilir;
  **Private** üçün yaradanın dəvəti və ya təsdiqi tələb olunur.
- Sahib üzv/idarəçi, bloklama, mesaj silmə, qrup ayarları və bağlanmaya nəzarət edir.
  Qruplar Mesajlarda görünür; Community postlarında öz qruplarını etiketləmək olur.
- Source/Azure canlı API/UI sınaqları keçib. Gateway **v26 / `--0000024`**.
  [36.0 yazışma qrupları və native workspace](docs/GROUP_CHATS_36.md).

### Əvvəlki yeniləmə — mesajlaşma / 35.0, 2026-09-21

- Azure veb **v25 / `anacan-gateway--0000023`**: footersiz DM/partner/group çatları,
  reply/emoji, işlək səs/şəkil/video, Premium badge və staff-only rəylərdə linklər.
- Source-da 10, Azure-da 11 canlı sınaq qrupu keçib. Storage MIME/CORS və təkrar
  Community reply bildirişləri düzəldilib; Source account projection cleanup aktivdir.
- Source-first **35.0** workspace və native təhvil: [mesajlaşma yeniləməsi](docs/COMMUNICATIONS_35.md).
  Native admission source/generation 0; yayımlanmış store versiyası hələ 30-dur.

### Əvvəlki Google/Auth yoxlaması — 2026-09-21

- Azure gateway **v22 / `anacan-gateway--0000020`** üzərində Google və Apple giriş
  ekranlarına keçid, e-mail giriş/qeydiyyat/reload yoxlamaları keçib.
- **51 focused test**, hər iki TypeScript layihəsi, 6 yayımlanmış HTML/entry asset
  müqayisəsi, 4 health və 10 route yoxlaması keçib. İki test hesabı təmizlənib, qalıq 0.
- İstifadəçinin qərarı ilə Apple və RevenueCat preview aktiv qalır. Real Google
  consent → əvvəlki eyni hesab/UUID → reload qəbulu [istifadəçi təhvilindədir](docs/AZURE_GOOGLE_PREVIEW_HANDOFF.md).
- Yayımlanmış **30** və [iOS **31** namizədi](docs/IOS_RELEASE_31.md) source-first-dir;
  canlı admission **source / generation 0**-dır. [Source uyğunluğu](docs/SOURCE_RUNTIME_COMPATIBILITY.md).
- Cari revisions, callback/site URL və nəticələr:
  [21 sentyabr provider recheck](azure-migration/ops/PROVIDER-RECHECK-2026-09-21.md).

Əvvəlki buraxılış qeydləri aşağıda tarixləri ilə saxlanılır.

### Menstruasiya yeniləməsi — 2026-09-14

Azure-da təqvim su alətindən əvvələ keçirilib. Gündəlik “Axın oldu / Had flow”,
çoxgünlük seçim və intensivliyin silinmədən redaktəsi əlavə olunub; tək gün yazmaq
period proqnozunu 1 günə endirmir. Canlı sınaq və SQL qəbul nəticələri:
`azure-migration/ops/FLOW-DAILY-2026-09-14.md`.

## Loqo düzəlişi / Xcode upload layihəsi 30.0

Giriş ekranında yerli Anacan loqosu göstərilir. Yeni iOS web bundle və production
entitlement-li Xcode layihəsi hazırdır; 56 native fayl/resurs, əvvəlki App ID/team,
capability və SPM mənbələrinin qorunması yoxlanıb.
[Xcode layihəsini açmaq və mövcud app-a göndərmək](docs/XCODE_UPLOAD_30.md).
[Android AAB və iOS/Android koordinasiyalı publish](docs/STORE_SUBMISSION_30.md).

## Source-first native candidate 29.0 — 2026-09-13

**APK/AAB və iOS development IPA hazırdır.** Namizəd canlı source backend və mövcud
sessiya açarı ilə başlayır; Azure keçidi server admission qapısına bağlıdır.
[Paketlər, hash-lər və yekun qəbul](docs/AZURE_RELEASE_CANDIDATE_29.md).

`spawn az ENOENT` düzəldilib və məhdud GUI PATH ilə yoxlanıb. Real Source→Azure
refresh/UUID/revocation rehearsal-i keçib; 29.0 ilk target API sorğusundan əvvəl
Azure JWT-si alaraq köhnə Source JWT 403 problemini bağlayır.

116 focused app, 60 auth-handoff, 40 CLI/reconciliation/context testi, platforma başına
12 bundled SDK sınağı və bütün paket hash/imza yoxlamaları keçib. Final source sync və
mağaza/device/manual-release mərhələləri tamamlanana qədər production cutover **NO-GO**-dur.
[Rehearsal nəticələri](docs/AZURE_AUTH_REHEARSAL.md) · [Final sync sırası](docs/AZURE_FINAL_SYNC_AFTER_APPROVAL.md).

## Azure native test build 27.0 — RevenueCat aktiv

**Android APK/AAB və iOS development IPA hazırdır.** Backend `https://api.anacan.az`;
eyni app ID/WebView hostname saxlanılır. iOS IPA mövcud 2 qeydiyyatlı cihaz üçündür.
[Artefaktlar və quraşdırma](docs/AZURE_NATIVE_PREVIEW_BUILD.md) ·
[27.0 build statusu](azure-migration/native-preview/native-20260912t201621-e9264295/build-android.json).

100 focused test, 49 backend/SQL testi və native imza/paket/routing yoxlamaları keçib.
RC SDK/sync və ayrıca Sandbox webhook preview üçün aktivdir; auth cutover `false` qalır.
iOS Google nonce uyğunluğu serverdə düzəldilib və istifadəçi girişi təsdiqləyib.
[RC sınağı](docs/AZURE_REVENUECAT_PREVIEW.md) ·
[Mağaza təsdiqindən sonra final sync](docs/AZURE_FINAL_SYNC_AFTER_APPROVAL.md).

## Tarixi Azure Google / Apple preview — 2026-09-12

**Veb sınağı:** https://api.anacan.az/ — Google və Apple düymələri aktivdir.
Apple `.p8`-siz Apple JS → Azure ID-token yolundan istifadə edir. Hər iki provider-in
identifier ekranı yoxlanıb; tam giriş və eyni hesab/UUID istifadəçinin öz hesabı ilə
hələ təsdiqlənməlidir.

- Gateway: `anacan-gateway--0000010`, image tag `v11-source-admission-20260913-1105`.
- Auth: `anacan-auth--0000004`; REST API: `anacan-rest--wxj8me2`;
  Functions: `anacan-functions--0000005`.
- Focused testlər **88/88**, o cümlədən Apple state/nonce/replay və routing testləri; hər iki TypeScript
  layihəsi keçib. Build flag-ləri: pairing `true`, auth cutover `false`, Google
  preview `true`, Apple preview `true`.
- RevenueCat preview aktivdir; Epoint/legacy payment və population cron gates
  bağlıdır. Production cutover statusu **NO-GO** olaraq qalır.

[Google istifadəçi sınağı](docs/AZURE_GOOGLE_PREVIEW_HANDOFF.md) ·
[Apple veb istifadəçi sınağı](docs/AZURE_APPLE_WEB_HANDOFF.md) ·
[Apple native cihaz planı](docs/AZURE_APPLE_NATIVE_TEST_PLAN.md) ·
[Provider hazırlığı](docs/AZURE_PROVIDER_SETUP.md)

Yerli, Git-dən kənar ops sənədləri: `azure-migration/README.md`,
`azure-migration/CUTOVER.md`, `azure-migration/ops/APPLE-WEB-2026-09-12.md`.
Son credential-free arxivin yolu və SHA-256-sı `azure-migration/handoffs/LATEST.json`-dadır.

## Development

Main code: `src/`. Google runtime/native/deployment tooling: `azure-migration/google-cloud/`.
Follow `AGENTS.md` and [the application baseline](docs/APPLICATION_BASELINE.md).
With the existing local Google public configuration available:

```sh
npm run dev
npm run build
```

These commands use `--mode google` and `https://api.anacan.az`. Root `.env` serves
legacy compatibility; Azure work uses explicit Azure mode. Native store candidates
use isolated workspaces and verified Google managed admission, session and signing configuration.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Use the active Google build/deploy tooling under `azure-migration/google-cloud/`.
Keep canonical API/signup, current website/control overlay, Google-private credentials
and enabled timers as described in [the completed cutover](docs/GOOGLE_POPULATION_CUTOVER_20261007.md).
The signed iOS/Android delivery is [47.0](docs/RELEASE_47_GOOGLE.md); the next common native
version is48. Final Source migration operations are already completed and are not replayed.

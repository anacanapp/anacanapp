# Brend reklam portalı — web-only

## Ünvan və giriş

- Brendlər: **https://api.anacan.az/brands**
- Source administratoru: **https://api.anacan.az/brands/manage**
- Database/Auth: mövcud Lovable/Source layihəsi `tntbjulojatnrqmylorp`.

Administrator `/brands/manage` yolunda Source admin hesabı ilə daxil olur,
brend yaradır, iş e-poçtu və ən az12 simvolluq şifrə ilə brend hesabı açır və
mövcud Source bannerlərini həmin brendə təyin edir. Brend öz email/şifrəsi ilə
`/brands` ünvanına daxil olur. İstifadəçi özü brend üzvlüyü yarada bilmir.

Portal brendə təyin edilmiş reklamları, statusları, tarix/yerləşim filtrlərini,
göstərim/klik/CTR, platforma bölgüsünü və CSV ixracını göstərir. Brendə hesabatlara
baxış verilir; hesab, üzvlük, şifrə sıfırlama və reklam təyinatı administrator üçündür.
Mövcud şəxsi hesabı ayrıca qoşmaq mümkündür, lakin həmin şəxsi hesabın şifrəsini
portalın admin reset funksiyası dəyişmir — reset yalnız bu portalın yaratdığı,
server metadata-sı ilə brendə bağlı idarə olunan hesablar üçündür.

## Ayrı sessiya və tenant sərhədi

- Portalın Supabase storage key-i `anacan-brand-portal-auth-v1:source`-dur.
- Əsas tətbiqin AuthProvider, offline query cache, Customer.io, RevenueCat və
  App Lock başlanğıcı portalda yüklənmir. Çıxış yalnız portal sessiyasına təsir edir.
- Portalın query cache-i yalnız yaddaşdadır; actor/brend dəyişəndə təmizlənir.
- `ad_brand_members` üzvlüyü hər report/export RPC-sində serverdə yoxlanır.
  URL-də başqa brend UUID-si yazmaq məlumat vermir. Üzvlük ləğv olunanda yeni
  hesabat və ixrac sorğuları dərhal rədd edilir.
- Altı private relation-da birbaşa anon/authenticated/service-role oxu/yazma bağlıdır;
  yalnız scope-lanmış RPC-lər işləyir. Son istifadəçi səviyyəsində analytics verilmir.

`src/brand-portal/` ayrıca21-dilli mətn bazasından istifadə edir. Ümumi inline
lokallaşdırma plugin-i bu qovluğa consumer `tr/i18n` importu əlavə etmir: belə bir
importun consumer SDK-ni başlayıb başqa sessiyanı dəyişdirməsi canlı QA-da aşkar
edilib və aradan qaldırılıb.

## Mobil tətbiq

Portal responsive mobil brauzerdə işləyir, amma **native tətbiq ekranı deyil**.
Native web builder `VITE_NATIVE_BUILD=true` təyin edir; portalın dinamik import
qolu və auth/UI kodu bundle-dən çıxarılır. Runtime native yoxlaması da giriş
qolunu bağlayır. Native43 və Store43 paketləri yenidən qurulmayıb və dəyişməyib.

## Reklam ölçmələri

Yeni client `get_banner_inventory_v2` ilə eligibility-ni serverdən alır.
Brend reklamı yarıdan çox görünən sahədə fasiləsiz1 saniyə olduqda və ya etibarlı
keçidə klik edildikdə, actor/creative/platform/language-ə bağlı delivery receipt-i
üzərindən ölçmə yazılır. Təkrarlar serverdə deduplikasiya olunur. Admin və həmin
brendin üzvlərinin öz reklam baxışları ölçülmür. Premium və qarşılıqlı ailə Premium-u
brend reklamlarını həm yeni RPC, həm də köhnə native banner SELECT yolu üçün bağlayır.

Köhnə native43 client-lərin əvvəlki kumulyativ sayğacları ayrıca **legacy** kimi
göstərilir. Onlardan saxta gündəlik/platforma tarixi və ya yeni viewability CTR-si
yaradılmır. Gələcək native namizəd yeni measurement client-ini eyni source-dan alır.

## Source quraşdırması və yoxlama

- Runtime: `source-brand-ads-v1`.
- SQL SHA256: `230e89e083c191f50a21afe9cf8bbc04b983efcfdd21e30d8722e8145736888b`.
- Catalog: `e17e792d8f5b6ce4c380a7ecb01589dac18f7c3ff81d1427b52fd8d296c5e76d`.
- Source282 relations /18 receipts, writer open/generation0, əvvəlki5 cron və
  accepted/pending zəncir saxlanıb. Yeni6 relation CDC və writer guard-a qoşulub.
- `brand-portal-accounts` Source Edge Function-u real admin token/rol yoxlayır;
  built-in server secret-ləri istifadə edir, şifrəni log və audit payload-ına yazmır.
-1227 app testi,26 SQL/CDC/tenant/measurement testi,5 account-function testi və
  lokallaşdırma sərhədi testi keçir.
- Canlı Source QA: admin UI-dan hesab yaratma, email/password login, foreign-brand
  API/URL denial, CSV izolyasiyası, revocation, ayrıca logout, idarə olunan şifrənin
  reset-i və responsive web. Bütün owned fixture-lər təmizlənir.

Evidence: `azure-migration/ops/brand-portal-source-installed.json`,
`brand-portal-app-tests.json`, `brand-portal-acceptance.json`,
`brand-portal-native-check-build.json`, `brand-portal-function-deploy.json`.

## Lovable kod uyğunlaşdırması

Mövcud layihə: `e07ee1f9-3d58-48fe-a7a0-068ecf028173`.
Cari worktree əsas götürülür; application source, asset, build config və server
function faylları manifest/hash ilə eyni layihəyə köçürülür. İlk1914 faylın hamısı
hash ilə təsdiqlənib və preview build keçib. Son sessiya-izolyasiya düzəlişləri də
yoxlanmış delta ilə həmin manifestə əlavə edilir.

Generated Source types yenilənib; shared Azure yolunun əvvəlki iki RPC type
declaration-u application-owned `database-types.ts` qatındadır. Quota-safe preview
storage və canonical-response düzəlişi application-owned `authStorage.ts`-dədir.
Lovable öz generated `types.ts` və `previewAuthStorage.ts` fayllarını yeniləyəndə bu
runtime düzəlişləri itmir. Operator credential-ləri və
native imzalama/artifact faylları code arxivinə daxil edilmir.

Final source-sync evidence: `azure-migration/ops/lovable-application-sync-task.json`,
`lovable-application-sync-manifest.json` və final delta/remote-file acceptance receipt-ləri.

## Auth Hook — qalan platforma addımı

`public.moderator_before_user_created_v1(event jsonb)` artıq Source-da mövcuddur;
`supabase_auth_admin` EXECUTE icazəsi var, anon icazəsi yoxdur. Bu istifadəçi sorğusu
üçün Lovable layihəsinin öz agenti ilə yenidən yoxlanılıb: hazır authenticated
alətlər Auth PostgreSQL hook binding-ini nə oxuya, nə də yaza bilir.

Lovable Cloud support/operator-dan tələb edilən dəqiq əməliyyat:

> Project `e07ee1f9-3d58-48fe-a7a0-068ecf028173`, Source ref
> `tntbjulojatnrqmylorp`: mövcud binding-i əvvəl yoxlayın və varsa qoruyun.
> Auth **before-user-created** hook-unu
> `pg-functions://postgres/public/moderator_before_user_created_v1` ünvanına bağlayın.
> Database, digər auth settings, cron və user məlumatlarını dəyişməyin.
> Binding nəticəsini qaytarın; sonra owned signup/IP canary ilə observe/enforce
> qəbulu operator tərəfindən aparılacaq.

Hazırda IP mode **off**-dur. SQL funksiyasını bir dəfə çağırmaq və ya `config.toml`
yazmaq canlı hosted Auth binding-inin sübutu kimi qəbul edilmir.
Evidence: `azure-migration/ops/source-auth-hook-task.json`.

## Brend reklamları v3 — lead forma, şablonlar, hədəfləmə, auditoriya (2026-10-22, yalnız kod)

Status (2026-10-22): **SQL Google bazasında quraşdırılıb; web (gateway) deploy gözləyir.**
Əvvəl `anacan-database-backup` ilə yoxlanmış backup (`base_000000010000007D00000051`), sonra
`/home/anacan-runner/38-brand-ads-v3.dryrun.sql` (ROLLBACK) və `38-brand-ads-v3.sql`
(`run-sql.py`, sha256 `e2e40ac1…11bf`) tətbiq edilib; `38b-…-reload.sql` PostgREST cache-ni yeniləyib.
Yoxlama: 3 yeni relation `pgadmin`, RLS, `guarded_relations` + 3 CDC/guard trigger; anon RPC-lər `42501`;
mövcud 10 bannerdən heç biri v3 deyil; phase `active`.

**Portal (2026-10-22, canlı):** bu qovluq canlı 47.0 consumer build-dən geridə olduğu üçün (16 modul və
tərcümələr yalnız canlıda) consumer tətbiq yenidən yığılmayıb. Canlı portal köhnə lokal portalla eyni
(5 RPC, mətn açarları, 2271 brend mətni) olduğundan v3 portal **ayrıca bundle** kimi əlavə edilib:
`brands-portal.html` + `src/brand-portal/standalone.tsx`, build:
`VITE_BRAND_PORTAL_BACKEND=managed-v1 npx vite build --config vite.brands.config.ts --mode google`.
Gateway image = canlı `69fa51…` + `/usr/share/nginx/html/brands-app/index.html` + 3 hash-li asset +
nginx-də yalnız `location = /brands` və `^~ /brands/`. Cloud Build `99f7924d…` (`anacan-build`) →
`gateway@sha256:e7f844a8…`; VM-də izolə test konteyneri canlı ilə eyni (healthz, `index.html` sha
`a9f0fcfa…`, admission, auth proxy); `deploy-current-web.py brands-v3-web-plan.json` → passed,
əvvəlki konteyner `anacan-gateway-before-refresh-1792678242` rollback üçün saxlanılır.
Consumer tərəfi (lead forma paneli, şablonlar, Premium hədəfləmə) ən son tətbiq mənbəyinə birləşdirilib
native 48 / növbəti web build ilə çıxmalıdır; DB artıq hazırdır və köhnə klientlər təsirlənmir.

- SQL: `supabase/migrations/20261022120000_brand_ads_v3.sql`; CDC sorğusu: `…_brand_ads_v3.cdc.json`
  (yeni `ad_lead_forms`, `ad_leads`, `ad_creative_drafts`; dəyişən `banners`, `ad_delivery_receipts`).
  Cron/timer əlavə edilmir; v1/v2 RPC-lər və legacy sayğaclar dəyişmir. Operator addımı:
  `get_banner_inventory_v2`-yə `AND NOT b.requires_v3` əlavə edilməlidir.
- Hədəfləmə (`get_banner_inventory_v3`, serverdə): `audience_tiers` (free/premium/hər ikisi; boş =
  köhnə davranış — brend reklamı yalnız free), hamiləlik həftəsi min/max və dəqiq siyahı, uşaq yaşı
  (gün; portalda ay da), mərhələ/dil/ölkə. Həftə və uşaq yaşı pəncərələri OR ilə birləşir.
  Premium-a brend reklamı yalnız brend Premium-u açıq seçəndə göstərilir (istifadəçi qərarı, 2026-10-22).
- Native şablonlar: classic, spotlight, split, minimal, offer, expert (`NativeAdCard`, `native-ads.css`):
  light/dark token-ları, logical property (RTL), blur və sonsuz animasiya yoxdur.
- Lead forma: banner `link_type = 'lead_form'` tətbiqdaxili paneli açır. Cavablar `ad_leads`-də
  saxlanır, profil/hamiləlik/uşaq məlumatı yazılmır; yalnız brendin aktiv üzvləri `brand_leads_v1`
  ilə görür, hər oxu/ixrac `ad_brand_audit`-ə yazılır, admin cavabları görmür. Saxlama ≤90 gün
  (oxu/göndəriş zamanı silinir), razılıq məcburi, 30 gün/forma deduplikasiya, 10/gün limit.
- Brend qaralama → admin təsdiqi: `/brands/:id/creatives`, `/brands/:id/leads`; `/brands/manage`-də
  təsdiq növbəsi. Təsdiqlənmiş yeni kreativ **deaktiv** yaradılır, admin aktivləşdirir.
- Auditoriya (`brand_audience_report_v1`, `/brands/:id/audience`): yalnız tək ölçülü bölgülər
  (yerləşim, platforma, dil, ölkə, üzvlük, mərhələ, trimestr, həftə aralığı, uşaq yaş aralığı);
  k=20 fərqli insan, kiçik qruplar "Digər"-ə birləşir və tamamlayıcı gizlətmə tətbiq olunur;
  dövr ≥7 gün. Qəbzə yalnız kobud bucket-lər yazılır (dəqiq həftə/gün yox).
- Portal mətnləri: `scripts/i18n/brand-portal-v3-copy.json` (21 dil); tətbiq mətnləri:
  `scripts/i18n/brand-lead-copy.json` (21 dil). Inline localization-a yeni consumer açarı əlavə olunmayıb.

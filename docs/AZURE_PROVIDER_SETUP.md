# Azure — xaricdən tamamlanacaq inteqrasiyalar

## Cari status — 2026-09-21

- **Google / Apple veb preview:** https://api.anacan.az/. Hər iki UI flag-i `true`;
  pairing `true`, `VITE_AUTH_CUTOVER=false`. Apple JS popup → ID-token yolu `.p8` tələb etmir.
- Auth `anacan-auth--0000005`, REST `anacan-rest--wxj8me2`, gateway
  **v22 / `anacan-gateway--0000020`**, Functions `anacan-functions--0000005`.
- Google server secret-i və RevenueCat API/webhook secret-ləri Azure Key Vault-da
  managed-identity reference ilə hazırlanıb. RC preview aktivdir; Epoint/legacy payment və cron bağlıdır.
- Google identifier ekranına keçid keçib; **successful callback və eyni UUID/hesab
  browser acceptance-i ayrıdır**. Native iOS Google girişi hotfix-dən sonra user
  tərəfindən təsdiqlənib. [İstifadəçi sınağı](AZURE_GOOGLE_PREVIEW_HANDOFF.md).
- Apple identifier ekranı da keçib; **tam giriş / eyni UUID PENDING**.
  [Apple veb istifadəçi sınağı](AZURE_APPLE_WEB_HANDOFF.md).
- Apple native iOS üçün ayrıca [Azure-only cihaz planı](AZURE_APPLE_NATIVE_TEST_PLAN.md)
  var. RC aktiv 27.0 tarixi test build-idir; yayımlanmış 30 və [cari 31 namizədi](IOS_RELEASE_31.md)
  source-first-dir. Yeni birbaşa Azure cihaz sınağı ayrıca workspace tələb edir.
- Android APK üçün mövcud yerli signer-in SHA-1/SHA-256-sı istifadəçi təsdiqi ilə
  eyni Firebase app-a əlavə edilib; əvvəlki 3 fingerprint saxlanılır. Native Azure
  RevenueCat SDK/alış/restore/sync 27.0-da explicit preview flag-i ilə aktivdir; source davranışı saxlanılır.
- iOS Google nonce xətası Google-provider-specific compatibility ayarı ilə həll edilib;
  istifadəçi girişi təsdiqləyib. Apple nonce və JWT signature/audience/expiry yoxlamaları saxlanılır.
- 21 sentyabr recheck: **51 focused test**, hər iki TypeScript layihəsi, Google/Apple
  identifier ekranları və dörd canlı Auth qrupu keçib. İki test hesabı 96 cədvəl üzrə
  təmizlənib, qalıq 0. [Cari nəticələr](../azure-migration/ops/PROVIDER-RECHECK-2026-09-21.md).
- İstifadəçi Apple/RC preview-ni aktiv saxlamağı təsdiqləyib. RC sandbox qəbulu açıqdır;
  son 16 sentyabr operator inventarında Source/Azure webhook-ları Production + Sandbox
  idi. Final production tək-writer ownership ayrıca həll edilməlidir.
- SMTP artıq konfiqurasiya olunub; recovery-mail receipt/reset-page açılışı 16 sentyabrda
  operator tərəfindən təsdiqlənib. Native admission yenidən **source / generation 0**-dır.

Konsollarda addım-addım icra, bütün callback URL-ləri və fayl adları:
[AZURE_PROVIDER_STEPS.md](AZURE_PROVIDER_STEPS.md).

Bu sənəd növbəti mərhələdə Epoint, RevenueCat, Google və Apple qoşulması üçün
ayrıca təhvil sənədidir. Açarların olmaması mövcud Azure hazırlığını saxlamır.
Burada gizli dəyər yoxdur; açarları söhbətə, Git-ə, `VITE_*` dəyişənlərinə və
build context-ə əlavə etməyin.

## Saxlanılan fayllar

`azure-migration/` tamamilə Git-dən kənardadır. Aşağıdakılar yerli diskdə saxlanılır:

| İnteqrasiya | Hazırlanmış fayllar |
| --- | --- |
| Epoint | `azure-migration/edge-runtime/overrides/epoint-payment/index.ts`, `azure-migration/sql/05-payment-safety.sql` |
| RevenueCat | `azure-migration/edge-runtime/overrides/_shared/revenuecat-sync.ts`, `azure-migration/edge-runtime/overrides/revenuecat-webhook/index.ts`, SQL05 + `sql/08-revenuecat-activation.sql` |
| Event push | `azure-migration/edge-runtime/overrides/send-push-notification/index.ts`, `azure-migration/sql/07-push-safety.sql` |
| Sessiya keçidi | `azure-migration/auth-handoff/`, `src/integrations/supabase/auth-storage-key.ts`, `src/lib/session-persistence.ts` |
| Deploy/test | `azure-migration/scripts/prepare-edge-runtime.mjs`, `deploy-functions.mjs`, `azure-migration/edge-runtime/*test.mjs` |
| Provider staging/preflight | `azure-migration/scripts/provider-inputs.mjs`, `stage-provider-config.mjs`, `azure-migration/ops/verify-provider-staging.mjs` |
| Google web release | `azure-migration/ops/verify-api-auth.mjs`, `verify-google-web-start.mjs`, `verify-preview-web-artifact.mjs`, `deploy-preview-image.mjs` |
| Apple JS web release | `src/lib/apple-web-auth.ts`, `azure-migration/scripts/stage-apple-web-config.mjs`, `azure-migration/ops/verify-apple-web-start.mjs`, `azure-migration/gateway/apple-auth-callback.html` |

Həqiqi deploy digest-ləri və son test nəticələri: `azure-migration/README.md`,
`azure-migration/ops/PROVIDER-RECHECK-2026-09-21.md`,
`azure-migration/ops/REVENUECAT-ACTIVATION-2026-09-12.md`, `azure-migration/CUTOVER.md`.
Production keçidi həmin sənədlərin acceptance şərtlərindən asılıdır.

## 1. Epoint

**Çatışmayan:** merchant private key, provider tərəfindən təsdiqlənmiş callback
müqaviləsi və ödəniş/refund sertifikasiyası. Public key mövcuddur; private key
hazırda nə Azure-da, nə ilkin snapshot-da var. Mövcud `epoint_mode` — `live`.

- Hazırkı Azure handler `app_settings` cədvəlindən `epoint_public_key`,
  `epoint_private_key`, `epoint_mode` oxuyur. Bunlar yalnız operator/admin və server
  üçün əlçatan olmalıdır. `epoint_private_key` Vite/client açarı deyil.
- Hazırkı kod test rejimini ödənilmiş kimi göstərmir: `test`/çatışmayan merchant
  `payment_merchant_not_live` ilə rədd edilir. Sandbox dəstəyi kimi təqdim edilməməlidir.
- Son callback: `https://api.anacan.az/functions/v1/epoint-payment?action=callback`.
  Yalnız son gateway/DNS həmin origin-ə qoşulandan sonra provider konsolunda tətbiq edin.
- Preview callback: `https://anacan-gateway.grayocean-6fd65b89.westeurope.azurecontainerapps.io/functions/v1/epoint-payment?action=callback`.
  Canlı merchant callback-ini hazırda preview-yə çevirməyin.
- Success/error: son veb origin-də `/payment/success` və `/payment/error`.
  Brauzerdə bu səhifəyə çatmaq ödənişin təsdiqi deyil; authoritative nəticə DB/provider-dir.
  Azure return səhifəsi hazırda gözlənilən təsdiqi göstərir; provider mərhələsində
  yalnız caller-owned transaction/order ilə bağlanmış DB yoxlamasından sonra
  uğurlu nəticə göstərilməsi tamamlanmalıdır.
- Client artıq URL-ni `VITE_SUPABASE_URL`-dən qurur; project ID ilə Supabase hostname yaratmır.

**Dəstəklənən:** DB qiyməti və strukturlaşdırılmış məhsulları təsdiqlənən shop
sifarişi; yalnız işçi tərəfindən müsbət qiyməti təsdiqlənmiş cake/album sifarişi;
tam məbləğli admin refund. Məbləğ, valyuta və provider reference müqayisə edilir.

**Bağlı qalan:** premium/general, qismən refund, köhnə sertifikasiyasız payment
sətirləri, yoxlanmamış endirim, qeyri-müəyyən nəticədən sonra avtomatik təkrar.
Erkən/qarışıq callback, `refund_pending` və uğursuz provider cavabı operator
reconciliation tələb edə bilər. Köhnə sətrlərə `epoint_contract_version=1` yazmayın.

**Qoşulma ardıcıllığı:** credential-i server tərəfində qorunan qaydada yerləşdir;
SQL05 tətbiq statusunu yoxla; tək operator fixture sifarişi ilə create/callback/status,
yanlış məbləğ/valyuta/imza, duplicate/reordered callback və full-refund yoxlamalarını
keçir; bundan sonra həm `ENABLED_FUNCTIONS`-ə `epoint-payment` əlavə et, həm
`ENABLE_EPOINT_PAYMENTS=true` ver. Cari deploy aləti financial gate-ləri bilərəkdən
bağlı saxlayır; provider mərhələsində dar, test edilmiş deploy dəyişikliyi tələb olunur.

## 2. RevenueCat

**2026-09-12-də Key Vault-a alınıb və Functions managed identity-si ilə qoşulub:**

| Key Vault secret adı | Function env adı |
| --- | --- |
| `REVENUECAT-SECRET-API-KEY` | `REVENUECAT_SECRET_API_KEY` |
| `REVENUECAT-WEBHOOK-SECRET` | `REVENUECAT_WEBHOOK_SECRET` |

SDK public key server REST açarını əvəz etmir. Webhook secret ən azı 32 simvol,
müstəqil təsadüfi dəyər olmalıdır. Functions managed identity-yə yalnız həmin
secret scope-larında `Key Vault Secrets User` rolu və Key Vault env reference verilib.
`ENABLE_REVENUECAT=true`; RC sync/webhook allowlist-dədir. Preview sandbox qəbul edilir.

V1 preflight-də boş müvəqqəti customer yaradılıb, entitlement/purchase sayı sıfır
olub və DELETE 200 → 404 ilə silinməsi təsdiqlənib. Açarın v1 tərəfindən qəbulu
müstəqil project/product/store mapping sübutu deyil. Yerli deklarasiya: project
`a3647ee8`, iOS app `appaedb35b823`, Android app `appcbfb47e107`, entitlement
`Anacan LLC Pro`. Product/package/base-plan mapping SDK offerings API-dən təsdiqlənib;
istifadəçi mövcud Transfer-to-new-ID siyasətini təsdiqləyib. **Real store lifecycle və
credential acceptance hələ ayrıca sınaqdır.** [RC preview qaydası](AZURE_REVENUECAT_PREVIEW.md).

- Webhook: son origin-də `/functions/v1/revenuecat-webhook`.
- Konsoldakı Authorization header serverdəki webhook secret ilə eyni olmalıdır.
- `app_user_id` mövcud `auth.users.id` UUID-si olaraq qalır. App/entitlement/product
  mapping, restore purchases və store environment-ləri ayrıca təsdiqlənməlidir.
- Handler entitlement üçün client/webhook məbləğinə yox, RevenueCat REST
  cavabına əsaslanır. DB xətası uğur kimi ACK edilmir. Referral reward atomik və once-only-dir.
- **TRANSFER:** tanınan UUID-lərin hər iki tərəfi provider truth-dan atomik yenilənir.
  Naməlum/custom və ya hələ Azure-a gəlməmiş hesab yarımçıq tətbiq edilmir, reconciliation
  tələb edir. Sandbox/TRANSFER referral reward yaratmır; stale snapshot qoruması var.
- Yoxlamalar: purchase, renewal, cancellation, expiration, trial, refund,
  duplicate/out-of-order event, provider/DB müvəqqəti xətası və account transfer.
- Native 27/server preview aktivləşdirilib; istifadəçi ayrıca Sandbox webhook TEST-in
  200 olduğunu təsdiqləyib. Real store əməliyyatları və production ownership cutover ayrıca qalır.

## 3. Google / Apple giriş

**Cari Apple veb yolu:** rəsmi Apple JS popup (`web_message`) → Azure
`signInWithIdToken`. Services ID `com.atlasoon.anacan.signin`, təsdiqlənmiş primary
App ID `8B6976J8H7.com.atlasoon.anacan`. Return URL
`https://api.anacan.az/auth/apple/callback` Apple tərəfindən qəbul edilib. Azure
audience siyahısında həm Services ID, həm əvvəlki `com.atlasoon.anacan` saxlanılır.
Bu yol `.p8` / OAuth client-secret tələb etmir; mövcud key-lər revoke edilməyib.

**Native iOS dəqiqləşdirməsi:** hazırkı Apple native helper Apple identity token-i
Supabase `signInWithIdToken`-a göndərir. Bu konkret GoTrue `id_token` yolu developer
`.p8` / OAuth client-secret tələb etmir; enabled provider, düzgün audience, Apple
imzası/expiry/nonce və hesab mapping-i tələb olunur. Web/Android redirect axını və
server Apple token/grant revocation üçün private-key/client-secret işi ayrıca qalır.
P8 olmaması native iOS hazırlığını dayandırmamalıdır. Artefakt sübutu:
`azure-migration/ops/NATIVE-AUTH-ROUTING-2026-09-11.md`.

Canlı Auth konfiqurasiyası:

```text
API_EXTERNAL_URL=https://api.anacan.az
GOTRUE_SITE_URL=https://api.anacan.az
Google/legacy OAuth callback=https://api.anacan.az/auth/v1/callback
Apple JS Return URL=https://api.anacan.az/auth/apple/callback
```

- Google: ayrıca Azure Web client ID/secret serverdə qoşulub, canonical callback
  qeydiyyatı və client-auth negative-control preflight-i keçib; üç Web/native
  audience saxlanılır. Native Firebase/Google client identity-lərini və
  mövcud Android package/signing fingerprint-lərini dəyişməyin.
- Apple server OAuth code exchange / grant revocation üçün Team ID, Services ID,
  Key ID, `.p8` və müddətli client-secret işi ayrıca qalır. Bunlar cari JS browser
  login-in və native iOS ID-token yolunun ilkin şərti deyil.
- Vertex AI service-account faylı **Google OAuth client secret deyil**.
  Firebase Admin service account və Google Play publisher service account da
  ayrı icazə sahələridir.
- Hər provider üçün mövcud hesabın eyni UUID/identity subject ilə açılması,
  consent/cancel/expired-state və native geri dönüş fiziki cihazda sınanmalıdır.
- Cari Azure veb Google UI-ni `VITE_AZURE_GOOGLE_OAUTH_ENABLED=true` ilə operator
  sınağı üçün açır. 302 → Google 200 → identifier ekranı keçib; istifadəçi consent,
  successful callback və eyni hesab/UUID hələ yoxlanmalıdır. Bu flag production
  acceptance işarəsi deyil. Apple veb flag-i də `true`-dur; adında `OAUTH` qalsa da
  Azure brauzerində yeni JS/ID-token yolunu açır. Gateway FQDN-də Apple üçün canonical
  `api.anacan.az` linki göstərilir; native/source marşrutları ayrıca saxlanılır.
- Preview hostname son callback-in əvəzi kimi avtomatik qəbul edilmir.

## 4. Legacy store purchase validator

`APPLE_SHARED_SECRET` və `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` ayrıca tələb olunur.
RevenueCat ilə eyni receipt/subscription üçün iki müstəqil writer açmayın.
`ENABLE_PURCHASE_VALIDATION=false` qalır; seçilmiş entitlement authority,
receipt/account/product binding və refund/revocation yoxlaması olmadan açılmır.

## 5. Bildirişlər və Firebase

`FIREBASE-SERVICE-ACCOUNT-JSON` Key Vault-da mövcuddur, layihə `anacan-mobile`-dır.
Event push yalnız SQL07, secret-scope managed identity grant, Key Vault env
reference və guarded fixture sınağından sonra açıla bilər. Real Android/iOS cihazında
FCM/APNs delivery, foreground/background/cold-start və toxunuş naviqasiyası ayrıca qəbul testidir.

`send-bulk-push`, maintenance və beş population-wide Azure job hazırda aktivləşdirilmir.
Job trigger-ləri **Manual**, retry **0** qalır; son one-writer cutover-a qədər
Supabase production bildirişlərinin sahibidir. Fixture sınağı real istifadəçilərə push göndərməməlidir.

## 6. Logout olmadan keçid üçün mənbədən alınacaq məlumat

Yalnız users/identities və `JWT_SECRET` yetərli deyil. **2026-09-16 07:21:12 UTC**
pre-sync-i users, session/refresh lineage və storage-ni əhatə edir; real Source→Azure
fixture refresh/UUID/revocation rehearsal-i də keçib. Final handoff həmin sərhəddən
sonrakı dəyişiklikləri, revocation/rotation, HMAC/counter, AMR/MFA və lazım olan
encryption state-i nəzərə almalıdır. Source Auth writer-ləri freeze/drain olunmadan
son snapshot etibarlı sayılmır.

`VITE_AUTH_CUTOVER=false` qalır. `refresh-before-use-v1` ilk Azure API istifadəsindən
əvvəl Source refresh lineage ilə **target JWT** alır; `/user`, REST, Storage,
Realtime və Functions həmin target sessiyası ilə yoxlanır. Köhnə Source access
JWT-sinin Azure-da birbaşa qəbul edilməsi fərz edilmir. Yayımlanmış 30 və cari 31
namizədi source-first-dir; canlı admission source/generation 0-dır. Legacy Android25
source URL-ni birbaşa daşıyır. Native identity/WebView origin, namespace, tombstone və
adoption receipt-ləri qorunur. [Final keçid](AZURE_FINAL_SYNC_AFTER_APPROVAL.md) və
[pending schema replan](AZURE_INCREMENTAL_SYNC.md) ayrıca tamamlanır.

## Provider fayllarının təhlükəsiz təhvili

Xaricdən gələn `.p8`, service-account JSON və server açar faylları üçün yerli
`azure-migration/provider-inputs/` qovluğu ayrılıb. Google JSON-u və RevenueCat-in
iki server secret faylı artıq alınıb/stage edilib; credential-free arxivə daxil
edilmir. Faylları minimum icazə ilə saxlayın və Key Vault-a alındıqdan
sonra deployment-də yalnız secret reference istifadə edin. Dəyərləri terminal
çıxışına verməyin; status üçün yalnız mövcudluq/ad/versiya yoxlanmalıdır.

Provider fayllarını ayrıca götürəndə bu sənədi, override-ləri, SQL05/07-ni və
uyğun offline testləri birlikdə saxlayın. Yerli migration qovluğunu qoruyan təhvil
arxivinin yolu/sha256-sı `azure-migration/handoffs/LATEST.json`-da göstərilir; arxivə həqiqi credential və
istifadəçi export-ları daxil edilmir.

## 7. E-mail / SMTP

SMTP **Auth `anacan-auth--0000005`** üzərində Key Vault reference ilə qoşulub.
16 sentyabr operator qəbulu recovery e-mailinin çatmasını və reset səhifəsinin
açılmasını təsdiqləyir; `smtp-acceptance-20260916.json`,
`smtp-runtime-1789589878387.json` sübutları `azure-migration/ops/` altındadır.
21 sentyabr recheck konfiqurasiyanın mövcudluğunu təsdiqləyir, yeni e-mail göndərmir.
Tam password-reset lifecycle və gələcək e-mail-confirmation siyasəti ayrıca qəbul edilir.

Mövcud SMTP host, port, istifadəçi və təsdiqlənmiş göndərən konfiqurasiyası saxlanılır.
Şifrə server secret reference ilə verilir. Göndərən
domeninin SPF/DKIM ayarları və son `api.anacan.az`/`anacan.az` reset/confirmation
redirect-ləri yoxlanmalıdır. Mövcud e-mail-confirmation siyasəti ayrıca nəzərə
alınmalı, köhnə hesablar kütləvi şəkildə yenidən təsdiqə məcbur edilməməlidir.

## 8. Yalnız Son Store Buraxılışında Məcburi Yeniləmə

**Cari tətbiqdə public-RPC və native version comparison artıq mövcuddur:**

- `src/hooks/useForceUpdate.ts` yalnız native-də `App.getInfo()` və allowlisted
  `get_public_app_setting('force_update')` çağırır; quraşdırılmış `info.version`
  ilə `min_version` müqayisə edilir.
- `src/pages/Index.tsx` `updateRequired` nəticəsini istifadə edir. Veb, minimuma
  bərabər və daha yeni versiya bu hook tərəfindən bloklanmır.
- Hazırkı interval beş dəqiqədir; offline cihaz yeni remote ayarı dərhal almır.
- Bu müqavilə ümumi `min_version` sahəsidir; ayrıca Android `versionCode` / iOS build
  minimumları və köhnə artıq quraşdırılmış reader-in davranışı avtomatik təsdiqlənmir.

Final store/update acceptance qaydası:

1. Mövcud native-version müqaviləsini hər iki real platformada sınayın. Platformaya
   ayrıca build minimumu lazım olarsa konfiqurasiya/reader müqaviləsi ayrıca versiyalansın.
   Veb store blokuna düşməsin.
2. Minimumdan aşağı build bloklansın; minimuma bərabər və daha yeni build işləsin.
   Şəbəkə/config xətası istifadəçini sonsuz yeniləmə dövrünə salmasın.
3. Köhnə artıq yayımlanmış build-lər üçün source `force_update` oxunuşu yalnız
   həmin təhlükəsiz açara daraldılmış RLS ilə real adi hesabda yoxlansın. Epoint və
   digər secret ayarların SELECT icazəsi genişləndirilməsin. Disabled JSON əvvəlcə
   yoxlanılsın; yeni client kodu hazır olmadan aktivləşdirmə aparılmasın.
4. Android25 source Supabase-ə birbaşa bağlıdır. Tək Azure ayarı həmin build-ə
   çatmır; final legacy yeniləmə siqnalı source tərəfdən gəlməlidir.
5. Yeni versiya hər iki mağazada təsdiqlənib bütün hədəf region/cihazlar üçün
   yüklənə biləndən sonra legacy məcburi yeniləmə açılsın. Store-a göndərilmə və
   review mərhələsində aktivləşdirilməsin. Köhnə client platforma seçimini nəzərə
   almırsa, hər iki mağazanın əlçatanlığı birlikdə gözlənilməlidir.

Keçid ardıcıllığı: provider və sessiya acceptance → imzalı native upgrade sınağı
→ təsdiqlənmiş/əlçatan store buraxılışı → sınaqdan keçmiş legacy update siqnalı və
server write-freeze → son inserts/updates/deletes + Auth refresh lineage →
Azure yazılarının açılması və tək scheduler/webhook sahibi.

Yeni build yayılarkən məlumat parçalanmamalıdır. Bu məqsədlə sabit API qarşısında
əvvəlcə source ilə uyğun işləyən keçid marşrutlaşdırması və ya uyğun yazı-qəbul
qapısı hazırlanıb sınanmalıdır; yeni quraşdırılan build final sync-dən əvvəl
müstəqil Azure yazılarına və uyğunlaşdırılmamış Auth refresh-ə başlamamalıdır.
Source-first bootstrap və refresh-before-use 30/31-də mövcuddur; canlı policy
hələ source/generation 0-dır. Yeni UI-nin Source uyğunluğu
[eyni kodun müqaviləsi](SOURCE_RUNTIME_COMPATIBILITY.md) ilə təmin edilib. Final
frozen writer/session admission və fiziki upgrade acceptance hələ tamamlanmayıb.

Məcburiyyət köhnə build ilə davam etməyə qoyulur; yeniləməni mağaza/istifadəçi
quraşdırır. Serverdə one-writer qaydası ayrıca lazımdır: UI bloku bütün köhnə,
offline və gecikmiş sorğuları dayandıran database write-freeze deyil.

Qəbul sınağı: mövcud production build + mövcud etibarlı sessiya → mağazadan
update → eyni UUID, məlumatlar və Premium → token expiry/refresh → restart/offline;
yeni build yeniləmə ekranında ilişmir, köhnə build isə onlayn olduqda update tələbi alır.

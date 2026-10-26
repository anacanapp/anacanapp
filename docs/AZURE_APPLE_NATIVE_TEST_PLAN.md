# Apple native iOS — ayrıca Azure-only cihaz sınağı

Status: **cari kod üçün ayrıca Azure-only cihaz sınağı planı**, 2026-09-21.
27.0 development IPA/APK/AAB tarixi Azure test artefaktlarıdır; yeni fiziki cihaz
acceptance-i kimi təqdim edilmir. [Tarixi artefaktlar](AZURE_NATIVE_PREVIEW_BUILD.md).
Yayımlanmış **30** və [cari iOS **31** namizədi](IOS_RELEASE_31.md) source-first-dir;
canlı admission source/generation 0 olduğundan onlar hələ Source backend-i seçir.

Cari vebdə Apple JS/ID-token preview artıq aktivdir; bu, native cihaz qəbulunu
əvəz etmir. Azure Auth həm `com.atlasoon.anacan`, həm web Services ID
`com.atlasoon.anacan.signin` audience-lərini saxlayır. Veb handoff:
[AZURE_APPLE_WEB_HANDOFF.md](AZURE_APPLE_WEB_HANDOFF.md).

## Mövcud kimlik və açarlar

- App/Bundle ID: `com.atlasoon.anacan`; WebView hostname: `app.anacan.az`.
- Native iOS yolu: Apple native authorize → Apple identity token + nonce →
  Azure `signInWithIdToken({ provider: 'apple', token, nonce })`.
- Bu GoTrue `id_token` mübadiləsi developer `.p8` / OAuth client-secret istifadə
  etmir. Apple provider enabled və uyğun audience konfiqurasiyası var; bu fakt
  real iPhone qəbul sınağı deyil.
- Mövcud Sign in with Apple key-ləri `M5NGL2BZYT`, `7LXDF5FG5C` və ayrıca APNs
  key `6A8T7972C2` saxlanılır. Key revoke/rotate, App ID grouping və native signing
  dəyişiklikləri bu test üçün tələb olunmur. İstifadəsiz key barədə fərziyyə edilmir.
- Web/Android Apple OAuth code exchange və server grant/token revocation üçün
  Services ID/private-key/client-secret işi ayrıca açıq qalır.

## İzolyasiya və artefakt qaydası

1. Cari yoxlanmış worktree-dən reviewed tooling ilə unikal test workspace hazırlayın:
   `node azure-migration/scripts/prepare-native-preview.mjs --create --version <N>`.
   `<N>` mövcud store/namizəd nömrələri yoxlandıqdan sonra ayrılmış yeni test versiyasıdır.
   Bu birbaşa Azure development testi üçün `--source-first`/`--ios-store` seçilmir;
   `--ios-store` production-entitlement upload workspace-inin ayrı yoludur.
   Çıxış `azure-migration/native-preview/<run-id>/workspace` altındadır. Mövcud `.env`,
   root `dist`, embedded native assets/AAB və Xcode-managed ayarlar qorunur.
2. Yalnız staging surətində Azure public backend/anon konfiqurasiyasını istifadə
   edin. Server secret, `.p8`, service-role və ya source sessiyası build-ə daxil edilmir.
   Auth realm ayrılığı üçün **`VITE_AUTH_CUTOVER=false`** qalır.
3. Yaradılan run üçün reviewed build/sync alətini işlədin:

   ```sh
   node azure-migration/scripts/build-native-web.mjs <run-id> ios
   ```

   Alət iOS Apple flag-ini açır, `VITE_AUTH_CUTOVER=false` saxlayır, yalnız staged
   workspace-i build/sync edir və bundled routing/asset hash-lərini yoxlayır.
   Apple-only testdə RC flag-i create zamanı açılmır; real purchase ayrıca qəbul edilir.
4. Faktiki embedded client factory URL-si
   `https://api.anacan.az` olmalı, source Supabase-ə Auth/REST/Storage/Functions
   çağırışı olmamalıdır. `web-ios.json` routing sübutu və
   `node azure-migration/scripts/prepare-native-preview.mjs --verify-source <run-id>`
   ilə original assets/signing hash-lərinin qorunmasını təsdiqləyin.
5. Mövcud Apple team/provisioning ilə eyni Bundle ID və Sign in capability saxlanılır.
   Build/DerivedData/archive/export yolları və test build nömrəsi ayrıca seçilir;
   hazır production IPA/AAB/archive üstünə yazılmır və mağazaya upload edilmir.
6. Sınaq üçün ayrılmış fiziki iPhone istifadə edin. Eyni Bundle ID ilə iki app
   yan-yana quraşdırılmır; production istifadəçinin gündəlik cihazını əvəz etməyin.
   Testi asanlaşdırmaq üçün yeni Bundle ID yaratmaq eyni Apple subject acceptance-i deyil.

## Fiziki cihaz acceptance matrisi

| Yoxlama | Tələb olunan nəticə |
| --- | --- |
| Mövcud Anacan Apple hesabı | Apple sheet → Azure ID-token grant → əvvəlki eyni UUID/Apple subject; yeni dublikat hesab yoxdur |
| Təkrar giriş | Apple ad qaytarmasa da əvvəlki ad/profil qalır; “Hide My Email” hesabı eyni kimlikdir |
| Nonce/audience/issuer/expiry | Raw/hashed nonce müqaviləsi və GoTrue-nun faktiki nonce siyasəti yoxlanır; uyğunsuz token qəbul olunmur |
| Cancel / şəbəkə xətası | Saxta uğur/sessiya yaranmır, UI bərpa olunur; istifadəçi açarları revoke etmir |
| Geri dönüş / foreground/background | Native sheet tətbiqə qayıdır, sessiya və profil düzgün yüklənir |
| Expiry / restart / offline return | Yalnız həmin Azure sessiyası refresh edilir və eyni UUID qalır; source session import edilmir |
| Logout | Bu test cihazında Azure logout terminaldır; legacy source backup təsadüfən dirilmir |

Provider-specific nonce siyasətini acceptance-dən əvvəl inventarlaşdırın. Mövcud
`GOTRUE_EXTERNAL_GOOGLE_SKIP_NONCE_CHECK=true` iOS Google compatibility üçündür;
köhnə generic `GOTRUE_EXTERNAL_SKIP_NONCE_CHECK` təsirsizdir. Apple nonce siyasəti
ayrıca yoxlanır; testdən keçirmək üçün zəiflədilmir. Bu recheck Auth signing/session
ayarlarını dəyişdirməyib.

İstifadəçi Apple girişini özü edir. Hesabatda yalnız vaxt, iOS/model/build,
callback/grant nəticəsi, UUID/subject uyğunluğunun boolean nəticəsi və sanitizasiya
edilmiş xəta kodu olsun; identity token, nonce, parol və cookie saxlanılmasın.
İstifadəçinin mövcud hesabı fixture kimi silinmir.

## Store acceptance ayrıca qalır

- Bu test yeni Azure native girişini yoxlayır. Production-dan no-logout upgrade,
  source refresh lineage, store-approved/paylanmış build və version-aware force
  update ayrıca acceptance tələb edir; `VITE_AUTH_CUTOVER=false` qalır.
- RevenueCat mapping və atomik TRANSFER hazırlığı tamamlanıb; real store
  purchase/restore/refund lifecycle və final production ownership ayrıca qalır.
  Apple testi mövcud RC backend preview-ni dəyişmir. Epoint/push/population cron-lar bağlıdır.
- Tarixi Android25 AAB SHA-256:
  `264bb250541ea6a4602287413f3d33317a5a4f000da00a3e89b2290ad83f8b3e`.
  Cari 30/31 artefaktları, hash-lər və source-first qərarı [iş bazasında](APPLICATION_BASELINE.md)
  göstərilir; hazır 31.0 project-i ayrıca Azure-only testlə overwrite edilmir.

Mənbə/routing sübutu: `azure-migration/ops/NATIVE-AUTH-ROUTING-2026-09-11.md`.
Provider kontraktı: [AZURE_PROVIDER_SETUP.md](AZURE_PROVIDER_SETUP.md).

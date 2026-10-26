# Native candidate 29.0 — refresh-before-use / CLI fix

**Hazırdır — 2026-09-13.** Native paketlər yığılıb və yoxlanıb. Source→Azure real
refresh rehearsal-i keçib. Tətbiq hazırda canlı Source ilə başlayır; final admission
gələndə API sorğularından əvvəl Azure JWT-si alır. Production public release hələ
mağaza/device qəbulu və final consistent data/session sync-dən asılıdır.

## Paketlər

| Paket | Fayl | Ölçü |
| --- | --- | --- |
| Android APK | [anacan-source-first-29.0.apk](../azure-migration/native-preview/native-20260913t153930-614773c2/artifacts/anacan-source-first-29.0.apk) | 29,265,375 bytes |
| Android AAB | [anacan-source-first-29.0.aab](../azure-migration/native-preview/native-20260913t153930-614773c2/artifacts/anacan-source-first-29.0.aab) | 28,049,055 bytes |
| iOS development IPA | [anacan-source-first-29.0-development.ipa](../azure-migration/native-preview/native-20260913t153930-614773c2/artifacts/anacan-source-first-29.0-development.ipa) | 18,676,142 bytes |

```text
APK  1699c5fb73ad95f3f98bd24d05edf4ffd1d1f9fe2477b44ac7aae0d7809a6374
AAB  8a7c70ae38187fa217044ae4ab185a1c5467dd5f5d9b64a99709edaeaf3a4a43
IPA  c336b031587537185f9fea90f831c8f0a43b079bc58fe0dd1f2f4d808331ba91
```

App ID `com.atlasoon.anacan`; WebView hostname `app.anacan.az`; ad **Anacan**.
Android minSdk 26 / targetSdk 36, signer original AAB ilə eynidir; 4 64-bit library
və APK ZIP üçün 16 KB alignment keçib. iOS minimum 16.6, team `8B6976J8H7`, mövcud
**2 cihaz** üçün development profilləri. App Store/TestFlight distribution export
və mağazadakı build nömrəsi ayrıca store addımıdır.

Source versiyasının üzərinə update kimi sınaq edin. APK ilə store-installed app
arasında signing fərqi varsa data-nı silməyin; uyğun Play internal-testing/signing
yolu ilə update edin. Eyni app ID production tətbiqi ilə yan-yana ayrıca app deyil.

## 403 necə həll olunur?

Real rehearsal göstərdi ki, Source ES256 access JWT-si Azure-da 403 alır, amma həmin
sessiyanın original refresh-tokeni Azure Auth-da uğurla yeni HS256 JWT-yə dəyişir.
User və session UUID-si qorunur; yeni JWT Auth/REST-dən keçir.

29.0-da `restoreAdmittedNativeSession()` App, analytics, translation overlay və
başqa API çağırışlarından əvvəl işləyir:

1. Source mərhələsində mövcud source storage/backup davranışı istifadə olunur.
2. İlk Azure admission-da native backup bərpa edilir; vaxtı bitməmiş cached Source
   JWT-si olsa da real `auth.refreshSession()` edilir.
3. Serverin qaytardığı user UUID-si gözlənilənlə müqayisə edilir və rotated pair
   Preferences-də davamlı saxlanmadan keçid tamamlanmış sayılmır.
4. `anacan.auth.adoption.v1:https%3A%2F%2Fapi.anacan.az` receipt-i `pending/complete`
   vəziyyətini və handoff hash-ini saxlayır. Eyni handoff-dan sonrakı açılışlarda normal
   cached/offline davranış qalır; hər açılışda əlavə məcburi refresh edilmir.
5. İlk adoption-da şəbəkə, konfiqurasiya və ya missing-row xətası olarsa App/login
   forması açılmır, namizəd backup saxlanır və retry ekranı göstərilir. Revoked token
   uğurlu server grant-i olmadan quraşdırılmır. Tamamlanmış handoff-dan sonrakı normal
   logout/terminal-invalidation qaydaları qalır.

Bu native yol üçün Source signing private key-i və bütün xidmətlərdə Source JWT
verification açılması lazım deyil. Target signer/key/issuer saxlanmalıdır. Köhnə
JWT-ni birbaşa Azure API-yə göndərən başqa client yolu ayrıca overlap/handoff tələb edir.

Final `prepareAzureAdmission()` evidence-də `sessionHandoffMode=refresh-before-use-v1`
seçilirsə minimum native version **29.0** və
`target-signer-preserved-and-refresh-before-use` qəbul sübutu tələb olunur. Bütün
digər final data, writer freeze, session-state, provider ownership və rollback gates
də tələb olunur. 28.0-ı bu refresh-before-use strategiyası ilə Azure-a admit etməyin.

## `spawn az ENOENT` düzəlişi

Azure CLI quraşdırılıb: `/opt/homebrew/bin/az`, version **2.90.0**. GUI/agent Node
proseslərinin PATH-ində Homebrew olmaya bildiyi üçün bütün migration CLI çağırışları
`scripts/azure-cli.mjs` resolver-inə keçirilib. PATH, Apple Silicon/Intel Homebrew
yolları və explicit `AZURE_CLI_PATH` dəstəklənir; shell alias-a etibar edilmir.

`PATH=/usr/bin:/bin` ilə real Node subprocess-də CLI version və aktiv subscription
`abc1c478-3819-4361-939d-268bfb2a3b8c` oxunması keçib. 5 resolver testi və ona bağlı
reconciliation/deploy testləri ilə birlikdə **40 test** keçib.

## Qəbul sübutları

- Real Source→Azure: `azure-migration/ops/auth-rehearsal-1789297847667.json` — original
  refresh, eyni user/session UUID-si, iki rotasiya, Auth/REST və logout/revocation;
  Azure fixture qalıqları 94 public cədvəl + Auth asılılıqları üzrə **0**.
- Source fixture retirement: `azure-migration/ops/auth-rehearsal-1789314407598.json` —
  password grant və refresh rədd edilir, public profile card yoxdur. Bu, API səviyyəsi
  yoxlamasıdır; bütün Source SQL cədvəllərində ayrıca audit aparılmayıb.
- **116 focused app testi**, o cümlədən 15 yeni adoption testi; **60 auth-handoff**
  testi; **40 CLI/reconciliation/context** testi; hər iki TypeScript layihəsi.
- Hər platformanın yığılmış web paketində **12 izolə olunmuş SDK sınağı** keçib.
  Unexpired Source→Azure, ilk target failure, completed cached restart ayrıca
  yoxlanıb; heç bir Source JWT-si target data API-yə göndərilməyib. Şəbəkə bu browser
  sınaqlarında mock-dur; real server grant sübutu yuxarıdakı Source rehearsal-indədir.
- APK/AAB/IPA daxilində 329 JS/CSS hash-i, metadata, signatures/provisioning və native
  identity yoxlanıb. Original assets/signing yoxlaması `changed:[]` qaytarıb.

Tam ops yekunu: `azure-migration/ops/FINAL-CANDIDATE-2026-09-13.md`.

## Qalan real buraxılış addımları

1. Physical native Source→29 update, Google/Apple, restart/offline və store purchase/restore qəbulu.
2. Store distribution signing/upload/review, App Store manual release və Play managed publishing.
3. Təsdiqdən sonra source server-side writer freeze/drain, bütün final data/files və
   session/refresh state üçün consistent sync, prod-only provider/RC reconciliation.
4. Qəbul hesabatları keçəndə minimum 29 ilə Azure admission və manual public release.

Hazır public policy **source / generation 0**-dır. Final bulk migration, source freeze
və public store release edilməyib. Sıra: [AZURE_FINAL_SYNC_AFTER_APPROVAL.md](AZURE_FINAL_SYNC_AFTER_APPROVAL.md).

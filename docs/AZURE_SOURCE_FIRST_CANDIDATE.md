# Source-first native candidate 28.0

**Yeni tamamlanmış namizəd: [29.0 — refresh-before-use və CLI fix](AZURE_RELEASE_CANDIDATE_29.md).**
Bu sənəd əvvəlki 28.0 artefaktlarının qeydidir; refresh-before-use ilə final admission üçün 29.0 istifadə edilir.

**Hazırdır — 2026-09-13.** Bu namizəd başlanğıcda canlı source Supabase-dan istifadə
edir və mövcud source sessiya namespace-ni saxlayır. Azure-a keçid hazırda bağlıdır;
real source refresh/session handoff qəbulundan sonra server admission qərarı ilə açılır.

## Paketlər

| Platforma | Fayl | Ölçü |
| --- | --- | --- |
| Android APK | [anacan-source-first-28.0.apk](../azure-migration/native-preview/native-20260913t070533-56af210d/artifacts/anacan-source-first-28.0.apk) | 29,264,427 bytes |
| Android AAB | [anacan-source-first-28.0.aab](../azure-migration/native-preview/native-20260913t070533-56af210d/artifacts/anacan-source-first-28.0.aab) | 28,048,070 bytes |
| iOS development IPA | [anacan-source-first-28.0-development.ipa](../azure-migration/native-preview/native-20260913t070533-56af210d/artifacts/anacan-source-first-28.0-development.ipa) | 18,675,917 bytes |

```text
APK  fb176c3c282788712c0221a1f3255c85b5593db3d9ebdc55bbb0869d9b007c58
AAB  7273f352d894a4ff828906fa98853ee7540452a840b51cb8a53eadf609c81add
IPA  58c3e6ff14afcca20fc87595e4d8bcaf94b2f7a2dc2211d0d69650389c4fc955
```

Xcode arxivi: `azure-migration/native-preview/native-20260913t070533-56af210d/artifacts/AnacanSourceFirst-28.0.xcarchive`.
Android minSdk 26 / targetSdk 36; iOS minimum 16.6. iOS development IPA mövcud
**2 qeydiyyatlı cihaz** üçündür. App Store/TestFlight üçün distribution export,
mağazadakı son build nömrəsi və cihaz qəbulu ayrıca tamamlanmalıdır.

App adı **Anacan**, app ID `com.atlasoon.anacan`, WebView hostname `app.anacan.az`.
Android imzası original Android25 AAB ilə eynidir. Apple team `8B6976J8H7` və
main app/widget profilləri yoxlanıb. Eyni app ID olduğundan paket production app-ı
yeniləyir; no-logout sınağı üçün tətbiqi əvvəlcədən silməyin və storage-ni təmizləməyin.
İmza konflikti çıxarsa data-nı silərək keçməyin: cihaz/mağaza signing yolu yoxlanmalıdır.

## Başlanğıc və keçid davranışı

- `VITE_BACKEND_BOOTSTRAP=source-first-v1`, `VITE_APP_VERSION=28.0`.
- İlkin bütün API/Auth/Functions/Storage/Realtime marşrutu:
  `https://tntbjulojatnrqmylorp.supabase.co`.
- Public idarəetmə ünvanı: `https://api.anacan.az/.well-known/anacan-backend.json`.
  Hazır qərar: **generation 0 / phase source / minNativeVersion 28.0**.
  Sorğu heç bir session, API key, cookie və istifadəçi/cihaz ID-si göndərmir.
- Backend qərarı `createClient()` və auto-refresh-dən, həmçinin App/i18n/crashReporter
  importlarından əvvəl verilir. Bir açılışda backend sonradan dəyişdirilmir.
- Sessiya açarı bütün keçid boyunca `sb-tntbjulojatnrqmylorp-auth-token` qalır.
  Source realm-li v2 Preferences backup və uyğun v1 fallback işləyir; Azure preview-nin
  ayrıca sessiyası source sessiyasının yerinə seçilmir.
- `anacan.backend-admission.v1` məxfi olmayan qərarı Preferences və localStorage-da
  saxlayır. Azure seçimi target SDK/refresh-dən əvvəl yazılır. Azure-a keçmiş cihaz
  source-a avtomatik qayıtmır; yarımçıq yaddaş yazıları və ziddiyyətli qərarlar bloklanır.
- İdarəetmə ünvanı şəbəkəsizdirsə cihaz son authority-ni saxlayır; ilk açılış source-dur.
  `maintenance`, köhnə/ziddiyyətli generation və təsdiqsiz Azure qərarı SDK açılmadan
  yenidən-cəhd ekranı göstərir. Göstərilən minimumdan köhnə native build yenilənmə tələb edir.
- Backup bərpası server refresh grant-i tələb edir. Şəbəkə/konfiqurasiya xətasında
  backup saxlanır və login forması yerinə yenidən-cəhd ekranı göstərilir. Açıq logout
  və serverin authoritative revocation cavabı köhnə sessiyanı diriltmir.
- Foreground/online və 60 saniyəlik yoxlamada qərar dəyişərsə React bağlanır,
  auto-refresh/Realtime dayandırılır və tam bootstrap yenidən başlayır. Source tərəfdə
  server-side freeze/drain yenə tələb olunur; client qapısı köhnə tətbiqləri dayandırmır.
- Source mərhələsində mövcud source Google/Apple/RevenueCat/pairing davranışı seçilir.
  Azure admission-dan sonra Azure pairing/RC/server-sync qaydaları və platformaya uyğun
  provider flag-ləri işləyir. `VITE_AUTH_CUTOVER=false` bu namizəddə qalır; onu dəyişmək
  bu runtime protokolunun aktivləşmə addımı deyil.

## Keçən yoxlamalar

- Bu dəyişikliklər üzrə **357 focused app testi** (ilkin 351 + 6 əlavə session/monitor
  testi), 30 auth-overlap/admission testi; hər iki TypeScript layihəsi.
- Android və iOS-un **yığılmış web paketində hərəsinə 9 brauzer sınağı**: real bundled
  SDK ilə expired local session, backup-only refresh, maintenance, təsdiqsiz Azure,
  eyni namespace ilə Azure, offline native pin, rollback rəddi, logout tombstone və
  retry-not-login. Bu sınaqlarda bütün şəbəkə/WebSocket-lər lokallaşdırılıb və grant-lər
  sintetikdir; real source→Azure refresh uyğunluğu sayılmır.
- Hər paketin **329 JS/CSS faylı**, entry hash-i, routing metadata-sı və native identity
  paket daxilindən yoxlanıb; tək bootstrap entry-sinə əsaslanılmayıb.
- APK/AAB signatures, ZIP və 4 64-bit library üçün 16 KB alignment; IPA codesign,
  main/widget development profilləri və 2 ortaq cihaz.
- Gateway `--0000010` / `v11-source-admission-20260913-1105`: source admission GET/HEAD
  200, OPTIONS 204, POST 405, no-store/CORS; mövcud HTML/JS/CSS, health və 10 guarded
  route üzrə yoxlamalar keçib. ACR `cbp` build-i nginx syntax yoxlamasını da keçib.
- Original `.env`, root/native embedded assets, Xcode/Gradle/signing materialı və
  Android25 AAB əvvəl/sonra hash müqayisəsində qorunub (`changed:[]`).

Sübut: `azure-migration/ops/SOURCE-FIRST-2026-09-13.md`.

## İndi cihazda qəbul

1. Ayrılmış test cihazında production/source versiyasında öz hesabınızla girişli olun.
   28.0-ı **update** kimi quraşdırın. Yenidən login tələb edilmədən eyni profil açılmalıdır;
   UUID-ni operator read-only müqayisə ilə təsdiqləsin.
2. App restart, access-token expiry/refresh və offline/online qayıdışı sınayın.
   Backup-only bərpanı yalnız ayrılmış test cihazında idarə olunan rehearsal ilə yoxlayın.
3. Açıq logout-dan sonra restart köhnə sessiyanı geri gətirməməlidir. Sonrakı normal
   login işləməlidir. Revoked test sessiyası ayrıca server-side fixture ilə rədd edilməlidir.
4. Google/Apple, əsas ekranlar, media və native icazələri, RC sandbox purchase/restore
   qəbulunu tamamlayın. Source mərhələsində canlı production backend istifadə olunduğunu
   nəzərə alın; ödəniş sınaqlarında mağazanın sandbox/test hesablarından istifadə edin.

27.0 ayrıca **Azure preview** idi. Onun Azure login-i source upgrade sınağı deyil;
28.0 source namespace-ni seçir. Əvvəlki 26/27 artefaktları öz qovluqlarındadır.

## Real Azure handoff üçün qalan giriş

Source metadata və counts-only nəticə alınıb: source Auth **v2.196.0**, target
**v2.189.0**, inspected schema sütun/tipləri uyğundur. 06:52:30 UTC source snapshot-ında
**13,079 sessiya / 87,660 refresh-token sətri** var; hamısı legacy 12-simvollu formatdadır.
HMAC/counter və yoxlanmış encrypted JSON envelope sayı 0-dır. Uyğun schema/saylar
real source refresh qəbulunu sübut etmir.

Fixture-only export/import aləti hazırdır və real Azure Auth ilə round-trip qəbulunu,
59 auth-handoff testini və 94 cədvəl üzrə sıfır-qalıq cleanup-ı keçib. Növbəti addım
Source-da ayrılmış test hesabının yaradılması və real source sessiyasının capture/export-udur:
[operator təlimatı](AZURE_AUTH_REHEARSAL.md).

Source encryption/signing export yolu, consistent session/refresh state, real eyni-UUID
refresh və revoked-session rəddi, final data/files və bir writer/rollback qəbulu hələ
tamamlanmalıdır. `prepare-admission.mjs` bütün real qəbul hesabatları olmadan Azure
policy hazırlamır; brauzer fixture-ləri həmin sübutların yerini tutmur.

**Production cutover NO-GO** olaraq qalır. Mağaza üçün manual release/managed publishing
və son sync sırası: [AZURE_FINAL_SYNC_AFTER_APPROVAL.md](AZURE_FINAL_SYNC_AFTER_APPROVAL.md).

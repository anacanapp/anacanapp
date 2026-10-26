# iOS46.0 — dashboard scroll/klik hotfix-i

App Store45.0 fiziki iPhone13ProMax/iOS26.6.2-də dashboard göstərir, amma
scroll/düymələr işləmirdi. `ScreenCaptureGuard` hər pointerdown zamanı native
qorumanı açıb növbəti frame-də bağlayırdı. iOS plugin-i bu dəyişiklikdə WKWebView-ni
başqa parent-ə köçürdüyünə görə touch jesti ləğv olurdu. Düzəliş yalnız həmin
pointerdown subscription/cleanup-ını çıxarır; screen/modal capture protection qalır.

Bundled45-də OTA/server qoruma açarı yoxdur. Reklamsız server sınağında da donma
qaldı; reklam ayarı geri qaytarıldı. İstifadəçi sonra46.0 hotfix-i təsdiqlədi.

İzolə `native-20261007t103857-568249e5` immutable45 workspace/archive nüsxəsidir.
Yalnız guard source və üç embeddedJS dəyişib (guard, iki versiya metadata-sı);
501/504 JS/CSS asset eynidir. Native main/widget binary/package pins saxlanıb,
46.0 resursları yenidən imzalanıb və Xcode development/Store export keçir.

Development46 iPhone-a in-place quraşdırılıb: dashboard scroll-u, Alətlər/Profil
və geri keçid istifadəçi tərəfindən **“Hamısı işləyir”** kimi qəbul edilib.

Təhvil: `azure-migration/releases/46.0/`:

- `Anacan-46.0-App-Store.ipa`,59265826bayt,
  SHA256`2e2f50f27d16919baaa8d7298bd0a91b2fbc9f45ca0ce12683de5fa8310fa13e`.
- `Anacan-46.0-iOS-Development.ipa`,50614499bayt,
  SHA256`a43be2c847a517f73fa8b22377774957ae82f6a92398626ea6669e0bbf54eebb`.
- Manifest/checksum və `APP_REVIEW_EXPEDITED.txt` hazırdır. Store upload/nəşri pending.
- Xcode archive:
  `azure-migration/native-preview/native-20261007t103857-568249e5/artifacts/Anacan-Google-46.0-AppStore.xcarchive`.

3regression/1immutablecomparison/scopedTypeScript/9bundledrouting və hərIPA
main/widget signature/profile/version/certificate/AppGroup/504hash keçir.
Storeproductionpush/HealthKit/AppleSignIn saxlanır. TamTypeScript lokalresource
pressure-dətimeout olub; tamPASS iddiası yoxdur. Fiziki acceptance ayrıca vardır.

Receipts:`ios46-hotfix.json`, `ios46-store-verification.json`,
`ios46-development-verification.json`, `ios46-routing.json`,
`ios46-physical-acceptance.json`, `ios46-delivery.json`;tooling`ios46-hotfix/`.
ÜmumiGoogle-nativepointer45-dədir;46iOS-onlysuccessor ayrıca receipt-dir.
43/44/45sources/artifacts saxlanıb.44/45completedAndroidcache hash-check-dən sonra
reclaimed edilib.

## Sonrakı Google Database keçidi — 2026-10-07

46UIqəbulundan sonra istifadəçi bütüncariapp/gələcəkbuild-lərinGoogleDatabase-ə
keçməsini istəyib. Ayrıfinaldata/Auth/media/Sourcewriter/provider/jobs/admission/DNS
handoff-u tamamlanıb;Source sealed3/cron0,Googlemanagedrealm`azure`/generation2-dir.
Keçiddən sonra eyni iPhone-da əvvəlkihesab/məlumat/scroll/düymələr **“Bəli, hər şey işləyir”**
kimi qəbul edilib. [Yekun cutover](GOOGLE_POPULATION_CUTOVER_20261007.md).

iOS46Storeupload/submission/publication **pending** qalır;signeddeliverypaketləri
eyniSHA-larla saxlanır. Sonrakı47iOS/AndroidStorebuildbuinputhotfixvəactiveGoogle
managedofflineadmission ilə hazırlanıb;[Release47](RELEASE_47_GOOGLE.md).
Ümuminativepointer47,46iOSsuccessorayrıdır; nextcommon48.

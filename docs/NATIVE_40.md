# Native 40.0 — Source-first test namizədi

Yeni izolə run: **`native-20260925t060538-3642ac8e`**.
Workspace: `azure-migration/native-preview/native-20260925t060538-3642ac8e/workspace/`.
Xcode: `workspace/ios/App/App.xcodeproj`.

Bu **development** namizədidir (`iosStore:false`). Store39 upload workspace-i və
finalized39 development artifacts ayrıca qalır: [IOS_STORE_39.md](IOS_STORE_39.md).
Yeni namizədin build/signature/artifact nəticələri run-dakı `build-ios.json`,
`build-android.json`, `web-ios.json`, `web-android.json` ilə yoxlanır.

## Dəyişikliklər

-21 dil; Premium server grant-i ilə expiry/refund paywall və background audio stop.
- Community `/Blog` axtarışı, cover/title kartı, müstəqil caption və in-app article.
- Mommy-də əsas modulu dəyişmədən optional observation-only period calendar.
- Dashboard istisnası ilə route-aware native screenshot/recording qoruması.

## Screenshot qorumasının statusu

Android protected ekranlarda `FLAG_SECURE` tətbiq edir, main dashboard-da götürür;
resume cari qaydanı saxlayır. iOS protected WKWebView üçün secure-text rendering
surface və recording/app-switcher zamanı native opaque black curtain istifadə edir.
Screenshot hadisəsi də mətn toast-ı əvəzinə qara curtain açır.

iOS-un ümumi rəsmi screenshot-prevention API-si yoxdur. Secure-text surface-nin
faktiki capture exclusion-u və keyboard/touch/layout davranışı fiziki OS-cihaz
kombinasiyasında yoxlanmalıdır; screenshotdan sonrakı flash artıq çəkilmiş şəkli
geriyə dönük qaraltmır. Web `PrintScreen` və binary marker yoxlamaları həmin
fiziki sübutun əvəzi deyil. **Son readiness yoxlamasında iPhone qoşulu deyildi.**

Fiziki qəbulda main dashboard screenshot-unun görünməsi, tool/chat/blog/onboarding/
paywall screenshot-unun qara qalması, recording başlayıb-bitməsi, app-switcher,
keyboard yazısı, scroll/touch və dashboard-a geri dönüş yoxlanmalıdır.

## Müqavilələr və artefaktlar

- App `com.atlasoon.anacan`, team `8B6976J8H7`, widget/App Group qorunur.
- Native hostname `app.anacan.az`, lokal bundled assets; remote `server.url` yoxdur.
- Source-first/generation0 və eventual Azure `refresh-before-use-v1` dəyişmir.
- Live AdMob app IDs, `source-mirror-v1`, consent/Premium/emergency stop qorunur.
- RevenueCat enabled; store price/offers və real purchase/refund testi ayrıca qalır.
- Source SQL/function prerequisite: [SUPABASE_FOLLOWUP_37.md](SUPABASE_FOLLOWUP_37.md).

Run-un `artifacts/` qovluğunda:

- `anacan-source-first-40.0-development.ipa`
- `AnacanSourceFirst-40.0.xcarchive`
- `anacan-source-first-40.0.apk`
- `anacan-source-first-40.0.aab`

Son kodla build və imza yoxlamaları keçib. Hər platformada496 JS/CSS asset,
hər paketdə57 onboarding artwork hash-i yoxlanıb. Android APK/AAB signer-i
mövcud original AAB ilə uyğundur,16KB alignment və menstruation-only Health
Connect permission scope saxlanır. Yeni capture plugin-i hər iki platformanın
binary/DEX paketində təsdiqlənib; bu, fiziki capture nəticəsinin təsdiqi deyil.

| Artefakt | Bayt | SHA-256 |
|---|---:|---|
| development IPA | 50039212 | `0210125fdcdb9d42285c42c56fa7910ebeaddec95d60737eaeb6ed18f72e8edb` |
| APK | 61916850 | `06c7834edcd772b3f000641ba615bb6170c939cd7dfc59e010bb15a3e6f3cd2e` |
| AAB | 60659154 | `fc6b093a07792fe1671e59574460cf8a6ce3533c4bcf675c2e4d1139ad41b24e` |

Yekun sübut: `azure-migration/ops/followup37-release.json`.
iOS artifact verification: `native-ios-verification-1790322952696.json`;
Android: `native-android-verification-1790323371103.json` (hər ikisi `azure-migration/ops/`).
Son iPhone readiness: `ios-device-test-1790322954466.json`, device-not-connected.
Store distribution/upload yerinə yetirilməyib.

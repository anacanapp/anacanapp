# Android native code waiting for Gradle dependencies

Nothing is pending. Files staged here earlier now live in `app/android/app/src/main/kotlin/com/atlasoon/anacan/`
with their dependencies in `app/android/app/build.gradle.kts`:

| Plugin | Dependencies | Configuration |
|---|---|---|
| `FbEventsPlugin.kt` (Meta App Events; port of Capacitor `FbEventsPlugin.java`) | `com.facebook.android:facebook-android-sdk:18.0.0` | manifest meta-data `com.facebook.sdk.*` (AutoInit on, AutoLogAppEvents and AdvertiserIDCollection off until consent); resValues `facebook_app_id` / `facebook_client_token` |
| `TikTokEventsPlugin.kt` (port of `packages/tiktok-events`) | `com.github.tiktok:tiktok-business-android-sdk:1.7.1` (JitPack, restricted to `com.github.tiktok` in `app/android/build.gradle.kts`), `androidx.lifecycle:lifecycle-process:2.6.2`, `androidx.lifecycle:lifecycle-common-java8:2.6.2`, `com.android.installreferrer:installreferrer:2.2` | resValues `anacan_tiktok_app_id` / `_tt_app_id` / `_app_secret`; R8 keep rules in `app/proguard-rules.pro` |
| `CustomerIoPlugin.kt` (port of `packages/customerio-data-in`) | `io.customer.android:datapipelines:4.22.0` | resValues `anacan_customerio_*` |
| `HealthPlugins.kt` | `connect-client:1.2.0-alpha01`, `kotlinx-coroutines-android:1.9.0` | |

All credentials come from `app/android/anacan-native.properties` (gitignored), written on Codemagic by
`app/tool/codemagic/apply_native_config.mjs` from `TIKTOK_ANDROID_APP_ID`, `TIKTOK_ANDROID_TT_APP_ID`,
`TIKTOK_ANDROID_APP_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_CLIENT_TOKEN` and the `VITE_CUSTOMERIO_*` variables. A build
without them keeps each SDK off (TikTok answers "not_configured", the Meta SDK does not initialize, Customer.io
rejects initialize), so nothing is sent.

Kotlin stdlib: the Capacitor build pinned `kotlin-stdlib` to its compiler version because suspend code compiled by
Kotlin 2.2 needs `kotlin.coroutines.jvm.internal.SpillingKt`. With Flutter's AGP 9 / Kotlin 2.4.20 check on the first
build that the resolved `kotlin-stdlib` is not older than the compiler
(`./gradlew :app:dependencies --configuration releaseRuntimeClasspath`); R8 reports a missing `SpillingKt` otherwise.

None of this was compiled on the porting host (no Android SDK).

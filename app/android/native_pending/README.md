# Android native code waiting for Gradle dependencies

These Kotlin files are **not compiled** (outside `app/src`). Each one replaces a stub of the same name in
`app/android/app/src/main/kotlin/com/atlasoon/anacan/` that compiles without the dependency and answers like a
device / build without the SDK, so the Dart side already runs on the real method channels.

| Pending file | Replaces stub | Gradle dependencies (`app/android/app/build.gradle.kts`, `dependencies {}`) | Other changes |
|---|---|---|---|
| `FbEventsPlugin.kt` (Meta App Events; port of Capacitor `FbEventsPlugin.java`) | `FbEventsPlugin.kt` | `implementation("com.facebook.android:facebook-android-sdk:18.0.0")` (Capacitor version; `facebook-core` is enough for App Events) | manifest meta-data and strings below |
| `TikTokEventsPlugin.kt` (TikTok Business SDK; port of `packages/tiktok-events` TikTokEventsPlugin.java) | `TikTokEventsPlugin.kt` | `implementation("com.github.tiktok:tiktok-business-android-sdk:1.7.1")`, `implementation("androidx.lifecycle:lifecycle-process:2.6.2")`, `implementation("androidx.lifecycle:lifecycle-common-java8:2.6.2")`, `implementation("com.android.installreferrer:installreferrer:2.2")` (packages/tiktok-events/android/build.gradle) | JitPack repository restricted to the TikTok group (`maven("https://jitpack.io") { content { includeGroup("com.github.tiktok") } }`, as Capacitor android/build.gradle); R8 keep rules of packages/tiktok-events/android/proguard-rules.pro in `app/proguard-rules.pro`; credential strings below |
| `CustomerIoPlugin.kt` (Customer.io Data In EU; port of `packages/customerio-data-in` CustomerIoDataInPlugin.java) | `CustomerIoPlugin.kt` | `implementation("io.customer.android:datapipelines:4.22.0")` (packages/customerio-data-in/android/build.gradle) | none: the `anacan_customerio_*` strings already come from build.gradle.kts / apply_native_config.mjs |

TikTok credentials (Capacitor: `plugins.TikTokEvents.android*` staged by scripts/native/tiktok-native-config.mjs from
`TIKTOK_ANDROID_APP_ID`, `TIKTOK_ANDROID_TT_APP_ID`, `TIKTOK_ANDROID_APP_SECRET`): string resources read by name, so
a build without them answers "not_configured" like Capacitor without the block. In `defaultConfig`:
`resValue("string", "anacan_tiktok_app_id", nativeValue("tiktokAppId"))`, `… "anacan_tiktok_tt_app_id", nativeValue("tiktokTtAppId")`,
`… "anacan_tiktok_app_secret", nativeValue("tiktokAppSecret")`, and apply_native_config.mjs writes those three
properties from the same `TIKTOK_ANDROID_*` variables (iOS: `ANACAN_TIKTOK_APP_ID|TT_APP_ID|APP_SECRET` in
AnacanNative.xcconfig from `TIKTOK_IOS_*`, read through Info.plist `AnacanTikTok*`).

Steps for each row: add the dependency, copy the pending file over the stub (same file name, same package, same
`register(...)` signature: `MainActivity.kt` does not change), build.

Meta SDK manifest entries (inside `<application>`, from the Capacitor manifest) and strings (a new
`res/values/facebook_strings.xml`, values from Capacitor `android/app/src/main/res/values/strings.xml`:
`facebook_app_id`, `facebook_client_token`, `fb_login_protocol_scheme`):

```xml
<meta-data android:name="com.facebook.sdk.ApplicationId" android:value="@string/facebook_app_id" />
<meta-data android:name="com.facebook.sdk.ClientToken" android:value="@string/facebook_client_token" />
<meta-data android:name="com.facebook.sdk.AutoInitEnabled" android:value="true" />
<meta-data android:name="com.facebook.sdk.AutoLogAppEventsEnabled" android:value="false" />
<meta-data android:name="com.facebook.sdk.AdvertiserIDCollectionEnabled" android:value="false" />
```

Health Connect (`HealthPlugins.kt`) is no longer pending: its dependencies (`connect-client:1.2.0-alpha01`,
`kotlinx-coroutines-android:1.9.0`) are in `build.gradle.kts` and the real implementation is in `app/src/main`.

Kotlin stdlib: the Capacitor build pinned `kotlin-stdlib` to its compiler version because suspend code compiled by
Kotlin 2.2 needs `kotlin.coroutines.jvm.internal.SpillingKt`. With Flutter's AGP 9 / Kotlin 2.4.20 check that the
resolved `kotlin-stdlib` is not older than the compiler now that `kotlinx-coroutines-android:1.9.0` is added
(`./gradlew :app:dependencies --configuration releaseRuntimeClasspath`); R8 reports a missing `SpillingKt` otherwise.

None of this was compiled here (no Android SDK on the porting host).

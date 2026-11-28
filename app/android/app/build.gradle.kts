import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    // google-services.json (copied from the Capacitor project android/app/) → Firebase string resources.
    id("com.google.gms.google-services")
}

// Release signing: app/android/keystore.properties (gitignored), same property names as the
// Capacitor project's android/keystore.properties.example (see keystore.properties.example here).
// storeFile is resolved relative to app/android/app/ unless absolute; Codemagic writes an absolute path.
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties()
val hasKeystoreProperties = keystorePropertiesFile.exists()
if (hasKeystoreProperties) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}
// Codemagic sets this so a missing keystore can never silently produce a debug-signed store package.
if (System.getenv("ANACAN_REQUIRE_RELEASE_SIGNING") == "true" && !hasKeystoreProperties) {
    throw GradleException("ANACAN_REQUIRE_RELEASE_SIGNING=true but app/android/keystore.properties is missing")
}

// Live native values written by app/tool/codemagic/apply_native_config.mjs (gitignored
// app/android/anacan-native.properties). Without it (local builds) AdMob uses Google's test
// app ID and Customer.io stays off. The Customer.io write key is native-only, never a Dart define.
val nativeConfigFile = rootProject.file("anacan-native.properties")
val nativeConfig = Properties()
if (nativeConfigFile.exists()) {
    nativeConfigFile.inputStream().use { nativeConfig.load(it) }
}
fun nativeValue(name: String, fallback: String = ""): String =
    nativeConfig.getProperty(name)?.takeIf { it.isNotEmpty() } ?: fallback

android {
    namespace = "com.atlasoon.anacan"
    // 36 = Capacitor android/variables.gradle; Flutter 3.50.1 defaults are also 36. Never go below 36.
    compileSdk = maxOf(36, flutter.compileSdkVersion)
    // Flutter 3.50.1: NDK 28.2.13676358 (r28 links 16 KB-aligned ELF segments by default) with AGP 9.3.1
    // (16 KB zip alignment of uncompressed native libraries). Codemagic checks the APK with zipalign -P 16.
    ndkVersion = flutter.ndkVersion

    // Java 17 bytecode: Flutter template default, compiled fine by Codemagic's JDK 21 (java: 21).
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // flutter_local_notifications needs core library desugaring (java.time on older Android).
        isCoreLibraryDesugaringEnabled = true
    }

    buildFeatures {
        // AGP 9 turns resValues off by default; the anacan_customerio_* strings below need it.
        resValues = true
    }

    defaultConfig {
        // Same applicationId as the Capacitor app: 60.0 must install as an in-place update.
        applicationId = "com.atlasoon.anacan"
        // 26 = Capacitor android/variables.gradle (Health Connect, java.time without desugaring).
        minSdk = 26
        targetSdk = maxOf(36, flutter.targetSdkVersion)
        // From `flutter build … --build-name/--build-number` (codemagic.yaml: 60.0.<SEQ> / 6000+SEQ).
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        // Native-only configuration (see nativeConfig above). Referenced by the manifest / native code
        // when AdMob and Customer.io are ported (docs/flutter/BUILD.md, Manifest parity backlog).
        manifestPlaceholders["anacanAdmobAppId"] =
            nativeValue("admobAppId", "ca-app-pub-3940256099942544~3347511713")
        resValue("string", "anacan_customerio_enabled", nativeValue("customerIoEnabled", "false"))
        resValue("string", "anacan_customerio_environment", nativeValue("customerIoEnvironment"))
        resValue("string", "anacan_customerio_region", nativeValue("customerIoRegion"))
        resValue("string", "anacan_customerio_cdp_write_key", nativeValue("customerIoCdpWriteKey"))
    }

    signingConfigs {
        create("release") {
            if (hasKeystoreProperties) {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Upload key from keystore.properties; local release runs without it fall back to the debug key.
            signingConfig =
                if (hasKeystoreProperties) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
            // R8 + resource shrinking. The Flutter Gradle plugin adds proguard-android-optimize.txt,
            // Flutter's own rules and this module's proguard-rules.pro. Resources looked up by name
            // (notification icons) must be listed in res/raw/keep.xml.
            isMinifyEnabled = true
            isShrinkResources = true
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    // Health Connect writes (HealthPlugins.kt: HealthCycle / HealthVitals), same versions as the Capacitor app.
    implementation("androidx.health.connect:connect-client:1.2.0-alpha01")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}

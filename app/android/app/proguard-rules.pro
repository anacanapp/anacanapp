# Anacan Flutter release (R8 on). The Flutter Gradle plugin already applies
# proguard-android-optimize.txt and Flutter's flutter_proguard_rules.pro; this file holds
# only Anacan's own rules. Most Flutter plugins ship consumer rules in their AAR; add rules
# here only when a release build crashes (ClassNotFound / missing JSON fields) or R8 reports
# missing classes, and say which plugin needs them.

# Readable crash stack traces (Play deobfuscates with the mapping embedded in the AAB).
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions
-renamesourcefileattribute SourceFile

# Flutter embedding references Play Core (deferred components), which Anacan does not ship.
-dontwarn com.google.android.play.core.**

# Anacan's own Kotlin code (MainActivity, method channels, future widgets/services): small, kept whole
# so channel handlers and manifest-declared classes are never renamed.
-keep class com.atlasoon.anacan.** { *; }

# ── Plugin rules: uncomment / extend together with the feature that adds the plugin ─────────────
# Capacitor kept these (android/app/proguard-rules.pro); re-check each against the Flutter plugin.
#
# Facebook / Meta SDK (FbEventsPlugin.kt): the AAR's consumer rules suffice, as in the Capacitor app.
#
# TikTok Business SDK (TikTokEventsPlugin.kt) and the billing client it reflects on: the consumer rules of
# packages/tiktok-events/android/proguard-rules.pro, kept as the Capacitor android/app/proguard-rules.pro did.
-keep class com.tiktok.** { *; }
-keep class com.android.billingclient.api.** { *; }
-keep class androidx.lifecycle.** { *; }
#
# Customer.io Data Pipelines (CustomerIoPlugin.kt): the Capacitor app's rule kept only its own plugin class
# (az.anacan.customerio.**), here covered by com.atlasoon.anacan.** above; the SDK ships consumer rules.
#
# Firebase Messaging / RevenueCat / Google Mobile Ads / Health Connect: no rules expected
# (consumer rules in their AARs); add here if R8 reports missing classes.

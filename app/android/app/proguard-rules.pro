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
# Facebook / Meta SDK (consumer rules usually suffice)
#-keep class com.facebook.** { *; }
#
# TikTok Business SDK (packages/tiktok-events) and the billing client it reflects on
#-keep class com.tiktok.** { *; }
#-keep class com.android.billingclient.api.** { *; }
#-keep class androidx.lifecycle.** { *; }
#
# Customer.io Data Pipelines (local plugin az.anacan.customerio in the Capacitor app)
#-keep class az.anacan.customerio.** { *; }
#
# Firebase Messaging / RevenueCat / Google Mobile Ads / Health Connect: no rules expected
# (consumer rules in their AARs); add here if R8 reports missing classes.

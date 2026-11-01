# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ── Anacan release (R8 on) ─────────────────────────────────────────────────────────
# Readable crash stack traces (Play deobfuscates with the mapping embedded in the AAB).
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,InnerClasses,EnclosingMethod,Exceptions
-renamesourcefileattribute SourceFile

# Capacitor bridge and Cordova compatibility: classes, plugin methods and callbacks are found by name
# (capacitor.plugins.json, @PluginMethod, permission/activity callbacks, the JS message handler).
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }

# Anacan's own native plugins, widget, service and the local Customer.io plugin (small; kept whole).
-keep class com.atlasoon.anacan.** { *; }
-keep class az.anacan.customerio.** { *; }

package com.atlasoon.anacan

// PENDING (not compiled yet): replaces app/android/app/src/main/kotlin/com/atlasoon/anacan/FbEventsPlugin.kt (the
// silent stub) once app/android/app/build.gradle.kts has
//   implementation("com.facebook.android:facebook-android-sdk:18.0.0")   // Capacitor android/app/build.gradle
// and the manifest has the Meta meta-data + strings (app/android/native_pending/README.md).

import android.content.Context
import android.os.Bundle
import com.facebook.FacebookSdk
import com.facebook.appevents.AppEventsLogger
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.math.BigDecimal
import java.util.Currency

/**
 * FbEvents — minimal, crash-safe Facebook App Events bridge, ported from the Capacitor app's FbEventsPlugin.java:
 *   - registering does nothing with the SDK (no startup crash window);
 *   - the SDK auto-inits from the manifest meta-data (AutoInitEnabled=true, AutoLogAppEventsEnabled=false,
 *     AdvertiserIDCollectionEnabled=false until consent);
 *   - the logger is created lazily on the first event and every call is wrapped: analytics never breaks the app.
 *
 * Channel "anacan/fb_events" (Dart: native/platform/facebook_events_channel.dart): setConsent {enabled},
 * logEvent {event, params}, logPurchase {amount, currency, params}, setAdvertiserTrackingEnabled (no-op here).
 */
class FbEventsPlugin private constructor(private val context: Context) : MethodChannel.MethodCallHandler {

    private var logger: AppEventsLogger? = null

    private fun logger(): AppEventsLogger? {
        if (logger == null) {
            logger = try {
                AppEventsLogger.newLogger(context)
            } catch (t: Throwable) {
                return null // SDK not ready
            }
        }
        return logger
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "setConsent" -> {
                try {
                    FacebookSdk.setAdvertiserIDCollectionEnabled(call.argument<Boolean>("enabled") == true)
                } catch (ignored: Throwable) {
                    // SDK not ready: nothing is sent without consent anyway
                }
                result.success(null)
            }
            "logEvent" -> logEvent(call, result)
            "logPurchase" -> logPurchase(call, result)
            // iOS ATT has no Android equivalent: no-op for interface parity.
            "setAdvertiserTrackingEnabled" -> result.success(null)
            else -> result.notImplemented()
        }
    }

    private fun logEvent(call: MethodCall, result: MethodChannel.Result) {
        try {
            val event = call.argument<String>("event")
            if (event == null || event.trim().isEmpty()) return result.error("INVALID", "Missing event argument", null)
            val params = call.argument<Map<String, Any?>>("params") ?: emptyMap()
            val l = logger() ?: return result.success(null)
            val bundle = Bundle()
            var valueToSum = Double.NaN
            for ((key, value) in params) {
                if (value == null) continue
                // _valueToSum is not a bundle parameter but the event value
                if (key == "_valueToSum") {
                    valueToSum = value.toString().toDoubleOrNull() ?: Double.NaN
                    continue
                }
                if (value is Number) bundle.putDouble(key, value.toDouble()) else bundle.putString(key, value.toString())
            }
            if (!valueToSum.isNaN()) l.logEvent(event, valueToSum, bundle) else l.logEvent(event, bundle)
            result.success(null)
        } catch (t: Throwable) {
            result.success(null)
        }
    }

    /** logPurchase({ amount, currency, params }) for Meta value-based optimization. */
    private fun logPurchase(call: MethodCall, result: MethodChannel.Result) {
        try {
            val amount = call.argument<Number>("amount")?.toDouble() ?: return result.error("INVALID", "Missing amount", null)
            val currency = call.argument<String>("currency") ?: "USD"
            val l = logger() ?: return result.success(null)
            val bundle = Bundle()
            for ((key, value) in call.argument<Map<String, Any?>>("params") ?: emptyMap()) {
                if (value != null) bundle.putString(key, value.toString())
            }
            l.logPurchase(BigDecimal.valueOf(amount), Currency.getInstance(currency), bundle)
            result.success(null)
        } catch (t: Throwable) {
            result.success(null)
        }
    }

    companion object {
        const val CHANNEL = "anacan/fb_events"

        fun register(context: Context, messenger: BinaryMessenger): MethodChannel {
            val channel = MethodChannel(messenger, CHANNEL)
            channel.setMethodCallHandler(FbEventsPlugin(context.applicationContext))
            return channel
        }
    }
}

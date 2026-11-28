package com.atlasoon.anacan

import android.content.Context
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * STUB of the "anacan/fb_events" channel until the Meta SDK dependency exists: every call resolves silently, the
 * Capacitor FbEventsPlugin's "SDK not ready" branch (nothing is sent). The real port is
 * app/android/native_pending/FbEventsPlugin.kt and replaces this file as is (same class and register signature).
 */
class FbEventsPlugin private constructor() : MethodChannel.MethodCallHandler {

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "setConsent", "logEvent", "logPurchase", "setAdvertiserTrackingEnabled" -> result.success(null)
            else -> result.notImplemented()
        }
    }

    companion object {
        const val CHANNEL = "anacan/fb_events"

        @Suppress("UNUSED_PARAMETER")
        fun register(context: Context, messenger: BinaryMessenger): MethodChannel {
            val channel = MethodChannel(messenger, CHANNEL)
            channel.setMethodCallHandler(FbEventsPlugin())
            return channel
        }
    }
}

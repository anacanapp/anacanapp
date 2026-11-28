package com.atlasoon.anacan

import android.content.Context
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * STUB of the "anacan/tiktok_events" channel until the TikTok Business SDK dependency exists: `start` answers
 * {started: false, reason: "not_configured"} (the Capacitor TikTokEventsPlugin without credentials) and every other
 * call resolves silently, so nothing reaches TikTok. The real port is app/android/native_pending/TikTokEventsPlugin.kt
 * and replaces this file as is (same class and register signature).
 */
class TikTokEventsPlugin private constructor() : MethodChannel.MethodCallHandler {

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "start" -> result.success(mapOf("started" to false, "reason" to "not_configured"))
            "setEnabled", "track", "identify", "logout" -> result.success(null)
            else -> result.notImplemented()
        }
    }

    companion object {
        const val CHANNEL = "anacan/tiktok_events"

        @Suppress("UNUSED_PARAMETER")
        fun register(context: Context, messenger: BinaryMessenger): MethodChannel {
            val channel = MethodChannel(messenger, CHANNEL)
            channel.setMethodCallHandler(TikTokEventsPlugin())
            return channel
        }
    }
}

package com.atlasoon.anacan

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.tiktok.TikTokBusinessSdk
import com.tiktok.appevents.base.TTBaseEvent
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Bridge to the TikTok Business SDK, ported from packages/tiktok-events (TikTokEventsPlugin.java). Dart calls start()
 * only after the person allowed attribution in Privacy → Consent; without it the SDK is never initialized and nothing
 * leaves the device. Credentials come from the build's native configuration (string resources
 * anacan_tiktok_app_secret / anacan_tiktok_app_id / anacan_tiktok_tt_app_id, build.gradle.kts resValues written by
 * app/tool/codemagic/apply_native_config.mjs from TIKTOK_ANDROID_*, the Capacitor plugins.TikTokEvents.android*
 * values), never from channel arguments. A build without them answers "not_configured".
 *
 * Channel "anacan/tiktok_events" (Dart: services/analytics/tiktok_events_channel.dart): start {tracking, debug} ->
 * {started, reason?}, setEnabled {enabled}, track {event, properties}, identify {externalId}, logout.
 */
class TikTokEventsPlugin private constructor(private val context: Context) : MethodChannel.MethodCallHandler {
    @Volatile private var starting = false
    private val main = Handler(Looper.getMainLooper())

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "start" -> start(call, result)
            "setEnabled" -> {
                val enabled = call.argument<Boolean>("enabled") == true
                if (TikTokBusinessSdk.isInitialized()) {
                    try {
                        if (enabled) TikTokBusinessSdk.startTrack() else TikTokBusinessSdk.destroy()
                    } catch (ignored: Throwable) {
                    }
                }
                result.success(null)
            }
            "track" -> track(call, result)
            "identify" -> {
                val id = call.argument<String>("externalId")
                if (TikTokBusinessSdk.isInitialized() && !id.isNullOrEmpty()) {
                    try {
                        TikTokBusinessSdk.identify(id, null, null, null)
                    } catch (ignored: Throwable) {
                    }
                }
                result.success(null)
            }
            "logout" -> {
                if (TikTokBusinessSdk.isInitialized()) {
                    try {
                        TikTokBusinessSdk.logout()
                    } catch (ignored: Throwable) {
                    }
                }
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }

    private fun config(name: String): String {
        val id = context.resources.getIdentifier(name, "string", context.packageName)
        return if (id == 0) "" else context.getString(id).trim()
    }

    private fun start(call: MethodCall, result: MethodChannel.Result) {
        if (TikTokBusinessSdk.isInitialized()) {
            try {
                TikTokBusinessSdk.startTrack()
            } catch (ignored: Throwable) {
            }
            result.success(outcome(true, null))
            return
        }
        val secret = config("anacan_tiktok_app_secret")
        val appId = config("anacan_tiktok_app_id")
        val ttAppId = config("anacan_tiktok_tt_app_id")
        if (secret.isEmpty() || appId.isEmpty() || ttAppId.isEmpty()) {
            result.success(outcome(false, "not_configured"))
            return
        }
        if (starting) {
            result.success(outcome(false, "starting"))
            return
        }
        starting = true
        // A Flutter result may be answered once only (Capacitor tolerated a second resolve): the init callback and the
        // catch below can both fire when startTrack() throws after a synchronous callback.
        val replied = AtomicBoolean(false)
        val reply = { started: Boolean, reason: String? ->
            if (replied.compareAndSet(false, true)) main.post { result.success(outcome(started, reason)) }
        }
        try {
            val config = TikTokBusinessSdk.TTConfig(context, secret).setAppId(appId).setTTAppId(ttAppId)
            if (call.argument<Boolean>("debug") == true) config.openDebugMode().setLogLevel(TikTokBusinessSdk.LogLevel.DEBUG)
            TikTokBusinessSdk.initializeSdk(config, object : TikTokBusinessSdk.TTInitCallback {
                override fun success() {
                    starting = false
                    reply(true, null)
                }

                override fun fail(code: Int, msg: String?) {
                    starting = false
                    reply(false, "init_failed_$code")
                }
            })
            TikTokBusinessSdk.startTrack()
        } catch (e: Throwable) {
            starting = false
            reply(false, "init_error")
        }
    }

    private fun track(call: MethodCall, result: MethodChannel.Result) {
        val name = call.argument<String>("event")
        if (!TikTokBusinessSdk.isInitialized() || name.isNullOrEmpty()) {
            result.success(null)
            return
        }
        try {
            val builder = TTBaseEvent.newBuilder(name)
            for ((key, value) in call.argument<Map<String, Any?>>("properties") ?: emptyMap()) {
                when (value) {
                    is String -> builder.addProperty(key, value)
                    is Boolean -> builder.addProperty(key, value)
                    is Number -> builder.addProperty(key, value.toDouble())
                }
            }
            TikTokBusinessSdk.trackTTEvent(builder.build())
        } catch (ignored: Throwable) {
        }
        result.success(null)
    }

    private fun outcome(started: Boolean, reason: String?): Map<String, Any> =
        if (reason == null) mapOf("started" to started) else mapOf("started" to started, "reason" to reason)

    companion object {
        const val CHANNEL = "anacan/tiktok_events"

        fun register(context: Context, messenger: BinaryMessenger): MethodChannel {
            val channel = MethodChannel(messenger, CHANNEL)
            channel.setMethodCallHandler(TikTokEventsPlugin(context.applicationContext))
            return channel
        }
    }
}

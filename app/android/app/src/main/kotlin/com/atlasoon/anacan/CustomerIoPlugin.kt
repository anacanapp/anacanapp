package com.atlasoon.anacan

import android.app.Application
import android.content.Context
import io.customer.sdk.CustomerIO
import io.customer.sdk.CustomerIOConfigBuilder
import io.customer.sdk.core.util.CioLogLevel
import io.customer.sdk.data.model.Region
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.nio.charset.StandardCharsets
import java.security.MessageDigest

/**
 * Customer.io Data In (EU), ported from packages/customerio-data-in (CustomerIoDataInPlugin.java). The CDP write key
 * is read from the build's native configuration (string resources anacan_customerio_*, build.gradle.kts resValues
 * written by app/tool/codemagic/apply_native_config.mjs), never from channel arguments; Dart only names the region and
 * environment it expects, and a mismatch rejects. Lifecycle / device / screen auto-tracking stay off, a restored SDK
 * identity is cleared on initialize, only `community_post_created` and valid screen names are accepted.
 *
 * Channel "anacan/customerio" (Dart: services/analytics/customerio_channel.dart): initialize {region, environment},
 * identify {userId, traits}, track {name, properties}, screen {title, properties}, reset.
 */
class CustomerIoPlugin private constructor(private val context: Context) : MethodChannel.MethodCallHandler {

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "initialize" -> initialize(call, result)
            "identify" -> identify(call, result)
            "track" -> track(call, result)
            "screen" -> screen(call, result)
            "reset" -> reset(result)
            else -> result.notImplemented()
        }
    }

    private fun config(name: String): String {
        val id = context.resources.getIdentifier(name, "string", context.packageName)
        return if (id == 0) "" else context.getString(id)
    }

    private fun initialize(call: MethodCall, result: MethodChannel.Result) {
        synchronized(LOCK) {
            val key = config("anacan_customerio_cdp_write_key")
            val environment = config("anacan_customerio_environment")
            if (key.isEmpty() || key.length > 512 || key.any { it.isWhitespace() } ||
                config("anacan_customerio_enabled") != "true" || config("anacan_customerio_region") != "EU" ||
                call.argument<String>("region") != "EU" || environment.isEmpty() || environment != call.argument<String>("environment") ||
                !(environment == "production" || environment == "sandbox")
            ) {
                result.error("CUSTOMERIO_INVALID_CONFIGURATION", null, null)
                return
            }
            try {
                val hash = MessageDigest.getInstance("SHA-256").digest("$environment:$key".toByteArray(StandardCharsets.UTF_8))
                val fingerprint = hash.joinToString("") { String.format("%02x", it) }
                val existing = configuration
                if (existing != null) {
                    if (existing == fingerprint) result.success(null) else result.error("CUSTOMERIO_RESTART_REQUIRED", null, null)
                    return
                }
                CustomerIO.initialize(
                    CustomerIOConfigBuilder(context as Application, key)
                        .region(Region.EU)
                        .logLevel(CioLogLevel.NONE)
                        .trackApplicationLifecycleEvents(false)
                        .autoTrackDeviceAttributes(false)
                        .autoTrackActivityScreens(false)
                        .build()
                )
                // A restored SDK identity must never outlive the app's authenticated owner.
                CustomerIO.instance().clearIdentify()
                configuration = fingerprint
                identified = false
                result.success(null)
            } catch (ignored: Exception) {
                result.error("CUSTOMERIO_INITIALIZATION_FAILED", null, null)
            }
        }
    }

    private fun identify(call: MethodCall, result: MethodChannel.Result) {
        synchronized(LOCK) {
            val userId = call.argument<String>("userId")
            if (configuration == null || userId.isNullOrEmpty() || userId.length > 200) {
                result.error("CUSTOMERIO_IDENTITY_REQUIRED", null, null)
                return
            }
            try {
                CustomerIO.instance().identify(userId, properties(call.argument<Map<String, Any?>>("traits")))
                identified = true
                result.success(null)
            } catch (ignored: Exception) {
                result.error("CUSTOMERIO_IDENTIFY_FAILED", null, null)
            }
        }
    }

    private fun track(call: MethodCall, result: MethodChannel.Result) {
        synchronized(LOCK) {
            if (configuration == null || !identified || call.argument<String>("name") != "community_post_created") {
                result.error("CUSTOMERIO_EVENT_REJECTED", null, null)
                return
            }
            try {
                CustomerIO.instance().track("community_post_created", properties(call.argument<Map<String, Any?>>("properties")))
                result.success(null)
            } catch (ignored: Exception) {
                result.error("CUSTOMERIO_TRACK_FAILED", null, null)
            }
        }
    }

    private fun screen(call: MethodCall, result: MethodChannel.Result) {
        synchronized(LOCK) {
            val title = call.argument<String>("title")
            if (configuration == null || !identified || title == null || !SCREEN.matches(title)) {
                result.error("CUSTOMERIO_SCREEN_REJECTED", null, null)
                return
            }
            try {
                CustomerIO.instance().screen(title, properties(call.argument<Map<String, Any?>>("properties")))
                result.success(null)
            } catch (ignored: Exception) {
                result.error("CUSTOMERIO_SCREEN_FAILED", null, null)
            }
        }
    }

    private fun reset(result: MethodChannel.Result) {
        synchronized(LOCK) {
            identified = false
            try {
                if (configuration != null) CustomerIO.instance().clearIdentify()
                result.success(null)
            } catch (ignored: Exception) {
                result.error("CUSTOMERIO_RESET_FAILED", null, null)
            }
        }
    }

    /** Flat string / number / boolean values only. */
    private fun properties(values: Map<String, Any?>?): Map<String, Any> {
        val out = HashMap<String, Any>()
        for ((key, value) in values ?: emptyMap()) {
            if (value != null && (value is String || value is Number || value is Boolean)) out[key] = value
        }
        return out
    }

    companion object {
        const val CHANNEL = "anacan/customerio"
        private val LOCK = Any()
        private val SCREEN = Regex("^[A-Za-z][A-Za-z0-9 _-]{0,79}$")
        private var configuration: String? = null
        private var identified = false

        fun register(context: Context, messenger: BinaryMessenger): MethodChannel {
            val channel = MethodChannel(messenger, CHANNEL)
            channel.setMethodCallHandler(CustomerIoPlugin(context.applicationContext))
            return channel
        }
    }
}

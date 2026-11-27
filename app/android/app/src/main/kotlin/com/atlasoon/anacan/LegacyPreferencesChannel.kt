package com.atlasoon.anacan

import android.content.Context
import android.content.SharedPreferences
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Read/write access to the Capacitor Preferences store kept by the previous (Capacitor)
 * builds of this app, so sessions, logout tombstones, adoption receipts and the backend
 * admission pin survive the Flutter update and a rollback finds them again.
 *
 * Mirrors @capacitor/preferences 8.0.1 (android/.../Preferences.java): SharedPreferences
 * file "CapacitorStorage", MODE_PRIVATE, plain string values, keys unprefixed.
 * Writes use commit() (synchronous) instead of Capacitor's apply(), so a resolved Dart
 * write is on disk before startup continues (the admission pin must be durable before
 * any token rotation).
 *
 * Channel "az.anacan/legacy_prefs": get {key} -> String?, set {key, value},
 * remove {key}, keys -> List<String>.
 */
class LegacyPreferencesChannel private constructor(context: Context) : MethodChannel.MethodCallHandler {
    private val preferences: SharedPreferences =
        context.getSharedPreferences(GROUP, Context.MODE_PRIVATE)

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        try {
            when (call.method) {
                "get" -> {
                    val key = call.argument<String>("key") ?: return result.error("INVALID", "key", null)
                    // Capacitor only ever stores strings; anything else is not a Preferences value.
                    val value = preferences.all[key]
                    result.success(value as? String)
                }
                "set" -> {
                    val key = call.argument<String>("key") ?: return result.error("INVALID", "key", null)
                    val value = call.argument<String>("value") ?: return result.error("INVALID", "value", null)
                    if (preferences.edit().putString(key, value).commit()) result.success(null)
                    else result.error("WRITE_FAILED", "commit failed", null)
                }
                "remove" -> {
                    val key = call.argument<String>("key") ?: return result.error("INVALID", "key", null)
                    if (preferences.edit().remove(key).commit()) result.success(null)
                    else result.error("WRITE_FAILED", "commit failed", null)
                }
                "keys" -> result.success(ArrayList(preferences.all.keys))
                else -> result.notImplemented()
            }
        } catch (error: Exception) {
            // Never echo values: they can be credentials.
            result.error("LEGACY_PREFS", error.javaClass.simpleName, null)
        }
    }

    companion object {
        const val CHANNEL = "az.anacan/legacy_prefs"
        const val GROUP = "CapacitorStorage"

        fun register(context: Context, messenger: BinaryMessenger) {
            MethodChannel(messenger, CHANNEL).setMethodCallHandler(LegacyPreferencesChannel(context.applicationContext))
        }
    }
}

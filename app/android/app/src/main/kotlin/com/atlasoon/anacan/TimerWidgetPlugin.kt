package com.atlasoon.anacan

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import org.json.JSONArray
import org.json.JSONObject

/**
 * "LiveActivity" plugin (Android side), ported from the Capacitor app's TimerWidgetPlugin.kt: shows the
 * feeding / sleep (and contraction / kick) timers as a lock-screen chronometer notification through
 * [TimerForegroundService]. The iOS side of the same channel uses an ActivityKit Live Activity.
 *
 * Channel "anacan/live_timer" (Dart: native/platform/live_timer_channel.dart):
 * startActivity {id, type, label, subLabel?, stopLabel?, startTime, feedType?, channelName?, channelDesc?},
 * stopActivity {timerId?}, getPendingStops -> {stops: [...]}, clearPendingStops;
 * native -> Dart: timerStopped {id, type, feedType?, startTime, stoppedAt} (while the app is running).
 */
class TimerWidgetPlugin private constructor(private val context: Context, messenger: BinaryMessenger) :
    MethodChannel.MethodCallHandler {

    private val channel = MethodChannel(messenger, CHANNEL)

    companion object {
        const val CHANNEL = "anacan/live_timer"

        @Volatile private var instance: TimerWidgetPlugin? = null

        fun register(context: Context, messenger: BinaryMessenger): TimerWidgetPlugin {
            val plugin = TimerWidgetPlugin(context.applicationContext, messenger)
            plugin.channel.setMethodCallHandler(plugin)
            instance = plugin
            return plugin
        }

        /** Stopped from the notification button: tell Dart (when the app is running). */
        fun notifyStopped(payload: JSONObject) {
            val p = instance ?: return
            val data = HashMap<String, Any?>()
            data["id"] = payload.optString("id")
            data["type"] = payload.optString("type")
            if (!payload.isNull("feedType")) data["feedType"] = payload.optString("feedType")
            data["startTime"] = payload.optLong("startTime")
            data["stoppedAt"] = payload.optLong("stoppedAt")
            Handler(Looper.getMainLooper()).post {
                try {
                    p.channel.invokeMethod("timerStopped", data)
                } catch (ignored: Exception) {
                    // Engine gone: the pending stop is read on the next resume.
                }
            }
        }
    }

    fun detach() {
        channel.setMethodCallHandler(null)
        if (instance === this) instance = null
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "startActivity" -> startActivity(call, result)
            "stopActivity" -> stopActivity(call, result)
            "getPendingStops" -> getPendingStops(result)
            "clearPendingStops" -> {
                val prefs = context.getSharedPreferences(TimerForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
                prefs.edit().remove(TimerForegroundService.PENDING_KEY).apply()
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }

    private fun startActivity(call: MethodCall, result: MethodChannel.Result) {
        val id = call.argument<String>("id") ?: return result.error("INVALID", "Missing id", null)
        val startTime = call.argument<Number>("startTime")?.toLong() ?: System.currentTimeMillis()
        val intent = Intent(context, TimerForegroundService::class.java).apply {
            action = TimerForegroundService.ACTION_START
            putExtra("id", id)
            putExtra("type", call.argument<String>("type") ?: "timer")
            putExtra("label", call.argument<String>("label") ?: "Taymer")
            putExtra("subLabel", call.argument<String>("subLabel") ?: "")
            putExtra("stopLabel", call.argument<String>("stopLabel") ?: "Dayandır")
            putExtra("feedType", call.argument<String>("feedType"))
            putExtra("startTime", startTime)
            // Lokallaşdırılmış kanal adı/təsviri (Android sistem ayarlarında görünür)
            putExtra("channelName", call.argument<String>("channelName"))
            putExtra("channelDesc", call.argument<String>("channelDesc"))
        }
        try {
            context.startForegroundService(intent)
            result.success(null)
        } catch (error: Exception) {
            // e.g. ForegroundServiceStartNotAllowedException: Dart falls back to the ongoing local notification.
            result.error("START_FAILED", error.javaClass.simpleName, null)
        }
    }

    private fun stopActivity(call: MethodCall, result: MethodChannel.Result) {
        val intent = Intent(context, TimerForegroundService::class.java).apply {
            action = TimerForegroundService.ACTION_CANCEL
            call.argument<String>("timerId")?.let { putExtra("id", it) }
        }
        // No running timers: do not start the service just to cancel nothing.
        if (TimerForegroundService.activeTimers.isNotEmpty()) {
            try {
                context.startService(intent)
            } catch (ignored: Exception) {
            }
        }
        result.success(null)
    }

    /** Timers stopped from the notification that Dart has not processed yet. */
    private fun getPendingStops(result: MethodChannel.Result) {
        val prefs = context.getSharedPreferences(TimerForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(TimerForegroundService.PENDING_KEY, "[]") ?: "[]"
        val out = ArrayList<Map<String, Any?>>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val j = HashMap<String, Any?>()
                j["id"] = o.optString("id")
                j["type"] = o.optString("type")
                if (!o.isNull("feedType")) j["feedType"] = o.optString("feedType")
                j["startTime"] = o.optLong("startTime")
                j["stoppedAt"] = o.optLong("stoppedAt")
                out.add(j)
            }
        } catch (ignored: Exception) {
            out.clear()
        }
        result.success(mapOf("stops" to out))
    }
}

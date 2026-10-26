package com.atlasoon.anacan

import android.content.Context
import android.content.Intent
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray
import org.json.JSONObject

/**
 * "LiveActivity" plugin (Android tərəfi) — süd vermə/yuxu taymerlərini
 * TimerForegroundService vasitəsilə kilid ekranı bildirişi kimi göstərir.
 * iOS tərəfdə eyni adlı plugin ActivityKit Live Activity istifadə edir.
 */
@CapacitorPlugin(name = "LiveActivity")
class TimerWidgetPlugin : Plugin() {

    companion object {
        @Volatile private var instance: TimerWidgetPlugin? = null

        /** Service bildiriş düyməsindən dayandırılanda JS-ə xəbər ver (tətbiq açıqdırsa) */
        fun notifyStopped(payload: JSONObject) {
            val p = instance ?: return
            val data = JSObject()
            data.put("id", payload.optString("id"))
            data.put("type", payload.optString("type"))
            if (!payload.isNull("feedType")) data.put("feedType", payload.optString("feedType"))
            data.put("startTime", payload.optLong("startTime"))
            data.put("stoppedAt", payload.optLong("stoppedAt"))
            p.notifyListeners("timerStopped", data)
        }
    }

    override fun load() {
        instance = this
    }

    override fun handleOnDestroy() {
        if (instance === this) instance = null
        super.handleOnDestroy()
    }

    @PluginMethod
    fun startActivity(call: PluginCall) {
        val id = call.getString("id") ?: run { call.reject("Missing id"); return }
        val intent = Intent(context, TimerForegroundService::class.java).apply {
            action = TimerForegroundService.ACTION_START
            putExtra("id", id)
            putExtra("type", call.getString("type") ?: "timer")
            putExtra("label", call.getString("label") ?: "Taymer")
            putExtra("subLabel", call.getString("subLabel") ?: "")
            putExtra("stopLabel", call.getString("stopLabel") ?: "Dayandır")
            putExtra("feedType", call.getString("feedType"))
            putExtra("startTime", (call.getDouble("startTime") ?: System.currentTimeMillis().toDouble()).toLong())
            // Lokallaşdırılmış kanal adı/təsviri (Android sistem ayarlarında görünür)
            putExtra("channelName", call.getString("channelName"))
            putExtra("channelDesc", call.getString("channelDesc"))
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        call.resolve()
    }

    @PluginMethod
    fun stopActivity(call: PluginCall) {
        val intent = Intent(context, TimerForegroundService::class.java).apply {
            action = TimerForegroundService.ACTION_CANCEL
            call.getString("timerId")?.let { putExtra("id", it) }
        }
        // Service işləmirsə belə startService ACTION_CANCEL üçün təhlükəsizdir;
        // amma heç taymer yoxdursa boş yerə service qaldırmayaq:
        if (TimerForegroundService.activeTimers.isNotEmpty()) {
            context.startService(intent)
        }
        call.resolve()
    }

    /** Bildirişdən dayandırılmış, hələ JS tərəfindən emal olunmamış taymerlər */
    @PluginMethod
    fun getPendingStops(call: PluginCall) {
        val prefs = context.getSharedPreferences(TimerForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(TimerForegroundService.PENDING_KEY, "[]") ?: "[]"
        val result = JSObject()
        try {
            val arr = JSONArray(raw)
            val out = com.getcapacitor.JSArray()
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                val j = JSObject()
                j.put("id", o.optString("id"))
                j.put("type", o.optString("type"))
                if (!o.isNull("feedType")) j.put("feedType", o.optString("feedType"))
                j.put("startTime", o.optLong("startTime"))
                j.put("stoppedAt", o.optLong("stoppedAt"))
                out.put(j)
            }
            result.put("stops", out)
        } catch (e: Exception) {
            result.put("stops", com.getcapacitor.JSArray())
        }
        call.resolve(result)
    }

    @PluginMethod
    fun clearPendingStops(call: PluginCall) {
        val prefs = context.getSharedPreferences(TimerForegroundService.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(TimerForegroundService.PENDING_KEY).apply()
        call.resolve()
    }
}

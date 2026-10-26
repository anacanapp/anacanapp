package com.atlasoon.anacan

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

/**
 * Anacan Timer Foreground Service — süd vermə / yuxu taymerlərini kilid ekranında
 * xronometrli bildiriş kimi göstərir. "Dayandır" düyməsi tətbiqi açmadan taymeri
 * dayandırır (nəticə CapacitorStorage-a "pending stop" kimi yazılır ki, JS tərəf
 * sessiyanı baby_logs-a qeyd edə bilsin). Bildirişə toxunuş tətbiqi açır.
 *
 * Eyni anda bir neçə taymer dəstəklənir (məs. yuxu + sol sinə).
 */
class TimerForegroundService : Service() {

    data class TimerInfo(
        val id: String,
        val type: String,
        val label: String,
        val subLabel: String,
        val stopLabel: String,
        val feedType: String?,
        val startTime: Long
    )

    companion object {
        const val ACTION_START = "com.atlasoon.anacan.timer.START"
        const val ACTION_CANCEL = "com.atlasoon.anacan.timer.CANCEL"        // app içindən (pending yazmadan)
        const val ACTION_STOP_FROM_NOTIF = "com.atlasoon.anacan.timer.STOP" // bildiriş düyməsindən

        const val CHANNEL_ID = "anacan_timer_channel"
        const val FG_NOTIFICATION_BASE = 42000
        const val PREFS_NAME = "CapacitorStorage" // @capacitor/preferences default qrupu
        const val PENDING_KEY = "anacan-pending-timer-stops"

        val activeTimers = ConcurrentHashMap<String, TimerInfo>()

        fun notificationIdFor(timerId: String): Int =
            FG_NOTIFICATION_BASE + 1 + (Math.abs(timerId.hashCode()) % 2000)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val info = TimerInfo(
                    id = intent.getStringExtra("id") ?: return START_NOT_STICKY,
                    type = intent.getStringExtra("type") ?: "timer",
                    label = intent.getStringExtra("label") ?: "Taymer",
                    subLabel = intent.getStringExtra("subLabel") ?: "",
                    stopLabel = intent.getStringExtra("stopLabel") ?: "Dayandır",
                    feedType = intent.getStringExtra("feedType"),
                    startTime = intent.getLongExtra("startTime", System.currentTimeMillis())
                )
                activeTimers[info.id] = info
                ensureChannel(
                    intent.getStringExtra("channelName"),
                    intent.getStringExtra("channelDesc")
                )
                // İlk taymer: foreground; sonrakılar: əlavə bildiriş
                startForeground(notificationIdFor(info.id), buildNotification(info))
                // Digər aktiv taymerlərin bildirişlərini təzələ (foreground id dəyişə bilər)
                val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                activeTimers.values.filter { it.id != info.id }.forEach {
                    nm.notify(notificationIdFor(it.id), buildNotification(it))
                }
            }
            ACTION_CANCEL -> {
                val id = intent.getStringExtra("id")
                if (id == null) {
                    activeTimers.keys.toList().forEach { removeTimer(it) }
                } else {
                    removeTimer(id)
                }
            }
            ACTION_STOP_FROM_NOTIF -> {
                val id = intent.getStringExtra("id") ?: return START_NOT_STICKY
                val info = activeTimers[id]
                if (info != null) {
                    val stoppedAt = System.currentTimeMillis()
                    val payload = JSONObject()
                        .put("id", info.id)
                        .put("type", info.type)
                        .put("feedType", info.feedType ?: JSONObject.NULL)
                        .put("startTime", info.startTime)
                        .put("stoppedAt", stoppedAt)
                    appendPendingStop(payload)
                    removeTimer(id)
                    TimerWidgetPlugin.notifyStopped(payload)
                }
            }
        }
        return START_NOT_STICKY
    }

    private fun removeTimer(id: String) {
        activeTimers.remove(id)
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(notificationIdFor(id))
        if (activeTimers.isEmpty()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            stopSelf()
        } else {
            // Foreground bildirişini qalan taymerlərdən birinə keçir
            val next = activeTimers.values.first()
            startForeground(notificationIdFor(next.id), buildNotification(next))
        }
    }

    private fun appendPendingStop(obj: JSONObject) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val arr = try { JSONArray(prefs.getString(PENDING_KEY, "[]")) } catch (e: Exception) { JSONArray() }
        arr.put(obj)
        prefs.edit().putString(PENDING_KEY, arr.toString()).apply()
    }

    private fun ensureChannel(localizedName: String? = null, localizedDesc: String? = null) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val name = localizedName?.takeIf { it.isNotBlank() } ?: "Taymerlər"
            val desc = localizedDesc?.takeIf { it.isNotBlank() } ?: "Aktiv süd vermə / yuxu taymerləri"
            val existing = nm.getNotificationChannel(CHANNEL_ID)
            if (existing == null) {
                val ch = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_LOW)
                ch.description = desc
                ch.setShowBadge(false)
                ch.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                nm.createNotificationChannel(ch)
            } else if (localizedName != null && existing.name?.toString() != name) {
                // Dil dəyişib — kanal adını yenilə (createNotificationChannel mövcud kanalı update edir)
                existing.name = name
                existing.description = desc
                nm.createNotificationChannel(existing)
            }
        }
    }

    private fun smallIconRes(): Int {
        val custom = resources.getIdentifier("ic_stat_icon", "drawable", packageName)
        return if (custom != 0) custom else applicationInfo.icon
    }

    private fun buildNotification(info: TimerInfo): Notification {
        // Toxunuş → tətbiqi aç (singleTask olduğuna görə mövcud sessiyaya qayıdır)
        val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            putExtra("anacanTimerId", info.id)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val contentPi = PendingIntent.getActivity(
            this, notificationIdFor(info.id), launch,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        // "Dayandır" düyməsi
        val stopIntent = Intent(this, TimerForegroundService::class.java).apply {
            action = ACTION_STOP_FROM_NOTIF
            putExtra("id", info.id)
        }
        val stopPi = PendingIntent.getService(
            this, notificationIdFor(info.id) + 5000, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(smallIconRes())
            .setContentTitle(info.label)
            .setContentText(info.subLabel)
            .setUsesChronometer(true)      // kilid ekranında canlı sayğac
            .setShowWhen(true)
            .setWhen(info.startTime)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(contentPi)
            .addAction(0, info.stopLabel, stopPi)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }
}

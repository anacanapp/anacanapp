package com.atlasoon.anacan

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.widget.RemoteViews

class TimerWidgetProvider : AppWidgetProvider() {
    
    companion object {
        private const val PREFS_NAME = "AnacanTimerPrefs"
        private const val KEY_TIMER_TYPE = "timer_type"
        private const val KEY_TIMER_LABEL = "timer_label"
        private const val KEY_START_TIME = "timer_start_time"
        private const val KEY_IS_ACTIVE = "timer_is_active"
        private const val KEY_FEED_TYPE = "timer_feed_type"
        
        private var updateHandler: Handler? = null
        private var updateRunnable: Runnable? = null
        
        fun updateWidget(context: Context) {
            val intent = Intent(context, TimerWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            }
            val ids = AppWidgetManager.getInstance(context)
                .getAppWidgetIds(ComponentName(context, TimerWidgetProvider::class.java))
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            context.sendBroadcast(intent)
        }
        
        fun startTimer(context: Context, type: String, label: String, startTime: Long, feedType: String?) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().apply {
                putString(KEY_TIMER_TYPE, type)
                putString(KEY_TIMER_LABEL, label)
                putLong(KEY_START_TIME, startTime)
                putBoolean(KEY_IS_ACTIVE, true)
                putString(KEY_FEED_TYPE, feedType)
                apply()
            }
            startPeriodicUpdate(context)
        }
        
        fun stopTimer(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(KEY_IS_ACTIVE, false).apply()
            stopPeriodicUpdate()
            updateWidget(context)
        }
        
        private fun startPeriodicUpdate(context: Context) {
            stopPeriodicUpdate()
            updateHandler = Handler(Looper.getMainLooper())
            updateRunnable = object : Runnable {
                override fun run() {
                    updateWidget(context)
                    updateHandler?.postDelayed(this, 1000)
                }
            }
            updateHandler?.post(updateRunnable!!)
        }
        
        private fun stopPeriodicUpdate() {
            updateRunnable?.let { updateHandler?.removeCallbacks(it) }
            updateHandler = null
            updateRunnable = null
        }
    }
    
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isActive = prefs.getBoolean(KEY_IS_ACTIVE, false)
        
        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_timer)
            
            if (isActive) {
                val label = prefs.getString(KEY_TIMER_LABEL, "Timer") ?: "Timer"
                val startTime = prefs.getLong(KEY_START_TIME, System.currentTimeMillis())
                val elapsed = (System.currentTimeMillis() - startTime) / 1000
                val feedType = prefs.getString(KEY_FEED_TYPE, null)
                
                val feedSuffix = when (feedType) {
                    "left" -> " (Sol)"
                    "right" -> " (Sağ)"
                    else -> ""
                }
                
                views.setTextViewText(R.id.widget_timer_label, "$label$feedSuffix")
                views.setTextViewText(R.id.widget_timer_time, formatTime(elapsed))
            } else {
                views.setTextViewText(R.id.widget_timer_label, "Timer aktiv deyil")
                views.setTextViewText(R.id.widget_timer_time, "0:00")
            }
            
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
    
    private fun formatTime(totalSeconds: Long): String {
        val h = totalSeconds / 3600
        val m = (totalSeconds % 3600) / 60
        val s = totalSeconds % 60
        return if (h > 0) {
            String.format("%d:%02d:%02d", h, m, s)
        } else {
            String.format("%d:%02d", m, s)
        }
    }
}

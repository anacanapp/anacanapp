package com.atlasoon.anacan

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.text.DateFormat
import java.util.Date

/** Shared snapshot storage and rendering for the two home-screen widgets. */
object AnacanWidgets {
    private const val PREFS = "AnacanHomeWidgets"
    private const val KEY = "snapshot_v1"

    fun saveSnapshot(context: Context, json: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
    }

    fun snapshot(context: Context): JSONObject? = try {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)?.let { JSONObject(it) }
    } catch (e: Exception) { null }

    fun refreshAll(context: Context) {
        val manager = AppWidgetManager.getInstance(context)
        for (cls in listOf(AnacanJourneyWidget::class.java, AnacanCareWidget::class.java, AnacanWordWidget::class.java)) {
            val ids = manager.getAppWidgetIds(ComponentName(context, cls))
            if (ids.isEmpty()) continue
            val intent = Intent(context, cls).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }
    }

    fun link(context: Context, url: String, requestCode: Int): PendingIntent {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            setPackage(context.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun label(s: JSONObject?, key: String, fallback: String): String =
        s?.optJSONObject("labels")?.optString(key)?.takeIf { it.isNotEmpty() } ?: fallback

    fun linkOf(s: JSONObject?, key: String, fallback: String): String =
        s?.optJSONObject("links")?.optString(key)?.takeIf { it.isNotEmpty() } ?: fallback

    /** "1h 40m" style from the app's localized template ("{h}s {m}d" / "{n} dəq"). */
    fun duration(s: JSONObject?, minutes: Long): String {
        val m = if (minutes < 0) 0 else minutes
        return if (m >= 60) label(s, "hoursMinutes", "{h}h {m}m").replace("{h}", (m / 60).toString()).replace("{m}", (m % 60).toString())
        else label(s, "minutes", "{n} min").replace("{n}", m.toString())
    }

    fun clock(context: Context, ms: Long): String = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(ms))
}

class AnacanJourneyWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val s = AnacanWidgets.snapshot(context)
        val journey = s?.optJSONObject("journey")
        for (id in ids) {
            val v = RemoteViews(context.packageName, R.layout.widget_journey)
            if (journey == null || s.optBoolean("privacy", false)) {
                v.setTextViewText(R.id.wj_eyebrow, "ANACAN")
                v.setTextViewText(R.id.wj_title, AnacanWidgets.label(s, if (journey == null) "openApp" else "hidden", "Anacan"))
                v.setTextViewText(R.id.wj_subtitle, "")
                v.setTextViewText(R.id.wj_emoji, "🌸")
                v.setViewVisibility(R.id.wj_progress, View.GONE)
                v.setViewVisibility(R.id.wj_badge, View.GONE)
            } else {
                v.setTextViewText(R.id.wj_eyebrow, journey.optString("eyebrow").uppercase())
                v.setTextViewText(R.id.wj_title, journey.optString("title"))
                v.setTextViewText(R.id.wj_subtitle, journey.optString("subtitle"))
                v.setViewVisibility(R.id.wj_subtitle, if (journey.optString("subtitle").isEmpty()) View.GONE else View.VISIBLE)
                v.setTextViewText(R.id.wj_emoji, journey.optString("emoji", "🌸"))
                val progress = (journey.optDouble("progress", 0.0) * 100).toInt()
                v.setViewVisibility(R.id.wj_progress, if (progress > 0) View.VISIBLE else View.GONE)
                v.setProgressBar(R.id.wj_progress, 100, progress, false)
                val badge = journey.optString("badge")
                v.setViewVisibility(R.id.wj_badge, if (badge.isEmpty()) View.GONE else View.VISIBLE)
                v.setTextViewText(R.id.wj_badge, badge)
            }
            v.setOnClickPendingIntent(R.id.wj_root, AnacanWidgets.link(context, AnacanWidgets.linkOf(s, "home", "anacan:///"), 7100))
            manager.updateAppWidget(id, v)
        }
    }
}

class AnacanCareWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val s = AnacanWidgets.snapshot(context)
        for (id in ids) manager.updateAppWidget(id, render(context, s))
    }

    private fun render(context: Context, s: JSONObject?): RemoteViews {
        val care = s?.optJSONObject("care")
        if (care == null) {
            // No child/care data yet: keep the simple teaser card.
            val v = RemoteViews(context.packageName, R.layout.widget_locked)
            v.setTextViewText(R.id.wl_title, AnacanWidgets.label(s, if (s == null) "openApp" else "premiumTitle", "Anacan Premium"))
            v.setTextViewText(R.id.wl_body, if (s == null) "" else AnacanWidgets.label(s, "premiumBody", ""))
            val target = if (s == null) AnacanWidgets.linkOf(s, "home", "anacan:///") else AnacanWidgets.linkOf(s, "premium", "anacan://premium")
            v.setOnClickPendingIntent(R.id.wl_root, AnacanWidgets.link(context, target, 7200))
            return v
        }
        // Non-Premium: show the FULL care widget as a sample preview with a lock badge + "Premium required"
        // CTA; all taps go to the paywall. Premium: real data + quick actions.
        val locked = s.optBoolean("careLocked", false) || !s.optBoolean("premium", false)
        val v = RemoteViews(context.packageName, R.layout.widget_care)
        val now = System.currentTimeMillis()
        val privacy = s.optBoolean("privacy", false)
        v.setViewVisibility(R.id.wc_lock, if (locked) View.VISIBLE else View.GONE)
        if (locked) v.setTextViewText(R.id.wc_lock, "🔒 " + AnacanWidgets.label(s, "premiumBadge", "Premium").uppercase())
        v.setTextViewText(R.id.wc_name, if (privacy) "ANACAN" else care.optString("name").uppercase())
        v.setTextViewText(R.id.wc_age, if (privacy) "" else care.optString("age"))
        v.setTextViewText(R.id.wc_emoji, care.optString("emoji", "👶"))

        v.setTextViewText(R.id.wc_feed_label, AnacanWidgets.label(s, "lastFeed", "Last feed").uppercase())
        val feedAt = care.optLong("lastFeedAt", 0L)
        if (feedAt > 0) {
            v.setTextViewText(R.id.wc_feed_value, AnacanWidgets.duration(s, (now - feedAt) / 60_000))
            v.setTextViewText(R.id.wc_feed_sub, "${AnacanWidgets.clock(context, feedAt)} · ${care.optString("lastFeedText")}")
        } else {
            v.setTextViewText(R.id.wc_feed_value, "—")
            v.setTextViewText(R.id.wc_feed_sub, AnacanWidgets.label(s, "noData", ""))
        }

        val sleepingSince = care.optLong("sleepingSince", 0L)
        if (sleepingSince > 0) {
            v.setTextViewText(R.id.wc_nap_label, AnacanWidgets.label(s, "sleeping", "Sleeping").uppercase())
            v.setViewVisibility(R.id.wc_nap_value, View.GONE)
            v.setViewVisibility(R.id.wc_nap_timer, View.VISIBLE)
            v.setChronometer(R.id.wc_nap_timer, SystemClock.elapsedRealtime() - (now - sleepingSince), null, true)
            v.setTextViewText(R.id.wc_nap_sub, AnacanWidgets.clock(context, sleepingSince))
        } else {
            v.setViewVisibility(R.id.wc_nap_timer, View.GONE)
            v.setViewVisibility(R.id.wc_nap_value, View.VISIBLE)
            val bed = care.optBoolean("nextNapIsBedtime", false)
            v.setTextViewText(R.id.wc_nap_label, AnacanWidgets.label(s, if (bed) "bedtime" else "nextNap", "Next nap").uppercase())
            val start = care.optLong("nextNapStart", 0L)
            val end = care.optLong("nextNapEnd", 0L)
            if (start > 0) {
                v.setTextViewText(R.id.wc_nap_value, AnacanWidgets.clock(context, start))
                v.setTextViewText(R.id.wc_nap_sub, if (start > now) "+" + AnacanWidgets.duration(s, (start - now) / 60_000)
                    else "${AnacanWidgets.clock(context, start)}–${AnacanWidgets.clock(context, end)}")
            } else {
                v.setTextViewText(R.id.wc_nap_value, "—")
                v.setTextViewText(R.id.wc_nap_sub, "")
            }
        }

        v.setTextViewText(R.id.wc_today, "${AnacanWidgets.label(s, "today", "Today").uppercase()}  ·  🍼 ${care.optInt("todayFeeds")}  ·  😴 ${care.optString("todaySleep")}  ·  🧷 ${care.optInt("todayDiapers")}")

        if (locked) {
            // Sample preview: no quick actions; a single "Premium required" CTA, everything → paywall.
            v.setViewVisibility(R.id.wc_actions, View.GONE)
            v.setViewVisibility(R.id.wc_premium_cta, View.VISIBLE)
            v.setTextViewText(R.id.wc_premium_cta, "🔒 " + AnacanWidgets.label(s, "premiumLocked", "Anacan Premium"))
            val premium = AnacanWidgets.link(context, AnacanWidgets.linkOf(s, "premium", "anacan://premium"), 7200)
            v.setOnClickPendingIntent(R.id.wc_premium_cta, premium)
            v.setOnClickPendingIntent(R.id.wc_root, premium)
            return v
        }
        v.setViewVisibility(R.id.wc_premium_cta, View.GONE)
        val actions = s.optBoolean("showActions", true)
        v.setViewVisibility(R.id.wc_actions, if (actions) View.VISIBLE else View.GONE)
        v.setTextViewText(R.id.wc_btn_feed, "🍼 " + AnacanWidgets.label(s, "btnFeed", "Feed"))
        v.setTextViewText(R.id.wc_btn_sleep, (if (sleepingSince > 0) "☀️ " + AnacanWidgets.label(s, "btnWoke", "Woke up") else "😴 " + AnacanWidgets.label(s, "btnSleep", "Sleep")))
        v.setTextViewText(R.id.wc_btn_diaper, "🧷 " + AnacanWidgets.label(s, "btnDiaper", "Diaper"))
        v.setOnClickPendingIntent(R.id.wc_btn_feed, AnacanWidgets.link(context, AnacanWidgets.linkOf(s, "feed", "anacan://tool/baby-tracker"), 7301))
        v.setOnClickPendingIntent(R.id.wc_btn_sleep, AnacanWidgets.link(context,
            if (sleepingSince > 0) AnacanWidgets.linkOf(s, "sleepTool", "anacan://tool/sleep-training") else AnacanWidgets.linkOf(s, "sleep", "anacan://tool/sleep-training"), 7302))
        v.setOnClickPendingIntent(R.id.wc_btn_diaper, AnacanWidgets.link(context, AnacanWidgets.linkOf(s, "diaper", "anacan://tool/baby-tracker"), 7303))
        v.setOnClickPendingIntent(R.id.wc_root, AnacanWidgets.link(context, AnacanWidgets.linkOf(s, "tracker", "anacan://tool/baby-tracker"), 7304))
        return v
    }
}

/** Word of the day (free): a gentle daily affirmation from the snapshot. */
class AnacanWordWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val s = AnacanWidgets.snapshot(context)
        val word = s?.optJSONObject("word")
        for (id in ids) {
            val v = RemoteViews(context.packageName, R.layout.widget_word)
            v.setTextViewText(R.id.ww_eyebrow, (word?.optString("eyebrow")?.takeIf { it.isNotEmpty() }
                ?: AnacanWidgets.label(s, "wordEyebrow", "Anacan")).uppercase())
            v.setTextViewText(R.id.ww_text, word?.optString("text")?.takeIf { it.isNotEmpty() }
                ?: AnacanWidgets.label(s, "openApp", "Anacan"))
            v.setOnClickPendingIntent(R.id.ww_root, AnacanWidgets.link(context, AnacanWidgets.linkOf(s, "home", "anacan:///"), 7400))
            manager.updateAppWidget(id, v)
        }
    }
}

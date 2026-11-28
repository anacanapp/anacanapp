package com.atlasoon.anacan

import android.app.Activity
import android.app.Dialog
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.google.ads.mediation.admob.AdMobAdapter
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdLoader
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.VideoOptions
import com.google.android.gms.ads.nativead.AdChoicesView
import com.google.android.gms.ads.nativead.MediaView
import com.google.android.gms.ads.nativead.NativeAd
import com.google.android.gms.ads.nativead.NativeAdOptions
import com.google.android.gms.ads.nativead.NativeAdView
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * The parts of the patched `@capacitor-community/admob` 8.1.0 (patches/@capacitor-community+admob+8.1.0.patch) that
 * google_mobile_ads has no Dart API for. Banners, interstitials, rewarded ads and UMP run through google_mobile_ads
 * (services/ads/google_mobile_ads_sdk.dart); the Google Mobile Ads SDK classes come from that plugin's `api`
 * dependency (play-services-ads), so nothing is added to Gradle.
 *
 *  - `appId`: the AdMob app id this build declares (manifest meta-data, filled from the native config like the
 *    Capacitor admob.xml), React's compiled `VITE_ADMOB_ANDROID_APP_ID`.
 *  - The full-screen native story ad, a port of the patch's NativeStoryExecutor.java: one ad at a time, a later
 *    prepare replaces the pending one, video-only requests reject image ads, the black full-screen dialog with media,
 *    the "REKLAM" footer, close and "next story" buttons, auto-dismiss after 6 s without video.
 *
 * Channel "anacan/admob": appId, prepareNativeStoryAd {adId, isTesting, npa, videoOnly} -> {adUnitId, hasVideo},
 * showNativeStoryAd {adId}, removeNativeStoryAd. Native -> Dart: event {name} (nativeStoryAdShowed,
 * nativeStoryAdImpression, nativeStoryAdDismissed).
 */
class AnacanAdsPlugin private constructor(
    private val activity: Activity,
    private val channel: MethodChannel,
) : MethodChannel.MethodCallHandler {

    private val handler = Handler(Looper.getMainLooper())
    private var ad: NativeAd? = null
    private var dialog: Dialog? = null
    private var unit = ""
    private var generation = 0
    private var pending: MethodChannel.Result? = null

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "appId" -> result.success(appId())
            "prepareNativeStoryAd" -> prepare(call, result)
            "showNativeStoryAd" -> show(call, result)
            "removeNativeStoryAd" -> {
                clear()
                result.success(null)
            }
            else -> result.notImplemented()
        }
    }

    private fun notify(name: String) {
        channel.invokeMethod("event", mapOf("name" to name))
    }

    private fun appId(): String? = try {
        val pm = activity.packageManager
        val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pm.getApplicationInfo(activity.packageName, PackageManager.ApplicationInfoFlags.of(PackageManager.GET_META_DATA.toLong()))
        } else {
            @Suppress("DEPRECATION")
            pm.getApplicationInfo(activity.packageName, PackageManager.GET_META_DATA)
        }
        info.metaData?.getString("com.google.android.gms.ads.APPLICATION_ID")
    } catch (error: Exception) {
        null
    }

    /** RequestHelper.createRequest: `npa` as the AdMob network extra. */
    private fun request(npa: Boolean): AdRequest {
        val builder = AdRequest.Builder()
        if (npa) {
            val extras = Bundle()
            extras.putString("npa", "1")
            builder.addNetworkExtrasBundle(AdMobAdapter::class.java, extras)
        }
        return builder.build()
    }

    private fun prepare(call: MethodCall, result: MethodChannel.Result) {
        if (dialog != null) {
            result.error("BUSY", "Native story is busy", null)
            return
        }
        val own = ++generation
        pending?.error("REPLACED", "Native story preparation replaced", null)
        pending = result
        ad?.destroy()
        ad = null
        val videoOnly = call.argument<Boolean>("videoOnly") ?: false
        val test = if (videoOnly) "ca-app-pub-3940256099942544/1044960115" else "ca-app-pub-3940256099942544/2247696110"
        val isTesting = call.argument<Boolean>("isTesting") ?: false
        unit = if (isTesting) test else call.argument<String>("adId") ?: test
        val loadUnit = unit
        try {
            AdLoader.Builder(activity, loadUnit).forNativeAd { value ->
                if (own != generation) {
                    value.destroy()
                    return@forNativeAd
                }
                pending = null
                val hasVideo = value.mediaContent?.hasVideoContent() == true
                if (videoOnly && !hasVideo) {
                    value.destroy()
                    result.error("UNAVAILABLE", "Native video ad unavailable", null)
                    return@forNativeAd
                }
                ad = value
                result.success(mapOf("adUnitId" to loadUnit, "hasVideo" to hasVideo))
            }.withAdListener(object : AdListener() {
                override fun onAdFailedToLoad(error: LoadAdError) {
                    if (own == generation) {
                        pending = null
                        result.error("UNAVAILABLE", "Native story ad unavailable", null)
                    }
                }

                override fun onAdImpression() {
                    if (own == generation && dialog != null) notify("nativeStoryAdImpression")
                }
            }).withNativeAdOptions(
                NativeAdOptions.Builder()
                    .setMediaAspectRatio(NativeAdOptions.NATIVE_MEDIA_ASPECT_RATIO_PORTRAIT)
                    .setVideoOptions(VideoOptions.Builder().setStartMuted(true).build())
                    .build()
            ).build().loadAd(request(call.argument<Boolean>("npa") ?: false))
        } catch (error: Exception) {
            if (own == generation && pending === result) {
                pending = null
                result.error("UNAVAILABLE", "Native story ad unavailable", null)
            }
        }
    }

    private fun dp(value: Int): Int = Math.round(value * activity.resources.displayMetrics.density)

    private fun text(value: String?, size: Int, color: Int): TextView {
        val view = TextView(activity)
        view.text = value
        view.textSize = size.toFloat()
        view.setTextColor(color)
        view.maxLines = 2
        return view
    }

    private fun show(call: MethodCall, result: MethodChannel.Result) {
        val current = ad
        if (current == null || dialog != null || unit != call.argument<String>("adId")) {
            result.error("NOT_READY", "Native story ad not ready", null)
            return
        }
        try {
            val root = FrameLayout(activity)
            root.setBackgroundColor(Color.BLACK)
            val view = NativeAdView(activity)
            root.addView(view, FrameLayout.LayoutParams(-1, -1))
            val media = MediaView(activity)
            val mediaParams = FrameLayout.LayoutParams(-1, -1)
            mediaParams.topMargin = dp(54)
            mediaParams.bottomMargin = dp(240)
            view.addView(media, mediaParams)
            view.mediaView = media
            current.mediaContent?.let { media.mediaContent = it }
            val footer = LinearLayout(activity)
            footer.orientation = LinearLayout.VERTICAL
            footer.setPadding(dp(20), dp(14), dp(20), dp(14))
            footer.setBackgroundColor(0xDD000000.toInt())
            val footerParams = FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM)
            footerParams.bottomMargin = dp(54)
            view.addView(footer, footerParams)
            footer.addView(text("REKLAM", 11, Color.LTGRAY))
            val advertiser = text(current.advertiser, 12, Color.LTGRAY)
            footer.addView(advertiser)
            view.advertiserView = advertiser
            val headline = text(current.headline, 22, Color.WHITE)
            footer.addView(headline)
            view.headlineView = headline
            val body = text(current.body, 14, Color.LTGRAY)
            footer.addView(body)
            view.bodyView = body
            val cta = Button(activity)
            cta.text = current.callToAction
            footer.addView(cta, LinearLayout.LayoutParams(-1, dp(52)))
            view.callToActionView = cta
            val choices = AdChoicesView(activity)
            val choicesParams = FrameLayout.LayoutParams(dp(32), dp(32), Gravity.TOP or Gravity.END)
            choicesParams.topMargin = dp(12)
            choicesParams.rightMargin = dp(16)
            view.addView(choices, choicesParams)
            view.adChoicesView = choices
            view.setNativeAd(current)
            val close = Button(activity)
            close.text = "✕"
            close.contentDescription = "Reklamı bağla"
            val closeParams = FrameLayout.LayoutParams(dp(52), dp(48), Gravity.TOP or Gravity.START)
            closeParams.topMargin = dp(8)
            closeParams.leftMargin = dp(8)
            root.addView(close, closeParams)
            val next = Button(activity)
            next.text = "Növbəti story ›"
            val nextParams = FrameLayout.LayoutParams(-1, dp(48), Gravity.BOTTOM)
            nextParams.bottomMargin = dp(4)
            root.addView(next, nextParams)
            val page = Dialog(activity, android.R.style.Theme_Black_NoTitleBar_Fullscreen)
            page.setContentView(root)
            dialog = page
            page.setOnDismissListener {
                if (dialog !== page) return@setOnDismissListener
                dialog = null
                current.destroy()
                if (ad === current) ad = null
                handler.removeCallbacksAndMessages(null)
                notify("nativeStoryAdDismissed")
            }
            close.setOnClickListener { page.dismiss() }
            next.setOnClickListener { page.dismiss() }
            page.show()
            page.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            notify("nativeStoryAdShowed")
            result.success(null)
            if (current.mediaContent?.hasVideoContent() != true) {
                handler.postDelayed({ if (dialog === page) page.dismiss() }, 6000)
            }
        } catch (error: Exception) {
            result.error("FAILED", "Native story presentation failed", null)
        }
    }

    private fun clear() {
        generation++
        handler.removeCallbacksAndMessages(null)
        pending?.error("CANCELLED", "Native story cancelled", null)
        pending = null
        dialog?.dismiss()
        ad?.destroy()
        ad = null
    }

    /** Engine teardown: the story is cancelled and the channel released. */
    fun detach() {
        clear()
        channel.setMethodCallHandler(null)
    }

    companion object {
        const val CHANNEL = "anacan/admob"

        fun register(activity: Activity, messenger: BinaryMessenger): AnacanAdsPlugin {
            val channel = MethodChannel(messenger, CHANNEL)
            val plugin = AnacanAdsPlugin(activity, channel)
            channel.setMethodCallHandler(plugin)
            return plugin
        }
    }
}

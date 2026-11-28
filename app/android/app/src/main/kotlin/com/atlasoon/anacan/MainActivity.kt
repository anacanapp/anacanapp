package com.atlasoon.anacan

import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

// FlutterFragmentActivity: purchases_ui_flutter (RevenueCat paywall / Customer Center) needs a FragmentActivity.
// Same class name and package as the Capacitor launcher activity (pinned shortcuts survive the update).
//
// Ported from the Capacitor MainActivity.java: its local plugins become method channels registered here
// (HealthCycle / HealthVitals, AnacanWidgets, FbEvents, LiveActivity = TimerWidgetPlugin, ScreenshotGuard).
// The WebView-only parts (SafeBridgeWebChromeClient, renderer-crash recovery, the bridge-less
// onSaveInstanceState guard, the FacebookEvents plugin filter) have no Flutter counterpart. Deep links arrive
// through app_links (singleTask + onNewIntent), edge-to-edge and back navigation are handled by Flutter.
class MainActivity : FlutterFragmentActivity() {
    private var screenshotGuard: ScreenshotGuardPlugin? = null
    private var timer: TimerWidgetPlugin? = null
    private var health: HealthPlugins? = null
    private var healthReads: HealthReadsPlugin? = null
    private var ads: AnacanAdsPlugin? = null
    private var legacyWebStorage: LegacyWebStorageChannel? = null
    private val channels = mutableListOf<MethodChannel>()

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val messenger = flutterEngine.dartExecutor.binaryMessenger
        // Capacitor Preferences store (sessions, admission pin, migration export).
        LegacyPreferencesChannel.register(this, messenger)
        // Capacitor WebView localStorage fallback (users who skipped the 53.0 bridge export).
        LegacyWebStorageChannel.register(this, messenger).let { (channel, handler) ->
            channels += channel
            legacyWebStorage = handler
        }
        // Screenshot ban (FLAG_SECURE + capture detection), on from the first frame.
        screenshotGuard = ScreenshotGuardPlugin(this, messenger)
        // Feeding / sleep timers: lock-screen chronometer notification (foreground service).
        timer = TimerWidgetPlugin.register(this, messenger)
        // Home-screen widgets bridge (journey, care, word of the day).
        channels += AnacanWidgetsPlugin.register(this, messenger)
        // Health Connect writes: period (HealthCycle), weight / blood pressure / glucose (HealthVitals).
        health = HealthPlugins.register(this, messenger)
        // Health Connect reads (capacitor-health `Health`): steps, exercise sessions.
        healthReads = HealthReadsPlugin.register(this, messenger)
        // Meta App Events (consent-gated in Dart).
        channels += FbEventsPlugin.register(this, messenger)
        // AdMob (banners, interstitial, rewarded, native story ad, UMP), TikTok events, Customer.io Data Pipelines.
        ads = AnacanAdsPlugin.register(this, messenger)
        channels += TikTokEventsPlugin.register(this, messenger)
        channels += CustomerIoPlugin.register(this, messenger)
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        screenshotGuard?.detach()
        screenshotGuard = null
        timer?.detach()
        timer = null
        health?.detach()
        health = null
        healthReads?.detach()
        healthReads = null
        ads?.detach()
        ads = null
        legacyWebStorage?.detach()
        legacyWebStorage = null
        channels.forEach { it.setMethodCallHandler(null) }
        channels.clear()
        super.cleanUpFlutterEngine(flutterEngine)
    }

    override fun onResume() {
        super.onResume()
        screenshotGuard?.onResume()
    }

    override fun onPause() {
        screenshotGuard?.onPause()
        super.onPause()
    }
}

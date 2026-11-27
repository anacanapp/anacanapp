package com.atlasoon.anacan

import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine

// FlutterFragmentActivity: purchases_ui_flutter (RevenueCat paywall / Customer Center) needs a FragmentActivity.
// Same class name and package as the Capacitor launcher activity (pinned shortcuts survive the update).
class MainActivity : FlutterFragmentActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Capacitor Preferences store (sessions, admission pin, migration export).
        LegacyPreferencesChannel.register(this, flutterEngine.dartExecutor.binaryMessenger)
    }
}

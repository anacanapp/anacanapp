package com.atlasoon.anacan

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Capacitor Preferences store (sessions, admission pin, migration export).
        LegacyPreferencesChannel.register(this, flutterEngine.dartExecutor.binaryMessenger)
    }
}

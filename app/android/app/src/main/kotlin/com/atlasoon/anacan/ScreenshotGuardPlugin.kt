package com.atlasoon.anacan

import android.app.Activity
import android.os.Build
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Screenshot guard, ported from the Capacitor app's ScreenshotGuardPlugin.java (same behaviour).
 *
 * - FLAG_SECURE: screenshots, screen recordings and the app-switcher preview are blocked by the system
 *   (every Android version). On by default, from the first frame.
 * - Android 14+ (API 34): a screenshot attempt fires Activity.ScreenCaptureCallback and Dart receives
 *   "screenshotTaken" (needs the normal DETECT_SCREEN_CAPTURE permission in the manifest).
 * - While paused the flag is lifted and a branded cover (app background + splash art) is drawn, so recents
 *   shows Anacan instead of a black card and still never user content; it comes back in [onResume].
 *
 * Channel "anacan/screenshot_guard" (Dart: services/security/dashboard_capture.dart MethodChannelScreenshotGuard):
 * setEnabled {enabled} -> {enabled, secureSurface}, setCurtainSuspended {suspended} -> {suspended};
 * native -> Dart: screenshotTaken.
 *
 * Owned by MainActivity: [onResume] / [onPause] are forwarded from its lifecycle (Capacitor's
 * handleOnResume / handleOnPause), [detach] when the engine is cleaned up.
 */
class ScreenshotGuardPlugin(private val activity: Activity, messenger: BinaryMessenger) : MethodChannel.MethodCallHandler {

    private val channel = MethodChannel(messenger, CHANNEL)
    private var captureCallback: Any? = null // Activity.ScreenCaptureCallback (API 34+ only)
    private var callbackRegistered = false
    private var protectionEnabled = true
    private var recentsCover: View? = null

    init {
        channel.setMethodCallHandler(this)
        // Capacitor load(): protected from the start.
        applySecureFlag(true)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "setEnabled" -> {
                val enabled = call.argument<Boolean>("enabled") ?: true
                protectionEnabled = enabled
                applySecureFlag(enabled)
                result.success(mapOf("enabled" to enabled, "secureSurface" to true))
            }
            // iOS-only behaviour (Face ID resigns the app there); Android's BiometricPrompt never pauses the activity.
            "setCurtainSuspended" -> result.success(mapOf("suspended" to (call.argument<Boolean>("suspended") ?: false)))
            else -> result.notImplemented()
        }
    }

    fun onPause() {
        unregisterCaptureCallback()
        if (!protectionEnabled) return
        try {
            val decor = activity.window.decorView as ViewGroup
            val cover = recentsCover ?: FrameLayout(activity).also { frame ->
                frame.setBackgroundColor(activity.resources.getColor(R.color.appBackground, activity.theme))
                frame.isClickable = true
                val logo = ImageView(activity)
                logo.setImageResource(R.drawable.splash_icon)
                val size = Math.round(160 * activity.resources.displayMetrics.density)
                frame.addView(logo, FrameLayout.LayoutParams(size, size, Gravity.CENTER))
                recentsCover = frame
            }
            if (cover.parent == null) {
                decor.addView(cover, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            }
            cover.bringToFront()
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
        } catch (ignored: Exception) {
        }
    }

    fun onResume() {
        applySecureFlag(protectionEnabled)
        activity.runOnUiThread { removeRecentsCover() }
        if (Build.VERSION.SDK_INT < 34) return
        try {
            if (captureCallback == null) {
                captureCallback = Activity.ScreenCaptureCallback {
                    if (protectionEnabled) channel.invokeMethod("screenshotTaken", null)
                }
            }
            if (!callbackRegistered) {
                activity.registerScreenCaptureCallback(activity.mainExecutor, captureCallback as Activity.ScreenCaptureCallback)
                callbackRegistered = true
            }
        } catch (ignored: Exception) {
            // Not supported on this device: the system shows its own message.
        }
    }

    fun detach() {
        unregisterCaptureCallback()
        channel.setMethodCallHandler(null)
    }

    private fun removeRecentsCover() {
        try {
            val cover = recentsCover
            (cover?.parent as? ViewGroup)?.removeView(cover)
        } catch (ignored: Exception) {
        }
    }

    private fun applySecureFlag(enabled: Boolean) {
        activity.runOnUiThread {
            try {
                if (enabled) {
                    activity.window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
                } else {
                    activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                }
            } catch (ignored: Exception) {
            }
        }
    }

    private fun unregisterCaptureCallback() {
        if (Build.VERSION.SDK_INT < 34 || !callbackRegistered) return
        try {
            activity.unregisterScreenCaptureCallback(captureCallback as Activity.ScreenCaptureCallback)
        } catch (ignored: Exception) {
        } finally {
            callbackRegistered = false
        }
    }

    companion object {
        const val CHANNEL = "anacan/screenshot_guard"
    }
}

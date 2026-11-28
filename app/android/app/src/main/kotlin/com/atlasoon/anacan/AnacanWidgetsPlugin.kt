package com.atlasoon.anacan

import android.content.Context
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * Home-screen widgets bridge, ported from the Capacitor app's AnacanWidgetsPlugin.kt. Dart sends a small localized
 * JSON snapshot (native/platform/home_widgets/home_widget_snapshot.dart, same shape as src/lib/home-widgets.ts);
 * it is stored in private shared preferences ([AnacanWidgets]) and every placed widget redraws.
 *
 * Channel "anacan/widgets": update {snapshot} -> {ok: true}; errors snapshot_required / snapshot_too_large.
 */
class AnacanWidgetsPlugin private constructor(private val context: Context) : MethodChannel.MethodCallHandler {

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "update" -> {
                val snapshot = call.argument<String>("snapshot") ?: return result.error("snapshot_required", null, null)
                if (snapshot.length > 32_000) return result.error("snapshot_too_large", null, null)
                try {
                    AnacanWidgets.saveSnapshot(context, snapshot)
                    AnacanWidgets.refreshAll(context)
                    result.success(mapOf("ok" to true))
                } catch (error: Exception) {
                    result.error("WIDGETS", error.javaClass.simpleName, null)
                }
            }
            else -> result.notImplemented()
        }
    }

    companion object {
        const val CHANNEL = "anacan/widgets"

        fun register(context: Context, messenger: BinaryMessenger): MethodChannel {
            val channel = MethodChannel(messenger, CHANNEL)
            channel.setMethodCallHandler(AnacanWidgetsPlugin(context.applicationContext))
            return channel
        }
    }
}

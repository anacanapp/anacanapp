package com.atlasoon.anacan

import android.content.Context
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * STUB of the "anacan/customerio" channel until the Customer.io Data Pipelines dependency exists: `initialize`
 * rejects like a build without the CustomerIoDataIn plugin (Dart then treats Customer.io as unavailable), identify /
 * track / screen reject like the uninitialised plugin and reset resolves. Nothing is sent. The real port is
 * app/android/native_pending/CustomerIoPlugin.kt and replaces this file as is (same class and register signature).
 */
class CustomerIoPlugin private constructor() : MethodChannel.MethodCallHandler {

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "initialize" -> result.error("CUSTOMERIO_NATIVE_PLUGIN_REQUIRED", null, null)
            "identify" -> result.error("CUSTOMERIO_IDENTITY_REQUIRED", null, null)
            "track" -> result.error("CUSTOMERIO_EVENT_REJECTED", null, null)
            "screen" -> result.error("CUSTOMERIO_SCREEN_REJECTED", null, null)
            "reset" -> result.success(null)
            else -> result.notImplemented()
        }
    }

    companion object {
        const val CHANNEL = "anacan/customerio"

        @Suppress("UNUSED_PARAMETER")
        fun register(context: Context, messenger: BinaryMessenger): MethodChannel {
            val channel = MethodChannel(messenger, CHANNEL)
            channel.setMethodCallHandler(CustomerIoPlugin())
            return channel
        }
    }
}

package com.atlasoon.anacan

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import org.json.JSONTokener
import java.io.ByteArrayInputStream
import java.io.File

/**
 * Hidden-WebView fallback of the Capacitor -> Flutter migration (docs/flutter/LEGACY_STORAGE.md): reads the
 * localStorage the Capacitor WebView kept for origin https://app.anacan.az (capacitor.config.json
 * server.hostname + androidScheme https) for users who skipped the 53.0 bridge export.
 *
 * The Capacitor WebView used the app's default WebView profile (data directory app_webview), so a WebView
 * created by this same app sees the same localStorage. The page is an empty local document loaded with
 * loadDataWithBaseURL on that origin; network loads and navigations are blocked. The Dart side passes the
 * script (it filters the keys by the 53.0 export rules inside the WebView and never writes localStorage).
 *
 * Channel "az.anacan/legacy_web_storage": hasLegacyData -> Boolean (checked without creating a WebView),
 * read {script, timeoutMs} -> String (the script's string result).
 */
class LegacyWebStorageChannel private constructor(private val context: Context) : MethodChannel.MethodCallHandler {
    private val main = Handler(Looper.getMainLooper())
    private var webView: WebView? = null
    private var pending: MethodChannel.Result? = null
    private var timeout: Runnable? = null

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        try {
            when (call.method) {
                "hasLegacyData" -> result.success(hasLegacyData())
                "read" -> {
                    val script = call.argument<String>("script") ?: return result.error("INVALID", "script", null)
                    val timeoutMs = call.argument<Number>("timeoutMs")?.toLong() ?: DEFAULT_TIMEOUT_MS
                    read(script, timeoutMs, result)
                }
                else -> result.notImplemented()
            }
        } catch (error: Exception) {
            // A failed read answers through finish(); anything else answers here.
            if (pending === result) finish(null, "LEGACY_WEB_STORAGE")
            else result.error("LEGACY_WEB_STORAGE", error.javaClass.simpleName, null)
        }
    }

    /** True when the old app's WebView data directory exists (a fresh install has none). */
    private fun hasLegacyData(): Boolean {
        val dir = File(context.applicationInfo.dataDir, "app_webview")
        return dir.isDirectory && (dir.list()?.isNotEmpty() == true)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun read(script: String, timeoutMs: Long, result: MethodChannel.Result) {
        if (pending != null) return result.error("BUSY", null, null)
        pending = result
        val view = WebView(context.applicationContext)
        webView = view
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            blockNetworkLoads = true
        }
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = true

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse =
                WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) finish(null, "LOAD")
            }

            override fun onPageFinished(view: WebView, url: String?) {
                if (webView !== view || pending == null) return
                view.evaluateJavascript(script) { value ->
                    // evaluateJavascript hands back the JSON form of the result: a quoted string here.
                    val decoded = try {
                        JSONTokener(value ?: "null").nextValue()
                    } catch (_: Exception) {
                        null
                    }
                    if (decoded is String) finish(decoded, null) else finish(null, "SCRIPT")
                }
            }
        }
        val stop = Runnable { finish(null, "TIMEOUT") }
        timeout = stop
        main.postDelayed(stop, timeoutMs)
        view.loadDataWithBaseURL(ORIGIN, PAGE, "text/html", "utf-8", null)
    }

    private fun finish(value: String?, errorCode: String?) {
        val result = pending ?: return
        pending = null
        timeout?.let { main.removeCallbacks(it) }
        timeout = null
        webView?.let {
            it.stopLoading()
            it.destroy()
        }
        webView = null
        // Never echo values or messages: they can contain stored user data.
        if (errorCode == null) result.success(value) else result.error(errorCode, null, null)
    }

    fun detach() = finish(null, "DETACHED")

    companion object {
        const val CHANNEL = "az.anacan/legacy_web_storage"
        const val ORIGIN = "https://app.anacan.az/"
        private const val PAGE = "<!doctype html><html><head><meta charset=\"utf-8\"></head><body></body></html>"
        private const val DEFAULT_TIMEOUT_MS = 6000L

        fun register(context: Context, messenger: BinaryMessenger): Pair<MethodChannel, LegacyWebStorageChannel> {
            val handler = LegacyWebStorageChannel(context.applicationContext)
            val channel = MethodChannel(messenger, CHANNEL)
            channel.setMethodCallHandler(handler)
            return channel to handler
        }
    }
}

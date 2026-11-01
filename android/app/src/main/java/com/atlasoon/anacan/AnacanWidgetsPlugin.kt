package com.atlasoon.anacan

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Home-screen widgets bridge. The web app sends a small localized JSON snapshot (see
 * src/lib/home-widgets.ts); it is stored in private shared preferences and both widgets redraw.
 */
@CapacitorPlugin(name = "AnacanWidgets")
class AnacanWidgetsPlugin : Plugin() {
    @PluginMethod
    fun update(call: PluginCall) {
        val snapshot = call.getString("snapshot") ?: run { call.reject("snapshot_required"); return }
        if (snapshot.length > 32_000) { call.reject("snapshot_too_large"); return }
        AnacanWidgets.saveSnapshot(context, snapshot)
        AnacanWidgets.refreshAll(context)
        val ret = JSObject()
        ret.put("ok", true)
        call.resolve(ret)
    }
}

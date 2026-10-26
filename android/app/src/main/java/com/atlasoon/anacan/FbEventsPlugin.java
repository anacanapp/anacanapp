package com.atlasoon.anacan;

import android.os.Bundle;
import com.facebook.appevents.AppEventsLogger;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.math.BigDecimal;
import java.util.Currency;
import java.util.Iterator;

/**
 * FbEvents — Android üçün minimal, crash-təhlükəsiz Facebook App Events plugini.
 *
 * Tarixçə: "capacitor-facebook-events" plugini Android-də startup crash-lərinə
 * görə MainActivity-də söndürülüb → Android-də FB konversiya eventləri
 * TAMAMİLƏ itirdi. Bu plugin fərqli yanaşır:
 *   - load()-da HEÇ NƏ etmir (crash pəncərəsi yoxdur)
 *   - FB SDK manifest meta-data ilə avto-init olur (AutoInitEnabled=true)
 *   - logger yalnız ilk logEvent-də lazy yaradılır, hər şey try/catch içindədir
 *
 * JS tərəfi: src/lib/facebook-events.ts (registerPlugin('FbEvents'))
 */
@CapacitorPlugin(name = "FbEvents")
public class FbEventsPlugin extends Plugin {

    private AppEventsLogger logger;

    private AppEventsLogger getLogger() {
        if (logger == null) {
            try {
                logger = AppEventsLogger.newLogger(getContext());
            } catch (Throwable t) {
                // FB SDK hazır deyil — analytics heç vaxt app-ı sındırmamalıdır
                return null;
            }
        }
        return logger;
    }

    @PluginMethod
    public void logEvent(PluginCall call) {
        try {
            String event = call.getString("event");
            if (event == null || event.trim().isEmpty()) {
                call.reject("Missing event argument");
                return;
            }

            JSObject params = call.getObject("params", new JSObject());
            AppEventsLogger l = getLogger();
            if (l == null) {
                call.resolve(); // səssiz — SDK yoxdursa event atılır
                return;
            }

            Bundle bundle = new Bundle();
            double valueToSum = Double.NaN;

            Iterator<String> keys = params.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                Object value = params.opt(key);
                if (value == null) continue;

                // _valueToSum xüsusi paramdır — bundle-a yox, value kimi gedir
                if ("_valueToSum".equals(key)) {
                    try { valueToSum = Double.parseDouble(String.valueOf(value)); } catch (Exception ignored) {}
                    continue;
                }

                if (value instanceof Number) {
                    bundle.putDouble(key, ((Number) value).doubleValue());
                } else if (value instanceof Boolean) {
                    bundle.putString(key, String.valueOf(value));
                } else {
                    bundle.putString(key, String.valueOf(value));
                }
            }

            if (!Double.isNaN(valueToSum)) {
                l.logEvent(event, valueToSum, bundle);
            } else {
                l.logEvent(event, bundle);
            }
            call.resolve();
        } catch (Throwable t) {
            // analytics heç vaxt sındırmır
            call.resolve();
        }
    }

    /**
     * Purchase eventi — Meta value-based optimization üçün.
     * logPurchase({ amount, currency, params })
     */
    @PluginMethod
    public void logPurchase(PluginCall call) {
        try {
            Double amount = call.getDouble("amount");
            String currency = call.getString("currency", "USD");
            if (amount == null) {
                call.reject("Missing amount");
                return;
            }
            AppEventsLogger l = getLogger();
            if (l == null) { call.resolve(); return; }

            JSObject params = call.getObject("params", new JSObject());
            Bundle bundle = new Bundle();
            Iterator<String> keys = params.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                Object value = params.opt(key);
                if (value != null) bundle.putString(key, String.valueOf(value));
            }

            l.logPurchase(BigDecimal.valueOf(amount), Currency.getInstance(currency), bundle);
            call.resolve();
        } catch (Throwable t) {
            call.resolve();
        }
    }

    /** iOS ATT ekvivalenti Android-də yoxdur — interfeys uyğunluğu üçün no-op. */
    @PluginMethod
    public void setAdvertiserTrackingEnabled(PluginCall call) {
        call.resolve();
    }
}

package az.anacan.tiktok;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tiktok.TikTokBusinessSdk;
import com.tiktok.appevents.base.TTBaseEvent;
import java.util.Iterator;

/**
 * Bridge to the TikTok Business SDK. The app calls start() only after the person allowed attribution in
 * Privacy → Consent; without it the SDK is never initialized and nothing leaves the device. Credentials come
 * from the shipped plugin config (plugins.TikTokEvents.android* in capacitor.config.json), never from bridge
 * arguments. Advertising ID collection follows the same consent (it is off unless start() runs).
 */
@CapacitorPlugin(name = "TikTokEvents")
public class TikTokEventsPlugin extends Plugin {
    private volatile boolean starting = false;

    @PluginMethod
    public void start(PluginCall call) {
        if (TikTokBusinessSdk.isInitialized()) {
            TikTokBusinessSdk.startTrack();
            call.resolve(result(true, null));
            return;
        }
        String secret = getConfig().getString("androidAppSecret", "");
        String appId = getConfig().getString("androidAppId", "");
        String ttAppId = getConfig().getString("androidTikTokAppId", "");
        if (secret.isEmpty() || appId.isEmpty() || ttAppId.isEmpty()) {
            call.resolve(result(false, "not_configured"));
            return;
        }
        if (starting) {
            call.resolve(result(false, "starting"));
            return;
        }
        starting = true;
        try {
            TikTokBusinessSdk.TTConfig config = new TikTokBusinessSdk.TTConfig(getContext().getApplicationContext(), secret)
                .setAppId(appId)
                .setTTAppId(ttAppId);
            if (Boolean.TRUE.equals(call.getBoolean("debug", false))) config.openDebugMode().setLogLevel(TikTokBusinessSdk.LogLevel.DEBUG);
            TikTokBusinessSdk.initializeSdk(config, new TikTokBusinessSdk.TTInitCallback() {
                @Override public void success() { starting = false; call.resolve(result(true, null)); }
                @Override public void fail(int code, String msg) { starting = false; call.resolve(result(false, "init_failed_" + code)); }
            });
            TikTokBusinessSdk.startTrack();
        } catch (Throwable e) {
            starting = false;
            call.resolve(result(false, "init_error"));
        }
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        if (TikTokBusinessSdk.isInitialized()) {
            try {
                if (enabled) TikTokBusinessSdk.startTrack(); else TikTokBusinessSdk.destroy();
            } catch (Throwable ignored) { }
        }
        call.resolve();
    }

    @PluginMethod
    public void track(PluginCall call) {
        String name = call.getString("event");
        if (!TikTokBusinessSdk.isInitialized() || name == null || name.isEmpty()) { call.resolve(); return; }
        try {
            TTBaseEvent.Builder builder = TTBaseEvent.newBuilder(name);
            JSObject props = call.getObject("properties");
            if (props != null) {
                Iterator<String> keys = props.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    Object value = props.opt(key);
                    if (value instanceof String) builder.addProperty(key, (String) value);
                    else if (value instanceof Boolean) builder.addProperty(key, (boolean) (Boolean) value);
                    else if (value instanceof Number) builder.addProperty(key, ((Number) value).doubleValue());
                }
            }
            TikTokBusinessSdk.trackTTEvent(builder.build());
        } catch (Throwable ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void identify(PluginCall call) {
        String id = call.getString("externalId");
        if (TikTokBusinessSdk.isInitialized() && id != null && !id.isEmpty()) {
            try { TikTokBusinessSdk.identify(id, null, null, null); } catch (Throwable ignored) { }
        }
        call.resolve();
    }

    @PluginMethod
    public void logout(PluginCall call) {
        if (TikTokBusinessSdk.isInitialized()) {
            try { TikTokBusinessSdk.logout(); } catch (Throwable ignored) { }
        }
        call.resolve();
    }

    private static JSObject result(boolean started, String reason) {
        JSObject o = new JSObject();
        o.put("started", started);
        if (reason != null) o.put("reason", reason);
        return o;
    }
}

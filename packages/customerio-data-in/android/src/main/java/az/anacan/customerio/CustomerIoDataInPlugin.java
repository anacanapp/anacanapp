package az.anacan.customerio;

import android.app.Application;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import io.customer.sdk.CustomerIO;
import io.customer.sdk.CustomerIOConfigBuilder;
import io.customer.sdk.core.util.CioLogLevel;
import io.customer.sdk.data.model.Region;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

@CapacitorPlugin(name = "CustomerIoDataIn")
public class CustomerIoDataInPlugin extends Plugin {
    private static final Object LOCK = new Object();
    private static String configuration;
    private static boolean identified;

    @PluginMethod
    public void initialize(PluginCall call) {
        synchronized (LOCK) {
            // Read the shipped native config, never key-bearing bridge arguments.
            String key = getConfig().getString("cdpApiKey");
            String environment = getConfig().getString("environment");
            if (key == null || key.isEmpty() || key.length() > 512 || key.matches(".*\\s.*") ||
                !getConfig().getBoolean("enabled", false) || !"EU".equals(getConfig().getString("region")) ||
                !"EU".equals(call.getString("region")) || environment == null || !environment.equals(call.getString("environment")) ||
                !("production".equals(environment) || "sandbox".equals(environment))) {
                call.reject("CUSTOMERIO_INVALID_CONFIGURATION"); return;
            }
            try {
                byte[] hash = MessageDigest.getInstance("SHA-256").digest((environment + ":" + key).getBytes(StandardCharsets.UTF_8));
                StringBuilder fingerprint = new StringBuilder();
                for (byte value : hash) fingerprint.append(String.format("%02x", value));
                if (configuration != null) {
                    if (configuration.equals(fingerprint.toString())) call.resolve();
                    else call.reject("CUSTOMERIO_RESTART_REQUIRED");
                    return;
                }
                CustomerIO.initialize(new CustomerIOConfigBuilder((Application) getContext().getApplicationContext(), key)
                    .region(Region.EU.INSTANCE).logLevel(CioLogLevel.NONE)
                    .trackApplicationLifecycleEvents(false).autoTrackDeviceAttributes(false)
                    .autoTrackActivityScreens(false).build());
                CustomerIO.instance().clearIdentify();
                configuration = fingerprint.toString();
                identified = false;
                call.resolve();
            } catch (Exception ignored) { call.reject("CUSTOMERIO_INITIALIZATION_FAILED"); }
        }
    }

    @PluginMethod
    public void identify(PluginCall call) {
        synchronized (LOCK) {
            String userId = call.getString("userId");
            if (configuration == null || userId == null || userId.isEmpty() || userId.length() > 200) {
                call.reject("CUSTOMERIO_IDENTITY_REQUIRED"); return;
            }
            try {
                CustomerIO.instance().identify(userId, properties(call.getObject("traits")));
                identified = true;
                call.resolve();
            } catch (Exception ignored) { call.reject("CUSTOMERIO_IDENTIFY_FAILED"); }
        }
    }

    @PluginMethod
    public void track(PluginCall call) {
        synchronized (LOCK) {
            if (configuration == null || !identified || !"community_post_created".equals(call.getString("name"))) {
                call.reject("CUSTOMERIO_EVENT_REJECTED"); return;
            }
            try {
                CustomerIO.instance().track("community_post_created", properties(call.getObject("properties")));
                call.resolve();
            } catch (Exception ignored) { call.reject("CUSTOMERIO_TRACK_FAILED"); }
        }
    }

    @PluginMethod
    public void screen(PluginCall call) {
        synchronized (LOCK) {
            String title = call.getString("title");
            if (configuration == null || !identified || title == null || !title.matches("^[A-Za-z][A-Za-z0-9 _-]{0,79}$")) {
                call.reject("CUSTOMERIO_SCREEN_REJECTED"); return;
            }
            try {
                CustomerIO.instance().screen(title, properties(call.getObject("properties")));
                call.resolve();
            } catch (Exception ignored) { call.reject("CUSTOMERIO_SCREEN_FAILED"); }
        }
    }

    @PluginMethod
    public void reset(PluginCall call) {
        synchronized (LOCK) {
            identified = false;
            try {
                if (configuration != null) CustomerIO.instance().clearIdentify();
                call.resolve();
            } catch (Exception ignored) { call.reject("CUSTOMERIO_RESET_FAILED"); }
        }
    }

    private Map<String, Object> properties(JSObject object) {
        Map<String, Object> result = new HashMap<>();
        if (object == null) return result;
        Iterator<String> keys = object.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = object.opt(key);
            if (value instanceof String || value instanceof Number || value instanceof Boolean) result.put(key, value);
        }
        return result;
    }
}

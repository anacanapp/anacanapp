package com.atlasoon.anacan;

import android.os.SystemClock;
import android.util.Log;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.WebViewListener;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final String DISABLED_PLUGIN_CLASS = "com.dabchy.plugins.facebookevents.FacebookEventsPlugin";
    // Process-wide: survives recreate() so a renderer that keeps dying cannot loop.
    private static long lastRenderRecoveryAt = 0L;

    @Override
    protected void load() {
        disableProblematicAndroidPlugins();
        // Health Connect: menstruation writes only.
        registerPlugin(HealthCyclePlugin.class);
        // Lokal plugin: Facebook App Events (köhnə plugin crash-lərinə görə
        // söndürülüb — bu minimal versiya load()-da heç nə etmir)
        registerPlugin(FbEventsPlugin.class);
        // Lokal plugin: süd vermə/yuxu taymerləri — kilid ekranı bildirişi (LiveActivity)
        registerPlugin(TimerWidgetPlugin.class);
        // Lokal plugin: screenshot qadağası (FLAG_SECURE + cəhd aşkarlama)
        registerPlugin(ScreenshotGuardPlugin.class);
        super.load();
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setWebChromeClient(new SafeBridgeWebChromeClient(getBridge()));
            getBridge().addWebViewListener(new RenderProcessRecovery());
        }
    }

    /**
     * When Android kills the WebView renderer (low memory) or it crashes, an
     * unhandled event leaves a dead, black WebView or kills the whole app.
     * Drop the dead view and recreate the activity, which builds a fresh
     * WebView and reloads the app. A second failure within 10s closes the
     * activity instead of looping.
     */
    private final class RenderProcessRecovery extends WebViewListener {
        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            boolean crashed = detail != null && detail.didCrash();
            Log.w(TAG, "WebView render process gone (crashed=" + crashed + "); recovering");
            try {
                if (view.getParent() instanceof ViewGroup) ((ViewGroup) view.getParent()).removeView(view);
                view.destroy();
            } catch (Exception error) {
                Log.e(TAG, "Failed to release dead WebView", error);
            }
            long now = SystemClock.elapsedRealtime();
            boolean repeated = now - lastRenderRecoveryAt < 10_000L;
            lastRenderRecoveryAt = now;
            if (repeated || isFinishing()) finish();
            else recreate();
            return true;
        }
    }

    @SuppressWarnings("unchecked")
    private void disableProblematicAndroidPlugins() {
        try {
            Field pluginsField = bridgeBuilder.getClass().getDeclaredField("plugins");
            pluginsField.setAccessible(true);

            List<Class<? extends Plugin>> plugins = (List<Class<? extends Plugin>>) pluginsField.get(bridgeBuilder);
            if (plugins == null || plugins.isEmpty()) {
                return;
            }

            List<Class<? extends Plugin>> filteredPlugins = new ArrayList<>();
            boolean removed = false;

            for (Class<? extends Plugin> pluginClass : plugins) {
                if (DISABLED_PLUGIN_CLASS.equals(pluginClass.getName())) {
                    removed = true;
                    continue;
                }
                filteredPlugins.add(pluginClass);
            }

            if (removed) {
                bridgeBuilder.setPlugins(filteredPlugins);
                Log.w(TAG, "Disabled Android FacebookEvents native plugin to prevent startup crashes.");
            }
        } catch (Exception error) {
            Log.e(TAG, "Failed to filter Capacitor plugins", error);
        }
    }
}

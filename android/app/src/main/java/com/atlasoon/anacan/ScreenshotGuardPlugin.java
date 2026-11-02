package com.atlasoon.anacan;

import android.app.Activity;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Screenshot qadağası (sensitiv məlumatların yayılmaması üçün).
 *
 * - FLAG_SECURE: screenshot + ekran yazısı + app-switcher önizləməsi sistem
 *   səviyyəsində bloklanır (bütün Android versiyaları).
 * - Android 14+ (API 34): istifadəçi screenshot cəhdi edəndə
 *   ScreenCaptureCallback işə düşür → JS-ə "screenshotTaken" hadisəsi
 *   göndərilir və tətbiq öz lokallaşdırılmış xəbərdarlığını göstərir.
 *   (Köhnə versiyalarda sistemin öz "icazə verilmir" mesajı görünür.)
 *
 * Qeydiyyat: MainActivity.load() → registerPlugin(ScreenshotGuardPlugin.class)
 * Tələb olunan icazə (normal, avtomatik verilir):
 *   android.permission.DETECT_SCREEN_CAPTURE (AndroidManifest.xml)
 */
@CapacitorPlugin(name = "ScreenshotGuard")
public class ScreenshotGuardPlugin extends Plugin {

    private Object captureCallback; // Activity.ScreenCaptureCallback (yalnız API 34+)
    private boolean callbackRegistered = false;
    private boolean protectionEnabled = true;
    private View recentsCover; // branded cover shown while the app is in the background

    /**
     * FLAG_SECURE makes the app-switcher card plain black. While the app is paused we lift the flag and
     * draw a branded cover (app background + launcher art) so recents shows Anacan instead of black and
     * still never shows user content. The flag comes back in handleOnResume before anything is visible.
     */
    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        unregisterCaptureCallback();
        Activity activity = getActivity();
        if (activity == null || !protectionEnabled) return;
        try {
            ViewGroup decor = (ViewGroup) activity.getWindow().getDecorView();
            if (recentsCover == null) {
                FrameLayout cover = new FrameLayout(activity);
                cover.setBackgroundColor(activity.getResources().getColor(R.color.appBackground, activity.getTheme()));
                cover.setClickable(true);
                ImageView logo = new ImageView(activity);
                logo.setImageResource(R.drawable.splash_icon);
                int size = Math.round(160 * activity.getResources().getDisplayMetrics().density);
                cover.addView(logo, new FrameLayout.LayoutParams(size, size, Gravity.CENTER));
                recentsCover = cover;
            }
            if (recentsCover.getParent() == null) {
                decor.addView(recentsCover, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            }
            recentsCover.bringToFront();
            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
        } catch (Exception ignored) {
        }
    }

    private void removeRecentsCover() {
        try {
            if (recentsCover != null && recentsCover.getParent() instanceof ViewGroup) {
                ((ViewGroup) recentsCover.getParent()).removeView(recentsCover);
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public void load() {
        applySecureFlag(true);
    }

    private void applySecureFlag(boolean enabled) {
        Activity activity = getActivity();
        if (activity == null) return;
        activity.runOnUiThread(() -> {
            try {
                if (enabled) {
                    activity.getWindow().setFlags(
                        WindowManager.LayoutParams.FLAG_SECURE,
                        WindowManager.LayoutParams.FLAG_SECURE
                    );
                } else {
                    activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                }
            } catch (Exception ignored) {
            }
        });
    }

    /** Gələcək üçün: JS-dən qadağanı idarə etmək (məs. remote kill-switch) */
    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        protectionEnabled = enabled;
        applySecureFlag(enabled);
        JSObject result = new JSObject();
        result.put("enabled", enabled);
        result.put("secureSurface", true);
        call.resolve(result);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        applySecureFlag(protectionEnabled);
        Activity resumed = getActivity();
        if (resumed != null) resumed.runOnUiThread(this::removeRecentsCover);
        if (Build.VERSION.SDK_INT < 34) return;
        Activity activity = getActivity();
        if (activity == null) return;
        try {
            if (captureCallback == null) {
                captureCallback = (Activity.ScreenCaptureCallback) () -> {
                    if (protectionEnabled) notifyListeners("screenshotTaken", new JSObject());
                };
            }
            if (!callbackRegistered) {
                activity.registerScreenCaptureCallback(
                    activity.getMainExecutor(),
                    (Activity.ScreenCaptureCallback) captureCallback
                );
                callbackRegistered = true;
            }
        } catch (Exception ignored) {
            // Cihaz dəstəkləmirsə sistem öz mesajını göstərir — kritik deyil
        }
    }

    private void unregisterCaptureCallback() {
        if (Build.VERSION.SDK_INT < 34 || !callbackRegistered) return;
        Activity activity = getActivity();
        if (activity == null) return;
        try {
            activity.unregisterScreenCaptureCallback((Activity.ScreenCaptureCallback) captureCallback);
        } catch (Exception ignored) {
        } finally {
            callbackRegistered = false;
        }
    }
}

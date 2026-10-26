package com.atlasoon.anacan;

import android.app.Activity;
import android.net.Uri;
import android.util.Log;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.concurrent.atomic.AtomicBoolean;

/** A cancelled WebView request must never be granted by a late Android permission result. */
public final class SafeBridgeWebChromeClient extends BridgeWebChromeClient {
    private final Bridge appBridge;
    private PermissionRequest activeOriginal;
    private SafeRequest activeRequest;

    public SafeBridgeWebChromeClient(Bridge bridge) {
        super(bridge);
        appBridge = bridge;
    }

    private boolean activityAvailable() {
        Activity activity = appBridge.getActivity();
        return activity != null && !activity.isFinishing() && !activity.isDestroyed();
    }

    @Override
    public void onPermissionRequest(PermissionRequest request) {
        if (!activityAvailable() || activeRequest != null) {
            try { request.deny(); } catch (RuntimeException ignored) { }
            return;
        }
        SafeRequest guarded = new SafeRequest(request);
        activeOriginal = request;
        activeRequest = guarded;
        try { super.onPermissionRequest(guarded); }
        catch (RuntimeException error) {
            guarded.deny();
            Log.w("AnacanMedia", "Permission request could not be presented");
        }
    }

    @Override
    public void onPermissionRequestCanceled(PermissionRequest request) {
        if (request == activeOriginal && activeRequest != null) activeRequest.cancel();
        super.onPermissionRequestCanceled(request);
    }

    @Override
    public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
        AtomicBoolean completed = new AtomicBoolean(false);
        GeolocationPermissions.Callback once = (value, allow, remember) -> {
            if (!completed.compareAndSet(false, true)) return;
            try { callback.invoke(value, allow && activityAvailable(), false); }
            catch (RuntimeException ignored) { }
        };
        try {
            if (!activityAvailable()) once.invoke(origin, false, false);
            else super.onGeolocationPermissionsShowPrompt(origin, once);
        } catch (RuntimeException error) {
            once.invoke(origin, false, false);
            Log.w("AnacanLocation", "Location permission request could not be presented");
        }
    }

    private final class SafeRequest extends PermissionRequest {
        private final PermissionRequest request;
        private final AtomicBoolean completed = new AtomicBoolean(false);
        SafeRequest(PermissionRequest request) { this.request = request; }
        @Override public Uri getOrigin() { return request.getOrigin(); }
        @Override public String[] getResources() { return request.getResources(); }
        private boolean finish() {
            if (!completed.compareAndSet(false, true)) return false;
            if (activeRequest == this) { activeRequest = null; activeOriginal = null; }
            return true;
        }
        void cancel() { finish(); }
        @Override public void grant(String[] resources) {
            if (!finish()) return;
            try {
                if (activityAvailable()) request.grant(resources);
                else request.deny();
            } catch (RuntimeException error) {
                try { request.deny(); } catch (RuntimeException ignored) { }
                Log.w("AnacanMedia", "Discarded an obsolete media permission result");
            }
        }
        @Override public void deny() {
            if (!finish()) return;
            try { request.deny(); } catch (RuntimeException ignored) { }
        }
    }
}

import Foundation
import Capacitor
import TikTokBusinessSDK

/// Bridge to the TikTok Business SDK. The app calls `start` only after the person allowed attribution in
/// Privacy → Consent; without it the SDK is never initialized and nothing leaves the device.
/// Credentials come from the shipped plugin config (`plugins.TikTokEvents.ios*` in capacitor.config.json),
/// never from bridge arguments. The SDK never shows the ATT prompt itself (the app asks, see facebook-events.ts).
@objc(TikTokEventsPlugin)
public class TikTokEventsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TikTokEventsPlugin"
    public let jsName = "TikTokEvents"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "track", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "identify", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logout", returnType: CAPPluginReturnPromise)
    ]
    private var starting = false

    @objc func start(_ call: CAPPluginCall) {
        let tracking = call.getBool("tracking") ?? false
        if TikTokBusiness.isInitialized() {
            TikTokBusiness.setTrackingEnabled(true)
            call.resolve(["started": true]); return
        }
        let cfg = getConfig()
        guard let secret = cfg.getString("iosAppSecret"), !secret.isEmpty,
              let appId = cfg.getString("iosAppId"), !appId.isEmpty,
              let ttAppId = cfg.getString("iosTikTokAppId"), !ttAppId.isEmpty else {
            call.resolve(["started": false, "reason": "not_configured"]); return
        }
        if starting { call.resolve(["started": false, "reason": "starting"]); return }
        starting = true
        guard let config = TikTokConfig(accessToken: secret, appId: appId, tiktokAppId: ttAppId) else {
            starting = false
            call.resolve(["started": false, "reason": "invalid_config"]); return
        }
        config.setLogLevel(call.getBool("debug") == true ? TikTokLogLevelDebug : TikTokLogLevelSuppress)
        if call.getBool("debug") == true { config.enableDebugMode() }
        // ATT is owned by the app (asked once, after consent). Without "authorized" the SDK reads no IDFA and
        // attribution falls back to SKAdNetwork; `tracking` is only logged for diagnostics.
        _ = tracking
        DispatchQueue.main.async {
            TikTokBusiness.initializeSdk(config) { [weak self] success, error in
                self?.starting = false
                if success { call.resolve(["started": true]) }
                else { call.resolve(["started": false, "reason": error?.localizedDescription ?? "init_failed"]) }
            }
        }
    }

    @objc func setEnabled(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        if TikTokBusiness.isInitialized() { TikTokBusiness.setTrackingEnabled(enabled) }
        call.resolve()
    }

    @objc func track(_ call: CAPPluginCall) {
        guard TikTokBusiness.isInitialized(), let name = call.getString("event"), !name.isEmpty else { call.resolve(); return }
        let event = TikTokBaseEvent(eventName: name)
        if let props = call.getObject("properties") {
            for (key, value) in props {
                if let v = value as? String { _ = event.addProperty(withKey: key, value: v) }
                else if let v = value as? NSNumber { _ = event.addProperty(withKey: key, value: v) }
                else if let v = value as? Bool { _ = event.addProperty(withKey: key, value: v) }
            }
        }
        TikTokBusiness.trackTTEvent(event)
        call.resolve()
    }

    @objc func identify(_ call: CAPPluginCall) {
        guard TikTokBusiness.isInitialized(), let id = call.getString("externalId"), !id.isEmpty else { call.resolve(); return }
        TikTokBusiness.identify(withExternalID: id, externalUserName: nil, phoneNumber: nil, email: nil)
        call.resolve()
    }

    @objc func logout(_ call: CAPPluginCall) {
        if TikTokBusiness.isInitialized() { TikTokBusiness.logout() }
        call.resolve()
    }
}

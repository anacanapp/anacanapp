import Flutter
import Foundation
#if canImport(TikTokBusinessSDK)
import TikTokBusinessSDK
#endif

/// Bridge to the TikTok Business SDK, ported from packages/tiktok-events (TikTokEventsPlugin.swift). Dart calls
/// `start` only after the person allowed attribution in Privacy → Consent; without it the SDK is never initialized and
/// nothing leaves the device. Credentials come from the shipped Info.plist (AnacanTikTokAppSecret / AnacanTikTokAppId /
/// AnacanTikTokTtAppId from $(ANACAN_TIKTOK_*), the Capacitor plugins.TikTokEvents.ios* values), never from channel
/// arguments. The SDK never shows the ATT prompt itself (the app asks, services/analytics/facebook_events.dart).
/// Without TikTokBusinessSDK in the build `start` answers "not_configured" and the other calls resolve silently.
///
/// Channel "anacan/tiktok_events": start {tracking, debug} -> {started, reason?}, setEnabled {enabled},
/// track {event, properties}, identify {externalId}, logout.
final class TikTokEventsChannel {
  static let channelName = "anacan/tiktok_events"

  private let channel: FlutterMethodChannel
  private var starting = false

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: TikTokEventsChannel.channelName, binaryMessenger: messenger)
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else { result(FlutterError(code: "UNAVAILABLE", message: nil, details: nil)); return }
      self.handle(call, result: result)
    }
  }

  private static func config(_ key: String) -> String {
    (Bundle.main.object(forInfoDictionaryKey: key) as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
  }

  private func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    switch call.method {
    case "start":
      start(args, result: result)
    case "setEnabled":
      #if canImport(TikTokBusinessSDK)
      let enabled = args["enabled"] as? Bool ?? false
      if TikTokBusiness.isInitialized() { TikTokBusiness.setTrackingEnabled(enabled) }
      #endif
      result(nil)
    case "track":
      #if canImport(TikTokBusinessSDK)
      if TikTokBusiness.isInitialized(), let name = args["event"] as? String, !name.isEmpty {
        let event = TikTokBaseEvent(eventName: name)
        for (key, value) in args["properties"] as? [String: Any] ?? [:] {
          if let v = value as? String { _ = event.addProperty(withKey: key, value: v) }
          else if let v = value as? NSNumber { _ = event.addProperty(withKey: key, value: v) }
          else if let v = value as? Bool { _ = event.addProperty(withKey: key, value: v) }
        }
        TikTokBusiness.trackTTEvent(event)
      }
      #endif
      result(nil)
    case "identify":
      #if canImport(TikTokBusinessSDK)
      if TikTokBusiness.isInitialized(), let id = args["externalId"] as? String, !id.isEmpty {
        TikTokBusiness.identify(withExternalID: id, externalUserName: nil, phoneNumber: nil, email: nil)
      }
      #endif
      result(nil)
    case "logout":
      #if canImport(TikTokBusinessSDK)
      if TikTokBusiness.isInitialized() { TikTokBusiness.logout() }
      #endif
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private func start(_ args: [String: Any], result: @escaping FlutterResult) {
    #if canImport(TikTokBusinessSDK)
    if TikTokBusiness.isInitialized() {
      TikTokBusiness.setTrackingEnabled(true)
      result(["started": true])
      return
    }
    let secret = Self.config("AnacanTikTokAppSecret")
    let appId = Self.config("AnacanTikTokAppId")
    let ttAppId = Self.config("AnacanTikTokTtAppId")
    guard !secret.isEmpty, !appId.isEmpty, !ttAppId.isEmpty else {
      result(["started": false, "reason": "not_configured"])
      return
    }
    if starting {
      result(["started": false, "reason": "starting"])
      return
    }
    starting = true
    guard let config = TikTokConfig(accessToken: secret, appId: appId, tiktokAppId: ttAppId) else {
      starting = false
      result(["started": false, "reason": "invalid_config"])
      return
    }
    let debug = args["debug"] as? Bool == true
    config.setLogLevel(debug ? TikTokLogLevelDebug : TikTokLogLevelSuppress)
    if debug { config.enableDebugMode() }
    // ATT is owned by the app (asked once, after consent). Without "authorized" the SDK reads no IDFA and
    // attribution falls back to SKAdNetwork; `tracking` is only passed for diagnostics.
    _ = args["tracking"]
    // A FlutterResult may be called once only (a second call raises in the engine): the SDK completion is answered
    // at most once, on the main thread.
    var replied = false
    DispatchQueue.main.async {
      TikTokBusiness.initializeSdk(config) { [weak self] success, error in
        DispatchQueue.main.async {
          self?.starting = false
          guard !replied else { return }
          replied = true
          if success { result(["started": true]) }
          else { result(["started": false, "reason": error?.localizedDescription ?? "init_failed"]) }
        }
      }
    }
    #else
    _ = args
    result(["started": false, "reason": "not_configured"])
    #endif
  }
}

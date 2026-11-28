import Flutter
import Foundation
#if canImport(FBSDKCoreKit)
import FBSDKCoreKit
#endif

/// Meta App Events (iOS), ported from the `capacitor-facebook-events` plugin the Capacitor app used on iOS
/// (FacebookEvents.swift): `logEvent` passes only string parameters (as that plugin did), `setAdvertiserTrackingEnabled`
/// sets `Settings.shared.isAdvertiserTrackingEnabled`. Without the Meta SDK in the build (FBSDKCoreKit not
/// importable) every call resolves silently, the "plugin not available" behaviour: nothing is sent.
///
/// Channel "anacan/fb_events": logEvent {event, params}, logPurchase {amount, currency, params},
/// setAdvertiserTrackingEnabled {enabled}, setConsent {enabled} (Android only: no-op here).
final class FbEventsChannel {
  static let channelName = "anacan/fb_events"

  private let channel: FlutterMethodChannel

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: FbEventsChannel.channelName, binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      FbEventsChannel.handle(call, result: result)
    }
  }

  private static func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    switch call.method {
    case "logEvent":
      guard let event = args["event"] as? String else {
        result(FlutterError(code: "INVALID", message: "Missing event argument", details: nil))
        return
      }
      #if canImport(FBSDKCoreKit)
      var parameters: [AppEvents.ParameterName: Any] = [:]
      for (key, value) in args["params"] as? [String: Any] ?? [:] {
        if let text = value as? String { parameters[AppEvents.ParameterName(key)] = text }
      }
      if parameters.isEmpty {
        AppEvents.shared.logEvent(AppEvents.Name(event))
      } else {
        AppEvents.shared.logEvent(AppEvents.Name(event), parameters: parameters)
      }
      #endif
      result(nil)
    case "logPurchase":
      // The iOS Capacitor plugin had no logPurchase; purchases arrive as `fb_mobile_purchase` through logEvent.
      result(nil)
    case "setAdvertiserTrackingEnabled":
      guard let enabled = args["enabled"] as? Bool else {
        result(FlutterError(code: "INVALID", message: "Missing enabled argument", details: nil))
        return
      }
      #if canImport(FBSDKCoreKit)
      Settings.shared.isAdvertiserTrackingEnabled = enabled
      #else
      _ = enabled
      #endif
      result(nil)
    case "setConsent":
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }
}

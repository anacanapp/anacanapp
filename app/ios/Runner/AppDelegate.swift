import AVFoundation
import Flutter
import UIKit
import UserNotifications
#if canImport(FBSDKCoreKit)
import FBSDKCoreKit
#endif

// Ported from the Capacitor app's AppDelegate.swift + MainViewController.swift (plugin registration). Firebase
// configure and APNs/FCM token forwarding belong to the Firebase plugins (their own registration); the notification
// center delegate is this FlutterAppDelegate; the Capacitor URL / user-activity proxies are app_links' job.
@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  /// Method-channel owners (ports of the Capacitor local plugins); kept alive with the engine.
  private var nativeChannels: [AnyObject] = []

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // White noise / lullabies: the playback category keeps audio playing with the silent switch on and on the lock
    // screen; mixWithOthers keeps the user's own music running for short sounds (Capacitor AppDelegate). An audio
    // plugin that configures its own session later overrides this.
    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
    } catch {
      NSLog("[AppDelegate] AVAudioSession category error: %@", error.localizedDescription)
    }
#if canImport(FBSDKCoreKit)
    // Meta SDK (FacebookAppID / FacebookClientToken from Info.plist). Unlike the Capacitor AppDelegate, auto-logging
    // and the advertiser id stay as Info.plist sets them and there is no unconditional activateApp: events are sent
    // only from Dart after attribution consent (services/analytics/facebook_events.dart).
    ApplicationDelegate.shared.application(application, didFinishLaunchingWithOptions: launchOptions)
#endif
    // Foreground presentation and taps for flutter_local_notifications / firebase_messaging (FlutterAppDelegate
    // forwards the UNUserNotificationCenterDelegate callbacks to the plugins).
    UNUserNotificationCenter.current().delegate = self
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    // Capacitor Preferences store (sessions, admission pin, migration export).
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "AnacanLegacyPreferences") {
      LegacyPreferencesChannel.register(messenger: registrar.messenger())
    }
    // Capacitor MainViewController.capacitorDidLoad(): LiveActivity, HealthCycle, HealthVitals, ScreenshotGuard,
    // AnacanWidgets (+ the FbEvents surface of capacitor-facebook-events).
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "AnacanNativeChannels") {
      let messenger = registrar.messenger()
      nativeChannels = [
        ScreenshotGuardChannel(messenger: messenger),
        LiveActivityChannel(messenger: messenger),
        HealthChannels(messenger: messenger),
        HomeWidgetsChannel(messenger: messenger),
        FbEventsChannel(messenger: messenger),
        // AdMob, TikTok events, Customer.io (SDK code guarded by canImport; inert until the SDKs are in the build).
        AnacanAdsChannel(messenger: messenger),
        TikTokEventsChannel(messenger: messenger),
        CustomerIoChannel(messenger: messenger),
        // Capacitor WKWebView localStorage fallback (users who skipped the 53.0 bridge export).
        LegacyWebStorageChannel(messenger: messenger),
      ]
    }
  }
}

/// Read/write access to the Capacitor Preferences store of the previous (Capacitor)
/// builds, so sessions, logout tombstones, adoption receipts and the admission pin
/// survive the Flutter update and a rollback finds them again.
///
/// Mirrors @capacitor/preferences 8.0.1 (ios/Sources/PreferencesPlugin/Preferences.swift):
/// UserDefaults.standard, keys prefixed "CapacitorStorage.", string values.
///
/// Channel "az.anacan/legacy_prefs": get {key} -> String?, set {key, value},
/// remove {key}, keys -> [String].
private final class LegacyPreferencesChannel {
  static let channelName = "az.anacan/legacy_prefs"
  static let prefix = "CapacitorStorage."

  static func register(messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: channelName, binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      handle(call, result: result)
    }
  }

  private static func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let defaults = UserDefaults.standard
    let arguments = call.arguments as? [String: Any]
    switch call.method {
    case "get":
      guard let key = arguments?["key"] as? String else {
        result(FlutterError(code: "INVALID", message: "key", details: nil))
        return
      }
      result(defaults.string(forKey: prefix + key))
    case "set":
      guard let key = arguments?["key"] as? String, let value = arguments?["value"] as? String else {
        result(FlutterError(code: "INVALID", message: "key/value", details: nil))
        return
      }
      defaults.set(value, forKey: prefix + key)
      result(nil)
    case "remove":
      guard let key = arguments?["key"] as? String else {
        result(FlutterError(code: "INVALID", message: "key", details: nil))
        return
      }
      defaults.removeObject(forKey: prefix + key)
      result(nil)
    case "keys":
      let keys = defaults.dictionaryRepresentation().keys
        .filter { $0.hasPrefix(prefix) }
        .map { String($0.dropFirst(prefix.count)) }
      result(Array(keys))
    default:
      result(FlutterMethodNotImplemented)
    }
  }
}

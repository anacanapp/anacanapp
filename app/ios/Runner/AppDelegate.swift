import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    // Capacitor Preferences store (sessions, admission pin, migration export).
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "AnacanLegacyPreferences") {
      LegacyPreferencesChannel.register(messenger: registrar.messenger())
    }
  }
}

/// Read/write access to the Capacitor Preferences store of the previous (Capacitor)
/// builds, so sessions, logout tombstones, adoption receipts and the admission pin
/// survive the Flutter update and a rollback finds them again.
///
/// Mirrors @capacitor/preferences 8.0.1 (ios/Sources/PreferencesPlugin/Preferences.swift):
/// UserDefaults.standard, keys prefixed "CapacitorStorage.", string values.
/// Kept in this file on purpose: no new files are added to the Xcode project.
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

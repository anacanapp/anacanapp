import CryptoKit
import Flutter
import Foundation
#if canImport(CioDataPipelines)
import CioDataPipelines
#endif

/// Customer.io Data In (EU), ported from packages/customerio-data-in (CustomerIoDataInPlugin.swift). The CDP write key
/// is read from the shipped Info.plist (AnacanCustomerIoCdpWriteKey / Enabled / Region / Environment from
/// $(ANACAN_CUSTOMERIO_*), written by app/tool/codemagic/apply_native_config.mjs), never from channel arguments; Dart
/// only names the region and environment it expects, and a mismatch rejects. Only the official Data Pipelines product
/// is used; nothing is initialized at registration. Without CioDataPipelines in the build `initialize` rejects like a
/// build without the plugin, so nothing is sent.
///
/// Channel "anacan/customerio": initialize {region, environment}, identify {userId, traits}, track {name, properties},
/// screen {title, properties}, reset.
final class CustomerIoChannel {
  static let channelName = "anacan/customerio"

  private static let lock = NSLock()
  private static var configuration: String?
  private static var identified = false

  private let channel: FlutterMethodChannel

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: CustomerIoChannel.channelName, binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      CustomerIoChannel.handle(call, result: result)
    }
  }

  private static func plist(_ key: String) -> String {
    (Bundle.main.object(forInfoDictionaryKey: key) as? String) ?? ""
  }

  private static func reject(_ code: String, _ result: FlutterResult) {
    result(FlutterError(code: code, message: nil, details: nil))
  }

  /// Flat string / number / boolean values only.
  private static func properties(_ value: Any?) -> [String: Any] {
    var out: [String: Any] = [:]
    for (key, item) in value as? [String: Any] ?? [:] where item is String || item is NSNumber {
      out[key] = item
    }
    return out
  }

  private static func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    #if canImport(CioDataPipelines)
    lock.lock()
    defer { lock.unlock() }
    switch call.method {
    case "initialize":
      let key = plist("AnacanCustomerIoCdpWriteKey")
      let environment = plist("AnacanCustomerIoEnvironment")
      guard plist("AnacanCustomerIoEnabled") == "true", args["region"] as? String == "EU",
            plist("AnacanCustomerIoRegion") == "EU", !environment.isEmpty,
            args["environment"] as? String == environment else {
        reject("CUSTOMERIO_INVALID_CONFIGURATION", result)
        return
      }
      guard !key.isEmpty, key.count <= 512, !key.contains(where: { $0.isWhitespace }),
            ["sandbox", "production"].contains(environment) else {
        reject("CUSTOMERIO_INITIALIZATION_FAILED", result)
        return
      }
      let fingerprint = SHA256.hash(data: Data("\(environment):\(key)".utf8)).map { String(format: "%02x", $0) }.joined()
      if let existing = configuration {
        if existing == fingerprint { result(nil) } else { reject("CUSTOMERIO_RESTART_REQUIRED", result) }
        return
      }
      let config = SDKConfigBuilder(cdpApiKey: key)
        .region(.EU)
        .logLevel(.none)
        .trackApplicationLifecycleEvents(false)
        .autoTrackDeviceAttributes(false)
      CustomerIO.initialize(withConfig: config.build())
      // A restored SDK identity must never outlive the app's authenticated owner.
      CustomerIO.shared.clearIdentify()
      configuration = fingerprint
      identified = false
      result(nil)
    case "identify":
      guard configuration != nil, let userId = args["userId"] as? String, !userId.isEmpty, userId.count <= 200 else {
        reject("CUSTOMERIO_IDENTITY_REQUIRED", result)
        return
      }
      CustomerIO.shared.identify(userId: userId, traits: properties(args["traits"]))
      identified = true
      result(nil)
    case "track":
      guard configuration != nil, identified, args["name"] as? String == "community_post_created" else {
        reject("CUSTOMERIO_EVENT_REJECTED", result)
        return
      }
      CustomerIO.shared.track(name: "community_post_created", properties: properties(args["properties"]))
      result(nil)
    case "screen":
      guard configuration != nil, identified, let title = args["title"] as? String,
            title.range(of: "^[A-Za-z][A-Za-z0-9 _-]{0,79}$", options: .regularExpression) != nil else {
        reject("CUSTOMERIO_SCREEN_REJECTED", result)
        return
      }
      CustomerIO.shared.screen(title: title, properties: properties(args["properties"]))
      result(nil)
    case "reset":
      if configuration != nil { CustomerIO.shared.clearIdentify() }
      identified = false
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
    #else
    _ = args
    switch call.method {
    case "initialize": reject("CUSTOMERIO_NATIVE_PLUGIN_REQUIRED", result)
    case "identify": reject("CUSTOMERIO_IDENTITY_REQUIRED", result)
    case "track": reject("CUSTOMERIO_EVENT_REJECTED", result)
    case "screen": reject("CUSTOMERIO_SCREEN_REJECTED", result)
    case "reset": result(nil)
    default: result(FlutterMethodNotImplemented)
    }
    #endif
  }
}

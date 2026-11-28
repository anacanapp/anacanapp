import ActivityKit
import Flutter
import Foundation

/// "LiveActivity" (iOS side), ported from the Capacitor app's LiveActivityPlugin.swift: feeding / sleep (and
/// contraction / kick) timers as a Lock Screen + Dynamic Island Live Activity. Several timers at once (by id).
///
/// The Live Activity UI and the "Dayandır" button live in the widget extension (AnacanTimerWidgetExt), which is not in
/// the Flutter project yet (docs/flutter/IOS_EXTENSIONS.md). Until it is, Info.plist has no `NSSupportsLiveActivities`
/// and `startActivity` fails, so Dart shows its ongoing local-notification fallback instead of an invisible
/// activity. Pending stops written by the extension's stop intent (iOS 17+) are read from the App Group
/// `group.com.atlasoon.anacan`, key `anacan-pending-timer-stops`, exactly as before.
///
/// Channel "anacan/live_timer": startActivity {id, type, label, startTime, feedType?, subLabel?, stopLabel?},
/// stopActivity {timerId?}, getPendingStops -> {stops}, clearPendingStops. (No live `timerStopped` event on iOS.)
final class LiveActivityChannel {
  static let channelName = "anacan/live_timer"
  static let appGroupId = "group.com.atlasoon.anacan"
  static let pendingKey = "anacan-pending-timer-stops"

  private let channel: FlutterMethodChannel

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: LiveActivityChannel.channelName, binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      LiveActivityChannel.handle(call, result: result)
    }
  }

  private static func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    let args = call.arguments as? [String: Any] ?? [:]
    switch call.method {
    case "startActivity": startActivity(args, result: result)
    case "stopActivity": stopActivity(args["timerId"] as? String, result: result)
    case "getPendingStops":
      let defaults = UserDefaults(suiteName: appGroupId)
      var stops: [[String: Any]] = []
      if let raw = defaults?.string(forKey: pendingKey),
         let data = raw.data(using: .utf8),
         let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
        stops = arr
      }
      result(["stops": stops])
    case "clearPendingStops":
      UserDefaults(suiteName: appGroupId)?.removeObject(forKey: pendingKey)
      result(nil)
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  private static func startActivity(_ args: [String: Any], result: @escaping FlutterResult) {
    // Without the widget extension nothing would render the activity: report it like Live Activities being off.
    guard Bundle.main.object(forInfoDictionaryKey: "NSSupportsLiveActivities") as? Bool == true else {
      result(FlutterError(code: "UNAVAILABLE", message: "Live Activities are not configured in this build", details: nil))
      return
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      result(FlutterError(code: "DISABLED", message: "Live Activities disabled by user", details: nil))
      return
    }
    guard let id = args["id"] as? String,
          let type = args["type"] as? String,
          let label = args["label"] as? String,
          let startTimeMs = (args["startTime"] as? NSNumber)?.doubleValue else {
      result(FlutterError(code: "INVALID", message: "Missing required parameters", details: nil))
      return
    }
    let attributes = AnacanTimerAttributes(
      id: id,
      timerType: type,
      label: label,
      feedType: args["feedType"] as? String,
      startTime: Date(timeIntervalSince1970: startTimeMs / 1000),
      subLabel: args["subLabel"] as? String,
      stopLabel: args["stopLabel"] as? String
    )
    let state = AnacanTimerAttributes.ContentState(elapsedSeconds: 0, isActive: true)
    do {
      _ = try Activity.request(attributes: attributes, content: .init(state: state, staleDate: nil), pushType: nil)
      result(nil)
    } catch {
      result(FlutterError(code: "START_FAILED", message: "Failed to start Live Activity: \(error.localizedDescription)", details: nil))
    }
  }

  private static func stopActivity(_ timerId: String?, result: @escaping FlutterResult) {
    Task {
      let finalState = AnacanTimerAttributes.ContentState(elapsedSeconds: 0, isActive: false)
      // Activities started in this session and those that survived an app restart.
      for activity in Activity<AnacanTimerAttributes>.activities where timerId == nil || activity.attributes.id == timerId {
        await activity.end(.init(state: finalState, staleDate: nil), dismissalPolicy: .immediate)
      }
      await MainActor.run { result(nil) }
    }
  }
}

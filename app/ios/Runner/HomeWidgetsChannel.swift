import Flutter
import Foundation
import WidgetKit

/// Home-screen widgets bridge (Runner side), ported from the Capacitor app's AnacanWidgetsPlugin.swift. Dart sends a
/// small localized JSON snapshot (same shape as src/lib/home-widgets.ts); it is stored in the shared App Group under
/// the same key the widget extension reads (AnacanHomeWidgets.swift `HWSnapshot.load()`), and the widgets reload.
/// The widget extension itself is added later (docs/flutter/IOS_EXTENSIONS.md); until then the snapshot is simply
/// kept, so widgets placed with the Capacitor build show fresh data as soon as the extension ships again.
///
/// Channel "anacan/widgets": update {snapshot} -> {ok: true}; errors snapshot_invalid / app_group_unavailable.
final class HomeWidgetsChannel {
  static let channelName = "anacan/widgets"
  static let appGroup = "group.com.atlasoon.anacan"
  static let snapshotKey = "anacan.widget.snapshot.v1"

  private let channel: FlutterMethodChannel

  init(messenger: FlutterBinaryMessenger) {
    channel = FlutterMethodChannel(name: HomeWidgetsChannel.channelName, binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      guard call.method == "update" else { result(FlutterMethodNotImplemented); return }
      let args = call.arguments as? [String: Any]
      guard let snapshot = args?["snapshot"] as? String, snapshot.count <= 32_000 else {
        result(FlutterError(code: "snapshot_invalid", message: nil, details: nil))
        return
      }
      guard let defaults = UserDefaults(suiteName: HomeWidgetsChannel.appGroup) else {
        result(FlutterError(code: "app_group_unavailable", message: nil, details: nil))
        return
      }
      defaults.set(snapshot, forKey: HomeWidgetsChannel.snapshotKey)
      WidgetCenter.shared.reloadTimelines(ofKind: "AnacanJourneyWidget")
      WidgetCenter.shared.reloadTimelines(ofKind: "AnacanCareWidget")
      // Capacitor reloaded only the two above; the word-of-the-day widget reads the same snapshot (Android refreshes all three).
      WidgetCenter.shared.reloadTimelines(ofKind: "AnacanWordWidget")
      result(["ok": true])
    }
  }
}

import Foundation
import Capacitor
import WidgetKit

/**
 * Home-screen widgets bridge (App target only — excluded from the widget extension).
 * The web app sends a small localized JSON snapshot (src/lib/home-widgets.ts); it is stored in the
 * shared App Group and both widgets reload. Registered in MainViewController.
 */
@objc(AnacanWidgetsPlugin)
public class AnacanWidgetsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AnacanWidgetsPlugin"
    public let jsName = "AnacanWidgets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)
    ]

    static let appGroup = "group.com.atlasoon.anacan"
    static let snapshotKey = "anacan.widget.snapshot.v1"

    @objc func update(_ call: CAPPluginCall) {
        guard let snapshot = call.getString("snapshot"), snapshot.count <= 32_000 else {
            call.reject("snapshot_invalid")
            return
        }
        guard let defaults = UserDefaults(suiteName: AnacanWidgetsPlugin.appGroup) else {
            call.reject("app_group_unavailable")
            return
        }
        defaults.set(snapshot, forKey: AnacanWidgetsPlugin.snapshotKey)
        WidgetCenter.shared.reloadTimelines(ofKind: "AnacanJourneyWidget")
        WidgetCenter.shared.reloadTimelines(ofKind: "AnacanCareWidget")
        call.resolve(["ok": true])
    }
}

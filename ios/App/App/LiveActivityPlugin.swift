import Capacitor
import ActivityKit
import Foundation

/**
 * "LiveActivity" plugin (iOS tərəfi) — süd vermə / yuxu taymerlərini
 * Lock Screen + Dynamic Island-da Live Activity kimi göstərir.
 *
 * Qeydlər:
 *  - Eyni anda bir neçə taymer dəstəklənir (id ilə).
 *  - Widget-dəki "Dayandır" düyməsi (iOS 17+) App Group-a "pending stop" yazır;
 *    JS tərəf resume-da getPendingStops() ilə oxuyub baby_logs-a qeyd edir.
 *  - App Group: group.com.atlasoon.anacan (Xcode-da hər iki target-ə əlavə olunmalıdır).
 */
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPendingStops", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingStops", returnType: CAPPluginReturnPromise)
    ]

    static let appGroupId = "group.com.atlasoon.anacan"
    static let pendingKey = "anacan-pending-timer-stops"

    /// id -> Activity (tip silinmiş saxlanılır ki, köhnə iOS-larda class yüklənə bilsin)
    private var activities: [String: Any] = [:]

    @objc func startActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.reject("Live Activities requires iOS 16.1+")
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.reject("Live Activities disabled by user")
            return
        }
        guard let id = call.getString("id"),
              let type = call.getString("type"),
              let label = call.getString("label"),
              let startTimeMs = call.getDouble("startTime") else {
            call.reject("Missing required parameters")
            return
        }

        let attributes = AnacanTimerAttributes(
            id: id,
            timerType: type,
            label: label,
            feedType: call.getString("feedType"),
            startTime: Date(timeIntervalSince1970: startTimeMs / 1000),
            subLabel: call.getString("subLabel")
        )
        let contentState = AnacanTimerAttributes.ContentState(elapsedSeconds: 0, isActive: true)

        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: .init(state: contentState, staleDate: nil),
                pushType: nil
            )
            activities[id] = activity
            call.resolve()
        } catch {
            call.reject("Failed to start Live Activity: \(error.localizedDescription)")
        }
    }

    @objc func stopActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve()
            return
        }
        let timerId = call.getString("timerId")
        Task {
            let finalState = AnacanTimerAttributes.ContentState(elapsedSeconds: 0, isActive: false)
            // Həm bu sessiyada yaradılanlar, həm də app restartından sağ qalan aktivliklər
            for activity in Activity<AnacanTimerAttributes>.activities {
                if timerId == nil || activity.attributes.id == timerId {
                    await activity.end(.init(state: finalState, staleDate: nil), dismissalPolicy: .immediate)
                }
            }
            if let tid = timerId { self.activities.removeValue(forKey: tid) }
            else { self.activities.removeAll() }
            call.resolve()
        }
    }

    /// Widget-dən dayandırılmış, JS tərəfindən hələ emal olunmamış taymerlər
    @objc func getPendingStops(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: LiveActivityPlugin.appGroupId)
        var stops: [[String: Any]] = []
        if let raw = defaults?.string(forKey: LiveActivityPlugin.pendingKey),
           let data = raw.data(using: .utf8),
           let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            stops = arr
        }
        call.resolve(["stops": stops])
    }

    @objc func clearPendingStops(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: LiveActivityPlugin.appGroupId)
        defaults?.removeObject(forKey: LiveActivityPlugin.pendingKey)
        call.resolve()
    }
}

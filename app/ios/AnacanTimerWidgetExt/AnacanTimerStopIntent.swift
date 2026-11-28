import AppIntents
import ActivityKit
import Foundation

/// Widget-dəki "Dayandır" düyməsi (iOS 17+).
/// HƏM app target-ə, HƏM DƏ widget target-ə üzv edilməlidir —
/// beləliklə tətbiq açıq olanda intent app prosesində işləyir.
///
/// Nə edir:
///  1) Dayandırılan taymeri App Group-dakı "pending stops" siyahısına yazır
///     (JS tərəf resume-da oxuyub sessiyanı baby_logs-a qeyd edir),
///  2) Live Activity-ni bitirir.
@available(iOS 17.0, *)
struct AnacanTimerStopIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Taymeri dayandır"
    static var isDiscoverable: Bool = false

    @Parameter(title: "Timer ID")
    var timerId: String

    init() {}
    init(timerId: String) {
        self.timerId = timerId
    }

    func perform() async throws -> some IntentResult {
        for activity in Activity<AnacanTimerAttributes>.activities where activity.attributes.id == timerId {
            // 1) Pending stop yaz
            let payload: [String: Any] = [
                "id": activity.attributes.id,
                "type": activity.attributes.timerType,
                "feedType": activity.attributes.feedType as Any,
                "startTime": activity.attributes.startTime.timeIntervalSince1970 * 1000,
                "stoppedAt": Date().timeIntervalSince1970 * 1000
            ]
            appendPendingStop(payload)

            // 2) Aktivliyi bitir
            let finalState = AnacanTimerAttributes.ContentState(elapsedSeconds: 0, isActive: false)
            await activity.end(.init(state: finalState, staleDate: nil), dismissalPolicy: .immediate)
        }
        return .result()
    }

    private func appendPendingStop(_ payload: [String: Any]) {
        let defaults = UserDefaults(suiteName: "group.com.atlasoon.anacan")
        var arr: [[String: Any]] = []
        if let raw = defaults?.string(forKey: "anacan-pending-timer-stops"),
           let data = raw.data(using: .utf8),
           let existing = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            arr = existing
        }
        arr.append(payload)
        if let data = try? JSONSerialization.data(withJSONObject: arr),
           let str = String(data: data, encoding: .utf8) {
            defaults?.set(str, forKey: "anacan-pending-timer-stops")
        }
    }
}

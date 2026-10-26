import ActivityKit
import Foundation

/// Live Activity atributları — HƏM əsas "App" target-ə, HƏM DƏ widget
/// extension target-ə ("AnacanTimerWidgetExt") üzv edilməlidir.
struct AnacanTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var elapsedSeconds: Int
        var isActive: Bool
    }

    var id: String           // timerStore id-si (məs. "feeding-left-1723...")
    var timerType: String    // "sleep" | "feeding" | "diaper" | "white-noise"
    var label: String        // lokallaşdırılmış başlıq (JS-dən gəlir)
    var feedType: String?    // "left" | "right"
    var startTime: Date
    var subLabel: String?    // lokallaşdırılmış alt-mətn (JS-dən gəlir, məs. "Davam edir...")

    var timerEmoji: String {
        switch timerType {
        case "sleep": return "😴"
        case "feeding": return "🍼"
        case "diaper": return "🧷"
        case "white-noise": return "🔊"
        default: return "⏱"
        }
    }
}

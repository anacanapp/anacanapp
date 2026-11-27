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
    var timerType: String    // "sleep" | "feeding" | "diaper" | "white-noise" | "contraction" | "kick"
    var label: String        // lokallaşdırılmış başlıq (JS-dən gəlir)
    var feedType: String?    // "left" | "right"
    var startTime: Date
    var subLabel: String?    // lokallaşdırılmış alt-mətn (JS-dən gəlir, məs. "Davam edir...")
    var stopLabel: String? = nil  // lokallaşdırılmış düymə mətni (JS-dən, məs. "Gizlət"); köhnə payload-larda yoxdur

    var timerEmoji: String {
        switch timerType {
        case "sleep": return "😴"
        case "feeding": return "🍼"
        case "diaper": return "🧷"
        case "white-noise": return "🔊"
        case "contraction": return "🌊"
        case "kick": return "👣"
        default: return "⏱"
        }
    }

    /// Hamiləlik alətləri (tool-live-timer.ts): düymə sessiyanı dayandırmır, yalnız
    /// kilid ekranı taymerini gizlədir (sessiya tətbiqdə davam edir).
    var buttonOnlyHides: Bool {
        timerType == "contraction" || timerType == "kick"
    }

    /// Düymə mətni: süd vermə/yuxu üçün əvvəlki kimi sabit "Dayandır";
    /// gizlətmə növlərində JS-dən gələn lokallaşdırılmış mətn (yoxdursa "Gizlət").
    var stopButtonTitle: String {
        guard buttonOnlyHides else { return "Dayandır" }
        if let text = stopLabel, !text.isEmpty { return text }
        return "Gizlət"
    }

    var stopButtonSymbol: String {
        buttonOnlyHides ? "eye.slash.fill" : "stop.fill"
    }
}

import ActivityKit
import Foundation

/// Live Activity atributları — HƏM "Runner" target-ə, HƏM DƏ widget extension target-ə
/// ("AnacanTimerWidgetExtExtension", docs/flutter/IOS_EXTENSIONS.md) üzv edilməlidir.
/// Copied unchanged from the Capacitor app (ios/App/AnacanTimerWidgetExt/AnacanTimerAttributes.swift): the type name
/// and fields must stay identical in both targets, or the extension cannot decode activities the app started.
struct AnacanTimerAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var elapsedSeconds: Int
        var isActive: Bool
    }

    var id: String           // timerStore id-si (məs. "feeding-left-1723...")
    var timerType: String    // "sleep" | "feeding" | "diaper" | "white-noise" | "contraction" | "kick"
    var label: String        // lokallaşdırılmış başlıq (Dart-dan gəlir)
    var feedType: String?    // "left" | "right"
    var startTime: Date
    var subLabel: String?    // lokallaşdırılmış alt-mətn (Dart-dan gəlir, məs. "Davam edir...")
    var stopLabel: String? = nil  // lokallaşdırılmış düymə mətni (Dart-dan, məs. "Gizlət"); köhnə payload-larda yoxdur

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

    /// Hamiləlik alətləri (tool-live-timer): düymə sessiyanı dayandırmır, yalnız
    /// kilid ekranı taymerini gizlədir (sessiya tətbiqdə davam edir).
    var buttonOnlyHides: Bool {
        timerType == "contraction" || timerType == "kick"
    }

    /// Düymə mətni: süd vermə/yuxu üçün əvvəlki kimi sabit "Dayandır";
    /// gizlətmə növlərində Dart-dan gələn lokallaşdırılmış mətn (yoxdursa "Gizlət").
    var stopButtonTitle: String {
        guard buttonOnlyHides else { return "Dayandır" }
        if let text = stopLabel, !text.isEmpty { return text }
        return "Gizlət"
    }

    var stopButtonSymbol: String {
        buttonOnlyHides ? "eye.slash.fill" : "stop.fill"
    }
}

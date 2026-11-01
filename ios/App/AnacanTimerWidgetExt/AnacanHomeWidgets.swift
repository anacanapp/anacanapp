import WidgetKit
import SwiftUI

// Home-screen and Lock Screen widgets. Data comes only from the snapshot the app writes to the App
// Group (AnacanWidgetsPlugin); widgets never touch the network. Feeding/sleep needs Premium — without
// it the care widget shows "Get Anacan Premium" and opens the paywall.

// MARK: - Snapshot

struct HWJourney: Codable {
    let eyebrow: String
    let title: String
    let subtitle: String
    let badge: String
    let progress: Double
    let emoji: String
}

struct HWCare: Codable {
    let name: String
    let age: String
    let emoji: String
    let lastFeedAt: Double?
    let lastFeedText: String
    let nextNapStart: Double?
    let nextNapEnd: Double?
    let nextNapIsBedtime: Bool
    let sleepingSince: Double?
    let todayFeeds: Int
    let todaySleep: String
    let todayDiapers: Int
}

struct HWWord: Codable {
    let eyebrow: String
    let text: String
}

struct HWSnapshot: Codable {
    let v: Int
    let updatedAt: Double
    let premium: Bool
    let privacy: Bool
    let showActions: Bool
    let journey: HWJourney?
    let care: HWCare?
    let careLocked: Bool?
    let word: HWWord?
    let labels: [String: String]
    let links: [String: String]

    func label(_ key: String, _ fallback: String) -> String {
        if let v = labels[key], !v.isEmpty { return v }
        return fallback
    }

    func url(_ key: String, _ fallback: String) -> URL {
        URL(string: links[key] ?? fallback) ?? URL(string: fallback)!
    }

    static func load() -> HWSnapshot? {
        guard let raw = UserDefaults(suiteName: "group.com.atlasoon.anacan")?.string(forKey: "anacan.widget.snapshot.v1"),
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(HWSnapshot.self, from: data)
    }
}

private func hwDate(_ ms: Double?) -> Date? {
    guard let ms = ms, ms > 0 else { return nil }
    return Date(timeIntervalSince1970: ms / 1000)
}

// MARK: - Colors (src/styles/anacan-design.css)

private extension Color {
    static let hwInk = Color(red: 0x33 / 255, green: 0x33 / 255, blue: 0x33 / 255)
    static let hwInkSoft = Color(red: 0x8C / 255, green: 0x81 / 255, blue: 0x77 / 255)
    static let hwCoral = Color(red: 0xFF / 255, green: 0x5A / 255, blue: 0x5F / 255)
    static let hwPeach = Color(red: 0xFF / 255, green: 0xDC / 255, blue: 0xDD / 255)
    static let hwBerry = Color(red: 0xB2 / 255, green: 0x22 / 255, blue: 0x55 / 255)
    static let hwGreen1 = Color(red: 0xDD / 255, green: 0xF3 / 255, blue: 0xE3 / 255)
    static let hwGreenInk = Color(red: 0x1C / 255, green: 0x7A / 255, blue: 0x4D / 255)
    static let hwLav1 = Color(red: 0xE9 / 255, green: 0xDD / 255, blue: 0xFC / 255)
    static let hwLav = Color(red: 0x7C / 255, green: 0x5C / 255, blue: 0xD6 / 255)
    static let hwLavInk = Color(red: 0x5B / 255, green: 0x3A / 255, blue: 0xA5 / 255)
    static let hwSoft = Color(red: 0xFF / 255, green: 0xE7 / 255, blue: 0xE1 / 255)
    static let hwWarm = Color(red: 0xFF / 255, green: 0xF4 / 255, blue: 0xF1 / 255)
}

private extension View {
    /// iOS 17 requires containerBackground for widgets; older versions use a plain background.
    @ViewBuilder func hwBackground<B: View>(_ background: B) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            self.containerBackground(for: .widget) { background }
        } else {
            self.padding(8).background(background)
        }
    }
}

// MARK: - Timeline

struct HWEntry: TimelineEntry {
    let date: Date
    let snapshot: HWSnapshot?
}

struct HWProvider: TimelineProvider {
    func placeholder(in context: Context) -> HWEntry { HWEntry(date: Date(), snapshot: nil) }

    func getSnapshot(in context: Context, completion: @escaping (HWEntry) -> Void) {
        completion(HWEntry(date: Date(), snapshot: HWSnapshot.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HWEntry>) -> Void) {
        let snap = HWSnapshot.load()
        let now = Date()
        var dates: [Date] = [now]
        // Redraw when the nap window opens / closes so the label and colors stay right.
        if let start = hwDate(snap?.care?.nextNapStart), start > now { dates.append(start) }
        if let end = hwDate(snap?.care?.nextNapEnd), end > now { dates.append(end) }
        let entries = dates.sorted().map { HWEntry(date: $0, snapshot: snap) }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(30 * 60))))
    }
}

// MARK: - Journey widget (free): pregnancy week or baby age

struct HWJourneyView: View {
    @Environment(\.widgetFamily) var family
    let entry: HWEntry

    var body: some View {
        let snap = entry.snapshot
        let j = (snap?.privacy ?? false) ? nil : snap?.journey
        Group {
            switch family {
            case .accessoryCircular:
                ZStack {
                    if let j = j, j.progress > 0 {
                        Gauge(value: j.progress) { Text("") } currentValueLabel: { Text(j.emoji) }
                            .gaugeStyle(.accessoryCircularCapacity)
                    } else {
                        Text(j?.emoji ?? "🌸").font(.title2)
                    }
                }
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text(j?.title ?? snap?.label("openApp", "Anacan") ?? "Anacan").font(.headline).lineLimit(1)
                    if let j = j, !j.subtitle.isEmpty { Text(j.subtitle).font(.caption).lineLimit(2) }
                    else if let j = j, !j.eyebrow.isEmpty { Text(j.eyebrow).font(.caption).lineLimit(1) }
                }
            case .systemSmall:
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(j?.emoji ?? "🌸").font(.system(size: 34))
                        Spacer()
                        if let j = j, j.progress > 0 { HWRing(progress: j.progress).frame(width: 34, height: 34) }
                    }
                    Spacer(minLength: 0)
                    Text((j?.eyebrow ?? "Anacan").uppercased()).font(.system(size: 10, weight: .heavy)).foregroundColor(.hwBerry).lineLimit(1)
                    Text(j?.title ?? snap?.label("openApp", "Anacan") ?? "Anacan").font(.system(size: 19, weight: .heavy)).foregroundColor(.hwInk).lineLimit(2).minimumScaleFactor(0.7)
                    if let j = j, !j.badge.isEmpty { Text(j.badge).font(.system(size: 11, weight: .bold)).foregroundColor(.hwCoral).lineLimit(1) }
                }
            default:
                HStack(spacing: 14) {
                    ZStack {
                        HWRing(progress: j?.progress ?? 0).frame(width: 104, height: 104)
                        Text(j?.emoji ?? "🌸").font(.system(size: 46))
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text((j?.eyebrow ?? "Anacan").uppercased()).font(.system(size: 11, weight: .heavy)).foregroundColor(.hwBerry).lineLimit(1)
                        Text(j?.title ?? snap?.label("openApp", "Anacan") ?? "Anacan").font(.system(size: 24, weight: .heavy)).foregroundColor(.hwInk).lineLimit(2).minimumScaleFactor(0.7)
                        if let j = j, !j.subtitle.isEmpty { Text(j.subtitle).font(.system(size: 13)).foregroundColor(.hwInkSoft).lineLimit(2) }
                        if let j = j, !j.badge.isEmpty {
                            Text(j.badge).font(.system(size: 12, weight: .bold)).foregroundColor(Color(red: 0x9E / 255, green: 0x2B / 255, blue: 0x2E / 255))
                                .padding(.horizontal, 10).padding(.vertical, 4).background(Capsule().fill(Color.hwPeach))
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .widgetURL(snap?.url("home", "anacan:///") ?? URL(string: "anacan:///")!)
        .hwBackground(LinearGradient(colors: [.white, .hwWarm], startPoint: .topLeading, endPoint: .bottomTrailing))
    }
}

struct HWRing: View {
    let progress: Double
    var body: some View {
        ZStack {
            Circle().stroke(Color.hwPeach, lineWidth: 9)
            Circle().trim(from: 0, to: CGFloat(max(0, min(1, progress))))
                .stroke(Color.hwCoral, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

struct AnacanJourneyWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AnacanJourneyWidget", provider: HWProvider()) { entry in
            HWJourneyView(entry: entry)
        }
        .configurationDisplayName("Anacan")
        .description("Pregnancy week · baby's age")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
    }
}

// MARK: - Care widget (Premium): last feed, next nap, today, quick buttons

struct HWLockedView: View {
    let snap: HWSnapshot?
    var body: some View {
        VStack(spacing: 6) {
            Text("👑").font(.system(size: 30))
            Text(snap?.label("premiumTitle", "Anacan Premium") ?? "Anacan").font(.system(size: 16, weight: .heavy)).foregroundColor(.white).multilineTextAlignment(.center)
            if let body = snap?.label("premiumBody", ""), !body.isEmpty {
                Text(body).font(.system(size: 12)).foregroundColor(.white.opacity(0.9)).multilineTextAlignment(.center).lineLimit(3)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .widgetURL(snap == nil ? URL(string: "anacan:///")! : snap!.url("premium", "anacan://premium"))
        .hwBackground(LinearGradient(colors: [Color(red: 1, green: 0x8A / 255, blue: 0x8E / 255), .hwCoral], startPoint: .topLeading, endPoint: .bottomTrailing))
    }
}

struct HWTile: View {
    let label: String
    let value: AnyView
    let sub: String
    let bg: Color
    let ink: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label.uppercased()).font(.system(size: 9.5, weight: .heavy)).foregroundColor(ink).lineLimit(1)
            value
            Text(sub).font(.system(size: 11)).foregroundColor(.hwInkSoft).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 16).fill(bg))
    }
}

struct HWCareView: View {
    @Environment(\.widgetFamily) var family
    let entry: HWEntry

    var body: some View {
        // Non-Premium users see the FULL care widget as a sample preview (locked); real data with Premium.
        if let snap = entry.snapshot, let care = snap.care {
            let locked = !snap.premium || (snap.careLocked ?? false)
            if locked && (family == .accessoryRectangular || family == .accessoryCircular) {
                Text("🔒 \(snap.label("premiumTitle", "Anacan Premium"))").font(.caption).lineLimit(2)
                    .widgetURL(snap.url("premium", "anacan://premium"))
                    .hwBackground(Color.clear)
            } else {
                content(snap, care, locked: locked)
            }
        } else if family == .accessoryRectangular || family == .accessoryCircular {
            Text("🔒 \(entry.snapshot?.label("premiumTitle", "Anacan Premium") ?? "Anacan")").font(.caption).lineLimit(2)
                .widgetURL(entry.snapshot?.url("premium", "anacan://premium") ?? URL(string: "anacan:///")!)
                .hwBackground(Color.clear)
        } else {
            HWLockedView(snap: entry.snapshot)
        }
    }

    private func feedTile(_ snap: HWSnapshot, _ care: HWCare) -> HWTile {
        if let at = hwDate(care.lastFeedAt) {
            return HWTile(label: "🍼 " + snap.label("lastFeed", "Last feed"),
                          value: AnyView(Text(at, style: .relative).font(.system(size: 17, weight: .heavy)).foregroundColor(.hwInk).lineLimit(1).minimumScaleFactor(0.6)),
                          sub: care.lastFeedText, bg: .hwGreen1, ink: .hwGreenInk)
        }
        return HWTile(label: "🍼 " + snap.label("lastFeed", "Last feed"), value: AnyView(Text("—").font(.system(size: 17, weight: .heavy))),
                      sub: snap.label("noData", ""), bg: .hwGreen1, ink: .hwGreenInk)
    }

    private func napTile(_ snap: HWSnapshot, _ care: HWCare) -> HWTile {
        if let since = hwDate(care.sleepingSince) {
            return HWTile(label: "😴 " + snap.label("sleeping", "Sleeping"),
                          value: AnyView(Text(since, style: .timer).font(.system(size: 17, weight: .heavy)).foregroundColor(.hwInk).monospacedDigit()),
                          sub: since.formatted(date: .omitted, time: .shortened), bg: .hwLav1, ink: .hwLavInk)
        }
        let label = "🌙 " + snap.label(care.nextNapIsBedtime ? "bedtime" : "nextNap", "Next nap")
        if let start = hwDate(care.nextNapStart) {
            let end = hwDate(care.nextNapEnd) ?? start
            let range = "\(start.formatted(date: .omitted, time: .shortened))–\(end.formatted(date: .omitted, time: .shortened))"
            let value: AnyView = start > entry.date
                ? AnyView(Text(start, style: .relative).font(.system(size: 17, weight: .heavy)).foregroundColor(.hwInk).lineLimit(1).minimumScaleFactor(0.6))
                : AnyView(Text(range).font(.system(size: 15, weight: .heavy)).foregroundColor(.hwLavInk).lineLimit(1).minimumScaleFactor(0.6))
            return HWTile(label: label, value: value, sub: range, bg: .hwLav1, ink: .hwLavInk)
        }
        return HWTile(label: label, value: AnyView(Text("—").font(.system(size: 17, weight: .heavy))), sub: "", bg: .hwLav1, ink: .hwLavInk)
    }

    private func button(_ title: String, _ url: URL, bg: Color, fg: Color) -> some View {
        Link(destination: url) {
            Text(title).font(.system(size: 12.5, weight: .heavy)).foregroundColor(fg).lineLimit(1).minimumScaleFactor(0.7)
                .frame(maxWidth: .infinity, minHeight: 36)
                .background(RoundedRectangle(cornerRadius: 14).fill(bg))
        }
    }

    @ViewBuilder private func content(_ snap: HWSnapshot, _ care: HWCare, locked: Bool = false) -> some View {
        let sleeping = hwDate(care.sleepingSince) != nil
        switch family {
        case .accessoryCircular:
            Group {
            if let start = hwDate(care.nextNapStart), !sleeping {
                VStack(spacing: 0) { Text("🌙").font(.caption); Text(start, style: .time).font(.system(size: 11, weight: .bold)).minimumScaleFactor(0.6) }
            } else if let since = hwDate(care.sleepingSince) {
                VStack(spacing: 0) { Text("😴").font(.caption); Text(since, style: .timer).font(.system(size: 10, weight: .bold)).monospacedDigit().minimumScaleFactor(0.5) }
            } else {
                Text("🍼").font(.title3)
            }
            }
            .widgetURL(snap.url("tracker", "anacan://tool/baby-tracker"))
            .hwBackground(Color.clear)
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                if let at = hwDate(care.lastFeedAt) {
                    HStack(spacing: 4) { Text("🍼"); Text(at, style: .relative).bold() }.font(.caption).lineLimit(1)
                    if !snap.privacy { Text(care.lastFeedText).font(.caption2).lineLimit(1) }
                }
                if let since = hwDate(care.sleepingSince) {
                    HStack(spacing: 4) { Text("😴"); Text(since, style: .timer).monospacedDigit() }.font(.caption).lineLimit(1)
                } else if let start = hwDate(care.nextNapStart) {
                    HStack(spacing: 4) { Text("🌙 " + snap.label("nextNap", "Next nap")); Text(start, style: .time).bold() }.font(.caption2).lineLimit(1)
                }
            }
            .widgetURL(snap.url("tracker", "anacan://tool/baby-tracker"))
            .hwBackground(Color.clear)
        default:
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 10) {
                    Text(care.emoji).font(.system(size: 22)).frame(width: 38, height: 38).background(RoundedRectangle(cornerRadius: 12).fill(Color.hwPeach))
                    VStack(alignment: .leading, spacing: 0) {
                        Text(snap.privacy ? "ANACAN" : care.name.uppercased()).font(.system(size: 10, weight: .heavy)).foregroundColor(.hwBerry).lineLimit(1)
                        Text(snap.privacy ? "" : care.age).font(.system(size: 17, weight: .heavy)).foregroundColor(.hwInk).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                    if locked {
                        Text("🔒 " + snap.label("premiumBadge", "Premium").uppercased())
                            .font(.system(size: 9, weight: .heavy)).foregroundColor(.white)
                            .padding(.horizontal, 8).padding(.vertical, 3).background(Capsule().fill(Color.hwCoral))
                    }
                }
                HStack(spacing: 8) { feedTile(snap, care); napTile(snap, care) }
                if family == .systemLarge {
                    HStack {
                        Text(snap.label("today", "Today").uppercased()).font(.system(size: 10, weight: .heavy)).foregroundColor(.hwInkSoft)
                        Spacer()
                        Text("🍼 \(care.todayFeeds)  ·  😴 \(care.todaySleep)  ·  🧷 \(care.todayDiapers)").font(.system(size: 12, weight: .bold)).foregroundColor(.hwInk)
                    }
                    .padding(10).background(RoundedRectangle(cornerRadius: 14).fill(Color.white))
                    Spacer(minLength: 0)
                }
                if locked {
                    Link(destination: snap.url("premium", "anacan://premium")) {
                        Text("🔒 " + snap.label("premiumLocked", "Anacan Premium"))
                            .font(.system(size: 13, weight: .heavy)).foregroundColor(.white).lineLimit(1).minimumScaleFactor(0.7)
                            .frame(maxWidth: .infinity, minHeight: 38)
                            .background(RoundedRectangle(cornerRadius: 14).fill(Color.hwCoral))
                    }
                } else if snap.showActions {
                    HStack(spacing: 6) {
                        button("🍼 " + snap.label("btnFeed", "Feed"), snap.url("feed", "anacan://tool/baby-tracker"), bg: .hwCoral, fg: .white)
                        button(sleeping ? "☀️ " + snap.label("btnWoke", "Woke") : "😴 " + snap.label("btnSleep", "Sleep"),
                               snap.url(sleeping ? "sleepTool" : "sleep", "anacan://tool/sleep-training"), bg: .hwLav, fg: .white)
                        button("🧷 " + snap.label("btnDiaper", "Diaper"), snap.url("diaper", "anacan://tool/baby-tracker"), bg: .hwSoft,
                               fg: Color(red: 0x7C / 255, green: 0x27 / 255, blue: 0x26 / 255))
                    }
                }
            }
            .widgetURL(locked ? snap.url("premium", "anacan://premium") : snap.url("tracker", "anacan://tool/baby-tracker"))
            .hwBackground(LinearGradient(colors: [.white, .hwWarm], startPoint: .topLeading, endPoint: .bottomTrailing))
        }
    }
}

struct AnacanCareWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AnacanCareWidget", provider: HWProvider()) { entry in
            HWCareView(entry: entry)
        }
        .configurationDisplayName("Anacan · Premium")
        .description("Last feed · next nap · quick buttons")
        .supportedFamilies([.systemMedium, .systemLarge, .accessoryRectangular, .accessoryCircular])
    }
}

// MARK: - Word of the day widget (free)

struct HWWordView: View {
    @Environment(\.widgetFamily) var family
    let entry: HWEntry

    var body: some View {
        let snap = entry.snapshot
        let word = snap?.word
        let eyebrow = word?.eyebrow ?? snap?.label("wordEyebrow", "Word of the day") ?? "Anacan"
        let text = word?.text ?? snap?.label("openApp", "Anacan") ?? "Anacan"
        Group {
            switch family {
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text(eyebrow.uppercased()).font(.caption2).lineLimit(1)
                    Text(text).font(.caption).lineLimit(3)
                }
            case .accessoryCircular:
                Text("🌸").font(.title2)
            default:
                VStack(alignment: .leading, spacing: 8) {
                    Text(eyebrow.uppercased()).font(.system(size: 10, weight: .heavy)).foregroundColor(.hwCoral).lineLimit(1)
                    Text(text).font(.system(size: family == .systemSmall ? 13 : 15, weight: .semibold)).foregroundColor(.hwInk)
                        .lineLimit(family == .systemSmall ? 5 : 4).minimumScaleFactor(0.8)
                    Spacer(minLength: 0)
                    Text("🌸").font(.system(size: 18))
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .widgetURL(snap?.url("home", "anacan:///") ?? URL(string: "anacan:///")!)
        .hwBackground(LinearGradient(colors: [.hwWarm, .hwPeach], startPoint: .topLeading, endPoint: .bottomTrailing))
    }
}

struct AnacanWordWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "AnacanWordWidget", provider: HWProvider()) { entry in
            HWWordView(entry: entry)
        }
        .configurationDisplayName("Anacan · Word of the day")
        .description("A gentle daily affirmation")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular])
    }
}

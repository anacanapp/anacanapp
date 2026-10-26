import ActivityKit
import AppIntents
import WidgetKit
import SwiftUI

/// Anacan brend rəngləri — src/styles/anacan-design.css-dəki (light mode)
/// dəyərlərlə BİRƏBİR eynidir ki, widget veb/tətbiq dizaynı ilə tam uyğun görünsün.
private extension Color {
    /// --a-surface (ağ background)
    static let anacanSurface = Color(red: 1, green: 1, blue: 1)
    /// --a-peach-1 (yumşaq açıq şəftəli — emoji nişanının fonu)
    static let anacanPeach1 = Color(red: 0xFF / 255, green: 0xDC / 255, blue: 0xDD / 255)
    /// --a-peach-2 (əsas aksent — Anacan-ın imza rəngi)
    static let anacanPeach2 = Color(red: 0xFF / 255, green: 0x5A / 255, blue: 0x5F / 255)
    /// --a-accent-ink (şəftəli fon üzərində mətn/ikon rəngi)
    static let anacanAccentInk = Color(red: 0x9E / 255, green: 0x2B / 255, blue: 0x2E / 255)
    /// --a-ink (əsas mətn)
    static let anacanInk = Color(red: 0x33 / 255, green: 0x33 / 255, blue: 0x33 / 255)
    /// --a-ink-soft (ikinci dərəcəli mətn)
    static let anacanInkSoft = Color(red: 0x8C / 255, green: 0x81 / 255, blue: 0x77 / 255)
}

@available(iOS 16.1, *)
struct AnacanTimerWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AnacanTimerAttributes.self) { context in
            // ── Lock Screen / Notification Center — Anacan kart dizaynı ──
            HStack(spacing: 14) {
                // Emoji — şəftəli qradiyent nişanda (a-list-icon pattern-i)
                ZStack {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [.anacanPeach1, .anacanPeach2],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 44, height: 44)
                    Text(context.attributes.timerEmoji)
                        .font(.system(size: 22))
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text(context.attributes.label)
                        .font(.subheadline.bold())
                        .foregroundColor(.anacanInk)
                        .lineLimit(1)

                    HStack(spacing: 4) {
                        if let feedType = context.attributes.feedType {
                            Text(feedType == "left" ? "◀︎" : "▶︎")
                                .font(.caption2.bold())
                                .foregroundColor(.anacanPeach2)
                        }
                        // JS tərəfdən gələn lokallaşdırılmış alt-mətn (live-timer.ts → subLabel)
                        Text(context.attributes.subLabel ?? "")
                            .font(.caption)
                            .foregroundColor(.anacanInkSoft)
                            .lineLimit(1)
                    }
                }

                Spacer()

                // startTime-dan avtomatik sayan canlı sayğac — Anacan aksent rəngi
                Text(context.attributes.startTime, style: .timer)
                    .font(.title3.monospacedDigit().bold())
                    .foregroundColor(.anacanPeach2)
                    .frame(maxWidth: 76, alignment: .trailing)
                    .minimumScaleFactor(0.8)

                // Dayandır (iOS 17+; 16.x-də toxunuş tətbiqi açır)
                if #available(iOS 17.0, *) {
                    Button(intent: AnacanTimerStopIntent(timerId: context.attributes.id)) {
                        Image(systemName: "stop.fill")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 34, height: 34)
                            .background(Circle().fill(Color.anacanPeach2))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(14)
            .activityBackgroundTint(.anacanSurface)

        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    ZStack {
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [.anacanPeach1, .anacanPeach2],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 32, height: 32)
                        Text(context.attributes.timerEmoji)
                            .font(.system(size: 16))
                    }
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.label)
                        .font(.subheadline.bold())
                        .foregroundColor(.white)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.attributes.startTime, style: .timer)
                        .font(.title3.monospacedDigit().bold())
                        .foregroundColor(.anacanPeach2)
                        .frame(maxWidth: 64, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if #available(iOS 17.0, *) {
                        Button(intent: AnacanTimerStopIntent(timerId: context.attributes.id)) {
                            Label("Dayandır", systemImage: "stop.fill")
                                .font(.caption.bold())
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 7)
                                .background(Capsule().fill(Color.anacanPeach2))
                                .foregroundColor(.white)
                        }
                        .buttonStyle(.plain)
                    }
                }
            } compactLeading: {
                Text(context.attributes.timerEmoji)
                    .font(.system(size: 15))
            } compactTrailing: {
                Text(context.attributes.startTime, style: .timer)
                    .font(.caption.monospacedDigit().bold())
                    .foregroundColor(.anacanPeach2)
                    .frame(maxWidth: 44)
            } minimal: {
                Text(context.attributes.timerEmoji)
                    .font(.system(size: 14))
            }
        }
    }
}

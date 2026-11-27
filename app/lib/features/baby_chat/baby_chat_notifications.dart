// Ported from: src/lib/baby-chat-notifications.ts
//
// Daily "Körpəmdən mesajlar" notifications, scheduled on the device (no server job):
// the next 7 arrivals at each day's own time. Tapping opens the chat (push type 'baby_chat' → screen
// `baby-chat`, handled by the shell's push router).
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/notifications/local_notification_plan.dart' show StoredNotification;
import '../home_flow/flow_platform.dart' show FlowNotificationPlanner, NoopFlowNotificationPlanner;
import 'baby_chat.dart';

const int kBabyChatNotificationBaseId = 7300;
const int _days = 7;
const String kBabyChatNotificationNamespace = 'baby-chat';
final List<int> kBabyChatNotificationIds = [for (var i = 0; i < _days; i++) kBabyChatNotificationBaseId + i];

/// The central `setLocalNotifications` scheduler (same interface as the flow home's). Default: not native, no-op.
final babyChatNotificationPlannerProvider = Provider<FlowNotificationPlanner>((ref) => const NoopFlowNotificationPlanner());

/// The next week of arrivals later than one minute from [now].
List<StoredNotification> planBabyChatNotifications(BabyChatText text, String userId, DateTime now) {
  final nowMs = now.millisecondsSinceEpoch;
  final upcoming = [
    for (var i = 0; i < _days; i++)
      (id: kBabyChatNotificationBaseId + i, at: dailyArrival(DateTime(now.year, now.month, now.day + i, now.hour, now.minute), userId)),
  ].where((n) => n.at.millisecondsSinceEpoch > nowMs + 60000).toList();
  return [
    for (var i = 0; i < upcoming.length; i++)
      StoredNotification(
        id: upcoming[i].id,
        title: text.u('notif_title'),
        body: text.notifications[(upcoming[i].at.day + i) % text.notifications.length],
        at: upcoming[i].at.millisecondsSinceEpoch,
        extra: const {'type': 'baby_chat'},
      ),
  ];
}

/// Reschedules the next week. Asks for permission only when [ask] is true (opening the chat).
Future<void> scheduleBabyChatNotifications(FlowNotificationPlanner planner, BabyChatText text, String userId,
    {bool ask = false, DateTime? now}) async {
  if (!planner.isNativePlatform) return;
  await planner.setLocalNotifications(kBabyChatNotificationNamespace, planBabyChatNotifications(text, userId, now ?? DateTime.now()),
      ask: ask, cancelIds: kBabyChatNotificationIds);
}

/// Cancels every scheduled baby-chat notification (pregnancy loss, logout).
Future<void> cancelBabyChatNotifications(FlowNotificationPlanner planner) async {
  if (!planner.isNativePlatform) return;
  await planner.setLocalNotifications(kBabyChatNotificationNamespace, const [], cancelIds: kBabyChatNotificationIds);
}

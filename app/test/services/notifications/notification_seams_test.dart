// Covers the feature seams implemented on the central scheduler (WIRING.md rows) and the native.ts reminders
// (water / vitamin), src/lib/nap-alerts.ts requestNapAlertPermission and MedSheet's permission request.
import 'package:anacan/features/settings/data/preferences.dart' show DesiredNotification;
import 'package:anacan/services/notifications/local_notification_backend.dart';
import 'package:anacan/services/notifications/local_notification_scheduler.dart';
import 'package:anacan/services/notifications/local_reminders.dart';
import 'package:anacan/services/notifications/notification_seams.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_local_notifications.dart';

void main() {
  late FakeLocalNotificationBackend os;
  late LocalNotificationScheduler scheduler;
  final now = DateTime(2026, 11, 25, 9, 0);

  setUp(() {
    os = FakeLocalNotificationBackend();
    scheduler = LocalNotificationScheduler(store: LocalStore.memory(), backend: os, clock: () => now);
  });

  StoredNotification item(int id, int hoursAhead) =>
      StoredNotification(id: id, title: 't$id', body: 'b', at: now.add(Duration(hours: hoursAhead)).millisecondsSinceEpoch);

  group('local reminders (native.ts)', () {
    test('one water reminder a day at 10:00 replaces the legacy every-2-hours ids', () async {
      for (final id in [108, 110]) {
        os.pending[id] = legacyNotification(id, 'old water');
      }
      final reminders = LocalReminders(scheduler, isNative: true, clock: () => now);
      await reminders.scheduleWaterReminder();
      expect(os.pendingKeys, [waterNotificationId]);
      expect(os.pending[waterNotificationId]!.schedule, const NativeScheduleDaily(hour: 10, minute: 0));
      expect(os.pending[waterNotificationId]!.title, 'Su vaxtı! 💧');
      await reminders.cancelWaterReminders();
      expect(os.pending, isEmpty);
    });

    test('the vitamin reminder repeats daily at its time; cancelAll forgets everything', () async {
      final reminders = LocalReminders(scheduler, isNative: true, clock: () => now);
      await reminders.schedulePillReminder(DateTime(2026, 11, 25, 21, 15));
      expect(os.pending[pillNotificationId]!.schedule, const NativeScheduleDaily(hour: 21, minute: 15));
      await reminders.cancelAll();
      expect(os.pending, isEmpty);
      expect(os.removeDeliveredCalls, 1);
    });

    test('does nothing off native and reports the permission as granted, like the web build', () async {
      final reminders = LocalReminders(scheduler, isNative: false);
      await reminders.scheduleWaterReminder(ask: true);
      expect(os.scheduleCalls, isEmpty);
      expect(await reminders.checkPermissions(), 'granted');
      os.display = 'denied';
      expect(await LocalReminders(scheduler, isNative: true).checkPermissions(), 'denied');
    });
  });

  group('feature seams', () {
    test('the settings scheduler maps its reminders onto the namespace and keeps the legacy cancel ids', () async {
      final settings = SchedulerReminderScheduler(LocalReminders(scheduler, isNative: true, clock: () => now));
      await settings.setLocalNotifications(
        'exercise',
        [DesiredNotification(id: 300, title: 'x', body: 'y', at: now.add(const Duration(hours: 1)))],
        cancelIds: [300, 301, 302],
      );
      expect(scheduler.desired('exercise').single.id, 300);
      expect(os.pendingKeys, [300]);
      expect(await settings.displayPermission(), 'granted');
    });

    test('the flow / baby chat / illness planner reports native only with the plugin', () async {
      expect(SchedulerFlowNotificationPlanner(scheduler).isNativePlatform, isTrue);
      await SchedulerFlowNotificationPlanner(scheduler).setLocalNotifications('baby-chat', [item(7300, 2)], cancelIds: [7300, 7301]);
      expect(os.pendingKeys, [7300]);
      os.native = false;
      expect(SchedulerFlowNotificationPlanner(scheduler).isNativePlatform, isFalse);
    });

    test('nap alert permission asks only when not yet granted and is false without the plugin', () async {
      final programme = SchedulerProgrammeNotifications(scheduler);
      expect(await programme.requestPermission(), isTrue);
      expect(os.requestCalls, 0);
      os.display = 'denied';
      expect(await programme.requestPermission(), isTrue); // the fake grants on request
      expect(os.requestCalls, 1);
      os.native = false;
      expect(await programme.requestPermission(), isFalse);
    });

    test('the illness sheet requests permission only while the OS would still prompt', () async {
      os.display = 'denied';
      await requestPermissionIfPrompt(scheduler);
      expect(os.requestCalls, 0);
      os.display = 'prompt-with-rationale';
      await requestPermissionIfPrompt(scheduler);
      expect(os.requestCalls, 1);
    });

    test('vaccine seam: native only with the plugin; clearing removes every block', () async {
      final vaccines = SchedulerVaccineNotificationScheduler(scheduler);
      expect(vaccines.isNativePlatform, isTrue);
      expect(await vaccines.setLocalNotifications('vaccine:883400', [item(883400, 1)], ask: false), 'scheduled');
      await vaccines.clearLocalNotificationNamespaces('vaccine:', [883300]);
      expect(os.pending, isEmpty);
    });

    test('timer fallback notification: shown ongoing at once and cancelled by id', () async {
      final timers = SchedulerTimerNotificationScheduler(scheduler);
      await timers.notifyNow(id: 42, title: 'Yuxu', body: 'b');
      expect(os.pending[42]!.ongoing, isTrue);
      expect(os.pending[42]!.autoCancel, isFalse);
      expect(os.pending[42]!.smallIcon, 'ic_stat_icon');
      await timers.cancelIds([42]);
      expect(os.pending, isEmpty);
    });
  });
}

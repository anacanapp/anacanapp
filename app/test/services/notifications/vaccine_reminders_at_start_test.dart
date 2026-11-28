// Ported from: src/hooks/useVaccineRemindersAtStart.test.ts
//
// The LocalNotifications mock is [FakeLocalNotificationBackend] under the real central scheduler; the supabase
// queries are a fake [VaccineRefreshDeps]; `vi.useFakeTimers()` is an injected timer factory.
import 'dart:async';

import 'package:anacan/features/tools/vaccines/vaccine_models.dart';
import 'package:anacan/features/tools/vaccines/vaccine_reminders.dart';
import 'package:anacan/services/notifications/local_notification_scheduler.dart';
import 'package:anacan/services/notifications/notification_seams.dart';
import 'package:anacan/services/notifications/vaccine_reminders_at_start.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_local_notifications.dart';

final DateTime kNow = DateTime(2026, 11, 8, 9, 0);

Map<String, dynamic> vaccine(String id, String code) => {'id': id, 'code': code, 'name': code, 'name_az': code, 'is_active': true};
Map<String, dynamic> sched(String id, String vaccineId, int days, String country) => {
      'id': id,
      'vaccine_id': vaccineId,
      'country_code': country,
      'dose_number': 1,
      'recommended_age_days': days,
      'min_age_days': null,
      'max_age_days': null,
      'age_label': '',
      'age_label_az': '',
      'dose_label': '1-ci doza',
      'dose_label_az': '1-ci doza',
      'notes': null,
      'sort_order': 1,
    };
VaccineScheduleRow row(Map<String, dynamic> s, Map<String, dynamic> v) => VaccineScheduleRow.fromMap({...s, 'vaccine': v});

class FakeDeps implements VaccineRefreshDeps {
  List<ReminderChild> children = const [];
  Map<String, List<VaccineScheduleRow>> schedules = const {};
  List<ReminderVaccinationLog> logs = const [];
  final List<String> childCalls = [];
  final List<String> scheduleCalls = [];
  final List<(String, List<String>)> logCalls = [];

  @override
  Future<List<ReminderChild>> loadChildren(String userId) async {
    childCalls.add(userId);
    return children;
  }

  @override
  Future<List<VaccineScheduleRow>> loadSchedule(String country, String language) async {
    scheduleCalls.add(country);
    return schedules[country] ?? const [];
  }

  @override
  Future<List<ReminderVaccinationLog>> loadLogs(String userId, List<String> childIds) async {
    logCalls.add((userId, childIds));
    return logs;
  }
}

class ManualTimer implements Timer {
  ManualTimer(this.callback);
  final void Function() callback;
  bool _active = true;
  @override
  void cancel() => _active = false;
  @override
  bool get isActive => _active;
  @override
  int get tick => 0;
  void fire() {
    if (!_active) return;
    _active = false;
    callback();
  }
}

void main() {
  late FakeLocalNotificationBackend ln;
  late LocalStore store;
  late LocalNotificationScheduler scheduler;
  late VaccineReminders reminders;
  late FakeDeps deps;

  setUp(() {
    ln = FakeLocalNotificationBackend();
    store = LocalStore.memory();
    // The central scheduler drops reminders already in the past, so the clock is the fixture's NOW.
    scheduler = LocalNotificationScheduler(store: store, backend: ln, clock: () => kNow);
    reminders = VaccineReminders(store, SchedulerVaccineNotificationScheduler(scheduler));
    deps = FakeDeps();
  });

  group('runVaccineReminderRefresh', () {
    test('schedules reminders for every child, each with its own country plan, name and id block', () async {
      deps.children = const [
        ReminderChild(id: 'a', name: 'Aylin', birthDate: '2026-09-21', gender: 'girl', vaccineCountryCode: 'AZ'), // 60 days → 2026-11-20
        ReminderChild(id: 'b', name: 'Bəxtiyar', birthDate: '2026-07-01', gender: 'boy', vaccineCountryCode: 'TR'), // 150 days → 2026-11-28
      ];
      deps.schedules = {
        'AZ': [row(sched('az-mmr', 'v1', 60, 'AZ'), vaccine('v1', 'MMR'))],
        'TR': [row(sched('tr-hepb', 'v2', 150, 'TR'), vaccine('v2', 'HepB')), row(sched('tr-done', 'v2', 140, 'TR'), vaccine('v2', 'HepB'))],
      };
      deps.logs = const [ReminderVaccinationLog(childId: 'b', vaccineScheduleId: 'tr-done', administeredAt: '2026-11-01')];
      final result = await runVaccineReminderRefresh(reminders, deps, userId: 'u', language: 'en', now: kNow);
      expect(result, 'scheduled');
      expect(deps.scheduleCalls, hasLength(2));
      expect(deps.logCalls.single.$1, 'u');
      expect(deps.logCalls.single.$2, ['a', 'b']);
      expect(ln.requestCalls, 0);
      final notes = [for (final c in ln.scheduleCalls) ...c];
      expect([for (final n in notes) [n.id, n.extra!['dose']]], [
        [vaccineChildBaseId, 'az-mmr'],
        [vaccineChildBaseId + 1, 'az-mmr'],
        [vaccineChildBaseId + vaccineChildStride, 'tr-hepb'],
        [vaccineChildBaseId + vaccineChildStride + 1, 'tr-hepb'],
      ]);
      expect(notes[0].body, 'Aylin: Measles, mumps, and rubella (MMR) (Dose 1) 3 gün sonradır.');
      expect(notes[2].body, contains('Bəxtiyar: Hepatitis B (HepB) (Dose 1)'));
    });
  });

  group('useVaccineRemindersAtStart', () {
    late List<ManualTimer> timers;
    late bool native;

    VaccineRemindersAtStart hook() => VaccineRemindersAtStart(
          isNative: () => native,
          reminders: () => reminders,
          deps: () => deps,
          clock: () => kNow,
          timer: (delay, cb) {
            expect(delay, vaccineRefreshStartDelay);
            final t = ManualTimer(cb);
            timers.add(t);
            return t;
          },
        );

    setUp(() {
      timers = [];
      native = true;
    });

    test('does nothing on the web, before login or before the profile is ready', () {
      native = false;
      hook().update(const VaccineRefreshInputs(userId: 'u', ready: true, language: 'en'));
      native = true;
      hook().update(const VaccineRefreshInputs(userId: null, ready: true, language: 'en'));
      hook().update(const VaccineRefreshInputs(userId: 'u', ready: false, language: 'en'));
      for (final t in timers) {
        t.fire();
      }
      expect(deps.childCalls, isEmpty);
    });

    test('loads the children on the phone after login, once the start delay passes', () async {
      hook().update(const VaccineRefreshInputs(userId: 'u', ready: true, language: 'en'));
      expect(deps.childCalls, isEmpty);
      timers.single.fire();
      await pumpEventQueue();
      expect(deps.childCalls, ['u']);
      // It ran today for this account and language: marked.
      expect(reminders.refreshDue('u:2026-11-08:en'), isFalse);
    });

    test('skips when it already ran today for this account and language', () {
      reminders.markRefresh('u:2026-11-08:en');
      hook().update(const VaccineRefreshInputs(userId: 'u', ready: true, language: 'en'));
      expect(timers, isEmpty);
      expect(deps.childCalls, isEmpty);
    });

    test('a change of input or dispose cancels the pending refresh', () {
      final h = hook()..update(const VaccineRefreshInputs(userId: 'u', ready: true, language: 'en'));
      h.update(const VaccineRefreshInputs(userId: 'u', ready: true, language: 'ru'));
      expect(timers.first.isActive, isFalse);
      h.dispose();
      expect(timers.last.isActive, isFalse);
    });
  });
}

// Ported from: (test support) — vi.mock setups of src/components/flow/*.test.tsx: a fake FlowRepository instead of
// the supabase client, a frozen DomainClock instead of vi.setSystemTime, in-memory stores.
import 'dart:async';

import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/data/data.dart' hide Row;
import 'package:anacan/core/i18n/i18n.dart' show ensureDateLocales;
import 'package:anacan/core/offline/offline.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/features/home_flow/data/flow_hooks.dart';
import 'package:anacan/features/home_flow/data/flow_repository.dart';
import 'package:anacan/features/home_flow/flow_platform.dart';
import 'package:anacan/state/state.dart';
import 'package:anacan/design/gallery.dart' show GalleryFrame;
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../design/harness.dart';
import '../../support/i18n_fakes.dart';

export '../../design/harness.dart';

class _NoPlatform implements UserStorePlatform {
  @override
  void languageChanged(String language) {}
  @override
  void writePreference(String key, String value) {}
}

/// In-memory stand-in for the PostgREST/RPC calls. Records every call in [calls].
class FakeFlowRepository implements FlowRepository {
  FakeFlowRepository();
  Rows cycles = [];
  Rows periodLogs = [];
  Rows dailyLogs = [];
  Rows moodLogs = [];
  Rows symptoms = [];
  Rows insights = [];
  Rows tips = [];
  Rows reminders = [];
  Map<String, String> labels = {};
  final List<(String, Object?)> calls = [];
  final List<Map<String, Object?>> rpcCalls = [];

  /// When set, record_period_days throws this.
  Object? rpcError;

  /// When set, record_period_days waits for it.
  Completer<void>? rpcGate;
  Map<String, Object?> profile = {'last_period_date': '2026-09-10', 'period_length': 5, 'cycle_length': 28};

  @override
  Future<Rows> cycleHistory(String userId) async => [...cycles];
  @override
  Future<Map<String, dynamic>> updateCycle(String id, Map<String, Object?> updates) async {
    calls.add(('updateCycle', updates));
    return {'id': id, ...updates};
  }

  @override
  Future<void> deleteCycle(String id) async => calls.add(('deleteCycle', id));
  @override
  Future<Rows> periodDayLogs(String userId, {String? from, String? to}) async => [...periodLogs];

  @override
  Future<Object?> recordPeriodDays(Map<String, Object?> params) async {
    rpcCalls.add(params);
    if (rpcGate != null) await rpcGate!.future;
    if (rpcError != null) throw rpcError!;
    final flow = params['p_flow'] as String?;
    final dates = (params['p_dates']! as List).cast<String>();
    // Mirror the server: write period day rows and the daily log.
    if (flow != null) {
      periodLogs.removeWhere((l) => dates.contains(l['log_date']));
      if (flow != 'clear') periodLogs.addAll([for (final d in dates) {'id': 'p-$d', 'log_date': d, 'flow_intensity': flow}]);
    }
    final daily = params['p_daily_log'] as Map?;
    if (daily != null) {
      dailyLogs.removeWhere((l) => l['log_date'] == dates.first);
      dailyLogs.add({'id': 'd-${dates.first}', 'log_date': dates.first, ...daily.cast<String, Object?>()});
    }
    return {
      'ok': true,
      'userId': params['p_expected_user_id'],
      'dates': dates,
      'flow': flow,
      'dailyLog': daily,
      'profile': profile,
      'healthDays': [for (final d in dates) if (flow != null) {'date': d, 'flow': flow, 'cycleStart': false}],
    };
  }

  @override
  Future<Map<String, dynamic>?> flowDailyLog(String userId, String date) async =>
      dailyLogs.where((l) => l['log_date'] == date).firstOrNull;
  @override
  Future<Rows> flowDailyLogs(String userId, String start, String end, {bool ascending = false}) async =>
      dailyLogs.where((l) => (l['log_date'] as String).compareTo(start) >= 0 && (l['log_date'] as String).compareTo(end) <= 0).toList();
  @override
  Future<Rows> flowMoodChart(String userId, String start, String end) async => [...moodLogs];
  @override
  Future<Rows> flowSymptoms() async => [...symptoms];
  @override
  Future<Rows> flowInsights(String? phase) async => [...insights];
  @override
  Future<Rows> phaseTips(String phase) async => [...tips];
  @override
  Future<Rows> upcomingLabels() async => [for (final e in labels.entries) {'key': e.key, 'value': e.value}];
  @override
  Future<Rows> flowReminders(String userId) async => [...reminders];
  @override
  Future<Map<String, dynamic>> upsertReminder(Map<String, Object?> row) async {
    calls.add(('upsertReminder', row));
    reminders.removeWhere((r) => r['reminder_type'] == row['reminder_type']);
    final saved = {'id': 'r-${row['reminder_type']}', ...row};
    reminders.add(saved);
    return saved;
  }

  @override
  Future<Map<String, dynamic>> updateReminder(String id, Map<String, Object?> patch) async {
    calls.add(('updateReminder', {'id': id, ...patch}));
    final i = reminders.indexWhere((r) => r['id'] == id);
    if (i >= 0) reminders[i] = {...reminders[i], ...patch};
    return i >= 0 ? reminders[i] : {'id': id, ...patch};
  }

  @override
  Future<void> deleteReminder(String id) async => calls.add(('deleteReminder', id));
  @override
  Future<void> upsertReminders(List<Map<String, Object?>> rows) async {
    calls.add(('upsertReminders', rows));
    for (final r in rows) {
      reminders.add({'id': 'r-${r['reminder_type']}', ...r});
    }
  }

  @override
  Future<String?> lastDelayNotificationAt(String userId) async => null;
  @override
  Future<void> insertNotification(Map<String, Object?> row) async => calls.add(('insertNotification', row));
  @override
  Future<void> setLastDelayNotificationAt(String userId, String iso) async => calls.add(('setLastDelay', iso));
  @override
  Future<void> updateProfile(String userId, Map<String, Object?> patch) async => calls.add(('updateProfile', patch));
}

/// Builds a [ProviderContainer] with the flow fakes, a frozen clock and a flow user.
class FlowTestEnv {
  FlowTestEnv({DateTime? now, this.lastPeriod, this.uid = 'u1', this.outbox, List<Override> extra = const []}) {
    installTestI18n();
    DomainClock.setSystemTime(now ?? DateTime(2026, 9, 14, 12));
    container = ProviderContainer(overrides: [
      localStoreProvider.overrideWithValue(LocalStore.memory()),
      userStorePlatformProvider.overrideWithValue(_NoPlatform()),
      queryClientProvider.overrideWithValue(QueryClient(defaults: const QueryDefaults(retry: noRetry))),
      flowRepositoryProvider.overrideWithValue(repo),
      flowUserIdProvider.overrideWithValue(uid),
      flowOutboxProvider.overrideWithValue(outbox),
      flowProfileRowProvider.overrideWithValue(null),
      ...extra,
    ]);
    final store = container.read(userStoreProvider.notifier);
    store.setAuth(true, uid);
    store.setLifeStage('flow');
    store.setCycleLength(28);
    store.setPeriodLength(5);
    store.setLastPeriodDate(lastPeriod ?? DateTime(2026, 9, 10));
  }

  final FakeFlowRepository repo = FakeFlowRepository();
  final DateTime? lastPeriod;
  final String? uid;
  final OfflineOutbox? outbox;
  late final ProviderContainer container;

  void dispose() {
    container.dispose();
    DomainClock.reset();
  }

  /// MaterialApp + theme + toast host, 390 wide, scrollable.
  Widget wrap(Widget child, {bool dark = false, bool rtl = false, bool scroll = true}) {
    return UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        home: GalleryFrame(
          dark: dark,
          rtl: rtl,
          child: Builder(
            builder: (context) => ColoredBox(
              color: context.a.bg,
              child: scroll
                  ? SingleChildScrollView(padding: const EdgeInsets.fromLTRB(20, 12, 20, 40), child: child)
                  : Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: child),
            ),
          ),
        ),
      ),
    );
  }
}

/// Sets a 390×844 phone surface.
void phoneSurface(WidgetTester tester, {double height = 844}) {
  tester.view.physicalSize = Size(390 * 3, height * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

/// Lets queries resolve and entry animations finish.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
  await tester.pump(const Duration(seconds: 2));
}

Future<void> goldenSettle(WidgetTester tester) async {
  await loadAnacanFonts();
  await settle(tester);
  await settleSvgs(tester);
}

String dateKey(DateTime d) => ymd(d);

/// intl date symbols (`ensureDateLocales` runs at app startup).
void flowSetUpAll() => setUpAll(() async => ensureDateLocales());

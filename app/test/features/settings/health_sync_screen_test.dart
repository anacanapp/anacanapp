// Ported from: src/components/HealthSyncScreen.test.tsx (case names kept), src/lib/health.test.ts (bucket cases
//              exercised through the screen)
import 'package:anacan/domain/cycle/health_cycle.dart' show MenstruationWrite;
import 'package:anacan/features/settings/copy/feature_copy.dart';
import 'package:anacan/features/settings/data/health_service.dart';
import 'package:anacan/features/settings/health_sync_screen.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import 'support/harness.dart';

class NativeHealth implements HealthPluginBridge {
  bool available = true;
  Map<String, bool> check = {'READ_STEPS': true, 'READ_WORKOUTS': true};
  Map<String, bool> grant = {'READ_STEPS': true, 'READ_WORKOUTS': true};
  List<Map<String, Object?>> Function(String dataType) aggregated = (_) => [];
  List<Map<String, Object?>> workouts = [];
  final calls = <String>[];
  List<String>? requested;
  @override
  Future<Map<String, bool>> checkHealthPermissions(List<String> permissions) async {
    calls.add('checkHealthPermissions');
    return check;
  }

  @override
  Future<bool> isHealthAvailable() async {
    calls.add('isHealthAvailable');
    return available;
  }

  @override
  Future<void> openAppleHealthSettings() async => calls.add('openAppleHealthSettings');
  @override
  Future<void> openHealthConnectSettings() async => calls.add('openHealthConnectSettings');
  @override
  Future<List<Map<String, Object?>>> queryAggregated({required String startDate, required String endDate, required String dataType, String bucket = 'day'}) async {
    calls.add('queryAggregated');
    return aggregated(dataType);
  }

  @override
  Future<List<Map<String, Object?>>> queryWorkouts({required String startDate, required String endDate}) async {
    calls.add('queryWorkouts');
    return workouts;
  }

  @override
  Future<Map<String, bool>> requestHealthPermissions(List<String> permissions) async {
    calls.add('requestHealthPermissions');
    requested = permissions;
    return grant;
  }

  @override
  Future<void> showHealthConnectInPlayStore() async => calls.add('showHealthConnectInPlayStore');
}

class Cycle implements HealthCyclePluginBridge {
  int permissionRequests = 0;
  @override
  Future<({bool available, int? apiVersion})> isAvailable() async => (available: true, apiVersion: 2);
  @override
  Future<bool> requestWritePermission() async {
    permissionRequests++;
    return true;
  }

  @override
  Future<void> writeMenstruation(MenstruationWrite write) async {}
}

class Vitals implements HealthVitalsPluginBridge {
  int permissionRequests = 0;
  @override
  Future<bool> isAvailable() async => true;
  @override
  Future<bool> requestWritePermission() async {
    permissionRequests++;
    return true;
  }

  @override
  Future<void> writeBloodGlucose({required double mgdl, String? date}) async {}
  @override
  Future<void> writeBloodPressure({required double systolic, required double diastolic, String? date}) async {}
  @override
  Future<void> writeWeight({required double kg, String? date}) async {}
}

class NoVitals implements VitalsSource {
  @override
  Future<List<Map<String, dynamic>>> bloodPressure(String userId, String since) async => [];
  @override
  Future<List<Map<String, dynamic>>> glucose(String userId, String since) async => [];
  @override
  Future<List<Map<String, dynamic>>> weights(String userId, String since) async => [];
}

final en = healthSyncText('en');
DateTime midnight() {
  final d = DateTime.now();
  return DateTime(d.year, d.month, d.day);
}

class Env {
  Env({this.platform = 'ios', this.native = true, this.lifeStage = 'flow'});
  String platform;
  bool native;
  String lifeStage;
  final health = NativeHealth();
  final cycle = Cycle();
  final vitals = Vitals();
  late LocalStore store = seededStore(user: {'lifeStage': lifeStage, 'language': 'en', 'userId': 'u1'});
  List<Override> overrides() => [
        ...baseOverrides(store: store),
        healthRuntimePlatformProvider.overrideWithValue((native: native, platform: platform)),
        healthPluginBridgeProvider.overrideWithValue(health),
        healthCyclePluginProvider.overrideWithValue(cycle),
        healthVitalsPluginProvider.overrideWithValue(vitals),
        vitalsSourceProvider.overrideWithValue(NoVitals()),
      ];
}

Future<void> render(WidgetTester tester, Env env, {bool dark = false}) async {
  await pumpApp(tester, HealthSyncScreen(onBack: () {}), scroll: false, dark: dark, overrides: env.overrides(), size: const Size(390, 1400));
  await tester.pumpAndSettle();
}

bool switchOn(WidgetTester tester, String key) => (tester.widget(find.byKey(ValueKey<String>(key))) as dynamic).checked as bool;

void main() {
  setUpAll(loadAnacanFonts);

  group('HealthSyncScreen', () {
    screenTest('shows real iOS steps after connecting (epoch-millisecond buckets)', (tester) async {
      final env = Env();
      env.health.aggregated = (type) => type == 'steps' ? [{'startDate': midnight().millisecondsSinceEpoch, 'endDate': DateTime.now().millisecondsSinceEpoch, 'value': 8123}] : [];
      env.health.workouts = [{'startDate': DateTime.now().toIso8601String(), 'endDate': DateTime.now().toIso8601String(), 'workoutType': 'walking', 'duration': 1800, 'calories': 120}];
      await render(tester, env);
      expect(find.text(en('status_off')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey<String>('health-connect')));
      await tester.pumpAndSettle();
      expect(find.text('8,123'), findsOneWidget);
      expect(find.text(en('goal_done')), findsOneWidget);
      expect(find.text(en('status_connected')), findsOneWidget);
      expect(find.text(en('wt_walking')), findsOneWidget);
      expect(find.text(en('mindful7')), findsOneWidget);
      expect(find.text(en('empty_title')), findsNothing);
    });

    screenTest('explains where to look when the phone returns no data', (tester) async {
      final env = Env();
      env.store.setItem(kHealthConnectedKey, '1');
      await render(tester, env);
      expect(find.text(en('empty_title')), findsOneWidget);
      expect(find.text(en('empty_ios')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey<String>('health-open-permissions')));
      await tester.pumpAndSettle();
      expect(env.health.calls.where((c) => c == 'openAppleHealthSettings').length, 1);
    });

    screenTest('reads Health Connect on Android and shows a missing grant honestly', (tester) async {
      final env = Env(platform: 'android');
      env.store.setItem(kHealthConnectedKey, '1');
      env.health.check = {'READ_STEPS': false, 'READ_WORKOUTS': false};
      await render(tester, env);
      expect(find.text(en('no_access_desc')), findsOneWidget);
      expect(find.text(en('status_no_access')), findsWidgets);
      await tester.tap(find.byKey(const ValueKey<String>('health-grant')));
      await tester.pumpAndSettle();
      expect(env.health.requested, ['READ_STEPS', 'READ_WORKOUTS']);
    });

    screenTest('shows Android steps from LocalDateTime buckets', (tester) async {
      final env = Env(platform: 'android');
      env.store.setItem(kHealthConnectedKey, '1');
      env.health.aggregated = (_) => [{'startDate': '${localDayKey(DateTime.now())}T00:00', 'endDate': '', 'value': 3456}];
      await render(tester, env);
      expect(find.text('3,456'), findsOneWidget);
      expect(find.text(en('active7')), findsOneWidget);
    });

    screenTest('offers the Health Connect install when it is missing', (tester) async {
      final env = Env(platform: 'android');
      env.health.available = false;
      await render(tester, env);
      await tester.tap(find.byKey(const ValueKey<String>('health-install')));
      await tester.pumpAndSettle();
      expect(env.health.calls.where((c) => c == 'showHealthConnectInPlayStore').length, 1);
    });

    for (final platform in ['ios', 'android']) {
      screenTest('turns on measurement copies with a permission request on $platform', (tester) async {
        final env = Env(platform: platform);
        await render(tester, env);
        expect(env.vitals.permissionRequests, 0);
        await tester.tap(find.byKey(const ValueKey<String>('health-vitals')));
        await tester.pumpAndSettle();
        expect(switchOn(tester, 'health-vitals'), isTrue);
        expect(env.vitals.permissionRequests, 1);
        expect(env.store.getItem(kVitalsWriteKey), '1');
        expect(find.byKey(const ValueKey<String>('health-sync-now')), findsOneWidget);
      });
    }

    screenTest('keeps period copies to Flow, but an earlier opt-in can always be turned off', (tester) async {
      final env = Env(lifeStage: 'bump');
      await render(tester, env);
      expect(find.byKey(const ValueKey<String>('health-vitals')), findsOneWidget);
      expect(find.byKey(const ValueKey<String>('health-cycle')), findsNothing);
      await tester.pumpWidget(const SizedBox());

      final env2 = Env(lifeStage: 'bump');
      env2.store.setItem(kCycleWriteKey, '1');
      await render(tester, env2);
      expect(switchOn(tester, 'health-cycle'), isTrue);
      await tester.tap(find.byKey(const ValueKey<String>('health-cycle')));
      await tester.pumpAndSettle();
      expect(env2.store.getItem(kCycleWriteKey), isNull);
      expect(env2.cycle.permissionRequests, 0);
    });

    screenTest('is informational on the web', (tester) async {
      final env = Env(platform: 'web', native: false);
      await render(tester, env);
      expect(find.text(en('web_title')), findsOneWidget);
      expect(find.byKey(const ValueKey<String>('health-vitals')), findsNothing);
      expect(env.health.calls, isEmpty);
    });
  });

  group('health.ts helpers', () {
    test('bucket days from epoch ms, ISO and local date-time', () {
      final noon = DateTime(2026, 10, 31, 12);
      expect(bucketDayKey(noon.millisecondsSinceEpoch), '2026-10-31');
      expect(bucketDayKey('2026-10-31T00:00'), '2026-10-31');
      expect(bucketDayKey('nope'), isNull);
      final days = fillDays([{'startDate': '2026-10-31T00:00', 'value': 10}, {'startDate': '2026-10-31T08:00', 'value': 5}, {'startDate': '2026-10-30', 'value': -3}], 2, now: noon);
      expect(days.map((d) => '${d.date}=${d.value}'), ['2026-10-30=0', '2026-10-31=15']);
    });
    test('weightMoment uses the save time on the entry day, else noon', () {
      final created = DateTime(2026, 5, 2, 9, 30);
      expect(weightMoment('2026-05-02', created.toUtc().toIso8601String()), created.toUtc().toIso8601String());
      expect(weightMoment('2026-05-01', created.toUtc().toIso8601String()), DateTime(2026, 5, 1, 12).toUtc().toIso8601String());
    });
  });

  group('goldens', () {
    for (final mode in ['light', 'dark']) {
      screenTest('health sync connected $mode', (tester) async {
        final env = Env();
        env.store.setItem(kHealthConnectedKey, '1');
        env.health.aggregated = (type) => type == 'steps' ? [{'startDate': midnight().millisecondsSinceEpoch, 'value': 5123}] : [];
        await pumpApp(tester, HealthSyncScreen(onBack: () {}), scroll: false, dark: mode == 'dark', overrides: env.overrides());
        await tester.pumpAndSettle();
        await expectGolden(tester, 'health_sync_$mode');
      });
    }
  });
}

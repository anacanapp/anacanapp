// Ported from: src/lib/health.test.ts (case names kept; the capacitor-health mock becomes a fake native side of the
//              `anacan/health` channel), node_modules/capacitor-health/dist/esm/definitions.d.ts (call shapes)
//
// HealthService (health.ts) over the real MethodChannelHealth client: the method names, arguments and answer shapes
// must match HealthReadsPlugin.kt and HealthReadsChannel.swift.
import 'package:anacan/domain/cycle/health_cycle.dart' show MenstruationWrite;
import 'package:anacan/features/settings/data/health_service.dart';
import 'package:anacan/native/platform/health_reads_channel.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

const String channel = MethodChannelHealth.channelName;
final List<MethodCall> calls = <MethodCall>[];

/// Fake native side: one answer function per method; a missing method answers like an unregistered plugin method.
void answer(Map<String, Object? Function(MethodCall call)> methods) {
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(const MethodChannel(channel), (call) async {
    calls.add(call);
    final handler = methods[call.method];
    if (handler == null) throw MissingPluginException('not implemented');
    return handler(call);
  });
}

int callsOf(String method) => calls.where((c) => c.method == method).length;

class _Cycle implements HealthCyclePluginBridge {
  @override
  Future<({bool available, int? apiVersion})> isAvailable() async => (available: false, apiVersion: null);
  @override
  Future<bool> requestWritePermission() async => false;
  @override
  Future<void> writeMenstruation(MenstruationWrite write) async {}
}

class _Vitals implements HealthVitalsPluginBridge {
  @override
  Future<bool> isAvailable() async => false;
  @override
  Future<bool> requestWritePermission() async => false;
  @override
  Future<void> writeBloodGlucose({required double mgdl, String? date}) async {}
  @override
  Future<void> writeBloodPressure({required double systolic, required double diastolic, String? date}) async {}
  @override
  Future<void> writeWeight({required double kg, String? date}) async {}
}

class _NoRows implements VitalsSource {
  @override
  Future<List<Map<String, dynamic>>> bloodPressure(String userId, String since) async => [];
  @override
  Future<List<Map<String, dynamic>>> glucose(String userId, String since) async => [];
  @override
  Future<List<Map<String, dynamic>>> weights(String userId, String since) async => [];
}

late LocalStore store;

HealthService service({String platform = 'ios', bool native = true}) => HealthService(
      store: store,
      native: native,
      platformName: platform,
      health: const MethodChannelHealth(),
      cycle: _Cycle(),
      vitals: _Vitals(),
      vitalsSource: _NoRows(),
    );

final DateTime today = DateTime.now();
final String todayKey = localDayKey(today);
DateTime localMidnight(int daysAgo) => DateTime(today.year, today.month, today.day - daysAgo);

Map<String, Object?> argsOf(MethodCall call) => Map<String, Object?>.from(call.arguments as Map);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    calls.clear();
    store = LocalStore.memory();
  });
  tearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(const MethodChannel(channel), null));

  group('Health channel (anacan/health)', () {
    test('sends the capacitor-health arguments and reads its answer shapes', () async {
      answer({
        'isHealthAvailable': (_) => {'available': true},
        'checkHealthPermissions': (_) => {
              'permissions': {'READ_STEPS': true, 'READ_WORKOUTS': false},
            },
        'requestHealthPermissions': (_) => {
              'permissions': {'READ_STEPS': true},
            },
        'queryAggregated': (_) => {
              'aggregatedData': [
                {'startDate': '2026-10-31T00:00', 'endDate': '2026-11-01T00:00', 'value': 10.0},
                'junk',
              ],
            },
        'queryWorkouts': (_) => {
              'workouts': [
                {'startDate': '2026-10-31T08:00:00Z', 'workoutType': 'WALKING', 'duration': 600},
              ],
              'errors': <String, String>{},
            },
        'openAppleHealthSettings': (_) => null,
      });
      const health = MethodChannelHealth();
      expect(await health.isHealthAvailable(), isTrue);
      expect(await health.checkHealthPermissions(['READ_STEPS', 'READ_WORKOUTS']), {'READ_STEPS': true, 'READ_WORKOUTS': false});
      expect(argsOf(calls.last), {
        'permissions': ['READ_STEPS', 'READ_WORKOUTS'],
      });
      expect(await health.requestHealthPermissions(['READ_STEPS']), {'READ_STEPS': true});
      final data = await health.queryAggregated(startDate: 's', endDate: 'e', dataType: 'steps');
      expect(argsOf(calls.last), {'startDate': 's', 'endDate': 'e', 'dataType': 'steps', 'bucket': 'day'});
      expect(data, [
        {'startDate': '2026-10-31T00:00', 'endDate': '2026-11-01T00:00', 'value': 10.0},
      ]);
      final workouts = await health.queryWorkouts(startDate: 's', endDate: 'e');
      expect(argsOf(calls.last),
          {'startDate': 's', 'endDate': 'e', 'includeHeartRate': false, 'includeRoute': false, 'includeSteps': false});
      expect(workouts.single['workoutType'], 'WALKING');
      await health.openAppleHealthSettings();
      expect(calls.last.method, 'openAppleHealthSettings');
    });

    test('a rejected or unimplemented call throws (HealthService turns it into an empty answer)', () async {
      answer({'checkHealthPermissions': (_) => throw PlatformException(code: 'not_implemented', message: 'not implemented')});
      const health = MethodChannelHealth();
      await expectLater(health.checkHealthPermissions(['READ_STEPS']), throwsA(isA<PlatformException>()));
      await expectLater(health.openHealthConnectSettings(), throwsA(isA<MissingPluginException>()));
      expect(await service(platform: 'android').isHealthAvailable(), isFalse);
    });

    test('an empty or missing answer reads as nothing granted / no data', () async {
      answer({
        'isHealthAvailable': (_) => null,
        'requestHealthPermissions': (_) => <String, Object?>{},
        'queryAggregated': (_) => {'aggregatedData': null},
        'queryWorkouts': (_) => <String, Object?>{},
      });
      const health = MethodChannelHealth();
      expect(await health.isHealthAvailable(), isFalse);
      expect(await health.requestHealthPermissions(['READ_STEPS']), isEmpty);
      expect(await health.queryAggregated(startDate: 's', endDate: 'e', dataType: 'steps'), isEmpty);
      expect(await health.queryWorkouts(startDate: 's', endDate: 'e'), isEmpty);
    });
  });

  group('bucket dates', () {
    test('reads every native date shape as the local calendar day', () {
      final midnight = localMidnight(2);
      final key = localDayKey(midnight);
      expect(bucketDayKey(midnight.millisecondsSinceEpoch.toDouble()), key); // iOS steps: epoch ms (Swift Double)
      expect(bucketDayKey(midnight.toUtc().toIso8601String()), key); // ISO with zone
      expect(bucketDayKey(midnight.toUtc().toIso8601String().replaceFirst('.000Z', 'Z')), key); // iOS mindfulness
      expect(bucketDayKey('${key}T00:00'), key); // Health Connect LocalDateTime
      expect(bucketDayKey(midnight), key);
      expect(bucketDayKey('nonsense'), isNull);
      expect(bucketDayKey(null), isNull);
    });

    test('fills a full window of local days, oldest first', () {
      final days = lastDays(7);
      expect(days, hasLength(7));
      expect(days[6], todayKey);
      final filled = fillDays([
        {'startDate': localMidnight(0).millisecondsSinceEpoch, 'value': 1234.6},
        {'startDate': localMidnight(0).millisecondsSinceEpoch, 'value': 10},
      ], 7);
      expect(filled, hasLength(7));
      expect((filled[6].date, filled[6].value), (todayKey, 1245));
      expect(filled.take(6).every((d) => d.value == 0), isTrue);
    });
  });

  group('iOS (Apple Health)', () {
    test('reads steps sent as epoch milliseconds (the device shape) and mindfulness seconds as minutes', () async {
      answer({
        'queryAggregated': (call) => {
              'aggregatedData': argsOf(call)['dataType'] == 'steps'
                  ? [
                      {
                        'startDate': localMidnight(1).millisecondsSinceEpoch.toDouble(),
                        'endDate': localMidnight(0).millisecondsSinceEpoch.toDouble(),
                        'value': 4321.0,
                      },
                      {
                        'startDate': localMidnight(0).millisecondsSinceEpoch.toDouble(),
                        'endDate': DateTime.now().millisecondsSinceEpoch.toDouble(),
                        'value': 1234.6,
                      },
                    ]
                  : [
                      {'startDate': localMidnight(0).toUtc().toIso8601String().replaceFirst('.000Z', 'Z'), 'value': 600.0},
                    ],
            },
      });
      final s = service();
      final steps = await s.getDailySteps(7);
      expect(steps, hasLength(7));
      expect((steps[6].date, steps[6].value), (todayKey, 1235));
      expect(steps[5].value, 4321);
      final mindful = await s.getDailyMindfulness(7);
      expect((mindful[6].date, mindful[6].value), (todayKey, 10));
      final first = argsOf(calls.first);
      expect(first['dataType'], 'steps');
      expect(first['bucket'], 'day');
      expect(first['startDate'], localMidnight(6).toUtc().toIso8601String());
      expect(first['endDate'], isA<String>());
      expect(DateTime.parse(first['startDate']! as String).isUtc, isTrue);
    });

    test('requests the iOS read set and marks the device connected', () async {
      answer({
        'requestHealthPermissions': (_) => {'permissions': <String, bool>{}},
      });
      final s = service();
      expect(await s.requestHealthPermissions(), isTrue);
      expect(callsOf('requestHealthPermissions'), 1);
      expect(argsOf(calls.last), {
        'permissions': ['READ_STEPS', 'READ_WORKOUTS', 'READ_MINDFULNESS'],
      });
      expect(s.isHealthConnected(), isTrue);
      expect(await s.getReadAccess(), isNull);
      s.disconnectHealth();
      expect(s.isHealthConnected(), isFalse);
    });

    test('does not mark iOS connected when authorization rejects', () async {
      answer({'requestHealthPermissions': (_) => throw PlatformException(code: 'health_error', message: 'Authorization failed: denied')});
      final s = service();
      expect(await s.requestHealthPermissions(), isFalse);
      expect(store.getItem(kHealthConnectedKey), isNull);
    });

    test('maps workouts newest first without heart rate, route or steps', () async {
      answer({
        'queryWorkouts': (_) => {
              'workouts': [
                {'startDate': '2026-09-01T10:00:00Z', 'endDate': '2026-09-01T10:20:00Z', 'workoutType': 'walking', 'duration': 1200.0, 'calories': 85.4, 'heartRate': [], 'route': []},
                {'startDate': '2026-09-02T10:00:00Z', 'endDate': '2026-09-02T10:30:00Z', 'workoutType': 'yoga', 'duration': 1800.0, 'calories': 0.0, 'heartRate': [], 'route': []},
              ],
              'errors': <String, String>{},
            },
        'openAppleHealthSettings': (_) => null,
      });
      final s = service();
      final workouts = await s.getRecentWorkouts(7);
      expect(workouts.map((w) => w.workoutType), ['yoga', 'walking']);
      expect((workouts[1].duration, workouts[1].calories), (1200.0, 85));
      expect(callsOf('queryWorkouts'), 1);
      final args = argsOf(calls.firstWhere((c) => c.method == 'queryWorkouts'));
      expect(args['startDate'], isA<String>());
      expect(args['endDate'], isA<String>());
      expect([args['includeHeartRate'], args['includeRoute'], args['includeSteps']], [false, false, false]);
      await s.openHealthSettings();
      expect(callsOf('openAppleHealthSettings'), 1);
    });
  });

  group('Android (Health Connect)', () {
    test('creates the Health Connect client before the first query and reads LocalDateTime buckets', () async {
      final yesterday = localDayKey(localMidnight(1));
      answer({
        'isHealthAvailable': (_) => {'available': true},
        'queryAggregated': (_) => {
              'aggregatedData': [
                {'startDate': '${yesterday}T00:00', 'endDate': '${todayKey}T00:00', 'value': 8000.0},
                {'startDate': '${todayKey}T00:00', 'endDate': '${todayKey}T13:05'},
              ],
            },
      });
      final s = service(platform: 'android');
      final steps = await s.getDailySteps(7);
      final order = calls.map((c) => c.method).toList();
      expect(order.indexOf('isHealthAvailable'), lessThan(order.indexOf('queryAggregated')));
      expect((steps[5].date, steps[5].value), (yesterday, 8000));
      expect(steps[6].value, 0);
      expect(await s.getDailyMindfulness(7), isEmpty);
      expect(callsOf('queryAggregated'), 1);
    });

    test('requests steps + exercise only and trusts the real grant result', () async {
      final grants = <Map<String, bool>>[
        {'READ_STEPS': false, 'READ_WORKOUTS': false},
        {'READ_STEPS': true, 'READ_WORKOUTS': false},
      ];
      answer({
        'isHealthAvailable': (_) => {'available': true},
        'requestHealthPermissions': (_) => {'permissions': grants.removeAt(0)},
        'checkHealthPermissions': (_) => {
              'permissions': {'READ_STEPS': true, 'READ_WORKOUTS': false},
            },
      });
      final s = service(platform: 'android');
      expect(await s.requestHealthPermissions(), isFalse);
      expect(s.isHealthConnected(), isFalse);
      expect(await s.requestHealthPermissions(), isTrue);
      expect(s.isHealthConnected(), isTrue);
      expect(argsOf(calls.lastWhere((c) => c.method == 'requestHealthPermissions')), {
        'permissions': ['READ_STEPS', 'READ_WORKOUTS'],
      });
      final access = await s.getReadAccess();
      expect((access?.steps, access?.workouts), (true, false));
    });

    test('reports Health Connect missing and offers the store/settings', () async {
      answer({
        'isHealthAvailable': (_) => {'available': false},
        'showHealthConnectInPlayStore': (_) => null,
      });
      final s = service(platform: 'android');
      expect(await s.isHealthAvailable(), isFalse);
      await s.installHealthConnect();
      expect(callsOf('showHealthConnectInPlayStore'), 1);
    });
  });

  group('web', () {
    test('never calls native health and masks persisted data', () async {
      answer({});
      store.setItem(kHealthConnectedKey, 'previous-release');
      final s = service(platform: 'web', native: false);
      expect(s.isNativeHealthPlatform(), isFalse);
      expect(s.readsSupported(), isFalse);
      expect(s.isHealthConnected(), isFalse);
      expect(await s.requestHealthPermissions(), isFalse);
      expect(await s.getDailySteps(), isEmpty);
      expect(await s.getRecentWorkouts(), isEmpty);
      expect(await s.isHealthAvailable(), isFalse);
      expect(calls, isEmpty);
    });
  });
}

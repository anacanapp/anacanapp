// Ported from: src/lib/health.ts, src/lib/healthCycle.ts, src/lib/healthVitals.ts, src/hooks/useHealthData.ts
//
// [HealthService] has the exact function set of the three TS modules. The native SDKs are behind three plugin
// bridges with the method names of the Capacitor plugins (capacitor-health `Health`, `HealthCycle`,
// `HealthVitals`); the native/health agent implements them (HealthKit / Health Connect). LocalStore keys are the
// same as the WebView's: anacan_health_connected, anacan_health_cycle_write, anacan_health_vitals_write,
// anacan_health_vitals_synced:<uid>, anacan_health_vitals_last:<uid>.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart';
import '../../../domain/cycle/health_cycle.dart' as hc;
import '../../../domain/cycle/period_flow.dart' show PeriodFlowAction;
import '../../../state/state.dart';

const String kHealthConnectedKey = 'anacan_health_connected';
const String kCycleWriteKey = hc.cycleWriteKey;
const String kVitalsWriteKey = 'anacan_health_vitals_write';
const String _watermarkPrefix = 'anacan_health_vitals_synced:';
const String _lastSyncPrefix = 'anacan_health_vitals_last:';
const int kBackfillDays = 30;
const int _maxPerSync = 200;

const List<String> kIosHealthPermissions = ['READ_STEPS', 'READ_WORKOUTS', 'READ_MINDFULNESS'];
const List<String> kAndroidHealthPermissions = ['READ_STEPS', 'READ_WORKOUTS'];

// ── Native plugin bridges ─────────────────────────────────────────────────────────────────────────────────────

/// capacitor-health `Health` plugin.
abstract interface class HealthPluginBridge {
  Future<bool> isHealthAvailable();
  Future<Map<String, bool>> checkHealthPermissions(List<String> permissions);
  Future<Map<String, bool>> requestHealthPermissions(List<String> permissions);

  /// `queryAggregated({startDate, endDate, dataType, bucket: 'day'})` → `aggregatedData` (`{startDate, value}`).
  Future<List<Map<String, Object?>>> queryAggregated({required String startDate, required String endDate, required String dataType, String bucket = 'day'});

  /// `queryWorkouts({startDate, endDate, includeHeartRate: false, includeRoute: false, includeSteps: false})`.
  Future<List<Map<String, Object?>>> queryWorkouts({required String startDate, required String endDate});
  Future<void> openAppleHealthSettings();
  Future<void> openHealthConnectSettings();
  Future<void> showHealthConnectInPlayStore();
}

/// `HealthCycle` plugin.
abstract interface class HealthCyclePluginBridge implements hc.HealthCycleBridge {
  Future<bool> requestWritePermission();
}

/// `HealthVitals` plugin.
abstract interface class HealthVitalsPluginBridge {
  Future<bool> isAvailable();
  Future<bool> requestWritePermission();
  Future<void> writeWeight({required double kg, String? date});
  Future<void> writeBloodPressure({required double systolic, required double diastolic, String? date});
  Future<void> writeBloodGlucose({required double mgdl, String? date});
}

/// Unwired bridges behave like an old native build without the plugins (every call throws → unavailable).
class MissingHealthPlugins implements HealthPluginBridge, HealthCyclePluginBridge {
  const MissingHealthPlugins();
  Never _missing() => throw UnsupportedError('health plugin not registered');
  @override
  Future<bool> isHealthAvailable() async => _missing();
  @override
  Future<Map<String, bool>> checkHealthPermissions(List<String> permissions) async => _missing();
  @override
  Future<Map<String, bool>> requestHealthPermissions(List<String> permissions) async => _missing();
  @override
  Future<List<Map<String, Object?>>> queryAggregated({required String startDate, required String endDate, required String dataType, String bucket = 'day'}) async => _missing();
  @override
  Future<List<Map<String, Object?>>> queryWorkouts({required String startDate, required String endDate}) async => _missing();
  @override
  Future<void> openAppleHealthSettings() async => _missing();
  @override
  Future<void> openHealthConnectSettings() async => _missing();
  @override
  Future<void> showHealthConnectInPlayStore() async => _missing();
  @override
  Future<({bool available, int? apiVersion})> isAvailable() async => _missing();
  @override
  Future<void> writeMenstruation(hc.MenstruationWrite write) async => _missing();
  @override
  Future<bool> requestWritePermission() async => _missing();
}

final healthPluginBridgeProvider = Provider<HealthPluginBridge>((ref) => const MissingHealthPlugins());
final healthCyclePluginProvider = Provider<HealthCyclePluginBridge>((ref) => const MissingHealthPlugins());

/// The `HealthVitals` plugin; `isAvailable` of its interface is distinct from `HealthCycle.isAvailable`.
final healthVitalsPluginProvider = Provider<HealthVitalsPluginBridge>((ref) => const _VitalsMissing());

class _VitalsMissing implements HealthVitalsPluginBridge {
  const _VitalsMissing();
  @override
  Future<bool> isAvailable() async => throw UnsupportedError('HealthVitals not registered');
  @override
  Future<bool> requestWritePermission() async => throw UnsupportedError('HealthVitals not registered');
  @override
  Future<void> writeBloodGlucose({required double mgdl, String? date}) async => throw UnsupportedError('HealthVitals not registered');
  @override
  Future<void> writeBloodPressure({required double systolic, required double diastolic, String? date}) async => throw UnsupportedError('HealthVitals not registered');
  @override
  Future<void> writeWeight({required double kg, String? date}) async => throw UnsupportedError('HealthVitals not registered');
}

/// `Capacitor.isNativePlatform()` + `getPlatform()` → 'ios' | 'android' | 'web'.
final healthRuntimePlatformProvider = Provider<({bool native, String platform})>((ref) => (
      native: !kIsWeb,
      platform: switch (defaultTargetPlatform) {
        TargetPlatform.iOS => 'ios',
        TargetPlatform.android => 'android',
        _ => 'web',
      },
    ));

// ── Pure helpers (health.ts) ──────────────────────────────────────────────────────────────────────────────────

String _pad(int n) => n.toString().padLeft(2, '0');

/// Local calendar day of a date (never UTC).
String localDayKey(DateTime date) => '${date.year}-${_pad(date.month)}-${_pad(date.day)}';

final RegExp _localDateTime = RegExp(r'^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$');

/// Bucket starts: epoch ms (iOS steps), ISO timestamp (iOS mindfulness), zone-less local date-time (Health Connect).
String? bucketDayKey(Object? value) {
  if (value is num && value.isFinite) return localDayKey(DateTime.fromMillisecondsSinceEpoch(value.toInt()));
  if (value is String) {
    if (_localDateTime.hasMatch(value)) return value.substring(0, 10);
    final parsed = DateTime.tryParse(value);
    return parsed == null ? null : localDayKey(parsed.toLocal());
  }
  if (value is DateTime) return localDayKey(value);
  return null;
}

/// The last [days] local days, oldest first.
List<String> lastDays(int days, [DateTime? now]) {
  final n = now ?? DateTime.now();
  return [for (var i = days - 1; i >= 0; i--) localDayKey(DateTime(n.year, n.month, n.day - i, 12))];
}

class DailyHealthSample {
  const DailyHealthSample(this.date, this.value);
  final String date;
  final int value;
}

/// Sums raw buckets per local day; every day of the window (missing days 0). JS `Math.round` (half up).
List<DailyHealthSample> fillDays(List<Map<String, Object?>> raw, int days, {double scale = 1, DateTime? now}) {
  final totals = <String, double>{};
  for (final s in raw) {
    final key = bucketDayKey(s['startDate']);
    final v = s['value'];
    final value = v is num && v > 0 ? v.toDouble() : 0.0;
    if (key != null) totals[key] = (totals[key] ?? 0) + value;
  }
  return [for (final d in lastDays(days, now)) DailyHealthSample(d, ((totals[d] ?? 0) * scale + 0.5).floor())];
}

class HealthWorkout {
  const HealthWorkout({required this.startDate, required this.endDate, required this.workoutType, required this.duration, required this.calories});
  final String startDate;
  final String endDate;
  final String workoutType;

  /// seconds
  final double duration;
  final int calories;
}

class HealthReadAccess {
  const HealthReadAccess({required this.steps, required this.workouts});
  final bool steps;
  final bool workouts;
}

/// `weightMoment(entryDate, createdAt)`: the save time on that day, otherwise noon of that day (UTC ISO).
String weightMoment(String entryDate, String createdAt, {DateTime? now}) {
  final created = DateTime.tryParse(createdAt)?.toLocal();
  final parts = entryDate.length >= 10 ? entryDate.substring(0, 10).split('-').map(int.tryParse).toList() : const <int?>[];
  final y = parts.isNotEmpty ? parts[0] : null;
  final m = parts.length > 1 ? parts[1] : null;
  final d = parts.length > 2 ? parts[2] : null;
  String isoOf(DateTime t) => t.toUtc().toIso8601String().replaceFirstMapped(RegExp(r'\.(\d{3})\d*Z$'), (mm) => '.${mm[1]}Z');
  if (y == null || m == null || d == null || y == 0 || m == 0 || d == 0) return isoOf(created ?? now ?? DateTime.now());
  if (created != null && created.year == y && created.month == m && created.day == d) return isoOf(created);
  return isoOf(DateTime(y, m, d, 12));
}

class VitalsSyncResult {
  const VitalsSyncResult({required this.written, required this.failed, required this.skipped});
  final int written;
  final int failed;
  final bool skipped;
}

/// The vitals tables read by `loadPending` (`weight_entries`, `blood_pressure_logs`, `blood_sugar_logs`), rows with
/// `created_at > since`, oldest first, at most 200.
abstract interface class VitalsSource {
  Future<List<Map<String, dynamic>>> weights(String userId, String since);
  Future<List<Map<String, dynamic>>> bloodPressure(String userId, String since);
  Future<List<Map<String, dynamic>>> glucose(String userId, String since);
}

class SupabaseVitalsSource implements VitalsSource {
  SupabaseVitalsSource(this._db);
  final Db _db;
  Future<List<Map<String, dynamic>>> _q(String table, String cols, String userId, String since) async =>
      asRows(await _db.from(table).select(cols).eq('user_id', userId).gt('created_at', since).order('created_at', ascending: true).limit(_maxPerSync));
  @override
  Future<List<Map<String, dynamic>>> weights(String userId, String since) => _q('weight_entries', 'weight, entry_date, created_at', userId, since);
  @override
  Future<List<Map<String, dynamic>>> bloodPressure(String userId, String since) => _q('blood_pressure_logs', 'systolic, diastolic, measured_at, created_at', userId, since);
  @override
  Future<List<Map<String, dynamic>>> glucose(String userId, String since) => _q('blood_sugar_logs', 'reading_value, logged_at, created_at', userId, since);
}

final vitalsSourceProvider = Provider<VitalsSource>((ref) => SupabaseVitalsSource(ref.watch(dbProvider)));

// ── HealthService ─────────────────────────────────────────────────────────────────────────────────────────────

class HealthService {
  HealthService({
    required this.store,
    required this.native,
    required this.platformName,
    required this.health,
    required this.cycle,
    required this.vitals,
    required this.vitalsSource,
    int Function()? now,
  }) : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  final LocalStore store;
  final bool native;

  /// `Capacitor.getPlatform()`.
  final String platformName;
  final HealthPluginBridge health;
  final HealthCyclePluginBridge cycle;
  final HealthVitalsPluginBridge vitals;
  final VitalsSource vitalsSource;
  final int Function() _now;
  Future<bool>? _androidClientReady;
  Future<void> _pendingCycleWrites = Future<void>.value();
  Future<VitalsSyncResult>? _running;

  // health.ts
  /// 'ios' | 'android' | null.
  String? healthPlatform() => !native ? null : (platformName == 'ios' || platformName == 'android' ? platformName : null);
  bool isNativeHealthPlatform() => healthPlatform() != null;
  bool readsSupported() => healthPlatform() != null;
  bool mindfulnessSupported() => healthPlatform() == 'ios';

  Future<bool> isHealthAvailable() async {
    if (!readsSupported()) return false;
    try {
      return await health.isHealthAvailable();
    } catch (_) {
      return false;
    }
  }

  Future<bool> _ready() {
    if (healthPlatform() != 'android') return Future<bool>.value(readsSupported());
    return _androidClientReady ??= isHealthAvailable().then((ok) {
      if (!ok) _androidClientReady = null;
      return ok;
    });
  }

  Future<HealthReadAccess?> getReadAccess() async {
    if (healthPlatform() != 'android' || !await _ready()) return null;
    try {
      final p = await health.checkHealthPermissions(kAndroidHealthPermissions);
      return HealthReadAccess(steps: p['READ_STEPS'] == true, workouts: p['READ_WORKOUTS'] == true);
    } catch (_) {
      return null;
    }
  }

  Future<bool> requestHealthPermissions() async {
    final platform = healthPlatform();
    if (platform == null || !await _ready()) return false;
    try {
      final granted = await health.requestHealthPermissions(platform == 'ios' ? kIosHealthPermissions : kAndroidHealthPermissions);
      if (platform == 'android' && granted['READ_STEPS'] != true && granted['READ_WORKOUTS'] != true) return false;
      store.setItem(kHealthConnectedKey, '${_now()}');
      return true;
    } catch (_) {
      return false;
    }
  }

  bool isHealthConnected() => readsSupported() && (store.getItem(kHealthConnectedKey) ?? '').isNotEmpty;
  void disconnectHealth() => store.removeItem(kHealthConnectedKey);

  Future<List<DailyHealthSample>> _queryDaily(String dataType, int days) async {
    if (!await _ready()) return const <DailyHealthSample>[];
    if (dataType == 'mindfulness' && !mindfulnessSupported()) return const <DailyHealthSample>[];
    final end = DateTime.fromMillisecondsSinceEpoch(_now());
    final start = DateTime(end.year, end.month, end.day - (days - 1));
    final data = await health.queryAggregated(startDate: start.toUtc().toIso8601String(), endDate: end.toUtc().toIso8601String(), dataType: dataType);
    return fillDays(data, days, scale: dataType == 'mindfulness' ? 1 / 60 : 1, now: end);
  }

  Future<List<DailyHealthSample>> getDailySteps([int days = 7]) => _queryDaily('steps', days);
  Future<List<DailyHealthSample>> getDailyMindfulness([int days = 7]) => _queryDaily('mindfulness', days);

  Future<List<HealthWorkout>> getRecentWorkouts([int days = 7]) async {
    if (!await _ready()) return const <HealthWorkout>[];
    final end = DateTime.fromMillisecondsSinceEpoch(_now());
    final start = DateTime(end.year, end.month, end.day - (days - 1));
    final raw = await health.queryWorkouts(startDate: start.toUtc().toIso8601String(), endDate: end.toUtc().toIso8601String());
    final list = [
      for (final w in raw)
        HealthWorkout(
          startDate: '${w['startDate'] ?? ''}',
          endDate: '${w['endDate'] ?? ''}',
          workoutType: (w['workoutType'] as String?)?.isNotEmpty == true ? w['workoutType'] as String : 'workout',
          duration: (w['duration'] is num ? (w['duration'] as num).toDouble() : double.tryParse('${w['duration']}')) ?? 0,
          calories: ((w['calories'] is num ? (w['calories'] as num).toDouble() : double.tryParse('${w['calories']}')) ?? 0).round(),
        ),
    ];
    int ms(String s) => DateTime.tryParse(s)?.millisecondsSinceEpoch ?? 0;
    list.sort((a, b) => ms(b.startDate).compareTo(ms(a.startDate)));
    return list;
  }

  Future<void> openHealthSettings() async {
    final platform = healthPlatform();
    if (platform == null) return;
    try {
      if (platform == 'ios') {
        await health.openAppleHealthSettings();
      } else {
        await _ready();
        await health.openHealthConnectSettings();
      }
    } catch (_) {}
  }

  Future<void> installHealthConnect() async {
    try {
      await health.showHealthConnectInPlayStore();
    } catch (_) {}
  }

  // healthCycle.ts
  bool isCycleWriteEnabled() => hc.isCycleWriteEnabledValue(store.getItem(kCycleWriteKey));
  void setCycleWriteEnabled(bool on) => on ? store.setItem(kCycleWriteKey, '1') : store.removeItem(kCycleWriteKey);

  Future<bool> isCycleWriteAvailable() async {
    if (!native) return false;
    try {
      final a = await cycle.isAvailable();
      return hc.isCycleWriteSupported(available: a.available, apiVersion: a.apiVersion);
    } catch (_) {
      return false;
    }
  }

  Future<bool> requestCycleWritePermission() async {
    try {
      return await cycle.requestWritePermission();
    } catch (_) {
      return false;
    }
  }

  /// Writes are serialized like the TS `pendingWrites` chain.
  Future<bool> syncPeriodDaysToHealth(List<({String date, PeriodFlowAction flow, bool cycleStart})> days) {
    final work = _pendingCycleWrites.then((_) => hc.syncPeriodDaysToHealth(
          [for (final d in days) hc.PeriodDay(date: d.date, flow: d.flow, cycleStart: d.cycleStart)],
          enabled: isCycleWriteEnabled(),
          isNative: native,
          bridge: cycle,
        ));
    _pendingCycleWrites = work.then((_) {}, onError: (Object _) {});
    return work;
  }

  // healthVitals.ts
  bool _writesSupported() => native && (platformName == 'ios' || platformName == 'android');
  bool isVitalsWriteEnabled() => _writesSupported() && store.getItem(kVitalsWriteKey) == '1';
  void setVitalsWriteEnabled(bool on) => on && _writesSupported() ? store.setItem(kVitalsWriteKey, '1') : store.removeItem(kVitalsWriteKey);

  Future<bool> isVitalsWriteAvailable() async {
    if (!_writesSupported()) return false;
    try {
      return await vitals.isAvailable();
    } catch (_) {
      return false;
    }
  }

  Future<bool> requestVitalsWritePermission() async {
    if (!_writesSupported()) return false;
    try {
      return await vitals.requestWritePermission();
    } catch (_) {
      return false;
    }
  }

  Map<String, String> _readWatermarks(String userId) {
    final raw = store.readJson(_watermarkPrefix + userId);
    return raw is Map ? {for (final e in raw.entries) if (e.value is String) '${e.key}': e.value as String} : <String, String>{};
  }

  int? getLastVitalsSync(String userId) {
    final raw = store.getItem(_lastSyncPrefix + userId);
    final n = raw == null ? null : num.tryParse(raw);
    return n == null || n == 0 ? null : n.toInt();
  }

  /// UTC with milliseconds (`…T10:00:00.000Z`).
  String _iso(String? value, String fallback) {
    final parsed = DateTime.tryParse(value?.isNotEmpty == true ? value! : fallback) ?? DateTime.fromMillisecondsSinceEpoch(_now());
    return parsed.toUtc().toIso8601String().replaceFirstMapped(RegExp(r'\.(\d{3})\d*Z$'), (m) => '.${m[1]}Z').replaceFirstMapped(RegExp(r':(\d{2})Z$'), (m) => ':${m[1]}.000Z');
  }

  Future<VitalsSyncResult> syncVitalsToHealth(String? userId) {
    if (userId == null || userId.isEmpty || !isVitalsWriteEnabled()) return Future.value(const VitalsSyncResult(written: 0, failed: 0, skipped: true));
    final running = _running;
    if (running != null) return running.then((_) => syncVitalsToHealth(userId));
    final run = _run(userId);
    _running = run;
    return run.whenComplete(() => _running = null);
  }

  Future<VitalsSyncResult> _run(String userId) async {
    if (!await isVitalsWriteAvailable()) return const VitalsSyncResult(written: 0, failed: 0, skipped: true);
    final marks = _readWatermarks(userId);
    final floor = DateTime.fromMillisecondsSinceEpoch(_now() - kBackfillDays * 86400000).toUtc().toIso8601String();
    String since(String kind) => marks[kind] != null && marks[kind]!.compareTo(floor) > 0 ? marks[kind]! : floor;
    final results = await Future.wait([vitalsSource.weights(userId, since('weight')), vitalsSource.bloodPressure(userId, since('bp')), vitalsSource.glucose(userId, since('glucose'))]);
    final pending = <({String kind, String createdAt, Future<void> Function() write})>[];
    double numOf(Object? v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
    for (final row in results[0]) {
      final kg = numOf(row['weight']);
      if (kg > 0 && kg < 400) {
        pending.add((kind: 'weight', createdAt: '${row['created_at']}', write: () => vitals.writeWeight(kg: kg, date: weightMoment('${row['entry_date']}', '${row['created_at']}'))));
      }
    }
    for (final row in results[1]) {
      final sys = numOf(row['systolic']);
      final dia = numOf(row['diastolic']);
      if (sys > 0 && dia > 0) {
        pending.add((kind: 'bp', createdAt: '${row['created_at']}', write: () => vitals.writeBloodPressure(systolic: sys, diastolic: dia, date: _iso(row['measured_at'] as String?, '${row['created_at']}'))));
      }
    }
    for (final row in results[2]) {
      final mgdl = numOf(row['reading_value']);
      if (mgdl > 0 && mgdl < 1000 && row['created_at'] != null) {
        pending.add((kind: 'glucose', createdAt: '${row['created_at']}', write: () => vitals.writeBloodGlucose(mgdl: mgdl, date: _iso(row['logged_at'] as String?, '${row['created_at']}'))));
      }
    }
    var written = 0;
    var failed = 0;
    final blocked = <String>{};
    for (final item in pending) {
      if (blocked.contains(item.kind)) continue;
      try {
        await item.write();
        marks[item.kind] = item.createdAt;
        written++;
      } catch (_) {
        failed++;
        blocked.add(item.kind);
      }
    }
    store.setItem(_watermarkPrefix + userId, jsonEncode(marks));
    if (failed == 0) store.setItem(_lastSyncPrefix + userId, '${_now()}');
    return VitalsSyncResult(written: written, failed: failed, skipped: false);
  }

  void syncVitalsInBackground(String? userId) {
    if (!isVitalsWriteEnabled()) return;
    unawaited(syncVitalsToHealth(userId).then((_) {}, onError: (Object _) {}));
  }
}

final healthServiceProvider = Provider<HealthService>((ref) {
  final rt = ref.watch(healthRuntimePlatformProvider);
  return HealthService(
    store: ref.watch(localStoreProvider),
    native: rt.native,
    platformName: rt.platform,
    health: ref.watch(healthPluginBridgeProvider),
    cycle: ref.watch(healthCyclePluginProvider),
    vitals: ref.watch(healthVitalsPluginProvider),
    vitalsSource: ref.watch(vitalsSourceProvider),
  );
});

// ── useHealthData.ts ──────────────────────────────────────────────────────────────────────────────────────────

final healthAvailabilityQuery = queryProvider<bool>((ref) {
  final s = ref.watch(healthServiceProvider);
  return QueryOptions<bool>(queryKey: const ['health-available'], enabled: s.readsSupported(), staleTime: const Duration(seconds: 60), queryFn: (_) => s.isHealthAvailable());
});

/// The screen's `connected` state (`useState(isHealthConnected())`), shared with the read queries.
class HealthConnected extends Notifier<bool> {
  @override
  bool build() => ref.watch(healthServiceProvider).isHealthConnected();
  void set(bool v) => state = v;
}

final healthConnectedProvider = NotifierProvider<HealthConnected, bool>(HealthConnected.new);

final healthReadAccessQuery = queryProvider<HealthReadAccess?>((ref) {
  final s = ref.watch(healthServiceProvider);
  final connected = ref.watch(healthConnectedProvider);
  return QueryOptions<HealthReadAccess?>(
    queryKey: const ['health-read-access'],
    enabled: s.readsSupported() && connected,
    staleTime: Duration.zero,
    refetchOnWindowFocus: RefetchOn.always,
    meta: const {'persist': false},
    queryFn: (_) => s.getReadAccess(),
  );
});

typedef HealthDaily = ({List<DailyHealthSample> steps, List<DailyHealthSample> mindfulness});

final healthDailyQuery = queryProviderFamily<HealthDaily, int>((ref, days) {
  final s = ref.watch(healthServiceProvider);
  final arg = (days: days, connected: ref.watch(healthConnectedProvider));
  return QueryOptions<HealthDaily>(
    queryKey: ['health-daily', arg.days],
    enabled: s.readsSupported() && arg.connected,
    staleTime: const Duration(minutes: 2),
    retry: retryTimes(1),
    refetchOnWindowFocus: RefetchOn.always,
    meta: const {'persist': false},
    queryFn: (_) async {
      final r = await Future.wait([s.getDailySteps(arg.days), s.getDailyMindfulness(arg.days)]);
      return (steps: r[0], mindfulness: r[1]);
    },
  );
});

final healthWorkoutsQuery = queryProviderFamily<List<HealthWorkout>, int>((ref, days) {
  final s = ref.watch(healthServiceProvider);
  final arg = (days: days, connected: ref.watch(healthConnectedProvider));
  return QueryOptions<List<HealthWorkout>>(
    queryKey: ['health-workouts', arg.days],
    enabled: s.readsSupported() && arg.connected,
    staleTime: const Duration(minutes: 5),
    retry: retryTimes(1),
    meta: const {'persist': false},
    queryFn: (_) => s.getRecentWorkouts(arg.days),
  );
});

final healthCycleWriteAvailableQuery = queryProvider<bool>((ref) {
  final s = ref.watch(healthServiceProvider);
  return QueryOptions<bool>(
    queryKey: const ['health-cycle-write-available'],
    enabled: s.healthPlatform() != null,
    staleTime: const Duration(seconds: 60),
    queryFn: (_) => s.isCycleWriteAvailable(),
  );
});

// Ported from: src/hooks/useMealLogs.ts, src/hooks/useVitamins.ts (useVitamins)
//
// `meal_logs` of the user (latest 100, live updates), today's meals in local time, and the vitamins of a week / stage.
// Meals are queued in the offline outbox first.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Row, Rows, mapRowsTranslation;
import '../../../core/offline/offline_outbox.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../domain/dates/local_date.dart';
import '../../../state/user_store.dart';
import '../health_common/health_common.dart';
import '../health_common/health_db.dart';

@immutable
class MealLogsState {
  const MealLogsState({this.logs = const [], this.todayLogs = const [], this.loading = true});
  final Rows logs;
  final Rows todayLogs;
  final bool loading;

  MealLogsState copyWith({Rows? logs, Rows? todayLogs, bool? loading}) =>
      MealLogsState(logs: logs ?? this.logs, todayLogs: todayLogs ?? this.todayLogs, loading: loading ?? this.loading);

  /// `getTodayStats()`.
  ({num totalCalories, Map<String, num> mealCalories, int totalMeals}) todayStats() {
    num cal(Row l) => (l['calories'] as num?) ?? 0;
    num of(String type) => todayLogs.where((l) => l['meal_type'] == type).fold<num>(0, (s, l) => s + cal(l));
    return (
      totalCalories: todayLogs.fold<num>(0, (s, l) => s + cal(l)),
      mealCalories: {'breakfast': of('breakfast'), 'lunch': of('lunch'), 'dinner': of('dinner'), 'snack': of('snack')},
      totalMeals: todayLogs.length,
    );
  }

  /// `getMealsByType(mealType)`.
  Rows mealsByType(String type) => todayLogs.where((l) => l['meal_type'] == type).toList();
}

String _localDay(Object? iso) {
  final d = DateTime.tryParse('$iso')?.toLocal();
  return d == null ? '' : localDateKey(d);
}

final mealLogsProvider = NotifierProvider.autoDispose<MealLogsController, MealLogsState>(MealLogsController.new);

class MealLogsController extends Notifier<MealLogsState> {
  String? _userId;

  @override
  MealLogsState build() {
    final userId = ref.watch(healthUserIdProvider);
    _userId = userId;
    if (userId == null) return const MealLogsState(loading: false);
    final outbox = ref.watch(offlineOutboxProvider);
    final unsubscribe = outbox.subscribe((change) {
      if (change.userId == userId && change.sentTables.contains('meal_logs') && ref.mounted) unawaited(fetchLogs());
    });
    final release = outbox.retainUser(userId);
    ref.onDispose(() {
      unsubscribe();
      release();
    });
    ref.read(healthRealtimeProvider).subscribe(ref, channelPrefix: 'meal_logs_changes', table: 'meal_logs', filter: 'user_id=eq.$userId', onChange: () {
      if (ref.mounted) unawaited(fetchLogs());
    });
    Future.microtask(fetchLogs);
    return const MealLogsState();
  }

  Future<void> fetchLogs() async {
    final userId = _userId;
    if (!ref.mounted) return;
    if (userId == null) {
      state = state.copyWith(loading: false);
      return;
    }
    try {
      final data = await ref.read(healthDbProvider).select(HQuery('meal_logs',
          filters: [eqF('user_id', userId)], order: const [(column: 'logged_at', ascending: false)], limit: 100));
      if (!ref.mounted) return;
      final today = todayKey();
      state = state.copyWith(logs: data, todayLogs: data.where((l) => _localDay(l['logged_at']) == today).toList(), loading: false);
    } catch (_) {
      if (ref.mounted) state = state.copyWith(loading: false);
    }
  }

  /// `addMealLog(log)`: `{data, error}`.
  Future<({Row? data, Object? error})> addMealLog({required String mealType, required String foodName, required num calories, String? portion, String? notes}) async {
    final userId = _userId;
    if (userId == null) return (data: null, error: 'No user logged in');
    final outcome = await ref.read(offlineOutboxProvider).saveWithOutbox(userId, 'meal_logs', {
      'meal_type': mealType,
      'food_name': foodName,
      'calories': calories,
      'portion': ?portion,
      'notes': ?notes,
      'user_id': userId,
      'logged_at': DateTime.now().toUtc().toIso8601String(),
    });
    if (outcome.status == SaveStatus.error) return (data: null, error: outcome.error);
    final saved = Map<String, dynamic>.from(outcome.data ?? const {});
    if (outcome.status == SaveStatus.saved) {
      await fetchLogs();
    } else if (ref.mounted) {
      // Optimistic while queued offline.
      state = state.copyWith(
        logs: [saved, ...state.logs.where((l) => l['id'] != saved['id'])],
        todayLogs: [saved, ...state.todayLogs.where((l) => l['id'] != saved['id'])],
      );
    }
    return (data: saved, error: null);
  }

  /// `deleteMealLog(id)`.
  Future<Object?> deleteMealLog(String id) async {
    final userId = _userId;
    if (userId == null) return 'No user logged in';
    try {
      await ref.read(healthDbProvider).delete('meal_logs', [eqF('id', id), eqF('user_id', userId)]);
      await fetchLogs();
      return null;
    } catch (error) {
      return error;
    }
  }
}

// ── useVitamins(weekNumber, lifeStage) ──

/// The queryFn body of `useVitamins` after the fetch: translation, the B-complex dosage patch, and in pregnancy the
/// week range / trimester filter.
Rows shapeVitamins(Rows data, String language, int? weekNumber, String? lifeStage) {
  final mapped = mapRowsTranslation(data, language, const ['name', 'description', 'benefits', 'food_sources', 'dosage', 'importance']);
  // Fix a DB translation error of the Vitamin B Complex dosage.
  final patched = [
    for (final v in mapped)
      (v['name'] == 'Vitamin B Complex' || v['name_az'] == 'B kompleks vitamini') && v['dosage'] is String && (v['dosage'] as String).contains('hata')
          ? {...v, 'dosage': 'B1: 1.4mg, B2: 1.6mg, B6: 2mg/day'}
          : v,
  ];
  if (weekNumber == null || weekNumber == 0 || lifeStage != 'bump') return patched;
  final trimester = weekNumber <= 13 ? 1 : weekNumber <= 26 ? 2 : 3;
  return patched.where((v) {
    final start = v['week_start'], end = v['week_end'];
    if (start is num && end is num) return weekNumber >= start && weekNumber <= end;
    final tri = v['trimester'];
    if (tri is List && tri.isNotEmpty) return tri.contains(trimester);
    return true;
  }).toList();
}

/// `useVitamins(weekNumber, lifeStage)` → `['vitamins', weekNumber, lifeStage, language]` (5 min).
final vitaminsQuery = queryProviderFamily<Rows, ({int? week, String? lifeStage})>((ref, arg) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['vitamins', arg.week, arg.lifeStage, language],
    staleTime: const Duration(minutes: 5),
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      final data = await db.select(HQuery('vitamins', filters: [
        const (column: 'is_active', op: 'eq', value: true),
        if (arg.lifeStage != null && arg.lifeStage!.isNotEmpty) eqF('life_stage', arg.lifeStage),
      ], order: const [(column: 'sort_order', ascending: true)]));
      return shapeVitamins(data, language, arg.week, arg.lifeStage);
    },
  );
}, name: 'vitaminsQuery');

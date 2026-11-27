// Ported from: src/hooks/useExerciseLogs.ts
//
// `exercise_logs` of the user (latest 50): today's completions, today's stats and the day streak. Completions are
// queued in the offline outbox first and shown at once.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/data/data.dart' show Row, Rows;
import '../../../core/offline/offline_outbox.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../domain/dates/local_date.dart';
import '../health_common/health_common.dart';
import '../health_common/health_db.dart';

@immutable
class ExerciseLogsState {
  const ExerciseLogsState({this.logs = const [], this.todayLogs = const [], this.loading = true});
  final Rows logs;
  final Rows todayLogs;
  final bool loading;

  ExerciseLogsState copyWith({Rows? logs, Rows? todayLogs, bool? loading}) =>
      ExerciseLogsState(logs: logs ?? this.logs, todayLogs: todayLogs ?? this.todayLogs, loading: loading ?? this.loading);

  bool isCompletedToday(String exerciseId) => todayLogs.any((l) => l['exercise_id'] == exerciseId);

  ({int completedCount, num totalCalories, num totalMinutes}) todayStats() => (
        completedCount: todayLogs.length,
        totalCalories: todayLogs.fold<num>(0, (s, l) => s + ((l['calories_burned'] as num?) ?? 0)),
        totalMinutes: todayLogs.fold<num>(0, (s, l) => s + ((l['duration_minutes'] as num?) ?? 0)),
      );
}

/// Local calendar day of a `completed_at` timestamp.
String _localDay(Object? iso) {
  final d = DateTime.tryParse('$iso')?.toLocal();
  return d == null ? '' : localDateKey(d);
}

/// `getStreak()`: consecutive days with a completion, ending today or yesterday (up to 30 days back).
///
/// The React loop counted a run that ends yesterday one day too long (`if (streak === 0 && i === 1) streak = 1;
/// streak++` gives 2 for a single log yesterday); the port counts each day once.
int exerciseStreak(Rows logs, [DateTime? now]) {
  if (logs.isEmpty) return 0;
  final n = now ?? DateTime.now();
  final days = {for (final l in logs) _localDay(l['completed_at'])};
  final today = DateTime(n.year, n.month, n.day);
  var streak = days.contains(localDateKey(today)) ? 1 : 0;
  for (var i = 1; i <= 30; i++) {
    if (days.contains(localDateKey(DateTime(today.year, today.month, today.day - i)))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

final exerciseLogsProvider = NotifierProvider.autoDispose<ExerciseLogsController, ExerciseLogsState>(ExerciseLogsController.new);

class ExerciseLogsController extends Notifier<ExerciseLogsState> {
  String? _userId;

  @override
  ExerciseLogsState build() {
    final userId = ref.watch(healthUserIdProvider);
    _userId = userId;
    if (userId != null) {
      final outbox = ref.watch(offlineOutboxProvider);
      final unsubscribe = outbox.subscribe((change) {
        if (change.userId == userId && change.sentTables.contains('exercise_logs') && ref.mounted) unawaited(fetchLogs());
      });
      final release = outbox.retainUser(userId);
      ref.onDispose(() {
        unsubscribe();
        release();
      });
      Future.microtask(fetchLogs);
    }
    return const ExerciseLogsState();
  }

  Future<void> fetchLogs() async {
    final userId = _userId;
    if (userId == null || !ref.mounted) return;
    try {
      final today = todayKey();
      final all = await ref.read(healthDbProvider).select(HQuery('exercise_logs',
          filters: [eqF('user_id', userId)], order: const [(column: 'completed_at', ascending: false)], limit: 50));
      if (!ref.mounted) return;
      state = state.copyWith(logs: all, todayLogs: all.where((l) => _localDay(l['completed_at']) == today).toList(), loading: false);
    } catch (_) {
      if (ref.mounted) state = state.copyWith(loading: false);
    }
  }

  /// `addLog(exerciseId, exerciseName, durationMinutes, caloriesBurned)`.
  Future<void> addLog(String exerciseId, String exerciseName, num durationMinutes, num caloriesBurned) async {
    final userId = _userId;
    if (userId == null) return;
    final outcome = await ref.read(offlineOutboxProvider).saveWithOutbox(userId, 'exercise_logs', {
      'user_id': userId,
      'exercise_id': exerciseId,
      'exercise_name': exerciseName,
      'duration_minutes': durationMinutes,
      'calories_burned': caloriesBurned,
      'completed_at': DateTime.now().toUtc().toIso8601String(),
    });
    if (outcome.status == SaveStatus.error || !ref.mounted) return;
    final saved = Map<String, dynamic>.from(outcome.data ?? const {});
    state = state.copyWith(
      logs: [saved, ...state.logs.where((l) => l['id'] != saved['id'])],
      todayLogs: [saved, ...state.todayLogs.where((l) => l['id'] != saved['id'])],
    );
    if (outcome.status == SaveStatus.saved) unawaited(fetchLogs());
  }
}

/// A `Row` view of an `exercises` row as the screen maps it.
@immutable
class ExerciseItem {
  const ExerciseItem({
    required this.id,
    required this.name,
    required this.duration,
    required this.calories,
    required this.level,
    required this.trimester,
    required this.icon,
    required this.description,
    required this.steps,
    required this.isPostpartum,
    this.postpartumWeekStart,
    this.postpartumWeekEnd,
    this.postpartumDeliveryTypes,
  });

  factory ExerciseItem.fromRow(Row e) => ExerciseItem(
        id: '${e['id']}',
        name: '${e['name'] ?? ''}',
        duration: (e['duration_minutes'] as num?) ?? 0,
        calories: (e['calories'] as num?) ?? 0,
        level: '${e['level'] ?? ''}',
        trimester: e['trimester'] is List ? [for (final t in e['trimester'] as List) if (t is num) t.toInt()] : const [1, 2, 3],
        icon: e['icon'] is String && (e['icon'] as String).isNotEmpty ? e['icon'] as String : '🏃',
        description: e['description'] is String ? e['description'] as String : '',
        steps: e['steps'] is List ? [for (final s in e['steps'] as List) '$s'] : const [],
        isPostpartum: e['is_postpartum'] == true,
        postpartumWeekStart: (e['postpartum_week_start'] as num?)?.toInt(),
        postpartumWeekEnd: (e['postpartum_week_end'] as num?)?.toInt(),
        postpartumDeliveryTypes: e['postpartum_delivery_types'] is List ? [for (final t in e['postpartum_delivery_types'] as List) '$t'] : null,
      );

  final String id;
  final String name;
  final num duration;
  final num calories;
  final String level;
  final List<int> trimester;
  final String icon;
  final String description;
  final List<String> steps;
  final bool isPostpartum;
  final int? postpartumWeekStart;
  final int? postpartumWeekEnd;
  final List<String>? postpartumDeliveryTypes;
}

/// Mommy: postpartum exercises for the week since birth and the delivery type; otherwise the current trimester's.
List<ExerciseItem> filterExercises(List<ExerciseItem> exercises, {required bool isMommy, required int trimester, required int postpartumWeek, String? deliveryType}) {
  if (!isMommy) return exercises.where((e) => e.trimester.contains(trimester)).toList();
  return exercises.where((e) {
    if (!e.isPostpartum) return false;
    final afterStart = e.postpartumWeekStart == null || postpartumWeek >= e.postpartumWeekStart!;
    final beforeEnd = e.postpartumWeekEnd == null || postpartumWeek <= e.postpartumWeekEnd!;
    final types = e.postpartumDeliveryTypes;
    final deliveryOk = types == null || types.isEmpty || deliveryType == null || deliveryType.isEmpty || types.contains(deliveryType);
    return afterStart && beforeEnd && deliveryOk;
  }).toList();
}

// Ported from: src/hooks/usePartnerWeeklyStats.ts
//
// The woman's last 7 days for her partner: mood and water (partner_daily_logs_v1, masked by her sharing settings
// on the server) and her exercise logs, one entry per local day.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth.dart';
import '../../../../domain/dates/local_date.dart';
import '../../data/partner_backend.dart';
import '../../data/partner_family.dart' show asRowsList;
import 'screens_backend.dart';

@immutable
class DailyMoodEntry {
  const DailyMoodEntry({required this.date, this.mood, this.waterIntake = 0});
  final String date;
  final int? mood;
  final num waterIntake;
}

@immutable
class ExerciseEntry {
  const ExerciseEntry({required this.date, this.count = 0, this.minutes = 0, this.calories = 0});
  final String date;
  final int count;
  final num minutes;
  final num calories;
}

@immutable
class WeeklyStats {
  const WeeklyStats({
    required this.dailyMoods,
    required this.exerciseData,
    required this.totalWater,
    required this.avgMood,
    required this.exerciseCount,
    required this.totalCalories,
  });
  final List<DailyMoodEntry> dailyMoods;
  final List<ExerciseEntry> exerciseData;
  final num totalWater;
  final double avgMood;
  final int exerciseCount;
  final num totalCalories;
}

num _num(Object? v) => v is num ? v : 0;

/// The aggregation of `fetchWeeklyStats` over [weekDays] (oldest first): missing days are filled in, a mood of 0
/// counts as none (`log?.mood || null`), exercise is grouped by its local day.
WeeklyStats buildWeeklyStats(List<String> weekDays, List<Map<String, dynamic>> dailyLogs, List<Map<String, dynamic>> exerciseLogs) {
  final dailyMoods = <DailyMoodEntry>[
    for (final day in weekDays)
      () {
        final log = dailyLogs.where((l) => l['log_date'] == day).firstOrNull;
        final mood = log?['mood'];
        return DailyMoodEntry(
          date: day,
          mood: mood is num && mood != 0 ? mood.toInt() : null,
          waterIntake: _num(log?['water_intake']),
        );
      }(),
  ];
  final byDay = <String, ({int count, num minutes, num calories})>{};
  for (final log in exerciseLogs) {
    final at = DateTime.tryParse('${log['completed_at'] ?? ''}');
    if (at == null) continue;
    final day = localDateKey(at.toLocal());
    final prev = byDay[day] ?? (count: 0, minutes: 0, calories: 0);
    byDay[day] = (count: prev.count + 1, minutes: prev.minutes + _num(log['duration_minutes']), calories: prev.calories + _num(log['calories_burned']));
  }
  final exerciseData = <ExerciseEntry>[
    for (final day in weekDays)
      ExerciseEntry(date: day, count: byDay[day]?.count ?? 0, minutes: byDay[day]?.minutes ?? 0, calories: byDay[day]?.calories ?? 0),
  ];
  final totalWater = dailyMoods.fold<num>(0, (s, d) => s + d.waterIntake);
  final moodEntries = dailyMoods.where((d) => d.mood != null).toList();
  final avgMood = moodEntries.isEmpty ? 0.0 : moodEntries.fold<int>(0, (s, d) => s + d.mood!) / moodEntries.length;
  return WeeklyStats(
    dailyMoods: dailyMoods,
    exerciseData: exerciseData,
    totalWater: totalWater,
    avgMood: avgMood,
    exerciseCount: exerciseLogs.length,
    totalCalories: exerciseLogs.fold<num>(0, (s, e) => s + _num(e['calories_burned'])),
  );
}

@immutable
class PartnerWeeklyStatsState {
  const PartnerWeeklyStatsState({this.stats, this.loading = true});
  final WeeklyStats? stats;
  final bool loading;
}

/// `usePartnerWeeklyStats()`.
final partnerWeeklyStatsProvider =
    NotifierProvider.autoDispose<PartnerWeeklyStatsController, PartnerWeeklyStatsState>(PartnerWeeklyStatsController.new);

class PartnerWeeklyStatsController extends Notifier<PartnerWeeklyStatsState> {
  String? _linked;

  @override
  PartnerWeeklyStatsState build() {
    _linked = ref.watch(authProfileProvider.select((p) => p?.linkedPartnerId));
    scheduleMicrotask(() {
      if (ref.mounted) unawaited(fetchWeeklyStats());
    });
    return const PartnerWeeklyStatsState();
  }

  /// `fetchWeeklyStats()` (`refetch`).
  Future<void> fetchWeeklyStats() async {
    final linked = _linked;
    if (linked == null || linked.isEmpty) {
      state = PartnerWeeklyStatsState(stats: state.stats, loading: false);
      return;
    }
    try {
      final backend = ref.read(partnerBackendProvider);
      final partnerId = await backend.profileUserId(linked);
      if (partnerId == null) {
        if (ref.mounted) state = PartnerWeeklyStatsState(stats: state.stats, loading: false);
        return;
      }
      final startDate = daysAgoKey(6);
      final endDate = todayKey();
      final weekDays = [for (var i = 0; i < 7; i++) daysAgoKey(6 - i)];
      // supabase-js: an error gives no data (the hook does not check these two errors).
      List<Map<String, dynamic>> dailyLogs;
      try {
        dailyLogs = asRowsList(await backend.rpc('partner_daily_logs_v1', {'p_from': startDate, 'p_to': endDate}));
      } catch (_) {
        dailyLogs = const [];
      }
      List<Map<String, dynamic>> exerciseLogs;
      try {
        exerciseLogs =
            await ref.read(partnerScreensBackendProvider).exerciseLogs(partnerId, localDayStartIso(startDate), localDayStartIso(daysAgoKey(-1)));
      } catch (_) {
        exerciseLogs = const [];
      }
      if (!ref.mounted) return;
      state = PartnerWeeklyStatsState(stats: buildWeeklyStats(weekDays, dailyLogs, exerciseLogs), loading: false);
    } catch (error) {
      debugPrint('Error fetching weekly stats: $error');
      if (ref.mounted) state = PartnerWeeklyStatsState(stats: state.stats, loading: false);
    }
  }
}

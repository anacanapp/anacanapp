// Ported from: src/hooks/usePartnerStats.ts, src/hooks/usePartnerConfig.ts (usePartnerAchievements,
//              usePartnerMenuItems, useSurpriseCategories, FALLBACK_SURPRISE_CATEGORIES), src/hooks/useSurprises.ts
//
// The partner's own progress: mission / message stats (live), the admin-configured achievements and menu rows,
// and his planned / completed surprises.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/tr.dart';
import 'partner_backend.dart';

// ── usePartnerStats ──────────────────────────────────────────────────────────────────────────────────────────

@immutable
class PartnerStats {
  const PartnerStats({this.totalPoints = 0, this.completedMissions = 0, this.level = 1, this.lovesSent = 0, this.messagesSent = 0});
  final int totalPoints;
  final int completedMissions;
  final int level;
  final int lovesSent;
  final int messagesSent;
}

@immutable
class PartnerStatsState {
  const PartnerStatsState({this.stats = const PartnerStats(), this.loading = true});
  final PartnerStats stats;
  final bool loading;
}

final partnerStatsProvider = NotifierProvider.autoDispose<PartnerStatsController, PartnerStatsState>(PartnerStatsController.new);

class PartnerStatsController extends Notifier<PartnerStatsState> {
  String? _userId;
  PartnerBackend get _backend => ref.read(partnerBackendProvider);

  @override
  PartnerStatsState build() {
    final userId = _userId = ref.watch(authUserProvider)?.id;
    if (userId != null) {
      void changed(PartnerChange _) => unawaited(fetchStats());
      _backend.subscribe(ref, channelPrefix: 'partner-stats-$userId', table: 'partner_missions', filter: 'user_id=eq.$userId', onChange: changed);
      _backend.subscribe(ref,
          channelPrefix: 'partner-stats-$userId', table: 'partner_messages', event: 'INSERT', filter: 'sender_id=eq.$userId', onChange: changed);
    }
    scheduleMicrotask(() {
      if (ref.mounted) unawaited(fetchStats());
    });
    return const PartnerStatsState();
  }

  /// `fetchStats()` (`refetch`).
  Future<void> fetchStats() async {
    final userId = _userId;
    if (userId == null) {
      state = PartnerStatsState(stats: state.stats, loading: false);
      return;
    }
    try {
      final missions = await _backend.select('partner_missions', columns: 'points_earned, is_completed', eq: {'user_id': userId, 'is_completed': true});
      final totalPoints = missions.fold<int>(0, (s, m) => s + (m['points_earned'] is num ? (m['points_earned'] as num).toInt() : 0));
      final loves = await _backend.countSentMessages(userId, const ['love']);
      final messages = await _backend.countSentMessages(userId, const ['text', 'image', 'audio']);
      if (!ref.mounted) return;
      state = PartnerStatsState(
        stats: PartnerStats(
            totalPoints: totalPoints, completedMissions: missions.length, level: totalPoints ~/ 50 + 1, lovesSent: loves, messagesSent: messages),
        loading: false,
      );
    } catch (error) {
      debugPrint('Error fetching partner stats: $error');
      if (ref.mounted) state = PartnerStatsState(stats: state.stats, loading: false);
    }
  }
}

// ── usePartnerConfig ─────────────────────────────────────────────────────────────────────────────────────────

/// `usePartnerAchievements()`: key `['partner-achievements']`, 30 min stale.
final partnerAchievementsQuery = queryProvider<List<Map<String, dynamic>>>((ref) => QueryOptions(
      queryKey: const ['partner-achievements'],
      staleTime: const Duration(minutes: 30),
      codec: QueryCodecs.rows,
      queryFn: (_) => ref.read(partnerBackendProvider).activeRows('partner_achievements'),
    ), name: 'partnerAchievementsQuery');

/// `usePartnerMenuItems()`: key `['partner-menu-items']`, 30 min stale.
final partnerMenuItemsQuery = queryProvider<List<Map<String, dynamic>>>((ref) => QueryOptions(
      queryKey: const ['partner-menu-items'],
      staleTime: const Duration(minutes: 30),
      codec: QueryCodecs.rows,
      queryFn: (_) => ref.read(partnerBackendProvider).activeRows('partner_menu_items'),
    ), name: 'partnerMenuItemsQuery');

/// `useSurpriseCategories()`: key `['surprise-categories']`, 30 min stale.
final surpriseCategoriesQuery = queryProvider<List<Map<String, dynamic>>>((ref) => QueryOptions(
      queryKey: const ['surprise-categories'],
      staleTime: const Duration(minutes: 30),
      codec: QueryCodecs.rows,
      queryFn: (_) => ref.read(partnerBackendProvider).activeRows('surprise_categories'),
    ), name: 'surpriseCategoriesQuery');

/// `FALLBACK_SURPRISE_CATEGORIES`.
List<Map<String, dynamic>> fallbackSurpriseCategories() => [
      {'category_key': 'romantic', 'label_az': tr('usepartnerconfig_romantik', 'Romantik'), 'emoji': '❤️', 'color_gradient': 'from-pink-500 to-rose-600'},
      {'category_key': 'care', 'label_az': tr('usepartnerconfig_qaygi_868e7d', 'Qayğı'), 'emoji': '🤗', 'color_gradient': 'from-violet-500 to-purple-600'},
      {'category_key': 'adventure', 'label_az': tr('usepartnerconfig_macera_bc3bdc', 'Macəra'), 'emoji': '🌟', 'color_gradient': 'from-amber-500 to-orange-600'},
      {'category_key': 'gift', 'label_az': tr('usepartnerconfig_hediyye_8578f3', 'Hədiyyə'), 'emoji': '🎁', 'color_gradient': 'from-emerald-500 to-teal-600'},
    ];

// ── useSurprises ─────────────────────────────────────────────────────────────────────────────────────────────

@immutable
class SurprisesState {
  const SurprisesState({this.surprises = const [], this.isLoading = true});

  /// `partner_surprises` rows, newest first.
  final List<Map<String, dynamic>> surprises;
  final bool isLoading;

  List<Map<String, dynamic>> get plannedSurprises => surprises.where((s) => s['status'] == 'planned').toList();
  List<Map<String, dynamic>> get completedSurprises => surprises.where((s) => s['status'] == 'completed').toList();

  static int _points(Map<String, dynamic> s) => s['surprise_points'] is num ? (s['surprise_points'] as num).toInt() : 0;

  int get totalPoints => completedSurprises.fold(0, (sum, s) => sum + _points(s));

  /// Completed surprises per category.
  Map<String, int> get categoryStats {
    final out = <String, int>{};
    for (final s in completedSurprises) {
      final c = '${s['surprise_category']}';
      out[c] = (out[c] ?? 0) + 1;
    }
    return out;
  }

  /// Points per `YYYY-MM` (UTC, `toISOString().slice(0, 7)`).
  Map<String, int> get monthlyPoints {
    final out = <String, int>{};
    for (final s in completedSurprises) {
      final d = DateTime.tryParse('${s['completed_date'] ?? ''}');
      if (d == null) continue;
      final month = d.toUtc().toIso8601String().substring(0, 7);
      out[month] = (out[month] ?? 0) + _points(s);
    }
    return out;
  }

  /// The last six months for the chart (`getMonthlyChartData`).
  List<({String month, int points, String label})> monthlyChartData([DateTime? now]) {
    final names = [
      tr('month_jan_short', 'Yan'), tr('month_feb_short', 'Fev'), tr('month_mar_short', 'Mar'), tr('month_apr_short', 'Apr'), //
      tr('month_may_short', 'May'), tr('month_jun_short', 'İyn'), tr('month_jul_short', 'İyl'), tr('month_aug_short', 'Avq'),
      tr('month_sep_short', 'Sen'), tr('month_oct_short', 'Okt'), tr('month_nov_short', 'Noy'), tr('month_dec_short', 'Dek'),
    ];
    final points = monthlyPoints;
    final base = now ?? DateTime.now();
    return [
      for (var i = 5; i >= 0; i--)
        () {
          // `date.setMonth(date.getMonth() - i)` keeps the day (JS rolls an overflowing day into the next month).
          final date = DateTime(base.year, base.month - i, base.day, base.hour, base.minute, base.second);
          final key = date.toUtc().toIso8601String().substring(0, 7);
          return (month: key, points: points[key] ?? 0, label: names[date.month - 1]);
        }(),
    ];
  }

  /// The category with the most completed surprises.
  ({String category, int count})? get topCategory {
    final entries = categoryStats.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    return entries.isEmpty ? null : (category: entries.first.key, count: entries.first.value);
  }
}

/// `useSurprises()`.
final surprisesProvider = NotifierProvider.autoDispose<SurprisesController, SurprisesState>(SurprisesController.new);

class SurprisesController extends Notifier<SurprisesState> {
  String? _userId;
  PartnerBackend get _backend => ref.read(partnerBackendProvider);

  @override
  SurprisesState build() {
    _userId = ref.watch(authUserProvider)?.id;
    scheduleMicrotask(() {
      if (ref.mounted) unawaited(fetchSurprises());
    });
    return const SurprisesState();
  }

  Future<void> fetchSurprises() async {
    final userId = _userId;
    if (userId == null) return;
    try {
      final rows = await _backend.select('partner_surprises', eq: {'user_id': userId}, orderBy: 'created_at', ascending: false);
      if (ref.mounted) state = SurprisesState(surprises: rows, isLoading: false);
    } catch (error) {
      debugPrint('Error fetching surprises: $error');
      if (ref.mounted) state = SurprisesState(surprises: state.surprises, isLoading: false);
    }
  }

  /// `addSurprise({surprise_id, surprise_title, surprise_emoji, surprise_category, surprise_points, planned_date,
  /// notes?})` → the new row or null.
  Future<Map<String, dynamic>?> addSurprise(Map<String, dynamic> surprise) async {
    final userId = _userId;
    if (userId == null) return null;
    try {
      final row = await _backend.insertReturning('partner_surprises', {'user_id': userId, ...surprise, 'status': 'planned'});
      if (ref.mounted) state = SurprisesState(surprises: [row, ...state.surprises], isLoading: state.isLoading);
      return row;
    } catch (error) {
      debugPrint('Error adding surprise: $error');
      return null;
    }
  }

  Future<bool> completeSurprise(String id) async {
    final userId = _userId;
    if (userId == null) return false;
    try {
      final now = DateTime.now().toUtc().toIso8601String();
      await _backend.update('partner_surprises', {'status': 'completed', 'completed_date': now}, {'id': id, 'user_id': userId});
      if (ref.mounted) {
        state = SurprisesState(
          surprises: [for (final s in state.surprises) s['id'] == id ? {...s, 'status': 'completed', 'completed_date': now} : s],
          isLoading: state.isLoading,
        );
      }
      return true;
    } catch (error) {
      debugPrint('Error completing surprise: $error');
      return false;
    }
  }

  Future<bool> deleteSurprise(String id) async {
    final userId = _userId;
    if (userId == null) return false;
    try {
      await _backend.delete('partner_surprises', {'id': id, 'user_id': userId});
      if (ref.mounted) state = SurprisesState(surprises: state.surprises.where((s) => s['id'] != id).toList(), isLoading: state.isLoading);
      return true;
    } catch (error) {
      debugPrint('Error deleting surprise: $error');
      return false;
    }
  }
}

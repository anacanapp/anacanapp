// Ported from: src/hooks/useBabyMilestones.ts, src/hooks/useTeething.ts (counts used by TeethingWidget),
//              src/components/mommy/GrowthTrackerWidget.tsx (baby_growth fetch / insert)
//
// Per-user baby records shown on the mommy home. React kept them in component state; here they are queries
// (never persisted) so every widget shares the data. Toasts are reported through [BabyToast] so the widget layer
// decides how to show them (AToastHost).
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/tr.dart';
import '../../../domain/dates/local_date.dart';
import '../data/baby_repository.dart';
import 'use_children.dart';
import 'use_content_queries.dart';

/// `toast({ title, description, variant })`.
typedef BabyToast = void Function({String? title, String? description, bool destructive});

// ─── Milestones ────────────────────────────────────────────────────────────────────────────────

final babyMilestonesQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final childId = ref.watch(selectedChildIdProvider);
  final repo = ref.watch(babyRepositoryProvider);
  if (userId != null) {
    final client = ref.read(queryClientProvider);
    repo.watchBabyMilestones(ref, userId, () => client.invalidateQueries(queryKey: ['baby-milestones', userId]));
  }
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['baby-milestones', userId, childId],
    enabled: userId != null,
    staleTime: Duration.zero,
    retry: noRetry,
    meta: const {'persist': false},
    codec: QueryCodecs.rows,
    queryFn: (_) => repo.babyMilestones(userId!, childId),
  );
}, name: 'babyMilestonesQuery');

/// `useBabyMilestones()` state.
class BabyMilestonesView {
  const BabyMilestonesView({required this.milestones, required this.definitions, required this.loading});
  final List<Map<String, dynamic>> milestones;

  /// `MILESTONES`.
  final List<MilestoneDefinition> definitions;
  final bool loading;

  bool isMilestoneAchieved(String id) => milestones.any((m) => m['milestone_id'] == id);

  DateTime? getMilestoneDate(String id) {
    for (final m in milestones) {
      if (m['milestone_id'] == id) return DateTime.tryParse('${m['achieved_at']}');
    }
    return null;
  }
}

final babyMilestonesProvider = Provider.autoDispose<BabyMilestonesView>((ref) {
  final q = ref.watch(babyMilestonesQuery);
  final db = ref.watch(babyMilestonesDbQuery);
  return BabyMilestonesView(
    milestones: q.data ?? const [],
    definitions: db.data ?? const [],
    loading: q.isLoading || db.isLoading,
  );
});

class BabyMilestonesActions {
  BabyMilestonesActions(this._ref);
  final Ref _ref;

  /// `toggleMilestone(id, notes)`.
  Future<void> toggleMilestone(String milestoneId, {String? notes, BabyToast? toast}) async {
    final userId = _ref.read(authUserProvider)?.id;
    if (userId == null) return;
    final childId = selectedChildNow(_ref)?.id;
    final client = _ref.read(queryClientProvider);
    final key = ['baby-milestones', userId, childId];
    final current = client.getQueryData<List<Map<String, dynamic>>>(key) ?? const [];
    Map<String, dynamic>? existing;
    for (final m in current) {
      if (m['milestone_id'] == milestoneId) existing = m;
    }
    final repo = _ref.read(babyRepositoryProvider);
    try {
      if (existing != null) {
        await repo.deleteBabyMilestone(existing['id'] as String);
        client.setQueryData<List<Map<String, dynamic>>>(key, (prev) => [...?prev?.where((m) => m['id'] != existing!['id'])]);
        toast?.call(
          title: tr('usebabymilestones_merhele_silindi_fb7d94', 'Mərhələ silindi'),
          description: tr('usebabymilestones_inkisaf_merhelesi_silindi_6e6a48', 'İnkişaf mərhələsi silindi'),
        );
      } else {
        final row = await repo.insertBabyMilestone({
          'user_id': userId,
          'child_id': childId,
          'milestone_id': milestoneId,
          'notes': notes,
        });
        if (row != null) {
          client.setQueryData<List<Map<String, dynamic>>>(key, (prev) => [row, ...?prev]);
          final defs = client.getQueryData<List<MilestoneDefinition>>(['baby-milestones-db', currentLanguage()]) ?? const [];
          MilestoneDefinition? details;
          for (final d in defs) {
            if (d.id == milestoneId) details = d;
          }
          toast?.call(
            title: '🎉 ${details?.label ?? tr('usebabymilestones_merhele_0e09aa', 'Mərhələ')} '
                '${tr('usebabymilestones_qeyd_edildi_xyz123', 'qeyd edildi!')}',
            description: details?.description,
          );
        }
      }
    } catch (e) {
      debugPrint('Error toggling milestone: $e');
      toast?.call(
        title: tr('usebabymilestones_xeta_3cdbb6', 'Xəta'),
        description: tr('usebabymilestones_merhele_qeyd_edile_bilmedi_b2cb1f', 'Mərhələ qeyd edilə bilmədi'),
        destructive: true,
      );
    }
  }
}

final babyMilestonesActionsProvider = Provider<BabyMilestonesActions>(BabyMilestonesActions.new);

// ─── Teething (summary counts) ────────────────────────────────────────────────────────────────

final babyTeethQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final repo = ref.watch(babyRepositoryProvider);
  return QueryOptions(
    queryKey: const ['baby-teeth-db'],
    staleTime: Duration.zero,
    retry: noRetry,
    codec: QueryCodecs.rows,
    queryFn: (_) => repo.teeth(),
  );
}, name: 'babyTeethQuery');

final teethingLogsQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final childId = ref.watch(selectedChildIdProvider);
  final repo = ref.watch(babyRepositoryProvider);
  return QueryOptions(
    queryKey: ['teething-logs', userId, childId],
    enabled: userId != null,
    staleTime: Duration.zero,
    retry: noRetry,
    meta: const {'persist': false},
    codec: QueryCodecs.rows,
    queryFn: (_) => repo.teethingLogs(userId!, childId),
  );
}, name: 'teethingLogsQuery');

/// `useTeething()` summary: `{ emergedCount, totalTeeth, progress, loading }`.
class TeethingSummary {
  const TeethingSummary({required this.emergedCount, required this.totalTeeth, required this.loading});
  final int emergedCount;
  final int totalTeeth;
  final bool loading;
  double get progress => totalTeeth > 0 ? emergedCount / totalTeeth * 100 : 0;
}

final teethingSummaryProvider = Provider.autoDispose<TeethingSummary>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final teeth = ref.watch(babyTeethQuery);
  final logs = ref.watch(teethingLogsQuery);
  return TeethingSummary(
    emergedCount: logs.data?.length ?? 0,
    totalTeeth: teeth.data?.length ?? 0,
    // React: loading until every fetch settled (logs are skipped without a user).
    loading: teeth.isLoading || (userId != null && logs.isLoading),
  );
});

// ─── Growth entries (GrowthTrackerWidget) ─────────────────────────────────────────────────────

final babyGrowthQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final childId = ref.watch(selectedChildIdProvider);
  final repo = ref.watch(babyRepositoryProvider);
  return QueryOptions(
    queryKey: ['baby-growth-home', userId, childId],
    enabled: userId != null,
    staleTime: Duration.zero,
    retry: noRetry,
    meta: const {'persist': false},
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      try {
        return await repo.growthEntries(userId!, childId);
      } catch (e) {
        debugPrint('Baby growth fetch error: $e');
        return const <Map<String, dynamic>>[];
      }
    },
  );
}, name: 'babyGrowthQuery');

class BabyGrowthActions {
  BabyGrowthActions(this._ref);
  final Ref _ref;

  /// Inserts one measurement for today; prepends it to the list. Throws on a server error.
  Future<Map<String, dynamic>> addEntry({double? weightKg, double? heightCm, double? headCm}) async {
    final userId = _ref.read(authUserProvider)!.id;
    final childId = selectedChildNow(_ref)?.id;
    final row = await _ref.read(babyRepositoryProvider).insertGrowthEntry({
      'user_id': userId,
      'child_id': childId,
      'weight_kg': weightKg,
      'height_cm': heightCm,
      'head_cm': headCm,
      'entry_date': todayKey(),
    });
    _ref.read(queryClientProvider).setQueryData<List<Map<String, dynamic>>>(
        ['baby-growth-home', userId, childId], (prev) => [row, ...?prev]);
    return row;
  }
}

final babyGrowthActionsProvider = Provider<BabyGrowthActions>(BabyGrowthActions.new);

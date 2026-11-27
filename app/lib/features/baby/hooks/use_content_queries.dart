// Ported from: src/hooks/useBabyDailyInfo.ts (useBabyDailyInfoByDay), src/hooks/useMommyDailyMessages.ts
//              (useMommyDailyMessageByDay), src/hooks/useBabyCrisisPeriods.ts (useBabyCrisisPeriods,
//              useCurrentBabyCrisis, useUpcomingBabyCrises), src/hooks/useDevelopmentTips.ts (useDevelopmentTips),
//              src/hooks/useDynamicConfig.ts (useBabyMilestonesDB)
//
// Content queries of the mommy home. Admin CRUD hooks of the same files are admin-only (docs/flutter/DEAD_CODE.md).
import 'package:flutter/foundation.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show mapRowTranslation, mapRowsTranslation;
import '../../../core/i18n/language_controller.dart';
import '../data/baby_repository.dart';

bool _validDay(int? d) => d != null && d >= 1 && d <= 1460;

/// `useBabyDailyInfoByDay(dayNumber)` → row with `info` localized (`info_<lang>`, bundle, en/az source).
final babyDailyInfoQuery = queryProviderFamily<Map<String, dynamic>?, int?>((ref, dayNumber) {
  final language = ref.watch(appLanguageProvider);
  final repo = ref.watch(babyRepositoryProvider);
  return QueryOptions<Map<String, dynamic>?>(
    queryKey: ['baby-daily-info', dayNumber, language],
    enabled: _validDay(dayNumber),
    staleTime: const Duration(minutes: 5),
    codec: QueryCodecs.maybeRow,
    queryFn: (_) async {
      if (!_validDay(dayNumber)) return null;
      try {
        final data = await repo.babyDailyInfo(dayNumber!);
        if (data == null) return null;
        return mapRowTranslation(data, language, const ['info']);
      } catch (e) {
        debugPrint('Error fetching baby daily info: $e');
        return null;
      }
    },
  );
}, name: 'babyDailyInfoQuery');

/// `useMommyDailyMessageByDay(dayNumber)`: `message_<lang>` when the language is not az and the column is set.
final mommyDailyMessageQuery = queryProviderFamily<Map<String, dynamic>?, int?>((ref, dayNumber) {
  final language = ref.watch(appLanguageProvider);
  final repo = ref.watch(babyRepositoryProvider);
  return QueryOptions<Map<String, dynamic>?>(
    queryKey: ['mommy-daily-message', dayNumber, language],
    enabled: _validDay(dayNumber),
    staleTime: const Duration(minutes: 5),
    codec: QueryCodecs.maybeRow,
    queryFn: (_) async {
      if (!_validDay(dayNumber)) return null;
      try {
        final data = await repo.mommyDailyMessage(dayNumber!);
        if (data == null) return null;
        if (language != 'az') {
          final lang = data['message_$language'];
          if (lang is String && lang.isNotEmpty) return {...data, 'message': lang};
        }
        return data;
      } catch (e) {
        debugPrint('Error fetching mommy daily message: $e');
        return null;
      }
    },
  );
}, name: 'mommyDailyMessageQuery');

/// `BabyCrisisPeriod` (localized row).
class BabyCrisisPeriod {
  const BabyCrisisPeriod({
    required this.id,
    required this.weekStart,
    required this.weekEnd,
    required this.title,
    this.description,
    this.symptoms,
    this.tips,
    required this.severity,
    required this.emoji,
  });

  factory BabyCrisisPeriod.fromRow(Map<String, dynamic> r) => BabyCrisisPeriod(
        id: r['id'] as String,
        weekStart: (r['week_start'] as num).toInt(),
        weekEnd: (r['week_end'] as num).toInt(),
        title: r['title'] as String? ?? '',
        description: r['description'] as String?,
        symptoms: (r['symptoms'] as List?)?.map((e) => '$e').toList(),
        tips: (r['tips'] as List?)?.map((e) => '$e').toList(),
        severity: r['severity'] as String? ?? 'mild',
        emoji: r['emoji'] as String? ?? '',
      );

  final String id;
  final int weekStart;
  final int weekEnd;
  final String title;
  final String? description;
  final List<String>? symptoms;
  final List<String>? tips;
  final String severity;
  final String emoji;

  Map<String, dynamic> toRow() => {
        'id': id,
        'week_start': weekStart,
        'week_end': weekEnd,
        'title': title,
        'description': description,
        'symptoms': symptoms,
        'tips': tips,
        'severity': severity,
        'emoji': emoji,
      };
}

/// `useBabyCrisisPeriods()`.
final babyCrisisPeriodsQuery = queryProvider<List<BabyCrisisPeriod>>((ref) {
  final language = ref.watch(appLanguageProvider);
  final repo = ref.watch(babyRepositoryProvider);
  return QueryOptions<List<BabyCrisisPeriod>>(
    queryKey: ['baby-crisis-periods', language],
    staleTime: const Duration(minutes: 30),
    codec: QueryCodecs.models((c) => c.toRow(), BabyCrisisPeriod.fromRow),
    queryFn: (_) async {
      final rows = mapRowsTranslation(await repo.crisisPeriods(), language, const ['title', 'description', 'symptoms', 'tips']);
      return [for (final r in rows) BabyCrisisPeriod.fromRow(r)];
    },
  );
}, name: 'babyCrisisPeriodsQuery');

/// `useCurrentBabyCrisis(weeks)`.
List<BabyCrisisPeriod> currentBabyCrises(List<BabyCrisisPeriod> periods, int babyAgeWeeks) =>
    [for (final p in periods) if (babyAgeWeeks >= p.weekStart && babyAgeWeeks <= p.weekEnd) p];

/// `useUpcomingBabyCrises(weeks, limit = 3)`.
List<BabyCrisisPeriod> upcomingBabyCrises(List<BabyCrisisPeriod> periods, int babyAgeWeeks, [int limit = 3]) =>
    periods.where((p) => p.weekStart > babyAgeWeeks).take(limit).toList();

/// `DevelopmentTip`.
class DevelopmentTip {
  const DevelopmentTip({required this.id, required this.emoji, required this.title, required this.content});
  factory DevelopmentTip.fromRow(Map<String, dynamic> r) => DevelopmentTip(
        id: r['id'] as String,
        emoji: r['emoji'] as String? ?? '',
        title: r['title'] as String? ?? '',
        content: r['content'] as String? ?? '',
      );
  final String id;
  final String emoji;
  final String title;
  final String content;
  Map<String, dynamic> toRow() => {'id': id, 'emoji': emoji, 'title': title, 'content': content};
}

/// `useDevelopmentTips(ageGroup)`.
final developmentTipsQuery = queryProviderFamily<List<DevelopmentTip>, String?>((ref, ageGroup) {
  final language = ref.watch(appLanguageProvider);
  final repo = ref.watch(babyRepositoryProvider);
  return QueryOptions<List<DevelopmentTip>>(
    queryKey: ['development-tips', ageGroup, language],
    codec: QueryCodecs.models((t) => t.toRow(), DevelopmentTip.fromRow),
    queryFn: (_) async {
      final rows = mapRowsTranslation(await repo.developmentTips(ageGroup), language, const ['title', 'content']);
      return [for (final r in rows) DevelopmentTip.fromRow(r)];
    },
  );
}, name: 'developmentTipsQuery');

/// `useBabyMilestonesDB()` mapped like `MILESTONES` in useBabyMilestones.
class MilestoneDefinition {
  const MilestoneDefinition({required this.id, required this.week, required this.label, required this.emoji, this.description});
  factory MilestoneDefinition.fromRow(Map<String, dynamic> r) => MilestoneDefinition(
        id: r['milestone_key'] as String? ?? r['id'] as String? ?? '',
        week: (r['week_number'] as num?)?.toInt() ?? 0,
        label: r['label'] as String? ?? '',
        emoji: r['emoji'] as String? ?? '',
        description: r['description'] as String?,
      );
  final String id;
  final int week;
  final String label;
  final String emoji;
  final String? description;
  Map<String, dynamic> toRow() =>
      {'milestone_key': id, 'week_number': week, 'label': label, 'emoji': emoji, 'description': description};
}

final babyMilestonesDbQuery = queryProvider<List<MilestoneDefinition>>((ref) {
  final language = ref.watch(appLanguageProvider);
  final repo = ref.watch(babyRepositoryProvider);
  return QueryOptions<List<MilestoneDefinition>>(
    queryKey: ['baby-milestones-db', language],
    staleTime: const Duration(minutes: 10),
    codec: QueryCodecs.models((m) => m.toRow(), MilestoneDefinition.fromRow),
    queryFn: (_) async {
      final rows = mapRowsTranslation(await repo.milestoneDefinitions(), language, const ['label', 'description']);
      return [for (final r in rows) MilestoneDefinition.fromRow(r)];
    },
  );
}, name: 'babyMilestonesDbQuery');

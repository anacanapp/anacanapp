// Ported from: src/hooks/usePartnerFamily.ts, src/hooks/usePartnerRecentMoods.ts
//
// Shared family tools of a mother and her mutually linked partner (night shift, birth plan) — all access through
// SECURITY DEFINER RPCs — and the woman's shared moods of the last days (partner side).
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../domain/dates/local_date.dart' show localDateKey;
import '../../../domain/js_compat.dart' show DomainClock;
import 'partner_backend.dart';

/// Local calendar day of [date] (`localDateKey`).
String isoDay(DateTime date) => localDateKey(date);

/// [date] plus [days] calendar days (local `setDate`).
DateTime addDays(DateTime date, int days) =>
    DateTime(date.year, date.month, date.day + days, date.hour, date.minute, date.second, date.millisecond, date.microsecond);

// ── Night shifts ─────────────────────────────────────────────────────────────────────────────────────────────

/// 'mother' | 'partner'.
typedef NightAssignee = String;

@immutable
class NightShift {
  const NightShift({required this.shiftDate, required this.assignee, required this.isDone, this.wakeups, this.note, required this.updatedByMe, required this.updatedAt});
  final String shiftDate;
  final NightAssignee assignee;
  final bool isDone;
  final int? wakeups;
  final String? note;
  final bool updatedByMe;
  final String updatedAt;

  factory NightShift.fromRow(Map<String, dynamic> r) => NightShift(
        shiftDate: '${r['shift_date'] ?? ''}',
        assignee: '${r['assignee'] ?? ''}',
        isDone: r['is_done'] == true,
        wakeups: r['wakeups'] is num ? (r['wakeups'] as num).toInt() : null,
        note: r['note'] is String ? r['note'] as String : null,
        updatedByMe: r['updated_by_me'] == true,
        updatedAt: '${r['updated_at'] ?? ''}',
      );

  Map<String, Object?> toRow() => {
        'shift_date': shiftDate,
        'assignee': assignee,
        'is_done': isDone,
        'wakeups': wakeups,
        'note': note,
        'updated_by_me': updatedByMe,
        'updated_at': updatedAt,
      };
}

/// `useNightShifts(from, to)` query: key `['night-shifts', uid, from, to]`.
final nightShiftsQuery = queryProviderFamily<List<NightShift>, (String, String)>((ref, range) {
  final userId = ref.watch(authUserProvider)?.id;
  return QueryOptions<List<NightShift>>(
    queryKey: ['night-shifts', userId, range.$1, range.$2],
    enabled: userId != null,
    codec: QueryCodecs.models((s) => s.toRow(), NightShift.fromRow),
    queryFn: (_) async {
      final data = await ref.read(partnerBackendProvider).rpc('night_shifts_v1', {'p_from': range.$1, 'p_to': range.$2});
      return [for (final r in asRowsList(data)) NightShift.fromRow(r)];
    },
  );
}, name: 'nightShiftsQuery');

typedef NightShiftInput = ({String date, NightAssignee? assignee, bool? isDone, int? wakeups, String? note});

/// `useNightShifts().set` mutation (`night_shift_set_v1`, then `['night-shifts', uid]` is invalidated).
final setNightShiftMutation = mutationProvider<void, NightShiftInput, void>((ref) {
  final qc = ref.read(queryClientProvider);
  return MutationOptions<void, NightShiftInput, void>(
    mutationFn: (input) async {
      await ref.read(partnerBackendProvider).rpc('night_shift_set_v1', {
        'p_date': input.date,
        'p_assignee': input.assignee,
        'p_is_done': input.isDone ?? false,
        'p_wakeups': input.wakeups,
        'p_note': input.note,
      });
    },
    onSettled: (_, _, _, _) => unawaited(qc.invalidateQueries(queryKey: ['night-shifts', ref.read(authUserProvider)?.id])),
  );
}, name: 'setNightShiftMutation');

// ── Birth plan ───────────────────────────────────────────────────────────────────────────────────────────────

/// `BirthPlanState` (`plan` keeps the JSON shape: place, doctor, companions[], pain, environment[], after[],
/// cesarean[], notes).
@immutable
class BirthPlanState {
  const BirthPlanState({this.plan = const {}, this.updatedAt, this.updatedByMe = false, this.isMother = false});
  final Map<String, dynamic> plan;
  final String? updatedAt;
  final bool updatedByMe;
  final bool isMother;

  factory BirthPlanState.fromRow(Map<String, dynamic> r) => BirthPlanState(
        plan: r['plan'] is Map ? Map<String, dynamic>.from(r['plan'] as Map) : const {},
        updatedAt: r['updated_at'] is String ? r['updated_at'] as String : null,
        updatedByMe: r['updated_by_me'] == true,
        isMother: r['is_mother'] == true,
      );

  Map<String, Object?> toRow() => {'plan': plan, 'updated_at': updatedAt, 'updated_by_me': updatedByMe, 'is_mother': isMother};
}

/// Someone else saved the plan since it was loaded (`BIRTH_PLAN_CHANGED`, SQLSTATE 40001).
class BirthPlanChangedError implements Exception {
  const BirthPlanChangedError();
  @override
  String toString() => 'BIRTH_PLAN_CHANGED';
}

/// `useBirthPlan()` query: key `['birth-plan', uid]`.
final birthPlanQuery = queryProvider<BirthPlanState?>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  return QueryOptions<BirthPlanState?>(
    queryKey: ['birth-plan', userId],
    enabled: userId != null,
    queryFn: (_) async {
      final data = await ref.read(partnerBackendProvider).rpc('birth_plan_get_v1');
      return data is Map ? BirthPlanState.fromRow(Map<String, dynamic>.from(data)) : null;
    },
  );
}, name: 'birthPlanQuery');

/// `useBirthPlan().save` mutation (optimistic concurrency on `updated_at`).
final saveBirthPlanMutation = mutationProvider<String?, Map<String, dynamic>, void>((ref) {
  final qc = ref.read(queryClientProvider);
  return MutationOptions<String?, Map<String, dynamic>, void>(
    mutationFn: (plan) async {
      final userId = ref.read(authUserProvider)?.id;
      final current = qc.getQueryData<BirthPlanState?>(['birth-plan', userId]);
      try {
        final data = await ref.read(partnerBackendProvider).rpc('birth_plan_save_v1', {'p_plan': plan, 'p_expected_updated_at': current?.updatedAt});
        return data is String ? data : null;
      } catch (error) {
        if (error is PostgrestException && (error.code == '40001' || error.message.contains('BIRTH_PLAN_CHANGED'))) {
          throw const BirthPlanChangedError();
        }
        if ('$error'.contains('BIRTH_PLAN_CHANGED')) throw const BirthPlanChangedError();
        rethrow;
      }
    },
    onSettled: (_, _, _, _) => unawaited(qc.invalidateQueries(queryKey: ['birth-plan', ref.read(authUserProvider)?.id])),
  );
}, name: 'saveBirthPlanMutation');

// ── Recent moods (partner side) ──────────────────────────────────────────────────────────────────────────────

@immutable
class PartnerRecentMoods {
  const PartnerRecentMoods({this.moods = const []});

  /// Days with a shared mood (`{log_date, mood}`).
  final List<({String logDate, int mood})> moods;

  /// Days with mood 1–2.
  int get lowDays => moods.where((m) => m.mood <= 2).length;
}

final _recentMoodsQuery = queryProviderFamily<List<Map<String, dynamic>>, (int, bool)>((ref, arg) {
  final userId = ref.watch(authUserProvider)?.id;
  final today = DomainClock.now();
  final from = isoDay(addDays(today, -(arg.$1 - 1)));
  final to = isoDay(today);
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['partner-recent-moods', userId, from, to],
    enabled: userId != null && arg.$2,
    staleTime: const Duration(minutes: 5),
    codec: QueryCodecs.rows,
    queryFn: (_) async => asRowsList(await ref.read(partnerBackendProvider).rpc('partner_daily_logs_v1', {'p_from': from, 'p_to': to})),
  );
}, name: 'partnerRecentMoodsQuery');

/// `usePartnerRecentMoods(days, enabled)`: the woman's shared moods (null unless she shares mood).
final partnerRecentMoodsProvider = Provider.autoDispose.family<PartnerRecentMoods, (int, bool)>((ref, arg) {
  final rows = ref.watch(_recentMoodsQuery(arg)).data ?? const [];
  return PartnerRecentMoods(moods: [
    for (final r in rows)
      if (r['mood'] is num) (logDate: '${r['log_date'] ?? ''}', mood: (r['mood'] as num).toInt()),
  ]);
});

/// PostgREST rows of an RPC answer.
List<Map<String, dynamic>> asRowsList(Object? data) =>
    data is List ? [for (final e in data) if (e is Map) Map<String, dynamic>.from(e)] : const [];

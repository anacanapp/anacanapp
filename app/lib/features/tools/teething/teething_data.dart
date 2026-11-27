// Ported from: src/hooks/useTeething.ts
//
// `useTeething()` → ref.watch(teethingProvider) ([TeethingView]) + ref.read(teethingActionsProvider).
// Teeth and the child's logs share the queries of the baby home (features/baby use_baby_records.dart:
// `['baby-teeth-db']`, `['teething-logs', uid, childId]`); care tips and symptoms are content queries. Rows are
// translated with mapRowsTranslation exactly like the hook (teeth: name/description, tips: title/content,
// symptoms: name/description/relief_tips).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show mapRowsTranslation;
import '../../../core/i18n/language_controller.dart';
import '../../../core/net/backend_providers.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart';
import '../../baby/hooks/use_baby_records.dart' show babyTeethQuery, teethingLogsQuery;
import '../../baby/hooks/use_children.dart';

typedef TRow = Map<String, dynamic>;

/// The writes and the two content tables of the hook (tests override it).
abstract interface class TeethingRepository {
  Future<List<TRow>> careTips();
  Future<List<TRow>> symptoms();

  /// `upsert({...}, { onConflict: 'user_id,child_id,tooth_id' })`.
  Future<void> upsertLog(TRow row);
  Future<void> deleteLog(String userId, String toothId, String? childId);
  Future<void> updateNote(String userId, String toothId, String? childId, String notes);
}

class SupabaseTeethingRepository implements TeethingRepository {
  SupabaseTeethingRepository(this._client);
  final SupabaseClient Function() _client;
  SupabaseClient get client => _client();

  List<TRow> _rows(Object? data) => [for (final r in (data as List? ?? const [])) Map<String, dynamic>.from(r as Map)];

  @override
  Future<List<TRow>> careTips() async => _rows(await client.from('teething_care_tips').select().eq('is_active', true).order('sort_order'));
  @override
  Future<List<TRow>> symptoms() async => _rows(await client.from('teething_symptoms').select().eq('is_active', true).order('sort_order'));
  @override
  Future<void> upsertLog(TRow row) => client.from('user_teething_logs').upsert(row, onConflict: 'user_id,child_id,tooth_id');
  @override
  Future<void> deleteLog(String userId, String toothId, String? childId) {
    var q = client.from('user_teething_logs').delete().eq('user_id', userId).eq('tooth_id', toothId);
    if (childId != null) q = q.eq('child_id', childId);
    return q;
  }

  @override
  Future<void> updateNote(String userId, String toothId, String? childId, String notes) {
    var q = client
        .from('user_teething_logs')
        .update({'notes': notes, 'updated_at': jsToIsoString(DomainClock.now())}).eq('user_id', userId).eq('tooth_id', toothId);
    if (childId != null) q = q.eq('child_id', childId);
    return q;
  }
}

final teethingRepositoryProvider =
    Provider<TeethingRepository>((ref) => SupabaseTeethingRepository(() => ref.read(supabaseClientProvider)), name: 'teethingRepositoryProvider');

final teethingCareTipsQuery = queryProvider<List<TRow>>((ref) {
  final repo = ref.watch(teethingRepositoryProvider);
  return QueryOptions(queryKey: const ['teething-care-tips'], staleTime: Duration.zero, retry: noRetry, codec: QueryCodecs.rows, queryFn: (_) => repo.careTips());
}, name: 'teethingCareTipsQuery');

final teethingSymptomsQuery = queryProvider<List<TRow>>((ref) {
  final repo = ref.watch(teethingRepositoryProvider);
  return QueryOptions(queryKey: const ['teething-symptoms'], staleTime: Duration.zero, retry: noRetry, codec: QueryCodecs.rows, queryFn: (_) => repo.symptoms());
}, name: 'teethingSymptomsQuery');

/// What `useTeething()` returns (state part).
class TeethingView {
  const TeethingView({required this.teeth, required this.logs, required this.tips, required this.symptoms, required this.loading});
  final List<TRow> teeth;
  final List<TRow> logs;
  final List<TRow> tips;
  final List<TRow> symptoms;
  final bool loading;

  bool isToothEmerged(String toothId) => logs.any((l) => l['tooth_id'] == toothId);
  TRow? getToothLog(String toothId) {
    for (final l in logs) {
      if (l['tooth_id'] == toothId) return l;
    }
    return null;
  }

  int get emergedCount => logs.length;
  int get totalTeeth => teeth.length;
  double get progress => totalTeeth > 0 ? emergedCount / totalTeeth * 100 : 0;
}

final teethingProvider = Provider.autoDispose<TeethingView>((ref) {
  final language = ref.watch(appLanguageProvider);
  final userId = ref.watch(authUserProvider)?.id;
  final teeth = ref.watch(babyTeethQuery);
  final logs = ref.watch(teethingLogsQuery);
  final tips = ref.watch(teethingCareTipsQuery);
  final symptoms = ref.watch(teethingSymptomsQuery);
  return TeethingView(
    teeth: mapRowsTranslation(teeth.data, language, const ['name', 'description']),
    logs: logs.data ?? const [],
    tips: mapRowsTranslation(tips.data, language, const ['title', 'content']),
    symptoms: mapRowsTranslation(symptoms.data, language, const ['name', 'description', 'relief_tips']),
    loading: teeth.isLoading || tips.isLoading || symptoms.isLoading || (userId != null && logs.isLoading),
  );
}, name: 'teethingProvider');

class TeethingActions {
  TeethingActions(this._ref);
  final Ref _ref;

  Future<void> _refetchLogs() => _ref.read(queryClientProvider).invalidateQueries(queryKey: const ['teething-logs']);

  /// `toggleTooth(toothId, emerged, date)`; errors leave the list as it is (React ignores them).
  Future<void> toggleTooth(String toothId, bool emerged, [String? date]) async {
    final userId = _ref.read(authUserProvider)?.id;
    if (userId == null) return;
    final childId = selectedChildNow(_ref)?.id;
    final repo = _ref.read(teethingRepositoryProvider);
    try {
      if (emerged) {
        await repo.upsertLog({
          'user_id': userId,
          'child_id': childId,
          'tooth_id': toothId,
          'emerged_date': date == null || date.isEmpty ? todayKey() : date,
        });
      } else {
        await repo.deleteLog(userId, toothId, childId);
      }
      await _refetchLogs();
    } catch (_) {}
  }

  Future<void> updateToothNote(String toothId, String notes) async {
    final userId = _ref.read(authUserProvider)?.id;
    if (userId == null) return;
    try {
      await _ref.read(teethingRepositoryProvider).updateNote(userId, toothId, selectedChildNow(_ref)?.id, notes);
      await _refetchLogs();
    } catch (_) {}
  }
}

final teethingActionsProvider = Provider<TeethingActions>(TeethingActions.new, name: 'teethingActionsProvider');

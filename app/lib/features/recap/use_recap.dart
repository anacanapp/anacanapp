// Ported from: src/hooks/useRecap.ts, src/components/recap/RecapEntry.tsx (useRecapProfileRow),
//              the label sources of src/components/recap/RecapScreen.tsx (useToolConfigs, useBabyMilestonesDB,
//              useSymptoms)
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../core/auth/auth.dart';
import '../../core/cache/cache.dart';
import '../../core/data/data.dart';
import '../../core/i18n/language_controller.dart';
import '../../domain/recap/recap_model.dart' show RecapLabels;
import '../../domain/recap/recap_types.dart' show parseRecap;
import '../../state/shell_bindings.dart' show backendUrlProvider;
import '../baby/hooks/use_content_queries.dart' show babyMilestonesDbQuery;
import '../profile/profile_interfaces.dart' show ProfileRowData;
import 'recap_i18n.dart';

const int recapYear = 2026;
const String recapRoot = 'anacan-recap';

/// src/lib/code-tools.ts CODE_TOOL_IDS (tools whose tool_configs rows are stored with is_active = false).
const Set<String> recapCodeToolIds = {'cakes', 'mini-games', 'baby-tracker', 'sleep-training', 'solid-food-guide', 'parenting', 'play-together', 'kid-exercises'};

/// Backend reads of the recap feature (tests swap in a fake).
abstract interface class RecapRepository {
  /// `anacan_recap_v1(p_year)` raw jsonb; throws the backend error.
  Future<Object?> recap(int year);

  /// `tool_configs` rows the app lists (`is_active` or a code tool), translated: `tool_id → display_name || name`.
  Future<Map<String, String>> toolLabels(String language);

  /// Active `symptoms`, translated: `symptom_key → label`.
  Future<Map<String, String>> symptomLabels(String language);
}

class SupabaseRecapRepository implements RecapRepository {
  SupabaseRecapRepository(this.ref);
  final Ref ref;
  Db get _db => ref.read(dbProvider);

  @override
  Future<Object?> recap(int year) => _db.rpc<Object?>('anacan_recap_v1', params: {'p_year': year});

  @override
  Future<Map<String, String>> toolLabels(String language) async {
    final rows = asRows(await _db.from('tool_configs').select().or('is_active.eq.true,tool_id.in.(${recapCodeToolIds.join(',')})'));
    final live = rows.where((r) => r['is_active'] == true || recapCodeToolIds.contains(r['tool_id']));
    final mapped = mapRowsTranslation(live.toList(), language, const ['name', 'description', 'partner_name', 'partner_description', 'hero_subtitle', 'hero_badge']);
    return {
      for (final r in mapped)
        if (r['tool_id'] is String) r['tool_id'] as String: ('${(r['display_name'] as String?)?.isNotEmpty == true ? r['display_name'] : (r['name'] ?? '')}').trim(),
    };
  }

  @override
  Future<Map<String, String>> symptomLabels(String language) async {
    final rows = asRows(await _db.from('symptoms').select().eq('is_active', true).order('sort_order'));
    return {
      for (final r in mapRowsTranslation(rows, language, const ['label']))
        if (r['symptom_key'] is String) r['symptom_key'] as String: ((r['label'] as String?) ?? '').trim(),
    };
  }
}

final recapRepositoryProvider = Provider<RecapRepository>((ref) => SupabaseRecapRepository(ref));

String _errorText(Object error) => error is PostgrestException ? '${error.code ?? ''} ${error.message}' : '$error';

/// `useQuery({ queryKey: [RECAP_ROOT, backendUrl, uid, year] })`: parsed RecapResult (`available` true/false).
final recapQuery = queryProviderFamily<Map<String, Object?>, int>((ref, year) {
  final uid = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(backendUrlProvider);
  return QueryOptions<Map<String, Object?>>(
    queryKey: [recapRoot, backend, uid, year],
    enabled: uid != null,
    staleTime: const Duration(minutes: 10),
    retry: retryTimes(1),
    queryFn: (_) async {
      try {
        return parseRecap(await ref.read(recapRepositoryProvider).recap(year));
      } catch (error) {
        // Not deployed on this backend → simply hidden.
        if (RegExp('anacan_recap_v1|PGRST202|42883').hasMatch(_errorText(error))) return {'available': false, 'reason': 'missing', 'opens_at': null};
        rethrow;
      }
    },
  );
}, name: 'recapQuery');

/// `useRecap(year)`.
class RecapState {
  const RecapState({this.recap, this.result, this.isLoading = false, this.isError = false});

  /// Set only when the server says `available: true` (admins any time; everyone from the configured start).
  final Map<String, Object?>? recap;
  final Map<String, Object?>? result;
  final bool isLoading;
  final bool isError;
}

final recapProvider = Provider.autoDispose.family<RecapState, int>((ref, year) {
  final uid = ref.watch(authUserProvider)?.id;
  final q = ref.watch(recapQuery(year));
  final result = uid != null ? q.data : null;
  return RecapState(recap: result?['available'] == true ? result : null, result: result, isLoading: uid != null && q.isLoading, isError: q.isError);
}, name: 'recapProvider');

/// `useRecapProfileRow()`: `{id: 'recap', label: 'Anacan Recap <year>', sub}` while the recap is available.
final recapProfileRowFromRecapProvider = Provider.autoDispose<ProfileRowData?>((ref) {
  final recap = ref.watch(recapProvider(recapYear)).recap;
  if (recap == null) return null;
  return ProfileRowData(id: 'recap', label: ['Anacan Recap', recap['year']].join(' '), sub: rt('recap_profile_sub'));
});

/// `useRecap(RECAP_YEAR).recap?.year` as the query result the home card watches (`recapHomeYearQuery`).
class RecapHomeYearNotifier extends QueryNotifier<int?> {
  RecapHomeYearNotifier() : super((_) => const QueryOptions<int?>(queryKey: ['anacan-recap-home-unused'], enabled: false));

  @override
  QueryResult<int?> build() {
    final s = ref.watch(recapProvider(recapYear));
    final y = s.recap?['year'];
    return QueryResult<int?>(
      data: y is num ? y.toInt() : null,
      error: null,
      status: s.isError ? QueryStatus.error : (s.result != null ? QueryStatus.success : QueryStatus.pending),
      fetchStatus: s.isLoading ? FetchStatus.fetching : FetchStatus.idle,
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      isStale: false,
      isPlaceholderData: false,
      isFetchedAfterMount: s.result != null,
    );
  }
}

// ── Labels (RecapScreen: tool / milestone / symptom names) ──────────────────────────────────────

/// Own keys (the tools / flow features own `['tool-configs', …]` / `['symptoms', …]` with their own row types).
final recapToolLabelsQuery = queryProvider<Map<String, String>>((ref) {
  final language = ref.watch(appLanguageProvider);
  return QueryOptions<Map<String, String>>(
    queryKey: ['recap-tool-labels', language],
    staleTime: const Duration(minutes: 10),
    queryFn: (_) => ref.read(recapRepositoryProvider).toolLabels(language),
  );
}, name: 'recapToolLabelsQuery');

final recapSymptomLabelsQuery = queryProvider<Map<String, String>>((ref) {
  final language = ref.watch(appLanguageProvider);
  return QueryOptions<Map<String, String>>(
    queryKey: ['recap-symptom-labels', language],
    staleTime: const Duration(minutes: 10),
    queryFn: (_) => ref.read(recapRepositoryProvider).symptomLabels(language),
  );
}, name: 'recapSymptomLabelsQuery');

/// Milestone names (`useBabyMilestonesDB`, the baby feature's query and key).
final recapMilestoneLabelsProvider = Provider.autoDispose<Map<String, String>>((ref) {
  final rows = ref.watch(babyMilestonesDbQuery).data ?? const [];
  return {for (final m in rows) m.id: m.label.trim()};
});

String? _nonEmpty(String? v) => v != null && v.isNotEmpty ? v : null;

/// RecapLabels from the three sources (`toolMap.get(id) || null`).
final recapLabelsProvider = Provider.autoDispose<RecapLabels>((ref) {
  final tools = ref.watch(recapToolLabelsQuery).data ?? const <String, String>{};
  final milestones = ref.watch(recapMilestoneLabelsProvider);
  final symptoms = ref.watch(recapSymptomLabelsQuery).data ?? const <String, String>{};
  return RecapLabels(tool: (id) => _nonEmpty(tools[id]), milestone: (id) => _nonEmpty(milestones[id]), symptom: (id) => _nonEmpty(symptoms[id]));
});

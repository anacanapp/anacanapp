// Ported from: the supabase calls of src/hooks/{useChildren,useBabyLogs,useBabyLogsRange,useBabyDailyInfo,
//              useMommyDailyMessages,useBabyMilestones,useDynamicConfig(useBabyMilestonesDB),useBabyCrisisPeriods,
//              useTeething,useDevelopmentTips,useBabyInsight,usePendingTimerStops}.ts,
//              src/components/mommy/{GrowthTrackerWidget,PrematurityBackfillCard}.tsx
//
// Every network access of the mommy home / baby care hooks goes through [BabyRepository], so the hooks can be
// tested with a fake. [SupabaseBabyRepository] issues exactly the PostgREST / Functions calls of the React code.
// Baby-log inserts do NOT go through here: they use the offline outbox (core/offline) like `saveWithOutbox`.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/data/realtime.dart';
import '../../../core/net/backend_providers.dart';

typedef DbRow = Map<String, dynamic>;

/// `{ data, error, status }` of `supabase.functions.invoke`.
class FunctionResult {
  const FunctionResult({this.data, this.error, this.status});
  final Object? data;
  final Object? error;
  final int? status;
}

abstract interface class BabyRepository {
  // user_children
  Future<List<DbRow>> loadActiveChildren(String userId);
  Future<DbRow?> loadProfileBabyFields(String userId);
  Future<void> insertChildRow(DbRow row);
  Future<DbRow?> insertChild(DbRow row);
  Future<void> updateChild(String childId, String userId, DbRow patch);
  Future<void> updateChildDueDate(String childId, String dueDate);

  // baby_logs
  Future<List<DbRow>> loadRecentBabyLogs(String userId, String? childId, String sinceIso);
  Future<List<DbRow>> loadBabyLogsSince(String userId, String? childId, String fromIso);
  Future<void> updateBabyLog(String id, String userId, DbRow updates);
  Future<void> deleteBabyLog(String id, String userId);
  Future<bool> babyLogExists(String userId, String logType, String startIso);

  /// `postgres_changes` on `baby_logs` filtered to the user; removed when [ref] is disposed (`removeChannel`).
  void watchBabyLogs(Ref ref, String channelPrefix, String userId, void Function() onChange);

  // content tables
  Future<DbRow?> babyDailyInfo(int dayNumber);
  Future<DbRow?> mommyDailyMessage(int dayNumber);
  Future<List<DbRow>> crisisPeriods();
  Future<List<DbRow>> developmentTips(String? ageGroup);
  Future<List<DbRow>> milestoneDefinitions();
  Future<List<DbRow>> teeth();

  // per-user rows
  Future<List<DbRow>> babyMilestones(String userId, String? childId);
  Future<DbRow?> insertBabyMilestone(DbRow row);
  Future<void> deleteBabyMilestone(String id);
  void watchBabyMilestones(Ref ref, String userId, void Function() onChange);
  Future<List<DbRow>> teethingLogs(String userId, String? childId);
  Future<List<DbRow>> growthEntries(String userId, String? childId);
  Future<DbRow> insertGrowthEntry(DbRow row);

  // edge function
  Future<FunctionResult> invokeBabyInsight(Map<String, Object?> body);
}

class SupabaseBabyRepository implements BabyRepository {
  SupabaseBabyRepository(this._client);
  final SupabaseClient Function() _client;
  SupabaseClient get client => _client();

  List<DbRow> _rows(Object? data) => [for (final r in (data as List? ?? const [])) Map<String, dynamic>.from(r as Map)];

  @override
  Future<List<DbRow>> loadActiveChildren(String userId) async =>
      _rows(await client.from('user_children').select().eq('user_id', userId).eq('is_active', true).order('sort_order'));

  @override
  Future<DbRow?> loadProfileBabyFields(String userId) =>
      client.from('profiles').select('baby_name, baby_birth_date, baby_gender, due_date').eq('user_id', userId).maybeSingle();

  @override
  Future<void> insertChildRow(DbRow row) => client.from('user_children').insert(row);

  @override
  Future<DbRow?> insertChild(DbRow row) => client.from('user_children').insert(row).select().maybeSingle();

  @override
  Future<void> updateChild(String childId, String userId, DbRow patch) =>
      client.from('user_children').update(patch).eq('id', childId).eq('user_id', userId);

  @override
  Future<void> updateChildDueDate(String childId, String dueDate) =>
      client.from('user_children').update({'due_date': dueDate}).eq('id', childId);

  @override
  Future<List<DbRow>> loadRecentBabyLogs(String userId, String? childId, String sinceIso) async {
    var q = client.from('baby_logs').select().eq('user_id', userId).gte('start_time', sinceIso);
    if (childId != null) q = q.eq('child_id', childId);
    return _rows(await q.order('start_time', ascending: false));
  }

  @override
  Future<List<DbRow>> loadBabyLogsSince(String userId, String? childId, String fromIso) =>
      loadRecentBabyLogs(userId, childId, fromIso);

  @override
  Future<void> updateBabyLog(String id, String userId, DbRow updates) =>
      client.from('baby_logs').update(updates).eq('id', id).eq('user_id', userId);

  @override
  Future<void> deleteBabyLog(String id, String userId) => client.from('baby_logs').delete().eq('id', id).eq('user_id', userId);

  @override
  Future<bool> babyLogExists(String userId, String logType, String startIso) async {
    final row = await client
        .from('baby_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('log_type', logType)
        .eq('start_time', startIso)
        .maybeSingle();
    return row != null;
  }

  @override
  void watchBabyLogs(Ref ref, String channelPrefix, String userId, void Function() onChange) {
    subscribePostgresChanges(ref, client,
        channelPrefix: channelPrefix, table: 'baby_logs', filter: 'user_id=eq.$userId', onChange: (_) => onChange());
  }

  @override
  Future<DbRow?> babyDailyInfo(int dayNumber) =>
      client.from('baby_daily_info').select().eq('day_number', dayNumber).eq('is_active', true).maybeSingle();

  @override
  Future<DbRow?> mommyDailyMessage(int dayNumber) =>
      client.from('mommy_daily_messages').select().eq('day_number', dayNumber).eq('is_active', true).maybeSingle();

  @override
  Future<List<DbRow>> crisisPeriods() async =>
      _rows(await client.from('baby_crisis_periods').select().eq('is_active', true).order('week_start'));

  @override
  Future<List<DbRow>> developmentTips(String? ageGroup) async {
    var q = client.from('development_tips').select().eq('is_active', true);
    if (ageGroup != null) q = q.eq('age_group', ageGroup);
    return _rows(await q.order('sort_order', ascending: true));
  }

  @override
  Future<List<DbRow>> milestoneDefinitions() async =>
      _rows(await client.from('baby_milestones_db').select().eq('is_active', true).order('sort_order'));

  @override
  Future<List<DbRow>> teeth() async => _rows(await client.from('baby_teeth_db').select().eq('is_active', true).order('sort_order'));

  @override
  Future<List<DbRow>> babyMilestones(String userId, String? childId) async {
    var q = client.from('baby_milestones').select().eq('user_id', userId);
    if (childId != null) q = q.eq('child_id', childId);
    return _rows(await q.order('achieved_at', ascending: false));
  }

  @override
  Future<DbRow?> insertBabyMilestone(DbRow row) => client.from('baby_milestones').insert(row).select().single();

  @override
  Future<void> deleteBabyMilestone(String id) => client.from('baby_milestones').delete().eq('id', id);

  @override
  void watchBabyMilestones(Ref ref, String userId, void Function() onChange) {
    subscribePostgresChanges(ref, client,
        channelPrefix: 'milestones-channel', table: 'baby_milestones', filter: 'user_id=eq.$userId', onChange: (_) => onChange());
  }

  @override
  Future<List<DbRow>> teethingLogs(String userId, String? childId) async {
    var q = client.from('user_teething_logs').select().eq('user_id', userId);
    if (childId != null) q = q.eq('child_id', childId);
    return _rows(await q);
  }

  @override
  Future<List<DbRow>> growthEntries(String userId, String? childId) async {
    var q = client.from('baby_growth').select().eq('user_id', userId);
    if (childId != null) q = q.eq('child_id', childId);
    return _rows(await q.order('entry_date', ascending: false).limit(10));
  }

  @override
  Future<DbRow> insertGrowthEntry(DbRow row) => client.from('baby_growth').insert(row).select().single();

  @override
  Future<FunctionResult> invokeBabyInsight(Map<String, Object?> body) async {
    try {
      final res = await client.functions.invoke('baby-insight', body: body);
      return FunctionResult(data: res.data, status: res.status);
    } on FunctionException catch (e) {
      return FunctionResult(error: e, status: e.status, data: e.details);
    } catch (e) {
      return FunctionResult(error: e, status: 0);
    }
  }
}

/// The repository (tests override it with a fake).
final babyRepositoryProvider = Provider<BabyRepository>((ref) => SupabaseBabyRepository(() => ref.read(supabaseClientProvider)));

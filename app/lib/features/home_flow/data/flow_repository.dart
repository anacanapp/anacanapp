// Ported from: src/hooks/useFlowDailyLogs.ts, src/hooks/usePeriodDayLogs.ts, src/hooks/useCycleHistory.ts,
//              src/hooks/useFlowReminders.ts, src/hooks/usePhaseTips.ts, src/hooks/useFlowData.ts,
//              src/components/flow/FlowDashboard.tsx (flow-upcoming-labels query),
//              src/components/flow/PeriodDelayBanner.tsx (delay notification writes), src/lib/ttc.ts (profile writes)
//
// Every PostgREST call the flow home makes, behind one interface so widget tests can substitute a fake.
// The Supabase implementation keeps the exact tables, filters, orders and payloads of the hooks.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/data/data.dart';

abstract class FlowRepository {
  Future<Rows> cycleHistory(String userId);
  Future<Row> updateCycle(String id, Map<String, Object?> updates);
  Future<void> deleteCycle(String id);

  /// `period_day_logs` ordered by log_date; [from]/[to] inclusive when given.
  Future<Rows> periodDayLogs(String userId, {String? from, String? to});

  /// `rpc('record_period_days', params)`; returns the raw RPC data.
  Future<Object?> recordPeriodDays(Map<String, Object?> params);

  Future<Row?> flowDailyLog(String userId, String date);

  /// `flow_daily_logs` between [start] and [end]; descending unless [ascending].
  Future<Rows> flowDailyLogs(String userId, String start, String end, {bool ascending = false});

  /// `select('log_date, mood, energy_level, pain_level, sleep_quality')`, mood not null, ascending.
  Future<Rows> flowMoodChart(String userId, String start, String end);

  /// `flow_symptoms_db` active, by sort_order.
  Future<Rows> flowSymptoms();

  /// `flow_insights` active, `phase.eq.<phase>,phase.is.null` when [phase] is set.
  Future<Rows> flowInsights(String? phase);

  /// `menstruation_phase_tips` of [phase], active, by sort_order.
  Future<Rows> phaseTips(String phase);

  /// `app_settings` key/value of the three flow labels.
  Future<Rows> upcomingLabels();

  Future<Rows> flowReminders(String userId);
  Future<Row> upsertReminder(Map<String, Object?> row);
  Future<Row> updateReminder(String id, Map<String, Object?> patch);
  Future<void> deleteReminder(String id);
  Future<void> upsertReminders(List<Map<String, Object?>> rows);

  /// PeriodDelayBanner: `user_preferences.last_delay_notification_at`.
  Future<String?> lastDelayNotificationAt(String userId);
  Future<void> insertNotification(Map<String, Object?> row);
  Future<void> setLastDelayNotificationAt(String userId, String iso);

  /// `profiles.update(patch).eq('user_id', userId)` (TTC goal/state, switch to pregnancy).
  Future<void> updateProfile(String userId, Map<String, Object?> patch);
}

class SupabaseFlowRepository implements FlowRepository {
  SupabaseFlowRepository(this.db);
  final Db db;

  @override
  Future<Rows> cycleHistory(String userId) async =>
      asRows(await db.from('cycle_history').select().eq('user_id', userId).order('cycle_number', ascending: false));

  @override
  Future<Row> updateCycle(String id, Map<String, Object?> updates) async =>
      asRow(await db.from('cycle_history').update(updates).eq('id', id).select().single())!;

  @override
  Future<void> deleteCycle(String id) async => db.from('cycle_history').delete().eq('id', id);

  @override
  Future<Rows> periodDayLogs(String userId, {String? from, String? to}) async {
    var q = db.from('period_day_logs').select().eq('user_id', userId);
    if (from != null) q = q.gte('log_date', from);
    if (to != null) q = q.lte('log_date', to);
    return asRows(await q.order('log_date', ascending: true));
  }

  @override
  Future<Object?> recordPeriodDays(Map<String, Object?> params) => db.rpc<Object?>('record_period_days', params: params);

  @override
  Future<Row?> flowDailyLog(String userId, String date) async =>
      asRow(await db.from('flow_daily_logs').select().eq('user_id', userId).eq('log_date', date).maybeSingle());

  @override
  Future<Rows> flowDailyLogs(String userId, String start, String end, {bool ascending = false}) async => asRows(await db
      .from('flow_daily_logs')
      .select()
      .eq('user_id', userId)
      .gte('log_date', start)
      .lte('log_date', end)
      .order('log_date', ascending: ascending));

  @override
  Future<Rows> flowMoodChart(String userId, String start, String end) async => asRows(await db
      .from('flow_daily_logs')
      .select('log_date, mood, energy_level, pain_level, sleep_quality')
      .eq('user_id', userId)
      .gte('log_date', start)
      .lte('log_date', end)
      .not('mood', 'is', null)
      .order('log_date', ascending: true));

  @override
  Future<Rows> flowSymptoms() async =>
      asRows(await db.from('flow_symptoms_db').select().eq('is_active', true).order('sort_order', ascending: true));

  @override
  Future<Rows> flowInsights(String? phase) async {
    var q = db.from('flow_insights').select().eq('is_active', true);
    if (phase != null && phase.isNotEmpty) q = q.or('phase.eq.$phase,phase.is.null');
    try {
      return asRows(await q.order('sort_order', ascending: true));
    } catch (_) {
      return const []; // useFlowInsights: errors are logged and an empty list returned
    }
  }

  @override
  Future<Rows> phaseTips(String phase) async => asRows(await db
      .from('menstruation_phase_tips')
      .select()
      .eq('phase', phase)
      .eq('is_active', true)
      .order('sort_order', ascending: true));

  @override
  Future<Rows> upcomingLabels() async => asRows(await db
      .from('app_settings')
      .select('key, value')
      .inFilter('key', ['flow_label_next_period', 'flow_label_fertile_window', 'flow_label_ovulation_day']));

  @override
  Future<Rows> flowReminders(String userId) async =>
      asRows(await db.from('flow_reminders').select().eq('user_id', userId).order('created_at', ascending: true));

  @override
  Future<Row> upsertReminder(Map<String, Object?> row) async =>
      asRow(await db.from('flow_reminders').upsert(row, onConflict: 'user_id,reminder_type').select().single())!;

  @override
  Future<Row> updateReminder(String id, Map<String, Object?> patch) async =>
      asRow(await db.from('flow_reminders').update(patch).eq('id', id).select().single())!;

  @override
  Future<void> deleteReminder(String id) async => db.from('flow_reminders').delete().eq('id', id);

  @override
  Future<void> upsertReminders(List<Map<String, Object?>> rows) async =>
      db.from('flow_reminders').upsert(rows, onConflict: 'user_id,reminder_type');

  @override
  Future<String?> lastDelayNotificationAt(String userId) async {
    final row = asRow(await db.from('user_preferences').select('last_delay_notification_at').eq('user_id', userId).maybeSingle());
    return row?.str('last_delay_notification_at');
  }

  @override
  Future<void> insertNotification(Map<String, Object?> row) async => db.from('notifications').insert(row);

  @override
  Future<void> setLastDelayNotificationAt(String userId, String iso) async =>
      db.from('user_preferences').update({'last_delay_notification_at': iso}).eq('user_id', userId);

  @override
  Future<void> updateProfile(String userId, Map<String, Object?> patch) async =>
      db.from('profiles').update(patch).eq('user_id', userId);
}

final flowRepositoryProvider = Provider<FlowRepository>((ref) => SupabaseFlowRepository(ref.watch(dbProvider)));

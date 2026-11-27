// Ported from: the supabase-js calls of src/hooks/{usePartnerData,usePartnerSharing,usePartnerRecentMoods,
//              usePartnerFamily,usePartnerMissions,usePartnerStats,usePartnerConfig,useSurprises,usePartnerDailyTips,
//              usePartnerNotifications,useSOSAlert,useDailySummary}.ts, src/components/partner/v2/{NextAppointmentCard,
//              PartnerBabyTodayCard,PartnerCareCard,AlertReceiver,PartnerNotificationsScreen}.tsx
//
// Every backend access of the partner feature goes through [PartnerBackend], so tests swap in an in-memory fake.
// Errors are thrown (supabase-js `{ error }` → exception); callers decide like the hooks did.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show SupabaseClient;

import '../../../core/data/data.dart';

typedef PartnerRow = Map<String, dynamic>;

/// A realtime `postgres_changes` payload (`payload.eventType`, `payload.new`).
class PartnerChange {
  const PartnerChange({required this.eventType, this.newRecord = const {}, this.oldRecord = const {}});

  /// 'INSERT' | 'UPDATE' | 'DELETE'.
  final String eventType;
  final PartnerRow newRecord;
  final PartnerRow oldRecord;
}

/// Profile columns the partner reads of the woman (`usePartnerData`).
const String kPartnerWomanColumns =
    'id, user_id, name, life_stage, last_period_date, due_date, baby_birth_date, baby_name, baby_gender, cycle_length, '
    'period_length, multiples_type, pregnancy_loss_date, loss_recovery_active, loss_share_partner, avatar_url';

abstract interface class PartnerBackend {
  /// `supabase.rpc(fn, params)`; throws on `error`.
  Future<Object?> rpc(String fn, [Map<String, dynamic>? params]);

  /// `from('profiles').select('user_id').eq('id', profileId).single()` → user_id (null on error / no row).
  Future<String?> profileUserId(String profileId);

  /// `from('profiles').select(<woman columns>).eq('id', profileId).maybeSingle()`; throws on error.
  Future<PartnerRow?> womanProfile(String profileId);

  /// `from(table).select(columns).eq(column, value).maybeSingle()`; throws on error.
  Future<PartnerRow?> maybeSingle(String table, String columns, String column, String value);

  /// `from('partner_sharing_settings').select('*').neq('user_id', userId).limit(1)`; throws on error.
  Future<List<PartnerRow>> sharingSettingsOfOthers(String userId);

  /// `from(table).upsert(row, { onConflict })`; throws on error.
  Future<void> upsert(String table, PartnerRow row, {required String onConflict});

  /// `from(table).upsert(row, { onConflict }).select().single()`; throws on error.
  Future<PartnerRow> upsertReturning(String table, PartnerRow row, {required String onConflict});

  /// `from(table).insert(row).select(columns).single()`; throws on error.
  Future<PartnerRow> insertReturning(String table, PartnerRow row, {String columns = '*'});

  /// `from(table).insert(row)`; throws on error.
  Future<void> insert(String table, PartnerRow row);

  /// `from(table).update(values).eq(k, v)…` with every [match] pair; throws on error.
  Future<void> update(String table, PartnerRow values, Map<String, Object> match);

  /// `from(table).delete().eq(k, v)…`; throws on error.
  Future<void> delete(String table, Map<String, Object> match);

  /// `from(table).select(columns).eq(k, v)… [.order(orderBy, ascending)] [.limit(n)]`; throws on error.
  Future<List<PartnerRow>> select(String table,
      {String columns = '*', Map<String, Object> eq = const {}, String? orderBy, bool ascending = true, int? limit});

  /// `from('sos_alerts').select('*').or(sender|receiver = user).order(created_at desc).limit(20)`.
  Future<List<PartnerRow>> sosAlerts(String userId);

  /// `from(table).select(columns).eq('user_id', userId).gte(column, from).lt(column, to)`.
  Future<List<PartnerRow>> rangeRows(String table, String columns, String userId, String column, String from, String to);

  /// `from('baby_logs').select(...).eq('user_id', userId).gte('start_time', fromIso)`.
  Future<List<PartnerRow>> babyLogsSince(String userId, String fromIso);

  /// The woman's next appointment from [today] (event_date asc, event_time asc nulls last, limit 1).
  Future<List<PartnerRow>> nextAppointment(String userId, String today);

  /// `from('partner_messages').select('id', {count: 'exact', head: true}).eq('sender_id', userId).in(types)`.
  Future<int> countSentMessages(String userId, List<String> types);

  /// `from(table).select('*').eq('is_active', true).order('sort_order') [.eq(extraColumn, extraValue)]`.
  Future<List<PartnerRow>> activeRows(String table, {String? extraColumn, Object? extraValue});

  /// `channel(prefix:uuid).on('postgres_changes', {event, table, filter}, cb).subscribe()`, removed with [ref].
  void subscribe(Ref ref,
      {required String channelPrefix, required String table, String event = '*', String? filter, required void Function(PartnerChange change) onChange});
}

class SupabasePartnerBackend implements PartnerBackend {
  SupabasePartnerBackend(this.db);
  final Db db;
  SupabaseClient get _client => db.client;

  @override
  Future<Object?> rpc(String fn, [Map<String, dynamic>? params]) => db.rpc<Object?>(fn, params: params);

  @override
  Future<String?> profileUserId(String profileId) async {
    try {
      final row = asRow(await db.from('profiles').select('user_id').eq('id', profileId).single());
      final id = row?['user_id'];
      return id is String ? id : null;
    } catch (_) {
      return null;
    }
  }

  @override
  Future<PartnerRow?> womanProfile(String profileId) async =>
      asRow(await db.from('profiles').select(kPartnerWomanColumns).eq('id', profileId).maybeSingle());

  @override
  Future<PartnerRow?> maybeSingle(String table, String columns, String column, String value) async =>
      asRow(await db.from(table).select(columns).eq(column, value).maybeSingle());

  @override
  Future<List<PartnerRow>> sharingSettingsOfOthers(String userId) async =>
      asRows(await db.from('partner_sharing_settings').select().neq('user_id', userId).limit(1));

  @override
  Future<void> upsert(String table, PartnerRow row, {required String onConflict}) async =>
      db.from(table).upsert(row, onConflict: onConflict);

  @override
  Future<PartnerRow> upsertReturning(String table, PartnerRow row, {required String onConflict}) async =>
      asRow(await db.from(table).upsert(row, onConflict: onConflict).select().single())!;

  @override
  Future<PartnerRow> insertReturning(String table, PartnerRow row, {String columns = '*'}) async =>
      asRow(await db.from(table).insert(row).select(columns).single())!;

  @override
  Future<void> insert(String table, PartnerRow row) async => db.from(table).insert(row);

  @override
  Future<void> update(String table, PartnerRow values, Map<String, Object> match) async {
    var q = db.from(table).update(values);
    for (final e in match.entries) {
      q = q.eq(e.key, e.value);
    }
    await q;
  }

  @override
  Future<void> delete(String table, Map<String, Object> match) async {
    var q = db.from(table).delete();
    for (final e in match.entries) {
      q = q.eq(e.key, e.value);
    }
    await q;
  }

  @override
  Future<List<PartnerRow>> select(String table,
      {String columns = '*', Map<String, Object> eq = const {}, String? orderBy, bool ascending = true, int? limit}) async {
    var q = db.from(table).select(columns);
    for (final e in eq.entries) {
      q = q.eq(e.key, e.value);
    }
    if (orderBy != null && limit != null) return asRows(await q.order(orderBy, ascending: ascending).limit(limit));
    if (orderBy != null) return asRows(await q.order(orderBy, ascending: ascending));
    if (limit != null) return asRows(await q.limit(limit));
    return asRows(await q);
  }

  @override
  Future<List<PartnerRow>> sosAlerts(String userId) async => asRows(await db
      .from('sos_alerts')
      .select()
      .or('sender_id.eq.$userId,receiver_id.eq.$userId')
      .order('created_at', ascending: false)
      .limit(20));

  @override
  Future<List<PartnerRow>> rangeRows(String table, String columns, String userId, String column, String from, String to) async =>
      asRows(await db.from(table).select(columns).eq('user_id', userId).gte(column, from).lt(column, to));

  @override
  Future<List<PartnerRow>> babyLogsSince(String userId, String fromIso) async => asRows(
      await db.from('baby_logs').select('log_type, start_time, end_time, amount_ml').eq('user_id', userId).gte('start_time', fromIso));

  @override
  Future<List<PartnerRow>> nextAppointment(String userId, String today) async => asRows(await db
      .from('appointments')
      .select('id, title, event_date, event_time, event_type')
      .eq('user_id', userId)
      .gte('event_date', today)
      .order('event_date', ascending: true)
      .order('event_time', ascending: true, nullsFirst: false)
      .limit(1));

  @override
  Future<int> countSentMessages(String userId, List<String> types) async =>
      await db.from('partner_messages').count().eq('sender_id', userId).inFilter('message_type', types);

  @override
  Future<List<PartnerRow>> activeRows(String table, {String? extraColumn, Object? extraValue}) async {
    var q = db.from(table).select().eq('is_active', true);
    if (extraColumn != null && extraValue != null) q = q.eq(extraColumn, extraValue);
    return asRows(await q.order('sort_order'));
  }

  @override
  void subscribe(Ref ref,
      {required String channelPrefix, required String table, String event = '*', String? filter, required void Function(PartnerChange change) onChange}) {
    subscribePostgresChanges(ref, _client,
        channelPrefix: channelPrefix,
        table: table,
        event: event,
        filter: filter,
        onChange: (payload) => onChange(PartnerChange(
              eventType: payload.eventType.name.toUpperCase(),
              newRecord: Map<String, dynamic>.from(payload.newRecord),
              oldRecord: Map<String, dynamic>.from(payload.oldRecord),
            )));
  }
}

/// The partner data access. Tests override it with a fake.
final partnerBackendProvider = Provider<PartnerBackend>((ref) => SupabasePartnerBackend(ref.watch(dbProvider)));

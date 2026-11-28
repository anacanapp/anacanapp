// Ported from: the supabase-js calls of src/lib/{illness,recovery,pregnancy-loss}.ts and
//              src/hooks/{useHealthReport,useDoctorReportExtras}.ts, src/hooks/useSubscription.ts (isPremium),
//              src/lib/local-notification-scheduler.ts (setLocalNotifications for illness reminders),
//              @capacitor/local-notifications (checkPermissions / requestPermissions in MedSheet)
//
// Seams of the health screens. Every backend access goes through [HealthScreensBackend] (tests use a fake).
// Defaults: the Supabase backend, not premium (the app root wires the entitlement), no local notifications
// (phase 9; the reminder plan with its ids and texts is built in illness.dart).
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/data/data.dart';
import '../../home_flow/flow_platform.dart' show FlowNotificationPlanner, NoopFlowNotificationPlanner;

typedef HealthRow = Map<String, dynamic>;

/// One page request of a report table (`fetchAllReportRows` callback of useHealthReport / useDoctorReportExtras).
class ReportPageRequest {
  const ReportPageRequest({
    required this.table,
    required this.fields,
    required this.userId,
    required this.orderColumn,
    this.childId,
    this.lte,
    this.gte,
    this.orFilter,
  });
  final String table;
  final String fields;
  final String userId;

  /// `.order(column).order('id')`.
  final String orderColumn;

  /// `.eq('child_id', childId)` when set.
  final String? childId;

  /// `.lte(orderColumn, value)`.
  final String? lte;

  /// `.gte(orderColumn, value)`.
  final String? gte;

  /// `.or(filter)` (baby logs: started or ended inside the period).
  final String? orFilter;

  @override
  String toString() => 'ReportPageRequest($table, $fields, lte: $lte, gte: $gte, or: $orFilter, child: $childId)';
}

abstract interface class HealthScreensBackend {
  /// `supabase.rpc(fn, params)`; throws on `error`.
  Future<Object?> rpc(String fn, [Map<String, dynamic>? params]);

  /// `from('profiles').select('user_id').eq('id', profileId).maybeSingle()` → user id.
  Future<String?> profileUserId(String profileId);

  /// `from('postpartum_checkins').select(...).eq('user_id').gte('day', since).order('day', desc)`; throws.
  Future<List<HealthRow>> checkins(String userId, String sinceDay);

  /// `from('postpartum_checkins').upsert(row, { onConflict: 'user_id,day' })`; throws.
  Future<void> upsertCheckin(HealthRow row);

  /// `from('profiles').update(values).eq('user_id', userId)`; throws.
  Future<void> updateProfile(String userId, HealthRow values);

  /// One page (`.range(from, to)`) of a report table; throws.
  Future<List<HealthRow>> reportPage(ReportPageRequest request, int from, int to);
}

class SupabaseHealthScreensBackend implements HealthScreensBackend {
  SupabaseHealthScreensBackend(this.db);
  final Db db;

  @override
  Future<Object?> rpc(String fn, [Map<String, dynamic>? params]) => db.rpc<Object?>(fn, params: params);

  @override
  Future<String?> profileUserId(String profileId) async {
    final row = asRow(await db.from('profiles').select('user_id').eq('id', profileId).maybeSingle());
    final id = row?['user_id'];
    return id is String ? id : null;
  }

  @override
  Future<List<HealthRow>> checkins(String userId, String sinceDay) async => asRows(await db
      .from('postpartum_checkins')
      .select('day, bleeding, pain, stitches, mood, flags, kegel_sessions')
      .eq('user_id', userId)
      .gte('day', sinceDay)
      .order('day', ascending: false));

  @override
  Future<void> upsertCheckin(HealthRow row) async {
    await db.from('postpartum_checkins').upsert(row, onConflict: 'user_id,day');
  }

  @override
  Future<void> updateProfile(String userId, HealthRow values) async {
    await db.from('profiles').update(values).eq('user_id', userId);
  }

  @override
  Future<List<HealthRow>> reportPage(ReportPageRequest r, int from, int to) async {
    var query = db.from(r.table).select(r.fields).eq('user_id', r.userId);
    if (r.childId != null) query = query.eq('child_id', r.childId!);
    if (r.lte != null) query = query.lte(r.orderColumn, r.lte!);
    if (r.gte != null) query = query.gte(r.orderColumn, r.gte!);
    if (r.orFilter != null) query = query.or(r.orFilter!);
    return asRows(await query.order(r.orderColumn, ascending: true).order('id', ascending: true).range(from, to));
  }
}

final healthScreensBackendProvider = Provider<HealthScreensBackend>((ref) => SupabaseHealthScreensBackend(ref.watch(dbProvider)));

/// `useSubscription().isPremium`. Default false; the app root wires the entitlement (register.dart).
final healthScreensIsPremiumProvider = Provider<bool>((ref) => false);

/// The central local-notification scheduler for the illness dose reminders (phase 9). Default: no-op.
final illnessReminderPlannerProvider = Provider<FlowNotificationPlanner>((ref) => const NoopFlowNotificationPlanner());

/// MedSheet's `LocalNotifications.checkPermissions()` / `requestPermissions()` when a reminder is on (phase 9).
/// Default: nothing (React's web / no-plugin branch).
final illnessNotificationPermissionProvider = Provider<Future<void> Function()>((ref) => () async {});

/// `navigator.language` (the °C / °F default).
final deviceLocaleProvider = Provider<String?>((ref) => PlatformDispatcher.instance.locale.toLanguageTag());

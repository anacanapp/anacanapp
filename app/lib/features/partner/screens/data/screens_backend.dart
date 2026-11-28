// Ported from: the supabase-js reads of src/components/partner/v2/{PartnerAppointmentsScreen,PartnerBabyDayScreen,
//              LiveContractionsScreen}.tsx, src/hooks/usePartnerWeeklyStats.ts (exercise_logs),
//              src/hooks/usePartnerFavoriteNames.ts (favorite_names)
//
// The table reads of the partner screens that the core [PartnerBackend] does not have (ranges, orderings).
// Errors are thrown (supabase-js `{ error }` → exception); the screens keep their previous / empty state like React.
// Realtime goes through the core `partnerBackendProvider.subscribe`.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/data/data.dart';

typedef ScreensRow = Map<String, dynamic>;

abstract interface class PartnerScreensBackend {
  /// `appointments` of [userId] from [fromDay] (event_date asc, event_time asc nulls last).
  Future<List<ScreensRow>> appointmentsFrom(String userId, String fromDay);

  /// `baby_logs` of [userId] since [fromIso] (start_time desc).
  Future<List<ScreensRow>> babyLogsSince(String userId, String fromIso);

  /// `contractions` of [userId] since [fromIso] (start_time desc, limit 30).
  Future<List<ScreensRow>> contractionsSince(String userId, String fromIso);

  /// `exercise_logs` of [userId] with completed_at in [fromIso, toIso).
  Future<List<ScreensRow>> exerciseLogs(String userId, String fromIso, String toIso);

  /// `favorite_names` of [userId] (created_at desc).
  Future<List<ScreensRow>> favoriteNames(String userId);
}

class SupabasePartnerScreensBackend implements PartnerScreensBackend {
  SupabasePartnerScreensBackend(this.db);
  final Db db;

  @override
  Future<List<ScreensRow>> appointmentsFrom(String userId, String fromDay) async => asRows(await db
      .from('appointments')
      .select('id, title, description, event_date, event_time, event_type')
      .eq('user_id', userId)
      .gte('event_date', fromDay)
      .order('event_date', ascending: true)
      .order('event_time', ascending: true, nullsFirst: false));

  @override
  Future<List<ScreensRow>> babyLogsSince(String userId, String fromIso) async => asRows(await db
      .from('baby_logs')
      .select('id, log_type, start_time, end_time, feed_type, diaper_type, amount_ml')
      .eq('user_id', userId)
      .gte('start_time', fromIso)
      .order('start_time', ascending: false));

  @override
  Future<List<ScreensRow>> contractionsSince(String userId, String fromIso) async => asRows(await db
      .from('contractions')
      .select('id, start_time, duration_seconds, interval_seconds')
      .eq('user_id', userId)
      .gte('start_time', fromIso)
      .order('start_time', ascending: false)
      .limit(30));

  @override
  Future<List<ScreensRow>> exerciseLogs(String userId, String fromIso, String toIso) async => asRows(await db
      .from('exercise_logs')
      .select('completed_at, duration_minutes, calories_burned')
      .eq('user_id', userId)
      .gte('completed_at', fromIso)
      .lt('completed_at', toIso));

  @override
  Future<List<ScreensRow>> favoriteNames(String userId) async =>
      asRows(await db.from('favorite_names').select().eq('user_id', userId).order('created_at', ascending: false));
}

/// The partner screens' table reads. Tests override it with a fake.
final partnerScreensBackendProvider = Provider<PartnerScreensBackend>((ref) => SupabasePartnerScreensBackend(ref.watch(dbProvider)));

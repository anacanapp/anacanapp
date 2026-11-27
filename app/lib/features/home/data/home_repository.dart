// Ported from: the supabase calls of src/hooks/{usePregnancyContent,useTrimesterTips,useDynamicContent (useWeeklyTips),
//              useFruitData,useFetusIllustrations,useDailyLogs,useAppointments,useBloodPressure,usePeriodDayLogs,
//              useServerStories,useRecap,useBlog}.ts
//
// All backend reads/writes of the home feature go through [HomeRepository], so widget tests swap in a fake
// ([homeRepositoryProvider] override) instead of a Supabase client.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/data/data.dart';
import '../../../core/offline/offline_outbox.dart' show SendResult;
import '../../../core/offline/outbox_senders.dart' show SupabaseOutboxSender;
import '../../../core/net/backend_providers.dart';

abstract interface class HomeRepository {
  /// `pregnancy_daily_content` row of [day] (exact, else the nearest earlier active day).
  Future<Row?> pregnancyContentByDay(int day);

  /// `trimester_tips` (active, by sort_order), optionally for one trimester.
  Future<Rows> trimesterTips(int? trimester);

  /// `weekly_tips` (active), filtered by week / life stage, ordered by week.
  Future<Rows> weeklyTips(int? week, String? lifeStage);

  /// `fruit_size_images` ordered by week ([] on error, like React).
  Future<Rows> fruitImages();

  /// `pregnancy_fetus_illustrations` (active, by month).
  Future<Rows> fetusIllustrations();

  /// `daily_logs` of the user, newest 30.
  Future<Rows> dailyLogs(String userId);

  /// `blood_pressure_logs`, newest first.
  Future<Rows> bloodPressureLogs(String userId);

  /// `appointments` ordered by event_date.
  Future<Rows> appointments(String userId);
  Future<Row> updateAppointment(String userId, String id, Map<String, Object?> updates);
  Future<void> deleteAppointment(String userId, String id);

  /// `period_day_logs` of the user ordered by date.
  Future<Rows> periodDayLogs(String userId);

  /// `get_app_stories_v1(p_language)` raw rows.
  Future<List<Object?>> appStories(String language);

  /// `anacan_recap_v1(p_year)` raw result (null when the RPC is missing on this backend).
  Future<Object?> recap(int year);

  /// Published blog posts, newest first (limit 200) — `useBlog().posts` until the blog feature is wired.
  Future<Rows> blogPosts();

  /// Outbox sender (one row / one water delta).
  Future<SendResult> send(String table, Map<String, Object?> row);
}

class SupabaseHomeRepository implements HomeRepository {
  SupabaseHomeRepository(this.ref);
  final Ref ref;

  Db get _db => ref.read(dbProvider);

  @override
  Future<Row?> pregnancyContentByDay(int day) async {
    final exact = await _db.from('pregnancy_daily_content').select().eq('pregnancy_day', day).eq('is_active', true).maybeSingle();
    if (exact != null) return asRow(exact);
    final nearest = await _db.query(
      () => _db
          .from('pregnancy_daily_content')
          .select()
          .lt('pregnancy_day', day)
          .eq('is_active', true)
          .order('pregnancy_day', ascending: false)
          .limit(1)
          .maybeSingle(),
    );
    return asRow(nearest.data);
  }

  @override
  Future<Rows> trimesterTips(int? trimester) async {
    var q = _db.from('trimester_tips').select().eq('is_active', true);
    if (trimester != null && trimester != 0) q = q.eq('trimester', trimester);
    return asRows(await q.order('sort_order', ascending: true));
  }

  @override
  Future<Rows> weeklyTips(int? week, String? lifeStage) async {
    var q = _db.from('weekly_tips').select().eq('is_active', true);
    if (week != null && week != 0) q = q.eq('week_number', week);
    if (lifeStage != null && lifeStage.isNotEmpty) q = q.eq('life_stage', lifeStage);
    return asRows(await q.order('week_number', ascending: true));
  }

  @override
  Future<Rows> fruitImages() async {
    final r = await _db.query(() => _db.from('fruit_size_images').select().order('week_number'));
    return r.ok ? asRows(r.data) : <Row>[];
  }

  @override
  Future<Rows> fetusIllustrations() async =>
      asRows(await _db.from('pregnancy_fetus_illustrations').select().eq('is_active', true).order('month_number'));

  @override
  Future<Rows> dailyLogs(String userId) async =>
      asRows(await _db.from('daily_logs').select().eq('user_id', userId).order('log_date', ascending: false).limit(30));

  @override
  Future<Rows> bloodPressureLogs(String userId) async =>
      asRows(await _db.from('blood_pressure_logs').select().eq('user_id', userId).order('measured_at', ascending: false).limit(90));

  static const appointmentColumns = 'id, user_id, title, description, event_date, event_time, event_type, reminder_enabled, created_at';

  @override
  Future<Rows> appointments(String userId) async =>
      asRows(await _db.from('appointments').select(appointmentColumns).eq('user_id', userId).order('event_date', ascending: true));

  @override
  Future<Row> updateAppointment(String userId, String id, Map<String, Object?> updates) async =>
      asRow(await _db.from('appointments').update(updates).eq('id', id).eq('user_id', userId).select(appointmentColumns).single())!;

  @override
  Future<void> deleteAppointment(String userId, String id) async {
    await _db.from('appointments').delete().eq('id', id).eq('user_id', userId);
  }

  @override
  Future<Rows> periodDayLogs(String userId) async => asRows(await _db.from('period_day_logs').select().eq('user_id', userId).order('log_date'));

  @override
  Future<List<Object?>> appStories(String language) async {
    final rows = await _db.rpc<Object?>('get_app_stories_v1', params: {'p_language': language});
    return rows is List ? List<Object?>.from(rows) : <Object?>[];
  }

  @override
  Future<Object?> recap(int year) async {
    final r = await _db.rpcResult('anacan_recap_v1', params: {'p_year': year});
    if (r.error != null) {
      final text = r.error.toString();
      if (RegExp('anacan_recap_v1|PGRST202|42883').hasMatch(text)) return null;
      throw r.error!;
    }
    return r.data;
  }

  @override
  Future<Rows> blogPosts() async => asRows(
    await _db
        .from('blog_posts')
        .select('*, blog_post_categories(category_id, blog_categories(slug))')
        .eq('is_published', true)
        .order('created_at', ascending: false)
        .limit(200),
  );

  @override
  Future<SendResult> send(String table, Map<String, Object?> row) => SupabaseOutboxSender(ref.read(supabaseClientProvider))(table, row);
}

final homeRepositoryProvider = Provider<HomeRepository>((ref) => SupabaseHomeRepository(ref));

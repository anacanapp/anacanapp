// Ported from: src/hooks/useDailySummary.ts
//
// The mother's day for her partner (`daily_summaries`): kept up to date silently (1.5 s after a change of her
// daily log, kicks or contractions), sent on request with a partner message; the partner reads it masked by her
// sharing settings (`partner_daily_summaries_v1`).
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../domain/dates/local_date.dart';
import 'partner_backend.dart';
import 'partner_family.dart' show asRowsList;

/// `DailySummary` row.
@immutable
class DailySummary {
  DailySummary(Map<String, dynamic> row) : row = Map.unmodifiable(row);
  final Map<String, dynamic> row;

  String get id => '${row['id'] ?? ''}';
  String get summaryDate => '${row['summary_date'] ?? ''}';
  int? get mood => row['mood'] is num ? (row['mood'] as num).toInt() : null;
  List<String>? get symptoms => row['symptoms'] is List ? [for (final s in row['symptoms'] as List) if (s is String) s] : null;
  num get waterIntake => row['water_intake'] is num ? row['water_intake'] as num : 0;
  int get kickCount => row['kick_count'] is num ? (row['kick_count'] as num).toInt() : 0;
  int get contractionCount => row['contraction_count'] is num ? (row['contraction_count'] as num).toInt() : 0;
  String? get notes => row['notes'] is String ? row['notes'] as String : null;
  bool get isSent => row['is_sent'] == true;
  String? get sentAt => row['sent_at'] is String ? row['sent_at'] as String : null;
  String get createdAt => '${row['created_at'] ?? ''}';
}

@immutable
class DailySummaryState {
  const DailySummaryState({this.summaries = const [], this.todaySummary, this.loading = true});
  final List<DailySummary> summaries;
  final DailySummary? todaySummary;
  final bool loading;
}

/// Delay of the silent update after a source change (`debouncedUpdateSummary`).
const Duration kSummaryDebounce = Duration(milliseconds: 1500);

/// `useDailySummary()`.
final dailySummaryProvider = NotifierProvider.autoDispose<DailySummaryController, DailySummaryState>(DailySummaryController.new);

class DailySummaryController extends Notifier<DailySummaryState> {
  String? _userId;
  bool _isPartner = false;
  Timer? _debounce;
  PartnerBackend get _backend => ref.read(partnerBackendProvider);

  @override
  DailySummaryState build() {
    final userId = _userId = ref.watch(authUserProvider)?.id;
    _isPartner = ref.watch(authProfileProvider.select((p) => p?.lifeStage)) == 'partner';
    ref.onDispose(() {
      _debounce?.cancel();
      _debounce = null;
    });
    if (userId != null) {
      scheduleMicrotask(() {
        if (ref.mounted) unawaited(fetchSummaries());
      });
      // A summary row is either mine (user_id) or the one my partner sends me (partner_user_id): filter by role so
      // a change only reaches these two people.
      final column = _isPartner ? 'partner_user_id' : 'user_id';
      const prefix = 'summary_and_sources';
      _backend.subscribe(ref, channelPrefix: prefix, table: 'daily_summaries', filter: '$column=eq.$userId', onChange: (_) => unawaited(fetchSummaries()));
      for (final table in const ['daily_logs', 'kick_sessions', 'contractions']) {
        _backend.subscribe(ref, channelPrefix: prefix, table: table, filter: 'user_id=eq.$userId', onChange: (_) => debouncedUpdateSummary());
      }
    }
    return const DailySummaryState();
  }

  Future<String?> _partnerUserId() async {
    final linked = ref.read(authProfileProvider)?.linkedPartnerId;
    if (linked == null || linked.isEmpty) return null;
    return _backend.profileUserId(linked);
  }

  /// `fetchSummaries()` (`refetch`).
  Future<void> fetchSummaries() async {
    final userId = _userId;
    if (userId == null) return;
    try {
      // The partner reads summaries masked by her sharing settings.
      final rows = _isPartner
          ? asRowsList(await _backend.rpc('partner_daily_summaries_v1', {'p_limit': 30}))
          : await _backend.select('daily_summaries', eq: {'user_id': userId}, orderBy: 'summary_date', ascending: false, limit: 30);
      if (!ref.mounted) return;
      final summaries = [for (final r in rows) DailySummary(r)];
      final today = todayKey();
      state = DailySummaryState(summaries: summaries, todaySummary: summaries.where((s) => s.summaryDate == today).firstOrNull, loading: false);
    } catch (error) {
      debugPrint('Error fetching daily summaries: $error');
      if (ref.mounted) state = DailySummaryState(summaries: state.summaries, todaySummary: state.todaySummary, loading: false);
    }
  }

  /// Today's daily log, kick total and contraction count (each read like supabase-js: an error gives no data).
  Future<({Map<String, dynamic>? log, int kicks, int contractions})> _today(String userId, String today) async {
    final start = localDayStartIso(today);
    final end = localDayStartIso(daysAgoKey(-1));
    Future<T> safe<T>(Future<T> Function() run, T fallback) async {
      try {
        return await run();
      } catch (_) {
        return fallback;
      }
    }

    final results = await Future.wait<Object?>([
      safe<List<Map<String, dynamic>>>(() => _backend.select('daily_logs', eq: {'user_id': userId, 'log_date': today}), const []),
      safe<List<Map<String, dynamic>>>(() => _backend.rangeRows('kick_sessions', 'kick_count', userId, 'created_at', start, end), const []),
      safe<List<Map<String, dynamic>>>(() => _backend.rangeRows('contractions', 'id', userId, 'start_time', start, end), const []),
    ]);
    final logs = results[0] as List<Map<String, dynamic>>;
    // `.single()`: exactly one row, else no data.
    final log = logs.length == 1 ? logs.first : null;
    final kicks = (results[1] as List<Map<String, dynamic>>).fold<int>(0, (s, k) => s + (k['kick_count'] is num ? (k['kick_count'] as num).toInt() : 0));
    return (log: log, kicks: kicks, contractions: (results[2] as List).length);
  }

  static Object? _truthyOrNull(Object? v) => v == null || v == 0 || v == '' || v == false ? null : v;

  Map<String, dynamic> _summaryRow(String userId, String partnerUserId, String today, ({Map<String, dynamic>? log, int kicks, int contractions}) d) => {
        'user_id': userId,
        'partner_user_id': partnerUserId,
        'summary_date': today,
        'mood': _truthyOrNull(d.log?['mood']),
        'symptoms': d.log?['symptoms'],
        'water_intake': _truthyOrNull(d.log?['water_intake']) ?? 0,
        'kick_count': d.kicks,
        'contraction_count': d.contractions,
      };

  /// `updateSummarySilently()`: today's summary without a notification.
  Future<void> updateSummarySilently() async {
    final userId = _userId;
    if (userId == null || _isPartner) return;
    try {
      final partnerUserId = await _partnerUserId();
      if (partnerUserId == null) return;
      final today = todayKey();
      final d = await _today(userId, today);
      try {
        await _backend.upsert('daily_summaries', {..._summaryRow(userId, partnerUserId, today, d), 'is_sent': false}, onConflict: 'user_id,summary_date');
      } catch (_) {
        // supabase-js: the upsert error is not checked.
      }
      if (ref.mounted) await fetchSummaries();
    } catch (error) {
      debugPrint('Error auto-updating summary: $error');
    }
  }

  /// `debouncedUpdateSummary()`.
  void debouncedUpdateSummary() {
    _debounce?.cancel();
    _debounce = Timer(kSummaryDebounce, () {
      if (ref.mounted) unawaited(updateSummarySilently());
    });
  }

  /// `generateAndSendSummary()` → `{data, error}`.
  Future<({Map<String, dynamic>? data, Object? error})> generateAndSendSummary() async {
    final userId = _userId;
    if (userId == null || _isPartner) return (data: null, error: 'Only woman can send summary');
    try {
      final partnerUserId = await _partnerUserId();
      if (partnerUserId == null) return (data: null, error: 'No partner linked');
      final today = todayKey();
      final d = await _today(userId, today);
      final data = await _backend.upsertReturning(
          'daily_summaries', {..._summaryRow(userId, partnerUserId, today, d), 'is_sent': true, 'sent_at': DateTime.now().toUtc().toIso8601String()},
          onConflict: 'user_id,summary_date');

      const moodEmojis = ['😢', '😔', '😐', '🙂', '😊'];
      final mood = d.log?['mood'];
      final m = mood is num ? mood.toInt() : 0;
      final moodText = m != 0 ? (m >= 1 && m <= 5 ? moodEmojis[m - 1] : 'undefined') : '❓';
      final water = _truthyOrNull(d.log?['water_intake']) ?? 0;
      try {
        await _backend.insert('partner_messages', {
          'sender_id': userId,
          'receiver_id': partnerUserId,
          'message_type': 'daily_summary',
          'content': jsonEncode({
            'type': 'daily_summary',
            'title': tr('usedailysummary_gundelik_xulase_42932d', '📊 Gündəlik Xülasə'),
            'body': '${tr('usedailysummary_ehval', 'Əhval:')} $moodText | ${tr('usedailysummary_su', 'Su:')} ${water}ml | '
                '${tr('usedailysummary_tepikler', 'Təpiklər:')} ${d.kicks}',
            'summary': data,
            'timestamp': DateTime.now().toUtc().toIso8601String(),
          }),
        });
      } catch (_) {
        // supabase-js: the insert error is not checked.
      }
      if (ref.mounted) await fetchSummaries();
      return (data: data, error: null);
    } catch (error) {
      debugPrint('Error generating summary: $error');
      return (data: null, error: error);
    }
  }
}

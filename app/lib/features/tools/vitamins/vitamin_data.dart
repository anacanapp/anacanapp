// Ported from: src/hooks/useVitaminSchedules.ts, src/components/tools/VitaminTracker.tsx (the `all_raw_vitamins`
//              query and the saved-name translation)
//
// Vitamin schedules and today's intakes ("taken today" uses the phone's local day; the reminder job checks the Baku
// day, the same for users in Azerbaijan). Intakes go through the offline outbox.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Row, Rows, mapRowTranslation;
import '../../../core/i18n/tr.dart';
import '../../../core/offline/offline_outbox.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../domain/dates/local_date.dart';
import '../../../state/user_store.dart';
import '../health_common/health_common.dart';
import '../health_common/health_db.dart';

/// `['vitamin-schedules', userId]` ordered by time.
final vitaminSchedulesQuery = queryProvider<Rows>((ref) {
  final userId = ref.watch(healthUserIdProvider);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['vitamin-schedules', userId],
    enabled: userId != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      if (userId == null) return <Row>[];
      return db.select(HQuery('user_vitamin_schedules', filters: [eqF('user_id', userId)], order: const [(column: 'scheduled_time', ascending: true)]));
    },
  );
}, name: 'vitaminSchedulesQuery');

/// `['vitamin-logs-today', userId, today]`. Re-fetched when a background flush delivered queued intakes.
final vitaminLogsTodayQuery = queryProvider<Rows>((ref) {
  final userId = ref.watch(healthUserIdProvider);
  final db = ref.watch(healthDbProvider);
  final today = todayKey();
  if (userId != null) {
    final outbox = ref.watch(offlineOutboxProvider);
    final unsubscribe = outbox.subscribe((change) {
      if (change.userId == userId && change.sentTables.contains('vitamin_intake_logs')) {
        unawaited(ref.read(queryClientProvider).invalidateQueries(queryKey: const ['vitamin-logs-today']));
      }
    });
    final release = outbox.retainUser(userId);
    ref.onDispose(() {
      unsubscribe();
      release();
    });
  }
  return QueryOptions<Rows>(
    queryKey: ['vitamin-logs-today', userId, today],
    enabled: userId != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      if (userId == null) return <Row>[];
      return db.select(HQuery('vitamin_intake_logs', filters: [eqF('user_id', userId), eqF('log_date', today)]));
    },
  );
}, name: 'vitaminLogsTodayQuery');

/// `['all_raw_vitamins', language]` (1 h): every active vitamin row, untranslated (names are localized at render).
final allRawVitaminsQuery = queryProvider<Rows>((ref) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['all_raw_vitamins', language],
    staleTime: const Duration(hours: 1),
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      try {
        return await db.select(const HQuery('vitamins', filters: [(column: 'is_active', op: 'eq', value: true)]));
      } catch (_) {
        return <Row>[]; // `const { data } = await …; return data || []`
      }
    },
  );
}, name: 'allRawVitaminsQuery');

/// The vitamin name in the app language.
String localizedVitaminName(Row v, String language) => '${mapRowTranslation(v, language, const ['name'])?['name'] ?? ''}';

/// `getTranslatedVitaminName(savedName)`: a saved schedule name in the app language (DB row by name / name_az,
/// else the preset names, else the name as saved).
String translatedVitaminName(String savedName, Rows dbVitamins, String language) {
  if (savedName.isEmpty) return savedName;
  final normalized = savedName.trim().toLowerCase();
  for (final v in dbVitamins) {
    final name = v['name'], nameAz = v['name_az'];
    if ((name is String && name.toLowerCase() == normalized) || (nameAz is String && nameAz.toLowerCase() == normalized)) {
      return localizedVitaminName(v, language);
    }
  }
  return switch (normalized) {
    'folat (fol turşusu)' || 'folate (folic acid)' => tr('vitamintracker_folat_fol_tursusu_941d76', 'Folat (Fol turşusu)'),
    'd vitamini' || 'vitamin d' => tr('vitamintracker_d_vitamini', 'D vitamini'),
    'dəmir' || 'iron' => tr('vitamintracker_demir_30bf6c', 'Dəmir'),
    'kalsium' || 'calcium' => tr('vitamintracker_kalsium', 'Kalsium'),
    'omega-3' => tr('vitamintracker_omega_3', 'Omega-3'),
    'b12 vitamini' || 'vitamin b12' => tr('vitamintracker_b12_vitamini', 'B12 vitamini'),
    'c vitamini' || 'vitamin c' => tr('vitamintracker_c_vitamini', 'C vitamini'),
    'maqnezium' || 'magnesium' => tr('vitamintracker_maqnezium', 'Maqnezium'),
    'sink' || 'zinc' => tr('vitamintracker_sink', 'Sink'),
    'yod' || 'iodine' => tr('vitamintracker_yod', 'Yod'),
    'prenatal vitamin' => tr('vitamintracker_prenatal_vitamin', 'Prenatal vitamin'),
    'probiotik' || 'probiotic' => tr('vitamintracker_probiotik', 'Probiotik'),
    _ => savedName,
  };
}

class VitaminActions {
  VitaminActions(this._ref);
  final Ref _ref;

  QueryClient get _qc => _ref.read(queryClientProvider);

  Future<Row> addSchedule({required String name, required String emoji, required String scheduledTime, List<int>? days, bool? notification}) async {
    final userId = _ref.read(healthUserIdProvider);
    if (userId == null) throw StateError('Not authenticated');
    final data = await _ref.read(healthDbProvider).insert('user_vitamin_schedules', {
      'vitamin_name': name,
      'icon_emoji': emoji,
      'scheduled_time': scheduledTime,
      'days_of_week': ?days,
      'notification_enabled': ?notification,
      'user_id': userId,
    });
    unawaited(_qc.invalidateQueries(queryKey: const ['vitamin-schedules']));
    return data;
  }

  Future<void> updateSchedule(String id, Row updates) async {
    await _ref.read(healthDbProvider).update('user_vitamin_schedules', updates, [eqF('id', id)], single: true);
    unawaited(_qc.invalidateQueries(queryKey: const ['vitamin-schedules']));
  }

  Future<void> deleteSchedule(String id) async {
    await _ref.read(healthDbProvider).delete('user_vitamin_schedules', [eqF('id', id)]);
    unawaited(_qc.invalidateQueries(queryKey: const ['vitamin-schedules']));
  }

  /// `logIntake`: queued in the outbox first (client UUID, idempotent replay); shown as taken at once.
  Future<Row> logIntake(Row schedule) async {
    final userId = _ref.read(healthUserIdProvider);
    if (userId == null) throw StateError('Not authenticated');
    final outcome = await _ref.read(offlineOutboxProvider).saveWithOutbox(userId, 'vitamin_intake_logs', {
      'user_id': userId,
      'schedule_id': schedule['id'],
      'vitamin_name': schedule['vitamin_name'],
      'log_date': todayKey(),
      'taken_at': DateTime.now().toUtc().toIso8601String(),
    });
    if (outcome.status == SaveStatus.error) throw outcome.error ?? StateError('intake failed');
    final row = Map<String, dynamic>.from(outcome.data ?? const {});
    _qc.setQueryData<Rows>(['vitamin-logs-today', userId, todayKey()], (old) {
      final list = old ?? <Row>[];
      return list.any((l) => l['id'] == row['id']) ? list : [...list, row];
    });
    unawaited(_qc.invalidateQueries(queryKey: const ['vitamin-logs-today']));
    return row;
  }

  Future<void> undoIntake(String logId) async {
    await _ref.read(healthDbProvider).delete('vitamin_intake_logs', [eqF('id', logId)]);
    unawaited(_qc.invalidateQueries(queryKey: const ['vitamin-logs-today']));
  }
}

final vitaminActionsProvider = Provider<VitaminActions>(VitaminActions.new);

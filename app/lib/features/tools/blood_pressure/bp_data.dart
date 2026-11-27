// Ported from: src/hooks/useBloodPressure.ts
//
// `blood_pressure_logs` (the table may be missing before its migration → empty list, error swallowed). Same key as
// home's RedFlagBanner query (`['bp-logs']`), so both share one cache entry.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Row, Rows;
import '../health_common/health_common.dart';
import '../health_common/health_db.dart';

/// `useBloodPressureLogs()` → `['bp-logs']`, newest 90.
final bpLogsQuery = queryProvider<Rows>((ref) {
  final userId = ref.watch(healthUserIdProvider);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: const ['bp-logs'],
    enabled: userId != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      if (userId == null) return <Row>[];
      try {
        return await db.select(HQuery('blood_pressure_logs',
            filters: [eqF('user_id', userId)], order: const [(column: 'measured_at', ascending: false)], limit: 90));
      } catch (_) {
        return <Row>[];
      }
    },
  );
}, name: 'bpLogsQuery');

class BpActions {
  BpActions(this._ref);
  final Ref _ref;

  /// `useAddBpLog().mutateAsync`.
  Future<Row> add({required int systolic, required int diastolic, int? pulse, String? notes, String? measuredAt}) async {
    final userId = _ref.read(healthUserIdProvider);
    if (userId == null) throw StateError('Not authenticated');
    final data = await _ref.read(healthDbProvider).insert('blood_pressure_logs', {
      'user_id': userId,
      'systolic': systolic,
      'diastolic': diastolic,
      'pulse': pulse,
      'notes': notes,
      'measured_at': measuredAt ?? DateTime.now().toUtc().toIso8601String(),
    });
    unawaited(_ref.read(queryClientProvider).invalidateQueries(queryKey: const ['bp-logs']));
    return data;
  }

  /// `useDeleteBpLog().mutate`.
  Future<void> delete(String id) async {
    await _ref.read(healthDbProvider).delete('blood_pressure_logs', [eqF('id', id)]);
    unawaited(_ref.read(queryClientProvider).invalidateQueries(queryKey: const ['bp-logs']));
  }
}

final bpActionsProvider = Provider<BpActions>(BpActions.new);

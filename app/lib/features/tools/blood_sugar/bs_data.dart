// Ported from: src/components/tools/BloodSugarTracker.tsx (the useQuery / useMutation calls on blood_sugar_logs)
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Row, Rows;
import '../../../core/i18n/tr.dart';
import '../health_common/health_common.dart';
import '../health_common/health_db.dart';

/// `['blood-sugar-logs', userId]`, newest 100.
final bloodSugarLogsQuery = queryProvider<Rows>((ref) {
  final userId = ref.watch(healthUserIdProvider);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['blood-sugar-logs', userId],
    enabled: userId != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      if (userId == null) return <Row>[];
      return db.select(HQuery('blood_sugar_logs', filters: [eqF('user_id', userId)], order: const [(column: 'logged_at', ascending: false)], limit: 100));
    },
  );
}, name: 'bloodSugarLogsQuery');

class BloodSugarActions {
  BloodSugarActions(this._ref);
  final Ref _ref;

  /// `addLogMutation`: the reading is always stored in mg/dL.
  Future<void> add({required num? mgdl, required String readingType, String? mealContext, String notes = ''}) async {
    final userId = _ref.read(healthUserIdProvider);
    if (userId == null || mgdl == null) throw StateError(tr('bloodsugartracker_melumat_yoxdur_a3e271', 'Məlumat yoxdur'));
    await _ref.read(healthDbProvider).insert('blood_sugar_logs', {
      'user_id': userId,
      'reading_value': mgdl,
      'reading_type': readingType,
      'meal_context': mealContext,
      'notes': notes.isEmpty ? null : notes,
    });
    unawaited(_ref.read(queryClientProvider).invalidateQueries(queryKey: const ['blood-sugar-logs']));
  }

  /// `deleteLogMutation`.
  Future<void> delete(String id) async {
    await _ref.read(healthDbProvider).delete('blood_sugar_logs', [eqF('id', id)]);
    unawaited(_ref.read(queryClientProvider).invalidateQueries(queryKey: const ['blood-sugar-logs']));
  }
}

final bloodSugarActionsProvider = Provider<BloodSugarActions>(BloodSugarActions.new);

// Ported from: src/lib/recovery.ts (Checkin, StitchState, listCheckins, saveCheckin, saveBirthType),
//              src/components/recovery/RecoveryScreen.tsx (useRecoveryCheckins)
//
// The mother's own daily check-ins in postpartum_checkins (RLS: own rows only, never shared) and the birth type
// on her profile. Warning signs are evaluated on the device (recovery.dart), so an urgent sign shows even offline.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../core/cache/cache.dart';
import '../../domain/js_compat.dart';
import '../health_screens/common/health_ports.dart';
import 'recovery.dart';

/// 'fine' | 'sore' | 'red' | 'none'.
typedef StitchState = String;

class Checkin {
  const Checkin({required this.day, this.bleeding, this.pain, this.stitches, this.mood, this.flags = const [], this.kegelSessions = 0});
  final String day;
  final int? bleeding;
  final int? pain;
  final StitchState? stitches;
  final int? mood;
  final List<String> flags;
  final int kegelSessions;

  static int? _i(Object? v) => v is num ? v.toInt() : null;

  factory Checkin.fromRow(Map<String, dynamic> r) => Checkin(
        day: '${r['day']}',
        bleeding: _i(r['bleeding']),
        pain: _i(r['pain']),
        stitches: r['stitches'] is String ? r['stitches'] as String : null,
        mood: _i(r['mood']),
        flags: r['flags'] is List ? [for (final f in r['flags'] as List) if (f is String) f] : const [],
        kegelSessions: _i(r['kegel_sessions']) ?? 0,
      );

  Map<String, dynamic> toRow() =>
      {'day': day, 'bleeding': bleeding, 'pain': pain, 'stitches': stitches, 'mood': mood, 'flags': flags, 'kegel_sessions': kegelSessions};
}

/// `useRecoveryCheckins(days)`: the last [days] days, newest first.
final recoveryCheckinsQuery = queryProviderFamily<List<Checkin>, int>((ref, days) {
  final userId = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(healthScreensBackendProvider);
  return QueryOptions(
    queryKey: ['postpartum-checkins', userId, days],
    enabled: userId != null,
    staleTime: const Duration(seconds: 60),
    codec: QueryCodecs.models((Checkin c) => c.toRow(), Checkin.fromRow),
    queryFn: (_) async {
      final since = addDays(DomainClock.now(), -(days - 1));
      return [for (final r in await backend.checkins(userId!, isoDay(since))) Checkin.fromRow(r)];
    },
  );
}, name: 'recoveryCheckinsQuery');

class RecoveryActions {
  RecoveryActions(this._ref);
  final Ref _ref;

  /// `saveCheckin(userId, { day, ...patch })`: an upsert of the given fields; refreshes the check-ins.
  Future<void> saveCheckin(String userId, Map<String, Object?> patch, {String? day}) async {
    await _ref.read(healthScreensBackendProvider).upsertCheckin({
      'user_id': userId,
      'day': day ?? isoDay(DomainClock.now()),
      ...patch,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    });
    unawaited(_ref.read(queryClientProvider).invalidateQueries(queryKey: const ['postpartum-checkins']));
  }

  /// `saveBirthType(userId, type)`.
  Future<void> saveBirthType(String userId, BirthType type) => _ref.read(healthScreensBackendProvider).updateProfile(userId, {'birth_type': type});
}

final recoveryActionsProvider = Provider<RecoveryActions>(RecoveryActions.new);

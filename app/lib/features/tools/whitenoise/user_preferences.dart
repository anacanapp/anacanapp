// Ported from: src/hooks/useUserPreferences.ts
//
// `user_preferences` row of the signed-in user (white noise volume / timer / last sound): fetched once per user,
// created with the defaults when missing; every update replaces the row with the server's answer. Errors are
// logged and swallowed like the hook.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../health_common/health_db.dart' show HQuery, eqF;
import '../media_common/media_ports.dart';

class UserPreferencesState {
  const UserPreferencesState({this.preferences, this.loading = true});

  /// The row (`white_noise_volume`, `white_noise_timer`, `last_white_noise_sound`, …) or null.
  final Map<String, dynamic>? preferences;
  final bool loading;
}

final userPreferencesProvider = NotifierProvider.autoDispose<UserPreferences, UserPreferencesState>(UserPreferences.new);

class UserPreferences extends Notifier<UserPreferencesState> {
  String? _userId;

  @override
  UserPreferencesState build() {
    _userId = ref.watch(mediaAuthUserIdProvider);
    if (_userId != null) Future.microtask(fetch);
    return const UserPreferencesState();
  }

  MediaDb get _db => ref.read(mediaDbProvider);

  /// `fetchPreferences()` (`refetch`).
  Future<void> fetch() async {
    final userId = _userId;
    if (userId == null) return;
    try {
      final rows = await _db.select(HQuery('user_preferences', filters: [eqF('user_id', userId)]));
      if (!ref.mounted) return;
      if (rows.isEmpty) {
        await _createDefault(userId);
      } else {
        state = UserPreferencesState(preferences: rows.first, loading: state.loading);
      }
    } catch (error) {
      debugPrint('Error fetching user preferences');
    } finally {
      if (ref.mounted) state = UserPreferencesState(preferences: state.preferences, loading: false);
    }
  }

  Future<void> _createDefault(String userId) async {
    try {
      final row = await _db.upsert('user_preferences', {
        'user_id': userId,
        'white_noise_volume': 70,
        'white_noise_timer': null,
        'last_white_noise_sound': null,
      }, onConflict: 'user_id');
      if (row != null && ref.mounted) state = UserPreferencesState(preferences: row, loading: state.loading);
    } catch (_) {
      debugPrint('Error creating default preferences');
    }
  }

  /// `updatePreferences(updates)`.
  Future<void> updatePreferences(Map<String, Object?> updates) async {
    final userId = _userId;
    if (userId == null) return;
    try {
      final row = await _db.update('user_preferences', updates, [eqF('user_id', userId)], returning: true);
      if (row != null && ref.mounted) state = UserPreferencesState(preferences: row, loading: state.loading);
    } catch (_) {
      debugPrint('Error updating user preferences');
    }
  }

  Future<void> updateWhiteNoiseVolume(num volume) => updatePreferences({'white_noise_volume': volume});
  Future<void> updateWhiteNoiseTimer(int? timer) => updatePreferences({'white_noise_timer': timer});
  Future<void> updateLastWhiteNoiseSound(String? soundId) => updatePreferences({'last_white_noise_sound': soundId});
}

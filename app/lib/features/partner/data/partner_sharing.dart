// Ported from: src/hooks/usePartnerSharing.ts
//
// Partner Module 2.0 — what the mother shares. The mother (data owner) chooses what the partner may see; with no
// row (or no table yet) the defaults apply (everything on, weight off).
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import 'partner_backend.dart';

/// `PartnerSharingSettings`.
@immutable
class PartnerSharing {
  const PartnerSharing(this.values);

  /// `DEFAULT_SHARING`.
  static const PartnerSharing defaults = PartnerSharing(kDefaultSharing);

  final Map<String, bool> values;

  bool operator [](String key) => values[key] ?? false;
  bool get shareMood => this['share_mood'];
  bool get shareSymptoms => this['share_symptoms'];
  bool get shareWater => this['share_water'];
  bool get shareKicks => this['share_kicks'];
  bool get shareContractions => this['share_contractions'];
  bool get shareWeight => this['share_weight'];
  bool get shareAppointments => this['share_appointments'];
  bool get shareBabyLogs => this['share_baby_logs'];
  bool get shareCycle => this['share_cycle'];

  PartnerSharing withValue(String key, bool value) => PartnerSharing({...values, key: value});

  @override
  bool operator ==(Object other) => other is PartnerSharing && mapEquals(other.values, values);
  @override
  int get hashCode => Object.hashAll(kSharingKeys.map((k) => values[k]));
}

/// `DEFAULT_SHARING`.
const Map<String, bool> kDefaultSharing = {
  'share_mood': true,
  'share_symptoms': true,
  'share_water': true,
  'share_kicks': true,
  'share_contractions': true,
  'share_weight': false,
  'share_appointments': true,
  'share_baby_logs': true,
  'share_cycle': true,
};

/// `SharingKey`s in their declaration order.
final List<String> kSharingKeys = List.unmodifiable(kDefaultSharing.keys);

/// `pickSettings(row)`: defaults overlaid with the row's boolean columns.
PartnerSharing pickSharing(Object? row) {
  final out = Map<String, bool>.of(kDefaultSharing);
  if (row is Map) {
    for (final k in kSharingKeys) {
      if (row[k] is bool) out[k] = row[k] as bool;
    }
  }
  return PartnerSharing(out);
}

// ── Mother side: her own settings (read / write) ──────────────────────────────────────────────────────────────

@immutable
class PartnerSharingState {
  const PartnerSharingState({this.settings = PartnerSharing.defaults, this.loading = true, this.available = true});
  final PartnerSharing settings;
  final bool loading;

  /// The table exists.
  final bool available;

  PartnerSharingState copyWith({PartnerSharing? settings, bool? loading, bool? available}) =>
      PartnerSharingState(settings: settings ?? this.settings, loading: loading ?? this.loading, available: available ?? this.available);
}

/// `usePartnerSharing()` (mother side).
final partnerSharingProvider = NotifierProvider.autoDispose<PartnerSharingController, PartnerSharingState>(PartnerSharingController.new);

class PartnerSharingController extends Notifier<PartnerSharingState> {
  String? _userId;
  PartnerBackend get _backend => ref.read(partnerBackendProvider);

  @override
  PartnerSharingState build() {
    _userId = ref.watch(authUserProvider)?.id;
    scheduleMicrotask(() {
      if (ref.mounted) unawaited(fetchSettings());
    });
    return const PartnerSharingState();
  }

  /// `fetchSettings()` (`refetch`).
  Future<void> fetchSettings() async {
    final userId = _userId;
    if (userId == null) {
      state = state.copyWith(loading: false);
      return;
    }
    try {
      final row = await _backend.maybeSingle('partner_sharing_settings', '*', 'user_id', userId);
      if (!ref.mounted) return;
      state = state.copyWith(settings: pickSharing(row));
    } catch (error) {
      // The table is not created yet: continue with the defaults.
      debugPrint('partner_sharing_settings unavailable: $error');
      if (ref.mounted) state = state.copyWith(available: false);
    } finally {
      if (ref.mounted) state = state.copyWith(loading: false);
    }
  }

  /// `updateSetting(key, value)`: optimistic, rolled back on failure.
  Future<bool> updateSetting(String key, bool value) async {
    final userId = _userId;
    if (userId == null) return false;
    final prev = state.settings;
    final next = prev.withValue(key, value);
    state = state.copyWith(settings: next);
    try {
      await _backend.upsert(
          'partner_sharing_settings', {'user_id': userId, ...next.values, 'updated_at': DateTime.now().toUtc().toIso8601String()},
          onConflict: 'user_id');
      // Events sent from this device follow the new choice immediately.
      ref.read(ownSharingCacheProvider).invalidate();
      return true;
    } catch (error) {
      debugPrint('updateSetting failed: $error');
      if (ref.mounted) state = state.copyWith(settings: prev);
      return false;
    }
  }
}

// ── Partner side: the mother's settings (realtime) ───────────────────────────────────────────────────────────

@immutable
class PartnerSharedSettingsState {
  const PartnerSharedSettingsState({this.sharing = PartnerSharing.defaults, this.loading = true});
  final PartnerSharing sharing;
  final bool loading;
}

/// `usePartnerSharedSettings()` (partner side).
final partnerSharedSettingsProvider =
    NotifierProvider.autoDispose<PartnerSharedSettingsController, PartnerSharedSettingsState>(PartnerSharedSettingsController.new);

class PartnerSharedSettingsController extends Notifier<PartnerSharedSettingsState> {
  String? _userId;
  String? _linked;
  PartnerBackend get _backend => ref.read(partnerBackendProvider);

  @override
  PartnerSharedSettingsState build() {
    _userId = ref.watch(authUserProvider)?.id;
    final linked = _linked = ref.watch(authProfileProvider.select((p) => p?.linkedPartnerId));
    scheduleMicrotask(() {
      if (ref.mounted) unawaited(fetchSharing());
    });
    if (linked != null && linked.isNotEmpty) unawaited(_subscribe(linked));
    return const PartnerSharedSettingsState();
  }

  /// The mother's toggles update the partner UI at once — filtered to her user_id only.
  Future<void> _subscribe(String linked) async {
    String? motherUserId;
    try {
      final row = await _backend.maybeSingle('profiles', 'user_id', 'id', linked);
      motherUserId = row?['user_id'] as String?;
    } catch (_) {
      motherUserId = null;
    }
    if (!ref.mounted || motherUserId == null || _linked != linked) return;
    _backend.subscribe(ref,
        channelPrefix: 'partner-sharing-$linked',
        table: 'partner_sharing_settings',
        filter: 'user_id=eq.$motherUserId',
        onChange: (_) => unawaited(fetchSharing()));
  }

  /// `fetchSharing()` (`refetch`).
  Future<void> fetchSharing() async {
    final userId = _userId;
    final linked = _linked;
    if (userId == null || linked == null || linked.isEmpty) {
      state = PartnerSharedSettingsState(sharing: state.sharing, loading: false);
      return;
    }
    PartnerSharing next;
    try {
      // RLS: only my own row and the linked mother's row are visible.
      final rows = await _backend.sharingSettingsOfOthers(userId);
      next = rows.isNotEmpty ? pickSharing(rows.first) : PartnerSharing.defaults;
    } catch (_) {
      next = PartnerSharing.defaults;
    }
    if (ref.mounted) state = PartnerSharedSettingsState(sharing: next, loading: false);
  }
}

// ── Light cached check for the event bus (no hook) ───────────────────────────────────────────────────────────

/// `getOwnSharingSettings(userId)` / `invalidateSharingCache()`: one module-level entry, 60 s.
class OwnSharingCache {
  OwnSharingCache(this._backend, {DateTime Function()? now}) : _now = now ?? DateTime.now;
  final PartnerBackend Function() _backend;
  final DateTime Function() _now;
  ({String userId, PartnerSharing settings, DateTime ts})? _entry;

  static const Duration ttl = Duration(seconds: 60);

  Future<PartnerSharing> get(String userId) async {
    final e = _entry;
    if (e != null && e.userId == userId && _now().difference(e.ts) < ttl) return e.settings;
    try {
      PartnerSharing settings;
      try {
        settings = pickSharing(await _backend().maybeSingle('partner_sharing_settings', '*', 'user_id', userId));
      } catch (_) {
        // `{ error }` → defaults (and they are cached, as in React).
        settings = PartnerSharing.defaults;
      }
      _entry = (userId: userId, settings: settings, ts: _now());
      return settings;
    } catch (_) {
      return PartnerSharing.defaults;
    }
  }

  void invalidate() => _entry = null;
}

final ownSharingCacheProvider = Provider<OwnSharingCache>((ref) => OwnSharingCache(() => ref.read(partnerBackendProvider)));

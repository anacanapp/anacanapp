// Ported from: src/lib/privacyConsent.ts (PrivacyConsent, parse, getPrivacyConsent / usePrivacyConsent — read side)
//
// The device's privacy decision (`anacan_privacy_consent_v1` = `{analytics, ads, attribution, decidedAt}`), read from
// the LocalStore (the WebView localStorage the 53.0 migration imports). Read-only: the consent sheet / settings
// controls that write it belong to the consent feature (not ported yet; docs/flutter/WIRING.md). Readers follow
// store changes like `subscribePrivacyConsent`. [restorePrivacyConsent] ports the Preferences → localStorage restore
// of `loadPrivacyConsent` (run by the startup).
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/local_store.dart' show LocalStore;
import '../../state/persisted_store.dart' show localStoreProvider;
import '../storage/key_value_store.dart' show KeyValueStore;

const String kPrivacyConsentKey = 'anacan_privacy_consent_v1';

@immutable
class PrivacyConsent {
  const PrivacyConsent({this.analytics = false, this.ads = false, this.attribution = false, this.decidedAt});
  final bool analytics;
  final bool ads;
  final bool attribution;

  /// ISO timestamp of the decision; null = undecided (every optional channel off).
  final String? decidedAt;

  bool get decided => decidedAt != null;

  static const PrivacyConsent undecided = PrivacyConsent();

  /// `parse(raw)`: anything but an object with a string `decidedAt` is undecided.
  static PrivacyConsent parse(Object? value) {
    if (value is! Map || value['decidedAt'] is! String) return undecided;
    return PrivacyConsent(
      analytics: value['analytics'] == true,
      ads: value['ads'] == true,
      attribution: value['attribution'] == true,
      decidedAt: value['decidedAt'] as String,
    );
  }
}

/// `loadPrivacyConsent()` restore step (src/lib/privacyConsent.ts): the native Preferences copy survives WebView
/// storage eviction and is the only copy a 52 → 60 upgrade has (the key is not part of the 53.0 export), so when
/// it holds a decision that differs from the LocalStore one it is written to the LocalStore. Runs on every start
/// like React; never throws. Returns true when the LocalStore value changed.
Future<bool> restorePrivacyConsent(LocalStore store, KeyValueStore preferences) async {
  try {
    final raw = await preferences.get(kPrivacyConsentKey);
    if (raw == null) return false;
    Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } catch (_) {
      return false;
    }
    final stored = PrivacyConsent.parse(decoded);
    if (!stored.decided) return false;
    final local = PrivacyConsent.parse(store.readJson(kPrivacyConsentKey));
    if (local.decidedAt == stored.decidedAt) return false;
    store.writeJson(kPrivacyConsentKey, {
      'analytics': stored.analytics,
      'ads': stored.ads,
      'attribution': stored.attribution,
      'decidedAt': stored.decidedAt,
    });
    return true;
  } catch (_) {
    return false;
  }
}

/// `usePrivacyConsent()`.
final privacyConsentProvider = Provider<PrivacyConsent>((ref) {
  final store = ref.watch(localStoreProvider);
  final sub = store.changes.where((c) => c.key == kPrivacyConsentKey).listen((_) => ref.invalidateSelf());
  ref.onDispose(sub.cancel);
  try {
    return PrivacyConsent.parse(store.readJson(kPrivacyConsentKey));
  } catch (_) {
    return PrivacyConsent.undecided;
  }
});

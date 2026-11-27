// Ported from: src/lib/privacyConsent.ts (PrivacyConsent, parse, getPrivacyConsent / usePrivacyConsent — read side)
//
// The device's privacy decision (`anacan_privacy_consent_v1` = `{analytics, ads, attribution, decidedAt}`), read from
// the LocalStore (the WebView localStorage the 53.0 migration imports). Read-only: the consent sheet / settings
// controls that write it belong to the consent feature (not ported yet; docs/flutter/WIRING.md). Readers follow
// store changes like `subscribePrivacyConsent`.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/persisted_store.dart' show localStoreProvider;

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

// Ported from: src/lib/ads/storage.ts
//
// Per-mode ledger in the LocalStore (same key and JSON as the WebView localStorage `anacan.ads.ledger.v1:<mode>`,
// so the caps and a reward pause survive the move to Flutter). A malformed value starts a fresh ledger.
import 'dart:convert';

import '../../domain/ads/ads_config.dart';
import '../../domain/ads/ads_policy.dart';
import '../../state/local_store.dart';

String adLedgerKey(AdMode mode) => 'anacan.ads.ledger.v1:$mode';

bool _safeNonNegative(Object? v) => v is int && v >= 0 && v <= 9007199254740991;

bool _countIsValid(Object? value) => value is Map && _safeNonNegative(value['session']) && _safeNonNegative(value['day']) && _safeNonNegative(value['last']);

AdLedger readAdLedger(LocalStore store, AdMode mode, String sessionId, int now) {
  try {
    final stored = store.getItem(adLedgerKey(mode));
    if (stored == null || stored.isEmpty) return emptyAdLedger(now, sessionId);
    final value = jsonDecode(stored);
    if (value is! Map) return emptyAdLedger(now, sessionId);
    final date = value['date'], placements = value['placements'], pauseUntil = value['pause_until'], lastBanner = value['last_banner'];
    if (date is! String || !RegExp(r'^\d{4}-\d\d-\d\d$').hasMatch(date) || value['session_id'] is! String || !_countIsValid(value['fullscreen']) ||
        !_safeNonNegative(pauseUntil) || lastBanner is! int || placements is! Map ||
        placements.entries.any((e) => !adPlacementIds.contains(e.key) || !_countIsValid(e.value))) {
      return emptyAdLedger(now, sessionId);
    }
    return normalizeAdLedger(AdLedger.fromJson({for (final e in value.entries) '${e.key}': e.value}), now, sessionId);
  } catch (_) {
    return emptyAdLedger(now, sessionId);
  }
}

void writeAdLedger(LocalStore store, AdMode mode, AdLedger ledger) {
  try {
    store.setItem(adLedgerKey(mode), jsonEncode(ledger.toJson()));
  } catch (_) {/* In-memory caps remain active. */}
}

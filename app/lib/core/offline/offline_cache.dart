// Ported from: src/lib/offlineCache.ts
//
// Offline "last state" cache (children, profile, role, household premium) in the LocalStore under
// the same keys as localStorage: `anacan_ocache_v1:<key>` = `{userId, savedAt, data}`. Not a
// security layer (RLS protects the data); it keeps an offline open from falling back to onboarding.

import 'dart:convert';

import '../../state/local_store.dart';
import '../cache/persist_policy.dart';

const String offlineCachePrefix = 'anacan_ocache_v1:';

/// Prefixes removed on logout: offline caches and the AI baby-insight text. First aid (not personal)
/// and user-written local data (letters, notes; keyed by user id) are kept.
const List<String> logoutClearPrefixes = [offlineCachePrefix, 'anacan-baby-insight-v2:'];

const Duration offlineCacheMaxAge = Duration(days: 30);

class OfflineCache {
  OfflineCache(this.store, {int Function()? now}) : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  final LocalStore store;
  final int Function() _now;

  /// Bound to [userId]. React writes through the 2 MB disposable-cache budget; a file has none.
  void writeCache(String key, String userId, Object? data) {
    try {
      store.setItem(offlineCachePrefix + key, jsonEncode({'userId': userId, 'savedAt': _now(), 'data': data}));
    } catch (_) {
      // not JSON-encodable: skip quietly
    }
  }

  /// Only for the same user and within [maxAge] (default 30 days).
  T? readCache<T>(String key, String userId, {Duration maxAge = offlineCacheMaxAge}) {
    final envelope = store.readJson(offlineCachePrefix + key);
    if (envelope is! Map || envelope['userId'] != userId) return null;
    final savedAt = envelope['savedAt'];
    if (savedAt is! num || _now() - savedAt > maxAge.inMilliseconds) return null;
    final data = envelope['data'];
    return data is T ? data : null;
  }

  void clearCache(String key) => store.removeItem(offlineCachePrefix + key);

  /// Logout / account switch: every offline cache, the AI insight cache and the persisted query cache.
  void clearAllCaches() {
    clearPersistedQueryCache();
    store.removeWhere((key) => logoutClearPrefixes.any(key.startsWith));
  }
}

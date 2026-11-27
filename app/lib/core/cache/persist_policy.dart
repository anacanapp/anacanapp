// Ported from: src/lib/query-persist-policy.ts
//
// The persisted query cache holds only stable, offline-useful results. Community feed, chat,
// stories, polled results, admin/AdMob data and sensitive health results are never written to
// disk; neither is data loaded before the last logout / account switch.

import 'dart:async';

import 'query_client.dart';

/// Full-key (queryKey[0]) exclusions.
const Set<String> excludedQueryKeys = {
  'chat-media-v2', 'chat-media-v3', 'premium-access-v1', 'subscription', 'household-premium',
  'community-feed', 'community-ad-mine', 'community-profile-stats', 'community-connections',
  'group-posts', 'post-comments', 'single-post', 'stories', 'user-memberships',
};

/// Sensitive health results (mental health/EPDS, mood, blood pressure, blood sugar, illness,
/// health-sync data, doctor report) are never written to disk.
const Set<String> sensitiveHealthKeys = {
  'epds-assessments', 'mood-checkins', 'mood-checkin-today', 'partner-recent-moods', 'postpartum-checkins',
  'bp-logs', 'blood-sugar-logs',
  'illness-entries', 'illness-episodes',
  'health-daily', 'health-workouts', 'health-report-v2', 'doctor-report-extras-v1',
};

/// Prefix exclusions (chat and story families).
const List<String> excludedQueryPrefixes = ['chat-', 'story-'];

/// The localStorage key of the React persister; the Flutter file is named after it.
const String persistedQueryCacheKey = 'anacan-rq-cache';

/// Results polled more often than this are not persisted.
const Duration pollPersistLimit = Duration(milliseconds: 60000);

/// Where the persisted cache lives (a file in the app support dir; see deferred_persister.dart).
abstract interface class QueryPersistStorage {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> remove();
}

// Logout / account switch moment. Results loaded before it may stay in memory but are never
// persisted again; only data fetched afterwards is written.
int _clearedAt = 0;

/// Removes the persisted query cache and blocks re-writing data loaded before [now].
void clearPersistedQueryCache([QueryPersistStorage? storage, int? now]) {
  final at = now ?? DateTime.now().millisecondsSinceEpoch;
  if (at > _clearedAt) _clearedAt = at;
  final target = storage ?? defaultQueryPersistStorage;
  if (target != null) unawaited(target.remove().catchError((Object _) {}));
}

/// When the cache was last cleared (logout/account switch); deferred writes captured before are dropped.
int getPersistClearedAt() => _clearedAt;

/// Tests only.
void resetPersistClearMarkForTests() => _clearedAt = 0;

/// The app's persisted-cache storage (set by the bootstrap), used by [clearPersistedQueryCache]
/// when no storage is passed (React: `localStorage`).
QueryPersistStorage? defaultQueryPersistStorage;

/// What the policy looks at (`PersistCandidate`).
class PersistCandidate {
  const PersistCandidate({
    required this.queryKey,
    required this.status,
    this.dataUpdatedAt,
    this.meta,
    this.refetchInterval,
    this.hasRefetchIntervalFunction = false,
  });

  factory PersistCandidate.fromQuery(Query query) => PersistCandidate(
        queryKey: query.queryKey,
        status: query.state.status,
        dataUpdatedAt: query.state.dataUpdatedAt,
        meta: query.meta,
        refetchInterval: query.options?.refetchInterval,
        hasRefetchIntervalFunction: query.options?.refetchIntervalFor != null,
      );

  final List<Object?> queryKey;
  final QueryStatus status;
  final int? dataUpdatedAt;
  final Map<String, Object?>? meta;
  final Duration? refetchInterval;
  final bool hasRefetchIntervalFunction;
}

bool shouldPersistQuery(PersistCandidate query) {
  if (query.status != QueryStatus.success || query.meta?['persist'] == false) return false;
  if (_clearedAt != 0 && (query.dataUpdatedAt ?? 0) <= _clearedAt) return false;
  final head = query.queryKey.isEmpty ? null : query.queryKey.first;
  if (head is String) {
    if (excludedQueryKeys.contains(head) || sensitiveHealthKeys.contains(head)) return false;
    for (final prefix in excludedQueryPrefixes) {
      if (head.startsWith(prefix)) return false;
    }
  }
  final interval = query.refetchInterval;
  if (query.hasRefetchIntervalFunction ||
      (interval != null && interval > Duration.zero && interval <= pollPersistLimit)) {
    return false;
  }
  // Admin/AdMob data is not stored; only the string parts of the key are checked.
  for (final part in query.queryKey) {
    if (part is! String) continue;
    final lower = part.toLowerCase();
    if (lower.contains('admin') || lower.contains('admob')) return false;
  }
  return true;
}

/// [shouldPersistQuery] for a live cache entry (`dehydrateOptions.shouldDehydrateQuery`).
bool shouldPersistCachedQuery(Query query) => shouldPersistQuery(PersistCandidate.fromQuery(query));

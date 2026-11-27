// Ported from: src/App.tsx (PersistQueryClientProvider persistOptions), node_modules/@tanstack/
// query-persist-client-core (persistQueryClientRestore / persistQueryClientSubscribe) and
// query-core hydration.ts (dehydrate / hydrate).
//
// - Restore: a snapshot older than [maxAge] (7 days) or with another [buster] is removed, otherwise
//   its queries are hydrated (only when newer than what the cache holds). Restored data stays raw
//   JSON until an observer with a codec (or a matching JSON type) reads it.
// - Save: every added/removed/updated cache event hands a snapshot builder to the deferred
//   persister; only queries allowed by [shouldDehydrateQuery] (persist policy) are written.

import 'dart:async';

import 'package:flutter/widgets.dart' show AppLifecycleListener;

import 'deferred_persister.dart';
import 'persist_policy.dart';
import 'query_client.dart';

/// `anacan-rq-v1`, or `anacan-rq-v1:azure:<handoffSha256>` for a source-first build admitted to
/// the managed realm (so source/preview results are never hydrated after an authority change).
String queryCacheBuster({required bool sourceFirst, required bool azure, String? handoffSha256}) =>
    sourceFirst && azure ? 'anacan-rq-v1:azure:$handoffSha256' : 'anacan-rq-v1';

bool _isJson(Object? value) {
  if (value == null || value is String || value is bool) return true;
  if (value is num) return value.isFinite;
  if (value is List) return value.every(_isJson);
  if (value is Map) return value.entries.every((e) => e.key is String && _isJson(e.value));
  return false;
}

String _status(QueryStatus status) => status.name;

QueryStatus _parseStatus(Object? value) =>
    QueryStatus.values.firstWhere((s) => s.name == value, orElse: () => QueryStatus.success);

class QueryCachePersistence {
  QueryCachePersistence({
    required this.client,
    required this.persister,
    required this.buster,
    this.maxAge = QueryDefaults.cacheMaxAge,
    bool Function(Query query)? shouldDehydrateQuery,
    int Function()? now,
  })  : shouldDehydrateQuery = shouldDehydrateQuery ?? shouldPersistCachedQuery,
        _now = now ?? client.now;

  final QueryClient client;
  final DeferredQueryPersister persister;
  final String buster;
  final Duration maxAge;
  final bool Function(Query query) shouldDehydrateQuery;
  final int Function() _now;

  void Function()? _unsubscribe;
  AppLifecycleListener? _lifecycle;
  bool _isRestoring = false;

  /// `useIsRestoring()`.
  bool get isRestoring => _isRestoring;

  /// `dehydrate(queryClient, { shouldDehydrateQuery })`.
  PersistedClient dehydrate() {
    final queries = <Map<String, Object?>>[];
    for (final query in client.queries) {
      if (!shouldDehydrateQuery(query)) continue;
      Object? data = query.state.data;
      final codec = query.options?.codec;
      if (!query.rawPersisted && codec != null && data != null) {
        try {
          data = (codec as dynamic).toJson(data);
        } catch (_) {
          continue;
        }
      }
      if (!_isJson(data)) continue;
      final state = query.state;
      queries.add({
        'queryKey': query.queryKey,
        'queryHash': query.queryHash,
        'state': {
          'data': data,
          'dataUpdateCount': state.dataUpdateCount,
          'dataUpdatedAt': state.dataUpdatedAt,
          'error': null,
          'errorUpdateCount': state.errorUpdateCount,
          'errorUpdatedAt': state.errorUpdatedAt,
          'fetchFailureCount': 0,
          'fetchFailureReason': null,
          'fetchMeta': null,
          'isInvalidated': state.isInvalidated,
          'status': _status(state.status),
          'fetchStatus': 'idle',
        },
        if (query.meta != null && _isJson(_plainMeta(query.meta!))) 'meta': _plainMeta(query.meta!),
      });
    }
    return {
      'timestamp': _now(),
      'buster': buster,
      'clientState': {'mutations': const <Object?>[], 'queries': queries},
    };
  }

  static Map<String, Object?> _plainMeta(Map<String, Object?> meta) =>
      {for (final e in meta.entries) if (!e.key.startsWith('__')) e.key: e.value};

  /// `hydrate(queryClient, clientState)`.
  void hydrate(Map<String, Object?> clientState) {
    final queries = clientState['queries'];
    if (queries is! List) return;
    for (final entry in queries) {
      if (entry is! Map) continue;
      final key = entry['queryKey'];
      final state = entry['state'];
      if (key is! List || state is! Map) continue;
      final meta = entry['meta'];
      client.hydrateQuery(
        List<Object?>.from(key),
        QueryState(
          data: state['data'],
          dataUpdateCount: (state['dataUpdateCount'] as num?)?.toInt() ?? 0,
          dataUpdatedAt: (state['dataUpdatedAt'] as num?)?.toInt() ?? 0,
          errorUpdateCount: (state['errorUpdateCount'] as num?)?.toInt() ?? 0,
          errorUpdatedAt: (state['errorUpdatedAt'] as num?)?.toInt() ?? 0,
          isInvalidated: state['isInvalidated'] == true,
          status: _parseStatus(state['status']),
        ),
        meta: meta is Map ? Map<String, Object?>.from(meta) : null,
      );
    }
  }

  /// `persistQueryClientRestore`.
  Future<void> restore() async {
    _isRestoring = true;
    try {
      final persisted = await persister.restoreClient();
      if (persisted == null) return;
      final timestamp = persisted['timestamp'];
      if (timestamp is! num) {
        await persister.removeClient();
        return;
      }
      final expired = _now() - timestamp > maxAge.inMilliseconds;
      final busted = persisted['buster'] != buster;
      if (expired || busted) {
        await persister.removeClient();
        return;
      }
      final state = persisted['clientState'];
      if (state is Map<String, Object?>) hydrate(state);
    } catch (_) {
      await persister.removeClient();
    } finally {
      _isRestoring = false;
    }
  }

  /// `persistQueryClientSubscribe`: hand every cache change to the deferred persister. With
  /// [flushOnBackground] the snapshot is written when the app is paused/hidden/detached.
  void start({bool flushOnBackground = true}) {
    _unsubscribe ??= client.subscribe((event) {
      if (event.type == QueryCacheEventType.added ||
          event.type == QueryCacheEventType.removed ||
          event.type == QueryCacheEventType.updated) {
        persister.persistClient(dehydrate);
      }
    });
    if (flushOnBackground && _lifecycle == null) {
      void flush() => unawaited(persister.flush());
      _lifecycle = AppLifecycleListener(onHide: flush, onPause: flush, onDetach: flush);
    }
  }

  /// Writes now (e.g. from the shell's own lifecycle handling).
  Future<void> flush() => persister.flush();

  /// Logout: `clearPersistedQueryCache()` (file removed, pre-logout snapshots blocked).
  void clearPersisted() => clearPersistedQueryCache(persister.storage, _now());

  void stop() {
    _unsubscribe?.call();
    _unsubscribe = null;
    _lifecycle?.dispose();
    _lifecycle = null;
    persister.dispose();
  }
}

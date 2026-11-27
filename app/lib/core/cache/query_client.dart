// Ported from: src/App.tsx (QueryClient defaults), node_modules/@tanstack/query-core v5
// (query.ts, queryCache.ts, queryClient.ts, retryer.ts, focusManager.ts, onlineManager.ts).
//
// A small React-Query-equivalent: keyed queries with staleTime / gcTime, stale-while-revalidate,
// de-duplicated in-flight fetches, retry with exponential backoff that pauses offline, prefix
// invalidation, setQueryData / setQueriesData, cancel + optimistic snapshots. Observers
// (query_observer.dart) add refetch-on-mount / focus (app resume) / reconnect and polling.
//
// Defaults are the ones the React app runs with (src/App.tsx + TanStack v5 defaults):
//   staleTime 30 s, gcTime 7 days, retry 3 (delay min(1000·2^n, 30 000) ms),
//   refetchOnWindowFocus / refetchOnReconnect / refetchOnMount = when stale,
//   networkMode 'online' (fetches wait while offline), mutations retry 0.

import 'dart:async';
import 'dart:math' as math;

import 'query_key.dart';

enum QueryStatus { pending, error, success }

enum FetchStatus { fetching, paused, idle }

/// TanStack `networkMode`.
enum NetworkMode { online, always, offlineFirst }

/// `refetchOnMount` / `refetchOnWindowFocus` / `refetchOnReconnect`: `false` → never,
/// `true` → ifStale, `'always'` → always.
enum RefetchOn { never, ifStale, always }

/// `retry`: decides whether failure number [failureCount] (0-based, before increment) is retried.
typedef RetryPolicy = bool Function(int failureCount, Object error);

/// `retryDelay`.
typedef RetryDelay = Duration Function(int failureCount, Object error);

/// TanStack default retry delay: `Math.min(1000 * 2 ** failureCount, 30000)`.
Duration defaultRetryDelay(int failureCount, Object _) =>
    Duration(milliseconds: math.min(1000 * math.pow(2, failureCount).toInt(), 30000));

/// `retry: n`.
RetryPolicy retryTimes(int times) => (failureCount, _) => failureCount < times;

/// `retry: false`.
bool noRetry(int failureCount, Object error) => false;

/// Converts persisted JSON back into the query's data type (and back). Queries whose data is already
/// JSON (rows: `List<Map<String, dynamic>>`, maps, strings, numbers) need no codec.
class QueryDataCodec<T> {
  const QueryDataCodec({required this.toJson, required this.fromJson});
  final Object? Function(T data) toJson;
  final T Function(Object? json) fromJson;
}

/// Thrown into a fetch future when the fetch was cancelled (`CancelledError`).
class QueryCancelledException implements Exception {
  const QueryCancelledException();
  @override
  String toString() => 'QueryCancelledException';
}

/// `AbortSignal` of a query function.
class QueryCancelToken {
  final Completer<void> _done = Completer<void>();
  bool get isCancelled => _done.isCompleted;

  /// Completes when the fetch is cancelled (pass to `Abortable` / http aborts).
  Future<void> get whenCancelled => _done.future;
  void _cancel() {
    if (!_done.isCompleted) _done.complete();
  }
}

/// Direction of an infinite-query page fetch.
enum FetchDirection { forward, backward }

/// Context passed to a query function (`queryFn({ queryKey, signal, pageParam, meta })`).
class QueryFunctionContext {
  const QueryFunctionContext({
    required this.queryKey,
    required this.signal,
    this.meta,
    this.direction,
    this.currentData,
  });
  final QueryKey queryKey;
  final QueryCancelToken signal;
  final Map<String, Object?>? meta;

  /// Infinite queries: `fetchNextPage` / `fetchPreviousPage`; null for a (re)fetch of all pages.
  final FetchDirection? direction;

  /// Data in the cache when this fetch started (infinite queries extend it).
  final Object? currentData;
}

typedef QueryFn<T> = Future<T> Function(QueryFunctionContext context);

/// `useQuery` options. Every unset field falls back to [QueryDefaults].
class QueryOptions<T> {
  const QueryOptions({
    required this.queryKey,
    this.queryFn,
    this.enabled = true,
    this.staleTime,
    this.gcTime,
    this.retry,
    this.retryDelay,
    this.refetchOnMount,
    this.refetchOnWindowFocus,
    this.refetchOnReconnect,
    this.refetchInterval,
    this.refetchIntervalFor,
    this.refetchIntervalInBackground = false,
    this.networkMode,
    this.meta,
    this.placeholderData,
    this.initialData,
    this.initialDataUpdatedAt,
    this.codec,
  });

  final QueryKey queryKey;
  final QueryFn<T>? queryFn;
  final bool enabled;

  /// `Duration(days: 365000)` ≈ `Infinity`.
  final Duration? staleTime;
  final Duration? gcTime;
  final RetryPolicy? retry;
  final RetryDelay? retryDelay;
  final RefetchOn? refetchOnMount;
  final RefetchOn? refetchOnWindowFocus;
  final RefetchOn? refetchOnReconnect;

  /// Polling (`refetchInterval: ms`). Null/zero = off.
  final Duration? refetchInterval;

  /// `refetchInterval: (query) => ms | false`.
  final Duration? Function(Query query)? refetchIntervalFor;
  final bool refetchIntervalInBackground;
  final NetworkMode? networkMode;

  /// `meta` (e.g. `{'persist': false}`, read by the persist policy).
  final Map<String, Object?>? meta;

  /// `placeholderData: (previous) => …` (`keepPreviousData` = `(previous) => previous`).
  final T? Function(T? previous)? placeholderData;
  final T? initialData;
  final int? initialDataUpdatedAt;
  final QueryDataCodec<T>? codec;

  String get queryHash => hashQueryKey(queryKey);

  /// True when polling is configured (the persist policy reads it).
  bool get hasRefetchIntervalFunction => refetchIntervalFor != null;
}

/// Client-wide defaults (`new QueryClient({ defaultOptions })`).
class QueryDefaults {
  const QueryDefaults({
    this.staleTime = const Duration(seconds: 30),
    this.gcTime = const Duration(days: 7),
    this.retry,
    this.retryDelay = defaultRetryDelay,
    this.refetchOnMount = RefetchOn.ifStale,
    this.refetchOnWindowFocus = RefetchOn.ifStale,
    this.refetchOnReconnect = RefetchOn.ifStale,
    this.networkMode = NetworkMode.online,
    this.mutationRetry,
    this.mutationNetworkMode = NetworkMode.online,
  });

  /// The React app's `CACHE_MAX_AGE` (gcTime ≥ persist maxAge).
  static const Duration cacheMaxAge = Duration(days: 7);

  final Duration staleTime;
  final Duration gcTime;

  /// Null = TanStack default `3`.
  final RetryPolicy? retry;
  final RetryDelay retryDelay;
  final RefetchOn refetchOnMount;
  final RefetchOn refetchOnWindowFocus;
  final RefetchOn refetchOnReconnect;
  final NetworkMode networkMode;

  /// Null = TanStack default `0`.
  final RetryPolicy? mutationRetry;
  final NetworkMode mutationNetworkMode;

  RetryPolicy get effectiveRetry => retry ?? retryTimes(3);
  RetryPolicy get effectiveMutationRetry => mutationRetry ?? noRetry;
}

/// `onlineManager`.
class OnlineManager {
  OnlineManager({bool online = true}) : _online = online; // ignore: prefer_initializing_formals
  bool _online;
  final _controller = StreamController<bool>.broadcast(sync: true);

  bool get isOnline => _online;
  Stream<bool> get changes => _controller.stream;

  void setOnline(bool online) {
    if (online == _online) return;
    _online = online;
    _controller.add(online);
  }
}

/// `focusManager` (web: `visibilitychange`; Flutter: app lifecycle resumed / paused).
class FocusManager {
  FocusManager({bool focused = true}) : _focused = focused; // ignore: prefer_initializing_formals
  bool _focused;
  final _controller = StreamController<bool>.broadcast(sync: true);

  bool get isFocused => _focused;
  Stream<bool> get changes => _controller.stream;

  void setFocused(bool focused) {
    if (focused == _focused) return;
    _focused = focused;
    _controller.add(focused);
  }
}

/// Query state (`query.state`).
class QueryState {
  const QueryState({
    this.data,
    this.dataUpdateCount = 0,
    this.dataUpdatedAt = 0,
    this.error,
    this.errorUpdateCount = 0,
    this.errorUpdatedAt = 0,
    this.fetchFailureCount = 0,
    this.fetchFailureReason,
    this.isInvalidated = false,
    this.status = QueryStatus.pending,
    this.fetchStatus = FetchStatus.idle,
  });

  final Object? data;
  final int dataUpdateCount;
  final int dataUpdatedAt;
  final Object? error;
  final int errorUpdateCount;
  final int errorUpdatedAt;
  final int fetchFailureCount;
  final Object? fetchFailureReason;
  final bool isInvalidated;
  final QueryStatus status;
  final FetchStatus fetchStatus;

  /// `state.data !== undefined` (a query may hold `null` data after success).
  bool get hasData => status == QueryStatus.success || dataUpdatedAt > 0;

  QueryState copyWith({
    Object? data = _keep,
    int? dataUpdateCount,
    int? dataUpdatedAt,
    Object? error = _keep,
    int? errorUpdateCount,
    int? errorUpdatedAt,
    int? fetchFailureCount,
    Object? fetchFailureReason = _keep,
    bool? isInvalidated,
    QueryStatus? status,
    FetchStatus? fetchStatus,
  }) =>
      QueryState(
        data: identical(data, _keep) ? this.data : data,
        dataUpdateCount: dataUpdateCount ?? this.dataUpdateCount,
        dataUpdatedAt: dataUpdatedAt ?? this.dataUpdatedAt,
        error: identical(error, _keep) ? this.error : error,
        errorUpdateCount: errorUpdateCount ?? this.errorUpdateCount,
        errorUpdatedAt: errorUpdatedAt ?? this.errorUpdatedAt,
        fetchFailureCount: fetchFailureCount ?? this.fetchFailureCount,
        fetchFailureReason: identical(fetchFailureReason, _keep) ? this.fetchFailureReason : fetchFailureReason,
        isInvalidated: isInvalidated ?? this.isInvalidated,
        status: status ?? this.status,
        fetchStatus: fetchStatus ?? this.fetchStatus,
      );
}

const Object _keep = Object();

/// Something observing a query (QueryObserver, InfiniteQueryObserver).
abstract class QueryObserverBase {
  bool get isEnabled;
  void onQueryUpdate();
  void onFocus();
  void onOnline();
  Duration get staleTime;
}

class _Fetch {
  _Fetch(this.token, this.revertState);
  final QueryCancelToken token;
  final QueryState revertState;
  final Completer<Object?> completer = Completer<Object?>();
}

/// One cache entry.
class Query {
  Query._(this.client, this.queryKey, this.queryHash, this.state);

  final QueryClient client;
  final QueryKey queryKey;
  final String queryHash;
  QueryState state;

  /// The last options a fetch or observer supplied (queryFn, retry, codec…).
  QueryOptions<dynamic>? options;

  /// Restored from disk and not yet decoded by the query's codec.
  bool rawPersisted = false;

  final List<QueryObserverBase> _observers = [];
  _Fetch? _fetch;
  Timer? _gcTimer;
  bool _removed = false;

  List<QueryObserverBase> get observers => List.unmodifiable(_observers);
  int get observerCount => _observers.length;

  Duration get gcTime => options?.gcTime ?? client.defaults.gcTime;
  NetworkMode get networkMode => options?.networkMode ?? client.defaults.networkMode;
  Map<String, Object?>? get meta => options?.meta;

  /// `query.isActive()`.
  bool get isActive => _observers.any((o) => o.isEnabled);

  /// `query.isDisabled()`.
  bool get isDisabled => _observers.isNotEmpty ? !isActive : options?.queryFn == null;

  /// `isStaleByTime(staleTime)`.
  bool isStaleByTime(Duration staleTime) {
    if (state.isInvalidated || !state.hasData) return true;
    return state.dataUpdatedAt + staleTime.inMilliseconds <= client.now();
  }

  /// `query.isStale()`: stale for any enabled observer (or by default staleTime when unobserved).
  bool get isStale {
    if (state.isInvalidated || !state.hasData) return true;
    if (_observers.isEmpty) return isStaleByTime(options?.staleTime ?? client.defaults.staleTime);
    return _observers.any((o) => o.isEnabled && isStaleByTime(o.staleTime));
  }

  bool get _canFetch => networkMode != NetworkMode.online || client.onlineManager.isOnline;
  bool get _canContinue =>
      client.focusManager.isFocused && (networkMode == NetworkMode.always || client.onlineManager.isOnline);

  /// Decode persisted JSON with [codec] (first observer that knows the type).
  void decodeWith<T>(QueryDataCodec<T>? codec) {
    if (!rawPersisted || codec == null) return;
    rawPersisted = false;
    if (state.data == null) return;
    try {
      state = state.copyWith(data: codec.fromJson(state.data));
    } catch (_) {
      // Unreadable old shape: drop it, the next fetch replaces it.
      state = const QueryState();
    }
  }

  void addObserver(QueryObserverBase observer) {
    if (_observers.contains(observer)) return;
    _observers.add(observer);
    _gcTimer?.cancel();
    _gcTimer = null;
    client._notify(QueryCacheEvent(QueryCacheEventType.observerAdded, this));
  }

  void removeObserver(QueryObserverBase observer) {
    if (!_observers.remove(observer)) return;
    if (_observers.isEmpty) {
      // An abandoned first load is cancelled (TanStack cancels with revert when it has no data).
      _scheduleGc();
    }
    client._notify(QueryCacheEvent(QueryCacheEventType.observerRemoved, this));
  }

  void _scheduleGc() {
    _gcTimer?.cancel();
    final time = gcTime;
    if (time.inMilliseconds <= 0) {
      scheduleMicrotask(_optionalRemove);
      return;
    }
    _gcTimer = Timer(time, _optionalRemove);
  }

  void _optionalRemove() {
    if (_observers.isEmpty && state.fetchStatus == FetchStatus.idle) client._remove(this);
  }

  void _dispatch(QueryState next) {
    state = next;
    for (final observer in List.of(_observers)) {
      observer.onQueryUpdate();
    }
    client._notify(QueryCacheEvent(QueryCacheEventType.updated, this));
  }

  /// `query.setData(data, { updatedAt, manual })`.
  void setData(Object? data, {int? updatedAt, bool manual = false}) {
    rawPersisted = false;
    _dispatch(state.copyWith(
      data: data,
      dataUpdateCount: state.dataUpdateCount + 1,
      dataUpdatedAt: updatedAt ?? client.now(),
      error: null,
      isInvalidated: false,
      status: QueryStatus.success,
      fetchStatus: manual ? null : FetchStatus.idle,
      fetchFailureCount: manual ? null : 0,
      fetchFailureReason: manual ? _keep : null,
    ));
  }

  void invalidate() {
    if (!state.isInvalidated) _dispatch(state.copyWith(isInvalidated: true));
  }

  /// Resets to the initial state (`resetQueries`).
  void reset() {
    cancel(revert: false);
    final initial = options?.initialData;
    _dispatch(initial == null
        ? const QueryState()
        : QueryState(
            data: initial,
            status: QueryStatus.success,
            dataUpdatedAt: options?.initialDataUpdatedAt ?? client.now(),
          ));
  }

  bool get isFetching => state.fetchStatus != FetchStatus.idle;

  /// Cancels the in-flight fetch. [revert]: restore the state from before the fetch (default).
  Future<void> cancel({bool revert = true}) async {
    final fetch = _fetch;
    if (fetch == null) return;
    _fetch = null;
    fetch.token._cancel();
    if (!fetch.completer.isCompleted) fetch.completer.completeError(const QueryCancelledException());
    if (revert) {
      _dispatch(fetch.revertState.copyWith(fetchStatus: FetchStatus.idle));
    } else {
      _dispatch(state.copyWith(fetchStatus: FetchStatus.idle));
    }
  }

  /// `query.fetch(options, { cancelRefetch })`. De-duplicated: a running fetch is shared unless
  /// [cancelRefetch] is set and the query already has data. Never throws synchronously; the future
  /// fails with the last error after retries, or [QueryCancelledException].
  Future<Object?> fetch({QueryOptions<dynamic>? options, bool cancelRefetch = false, FetchDirection? direction}) {
    if (options != null) this.options = options;
    final running = _fetch;
    if (running != null && state.fetchStatus != FetchStatus.idle) {
      if (cancelRefetch && state.hasData && direction == null) {
        // Restart; the old caller gets the new result.
        _fetch = null;
        running.token._cancel();
        final restarted = this.fetch(direction: direction);
        if (!running.completer.isCompleted) running.completer.complete(restarted);
        return restarted;
      }
      return running.completer.future;
    }
    final queryFn = this.options?.queryFn;
    if (queryFn == null) {
      return Future<Object?>.error(StateError('Missing queryFn for ${hashQueryKey(queryKey)}'));
    }
    final fetch = _fetch = _Fetch(QueryCancelToken(), state);
    fetch.completer.future.ignore();
    _dispatch(state.copyWith(
      fetchStatus: _canFetch ? FetchStatus.fetching : FetchStatus.paused,
      fetchFailureCount: 0,
      fetchFailureReason: null,
      error: state.dataUpdatedAt == 0 ? null : _keep,
      status: state.dataUpdatedAt == 0 && !state.hasData ? QueryStatus.pending : null,
    ));
    unawaited(_run(fetch, queryFn, direction));
    return fetch.completer.future;
  }

  Future<void> _run(_Fetch fetch, QueryFn<dynamic> queryFn, FetchDirection? direction) async {
    final options = this.options;
    final retry = options?.retry ?? client.defaults.effectiveRetry;
    final retryDelay = options?.retryDelay ?? client.defaults.retryDelay;
    var failureCount = 0;
    bool current() => identical(_fetch, fetch) && !fetch.token.isCancelled;

    // networkMode 'online': the first attempt waits for the network.
    if (networkMode == NetworkMode.online && !client.onlineManager.isOnline) {
      await client._waitUntil(() => !current() || client.onlineManager.isOnline);
      if (!current()) return;
      _dispatch(state.copyWith(fetchStatus: FetchStatus.fetching));
    }
    while (true) {
      try {
        final data = await queryFn(QueryFunctionContext(
          queryKey: queryKey,
          signal: fetch.token,
          meta: options?.meta,
          direction: direction,
          currentData: fetch.revertState.data,
        ));
        if (!current()) return;
        _fetch = null;
        setData(data);
        if (!fetch.completer.isCompleted) fetch.completer.complete(data);
        if (_observers.isEmpty) _scheduleGc();
        return;
      } catch (error) {
        if (!current()) return;
        final retryIt = error is! QueryCancelledException && retry(failureCount, error);
        if (!retryIt) {
          _fetch = null;
          _dispatch(state.copyWith(
            error: error,
            errorUpdateCount: state.errorUpdateCount + 1,
            errorUpdatedAt: client.now(),
            fetchFailureCount: state.fetchFailureCount + 1,
            fetchFailureReason: error,
            fetchStatus: FetchStatus.idle,
            status: QueryStatus.error,
          ));
          if (!fetch.completer.isCompleted) fetch.completer.completeError(error);
          if (_observers.isEmpty) _scheduleGc();
          return;
        }
        final delay = retryDelay(failureCount, error);
        failureCount++;
        _dispatch(state.copyWith(fetchFailureCount: failureCount, fetchFailureReason: error));
        await Future<void>.delayed(delay);
        if (!current()) return;
        if (!_canContinue) {
          _dispatch(state.copyWith(fetchStatus: FetchStatus.paused));
          await client._waitUntil(() => !current() || _canContinue);
          if (!current()) return;
          _dispatch(state.copyWith(fetchStatus: FetchStatus.fetching));
        }
      }
    }
  }
}

enum QueryCacheEventType { added, removed, updated, observerAdded, observerRemoved }

class QueryCacheEvent {
  const QueryCacheEvent(this.type, this.query);
  final QueryCacheEventType type;
  final Query query;
}

/// Which queries a refetch touches (`refetchType` / `type`).
enum QueryTypeFilter { all, active, inactive, none }

/// `QueryFilters`.
class QueryFilters {
  const QueryFilters({this.queryKey, this.exact = false, this.predicate, this.type = QueryTypeFilter.all, this.stale});
  final QueryKey? queryKey;
  final bool exact;
  final bool Function(Query query)? predicate;
  final QueryTypeFilter type;
  final bool? stale;

  bool matches(Query query) {
    if (type == QueryTypeFilter.none) return false;
    final key = queryKey;
    if (key != null) {
      if (exact) {
        if (query.queryHash != hashQueryKey(key)) return false;
      } else if (!partialMatchKey(query.queryKey, key)) {
        return false;
      }
    }
    if (type != QueryTypeFilter.all) {
      final active = query.isActive;
      if (type == QueryTypeFilter.active && !active) return false;
      if (type == QueryTypeFilter.inactive && active) return false;
    }
    if (stale != null && query.isStale != stale) return false;
    if (predicate != null && !predicate!(query)) return false;
    return true;
  }
}

/// Previous values captured before an optimistic update (`onMutate` context).
class QuerySnapshot {
  QuerySnapshot._(this._client, this.entries);
  final QueryClient _client;

  /// (key, previous data, whether the query had data).
  final List<(QueryKey, Object?, bool)> entries;

  /// Previous data of the first (or only) key.
  Object? get previous => entries.isEmpty ? null : entries.first.$2;

  /// `onError: (_e, _v, ctx) => queryClient.setQueryData(key, ctx.prev)`. Keys that had no data
  /// before are left as they are (like `setQueryData(key, undefined)`, a no-op).
  void rollback() {
    for (final (key, previous, had) in entries) {
      if (had) _client.setQueryDataValue(key, previous);
    }
  }
}

/// The cache. One per app (see `queryClientProvider`).
class QueryClient {
  QueryClient({
    this.defaults = const QueryDefaults(),
    int Function()? now,
    OnlineManager? onlineManager,
    FocusManager? focusManager,
  })  : now = now ?? (() => DateTime.now().millisecondsSinceEpoch),
        onlineManager = onlineManager ?? OnlineManager(),
        focusManager = focusManager ?? FocusManager() {
    _subscriptions
      ..add(this.onlineManager.changes.listen((online) {
        _wake();
        if (online) _onOnline();
      }))
      ..add(this.focusManager.changes.listen((focused) {
        _wake();
        if (focused) _onFocus();
      }));
  }

  final QueryDefaults defaults;
  final int Function() now;
  final OnlineManager onlineManager;
  final FocusManager focusManager;

  final Map<String, Query> _queries = {};
  final List<void Function(QueryCacheEvent)> _listeners = [];
  final List<StreamSubscription<bool>> _subscriptions = [];
  final List<(bool Function(), Completer<void>)> _waiters = [];

  /// Mutations waiting for the network (resumed on reconnect).
  final List<void Function()> _pausedMutations = [];

  Iterable<Query> get queries => List.unmodifiable(_queries.values);

  void _notify(QueryCacheEvent event) {
    for (final listener in List.of(_listeners)) {
      listener(event);
    }
  }

  /// `queryCache.subscribe`.
  void Function() subscribe(void Function(QueryCacheEvent event) listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  Future<void> _waitUntil(bool Function() condition) {
    if (condition()) return Future.value();
    final completer = Completer<void>();
    _waiters.add((condition, completer));
    return completer.future;
  }

  void _wake() {
    for (final waiter in List.of(_waiters)) {
      if (waiter.$1()) {
        _waiters.remove(waiter);
        waiter.$2.complete();
      }
    }
  }

  /// Re-checks waiting fetches (e.g. after a cancel).
  void wakeWaiters() => _wake();

  void _onFocus() {
    for (final query in List.of(_queries.values)) {
      for (final observer in List.of(query._observers)) {
        observer.onFocus();
      }
    }
  }

  void _onOnline() {
    for (final query in List.of(_queries.values)) {
      for (final observer in List.of(query._observers)) {
        observer.onOnline();
      }
    }
    for (final resume in List.of(_pausedMutations)) {
      _pausedMutations.remove(resume);
      resume();
    }
  }

  /// Internal: mutation paused while offline.
  void addPausedMutation(void Function() resume) => _pausedMutations.add(resume);

  /// `queryCache.build`: the query for [key], created when missing.
  Query build(QueryKey key, [QueryOptions<dynamic>? options]) {
    final hash = hashQueryKey(key);
    var query = _queries[hash];
    if (query == null || query._removed) {
      final initial = options?.initialData;
      query = Query._(
        this,
        List.unmodifiable(key),
        hash,
        initial == null
            ? const QueryState()
            : QueryState(
                data: initial,
                status: QueryStatus.success,
                dataUpdatedAt: options?.initialDataUpdatedAt ?? now(),
              ),
      );
      query.options = options;
      _queries[hash] = query;
      _notify(QueryCacheEvent(QueryCacheEventType.added, query));
      if (query._observers.isEmpty) query._scheduleGc();
    } else if (options != null) {
      query.options = options;
    }
    return query;
  }

  Query? find(QueryKey key) => _queries[hashQueryKey(key)];

  List<Query> findAll([QueryFilters filters = const QueryFilters()]) =>
      _queries.values.where(filters.matches).toList();

  void _remove(Query query) {
    if (_queries[query.queryHash] != query) return;
    query._gcTimer?.cancel();
    query._removed = true;
    _queries.remove(query.queryHash);
    _notify(QueryCacheEvent(QueryCacheEventType.removed, query));
  }

  T? _typed<T>(Query query) {
    final data = query.state.data;
    if (query.rawPersisted) {
      final codec = query.options?.codec;
      if (codec != null) {
        query.decodeWith(codec);
        final decoded = query.state.data;
        return decoded is T ? decoded : null;
      }
    }
    return data is T ? data : null;
  }

  /// `getQueryData(key)` (exact key).
  T? getQueryData<T>(QueryKey key) {
    final query = find(key);
    return query == null ? null : _typed<T>(query);
  }

  QueryState? getQueryState(QueryKey key) => find(key)?.state;

  /// `setQueryData(key, updater)`. Returning null from [updater] leaves the cache unchanged (like
  /// returning `undefined`). Use [setQueryDataValue] to store a value directly.
  T? setQueryData<T>(QueryKey key, T? Function(T? previous) updater, {int? updatedAt}) {
    final existing = find(key);
    final next = updater(existing == null ? null : _typed<T>(existing));
    if (next == null) return null;
    build(key).setData(next, updatedAt: updatedAt, manual: true);
    return next;
  }

  void setQueryDataValue(QueryKey key, Object? value, {int? updatedAt}) =>
      build(key).setData(value, updatedAt: updatedAt, manual: true);

  /// `getQueriesData(filters)`.
  List<(QueryKey, Object?)> getQueriesData([QueryFilters filters = const QueryFilters()]) =>
      [for (final q in findAll(filters)) (q.queryKey, q.state.data)];

  /// `setQueriesData(filters, updater)`; only queries that have data are passed to [updater]
  /// (TanStack passes `undefined` too; most callers return early for it).
  List<(QueryKey, Object?)> setQueriesData(QueryFilters filters, Object? Function(Object? previous) updater) {
    final result = <(QueryKey, Object?)>[];
    for (final query in findAll(filters)) {
      final next = updater(query.state.data);
      if (next == null) continue;
      query.setData(next, manual: true);
      result.add((query.queryKey, next));
    }
    return result;
  }

  /// `fetchQuery(options)`: cached data when fresh, else a (de-duplicated) fetch. Retries default to
  /// 0 here like TanStack's imperative fetches (`retry: false` unless set).
  Future<T> fetchQuery<T>(QueryOptions<T> options) async {
    final query = build(options.queryKey, options);
    query.decodeWith(options.codec);
    final staleTime = options.staleTime ?? Duration.zero;
    if (query.state.hasData && !query.isStaleByTime(staleTime)) return query.state.data as T;
    final effective = options.retry == null
        ? QueryOptions<T>(
            queryKey: options.queryKey,
            queryFn: options.queryFn,
            staleTime: options.staleTime,
            gcTime: options.gcTime,
            retry: noRetry,
            networkMode: options.networkMode,
            meta: options.meta,
            codec: options.codec,
          )
        : options;
    return await query.fetch(options: effective) as T;
  }

  /// `prefetchQuery`: like [fetchQuery] but never throws.
  Future<void> prefetchQuery<T>(QueryOptions<T> options) =>
      fetchQuery(options).then((_) {}, onError: (Object _) {});

  /// `ensureQueryData`: cached data whatever its age, else fetch.
  Future<T> ensureQueryData<T>(QueryOptions<T> options) async {
    final query = build(options.queryKey, options);
    query.decodeWith(options.codec);
    if (query.state.hasData) return query.state.data as T;
    return fetchQuery(options);
  }

  /// `invalidateQueries({ queryKey, exact, predicate, refetchType })`: marks matches stale and
  /// refetches the active ones (`refetchType: 'active'` default).
  Future<void> invalidateQueries({
    QueryKey? queryKey,
    bool exact = false,
    bool Function(Query query)? predicate,
    QueryTypeFilter refetchType = QueryTypeFilter.active,
  }) {
    final filters = QueryFilters(queryKey: queryKey, exact: exact, predicate: predicate);
    for (final query in findAll(filters)) {
      query.invalidate();
    }
    if (refetchType == QueryTypeFilter.none) return Future.value();
    return refetchQueries(QueryFilters(queryKey: queryKey, exact: exact, predicate: predicate, type: refetchType));
  }

  /// `refetchQueries(filters, { cancelRefetch })`. Disabled queries are skipped. Never throws.
  Future<void> refetchQueries([QueryFilters filters = const QueryFilters(), bool cancelRefetch = true]) {
    final work = <Future<void>>[];
    for (final query in findAll(filters)) {
      if (query.isDisabled) continue;
      work.add(query.fetch(cancelRefetch: cancelRefetch).then((_) {}, onError: (Object _) {}));
    }
    return Future.wait(work).then((_) {});
  }

  /// `cancelQueries(filters)` (revert to the pre-fetch state).
  Future<void> cancelQueries([QueryFilters filters = const QueryFilters()]) async {
    await Future.wait(findAll(filters).map((q) => q.cancel()));
  }

  /// `removeQueries(filters)`.
  void removeQueries([QueryFilters filters = const QueryFilters()]) {
    for (final query in findAll(filters)) {
      query.cancel(revert: false);
      _remove(query);
    }
  }

  /// `resetQueries(filters)`: initial state, then refetch active ones.
  Future<void> resetQueries([QueryFilters filters = const QueryFilters()]) {
    for (final query in findAll(filters)) {
      query.reset();
    }
    return refetchQueries(QueryFilters(
      queryKey: filters.queryKey,
      exact: filters.exact,
      predicate: filters.predicate,
      type: QueryTypeFilter.active,
    ));
  }

  /// `isFetching(filters)`.
  int isFetching([QueryFilters filters = const QueryFilters()]) =>
      findAll(filters).where((q) => q.state.fetchStatus == FetchStatus.fetching).length;

  /// `queryClient.clear()` (logout): drops every query. Observers keep their last result until
  /// their next update, like TanStack.
  void clear() {
    for (final query in List.of(_queries.values)) {
      query.cancel(revert: false);
      _remove(query);
    }
  }

  /// Optimistic update of one key (`onMutate`): cancels its fetches, captures the previous data,
  /// applies [update]. Roll back with [QuerySnapshot.rollback] in `onError`.
  Future<QuerySnapshot> optimisticUpdate<T>(QueryKey key, T? Function(T? previous) update) async {
    await cancelQueries(QueryFilters(queryKey: key, exact: true));
    final query = find(key);
    final had = query != null && query.state.hasData;
    final previous = query == null ? null : _typed<T>(query) ?? query.state.data;
    setQueryData<T>(key, update);
    return QuerySnapshot._(this, [(List.unmodifiable(key), previous, had)]);
  }

  /// Optimistic update of every query matching [filters] (`setQueriesData` + snapshots).
  Future<QuerySnapshot> optimisticUpdateQueries(QueryFilters filters, Object? Function(Object? previous) update) async {
    await cancelQueries(filters);
    final entries = [for (final q in findAll(filters)) (q.queryKey, q.state.data, q.state.hasData)];
    setQueriesData(filters, update);
    return QuerySnapshot._(this, entries);
  }

  /// Hydration (restore): sets a query's state when it is newer than what the cache holds.
  void hydrateQuery(QueryKey key, QueryState state, {Map<String, Object?>? meta, bool raw = true}) {
    final existing = find(key);
    if (existing != null && existing.state.dataUpdatedAt >= state.dataUpdatedAt) return;
    final query = build(key);
    query.rawPersisted = raw;
    if (meta != null && query.options == null) {
      query.options = QueryOptions<dynamic>(queryKey: key, meta: meta);
    }
    query._dispatch(state.copyWith(fetchStatus: FetchStatus.idle));
  }

  void dispose() {
    for (final sub in _subscriptions) {
      unawaited(sub.cancel());
    }
    for (final query in _queries.values) {
      query._gcTimer?.cancel();
    }
  }
}

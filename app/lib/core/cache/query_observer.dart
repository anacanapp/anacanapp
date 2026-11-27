// Ported from: node_modules/@tanstack/query-core v5 queryObserver.ts (`useQuery` behaviour).
//
// Subscribes to one query: fetch on mount when stale (or when there is no data), refetch when
// the key changes, on app focus/resume and on reconnect (when stale), polling with
// `refetchInterval` (foreground only unless `refetchIntervalInBackground`), placeholder data.

import 'dart:async';

import 'package:flutter/foundation.dart';

import 'query_client.dart';
import 'query_key.dart';

/// `useQuery` result.
@immutable
class QueryResult<T> {
  const QueryResult({
    required this.data,
    required this.error,
    required this.status,
    required this.fetchStatus,
    required this.dataUpdatedAt,
    required this.errorUpdatedAt,
    required this.failureCount,
    required this.failureReason,
    required this.isStale,
    required this.isPlaceholderData,
    required this.isFetchedAfterMount,
  });

  const QueryResult.idle()
      : data = null,
        error = null,
        status = QueryStatus.pending,
        fetchStatus = FetchStatus.idle,
        dataUpdatedAt = 0,
        errorUpdatedAt = 0,
        failureCount = 0,
        failureReason = null,
        isStale = true,
        isPlaceholderData = false,
        isFetchedAfterMount = false;

  final T? data;
  final Object? error;
  final QueryStatus status;
  final FetchStatus fetchStatus;
  final int dataUpdatedAt;
  final int errorUpdatedAt;
  final int failureCount;
  final Object? failureReason;
  final bool isStale;
  final bool isPlaceholderData;
  final bool isFetchedAfterMount;

  bool get isPending => status == QueryStatus.pending;
  bool get isSuccess => status == QueryStatus.success;
  bool get isError => status == QueryStatus.error;
  bool get isFetching => fetchStatus == FetchStatus.fetching;
  bool get isPaused => fetchStatus == FetchStatus.paused;

  /// `isLoading` = first load in progress (`isPending && isFetching`).
  bool get isLoading => isPending && isFetching;
  bool get isRefetching => isFetching && !isPending;
  bool get isLoadingError => isError && dataUpdatedAt == 0;
  bool get isRefetchError => isError && dataUpdatedAt != 0;

  bool sameAs(QueryResult<T> other) =>
      identical(data, other.data) &&
      identical(error, other.error) &&
      status == other.status &&
      fetchStatus == other.fetchStatus &&
      dataUpdatedAt == other.dataUpdatedAt &&
      errorUpdatedAt == other.errorUpdatedAt &&
      failureCount == other.failureCount &&
      isStale == other.isStale &&
      isPlaceholderData == other.isPlaceholderData;
}

bool _shouldFetchOn(Query query, bool enabled, Duration staleTime, RefetchOn mode) {
  if (!enabled || mode == RefetchOn.never) return false;
  return mode == RefetchOn.always || query.isStaleByTime(staleTime);
}

/// One `useQuery` subscription.
class QueryObserver<T> extends ChangeNotifier implements QueryObserverBase {
  QueryObserver(this.client, QueryOptions<T> options) : _options = options {
    _query = client.build(options.queryKey, options);
    _query.decodeWith(options.codec);
    _result = _compute();
  }

  final QueryClient client;
  QueryOptions<T> _options;
  late Query _query;
  late QueryResult<T> _result;
  bool _mounted = false;
  bool _disposed = false;
  Timer? _interval;
  int _dataUpdateCountAtMount = 0;
  T? _previousData;

  QueryOptions<T> get options => _options;
  Query get query => _query;
  QueryResult<T> get current => _result;
  bool get isMounted => _mounted;

  @override
  bool get isEnabled => _options.enabled;

  @override
  Duration get staleTime => _options.staleTime ?? client.defaults.staleTime;

  RefetchOn get _onMount => _options.refetchOnMount ?? client.defaults.refetchOnMount;
  RefetchOn get _onFocus => _options.refetchOnWindowFocus ?? client.defaults.refetchOnWindowFocus;
  RefetchOn get _onReconnect => _options.refetchOnReconnect ?? client.defaults.refetchOnReconnect;

  /// First subscription (component mount).
  void mount() {
    if (_mounted || _disposed) return;
    _mounted = true;
    _query.addObserver(this);
    _dataUpdateCountAtMount = _query.state.dataUpdateCount;
    final state = _query.state;
    final shouldLoad = isEnabled && (!state.hasData || (_query.rawPersisted && state.data is! T));
    if (shouldLoad || _shouldFetchOn(_query, isEnabled, staleTime, _onMount)) _executeFetch();
    _updateInterval();
    _update();
  }

  /// Unsubscribe (component unmount). The query stays cached for gcTime.
  void unmount() {
    if (!_mounted) return;
    _mounted = false;
    _interval?.cancel();
    _interval = null;
    _query.removeObserver(this);
  }

  /// New options (re-render with other deps). [mount]: subscribe if not subscribed, without the
  /// on-mount refetch (used when a provider rebuilds with the same observer).
  void setOptions(QueryOptions<T> options, {bool mount = false}) {
    final prevQuery = _query;
    final prevOptions = _options;
    _options = options;
    final nextQuery = client.build(options.queryKey, options);
    nextQuery.decodeWith(options.codec);
    if (!identical(nextQuery, prevQuery)) {
      if (_mounted) prevQuery.removeObserver(this);
      _query = nextQuery;
      if (_mounted) nextQuery.addObserver(this);
      _dataUpdateCountAtMount = nextQuery.state.dataUpdateCount;
    }
    if (mount && !_mounted && !_disposed) {
      _mounted = true;
      _query.addObserver(this);
    }
    if (_mounted &&
        (!identical(_query, prevQuery) || !prevOptions.enabled) &&
        isEnabled &&
        _query.isStaleByTime(staleTime)) {
      _executeFetch();
    }
    if (_mounted) _updateInterval();
    _update();
  }

  void _executeFetch() {
    unawaited(_query.fetch(options: _options).then((_) {}, onError: (Object _) {}));
  }

  /// `refetch()`: always fetches (cancelling a running fetch when there is data).
  Future<QueryResult<T>> refetch({bool cancelRefetch = true}) async {
    try {
      await _query.fetch(options: _options, cancelRefetch: cancelRefetch);
    } catch (_) {
      // The result carries the error.
    }
    return _result;
  }

  Duration? get _intervalDuration {
    final fn = _options.refetchIntervalFor;
    final value = fn != null ? fn(_query) : _options.refetchInterval;
    if (value == null || value <= Duration.zero) return null;
    return value;
  }

  void _updateInterval() {
    _interval?.cancel();
    _interval = null;
    final interval = _intervalDuration;
    if (!_mounted || !isEnabled || interval == null) return;
    _interval = Timer.periodic(interval, (_) {
      if (_options.refetchIntervalInBackground || client.focusManager.isFocused) _executeFetch();
    });
  }

  @override
  void onFocus() {
    if (_mounted && _shouldFetchOn(_query, isEnabled, staleTime, _onFocus)) _executeFetch();
  }

  @override
  void onOnline() {
    if (_mounted && _shouldFetchOn(_query, isEnabled, staleTime, _onReconnect)) _executeFetch();
  }

  @override
  void onQueryUpdate() {
    final before = _intervalDuration;
    _update();
    if (_options.refetchIntervalFor != null && before != _intervalDuration) _updateInterval();
  }

  QueryResult<T> _compute() {
    final state = _query.state;
    T? data;
    var status = state.status;
    if (state.hasData) {
      final value = state.data;
      if (value is T) {
        data = value;
      } else if (_query.rawPersisted) {
        // Restored JSON this observer cannot type (no codec): behave as if nothing was cached.
        status = QueryStatus.pending;
      }
    }
    var placeholder = false;
    if (!state.hasData && status == QueryStatus.pending && _options.placeholderData != null) {
      final value = _options.placeholderData!(_previousData);
      if (value != null) {
        data = value;
        status = QueryStatus.success;
        placeholder = true;
      }
    }
    return QueryResult<T>(
      data: data,
      error: state.error,
      status: status,
      fetchStatus: state.fetchStatus,
      dataUpdatedAt: state.dataUpdatedAt,
      errorUpdatedAt: state.errorUpdatedAt,
      failureCount: state.fetchFailureCount,
      failureReason: state.fetchFailureReason,
      isStale: _query.isStaleByTime(staleTime),
      isPlaceholderData: placeholder,
      isFetchedAfterMount: state.dataUpdateCount > _dataUpdateCountAtMount,
    );
  }

  void _update() {
    if (_disposed) return;
    final next = _compute();
    if (next.data != null && !next.isPlaceholderData) _previousData = next.data;
    if (next.sameAs(_result)) return;
    _result = next;
    notifyListeners();
  }

  @override
  void dispose() {
    unmount();
    _disposed = true;
    super.dispose();
  }
}

/// `useQueries`-style helper: true when [key] matches [prefix].
bool queryKeyStartsWith(QueryKey key, QueryKey prefix) => partialMatchKey(key, prefix);

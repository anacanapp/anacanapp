// Ported from: node_modules/@tanstack/query-core v5 mutation.ts / mutationObserver.ts (`useMutation`).
//
// Order of callbacks as in TanStack v5: onMutate → mutationFn → onSuccess | onError → onSettled,
// then the per-call callbacks passed to `mutate(vars, onSuccess: …)` (only while the observer
// is alive). Retry defaults to 0; networkMode 'online' pauses mutationFn while offline (onMutate
// has already run, so optimistic updates show at once).

import 'dart:async';

import 'package:flutter/foundation.dart';

import 'query_client.dart';

enum MutationStatus { idle, pending, success, error }

@immutable
class MutationState<TData, TVars> {
  const MutationState({
    this.status = MutationStatus.idle,
    this.data,
    this.error,
    this.variables,
    this.isPaused = false,
    this.failureCount = 0,
    this.submittedAt = 0,
  });

  final MutationStatus status;
  final TData? data;
  final Object? error;
  final TVars? variables;
  final bool isPaused;
  final int failureCount;
  final int submittedAt;

  bool get isIdle => status == MutationStatus.idle;
  bool get isPending => status == MutationStatus.pending;
  bool get isSuccess => status == MutationStatus.success;
  bool get isError => status == MutationStatus.error;
}

/// `useMutation` options. [TCtx] is what [onMutate] returns (e.g. a [QuerySnapshot]).
class MutationOptions<TData, TVars, TCtx> {
  const MutationOptions({
    required this.mutationFn,
    this.onMutate,
    this.onSuccess,
    this.onError,
    this.onSettled,
    this.retry,
    this.retryDelay,
    this.networkMode,
    this.mutationKey,
    this.meta,
  });

  final Future<TData> Function(TVars variables) mutationFn;
  final FutureOr<TCtx?> Function(TVars variables)? onMutate;
  final FutureOr<void> Function(TData data, TVars variables, TCtx? context)? onSuccess;
  final FutureOr<void> Function(Object error, TVars variables, TCtx? context)? onError;
  final FutureOr<void> Function(TData? data, Object? error, TVars variables, TCtx? context)? onSettled;
  final RetryPolicy? retry;
  final RetryDelay? retryDelay;
  final NetworkMode? networkMode;
  final List<Object?>? mutationKey;
  final Map<String, Object?>? meta;
}

/// One `useMutation` instance.
class MutationObserver<TData, TVars, TCtx> extends ChangeNotifier {
  MutationObserver(this.client, this.options);

  final QueryClient client;
  MutationOptions<TData, TVars, TCtx> options;
  MutationState<TData, TVars> _state = const MutationState();
  bool _disposed = false;
  int _run = 0;

  MutationState<TData, TVars> get state => _state;

  void _set(MutationState<TData, TVars> next) {
    _state = next;
    if (!_disposed) notifyListeners();
  }

  /// `mutateAsync(vars)`: throws the error.
  Future<TData> mutateAsync(
    TVars variables, {
    FutureOr<void> Function(TData data, TVars variables, TCtx? context)? onSuccess,
    FutureOr<void> Function(Object error, TVars variables, TCtx? context)? onError,
    FutureOr<void> Function(TData? data, Object? error, TVars variables, TCtx? context)? onSettled,
  }) async {
    final run = ++_run;
    final o = options;
    _set(MutationState(
      status: MutationStatus.pending,
      variables: variables,
      submittedAt: client.now(),
    ));
    TCtx? context;
    try {
      context = await o.onMutate?.call(variables);
      final data = await _execute(o, variables, run);
      await o.onSuccess?.call(data, variables, context);
      await o.onSettled?.call(data, null, variables, context);
      if (run == _run) _set(MutationState(status: MutationStatus.success, data: data, variables: variables));
      if (!_disposed) {
        await onSuccess?.call(data, variables, context);
        await onSettled?.call(data, null, variables, context);
      }
      return data;
    } catch (error) {
      try {
        await o.onError?.call(error, variables, context);
        await o.onSettled?.call(null, error, variables, context);
      } finally {
        if (run == _run) _set(MutationState(status: MutationStatus.error, error: error, variables: variables));
      }
      if (!_disposed) {
        await onError?.call(error, variables, context);
        await onSettled?.call(null, error, variables, context);
      }
      rethrow;
    }
  }

  /// `mutate(vars)`: never throws (errors land in [state]).
  void mutate(
    TVars variables, {
    FutureOr<void> Function(TData data, TVars variables, TCtx? context)? onSuccess,
    FutureOr<void> Function(Object error, TVars variables, TCtx? context)? onError,
    FutureOr<void> Function(TData? data, Object? error, TVars variables, TCtx? context)? onSettled,
  }) {
    unawaited(mutateAsync(variables, onSuccess: onSuccess, onError: onError, onSettled: onSettled)
        .then((_) {}, onError: (Object _) {}));
  }

  Future<TData> _execute(MutationOptions<TData, TVars, TCtx> o, TVars variables, int run) async {
    final retry = o.retry ?? client.defaults.effectiveMutationRetry;
    final retryDelay = o.retryDelay ?? client.defaults.retryDelay;
    final mode = o.networkMode ?? client.defaults.mutationNetworkMode;
    var failureCount = 0;
    while (true) {
      if (mode == NetworkMode.online && !client.onlineManager.isOnline) {
        if (run == _run) _set(_copy(isPaused: true));
        final resumed = Completer<void>();
        client.addPausedMutation(resumed.complete);
        await resumed.future;
        if (run == _run) _set(_copy(isPaused: false));
      }
      try {
        return await o.mutationFn(variables);
      } catch (error) {
        if (!retry(failureCount, error)) rethrow;
        final delay = retryDelay(failureCount, error);
        failureCount++;
        if (run == _run) _set(_copy(failureCount: failureCount));
        await Future<void>.delayed(delay);
      }
    }
  }

  MutationState<TData, TVars> _copy({bool? isPaused, int? failureCount}) => MutationState(
        status: _state.status,
        data: _state.data,
        error: _state.error,
        variables: _state.variables,
        isPaused: isPaused ?? _state.isPaused,
        failureCount: failureCount ?? _state.failureCount,
        submittedAt: _state.submittedAt,
      );

  /// `reset()`.
  void reset() {
    _run++;
    _set(const MutationState());
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

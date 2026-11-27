// Ported from: @tanstack/react-query hooks (useQuery, useInfiniteQuery, useMutation, useQueryClient)
// as used in src/hooks/*.
//
// Riverpod glue. A query provider keeps one QueryObserver per provider instance across rebuilds
// (deps change → setOptions, like a re-render), subscribes while the provider is alive (mount) and
// unsubscribes when it is disposed (unmount; the cache keeps the data for gcTime).
//
//   final forceUpdateQuery = queryProvider<ForceUpdate>((ref) => QueryOptions(
//     queryKey: ['force-update-config'], queryFn: (_) => loadForceUpdate(ref), staleTime: …));
//   ref.watch(forceUpdateQuery)                // QueryResult<ForceUpdate>
//   ref.read(forceUpdateQuery.notifier).refetch();
//   ref.read(queryClientProvider).invalidateQueries(queryKey: ['force-update-config']);

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show NotifierProviderFamily;

import 'infinite_query.dart';
import 'mutation.dart';
import 'query_client.dart';
import 'query_observer.dart';

/// The app's cache (`useQueryClient()`). The bootstrap creates it with the React defaults; tests
/// override it with their own client.
final queryClientProvider = Provider<QueryClient>((ref) {
  final client = QueryClient();
  ref.onDispose(client.dispose);
  return client;
});

typedef QueryOptionsBuilder<T> = QueryOptions<T> Function(Ref ref);

/// `useQuery` state holder.
class QueryNotifier<T> extends Notifier<QueryResult<T>> {
  QueryNotifier(this._builder);

  final QueryOptionsBuilder<T> _builder;
  QueryObserver<T>? _observer;
  bool _building = false;

  QueryObserver<T> _create(QueryClient client, QueryOptions<T> options) => QueryObserver<T>(client, options);

  QueryObserver<T>? get observer => _observer;

  @override
  QueryResult<T> build() {
    _building = true;
    try {
      final client = ref.watch(queryClientProvider);
      final options = _builder(ref);
      var observer = _observer;
      if (observer == null || !identical(observer.client, client)) {
        observer?.dispose();
        observer = _observer = _create(client, options);
        observer.addListener(_changed);
        observer.mount();
      } else {
        observer.setOptions(options, mount: true);
      }
      final current = observer;
      ref.onDispose(current.unmount);
      return current.current;
    } finally {
      _building = false;
    }
  }

  void _changed() {
    if (_building || !ref.mounted) return;
    final observer = _observer;
    if (observer != null) state = observer.current;
  }

  /// `refetch()`.
  Future<QueryResult<T>> refetch({bool cancelRefetch = true}) =>
      _observer?.refetch(cancelRefetch: cancelRefetch) ?? Future.value(state);
}

/// `useInfiniteQuery` state holder.
class InfiniteQueryNotifier<TPage, TParam> extends QueryNotifier<InfiniteData<TPage, TParam>> {
  InfiniteQueryNotifier(super.builder);

  @override
  QueryObserver<InfiniteData<TPage, TParam>> _create(
          QueryClient client, QueryOptions<InfiniteData<TPage, TParam>> options) =>
      InfiniteQueryObserver<TPage, TParam>(client, options);

  InfiniteQueryObserver<TPage, TParam>? get _infinite => observer as InfiniteQueryObserver<TPage, TParam>?;

  bool get hasNextPage => _infinite?.hasNextPage ?? false;
  bool get hasPreviousPage => _infinite?.hasPreviousPage ?? false;
  Future<void> fetchNextPage() => _infinite?.fetchNextPage() ?? Future.value();
  Future<void> fetchPreviousPage() => _infinite?.fetchPreviousPage() ?? Future.value();
}

/// A `useQuery` provider (auto-disposed when nothing watches it).
NotifierProvider<QueryNotifier<T>, QueryResult<T>> queryProvider<T>(QueryOptionsBuilder<T> build, {String? name}) =>
    NotifierProvider.autoDispose<QueryNotifier<T>, QueryResult<T>>(() => QueryNotifier<T>(build), name: name);

/// A `useQuery(arg)` provider family.
NotifierProviderFamily<QueryNotifier<T>, QueryResult<T>, A> queryProviderFamily<T, A>(
  QueryOptions<T> Function(Ref ref, A arg) build, {
  String? name,
}) =>
    NotifierProvider.autoDispose.family<QueryNotifier<T>, QueryResult<T>, A>(
      (A arg) => QueryNotifier<T>((ref) => build(ref, arg)),
      name: name,
    );

/// A `useInfiniteQuery` provider. Build the options with [infiniteQueryOptions].
NotifierProvider<InfiniteQueryNotifier<TPage, TParam>, QueryResult<InfiniteData<TPage, TParam>>>
    infiniteQueryProvider<TPage, TParam>(QueryOptionsBuilder<InfiniteData<TPage, TParam>> build, {String? name}) =>
        NotifierProvider.autoDispose<InfiniteQueryNotifier<TPage, TParam>, QueryResult<InfiniteData<TPage, TParam>>>(
          () => InfiniteQueryNotifier<TPage, TParam>(build),
          name: name,
        );

/// `useMutation` state holder. Call `ref.read(provider.notifier).mutate(vars)`.
class MutationNotifier<TData, TVars, TCtx> extends Notifier<MutationState<TData, TVars>> {
  MutationNotifier(this._builder);

  final MutationOptions<TData, TVars, TCtx> Function(Ref ref) _builder;
  MutationObserver<TData, TVars, TCtx>? _observer;

  @override
  MutationState<TData, TVars> build() {
    final client = ref.watch(queryClientProvider);
    final options = _builder(ref);
    var observer = _observer;
    if (observer == null || !identical(observer.client, client)) {
      observer = _observer = MutationObserver<TData, TVars, TCtx>(client, options);
      observer.addListener(() {
        if (ref.mounted) state = _observer!.state;
      });
    } else {
      observer.options = options;
    }
    return observer.state;
  }

  void mutate(
    TVars variables, {
    void Function(TData data, TVars variables, TCtx? context)? onSuccess,
    void Function(Object error, TVars variables, TCtx? context)? onError,
    void Function(TData? data, Object? error, TVars variables, TCtx? context)? onSettled,
  }) =>
      _observer!.mutate(variables, onSuccess: onSuccess, onError: onError, onSettled: onSettled);

  Future<TData> mutateAsync(TVars variables) => _observer!.mutateAsync(variables);

  void reset() => _observer?.reset();
}

/// A `useMutation` provider. Kept alive while watched.
NotifierProvider<MutationNotifier<TData, TVars, TCtx>, MutationState<TData, TVars>>
    mutationProvider<TData, TVars, TCtx>(
  MutationOptions<TData, TVars, TCtx> Function(Ref ref) build, {
  String? name,
}) =>
        NotifierProvider.autoDispose<MutationNotifier<TData, TVars, TCtx>, MutationState<TData, TVars>>(
          () => MutationNotifier<TData, TVars, TCtx>(build),
          name: name,
        );

// Ported from: (useQuery / useMutation / useInfiniteQuery behaviour relied on by src/hooks)

import 'dart:async';

import 'package:anacan/core/cache/cache.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> pump([int ms = 0]) => Future<void>.delayed(Duration(milliseconds: ms));

void main() {
  late OnlineManager online;
  late FocusManager focus;
  late QueryClient client;
  late int nowMs;

  setUp(() {
    online = OnlineManager();
    focus = FocusManager();
    nowMs = 1000000;
    client = QueryClient(
      defaults: const QueryDefaults(retry: noRetry),
      onlineManager: online,
      focusManager: focus,
      now: () => nowMs,
    );
  });

  group('QueryObserver', () {
    test('fetches on mount, shows loading then data', () async {
      final results = <QueryResult<int>>[];
      final observer = QueryObserver<int>(client, QueryOptions(queryKey: const ['a'], queryFn: (_) async => 5))
        ..addListener(() {});
      observer.addListener(() => results.add(observer.current));
      observer.mount();
      expect(observer.current.isLoading, isTrue);
      await pump();
      expect(observer.current.data, 5);
      expect(observer.current.isSuccess, isTrue);
      expect(results.last.isFetching, isFalse);
      observer.dispose();
    });

    test('does not refetch fresh data on a second mount; refetches stale data (staleTime 30 s)', () async {
      var calls = 0;
      QueryOptions<int> opts() => QueryOptions(queryKey: const ['a'], queryFn: (_) async => ++calls);
      final first = QueryObserver<int>(client, opts())..mount();
      await pump();
      first.dispose();
      final second = QueryObserver<int>(client, opts())..mount();
      await pump();
      expect(calls, 1);
      expect(second.current.data, 1);
      second.dispose();
      nowMs += 30001;
      final third = QueryObserver<int>(client, opts())..mount();
      expect(third.current.data, 1); // stale data shown while revalidating
      expect(third.current.isRefetching, isTrue);
      await pump();
      expect(calls, 2);
      expect(third.current.data, 2);
      third.dispose();
    });

    test('refetches stale queries on app resume (refetchOnWindowFocus) and on reconnect', () async {
      var calls = 0;
      final observer = QueryObserver<int>(client, QueryOptions(queryKey: const ['f'], queryFn: (_) async => ++calls))
        ..mount();
      await pump();
      focus.setFocused(false);
      focus.setFocused(true);
      await pump();
      expect(calls, 1, reason: 'fresh data is not refetched on focus');
      nowMs += 31000;
      focus.setFocused(false);
      focus.setFocused(true);
      await pump();
      expect(calls, 2);
      nowMs += 31000;
      online.setOnline(false);
      online.setOnline(true);
      await pump();
      expect(calls, 3);
      observer.dispose();
    });

    test('refetchOnWindowFocus: never is honoured', () async {
      var calls = 0;
      final observer = QueryObserver<int>(
        client,
        QueryOptions(queryKey: const ['f'], refetchOnWindowFocus: RefetchOn.never, queryFn: (_) async => ++calls),
      )..mount();
      await pump();
      nowMs += 31000;
      focus.setFocused(false);
      focus.setFocused(true);
      await pump();
      expect(calls, 1);
      observer.dispose();
    });

    test('polls with refetchInterval only while focused', () async {
      var calls = 0;
      final observer = QueryObserver<int>(
        client,
        QueryOptions(
          queryKey: const ['poll'],
          refetchInterval: const Duration(milliseconds: 20),
          queryFn: (_) async => ++calls,
        ),
      )..mount();
      await pump(70);
      expect(calls, greaterThanOrEqualTo(3));
      focus.setFocused(false);
      final paused = calls;
      await pump(70);
      expect(calls, paused);
      observer.dispose();
    });

    test('a disabled query does not fetch; enabling it fetches; key change fetches the new key', () async {
      final calls = <String>[];
      QueryOptions<String> opts(String id, {bool enabled = true}) => QueryOptions(
            queryKey: ['entries', id],
            enabled: enabled,
            queryFn: (_) async {
              calls.add(id);
              return id;
            },
          );
      final observer = QueryObserver<String>(client, opts('a', enabled: false))..mount();
      await pump();
      expect(calls, isEmpty);
      expect(observer.current.isPending, isTrue);
      expect(observer.current.isFetching, isFalse);
      observer.setOptions(opts('a'));
      await pump();
      expect(calls, ['a']);
      observer.setOptions(opts('b'));
      await pump();
      expect(calls, ['a', 'b']);
      expect(observer.current.data, 'b');
      observer.dispose();
    });

    test('placeholderData keeps the previous key data while the next one loads', () async {
      final gate = Completer<String>();
      final observer = QueryObserver<String>(
        client,
        QueryOptions(queryKey: const ['p', 1], queryFn: (_) async => 'one', placeholderData: (prev) => prev),
      )..mount();
      await pump();
      observer.setOptions(QueryOptions(queryKey: const ['p', 2], queryFn: (_) => gate.future, placeholderData: (prev) => prev));
      expect(observer.current.data, 'one');
      expect(observer.current.isPlaceholderData, isTrue);
      gate.complete('two');
      await pump();
      expect(observer.current.data, 'two');
      expect(observer.current.isPlaceholderData, isFalse);
      observer.dispose();
    });
  });

  group('mutations', () {
    test('runs onMutate → fn → onSuccess → onSettled → per-call callbacks, then invalidates', () async {
      final order = <String>[];
      final observer = MutationObserver<int, int, String>(
        client,
        MutationOptions(
          mutationFn: (v) async {
            order.add('fn');
            return v * 2;
          },
          onMutate: (v) {
            order.add('onMutate');
            return 'ctx';
          },
          onSuccess: (data, v, ctx) => order.add('onSuccess:$data:$ctx'),
          onSettled: (data, error, v, ctx) => order.add('onSettled'),
        ),
      );
      observer.mutate(2, onSuccess: (data, _, __) => order.add('call:onSuccess'));
      expect(observer.state.isPending, isTrue);
      await pump();
      expect(order, ['onMutate', 'fn', 'onSuccess:4:ctx', 'onSettled', 'call:onSuccess']);
      expect(observer.state.data, 4);
    });

    test('rolls back an optimistic update on error and does not retry', () async {
      client.setQueryDataValue(const ['story-replies', 's'], <String>['r1']);
      var calls = 0;
      final observer = MutationObserver<void, String, QuerySnapshot>(
        client,
        MutationOptions(
          mutationFn: (_) async {
            calls++;
            throw StateError('rls');
          },
          onMutate: (content) =>
              client.optimisticUpdate<List<String>>(const ['story-replies', 's'], (old) => [...?old, content]),
          onError: (_, __, ctx) => ctx?.rollback(),
        ),
      );
      await expectLater(observer.mutateAsync('hi'), throwsStateError);
      expect(calls, 1);
      expect(observer.state.isError, isTrue);
      expect(client.getQueryData<List<String>>(const ['story-replies', 's']), ['r1']);
    });

    test('pauses while offline after onMutate and resumes on reconnect', () async {
      online.setOnline(false);
      var ran = false;
      final observer = MutationObserver<int, int, void>(
        client,
        MutationOptions(mutationFn: (v) async {
          ran = true;
          return v;
        }),
      );
      final result = observer.mutateAsync(1);
      await pump();
      expect(ran, isFalse);
      expect(observer.state.isPaused, isTrue);
      online.setOnline(true);
      expect(await result, 1);
      expect(observer.state.isSuccess, isTrue);
    });
  });

  group('infinite queries', () {
    test('loads pages, fetches the next one and refetches all loaded pages in order', () async {
      var version = 1;
      final calls = <int>[];
      final observer = InfiniteQueryObserver<List<String>, int>(
        client,
        infiniteQueryOptions<List<String>, int>(
          queryKey: const ['chat-messages-v2', 'c1'],
          initialPageParam: 0,
          getNextPageParam: (last, all, lastParam, _) => last.length < 2 ? null : lastParam + 1,
          queryFn: (_, page) async {
            calls.add(page);
            return page < 2 ? ['v$version-$page-a', 'v$version-$page-b'] : ['v$version-$page-a'];
          },
        ),
      )..mount();
      await pump();
      expect(observer.current.data!.pages.length, 1);
      expect(observer.hasNextPage, isTrue);
      await observer.fetchNextPage();
      await observer.fetchNextPage();
      expect(observer.current.data!.pageParams, [0, 1, 2]);
      expect(observer.hasNextPage, isFalse);
      version = 2;
      calls.clear();
      await observer.refetch();
      expect(calls, [0, 1, 2]);
      expect(observer.current.data!.pages.first.first, 'v2-0-a');
      observer.dispose();
    });
  });

  group('Riverpod providers', () {
    test('queryProvider fetches while watched, rebuilds on deps change and invalidation refetches', () async {
      final userId = NotifierProvider<_Value, String>(_Value.new);
      var calls = 0;
      final entries = queryProvider<String>((ref) {
        final id = ref.watch(userId);
        return QueryOptions(queryKey: ['illness-episodes', id], queryFn: (_) async => '$id:${++calls}');
      });
      final container = ProviderContainer(overrides: [queryClientProvider.overrideWithValue(client)]);
      addTearDown(container.dispose);
      final sub = container.listen(entries, (_, __) {});
      expect(container.read(entries).isLoading, isTrue);
      await pump();
      expect(container.read(entries).data, 'u1:1');
      container.read(userId.notifier).state = 'u2';
      container.read(entries);
      await pump();
      expect(container.read(entries).data, 'u2:2');
      await client.invalidateQueries(queryKey: const ['illness-episodes']);
      await pump();
      expect(container.read(entries).data, 'u2:3');
      sub.close();
      await pump();
      expect(client.find(const ['illness-episodes', 'u2'])!.observerCount, 0);
    });

    test('mutationProvider exposes state and mutate', () async {
      final add = mutationProvider<int, int, void>((ref) => MutationOptions(mutationFn: (v) async => v + 1));
      final container = ProviderContainer(overrides: [queryClientProvider.overrideWithValue(client)]);
      addTearDown(container.dispose);
      final sub = container.listen(add, (_, __) {});
      container.read(add.notifier).mutate(1);
      await pump();
      expect(container.read(add).data, 2);
      sub.close();
    });
  });
}

class _Value extends Notifier<String> {
  @override
  String build() => 'u1';
}

// Ported from: (behaviour of @tanstack/query-core as relied on by src/hooks; no vitest file)

import 'dart:async';

import 'package:anacan/core/cache/cache.dart';
import 'package:flutter_test/flutter_test.dart';

QueryClient newClient({OnlineManager? online, FocusManager? focus, int Function()? now}) => QueryClient(
      defaults: const QueryDefaults(retry: noRetry),
      onlineManager: online,
      focusManager: focus,
      now: now,
    );

Future<void> pump([int ms = 0]) => Future<void>.delayed(Duration(milliseconds: ms));

void main() {
  group('query keys', () {
    test('hash ignores object key order and prefix matching works like TanStack', () {
      expect(hashQueryKey(['a', {'x': 1, 'y': 2}]), hashQueryKey(['a', {'y': 2, 'x': 1}]));
      expect(partialMatchKey(['illness-entries', 'u1', 'e1'], ['illness-entries']), isTrue);
      expect(partialMatchKey(['illness-entries', 'u1'], ['illness-entries', 'u2']), isFalse);
      expect(partialMatchKey(['a', {'id': 1, 'lang': 'az'}], ['a', {'id': 1}]), isTrue);
      expect(partialMatchKey(['a'], ['a', 'b']), isFalse);
    });
  });

  group('QueryClient defaults', () {
    test('match src/App.tsx and TanStack v5', () {
      const defaults = QueryDefaults();
      expect(defaults.staleTime, const Duration(seconds: 30));
      expect(defaults.gcTime, const Duration(days: 7));
      expect(defaults.refetchOnWindowFocus, RefetchOn.ifStale);
      expect(defaults.refetchOnReconnect, RefetchOn.ifStale);
      expect(defaults.refetchOnMount, RefetchOn.ifStale);
      expect(defaults.networkMode, NetworkMode.online);
      expect(defaults.effectiveRetry(2, Exception()), isTrue);
      expect(defaults.effectiveRetry(3, Exception()), isFalse);
      expect(defaults.effectiveMutationRetry(0, Exception()), isFalse);
      expect(defaultRetryDelay(0, Exception()), const Duration(seconds: 1));
      expect(defaultRetryDelay(3, Exception()), const Duration(seconds: 8));
      expect(defaultRetryDelay(10, Exception()), const Duration(seconds: 30));
    });
  });

  group('fetching', () {
    test('de-duplicates concurrent fetches of the same key', () async {
      final client = newClient();
      var calls = 0;
      final gate = Completer<int>();
      final options = QueryOptions<int>(queryKey: const ['n'], queryFn: (_) {
        calls++;
        return gate.future;
      });
      final a = client.fetchQuery(options);
      final b = client.fetchQuery(options);
      gate.complete(7);
      expect(await a, 7);
      expect(await b, 7);
      expect(calls, 1);
    });

    test('fetchQuery returns fresh cached data without calling the function', () async {
      final client = newClient();
      var calls = 0;
      final options = QueryOptions<int>(
        queryKey: const ['n'],
        staleTime: const Duration(minutes: 1),
        queryFn: (_) async => ++calls,
      );
      expect(await client.fetchQuery(options), 1);
      expect(await client.fetchQuery(options), 1);
      expect(calls, 1);
    });

    test('keeps the previous data while a refetch fails (stale-while-revalidate)', () async {
      final client = newClient();
      var fail = false;
      final options = QueryOptions<String>(
        queryKey: const ['x'],
        queryFn: (_) async => fail ? throw StateError('offline') : 'v1',
      );
      await client.fetchQuery(options);
      fail = true;
      await expectLater(client.build(const ['x']).fetch(options: options), throwsStateError);
      final state = client.getQueryState(const ['x'])!;
      expect(state.data, 'v1');
      expect(state.status, QueryStatus.error);
      expect(state.dataUpdatedAt, greaterThan(0));
    });

    test('retries with the configured policy and delay', () async {
      final client = QueryClient(defaults: QueryDefaults(retry: retryTimes(2), retryDelay: (_, __) => Duration.zero));
      var calls = 0;
      final value = await client.build(const ['r']).fetch(
            options: QueryOptions<int>(
              queryKey: const ['r'],
              queryFn: (_) async => ++calls < 3 ? throw StateError('x') : calls,
            ),
          );
      expect(value, 3);
      expect(calls, 3);
    });

    test('waits while offline (networkMode online) and runs once the network is back', () async {
      final online = OnlineManager(online: false);
      final client = newClient(online: online);
      var calls = 0;
      final future = client.build(const ['o']).fetch(
            options: QueryOptions<int>(queryKey: const ['o'], queryFn: (_) async => ++calls),
          );
      await pump();
      expect(calls, 0);
      expect(client.getQueryState(const ['o'])!.fetchStatus, FetchStatus.paused);
      online.setOnline(true);
      expect(await future, 1);
      expect(client.getQueryState(const ['o'])!.fetchStatus, FetchStatus.idle);
    });
  });

  group('cache updates', () {
    test('setQueryData / getQueryData / updater returning null is a no-op', () {
      final client = newClient();
      client.setQueryData<List<String>>(const ['list'], (old) => [...?old, 'a']);
      client.setQueryData<List<String>>(const ['list'], (old) => [...?old, 'b']);
      expect(client.getQueryData<List<String>>(const ['list']), ['a', 'b']);
      expect(client.setQueryData<List<String>>(const ['list'], (_) => null), isNull);
      expect(client.getQueryData<List<String>>(const ['list']), ['a', 'b']);
      expect(client.getQueryData<int>(const ['list']), isNull);
    });

    test('invalidateQueries marks every key under the prefix stale and refetches only active ones', () async {
      final client = newClient();
      var calls = 0;
      QueryOptions<int> opts(List<Object?> key) => QueryOptions<int>(queryKey: key, queryFn: (_) async => ++calls);
      final observer = QueryObserver<int>(client, opts(['illness-entries', 'u1', 'e1']))..mount();
      await pump();
      await client.fetchQuery(opts(['illness-entries', 'u1', 'e2']));
      await client.fetchQuery(opts(['other']));
      final before = calls;
      await client.invalidateQueries(queryKey: const ['illness-entries']);
      expect(client.getQueryState(const ['illness-entries', 'u1', 'e2'])!.isInvalidated, isTrue);
      expect(client.getQueryState(const ['other'])!.isInvalidated, isFalse);
      expect(calls, before + 1); // only the observed (active) one refetched
      expect(client.getQueryState(const ['illness-entries', 'u1', 'e1'])!.isInvalidated, isFalse);
      observer.dispose();
    });

    test('optimistic update and rollback (useStoryReplies onMutate/onError)', () async {
      final client = newClient();
      client.setQueryDataValue(const ['story-replies', 's1'], <String>['r1']);
      final snapshot = await client.optimisticUpdate<List<String>>(
        const ['story-replies', 's1'],
        (old) => [...?old, 'optimistic'],
      );
      expect(client.getQueryData<List<String>>(const ['story-replies', 's1']), ['r1', 'optimistic']);
      snapshot.rollback();
      expect(client.getQueryData<List<String>>(const ['story-replies', 's1']), ['r1']);
    });

    test('optimistic update cancels an in-flight fetch so it cannot overwrite the optimistic value', () async {
      final client = newClient();
      final gate = Completer<List<String>>();
      final key = ['k'];
      client.setQueryDataValue(key, <String>['a']);
      final fetch = client.build(key).fetch(options: QueryOptions<List<String>>(queryKey: key, queryFn: (_) => gate.future));
      await client.optimisticUpdate<List<String>>(key, (old) => [...?old, 'b']);
      gate.complete(['server']);
      await expectLater(fetch, throwsA(isA<QueryCancelledException>()));
      expect(client.getQueryData<List<String>>(key), ['a', 'b']);
    });

    test('setQueriesData patches every matching query (community post cache pattern)', () {
      final client = newClient();
      client.setQueryDataValue(const ['community-feed', 'u1'], [
        {'id': 'p1', 'likes': 1},
      ]);
      client.setQueryDataValue(const ['single-post', 'p1', 'u1'], {'id': 'p1', 'likes': 1});
      client.setQueriesData(
        QueryFilters(predicate: (q) => const ['community-feed', 'single-post'].contains(q.queryKey.first)),
        (data) => data is List
            ? [for (final p in data) {...(p as Map), 'likes': 2}]
            : {...(data as Map), 'likes': 2},
      );
      expect((client.getQueryData<List>(const ['community-feed', 'u1'])!.first as Map)['likes'], 2);
      expect(client.getQueryData<Map>(const ['single-post', 'p1', 'u1'])!['likes'], 2);
    });

    test('clear drops everything (logout)', () async {
      final client = newClient();
      client.setQueryDataValue(const ['community-feed', 'user-a'], {'private': true});
      client.clear();
      expect(client.getQueryData<Map>(const ['community-feed', 'user-a']), isNull);
      expect(client.queries, isEmpty);
    });

    test('unobserved queries are garbage collected after gcTime', () async {
      final client = newClient();
      await client.fetchQuery(QueryOptions<int>(
        queryKey: const ['gc'],
        gcTime: const Duration(milliseconds: 10),
        queryFn: (_) async => 1,
      ));
      expect(client.find(const ['gc']), isNotNull);
      await pump(30);
      expect(client.find(const ['gc']), isNull);
    });
  });
}

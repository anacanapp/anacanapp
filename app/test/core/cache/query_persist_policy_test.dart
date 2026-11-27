// Ported from: src/lib/query-persist-policy.test.ts, src/lib/deferred-persister.test.ts
// (+ restore/buster/maxAge behaviour of PersistQueryClientProvider in src/App.tsx)

import 'dart:convert';

import 'package:anacan/core/cache/cache.dart';
import 'package:flutter_test/flutter_test.dart';

PersistCandidate q(List<Object?> queryKey,
        {QueryStatus status = QueryStatus.success,
        int? dataUpdatedAt,
        Map<String, Object?>? meta,
        Duration? refetchInterval,
        bool intervalFn = false}) =>
    PersistCandidate(
      queryKey: queryKey,
      status: status,
      dataUpdatedAt: dataUpdatedAt,
      meta: meta,
      refetchInterval: refetchInterval,
      hasRefetchIntervalFunction: intervalFn,
    );

PersistedClient Function() snapshot(int n) => () => {
      'timestamp': n,
      'buster': 'b',
      'clientState': {
        'mutations': <Object?>[],
        'queries': [
          {'queryKey': ['q', n], 'queryHash': 'q$n', 'state': {'data': n}},
        ],
      },
    };

void main() {
  tearDown(resetPersistClearMarkForTests);

  group('shouldPersistQuery', () {
    test('persists stable content queries', () {
      expect(shouldPersistQuery(q(['pregnancy_content', 'az', 12])), isTrue);
      expect(shouldPersistQuery(q(['force-update-config'], refetchInterval: const Duration(milliseconds: 300000))), isTrue);
    });
    test('skips failed, opted-out, feed, chat and story queries', () {
      expect(shouldPersistQuery(q(['vitamins'], status: QueryStatus.error)), isFalse);
      expect(shouldPersistQuery(q(['vitamins'], meta: {'persist': false})), isFalse);
      for (final key in ['community-feed', 'chat-messages-v2', 'story-replies', 'stories', 'post-comments']) {
        expect(shouldPersistQuery(q([key, 'x'])), isFalse, reason: key);
      }
    });
    test('skips polled and admin queries', () {
      expect(shouldPersistQuery(q(['notifications'], refetchInterval: const Duration(milliseconds: 30000))), isFalse);
      expect(shouldPersistQuery(q(['notifications'], intervalFn: true)), isFalse);
      expect(shouldPersistQuery(q(['faqs-admin'])), isFalse);
      expect(shouldPersistQuery(q(['content', 'AdMob'])), isFalse);
      expect(shouldPersistQuery(q(['content', {'id': 1}, null])), isTrue);
    });
  });

  group('sensitive health data', () {
    test('never persists mental health, vitals, illness or health-sync results', () {
      for (final key in [
        'epds-assessments', 'mood-checkins', 'mood-checkin-today', 'bp-logs', 'blood-sugar-logs',
        'illness-entries', 'health-daily', 'health-report-v2', 'doctor-report-extras-v1', 'postpartum-checkins',
      ]) {
        expect(sensitiveHealthKeys.contains(key), isTrue);
        expect(shouldPersistQuery(q([key, 'user-1'])), isFalse);
      }
      expect(shouldPersistQuery(q(['epds-questions', 'az'])), isTrue);
    });

    test('does not re-persist data loaded before a logout, but persists data fetched after it', () async {
      final storage = MemoryQueryPersistStorage()..value = '{"clientState":{}}';
      clearPersistedQueryCache(storage, 1000);
      await Future<void>.delayed(Duration.zero);
      expect(storage.value, isNull);
      expect(shouldPersistQuery(q(['vitamins'], dataUpdatedAt: 900)), isFalse);
      expect(shouldPersistQuery(q(['vitamins'], dataUpdatedAt: 1000)), isFalse);
      expect(shouldPersistQuery(q(['vitamins'], dataUpdatedAt: 1001)), isTrue);
    });
  });

  group('deferred persister', () {
    test('does not serialise while the app is in use, writes the latest snapshot on background', () async {
      final storage = MemoryQueryPersistStorage();
      final p = DeferredQueryPersister(storage: storage, idle: const Duration(minutes: 1));
      for (var i = 1; i <= 20; i++) {
        p.persistClient(snapshot(i));
      }
      expect(storage.writes, 0);
      await p.flush(); // app hidden
      expect(storage.writes, 1);
      expect((jsonDecode(storage.value!) as Map)['timestamp'], 20);
      p.dispose();
    });

    test('writes on the idle timer when the app stays open', () async {
      final storage = MemoryQueryPersistStorage();
      final p = DeferredQueryPersister(storage: storage, idle: const Duration(milliseconds: 30));
      p.persistClient(snapshot(1));
      await Future<void>.delayed(const Duration(milliseconds: 10));
      expect(storage.writes, 0);
      await Future<void>.delayed(const Duration(milliseconds: 150));
      expect(storage.writes, 1);
    });

    test('never writes a snapshot taken before logout', () async {
      var now = 1000;
      final storage = MemoryQueryPersistStorage();
      final p = DeferredQueryPersister(storage: storage, idle: const Duration(minutes: 1), now: () => now);
      p.persistClient(snapshot(1));
      now = 2000;
      clearPersistedQueryCache(storage, now);
      await p.flush();
      expect(storage.writes, 0);
    });

    test('restores what it wrote', () async {
      final storage = MemoryQueryPersistStorage();
      final p = DeferredQueryPersister(storage: storage);
      p.persistClient(snapshot(7));
      await p.flush();
      expect((await p.restoreClient())!['timestamp'], 7);
      p.dispose();
    });

    test('keeps the newer half of the queries when the cache is over budget', () async {
      final storage = MemoryQueryPersistStorage();
      final p = DeferredQueryPersister(storage: storage, maxBytes: 400);
      p.persistClient(() => {
            'timestamp': 1,
            'buster': 'b',
            'clientState': {
              'mutations': <Object?>[],
              'queries': [
                for (var i = 0; i < 6; i++) {'queryKey': ['q', i], 'state': {'data': 'x' * 30}},
              ],
            },
          });
      await p.flush();
      final queries = ((jsonDecode(storage.value!) as Map)['clientState'] as Map)['queries'] as List;
      expect(queries.map((e) => ((e as Map)['queryKey'] as List)[1]), [3, 4, 5]);
      p.dispose();
    });
  });

  group('persisted query client', () {
    QueryClient client(int Function() now) => QueryClient(defaults: const QueryDefaults(retry: noRetry), now: now);

    test('round-trips allowed queries and restores them typed through a codec', () async {
      var now = 1000000;
      final storage = MemoryQueryPersistStorage();
      final source = client(() => now);
      final persistence = QueryCachePersistence(
        client: source,
        persister: DeferredQueryPersister(storage: storage),
        buster: 'anacan-rq-v1',
      );
      persistence.start(flushOnBackground: false);
      await source.fetchQuery(QueryOptions<List<Map<String, dynamic>>>(
        queryKey: const ['vitamins', 'u1'],
        codec: QueryCodecs.rows,
        queryFn: (_) async => [
          {'id': 'v1', 'name': 'D3'},
        ],
      ));
      source.setQueryDataValue(const ['community-feed', 'u1'], [
        {'id': 'p'},
      ]);
      await persistence.flush();
      final written = jsonDecode(storage.value!) as Map;
      expect(written['buster'], 'anacan-rq-v1');
      final keys = ((written['clientState'] as Map)['queries'] as List).map((e) => (e as Map)['queryKey']);
      expect(keys, [
        ['vitamins', 'u1'],
      ]);

      now += 60000;
      final target = client(() => now);
      final restore = QueryCachePersistence(
        client: target,
        persister: DeferredQueryPersister(storage: storage),
        buster: 'anacan-rq-v1',
      );
      await restore.restore();
      final observer = QueryObserver<List<Map<String, dynamic>>>(
        target,
        QueryOptions(
          queryKey: const ['vitamins', 'u1'],
          codec: QueryCodecs.rows,
          queryFn: (_) async => [
            {'id': 'v1', 'name': 'D3 new'},
          ],
        ),
      );
      expect(observer.current.data!.single['name'], 'D3');
      expect(observer.current.isStale, isTrue);
      observer.dispose();
    });

    test('drops a snapshot with another buster or older than 7 days', () async {
      const now = 10 * 24 * 3600 * 1000;
      for (final (buster, timestamp) in [('anacan-rq-v1:azure:abc', now - 1000), ('anacan-rq-v1', now - 8 * 24 * 3600 * 1000)]) {
        final storage = MemoryQueryPersistStorage()
          ..value = jsonEncode({
            'timestamp': timestamp,
            'buster': buster,
            'clientState': {
              'mutations': <Object?>[],
              'queries': [
                {
                  'queryKey': ['vitamins'],
                  'queryHash': '["vitamins"]',
                  'state': {'data': 1, 'dataUpdatedAt': timestamp, 'status': 'success'},
                },
              ],
            },
          });
        final target = client(() => now);
        await QueryCachePersistence(client: target, persister: DeferredQueryPersister(storage: storage), buster: 'anacan-rq-v1')
            .restore();
        expect(target.find(const ['vitamins']), isNull, reason: buster);
        expect(storage.value, isNull);
      }
    });

    test('buster follows the admitted authority', () {
      expect(queryCacheBuster(sourceFirst: true, azure: true, handoffSha256: 'h'), 'anacan-rq-v1:azure:h');
      expect(queryCacheBuster(sourceFirst: true, azure: false), 'anacan-rq-v1');
      expect(queryCacheBuster(sourceFirst: false, azure: true, handoffSha256: 'h'), 'anacan-rq-v1');
    });
  });
}

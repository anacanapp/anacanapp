// Ported from: src/lib/offline-outbox.test.ts, src/lib/offline-outbox-copy.test.ts, src/lib/daily-log-rpc.test.ts,
// src/lib/query-persist-policy.test.ts ("logout cleanup removes …")

import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/i18n/app_languages.dart';
import 'package:anacan/core/offline/offline.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const networkError = {'message': 'TypeError: Failed to fetch', 'details': '', 'hint': '', 'code': ''};
const rlsError = {'message': 'new row violates row-level security policy', 'code': '42501'};

/// Fake server: rows keyed by id, idempotent insert like upsert ignoreDuplicates.
class FakeServer {
  final rows = <String, Map<String, Object?>>{};
  final calls = <String>[];
  String mode = 'ok';

  Future<SendResult> send(String table, Map<String, Object?> row) async {
    calls.add(row['id'] as String);
    if (mode == 'offline') return const SendResult(error: networkError, status: 0);
    if (mode == 'reject') return const SendResult(error: rlsError, status: 403);
    if (rows.containsKey(row['id'])) return const SendResult(status: 201);
    rows[row['id'] as String] = row;
    return SendResult(data: row, status: 201);
  }
}

void main() {
  late LocalStore store;
  late ManualConnectivitySource connectivity;
  late OfflineOutbox outbox;
  var clock = 1000;

  setUp(() {
    store = LocalStore.memory();
    connectivity = ManualConnectivitySource();
    clock = 1000;
    outbox = OfflineOutbox(
      store: store,
      sender: (_, __) async => const SendResult(),
      connectivity: connectivity,
      now: () => clock++,
      log: (_) {},
    );
  });

  group('offline outbox', () {
    test('enqueues entries with the client id as row id and dedupes by id', () {
      expect(outbox.enqueue('u1', id: 'a', table: 'baby_logs', payload: {'log_type': 'sleep'}), isTrue);
      outbox.enqueue('u1', id: 'a', table: 'baby_logs', payload: {'log_type': 'sleep', 'notes': 'x'});
      final entries = outbox.readOutbox('u1');
      expect(entries, hasLength(1));
      expect(entries[0].id, 'a');
      expect(entries[0].table, 'baby_logs');
      expect(entries[0].attempts, 0);
      expect(entries[0].payload, {'log_type': 'sleep', 'notes': 'x', 'id': 'a'});
      expect(entries[0].createdAt, isA<num>());
    });

    test('keeps queues isolated per user', () async {
      outbox.enqueue('u1', id: 'a', table: 'baby_logs', payload: {'user_id': 'u1'});
      outbox.enqueue('u2', id: 'b', table: 'kick_sessions', payload: {'user_id': 'u2'});
      expect(outbox.readOutbox('u1').map((e) => e.id), ['a']);
      expect(outbox.readOutbox('u2').map((e) => e.id), ['b']);
      expect(outbox.pendingRows('u1', 'kick_sessions'), isEmpty);
      final server = FakeServer();
      await outbox.flush('u1', server.send);
      expect(server.calls, ['a']);
      expect(outbox.readOutbox('u1'), isEmpty);
      expect(outbox.readOutbox('u2'), hasLength(1));
    });

    test('saves directly and leaves nothing queued on a confirmed write', () async {
      final server = FakeServer();
      final outcome = await outbox.saveWithOutbox('u1', 'baby_logs', {'user_id': 'u1', 'log_type': 'diaper'}, server.send);
      expect(outcome.status, SaveStatus.saved);
      expect(server.rows, hasLength(1));
      expect(outbox.readOutbox('u1'), isEmpty);
    });

    test('queues on a network failure and flushes later with the same id (idempotent)', () async {
      final server = FakeServer()..mode = 'offline';
      final outcome = await outbox.saveWithOutbox('u1', 'baby_logs', {'user_id': 'u1', 'log_type': 'sleep'}, server.send);
      expect(outcome.status, SaveStatus.queued);
      final entry = outbox.readOutbox('u1').single;
      expect(entry.attempts, 1);
      expect(outbox.pendingRows('u1', 'baby_logs').single, containsPair('id', entry.id));

      final offline = await outbox.flush('u1', server.send);
      expect((offline.sent, offline.failed, offline.dropped), (0, 1, 0));
      expect(outbox.readOutbox('u1').single.attempts, 2);

      server.mode = 'ok';
      final changes = <OutboxChange>[];
      outbox.subscribe(changes.add);
      final flushed = await outbox.flush('u1', server.send);
      expect(flushed.sent, 1);
      expect(flushed.tables, ['baby_logs']);
      expect(outbox.readOutbox('u1'), isEmpty);
      expect(changes.last.userId, 'u1');
      expect(changes.last.sentTables, ['baby_logs']);
      expect(server.rows.keys, [entry.id]);

      outbox.enqueue('u1', id: entry.id, table: 'baby_logs', payload: entry.payload);
      await outbox.flush('u1', server.send);
      expect(server.rows, hasLength(1));
      expect(outbox.readOutbox('u1'), isEmpty);
    });

    test('queues offline, flushes once online and replays idempotently for each new log table', () async {
      for (final table in ['weight_entries', 'meal_logs', 'exercise_logs', 'cycle_history', 'vitamin_intake_logs', 'appointments']) {
        final server = FakeServer()..mode = 'offline';
        final uid = 'u-$table';
        final queued = await outbox.saveWithOutbox(uid, table, {'user_id': uid}, server.send);
        expect(queued.status, SaveStatus.queued);
        final entry = outbox.readOutbox(uid).single;
        expect(entry.table, table);
        expect(entry.payload['id'], entry.id);
        server.mode = 'ok';
        final flushed = await outbox.flush(uid, server.send);
        expect(flushed.sent, 1);
        expect(flushed.tables, [table]);
        expect(server.rows.keys, [entry.id]);
        outbox.enqueue(uid, id: entry.id, table: table, payload: entry.payload);
        await outbox.flush(uid, server.send);
        expect(server.rows, hasLength(1));
        expect(outbox.readOutbox(uid), isEmpty);
      }
    });

    test('returns a real server error without queueing', () async {
      final server = FakeServer()..mode = 'reject';
      final outcome = await outbox.saveWithOutbox('u1', 'kick_sessions', {'user_id': 'u1', 'kick_count': 3}, server.send);
      expect(outcome.status, SaveStatus.error);
      expect(outbox.readOutbox('u1'), isEmpty);
    });

    test('caps retries of entries the server keeps rejecting', () async {
      final server = FakeServer()..mode = 'reject';
      outbox.enqueue('u1', id: 'bad', table: 'baby_logs', payload: {});
      outbox.enqueue('u1', id: 'good', table: 'baby_logs', payload: {});
      for (var i = 1; i < outboxMaxRejects; i++) {
        expect((await outbox.flush('u1', server.send)).dropped, 0);
      }
      expect((await outbox.flush('u1', server.send)).dropped, 2);
      expect(outbox.readOutbox('u1'), isEmpty);
    });

    test('stops a flush at the first network failure and dedupes concurrent flushes', () async {
      final server = FakeServer()..mode = 'offline';
      outbox.enqueue('u1', id: 'a', table: 'baby_logs', payload: {});
      outbox.enqueue('u1', id: 'b', table: 'baby_logs', payload: {});
      final first = outbox.flush('u1', server.send), second = outbox.flush('u1', server.send);
      expect(identical(first, second), isTrue);
      await first;
      expect(server.calls, ['a']);
    });

    test('classifies transient errors', () {
      expect(isTransientError(networkError), isTrue);
      expect(isTransientError({'name': 'AbortError', 'message': 'aborted'}), isTrue);
      expect(isTransientError({'message': 'x'}, status: 503), isTrue);
      expect(isTransientError(rlsError, status: 403), isFalse);
      expect(isTransientError(const SocketException('Failed host lookup')), isTrue);
      expect(isTransientError(http.ClientException('Connection closed')), isTrue);
      expect(isTransientError(const PostgrestException(message: 'JWT expired', code: 'PGRST301')), isTrue);
      expect(isTransientError(const PostgrestException(message: 'violates', code: '23505')), isFalse);
      expect(isTransientError(rlsError, status: 403, online: false), isTrue);
    });

    test('reads entries written by the Capacitor app and writes the same shape back', () {
      const legacy = '[{"id":"0b5c2c8e-8f5b-4a43-9c55-2a1d6f8b7e11","table":"water_intake",'
          '"payload":{"user_id":"u1","log_date":"2026-11-26","delta":250,"id":"0b5c2c8e-8f5b-4a43-9c55-2a1d6f8b7e11"},'
          '"createdAt":1764150000000,"attempts":3,"rejects":1},{"id":"x","table":"unknown","payload":{},"createdAt":1,"attempts":0}]';
      store.setItem(outboxKeyFor('u1'), legacy);
      final entries = outbox.readOutbox('u1');
      expect(entries, hasLength(1));
      expect(entries.single.rejects, 1);
      outbox.enqueue('u1', id: 'n', table: 'daily_logs', payload: {'mood': 3});
      final written = jsonDecode(store.getItem(outboxKeyFor('u1'))!) as List;
      expect(written.first, jsonDecode(legacy)[0]);
    });

    test('retained users flush on reconnect and on resume', () async {
      final server = FakeServer()..mode = 'offline';
      outbox.sender = server.send;
      outbox.enqueue('u1', id: 'a', table: 'baby_logs', payload: {});
      final release = outbox.retainUser('u1');
      await Future<void>.delayed(Duration.zero);
      expect(server.calls, ['a']);
      server.mode = 'ok';
      connectivity.setOnline(false);
      connectivity.setOnline(true);
      await Future<void>.delayed(Duration.zero);
      expect(outbox.readOutbox('u1'), isEmpty);
      release();
    });

    test('newClientId is an RFC 4122 v4 UUID', () {
      expect(newClientId(), matches(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));
    });
  });

  group('sendDailyLogPatch', () {
    test('uses the daily_logs table token', () => expect(dailyLogOutboxTable, 'daily_logs'));

    test('merge-upserts on (user_id, log_date), dropping the entry id, water and undefined fields', () {
      final (row, error) = dailyLogPatchRow({
        'id': 'entry-uuid', 'user_id': 'u1', 'log_date': '2026-11-26',
        'mood': 4, 'symptoms': ['nausea'], 'notes': null, 'water_intake': 999,
      });
      expect(error, isNull);
      expect(row, {'user_id': 'u1', 'log_date': '2026-11-26', 'mood': 4, 'symptoms': ['nausea'], 'notes': null});
    });

    test('rejects an invalid or empty patch', () {
      expect(dailyLogPatchRow({'user_id': 'u1'}).$2!.status, 400);
      expect(dailyLogPatchRow({'user_id': 'u1', 'log_date': '2026-11-26'}).$2!.status, 400);
    });

    test('sends the upsert with on_conflict=user_id,log_date through the SDK', () async {
      late http.Request seen;
      final client = SupabaseClient('https://backend.test', 'anon',
          httpClient: MockClient((request) async {
            seen = request;
            return http.Response('{"id":"row"}', 201, headers: {'content-type': 'application/json'});
          }),
          authOptions: const AuthClientOptions(autoRefreshToken: false));
      final result = await SupabaseOutboxSender(client)('daily_logs', {'id': 'e', 'user_id': 'u1', 'log_date': '2026-11-26', 'mood': 2});
      expect(result.error, isNull);
      expect(seen.url.path, '/rest/v1/daily_logs');
      expect(seen.url.queryParameters['on_conflict'], 'user_id,log_date');
      expect(jsonDecode(seen.body), {'user_id': 'u1', 'log_date': '2026-11-26', 'mood': 2});
    });

    test('water deltas use the op-id RPC and fall back to read-modify-upsert when it is missing', () async {
      final paths = <String>[];
      final client = SupabaseClient('https://backend.test', 'anon',
          httpClient: MockClient((request) async {
            paths.add('${request.method} ${request.url.path}');
            if (request.url.path.endsWith('/rpc/increment_water_intake_v1')) {
              return http.Response('{"code":"PGRST202","message":"Could not find the function"}', 404,
                  headers: {'content-type': 'application/json'});
            }
            if (request.method == 'GET') {
              return http.Response('[{"water_intake":19900}]', 200, headers: {'content-type': 'application/json'});
            }
            return http.Response(jsonEncode(jsonDecode(request.body)), 201, headers: {'content-type': 'application/json'});
          }),
          authOptions: const AuthClientOptions(autoRefreshToken: false));
      final result = await SupabaseOutboxSender(client)
          .sendWaterDelta({'id': 'op', 'user_id': 'u1', 'log_date': '2026-11-26', 'delta': 250});
      expect(result.error, isNull);
      expect((result.data as Map)['water_intake'], 20000);
      expect(paths, ['POST /rest/v1/rpc/increment_water_intake_v1', 'GET /rest/v1/daily_logs', 'POST /rest/v1/daily_logs']);
      expect(clampWater(-5), 0);
    });
  });

  group('offline cache', () {
    tearDown(resetPersistClearMarkForTests);

    test('logout cleanup removes the persisted query cache, offline caches and AI insight cache but keeps first aid', () async {
      final persisted = MemoryQueryPersistStorage()..value = '{}';
      defaultQueryPersistStorage = persisted;
      addTearDown(() => defaultQueryPersistStorage = null);
      final cache = OfflineCache(store, now: () => 1);
      cache.writeCache('profile', 'user-1', {'name': 'x'});
      store.setItem('anacan-baby-insight-v2:["b","user-1","c","az"]:sleep', '{}');
      store.setItem('anacan-firstaid-v1', '{}');
      store.setItem('language', 'az');
      cache.clearAllCaches();
      await Future<void>.delayed(Duration.zero);
      expect(persisted.value, isNull);
      expect(store.getItem('anacan_ocache_v1:profile'), isNull);
      expect(store.getItem('anacan-baby-insight-v2:["b","user-1","c","az"]:sleep'), isNull);
      expect(store.getItem('anacan-firstaid-v1'), '{}');
      expect(store.getItem('language'), 'az');
      expect(shouldPersistQuery(const PersistCandidate(queryKey: ['vitamins'], status: QueryStatus.success, dataUpdatedAt: 1)),
          isFalse);
    });

    test('reads only the same user within 30 days', () {
      var t = 0;
      final cache = OfflineCache(store, now: () => t);
      cache.writeCache('role', 'u1', {'role': 'admin'});
      expect(cache.readCache<Map<String, dynamic>>('role', 'u1'), {'role': 'admin'});
      expect(cache.readCache<Map<String, dynamic>>('role', 'u2'), isNull);
      t = 31 * 24 * 3600 * 1000;
      expect(cache.readCache<Map<String, dynamic>>('role', 'u1'), isNull);
    });
  });

  group('offline save copy in every app language', () {
    test('covers all 25 app languages', () => expect(kAppLanguageCodes, hasLength(25)));

    for (final lang in kAppLanguageCodes) {
      test('$lang has every offline save string', () {
        final dict = jsonDecode(File('assets/i18n/$lang.json').readAsStringSync()) as Map<String, dynamic>;
        for (final MapEntry(:key, value: az) in offlineOutboxCopy.entries) {
          final value = dict[key];
          expect(value is String && value.trim().isNotEmpty, isTrue, reason: '$lang:$key');
          expect(value, isNot(matches(RegExp('[–—]'))), reason: '$lang:$key');
          if (lang == 'az') {
            expect(value, az, reason: key);
          } else if (lang != 'en') {
            expect(value, isNot(az), reason: '$lang:$key translated');
          }
        }
      });
    }
  });
}

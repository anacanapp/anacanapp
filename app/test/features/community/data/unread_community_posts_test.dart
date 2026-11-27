// Ported from: src/hooks/useUnreadCommunityPosts.test.ts, src/hooks/useUnreadCommunityPosts.language.test.tsx
import 'dart:async';

import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community/data/unread_community_posts.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/community_fakes.dart';

CRow post(String id, String language) =>
    {'id': id, 'language': language, 'user_id': 'author', 'created_at': '2026-09-24T10:00:00Z', 'is_active': true, 'group_id': null};

void main() {
  group('readCommunityPostMarkers', () {
    late FakeCommunityBackend backend;
    late List<List<Object?>> batches;
    setUp(() {
      batches = [];
      backend = FakeCommunityBackend()
        ..onSelect = (q) async {
          final ids = q.filter('in', 'post_id') as List<Object?>;
          batches.add(ids);
          return [{'post_id': ids[0]}];
        };
    });

    test('hydrates all 500 markers without sending an overlong UUID request', () async {
      final ids = [for (var i = 0; i < 500; i++) '00000000-0000-4000-8000-${'$i'.padLeft(12, '0')}'];
      final seen = await readCommunityPostMarkers(backend, 'fixture-user', ids);
      expect([for (final b in batches) ...b], ids);
      expect(batches, hasLength(5));
      expect(batches.every((b) => b.length <= 100), isTrue);
      expect(seen.keys.toList(), [ids[0], ids[100], ids[200], ids[300], ids[400]]);
    });

    test('does not query an empty marker set', () async {
      expect(await readCommunityPostMarkers(backend, 'fixture-user', const []), isEmpty);
      expect(backend.named('select'), isEmpty);
    });

    test('does not turn a failed batch into missing read markers', () async {
      backend.onSelect = (q) async => throw const CommunityBackendError(code: '42501');
      await expectLater(readCommunityPostMarkers(backend, 'fixture-user', const ['fixture-post']),
          throwsA(isA<CommunityBackendError>().having((e) => e.code, 'code', '42501')));
    });
  });

  group('language scopes', () {
    late FakeCommunityBackend backend;
    late List<CRow> posts;
    late Set<String> reads;
    late List<CQuery> postQueries;
    late bool failWrite;
    Future<List<CRow>> Function(CQuery q)? delayed;
    late LocalStore store;
    late String backendUrl;

    setUp(() {
      posts = [post('ru-1', 'ru'), post('az-1', 'az')];
      reads = {};
      postQueries = [];
      failWrite = false;
      delayed = null;
      backendUrl = 'https://api.anacan.az';
      store = LocalStore.memory();
      backend = FakeCommunityBackend()
        ..onSelect = (q) async {
          if (q.table == 'community_posts') {
            postQueries.add(q);
            final d = delayed?.call(q);
            if (d != null) return d;
            final gt = q.filter('gt', 'created_at') as String?;
            return posts
                .where((row) =>
                    row['language'] == q.filter('eq', 'language') &&
                    row['is_active'] == true &&
                    row['group_id'] == null &&
                    row['user_id'] != q.filter('neq', 'user_id') &&
                    (gt == null || (row['created_at'] as String).compareTo(gt) > 0))
                .take(q.limitValue!)
                .toList();
          }
          if (q.table == 'community_post_reads') {
            final user = q.filter('eq', 'user_id');
            return [for (final id in (q.filter('in', 'post_id') as List)) if (reads.contains('$user:$id')) {'post_id': id}];
          }
          throw StateError('Unexpected table ${q.table}');
        }
        ..onUpsert = (table, rows, onConflict) async {
          if (failWrite) throw const CommunityBackendError(code: '42501');
          for (final row in rows) {
            reads.add('${row['user_id']}:${row['post_id']}');
          }
        };
    });

    ProviderContainer make() =>
        communityContainer(communityOverrides(backend: backend, store: store, userId: 'viewer', languageFromState: true, backendUrl: backendUrl));

    test('filters before the 500-row bound and isolates last-seen markers by language and backend', () async {
      final c = make();
      final store$ = c.read(unreadCommunityStoreProvider.notifier);
      await store$.hydrateForUser('viewer', 'ru');
      expect(c.read(unreadCommunityStoreProvider).unreadCount, 1);
      expect(postQueries.first.filter('eq', 'language'), 'ru');
      expect(postQueries.first.limitValue, 500);
      await store$.markCommunitySeen('viewer', 'ru');
      expect(c.read(unreadCommunityStoreProvider).unreadCount, 0);
      expect(reads.contains('viewer:ru-1'), isTrue);
      expect(reads.contains('viewer:az-1'), isFalse);
      await store$.hydrateForUser('viewer', 'az');
      expect(c.read(unreadCommunityStoreProvider).unreadCount, 1);
      expect(backend.selects('user_preferences'), isEmpty);
      final azure = communityUnreadScope('https://api.anacan.az', 'viewer', 'ru');
      expect(communityUnreadScope('https://tntbjulojatnrqmylorp.supabase.co', 'viewer', 'ru'), isNot(azure));
    });

    test('ignores a late hydration from the previous language and a response after reset', () async {
      Completer<List<CRow>>? finish;
      // Only 'ru' is delayed; other languages answer from the table.
      delayed = (q) {
        if (q.filter('eq', 'language') != 'ru') return Future.value(posts.where((p) => p['language'] == q.filter('eq', 'language')).toList());
        finish = Completer<List<CRow>>();
        return finish!.future;
      };
      final c = make();
      final s = c.read(unreadCommunityStoreProvider.notifier);
      final pending = s.hydrateForUser('viewer', 'ru');
      await s.hydrateForUser('viewer', 'az');
      finish!.complete([post('ru-late', 'ru')]);
      await pending;
      expect(c.read(unreadCommunityStoreProvider).scope, communityUnreadScope(backendUrl, 'viewer', 'az'));
      expect(c.read(unreadCommunityStoreProvider).unreadPostIds, {'az-1': true});
      final previous = finish;
      final resetting = s.hydrateForUser('viewer', 'ru');
      await until(() => !identical(finish, previous));
      s.reset();
      finish!.complete([post('ru-late', 'ru')]);
      await resetting;
      expect(c.read(unreadCommunityStoreProvider).scope, isNull);
      expect(c.read(unreadCommunityStoreProvider).unreadCount, 0);
    });

    test('refresh drops deleted/inactive posts and a failed mark-all does not manufacture read receipts', () async {
      final c = make();
      final s = c.read(unreadCommunityStoreProvider.notifier);
      await s.hydrateForUser('viewer', 'ru');
      failWrite = true;
      await expectLater(s.markCommunitySeen('viewer', 'ru'), throwsA(isA<CommunityBackendError>().having((e) => e.code, 'code', '42501')));
      expect(c.read(unreadCommunityStoreProvider).unreadCount, 1);
      expect(store.getItem('community_seen_at_v2:${communityUnreadScope(backendUrl, 'viewer', 'ru')}'), isNull);
      posts = posts.where((p) => p['id'] != 'ru-1').toList();
      await s.hydrateForUser('viewer', 'ru');
      expect(c.read(unreadCommunityStoreProvider).unreadCount, 0);
    });

    test('realtime excludes foreign, inactive and group posts, deduplicates events and changes subscription with language', () async {
      final c = make();
      c.read(testLanguageProvider.notifier).set('ru');
      final read = listen(c, unreadCommunityPostsProvider);
      await until(() => read().unreadCount == 1);
      expect(backend.subscriptions.first.filter, 'language=eq.ru');
      final emit = backend.subscriptions.first.onChange;
      void send(CRow row) => emit(CommunityChange(eventType: 'INSERT', newRecord: row));
      send(post('foreign', 'az'));
      send({...post('inactive', 'ru'), 'is_active': false});
      send({...post('group', 'ru'), 'group_id': 'private'});
      send(post('new', 'ru'));
      send(post('new', 'ru'));
      expect(read().unreadCount, 2);
      c.read(testLanguageProvider.notifier).set('az');
      expect(read().unreadCount, 0);
      await until(() => read().unreadCount == 1);
      expect(backend.removedChannels, greaterThan(0));
      send(post('stale-subscription', 'ru'));
      expect(read().unreadCount, 1);
    });
  });
}

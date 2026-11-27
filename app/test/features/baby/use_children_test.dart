// Ported from: src/hooks/useChildren.offline.test.tsx (+ getChildAge / seeding / selection of src/hooks/useChildren.ts)
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/baby/hooks/use_children.dart';
import 'package:anacan/state/child_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../home_mommy/support/mommy_harness.dart';

Future<void> settle([int ms = 10]) => Future<void>.delayed(Duration(milliseconds: ms));

void main() {
  late MommyHarness h;
  final containers = <ProviderContainer>[];

  setUp(() {
    resetChildrenSeedGuard();
    h = MommyHarness();
  });
  tearDown(() {
    for (final c in containers) {
      c.dispose();
    }
    containers.clear();
    h.dispose();
  });

  /// A fresh QueryClient models a separate app session (cold / offline relaunch); the LocalStore (offline cache)
  /// is shared like localStorage.
  ProviderContainer session({QueryClient? client}) {
    final c = ProviderContainer(overrides: h.overridesWith(client: client ?? QueryClient(defaults: const QueryDefaults(retry: noRetry))));
    containers.add(c);
    c.listen(childrenProvider, (_, _) {});
    return c;
  }

  group('useChildren offline cache', () {
    test('shows the last successful children list when a later load fails', () async {
      h.repo.children = [childRow('a')];
      final first = session();
      await settle();
      expect(first.read(childrenProvider).children.map((c) => c.id), ['a']);

      h.repo.childrenError = Exception('TypeError: Failed to fetch');
      final offline = session();
      // Cached children are there immediately, before the failed request settles
      expect(offline.read(childrenProvider).children.map((c) => c.id), ['a']);
      await settle();
      expect(offline.read(childrenProvider).loadError, isTrue);
      expect(offline.read(childrenProvider).children.map((c) => c.id), ['a']);
      expect(offline.read(childrenProvider).hasChildren, isTrue);
    });

    test('reports a load error instead of an empty list as the final state when nothing is cached', () async {
      h.repo.childrenError = Exception('TypeError: Failed to fetch');
      final c = session();
      await settle();
      expect(c.read(childrenProvider).loading, isFalse);
      expect(c.read(childrenProvider).loadError, isTrue);
      expect(c.read(childrenProvider).children, isEmpty);
    });

    test("never shows another user's cached children", () async {
      h.repo.children = [childRow('a')];
      final first = session();
      await settle();
      expect(first.read(childrenProvider).children, hasLength(1));

      final other = MommyHarness(userId: 'u2');
      final c = ProviderContainer(overrides: other.overrides);
      containers.add(c);
      other.repo.childrenError = Exception('TypeError: Failed to fetch');
      // copy the first user's offline cache into the second session's store
      for (final k in h.store.keys) {
        other.store.setItem(k, h.store.getItem(k)!);
      }
      c.listen(childrenProvider, (_, _) {});
      expect(c.read(childrenProvider).children, isEmpty);
      await settle();
      expect(c.read(childrenProvider).loadError, isTrue);
      expect(c.read(childrenProvider).children, isEmpty);
      other.dispose();
    });
  });

  group('useChildren react-query cache', () {
    test('serves repeat mounts from cache without re-SELECTing within staleTime', () async {
      h.repo.children = [childRow('a')];
      final c = session(client: h.client);
      await settle();
      expect(c.read(childrenProvider).children, hasLength(1));
      final after = h.repo.childrenCalls;
      expect(after, greaterThan(0));
      // A second widget mounting the same hook reuses the cached list.
      final sub = c.listen(childrenQuery, (_, _) {});
      expect(c.read(childrenProvider).loading, isFalse);
      await settle();
      expect(h.repo.childrenCalls, after);
      sub.close();
    });

    test('refetches when the children-updated event fires', () async {
      h.repo.children = [childRow('a')];
      final c = session(client: h.client);
      await settle();
      final before = h.repo.childrenCalls;
      h.repo.children = [childRow('a'), childRow('b', sort: 1)];
      await notifyChildrenUpdated(h.client, 'u1');
      await settle();
      expect(c.read(childrenProvider).children.map((c) => c.id), ['a', 'b']);
      expect(h.repo.childrenCalls, greaterThan(before));
    });
  });

  group('selection, seeding and age', () {
    test('auto-selects the first child and switches to another one', () async {
      h.repo.children = [childRow('a'), childRow('b', sort: 1)];
      final c = session(client: h.client);
      await settle();
      expect(c.read(childStoreProvider).selectedChildId, 'a');
      expect(c.read(childrenProvider).hasMultipleChildren, isTrue);
      c.read(childrenActionsProvider).setSelectedChild(c.read(childrenProvider).children[1]);
      expect(c.read(childrenProvider).selectedChild!.id, 'b');
      // persisted like zustand (`selected-child-storage`)
      expect(h.store.getItem('selected-child-storage'), contains('"selectedChildId":"b"'));
    });

    test('seeds the first child from the profile baby fields once', () async {
      h.repo.profile = {'baby_name': 'Nuray', 'baby_birth_date': '2026-03-01', 'baby_gender': 'other', 'due_date': '2026-03-20'};
      final c = session(client: h.client);
      await settle();
      final kids = c.read(childrenProvider).children;
      expect(kids, hasLength(1));
      expect(kids.first.name, 'Nuray');
      expect(kids.first.gender, 'boy');
      expect(kids.first.avatarEmoji, '👦');
      expect(kids.first.dueDate, '2026-03-20');
      expect(seedAttemptedUsers, contains('u1'));
    });

    test('addChild inserts with the next sort order and deleteChild deactivates', () async {
      h.repo.children = [childRow('a')];
      final c = session(client: h.client);
      await settle();
      final added = await c.read(childrenActionsProvider).addChild(name: 'Elif', birthDate: '2026-10-01', gender: 'girl');
      expect(added, isNotNull);
      expect(h.repo.inserted.single['sort_order'], 1);
      expect(h.repo.inserted.single['avatar_emoji'], '👧');
      expect(await c.read(childrenActionsProvider).deleteChild('a'), isTrue);
      expect(h.repo.calls, contains('updateChild:a:is_active'));
    });

    test('getChildAge applies the corrected age only for premature babies', () {
      DomainClock.setSystemTime(DateTime(2026, 11, 27, 12));
      addTearDown(DomainClock.reset);
      final term = getChildAge(childRowChild('t', birth: '2026-05-27'));
      expect((term.months, term.correctionApplied, term.correctedMonths), (6, false, 6));
      final pre = getChildAge(childRowChild('p', birth: '2026-05-27', due: '2026-07-22'));
      expect(pre.isPremature, isTrue);
      expect(pre.correctionApplied, isTrue);
      expect(pre.correctedMonths, 4);
      expect(pre.gestationalWeeksAtBirth, 32);
    });
  });
}

Child childRowChild(String id, {required String birth, String? due}) => Child.fromRow(childRow(id, birth: birth, due: due));

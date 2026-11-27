// Ported from: src/components/community/StoriesBar.open.test.tsx
import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/features/community_stories/data/stories.dart';
import 'package:anacan/features/community_stories/data/stories_backend.dart';
import 'package:anacan/features/community_stories/ui/stories_bar.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/stories_fakes.dart';

class _Hook {
  List<UserStoryGroup> groups = [];
  bool fetching = false;
  int refetches = 0;
}

final _hookProvider = NotifierProvider<TestValue<int>, int>(() => TestValue<int>(0));

List<UserStoryGroup> ownerGroup(List<String> ids) => [
      UserStoryGroup(userId: 'owner', userName: 'Owner', userAvatar: null, hasUnviewed: true, stories: [for (final id in ids) {'id': id}]),
    ];

void main() {
  late _Hook hook;

  Future<ProviderContainer> pump(WidgetTester tester, String target, VoidCallback consumed) async {
    await pumpCommunity(
      tester,
      Builder(
        builder: (context) => StoriesBar(autoOpenStoryId: target, onAutoOpenConsumed: consumed),
      ),
      overrides: [
        ...communityOverrides(backend: FakeCommunityBackend(), userId: 'owner', profile: Profile({'user_id': 'owner', 'name': 'Owner'})),
        storyStorageProvider.overrideWithValue(FakeStoryStorage()),
        storiesProvider.overrideWith((ref, groupId) {
          ref.watch(_hookProvider);
          final groups = hook.groups;
          return StoriesView(
            stories: [for (final g in groups) ...g.stories],
            storyGroups: groups,
            isLoading: false,
            isFetching: hook.fetching,
            refetch: () async => hook.refetches++,
          );
        }),
        storiesBarViewerBuilderProvider.overrideWithValue(
          (context, {required groupId, required groups, required initialGroupIndex, initialStoryId, required onClose}) =>
              Text('viewer:$initialStoryId', key: const ValueKey('viewer')),
        ),
      ],
    );
    await tester.pump();
    return ProviderScope.containerOf(tester.element(find.byType(StoriesBar)));
  }

  setUp(() {
    hook = _Hook()..groups = ownerGroup(['old']);
  });

  group('freshly published story navigation', () {
    testWidgets('refreshes a stale cached list before consuming a new story target', (tester) async {
      var consumed = 0;
      final c = await pump(tester, 'new', () => consumed++);
      expect(hook.refetches, 1);
      expect(consumed, 0);
      expect(find.byKey(const ValueKey('viewer')), findsNothing);
      hook.groups = ownerGroup(['old', 'new']);
      c.read(_hookProvider.notifier).set(1);
      await tester.pump();
      await tester.pump();
      await tester.pumpAndSettle();
      expect(find.text('viewer:new'), findsOneWidget);
      expect(consumed, 1);
      await flushCommunity(tester);
    });

    testWidgets('consumes an unavailable target only after a refresh has completed', (tester) async {
      var consumed = 0;
      final c = await pump(tester, 'expired', () => consumed++);
      hook.fetching = true;
      c.read(_hookProvider.notifier).set(1);
      await tester.pump();
      await tester.pump();
      expect(consumed, 0);
      hook.fetching = false;
      c.read(_hookProvider.notifier).set(2);
      await tester.pump();
      await tester.pump();
      expect(consumed, 1);
      expect(hook.refetches, 1);
      await flushCommunity(tester);
    });
  });
}

// Ported from: src/components/community/CommunityScreen.deeplink.test.tsx
//
// The nested screens are stubbed through [communityScreenPartsProvider] / [communityStoriesBarProvider] like the
// vi.mock'ed children; labels are the az defaults (the React test mocked `tr` to return keys).
import 'dart:async';

import 'package:anacan/features/community/community_slots.dart';
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community/ui/community_screen.dart';
import 'package:anacan/shell/links/push_nav.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/community_fakes.dart';

const sender = '01234567-89ab-4cde-8fab-0123456789ab';
const other = '11234567-89ab-4cde-8fab-0123456789ab';
const CRow card = {'user_id': sender, 'name': 'Database Sender', 'avatar_url': '/verified-avatar.png', 'badge_type': null};

class _Stories extends StatefulWidget {
  const _Stories({this.autoOpen, this.onConsumed});
  final String? autoOpen;
  final VoidCallback? onConsumed;
  @override
  State<_Stories> createState() => _StoriesState();
}

class _StoriesState extends State<_Stories> {
  String? opened;

  @override
  void initState() {
    super.initState();
    _check(null);
  }

  @override
  void didUpdateWidget(_Stories old) {
    super.didUpdateWidget(old);
    _check(old.autoOpen);
  }

  void _check(String? previous) {
    final id = widget.autoOpen;
    if (id == null || id == previous) return;
    opened = id;
    scheduleMicrotask(() => widget.onConsumed?.call());
  }

  @override
  Widget build(BuildContext context) => Column(children: [
        Text('story:${opened ?? ''}'),
        Text('pending-story:${widget.autoOpen ?? ''}'),
        GestureDetector(onTap: () => setState(() => opened = null), child: const Text('Close story')),
      ]);
}

Widget _button(String label, VoidCallback onTap) => GestureDetector(onTap: onTap, child: Text(label));

final parts = CommunityScreenParts(
  feed: (context, {required onCreatePost, required onUserClick}) => SliverToBoxAdapter(
    child: Column(children: [
      const Text('feed'),
      _button('Create post', onCreatePost),
      _button('View profile', () => onUserClick('profile-user')),
    ]),
  ),
  profile: (context, userId, onBack) => Column(children: [Text('profile:$userId'), _button('Close profile', onBack)]),
  composer: (context, onBack) => _button('Close composer', onBack),
  post: (context, postId, commentId, onBack) => Column(children: [Text('post:$postId|${commentId ?? ''}'), _button('Close post', onBack)]),
  conversations: (context, onBack, onOpenChat) => Column(children: [
    const Text('conversations'),
    _button('Close conversations', onBack),
    _button('Open existing DM', () => onOpenChat('existing-dm-user', 'Existing DM', null)),
  ]),
  dm: (context, userId, name, avatar, onBack) => Column(children: [Text('dm:$userId|${avatar ?? ''}'), Text(name), _button('Close DM', onBack)]),
);

class _Host extends StatefulWidget {
  const _Host({required this.target, required this.consumed, this.onOpenNotifications});
  final ValueNotifier<CommunityDeepLinkTarget?> target;
  final ValueNotifier<VoidCallback?> consumed;
  final VoidCallback? onOpenNotifications;
  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  @override
  Widget build(BuildContext context) => ValueListenableBuilder(
        valueListenable: widget.consumed,
        builder: (context, consumed, _) => ValueListenableBuilder(
          valueListenable: widget.target,
          builder: (context, target, _) => CommunityScreenPage(
            screen: CommunityScreen(deepLinkTarget: target, onDeepLinkConsumed: consumed, onOpenNotifications: widget.onOpenNotifications),
          ),
        ),
      );
}

void main() {
  late FakeCommunityBackend backend;
  late Future<Map<String, CRow>> Function(List<String> ids) cards;
  late ValueNotifier<CommunityDeepLinkTarget?> target;
  late ValueNotifier<VoidCallback?> consumedCb;
  late int consumed;

  setUp(() {
    cards = (ids) async => {sender: card};
    backend = FakeCommunityBackend()..onProfileCards = (ids) => cards(ids);
    target = ValueNotifier(null);
    consumed = 0;
    consumedCb = ValueNotifier(() => consumed++);
  });

  int lookups() => backend.named('profileCards').length;

  Future<void> mount(WidgetTester tester, {CommunityDeepLinkTarget? initial, VoidCallback? onOpenNotifications}) async {
    target.value = initial;
    await pumpCommunity(
      tester,
      _Host(target: target, consumed: consumedCb, onOpenNotifications: onOpenNotifications),
      overrides: [
        ...communityOverrides(backend: backend, userId: other),
        communityScreenPartsProvider.overrideWithValue(parts),
        communityNotificationsUnreadProvider.overrideWithValue(3),
        communityDmUnreadProvider.overrideWithValue(0),
        communityStoriesBarProvider.overrideWithValue(
            (context, {groupId, autoOpenStoryId, onAutoOpenConsumed}) => _Stories(autoOpen: autoOpenStoryId, onConsumed: onAutoOpenConsumed)),
      ],
    );
    await settleUi(tester);
  }

  Future<void> rerender(WidgetTester tester, CommunityDeepLinkTarget? next) async {
    target.value = next;
    await settleUi(tester);
  }

  Future<void> tapText(WidgetTester tester, String text) async {
    await tester.tap(find.text(text));
    await settleUi(tester);
  }

  group('Community push deep links', () {
    testWidgets('opens the signed-in user community profile from its header', (tester) async {
      await mount(tester);
      await tester.tap(find.bySemanticsLabel('Cəmiyyət profilim'));
      await settleUi(tester);
      expect(find.text('profile:$other'), findsOneWidget);
      await flushCommunity(tester);
    });

    testWidgets('opens a follower profile target while consuming the deep link once', (tester) async {
      await mount(tester, initial: const CommunityDeepLinkTarget(userId: sender));
      expect(find.text('profile:$sender'), findsOneWidget);
      expect(consumed, 1);
      await flushCommunity(tester);
    });

    testWidgets('places notifications immediately before messages and opens them through the parent', (tester) async {
      var opened = 0;
      await mount(tester, onOpenNotifications: () => opened++);
      final notifications = find.bySemanticsLabel('Bildirişlər');
      final messages = find.bySemanticsLabel('Mesajlar');
      final n = tester.getRect(notifications), m = tester.getRect(messages);
      expect(n.right <= m.left, isTrue);
      expect(m.left - n.right, lessThan(12));
      expect(find.text('3'), findsOneWidget);
      await tester.tap(notifications);
      expect(opened, 1);
      await flushCommunity(tester);
    });

    testWidgets('opens the actual sender DM using the backend card, never push display data, and consumes it once', (tester) async {
      final t = intentFromPushData({
        'type': 'direct_message', 'sender_id': sender, //
        'userName': 'Forged payload name', 'name': 'Forged payload name', 'avatar_url': '/forged.png',
      })!.communityTarget;
      await mount(tester, initial: t);
      expect(find.text('dm:$sender|${card['avatar_url']}'), findsOneWidget);
      expect(find.text('Database Sender'), findsOneWidget);
      expect(find.text('Forged payload name'), findsNothing);
      expect(backend.named('profileCards').single.args[0], [sender]);
      expect(consumed, 1);
      await rerender(tester, null);
      expect(find.textContaining('dm:'), findsOneWidget);
      await tapText(tester, 'Close DM');
      expect(find.text('feed'), findsOneWidget);
      await rerender(tester, null);
      expect(find.textContaining('dm:'), findsNothing);
      expect(consumed, 1);
      await flushCommunity(tester);
    });

    for (final t in const [
      CommunityDeepLinkTarget(conversations: true),
      CommunityDeepLinkTarget(dmUserId: ''),
      CommunityDeepLinkTarget(dmUserId: 'not-a-uuid'),
      CommunityDeepLinkTarget(dmUserId: '$sender,receiver_id.eq.other'),
    ]) {
      testWidgets('shows conversations without a lookup for $t', (tester) async {
        await mount(tester, initial: t);
        expect(find.text('conversations'), findsOneWidget);
        expect(lookups(), 0);
        expect(consumed, 1);
        await tapText(tester, 'Close conversations');
        expect(find.text('feed'), findsOneWidget);
        await flushCommunity(tester);
      });
    }

    for (final result in ['missing', 'mismatched', 'error']) {
      testWidgets('falls back to conversations for a $result card', (tester) async {
        cards = (ids) async {
          if (result == 'error') throw StateError('Profile lookup failed');
          return result == 'missing' ? {} : {sender: {...card, 'user_id': other}};
        };
        await mount(tester, initial: const CommunityDeepLinkTarget(dmUserId: sender));
        expect(find.text('conversations'), findsOneWidget);
        expect(find.textContaining('dm:'), findsNothing);
        expect(consumed, 1);
        await flushCommunity(tester);
      });
    }

    testWidgets('does not restart a pending lookup when only the parent callback changes', (tester) async {
      final resolve = Completer<Map<String, CRow>>();
      cards = (ids) => resolve.future;
      var oldConsumed = 0, newConsumed = 0;
      consumedCb.value = () => oldConsumed++;
      final t = const CommunityDeepLinkTarget(dmUserId: sender);
      await mount(tester, initial: t);
      expect(find.byType(CommunityScreen), findsOneWidget);
      expect(find.text('feed'), findsNothing);
      consumedCb.value = () => newConsumed++;
      await settleUi(tester);
      resolve.complete({sender: card});
      await settleUi(tester);
      expect(find.textContaining('dm:'), findsOneWidget);
      expect(lookups(), 1);
      expect(oldConsumed, 1);
      expect(newConsumed, 0);
      await flushCommunity(tester);
    });

    testWidgets('consumes a DM immediately without cancelling its lookup when the parent clears the target', (tester) async {
      final resolve = Completer<Map<String, CRow>>();
      cards = (ids) => resolve.future;
      await mount(tester, initial: const CommunityDeepLinkTarget(dmUserId: sender));
      expect(consumed, 1);
      await rerender(tester, null);
      resolve.complete({sender: card});
      await settleUi(tester);
      expect(find.text('dm:$sender|${card['avatar_url']}'), findsOneWidget);
      expect(consumed, 1);
      await flushCommunity(tester);
    });

    for (final (t, expected) in const [
      (CommunityDeepLinkTarget(postId: 'new-post', commentId: 'new-comment'), 'post:'),
      (CommunityDeepLinkTarget(storyId: 'new-story'), 'story:new-story'),
      (CommunityDeepLinkTarget(conversations: true), 'conversations'),
      (CommunityDeepLinkTarget(dmUserId: other), 'dm:'),
    ]) {
      testWidgets('ignores an old DM response after a new target $t', (tester) async {
        final first = Completer<Map<String, CRow>>();
        var calls = 0;
        cards = (ids) => calls++ == 0 ? first.future : Future.value({other: {...card, 'user_id': other, 'name': 'New Sender'}});
        await mount(tester, initial: const CommunityDeepLinkTarget(dmUserId: sender));
        await rerender(tester, t);
        first.complete({sender: card});
        await settleUi(tester);
        expect(expected == 'conversations' ? find.text(expected) : find.textContaining(expected), findsOneWidget);
        expect(find.text('Database Sender'), findsNothing);
        expect(consumed, 2);
        if (expected == 'dm:') expect(find.textContaining('dm:$other'), findsOneWidget);
        await flushCommunity(tester);
      });
    }

    testWidgets('does not replay a consumed target or navigate after unmount during a lookup', (tester) async {
      final resolve = Completer<Map<String, CRow>>();
      cards = (ids) => resolve.future;
      await mount(tester, initial: const CommunityDeepLinkTarget(dmUserId: sender));
      expect(consumed, 1);
      await tester.pumpWidget(const SizedBox());
      resolve.complete({sender: card});
      await settleUi(tester);
      expect(consumed, 1);
      await mount(tester);
      expect(find.text('feed'), findsOneWidget);
      expect(lookups(), 1);
      await flushCommunity(tester);
    });

    for (final nested in ['composer', 'profile', 'conversations', 'dm', 'post']) {
      testWidgets('replaces a stale $nested with a post/comment and clears its back stack', (tester) async {
        await mount(tester, initial: nested == 'post' ? const CommunityDeepLinkTarget(postId: 'old-post') : null);
        if (nested == 'composer') await tapText(tester, 'Create post');
        if (nested == 'profile') await tapText(tester, 'View profile');
        if (nested == 'conversations' || nested == 'dm') {
          await tester.tap(find.bySemanticsLabel('Mesajlar'));
          await settleUi(tester);
          if (nested == 'dm') await tapText(tester, 'Open existing DM');
        }
        await rerender(tester, const CommunityDeepLinkTarget(postId: 'new-post', commentId: 'new-comment'));
        expect(find.text('post:new-post|new-comment'), findsOneWidget);
        await tapText(tester, 'Close post');
        expect(find.text('feed'), findsOneWidget);
        expect(find.textContaining('dm:'), findsNothing);
        expect(find.text('conversations'), findsNothing);
        await flushCommunity(tester);
      });
    }

    testWidgets('preserves post, comment and story targets without letting any hide a newer DM', (tester) async {
      await mount(tester, initial: const CommunityDeepLinkTarget(postId: 'post', commentId: 'comment'));
      expect(find.text('post:post|comment'), findsOneWidget);
      await rerender(tester, const CommunityDeepLinkTarget(storyId: 'story'));
      expect(find.text('story:story'), findsOneWidget);
      expect(find.text('pending-story:'), findsOneWidget);
      expect(find.textContaining('post:'), findsNothing);
      await rerender(tester, const CommunityDeepLinkTarget(dmUserId: sender));
      expect(find.textContaining('dm:'), findsOneWidget);
      await tapText(tester, 'Close DM');
      expect(find.text('feed'), findsOneWidget);
      expect(find.text('story:'), findsOneWidget);
      expect(consumed, 3);
      await flushCommunity(tester);
    });

    for (final kind in ['dm', 'story']) {
      testWidgets('clears an old $kind on a generic Community push without reopening it', (tester) async {
        await mount(tester, initial: kind == 'dm' ? const CommunityDeepLinkTarget(dmUserId: sender) : const CommunityDeepLinkTarget(storyId: 'story'));
        if (kind == 'dm') {
          expect(find.textContaining('dm:'), findsOneWidget);
        } else {
          expect(find.text('story:story'), findsOneWidget);
        }
        await rerender(tester, const CommunityDeepLinkTarget());
        expect(find.text('feed'), findsOneWidget);
        expect(find.textContaining('dm:'), findsNothing);
        expect(find.text('story:'), findsOneWidget);
        await flushCommunity(tester);
      });
    }

    testWidgets('keeps an opened story stable when its parent target is consumed', (tester) async {
      await mount(tester, initial: const CommunityDeepLinkTarget(storyId: 'story'));
      await rerender(tester, null);
      expect(find.text('story:story'), findsOneWidget);
      expect(find.text('pending-story:'), findsOneWidget);
      await flushCommunity(tester);
    });
  });
}

Future<void> settleUi(WidgetTester tester) async {
  for (var i = 0; i < 6; i++) {
    await tester.pump();
  }
}

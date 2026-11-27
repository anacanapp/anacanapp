// Ported from: src/lib/pushNav.test.ts (+ a table row for every push `type`)
import 'package:anacan/shell/links/deeplink.dart';
import 'package:anacan/shell/links/nav_handoffs.dart';
import 'package:anacan/shell/links/push_nav.dart';
import 'package:flutter_test/flutter_test.dart';

const sender = '01234567-89ab-4cde-8fab-0123456789ab';
const current = 'https://current-app.example.test';
const azure = 'https://anacan-gateway.example.azurecontainerapps.io';

const community = PushNavIntent(tab: 'community');
PushNavIntent communityAt(CommunityDeepLinkTarget t) => PushNavIntent(tab: 'community', communityTarget: t);

void main() {
  group('push type mapping', () {
    for (final type in ['message', 'partner_message', 'love', 'thank_you']) {
      test('preserves $type partner navigation', () {
        expect(intentFromPushData({'type': type}), const PushNavIntent(motherChat: true));
      });
    }

    test('uses only the server sender UUID for a direct message', () {
      expect(
        intentFromPushData({
          'type': 'direct_message', 'sender_id': sender.toUpperCase(), 'userId': 'not-the-sender',
          'userName': 'Forged name', 'avatar_url': 'https://untrusted.example/avatar.png',
        }),
        communityAt(const CommunityDeepLinkTarget(dmUserId: sender)),
      );
    });

    for (final s in <Object?>[
      null, '', 'not-a-uuid', 42, [sender], {'user_id': sender},
      '$sender ', '$sender,receiver_id.eq.other', '01234567-89ab-4cde-0fab-0123456789ab',
    ]) {
      test('falls back to conversations for an invalid sender ($s)', () {
        expect(intentFromPushData({'type': 'direct_message', 'sender_id': s, 'senderId': sender, 'user_id': sender}),
            communityAt(const CommunityDeepLinkTarget(conversations: true)));
      });
    }

    test('opens the running Tərbiyə programme from its reminder (and ignores a malformed id)', () {
      final store = ParentingTargetStore();
      expect(intentFromPushData({'type': 'parenting_programme', 'partner': '0', 'programme': 'tantrums-14'}, parenting: store),
          const PushNavIntent(tool: 'parenting'));
      expect(store.peek(), const ParentingTarget('programme', 'tantrums-14'));
      store.clear();
      expect(intentFromPushData({'type': 'parenting_programme', 'partner': '1', 'programme': '../x'}, parenting: store),
          const PushNavIntent(screen: 'partner-parenting'));
      expect(store.peek(), isNull);
    });

    test('maps shopping without guessing the recipient role', () {
      expect(intentFromPushData({'type': 'shopping_list'}), const PushNavIntent(shoppingList: true));
    });

    for (final type in ['sos', 'sos_alert', 'birth', 'birth_alert']) {
      test('returns Home for $type', () => expect(intentFromPushData({'type': type}), const PushNavIntent(tab: 'home')));
    }

    final exact = <String, CommunityDeepLinkTarget>{
      'community_like': const CommunityDeepLinkTarget(postId: 'post'),
      'community_comment': const CommunityDeepLinkTarget(postId: 'post'),
      'community_reply': const CommunityDeepLinkTarget(postId: 'post', commentId: 'comment'),
      'comment_like': const CommunityDeepLinkTarget(postId: 'post', commentId: 'comment'),
      'story_like': const CommunityDeepLinkTarget(storyId: 'story'),
      'story_reply': const CommunityDeepLinkTarget(storyId: 'story'),
    };
    for (final e in exact.entries) {
      test('preserves the exact ${e.key} target', () {
        expect(intentFromPushData({'type': e.key, 'postId': 'post', 'commentId': 'comment', 'storyId': 'story'}), communityAt(e.value));
      });
    }

    for (final type in ['like', 'comment', 'community']) {
      test('preserves generic $type navigation', () => expect(intentFromPushData({'type': type}), community));
    }

    final screens = <String, PushNavIntent>{
      'premium_expired': const PushNavIntent(screen: 'billing'),
      'subscription': const PushNavIntent(screen: 'billing'),
      'contraction_511': const PushNavIntent(screen: 'live-contractions'),
      'appointment': const PushNavIntent(screen: 'calendar'),
      'appointment_reminder': const PushNavIntent(screen: 'calendar'),
      'flow_reminder': const PushNavIntent(tab: 'home'),
      'period_reminder': const PushNavIntent(tab: 'home'),
      'pill_reminder': const PushNavIntent(tab: 'home'),
    };
    for (final e in screens.entries) {
      test('preserves ${e.key} navigation', () => expect(intentFromPushData({'type': e.key}), e.value));
    }

    for (final data in <Map<String, Object?>>[{}, {'type': 'unknown'}, {'type': ''}]) {
      test('ignores unknown types ($data)', () => expect(intentFromPushData(data), isNull));
    }
  });

  group('every push type (table)', () {
    const uuid = '7f1c2d9e-1b2a-4c3d-9e8f-001122334455';
    final table = <String, (Map<String, Object?>, PushNavIntent)>{
      'message': (const {}, const PushNavIntent(motherChat: true)),
      'partner_message': (const {}, const PushNavIntent(motherChat: true)),
      'love': (const {}, const PushNavIntent(motherChat: true)),
      'thank_you': (const {}, const PushNavIntent(motherChat: true)),
      'direct_message': (const {'sender_id': uuid}, communityAt(const CommunityDeepLinkTarget(dmUserId: uuid))),
      'shopping_list': (const {}, const PushNavIntent(shoppingList: true)),
      'parenting_programme': (const {'programme': 'p-1'}, const PushNavIntent(tool: 'parenting')),
      'baby_chat': (const {}, const PushNavIntent(screen: 'baby-chat')),
      'group_message': (const {'groupId': uuid}, communityAt(const CommunityDeepLinkTarget(groupId: uuid))),
      'group_invite': (const {'groupId': 'nope'}, community),
      'group_join_request': (const {'groupId': uuid}, communityAt(const CommunityDeepLinkTarget(groupId: uuid))),
      'community_like': (const {'postId': 'x'}, communityAt(const CommunityDeepLinkTarget(postId: 'x'))),
      'community_comment': (const {}, communityAt(const CommunityDeepLinkTarget())),
      'community_moderation': (const {'postId': uuid}, communityAt(const CommunityDeepLinkTarget(postId: uuid))),
      'moderation_action': (const {}, const PushNavIntent(screen: 'moderation-history')),
      'community_reply': (const {'postId': 'p', 'interactionId': uuid, 'commentId': 'c'},
          communityAt(const CommunityDeepLinkTarget(postId: 'p', commentId: uuid))),
      'comment_like': (const {'postId': 'p', 'commentId': 'c'}, communityAt(const CommunityDeepLinkTarget(postId: 'p', commentId: 'c'))),
      'story_like': (const {'storyId': 's'}, communityAt(const CommunityDeepLinkTarget(storyId: 's'))),
      'story_reply': (const {'storyId': 's'}, communityAt(const CommunityDeepLinkTarget(storyId: 's'))),
      'like': (const {}, community),
      'comment': (const {}, community),
      'community': (const {}, community),
      'premium_expired': (const {}, const PushNavIntent(screen: 'billing')),
      'subscription': (const {}, const PushNavIntent(screen: 'billing')),
      'contraction_511': (const {}, const PushNavIntent(screen: 'live-contractions')),
      'appointment': (const {}, const PushNavIntent(screen: 'calendar')),
      'appointment_reminder': (const {}, const PushNavIntent(screen: 'calendar')),
      'flow_reminder': (const {}, const PushNavIntent(tab: 'home')),
      'period_reminder': (const {}, const PushNavIntent(tab: 'home')),
      'pill_reminder': (const {}, const PushNavIntent(tab: 'home')),
      'sos': (const {}, const PushNavIntent(tab: 'home')),
      'sos_alert': (const {}, const PushNavIntent(tab: 'home')),
      'birth': (const {}, const PushNavIntent(tab: 'home')),
      'birth_alert': (const {}, const PushNavIntent(tab: 'home')),
    };
    test('covers kPushTypes exactly', () => expect(table.keys.toSet(), kPushTypes.toSet()));
    for (final e in table.entries) {
      test(e.key, () => expect(intentFromPushData({'type': e.key, ...e.value.$1}), e.value.$2));
    }
    test('community_moderation with a non-UUID post id opens Community without a target', () {
      expect(intentFromPushData({'type': 'community_moderation', 'postId': 'x'}), community);
    });
  });

  group('push link trust boundary and pending intents', () {
    late PushNavRouter router;
    setUp(() => router = PushNavRouter(currentOrigin: current, backendUrl: azure));

    for (final link in [
      'https://anacan.az/community', 'https://www.anacan.az/', 'https://anacanapp.lovable.app/messages',
      '$current/community', '$azure/messages',
    ]) {
      test('opens the trusted web destination $link in the WebView', () {
        final action = router.navigateFromPush({'type': 'shopping_list', 'deeplink': link});
        if (RegExp(r'^https://(www\.)?anacan\.az/').hasMatch(link)) {
          // Website pages open in the phone's browser once the app is visible.
          expect(action, PushTapOpenBrowser(link));
        } else {
          expect(action, PushTapWebNavigate(link, fallback: const PushNavIntent(shoppingList: true)));
        }
        expect(router.consumePending(), isNull);
      });
    }

    for (final link in ['anacan://tool/shopping', 'com.atlasoon.anacan://messages', 'https://app.anacan.az/tool/shopping']) {
      test('routes the exact app destination $link inside the app', () {
        final action = router.navigateFromPush({'type': 'shopping_list', 'deeplink': link});
        expect(action, isA<PushTapIntent>());
        final intent = (action! as PushTapIntent).intent;
        expect(intent.deeplink, isNotNull);
        // Kept for a cold start behind the PIN lock; the shell consumes it once.
        expect(router.consumePending(), intent);
        expect(router.consumePending(), isNull);
      });
    }

    test('opens a tool link as an in-app tool route', () {
      router.navigateFromPush({'type': 'admin_direct', 'deeplink': 'anacan://tool/cry-translator'});
      expect(router.consumePending(), const PushNavIntent(deeplink: ParsedDeeplink('tool', {'tool_id': 'cry-translator'})));
    });

    test('resolves an existing relative-path convention against the current app, not another origin', () {
      expect(router.navigateFromPush({'deeplink': '/tool/shopping'}), const PushTapWebNavigate('$current/tool/shopping'));
    });

    for (final link in [
      'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' \tjava\nscript:alert(1)',
      'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd',
      'blob:$current/id', 'about:blank', 'intent://messages', 'otherapp://messages',
      'capacitor://app.anacan.az/messages', 'anacan:messages', 'tel:12345',
      'http://app.anacan.az/messages', 'http://current-app.example.test/messages',
      'https://attacker.example/messages', '//attacker.example/messages',
      'https://app.anacan.az.attacker.example/', 'https://notanacan.az/',
      'https://unknown.anacan.az/', 'https://another-project.lovable.app/',
      'https://another-gateway.example.azurecontainerapps.io/',
      'https://attacker.example/?next=https://app.anacan.az/',
      'https://app.anacan.az@attacker.example/', 'https://user:password@app.anacan.az/',
      'anacan://user:password@messages', 'https://app.anacan.az:444/messages',
      'https://[invalid',
    ]) {
      test('rejects $link and still applies a mapped type', () {
        final action = router.navigateFromPush({'type': 'direct_message', 'sender_id': sender, 'deeplink': link});
        final mapped = communityAt(const CommunityDeepLinkTarget(dmUserId: sender));
        expect(action, PushTapIntent(mapped));
        expect(router.consumePending(), mapped);
        expect(router.consumePending(), isNull);
      });
    }

    for (final configured in <String?>[null, '', 'not-a-url', 'http://configured.example', 'javascript:alert(1)']) {
      test('does not widen trust for an invalid configured origin ($configured)', () {
        router.backendUrl = configured;
        expect(router.navigateFromPush({'deeplink': '$azure/messages'}), isNull);
        expect(router.navigateFromPush({'deeplink': 'https://app.anacan.az/messages'}), isA<PushTapIntent>());
        expect(router.consumePending()?.deeplink, isNotNull);
      });
    }

    test('uses only the configured origin, not its entire shared hosting domain', () {
      router.backendUrl = '$azure/api/';
      expect(router.navigateFromPush({'deeplink': '$azure/messages'}), const PushTapWebNavigate('$azure/messages'));
    });

    test('keeps only the latest pending intent and consumes it once', () {
      router.navigateFromPush({'type': 'appointment'});
      router.navigateFromPush({'type': 'birth_alert'});
      expect(router.consumePending(), const PushNavIntent(tab: 'home'));
      expect(router.consumePending(), isNull);
    });

    test('replaces an older pending intent when an approved URL takes precedence', () {
      router.navigateFromPush({'type': 'appointment'});
      router.navigateFromPush({'deeplink': 'anacan://community'});
      expect(router.consumePending()?.deeplink?.action, 'tab');
    });

    test('falls back to the mapped intent if opening a trusted URL fails', () {
      // A trusted URL the in-app router does not know still goes to the web; if that fails, the type wins.
      final action = router.navigateFromPush({'type': 'shopping_list', 'deeplink': 'https://app.anacan.az/no-such-route-here'});
      expect(action, isA<PushTapWebNavigate>());
      expect(router.pending, isNull);
      router.fallbackAfterFailedNavigation((action! as PushTapWebNavigate).fallback!);
      expect(router.consumePending(), const PushNavIntent(shoppingList: true));
    });
  });
}

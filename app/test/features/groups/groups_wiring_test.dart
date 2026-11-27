// Ported from: (no vitest file) the hand-over of the chat feature's `chatGroupsProvider` and `chatGroupScreenProvider`
//              to the groups port (src/hooks/useChatGroups.ts keys, src/components/community/GroupChatScreen.tsx
//              non-member branch)
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/features/chat/data/chat_groups.dart' show chatGroupsProvider, kInboxGroups;
import 'package:anacan/features/groups/data/chat_groups.dart';
import 'package:anacan/features/groups/register.dart';
import 'package:anacan/features/groups/ui/group_chat_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/i18n_fakes.dart';
import '../chat/support/chat_fakes.dart';

void main() {
  test('the chat feature reads the inbox groups through this hook with the React query key', () async {
    installTestI18n();
    final client = QueryClient(defaults: const QueryDefaults(retry: noRetry));
    final backend = FakeChatBackend()
      ..onRpc = (fn, params) async => [
            {'id': 'g1', 'discovery_language': 'ru', 'is_member': true, 'unread_count': 3},
          ];
    final c = ProviderContainer(overrides: [
      ...chatOverrides(backend: backend, userId: 'viewer', client: client),
      ...groupsWiringOverrides(),
    ]);
    addTearDown(c.dispose);
    final sub = c.listen(chatGroupsProvider(kInboxGroups), (_, _) {}, fireImmediately: true);
    addTearDown(sub.close);
    for (var i = 0; i < 50 && sub.read().groups.isEmpty; i++) {
      await Future<void>.delayed(Duration.zero);
    }
    expect(sub.read().groups.single['id'], 'g1');
    expect(client.getQueryData<List<Object?>>(['chat-groups-v3', 'https://api.anacan.az', 'viewer', 'mine', null, '', null]), isNotNull);
    expect(backend.named('rpc').single.args, ['chat_groups_v3', {'p_scope': 'mine', 'p_group': null, 'p_search': ''}]);
    // The inbox listeners: own memberships / access rows and every group message (throttled).
    expect(backend.subscriptions.map((s) => '${s.table}:${s.filter}'), containsAll(['group_memberships:user_id=eq.viewer', 'group_messages:null']));
  });

  testWidgets('a non-member of a public group joins through chat_group_action_v3', (tester) async {
    final backend = FakeChatBackend()
      ..onRpc = (fn, params) async => fn == 'chat_groups_v3'
          ? [
              {'id': 'g1', 'name': 'Open room', 'chat_visibility': 'public', 'is_member': false, 'access_state': null, 'member_count': 4, 'description': 'Hi'},
            ]
          : {'state': 'member'};
    var back = 0;
    await pumpChat(tester, GroupChatScreen(groupId: 'g1', onBack: () => back++), overrides: chatOverrides(backend: backend, userId: 'viewer'));
    for (var i = 0; i < 5; i++) {
      await tester.pump();
    }
    expect(find.text('Open room'), findsOneWidget);
    await tester.tap(find.text('Qoşul'));
    await tester.pump();
    expect(backend.named('rpc').where((c) => c.args[0] == 'chat_group_action_v3').single.args[1],
        {'p_actor': 'viewer', 'p_group': 'g1', 'p_action': 'join', 'p_users': const <String>[]});
    expect(back, 0);
    await flushChat(tester);
  });

  test('single-group arguments default to the membership contract', () {
    expect(const ChatGroupArgs.single('g1').languageFiltered, isFalse);
    expect(const ChatGroupArgs().languageFiltered, isTrue);
  });
}

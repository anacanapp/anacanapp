// Ported from: src/components/community/ConversationListScreen.groups.test.tsx (+ Dart-only merge / preview cases)
import 'package:anacan/features/chat/data/partner_messages.dart';
import 'package:anacan/features/chat/dm/conversation_list_screen.dart';
import 'package:anacan/features/chat/ui/chat_widgets.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import '../support/chat_fakes.dart';

final groups = [
  {'id': 'joined', 'name': 'Joined room', 'is_member': true, 'member_count': 2, 'last_message': 'Hello group', 'last_message_type': 'text', //
    'last_message_at': '2026-09-21T10:00:00Z', 'unread_count': 2},
  {'id': 'created-empty', 'name': 'My new room', 'is_member': true, 'is_owner': true, 'created_at': '2026-09-21T11:00:00Z', 'unread_count': 0},
  {'id': 'invite', 'name': 'Invitation room', 'is_member': false, 'access_state': 'invited'},
];

Future<void> mount(WidgetTester tester, {ValueChanged<String>? onOpenGroup}) async {
  final backend = FakeChatBackend()..onRpc = (fn, params) async => fn == 'chat_groups_v3' ? groups : null;
  await pumpChat(
    tester,
    ConversationListScreen(onBack: () {}, onOpenChat: (_, _, _) {}, onOpenGroup: onOpenGroup),
    overrides: [
      ...chatOverrides(backend: backend),
      chatGroupScreenProvider.overrideWithValue((context, groupId, onBack) => Column(children: [
            Text('group:$groupId'),
            GestureDetector(onTap: onBack, child: const Text('Return inbox')),
          ])),
    ],
  );
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets('lists joined and newly created empty groups in Messages and opens the exact room', (tester) async {
    final semantics = tester.ensureSemantics();
    await mount(tester);
    expect(find.bySemanticsLabel(RegExp('My new room')), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Hello group')), findsOneWidget);
    await tester.tap(find.bySemanticsLabel(RegExp('Joined room')));
    await tester.pump();
    expect(find.text('group:joined'), findsOneWidget);
    await tester.tap(find.text('Return inbox'));
    await tester.pump();
    expect(find.bySemanticsLabel(RegExp('My new room')), findsOneWidget);
    semantics.dispose();
    await flushChat(tester);
  });

  testWidgets('shows invitations separately and routes acceptance to the group preview', (tester) async {
    final semantics = tester.ensureSemantics();
    final opened = <String>[];
    await mount(tester, onOpenGroup: opened.add);
    await tester.tap(find.bySemanticsLabel(RegExp('Invitation room')));
    expect(opened, ['invite']);
    expect(find.text('Dəvətlər'), findsOneWidget);
    semantics.dispose();
    await flushChat(tester);
  });

  group('mergeConversations / lastMessagePreview (Dart)', () {
    setUp(installTestI18n);

    Conversation dm(String id, String at) =>
        Conversation(userId: id, name: id, lastMessageType: 'text', lastMessageAt: at, unreadCount: 0);

    test('adds the partner chat once, appends member groups and sorts newest first (stable)', () {
      final partner = dm('partner', '2026-09-20T09:00:00Z');
      final list = mergeConversations(
        conversations: [dm('a', '2026-09-19T09:00:00Z'), dm('b', '2026-09-19T09:00:00Z')],
        partner: partner,
        partnerId: 'partner',
        groups: groups,
      );
      expect([for (final c in list) c.userId], ['created-empty', 'joined', 'partner', 'a', 'b']);
      expect(list.first.lastMessage, 'İlk mesajı göndərin. Söhbət buradan başlayır.');
      expect(list[1].unreadCount, 2);
      final existing = mergeConversations(conversations: [dm('partner', '2026-09-19T09:00:00Z')], partner: partner, partnerId: 'partner', groups: const []);
      expect(existing, hasLength(1));
    });

    test('previews media types, stickers and long text', () {
      expect(lastMessagePreview('image', null), '📷 Şəkil');
      expect(lastMessagePreview('video', null), '🎥 Video');
      expect(lastMessagePreview('audio', null), '🎤 Səs mesajı');
      expect(lastMessagePreview('text', '🧸 Stiker 12'), '🧸 Stiker');
      expect(lastMessagePreview('text', 'x' * 60), 'x' * 50);
      expect(lastMessagePreview('text', null), '');
    });
  });
}

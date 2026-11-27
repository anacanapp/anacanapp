// Ported from: (no React test) src/hooks/usePartnerMessages.ts, src/hooks/usePartnerConversation.ts,
//              src/hooks/useUnreadMessages.ts
import 'package:anacan/features/chat/data/chat_groups.dart';
import 'package:anacan/features/chat/data/partner_messages.dart';
import 'package:anacan/features/chat/data/unread.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import '../support/chat_fakes.dart';

Future<void> settle() async {
  for (var i = 0; i < 6; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  setUp(installTestI18n);

  test('loads the latest partner messages and counts unread received ones', () async {
    final backend = FakeChatBackend()
      ..onPartnerMessages = (userId) async => [
            {'id': '2', 'sender_id': 'partner', 'receiver_id': 'sender', 'message_type': 'text', 'is_read': false, 'created_at': '2026-09-02T10:00:00Z'},
            {'id': '1', 'sender_id': 'sender', 'receiver_id': 'partner', 'message_type': 'love', 'is_read': false, 'created_at': '2026-09-01T10:00:00Z'},
          ];
    final container = ProviderContainer(overrides: chatOverrides(backend: backend));
    addTearDown(container.dispose);
    container.listen(partnerMessagesProvider, (_, _) {});
    expect(container.read(partnerMessagesProvider).loading, isTrue);
    await settle();
    final state = container.read(partnerMessagesProvider);
    expect(state.loading, isFalse);
    expect(state.unreadCount('sender'), 1);
    expect(backend.subscriptions.single.filter, 'receiver_id=eq.sender');
    expect(backend.subscriptions.single.event, 'INSERT');
  });

  test('a realtime insert refetches, toasts by type and notifies text / love messages', () async {
    final backend = FakeChatBackend();
    final notified = <String>[];
    final container = ProviderContainer(overrides: [
      ...chatOverrides(backend: backend),
      chatIncomingNotifierProvider.overrideWithValue(({required title, required body, required idSeed, userId}) async => notified.add('$title|$body')),
    ]);
    addTearDown(container.dispose);
    final toasts = <ChatToast>[];
    container.read(partnerMessageToastsProvider).stream.listen(toasts.add);
    container.listen(partnerMessagesProvider, (_, _) {});
    await settle();
    backend.emit('partner_messages', newRecord: {'message_type': 'love', 'content': '❤️'});
    backend.emit('partner_messages', newRecord: {'message_type': 'mood_update', 'content': '{"title":"Əhval","body":"Yaxşı"}'});
    backend.emit('partner_messages', newRecord: {'message_type': 'text', 'content': 'x' * 70});
    backend.emit('partner_messages', newRecord: {'message_type': 'custom', 'content': 'not json'});
    await settle();
    expect(backend.named('partnerMessages').length, greaterThanOrEqualTo(2));
    expect(toasts, [
      const ChatToast(title: 'Sevgi aldınız! ❤️', description: 'Partnyorunuz sizə sevgi göndərdi'),
      const ChatToast(title: 'Əhval', description: 'Yaxşı'),
    ]);
    expect(notified, ['Sevgi aldınız! ❤️|Partnyorunuz sizə sevgi göndərdi', 'Yeni mesaj 💬|${'x' * 60}']);
  });

  test('sendLoveToPartner resolves the partner user and inserts a love message', () async {
    final backend = FakeChatBackend()..onMaybeSingle = (table, columns, column, value) async => {'user_id': 'partner-user'};
    final container = ProviderContainer(overrides: chatOverrides(backend: backend, profile: chatProfile('sender', linkedPartnerId: 'partner-profile')));
    addTearDown(container.dispose);
    container.listen(partnerMessagesProvider, (_, _) {});
    final toasts = <ChatToast>[];
    final row = await container.read(partnerMessagesProvider.notifier).sendLoveToPartner(toast: toasts.add);
    expect(row, isNotNull);
    expect(backend.named('maybeSingle').single.args, ['profiles', 'user_id', 'id', 'partner-profile']);
    expect(backend.named('insertPartnerMessage').single.args.single,
        {'sender_id': 'sender', 'receiver_id': 'partner-user', 'message_type': 'love', 'content': '❤️'});
    expect(toasts.single.title, 'Sevgi göndərildi! ❤️');
  });

  test('sendLoveToPartner without a linked partner only toasts', () async {
    final backend = FakeChatBackend();
    final container = ProviderContainer(overrides: chatOverrides(backend: backend));
    addTearDown(container.dispose);
    container.listen(partnerMessagesProvider, (_, _) {});
    final toasts = <ChatToast>[];
    expect(await container.read(partnerMessagesProvider.notifier).sendLoveToPartner(toast: toasts.add), isNull);
    expect(toasts.single, const ChatToast(title: 'Partnyor tapılmadı', description: 'Əvvəlcə partnyorla əlaqələnin', destructive: true));
    expect(backend.named('insertPartnerMessage'), isEmpty);
  });

  test('the partner conversation shows only chat types with the partner name and unread count', () async {
    final backend = FakeChatBackend()
      ..onPartnerMessages = ((userId) async => [
            {'id': '3', 'sender_id': 'partner', 'receiver_id': 'sender', 'message_type': 'mood_update', 'content': '{}', 'created_at': '2026-09-03T10:00:00Z'},
            {'id': '2', 'sender_id': 'partner', 'receiver_id': 'sender', 'message_type': 'text', 'content': 'Salam', 'is_read': false, 'created_at': '2026-09-02T10:00:00Z'},
          ])
      ..onMaybeSingle = (table, columns, column, value) async => {'name': ' Elvin ', 'avatar_url': null};
    final container = ProviderContainer(overrides: chatOverrides(backend: backend));
    addTearDown(container.dispose);
    container.listen(partnerConversationProvider('partner'), (_, _) {});
    await settle();
    final view = container.read(partnerConversationProvider('partner'));
    expect(view.conversation!.name, 'Elvin');
    expect(view.conversation!.lastMessage, 'Salam');
    expect(view.unreadCount, 1);
    expect(container.read(partnerConversationProvider(null)).conversation, isNull);
  });

  test('useUnreadMessages adds group unread counts and open invitations', () async {
    final backend = FakeChatBackend()
      ..onPartnerMessages = ((userId) async => [
            {'id': '1', 'sender_id': 'partner', 'receiver_id': 'sender', 'message_type': 'text', 'is_read': false},
          ])
      ..onRpc = (fn, params) async => fn == 'chat_groups_v3'
          ? [
              {'id': 'g1', 'is_member': true, 'unread_count': '3', 'discovery_language': 'az'},
              {'id': 'g2', 'is_member': false, 'access_state': 'invited', 'discovery_language': 'az'},
              {'id': 'g3', 'is_member': true, 'unread_count': 5, 'discovery_language': 'ru'},
            ]
          : null;
    final container = ProviderContainer(overrides: chatOverrides(backend: backend));
    addTearDown(container.dispose);
    container.listen(chatHomeTotalUnreadProvider, (_, _) {});
    await settle();
    // Owner decision 2026-11-27: the badge counts every group of the inbox, also those in another discovery
    // language (React counted only the app language: 1 + 3 + 1).
    expect(container.read(chatUnreadCountProvider), 1 + 3 + 1 + 5);
    expect(container.read(chatHomeTotalUnreadProvider), 10);
    expect(groupsUnread(const [{'is_member': true, 'unread_count': null}]), 0);
    final rpc = backend.named('rpc').firstWhere((c) => c.args[0] == 'chat_groups_v3');
    expect(rpc.args[1], {'p_scope': 'mine', 'p_group': null, 'p_search': ''});
  });
}

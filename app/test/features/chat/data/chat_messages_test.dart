// Ported from: (no React test) src/hooks/useChatMessages.ts
import 'package:anacan/features/chat/data/chat.dart';
import 'package:anacan/features/chat/data/chat_messages.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import '../support/chat_fakes.dart';

Future<void> settle() async {
  for (var i = 0; i < 10; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

const scope = ChatScope(ChatKind.direct, 'peer');

void main() {
  late FakeChatBackend backend;
  late FakePushSender push;
  late List<Map<String, dynamic>> page;
  late ProviderContainer container;

  setUp(() {
    installTestI18n();
    page = [
      messageRow('b', createdAt: '2026-09-21T10:01:00Z', extra: {'is_read': false}),
      messageRow('a', createdAt: '2026-09-21T10:00:00Z', extra: {'is_read': true}),
      messageRow('c', sender: 'sender', receiver: 'peer', createdAt: '2026-09-21T10:02:00Z', type: 'image', extra: {'media_path': 'sender/direct/peer/c.jpg'}),
      messageRow('b', createdAt: '2026-09-21T10:01:00Z', extra: {'is_read': false}),
    ];
    backend = FakeChatBackend()
      ..onRpc = (fn, params) async => switch (fn) {
            'chat_messages_v2' => page,
            'chat_send_message_v2' => {'id': params!['p_id'], 'sender_id': 'sender', 'content': params['p_content'], 'message_type': params['p_type']},
            'chat_delete_message_v1' => {'media_path': 'sender/direct/peer/c.jpg'},
            'get_public_community_profiles_v2' => [
                {'user_id': 'peer', 'name': 'Peer'},
              ],
            _ => null,
          };
    push = FakePushSender();
    container = ProviderContainer(overrides: chatOverrides(backend: backend, push: push));
    container.listen(chatConversationProvider(scope), (_, _) {});
  });

  tearDown(() => container.dispose());

  ChatConversationState state() => container.read(chatConversationProvider(scope));
  ChatConversationController chat() => container.read(chatConversationProvider(scope).notifier);

  test('dedupes and sorts the page, loads authors and signs media', () async {
    await settle();
    expect([for (final m in state().messages) m.id], ['a', 'b', 'c']);
    expect(state().loading, isFalse);
    expect(state().hasOlder, isFalse);
    expect(state().authors['peer']!['name'], 'Peer');
    expect(state().media['c'], 'https://signed.example/sender/direct/peer/c.jpg');
    final first = backend.named('rpc').firstWhere((c) => c.args[0] == 'chat_messages_v2');
    expect(first.args[1], {'p_kind': 'direct', 'p_target': 'peer', 'p_before_at': null, 'p_before_id': null, 'p_limit': 60});
  });

  test('marks unread received messages read once per newest message', () async {
    await settle();
    final marks = backend.named('rpc').where((c) => c.args[0] == 'chat_mark_read_v2').toList();
    expect(marks, hasLength(1));
    expect(marks.single.args[1], {'p_actor': 'sender', 'p_kind': 'direct', 'p_target': 'peer', 'p_ids': ['b']});
  });

  test('send calls chat_send_message_v2, pushes to the peer and refetches the conversation', () async {
    await settle();
    final before = backend.named('rpc').where((c) => c.args[0] == 'chat_messages_v2').length;
    await chat().send(id: 'id-1', text: 'Salam', replyTo: 'a');
    await settle();
    final call = backend.named('rpc').firstWhere((c) => c.args[0] == 'chat_send_message_v2');
    expect(call.args[1], {
      'p_actor': 'sender', 'p_id': 'id-1', 'p_kind': 'direct', 'p_target': 'peer', 'p_content': 'Salam', 'p_type': 'text', //
      'p_media_path': null, 'p_media_mime': null, 'p_reply_to': 'a', 'p_duration_ms': null,
    });
    expect(push.payloads.single.userId, 'peer');
    expect(push.payloads.single.kind, 'direct_message');
    expect(backend.named('rpc').where((c) => c.args[0] == 'chat_messages_v2').length, greaterThan(before));
    expect(state().sending, isFalse);
  });

  test('remove deletes for both sides and discards the stored media', () async {
    await settle();
    await chat().remove('c');
    expect(backend.named('rpc').firstWhere((c) => c.args[0] == 'chat_delete_message_v1').args[1],
        {'p_actor': 'sender', 'p_kind': 'direct', 'p_target': 'peer', 'p_message': 'c'});
    expect(backend.named('remove').single.args, ['conversation-media', ['sender/direct/peer/c.jpg']]);
  });

  test('edit sends the expected revision and react sets or clears the emoji', () async {
    await settle();
    await chat().edit(ChatMessage({...messageRow('a', sender: 'sender'), 'revision': 3}), 'Yeni');
    await chat().react('a', null);
    expect((backend.named('rpc').firstWhere((c) => c.args[0] == 'chat_edit_message_v1').args[1] as Map)['p_expected_revision'], 3);
    expect(backend.named('rpc').firstWhere((c) => c.args[0] == 'chat_set_reaction_v2').args[1],
        {'p_actor': 'sender', 'p_kind': 'direct', 'p_message': 'a', 'p_emoji': null});
  });

  test('subscribes to both directions and ignores reactions of messages that are not loaded', () async {
    await settle();
    final tables = [for (final s in backend.subscriptions) '${s.table}:${s.filter}'];
    expect(tables, containsAll(['direct_messages:sender_id=eq.sender', 'direct_messages:receiver_id=eq.sender', 'chat_message_reactions:null']));
    final reactionLoads = backend.named('selectIn').where((c) => c.args[0] == 'chat_message_reactions').length;
    backend.emit('chat_message_reactions', newRecord: {'direct_message_id': 'other', 'emoji': '👍'});
    await settle();
    expect(backend.named('selectIn').where((c) => c.args[0] == 'chat_message_reactions').length, reactionLoads);
    backend.emit('chat_message_reactions', newRecord: {'direct_message_id': 'a', 'emoji': '👍'});
    await settle();
    expect(backend.named('selectIn').where((c) => c.args[0] == 'chat_message_reactions').length, reactionLoads + 1);
  });

  test('a full page offers older messages and loads them with the cursor of the oldest row', () async {
    page = [for (var i = 0; i < 60; i++) messageRow('m${(99 - i).toString().padLeft(3, '0')}', createdAt: '2026-09-21T10:${(59 - i).toString().padLeft(2, '0')}:00Z')];
    container.invalidate(chatMessagesQuery(scope));
    await chat().refetch();
    await settle();
    expect(state().hasOlder, isTrue);
    page = [messageRow('old', createdAt: '2026-09-20T10:00:00Z')];
    await chat().loadOlder();
    await settle();
    final last = backend.named('rpc').lastWhere((c) => c.args[0] == 'chat_messages_v2');
    expect((last.args[1] as Map)['p_before_id'], 'm040');
    expect(state().messages.first.id, 'old');
    expect(state().hasOlder, isFalse);
  });
}

// Ported from: src/hooks/useDirectMessages.push.test.tsx, the two `uploadMedia` cases of
//              src/components/chat/ChatMediaUpload.test.tsx (+ Dart-only inbox cases)
import 'dart:async';
import 'dart:typed_data';

import 'package:anacan/core/data/db.dart' show UploadResult;
import 'package:anacan/features/chat/data/chat.dart';
import 'package:anacan/features/chat/data/chat_push.dart';
import 'package:anacan/features/chat/data/direct_messages.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import '../support/chat_fakes.dart';

const senderId = '11111111-1111-4111-8111-111111111111';
const receiverId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';

Future<void> settle() async {
  for (var i = 0; i < 5; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  setUp(installTestI18n);

  test('sends a direct-message push with the exact row returned by the insert', () async {
    final backend = FakeChatBackend();
    final push = FakePushSender();
    final inserted = {
      'id': messageId, 'sender_id': senderId, 'receiver_id': receiverId, 'content': 'Hello', 'message_type': 'text', //
      'media_url': null, 'is_read': false, 'created_at': '2026-09-11T12:00:00Z',
    };
    backend.onInsertDirect = (values) async => inserted;
    final container = ProviderContainer(overrides: chatOverrides(backend: backend, push: push, userId: senderId));
    addTearDown(container.dispose);
    container.listen(directMessagesProvider(receiverId), (_, _) {});
    await settle();
    expect(container.read(directMessagesProvider(receiverId)).loading, isFalse);

    await container.read(directMessagesProvider(receiverId).notifier).sendMessage('Hello');

    expect(backend.named('insertDirectMessage').single.args.single, {
      'sender_id': senderId, 'receiver_id': receiverId, 'content': 'Hello', 'message_type': 'text', 'media_url': null,
    });
    expect(push.payloads, hasLength(1));
    expect(push.payloads.single.userId, receiverId);
    expect(push.payloads.single.data, {
      'type': 'direct_message', 'context': 'direct_message', 'sender_id': senderId, 'messageId': messageId, 'interactionId': messageId,
    });
  });

  test('does not start a DM upload when its optional signal is already aborted', () async {
    final backend = FakeChatBackend();
    final container = ProviderContainer(overrides: chatOverrides(backend: backend));
    addTearDown(container.dispose);
    container.listen(directMessagesProvider('recipient'), (_, _) {});
    final signal = ChatAbort()..abort();
    expect(await container.read(directMessagesProvider('recipient').notifier).uploadMedia(ChatMediaFile(Uint8List.fromList([1]), ''), ChatMediaType.audio,
        signal: signal), isNull);
    expect(backend.named('upload'), isEmpty);
    expect(backend.named('remove'), isEmpty);
  });

  test('preserves existing uploadMedia callers that do not pass a signal', () async {
    final backend = FakeChatBackend();
    const uploadedPath = 'sender/server-returned-audio.webm';
    final completer = Completer<UploadResult>();
    backend.onUpload = (bucket, path, bytes, type) => completer.future;
    final container = ProviderContainer(overrides: chatOverrides(backend: backend));
    addTearDown(container.dispose);
    container.listen(directMessagesProvider('recipient'), (_, _) {});
    final upload = container
        .read(directMessagesProvider('recipient').notifier)
        .uploadMedia(ChatMediaFile(Uint8List.fromList([1, 2, 3]), 'audio/webm'), ChatMediaType.audio);
    await settle();
    completer.complete(const UploadResult(path: uploadedPath));
    expect(await upload, uploadedPath);
    final call = backend.named('upload').single;
    expect(call.args[0], 'chat-media');
    expect(call.args[1], matches(RegExp(r'^sender/\d+\.webm$')));
    expect(call.args[3], 'audio/webm');
    expect(backend.named('remove'), isEmpty);
  });

  test('groups the inbox by partner with names, unread counts and newest first (Dart)', () async {
    final backend = FakeChatBackend();
    backend.onDirectInbox = (userId) async => [
          {'id': '3', 'sender_id': 'b', 'receiver_id': 'sender', 'content': 'Yo', 'message_type': 'text', 'is_read': false, 'created_at': '2026-09-03T10:00:00Z'},
          {'id': '2', 'sender_id': 'sender', 'receiver_id': 'a', 'content': 'Hi', 'message_type': 'text', 'is_read': false, 'created_at': '2026-09-02T10:00:00Z'},
          {'id': '1', 'sender_id': 'a', 'receiver_id': 'sender', 'content': 'Old', 'message_type': 'text', 'is_read': false, 'created_at': '2026-09-01T10:00:00Z'},
        ];
    backend.onSelectIn = (table, column, values, columns) async => [
          {'user_id': 'a', 'name': 'Aysel', 'avatar_url': '/a.png'},
        ];
    final container = ProviderContainer(overrides: chatOverrides(backend: backend));
    addTearDown(container.dispose);
    container.listen(directMessagesProvider(null), (_, _) {});
    await settle();
    final state = container.read(directMessagesProvider(null));
    expect([for (final c in state.conversations) c.userId], ['b', 'a']);
    expect(state.conversations[0].name, 'İstifadəçi');
    expect(state.conversations[1].name, 'Aysel');
    expect(state.conversations[1].lastMessage, 'Hi');
    expect(state.conversations[1].unreadCount, 1);
    expect(state.totalUnread, 2);
    expect(backend.named('selectIn').single.args.sublist(0, 3), ['public_profile_cards', 'user_id', ['b', 'a']]);
  });

  testWidgets('throttles inbox refetches on bursts of realtime inserts (Dart)', (tester) async {
    final backend = FakeChatBackend();
    final container = ProviderContainer(overrides: chatOverrides(backend: backend));
    container.listen(directMessagesProvider(null), (_, _) {});
    await tester.pump();
    expect(backend.named('directInbox'), hasLength(1));
    backend.emit('direct_messages', filter: 'receiver_id=eq.sender');
    await tester.pump();
    expect(backend.named('directInbox'), hasLength(2));
    backend.emit('direct_messages', filter: 'receiver_id=eq.sender');
    backend.emit('direct_messages', filter: 'sender_id=eq.sender');
    await tester.pump();
    expect(backend.named('directInbox'), hasLength(2));
    await tester.pump(const Duration(seconds: 2));
    expect(backend.named('directInbox'), hasLength(3));
    container.dispose();
  });

  test('push is skipped for unsupported message types (Dart)', () async {
    final backend = FakeChatBackend()..onInsertDirect = (values) async => {...values, 'id': messageId, 'message_type': 'love'};
    final push = FakePushSender();
    final container = ProviderContainer(overrides: chatOverrides(backend: backend, push: push));
    addTearDown(container.dispose);
    container.listen(directMessagesProvider(receiverId), (_, _) {});
    await container.read(directMessagesProvider(receiverId).notifier).sendMessage('❤️', type: 'love');
    expect(push.payloads, isEmpty);
    expect(const SendPushResult(ok: true).ok, isTrue);
  });
}

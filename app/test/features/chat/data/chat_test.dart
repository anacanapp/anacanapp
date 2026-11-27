// Ported from: src/lib/chat.test.ts (+ Dart-only cases for uploadChatMedia / resolveChatMedia / chatError)
import 'dart:typed_data';

import 'package:anacan/core/data/db.dart' show UploadResult;
import 'package:anacan/features/chat/data/chat.dart';
import 'package:anacan/features/chat/data/chat_backend.dart' show ChatException;
import 'package:anacan/features/chat/data/chat_push.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../../support/i18n_fakes.dart';
import '../support/chat_fakes.dart';

const sender = '11111111-1111-4111-8111-111111111111';
const groupId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';
const members = ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'];
final message = ChatMessage({'id': messageId, 'sender_id': sender, 'group_id': groupId, 'content': 'Salam', 'message_type': 'text', //
  'created_at': '2026-11-07T12:00:00Z'});

void main() {
  late FakeChatBackend backend;
  late FakePushSender push;

  setUp(() {
    installTestI18n();
    backend = FakeChatBackend()
      ..onRpc = (fn, params) async => [
            {'user_id': sender},
            for (final id in members) {'user_id': id},
          ];
    push = FakePushSender();
  });

  group('notifyChatMessage group push', () {
    test('asks the server once to fan the message out', () async {
      push.fallback = const SendPushResult(ok: true, sent: 2, skippedCounts: {});
      await notifyChatMessage(backend, push, ChatKind.group, groupId, message);
      expect(push.payloads, [
        const SendPushPayload(userId: sender, title: 'Yeni mesaj', body: 'Salam', kind: 'group_message_fanout', data: {
          'type': 'group_message_fanout', 'context': 'group_message_fanout', 'groupId': groupId, 'messageId': messageId, //
          'interactionId': messageId,
        }),
      ]);
      expect(backend.named('rpc'), isEmpty);
    });

    for (final (label, result) in [
      ('a fan-out with zero sends', const SendPushResult(ok: true, sent: 0, skippedCounts: {'no_device_tokens': 2})),
      ('another server error', const SendPushResult(ok: false, sent: 0, serverError: 'no_verified_interaction')),
      ('a network failure', SendPushResult(ok: false, sent: 0, error: Exception('offline'))),
    ]) {
      test('does not fall back after $label', () async {
        push.fallback = result;
        await notifyChatMessage(backend, push, ChatKind.group, groupId, message);
        expect(push.payloads, hasLength(1));
        expect(backend.named('rpc'), isEmpty);
      });
    }

    test('falls back to one group_message push per member on an older server', () async {
      push.results.add(const SendPushResult(ok: false, sent: 0, serverError: 'unsupported_context_or_type'));
      await notifyChatMessage(backend, push, ChatKind.group, groupId, message);
      expect(backend.named('rpc').single.args, ['chat_group_members_v2', {'p_group': groupId}]);
      expect(push.payloads, hasLength(3));
      expect(push.payloads.sublist(1), [
        for (final userId in members)
          SendPushPayload(userId: userId, title: 'Yeni mesaj', body: 'Salam', kind: 'group_message', data: {
            'type': 'group_message', 'context': 'group_message', 'groupId': groupId, 'messageId': messageId, 'interactionId': messageId,
          }),
      ]);
    });

    test('keeps direct messages on the single-recipient path', () async {
      await notifyChatMessage(backend, push, ChatKind.direct, members[0], ChatMessage({...message.row, 'group_id': null}));
      expect(push.payloads.single.userId, members[0]);
      expect(push.payloads.single.kind, 'direct_message');
    });
  });

  group('uploadChatMedia (Dart)', () {
    test('uploads under actor/kind/target with the canonical MIME and returns the attachment', () async {
      final attachment = await uploadChatMedia(backend, 'me', ChatKind.direct, 'peer', ChatMediaFile(Uint8List.fromList([1, 2]), 'audio/webm;codecs=opus'),
          ChatMediaType.audio, newId: () => 'id-1');
      expect(backend.named('upload').single.args[0], 'conversation-media');
      expect(backend.named('upload').single.args[1], 'me/direct/peer/id-1.webm');
      expect(backend.named('upload').single.args[3], 'audio/webm');
      expect(attachment, const ChatAttachment(path: 'me/direct/peer/id-1.webm', mime: 'audio/webm', type: ChatMediaType.audio));
    });

    test('rejects unknown, mismatched, empty and oversized media', () async {
      Future<Object?> fail(ChatMediaFile file, ChatMediaType type) async {
        try {
          await uploadChatMedia(backend, 'me', ChatKind.direct, 'peer', file, type);
          return null;
        } catch (error) {
          return chatErrorMessage(error);
        }
      }

      expect(await fail(ChatMediaFile(Uint8List(1), 'image/heic'), ChatMediaType.image), 'CHAT_INVALID_MEDIA');
      expect(await fail(ChatMediaFile(Uint8List(1), 'video/mp4'), ChatMediaType.image), 'CHAT_INVALID_MEDIA');
      expect(await fail(ChatMediaFile(Uint8List(0), 'image/png'), ChatMediaType.image), 'CHAT_INVALID_MEDIA');
      expect(await fail(ChatMediaFile(Uint8List(10 * 1024 * 1024 + 1), 'image/png'), ChatMediaType.image), 'CHAT_MEDIA_TOO_LARGE');
      expect(backend.named('upload'), isEmpty);
    });

    test('removes an upload whose signal was aborted while it ran', () async {
      final signal = ChatAbort();
      backend.onUpload = (bucket, path, bytes, type) async {
        signal.abort();
        return UploadResult(path: path);
      };
      final result = await uploadChatMedia(backend, 'me', ChatKind.partner, 'p', ChatMediaFile(Uint8List(3), 'image/png'), ChatMediaType.image,
          signal: signal, newId: () => 'x');
      expect(result, isNull);
      expect(backend.named('remove').single.args, ['conversation-media', ['me/partner/p/x.png']]);
    });
  });

  group('resolveChatMedia (Dart)', () {
    test('signs media_path in conversation-media for 300 s', () async {
      final url = await resolveChatMedia(backend, 'https://api.anacan.az', ChatMessage({'id': 'm', 'sender_id': 's', 'message_type': 'image', 'media_path': 'a/b.jpg'}));
      expect(url, 'https://signed.example/a/b.jpg');
      expect(backend.named('signedUrl').single.args, ['conversation-media', 'a/b.jpg', 300]);
    });

    test('re-signs legacy own-storage URLs and keeps foreign https URLs', () async {
      final legacy = ChatMessage({'id': 'm', 'sender_id': 's', 'message_type': 'audio',
        'content': 'https://api.anacan.az/storage/v1/object/public/chat-media/u1/clip.m4a'});
      expect(await resolveChatMedia(backend, 'https://api.anacan.az', legacy), 'https://signed.example/u1/clip.m4a');
      expect(backend.named('signedUrl').single.args, ['chat-media', 'u1/clip.m4a', 300]);
      final foreign = ChatMessage({'id': 'm', 'sender_id': 's', 'message_type': 'image', 'media_url': 'https://cdn.example/x.jpg'});
      expect(await resolveChatMedia(backend, 'https://api.anacan.az', foreign), 'https://cdn.example/x.jpg');
      final insecure = ChatMessage({'id': 'm', 'sender_id': 's', 'message_type': 'image', 'media_url': 'http://cdn.example/x.jpg'});
      expect(await resolveChatMedia(backend, 'https://api.anacan.az', insecure), isNull);
    });

    test('falls back to the public URL only for the legacy public chat-media bucket', () async {
      backend.onSignedUrl = (bucket, path, ttl) async => throw Exception('denied');
      final public = ChatMessage({'id': 'm', 'sender_id': 's', 'message_type': 'image',
        'media_url': 'https://api.anacan.az/storage/v1/object/public/chat-media/u1/a.jpg'});
      expect(await resolveChatMedia(backend, 'https://api.anacan.az', public), 'https://public.example/chat-media/u1/a.jpg');
      final private = ChatMessage({'id': 'm', 'sender_id': 's', 'message_type': 'image',
        'media_url': 'https://api.anacan.az/storage/v1/object/sign/conversation-media/u1/a.jpg'});
      await expectLater(resolveChatMedia(backend, 'https://api.anacan.az', private), throwsException);
    });
  });

  group('chatError / chatPreview (Dart)', () {
    test('maps server codes to the chat copy', () {
      expect(chatError(PostgrestException(message: 'CHAT_GROUP_FULL')), 'Qrupun üzv limiti dolub.');
      expect(chatError(const ChatException('CHAT_MEDIA_TOO_LARGE')), 'Uyğun şəkil, səs və ya 25 MB-dan kiçik video seçin.');
      expect(chatError(PostgrestException(message: 'missing', code: 'PGRST202')),
          'Mesajlaşma yenilənməsi serverdə hələ hazır deyil. Bir qədər sonra yenidən yoxlayın.');
      expect(chatError(Exception('x')), 'Əməliyyat alınmadı. Bağlantını yoxlayıb yenidən cəhd edin.');
    });

    test('previews media, stickers and text', () {
      expect(chatPreview('image', null), 'Şəkil');
      expect(chatPreview('audio', ''), 'Səs mesajı');
      expect(chatPreview('text', '🧸 Stiker 7'), '🧸 Stiker');
      expect(chatPreview('text', ''), 'Mesaj');
      expect(chatPreview('text', 'Salam'), 'Salam');
    });
  });
}

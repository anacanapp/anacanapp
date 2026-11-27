// Ported from: src/lib/chat-media.test.ts
import 'package:anacan/features/chat/data/chat_media.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/chat_fakes.dart';

void main() {
  late FakeChatBackend backend;

  setUp(() {
    clearChatMediaSignedCache();
    backend = FakeChatBackend()..onSignedUrl = (bucket, path, ttl) async => 'https://signed.example/token';
  });

  group('chatMediaObjectPath', () {
    test('returns a bare storage path unchanged', () {
      expect(chatMediaObjectPath('user-1/1699999999.jpg'), 'user-1/1699999999.jpg');
    });

    test('extracts the path from a legacy public URL', () {
      expect(chatMediaObjectPath('https://api.anacan.az/storage/v1/object/public/chat-media/user-1/clip.m4a'), 'user-1/clip.m4a');
    });

    test('extracts the path from a signed URL (ignores the query)', () {
      expect(chatMediaObjectPath('https://api.anacan.az/storage/v1/object/sign/chat-media/user-1/a.png?token=abc'), 'user-1/a.png');
    });

    test('decodes percent-encoded path segments', () {
      expect(chatMediaObjectPath('https://host/storage/v1/object/public/chat-media/user-1/a%20b.jpg'), 'user-1/a b.jpg');
    });

    test('rejects blob:/data: previews and foreign or malformed values', () {
      expect(chatMediaObjectPath('blob:https://app/abc'), isNull);
      expect(chatMediaObjectPath('data:image/png;base64,AAAA'), isNull);
      expect(chatMediaObjectPath('https://host/storage/v1/object/public/other-bucket/x.jpg'), isNull);
      expect(chatMediaObjectPath(''), isNull);
      expect(chatMediaObjectPath(null), isNull);
    });

    test('rejects traversal in a bare path and strips a leading slash', () {
      expect(chatMediaObjectPath('../secret.jpg'), isNull);
      expect(chatMediaObjectPath('user-1/../../etc/passwd'), isNull);
      expect(chatMediaObjectPath('/leading/slash.jpg'), 'leading/slash.jpg');
    });

    test('cannot escape the bucket via ".." inside a URL (URL normalization drops the anchor)', () {
      expect(chatMediaObjectPath('https://host/storage/v1/object/public/chat-media/../../etc/passwd'), isNull);
    });
  });

  group('signChatMediaUrl', () {
    test('signs the extracted path against the chat-media bucket', () async {
      final url = await signChatMediaUrl(backend, 'user-1/clip.m4a', ttlSeconds: 1800);
      expect(url, 'https://signed.example/token');
      expect(backend.named('signedUrl').single.args, ['chat-media', 'user-1/clip.m4a', 1800]);
    });

    test('signs the path extracted from a legacy public URL', () async {
      final url = await signChatMediaUrl(backend, 'https://api.anacan.az/storage/v1/object/public/chat-media/user-1/clip.m4a');
      expect(url, 'https://signed.example/token');
      expect(backend.named('signedUrl').single.args, ['chat-media', 'user-1/clip.m4a', 60 * 60]);
    });

    test('caches by path: a second call does not re-sign', () async {
      await signChatMediaUrl(backend, 'user-1/clip.m4a');
      await signChatMediaUrl(backend, 'user-1/clip.m4a');
      expect(backend.named('signedUrl'), hasLength(1));
    });

    test('returns null without signing for non-chat-media values', () async {
      expect(await signChatMediaUrl(backend, 'blob:https://app/abc'), isNull);
      expect(await signChatMediaUrl(backend, null), isNull);
      expect(backend.named('signedUrl'), isEmpty);
    });

    test('returns null when signing fails', () async {
      backend.onSignedUrl = (bucket, path, ttl) async => throw Exception('denied');
      expect(await signChatMediaUrl(backend, 'user-1/clip.m4a'), isNull);
    });
  });
}

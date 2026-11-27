// Ported from: (no React test) — sendMessage / stopGeneration / clearChat of src/components/AIChatScreen.tsx and
//              src/hooks/useAIChatHistory.ts
import 'dart:async';
import 'dart:typed_data';

import 'package:anacan/domain/billing/usage_limits.dart' show UsageDecision;
import 'package:anacan/features/ai_chat/ai_chat_history.dart';
import 'package:anacan/features/ai_chat/ai_chat_inputs.dart' show AiPickedImage;
import 'package:anacan/features/ai_chat/ai_chat_session.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/i18n_fakes.dart';
import 'support.dart';

class _Ui implements AiChatSessionUi {
  int premium = 0;
  int pinned = 0;
  int cleared = 0;
  int imageCleared = 0;
  final List<(String, String?, bool)> toasts = [];
  @override
  void showPremium() => premium++;
  @override
  void toast({required String title, String? description, bool destructive = false}) => toasts.add((title, description, destructive));
  @override
  void pinToBottom() => pinned++;
  @override
  void clearInput() => cleared++;
  @override
  void clearAttachedImage() => imageCleared++;
}

class _Rig {
  _Rig({bool allowed = true, double remaining = double.infinity, String? token = 'jwt-1', Duration idle = const Duration(seconds: 30)}) {
    session = AiChatSession(
      AiChatSessionDeps(
        history: history,
        consume: () async => UsageDecision(allowed: allowed, remaining: remaining, limit: 5),
        accessToken: () async => token,
        backend: () => (url: 'https://api.anacan.az', publishableKey: 'pk-1'),
        client: client,
        upload: (path, bytes) async {
          uploads.add(path);
          return path;
        },
        buildBody: (conversation, image) => {'messages': conversation, 'imageBase64': ?image},
        userId: 'user-1',
        idleTimeout: idle,
        flushInterval: const Duration(milliseconds: 5),
      ),
      ui,
    );
  }

  final store = MemoryHistoryStore();
  late final AiChatHistory history = AiChatHistory(store, userId: 'user-1', chatType: 'woman');
  final client = ScriptedClient();
  final ui = _Ui();
  final uploads = <String>[];
  late final AiChatSession session;

  List<String> get contents => [for (final m in session.messages) m.content];
}

Future<void> _tick([int ms = 20]) => Future<void>.delayed(Duration(milliseconds: ms));

void main() {
  setUp(installTestI18n);

  test('restores saved history or shows the welcome message; clear wipes the rows', () async {
    final rig = _Rig();
    rig.session.initialize([
      {'id': 'r1', 'role': 'user', 'content': 'Salam', 'created_at': '2026-11-27T09:00:00Z'},
      {'id': 'r2', 'role': 'assistant', 'content': 'Salam!', 'created_at': '2026-11-27T09:00:05Z', 'image_url': null},
    ], 'welcome');
    expect(rig.contents, ['Salam', 'Salam!']);
    await rig.session.clear('Xoş gəldiniz');
    expect(rig.session.messages.single.id, 'welcome');
    expect(rig.contents, ['Xoş gəldiniz']);
    expect(rig.store.clears, 1);
  });

  test('streams the answer, sends the history without the welcome message and saves both sides', () async {
    final rig = _Rig();
    rig.session.initialize(const [], 'welcome');
    rig.client.onCall = (call) {
      call.open();
      call.add(sse('Ana'));
      call.add(sse('can'));
      unawaited(call.close());
    };
    await rig.session.send('  Necəsən?  ');
    expect(rig.contents, ['welcome', 'Necəsən?', 'Anacan']);
    expect(rig.session.messages.last.isStreaming, isFalse);
    expect(rig.session.isLoading, isFalse);
    expect(rig.client.calls.single.json['messages'], [
      {'role': 'user', 'content': 'Necəsən?'},
    ]);
    await _tick();
    expect(rig.store.inserts.map((r) => '${r['role']}:${r['content']}:${r['chat_type']}'), ['user:Necəsən?:woman', 'assistant:Anacan:woman']);
    expect(rig.ui.cleared, 1);
    expect(rig.ui.pinned, 1);
  });

  test('the daily free limit opens the paywall and sends nothing; the last two questions warn', () async {
    final blocked = _Rig(allowed: false, remaining: 0);
    await blocked.session.send('Salam');
    expect(blocked.ui.premium, 1);
    expect(blocked.client.calls, isEmpty);
    expect(blocked.session.messages, isEmpty);

    final low = _Rig(remaining: 2);
    low.client.onCall = (call) {
      call.open();
      unawaited(call.close());
    };
    await low.session.send('Salam');
    expect(low.ui.toasts.first.$1, 'Pulsuz limit azalır');
    expect(low.ui.toasts.first.$2, 'Bu gün 2 pulsuz sualınız qalıb. Premium ilə limitsizdir.');
    // An empty stream: the apology, nothing saved for the assistant.
    expect(low.contents.last, 'Bağışlayın, cavab ala bilmədim.');
  });

  test('Stop keeps the partial answer and saves it; with nothing received the bubble is removed', () async {
    final rig = _Rig();
    rig.client.onCall = (call) {
      call.open();
      call.add(sse('Yarım cavab'));
    };
    final sending = rig.session.send('Sual');
    await _tick();
    expect(rig.session.isLoading, isTrue);
    rig.session.stop();
    await sending;
    expect(rig.contents, ['Sual', 'Yarım cavab']);
    expect(rig.session.messages.last.isStreaming, isFalse);
    expect(rig.ui.toasts, isEmpty);
    await _tick();
    expect(rig.store.inserts.last['content'], 'Yarım cavab');

    final empty = _Rig();
    empty.client.onCall = (call) => call.open();
    final s2 = empty.session.send('Sual');
    await _tick();
    empty.session.stop();
    await s2;
    expect(empty.contents, ['Sual']);
  });

  test('a silent stream keeps the partial answer with a timeout toast; with nothing it shows the retry text', () async {
    final rig = _Rig(idle: const Duration(milliseconds: 40));
    rig.client.onCall = (call) {
      call.open();
      call.add(sse('Bir'));
    };
    await rig.session.send('Sual');
    expect(rig.contents.last, 'Bir');
    expect(rig.ui.toasts.single.$2, 'Bağlantı zəifdir, cavab gecikdi. Yenidən cəhd edin.');
    expect(rig.ui.toasts.single.$3, isTrue);

    final none = _Rig(idle: const Duration(milliseconds: 40));
    none.client.onCall = (call) => call.open();
    await none.session.send('Sual');
    expect(none.contents.last, 'Bağlantı zəifdir, cavab gecikdi. Yenidən cəhd edin.');
  });

  test('an API error or a missing session shows the technical error bubble and toast', () async {
    final rig = _Rig();
    rig.client.onCall = (call) {
      call.open(status: 500);
      call.add('{"error":"boom"}');
      unawaited(call.close());
    };
    await rig.session.send('Sual');
    expect(rig.contents.last, 'Bağışlayın, texniki xəta baş verdi. Zəhmət olmasa yenidən cəhd edin. 🙏');
    expect(rig.ui.toasts.single, ('Xəta', 'Mesaj göndərilə bilmədi. Yenidən cəhd edin.', true));

    final signedOut = _Rig(token: null);
    await signedOut.session.send('Sual');
    expect(signedOut.client.calls, isEmpty);
    expect(signedOut.contents.last, 'Bağışlayın, texniki xəta baş verdi. Zəhmət olmasa yenidən cəhd edin. 🙏');
  });

  test('a photo is uploaded to chat-media under the user and sent as base64; text defaults to the photo label', () async {
    final rig = _Rig();
    rig.client.onCall = (call) {
      call.open();
      call.add(sse('Gözəl şəkil'));
      unawaited(call.close());
    };
    await rig.session.send('', image: AiPickedImage(bytes: Uint8List.fromList([1, 2, 3]), originalBytes: 3));
    expect(rig.uploads.single, matches(RegExp(r'^user-1/ai_\d+\.jpg$')));
    expect(rig.client.calls.single.json['imageBase64'], 'AQID');
    expect(rig.session.messages.first.content, '📷 Şəkil');
    expect(rig.session.messages.first.imageUrl, rig.uploads.single);
    expect(rig.ui.imageCleared, 1);
    await _tick();
    expect(rig.store.inserts.first['image_url'], rig.uploads.single);
  });

  test('nothing is sent while an answer is streaming or for blank text', () async {
    final rig = _Rig();
    rig.client.onCall = (call) => call.open();
    final first = rig.session.send('Bir');
    await _tick();
    await rig.session.send('İki');
    await rig.session.send('   ');
    expect(rig.client.calls, hasLength(1));
    rig.session.stop();
    await first;
  });
}

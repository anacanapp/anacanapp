// Ported from: src/components/chat/ConversationScreen.test.tsx
import 'dart:async';
import 'dart:typed_data';

import 'package:anacan/core/data/db.dart' show UploadResult;
import 'package:anacan/features/chat/copy/chat_copy.dart';
import 'package:anacan/features/chat/data/chat.dart';
import 'package:anacan/features/chat/data/chat_backend.dart';
import 'package:anacan/features/chat/data/chat_messages.dart';
import 'package:anacan/features/chat/platform/chat_audio.dart';
import 'package:anacan/features/chat/ui/conversation_screen.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show TextField;

import '../support/chat_fakes.dart';

/// The `useChatMessages` mock of the vitest file.
class Mocks {
  List<ChatRow> messages = [message];
  final List<Map<String, Object?>> sends = [];
  final List<(String, String?)> reacts = [];
  final List<String> deletes = [];
  final List<(ChatMessage, String)> edits = [];
  Object? sendError;
}

final ChatRow message = messageRow('message-one');
late Mocks mocks;

class FakeConversation extends ChatConversationController {
  FakeConversation(super.scope);

  @override
  ChatConversationState build() {
    final list = [for (final row in mocks.messages) ChatMessage(row)];
    return ChatConversationState(
      messages: list,
      allMessages: {for (final m in list) m.id: m},
      authors: const {'peer': {'name': 'Peer'}},
      actor: 'sender',
      loading: false,
    );
  }

  @override
  Future<ChatMessage> send({required String id, required String text, ChatAttachment? attachment, String? replyTo}) async {
    mocks.sends.add({'id': id, 'text': text, 'attachment': attachment, 'replyTo': replyTo});
    final error = mocks.sendError;
    if (error != null) {
      mocks.sendError = null;
      throw error;
    }
    return ChatMessage({...message, 'sender_id': 'sender'});
  }

  @override
  Future<void> react(String messageId, String? emoji) async => mocks.reacts.add((messageId, emoji));

  @override
  Future<void> remove(String messageId) async => mocks.deletes.add(messageId);

  @override
  Future<void> edit(ChatMessage message, String content) async => mocks.edits.add((message, content));
}

class Footer extends ConsumerWidget {
  const Footer({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref.watch(chatChromeHiddenProvider) ? const SizedBox.shrink() : const Text('Global footer');
}

late FakeChatBackend backend;

Future<void> mount(WidgetTester tester, {VoidCallback? onBack, bool restricted = false, FakeRecorder? recorder}) async {
  final registry = FeatureRegistry()
    ..registerOverlay(ShellOverlayId.userProfile, (context, a) => GestureDetector(onTap: a.onClose, child: const Text('Back to conversation')));
  await pumpChat(
    tester,
    Column(children: [
      const Footer(),
      ConversationScreen(kind: ChatKind.direct, target: 'peer', title: 'Peer', onBack: onBack ?? () {}),
    ]),
    overrides: [
      ...chatOverrides(backend: backend, registry: registry, moderation: () => {'user_id': 'sender', 'message': restricted, 'restrictions': []}),
      chatConversationProvider.overrideWith2(FakeConversation.new),
      chatAudioRecorderProvider.overrideWithValue(() => recorder ?? FakeRecorder(recording: ChatMediaFile(Uint8List.fromList([1, 2, 3]), 'audio/mp4'))),
      chatAudioPlayerProvider.overrideWithValue(FakeAudioPlayer.new),
    ],
  );
  await tester.pump();
  await tester.pump();
}

Finder label(String text) => find.bySemanticsLabel(text);

void main() {
  setUp(() {
    mocks = Mocks();
    backend = FakeChatBackend()..onSignedUrl = (bucket, path, ttl) async => 'https://media.example.invalid/voice.mp4';
  });

  testWidgets('offers reply, copy and delete for an own private message and deletes it after confirming', (tester) async {
    final semantics = tester.ensureSemantics();
    mocks.messages = [messageRow('own-one', sender: 'sender', receiver: 'peer', content: 'Mine')];
    await mount(tester);
    await tester.tap(label('Mesaj seçimləri'));
    await tester.pump();
    expect(label('Cavab ver'), findsOneWidget);
    expect(label(chatFeature37Text('chat_copy')), findsOneWidget);
    await tester.tap(label(chatFeature37Text('chat_delete')));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.tap(find.text('OK'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(mocks.deletes, ['own-one']);
    semantics.dispose();
    await flushChat(tester);
  });

  testWidgets('does not offer delete for the peer message and shows a deleted placeholder', (tester) async {
    final semantics = tester.ensureSemantics();
    mocks.messages = [message, messageRow('gone', content: '', extra: {'deleted_at': '2026-09-21T11:00:00Z'})];
    await mount(tester);
    await tester.tap(label('Mesaj seçimləri').first);
    await tester.pump();
    expect(label(chatFeature37Text('chat_delete')), findsNothing);
    expect(find.text(chatFeature37Text('chat_deleted')), findsOneWidget);
    semantics.dispose();
    await flushChat(tester);
  });

  testWidgets('hides the footer, keeps the top back action, and opens the peer profile', (tester) async {
    final semantics = tester.ensureSemantics();
    var backs = 0;
    await mount(tester, onBack: () => backs++);
    expect(find.text('Global footer'), findsNothing);
    await tester.tap(label('Profilə bax'));
    await tester.pump();
    await tester.tap(find.text('Back to conversation'));
    await tester.pump();
    await tester.tap(label('Geri'));
    await tester.pump();
    expect(backs, 1);
    semantics.dispose();
    await flushChat(tester);
  });

  testWidgets('sends the selected reply and toggles a WhatsApp-style reaction', (tester) async {
    final semantics = tester.ensureSemantics();
    await mount(tester);
    await tester.tap(label('Mesaj seçimləri'));
    await tester.pump();
    await tester.tap(label('👍'));
    await tester.pump();
    expect(mocks.reacts, [('message-one', '👍')]);
    await tester.tap(label('Mesaj seçimləri'));
    await tester.pump();
    await tester.tap(label('Cavab ver'));
    await tester.pump();
    await tester.enterText(find.byType(TextField), ' Reply text ');
    await tester.pump();
    await tester.tap(label('Göndər'));
    await tester.pump();
    expect(mocks.sends.single['text'], 'Reply text');
    expect(mocks.sends.single['replyTo'], 'message-one');
    semantics.dispose();
    await flushChat(tester);
  });

  testWidgets('retains a failed message and reuses its id on retry', (tester) async {
    final semantics = tester.ensureSemantics();
    mocks.sendError = Exception('Network failed');
    await mount(tester);
    await tester.enterText(find.byType(TextField), 'Keep my draft');
    await tester.pump();
    await tester.tap(label('Göndər'));
    await tester.pump();
    expect(find.text('Əməliyyat alınmadı. Bağlantını yoxlayıb yenidən cəhd edin.'), findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text, 'Keep my draft');
    await tester.tap(label('Göndər'));
    await tester.pump();
    expect(mocks.sends, hasLength(2));
    expect(mocks.sends[0]['id'], mocks.sends[1]['id']);
    semantics.dispose();
    await flushChat(tester);
  });

  testWidgets('removes an upload cancelled by Back before sending any message or signed URL', (tester) async {
    final semantics = tester.ensureSemantics();
    final finish = Completer<UploadResult>();
    backend.onUpload = (bucket, path, bytes, type) => finish.future;
    await mount(tester);
    await tester.tap(label('🎤 Səs mesajı'));
    await tester.pump();
    await tester.tap(label('Səs yazısını bitir'));
    await tester.pump();
    expect(backend.named('upload'), hasLength(1));
    final path = backend.named('upload').single.args[1] as String;
    await tester.tap(label('Geri'));
    await tester.pump();
    finish.complete(UploadResult(path: path));
    await tester.pump();
    await tester.pump();
    expect(backend.named('remove').single.args, ['conversation-media', [path]]);
    expect(mocks.sends, isEmpty);
    expect(backend.named('signedUrl'), isEmpty);
    semantics.dispose();
    await flushChat(tester);
  });

  testWidgets('previews completed audio, then sends the real MIME/path only on Send', (tester) async {
    final semantics = tester.ensureSemantics();
    await mount(tester);
    await tester.tap(label('🎤 Səs mesajı'));
    await tester.pump();
    await tester.tap(label('Səs yazısını bitir'));
    await tester.pump();
    await tester.pump();
    expect(label('Səsi dinlə'), findsOneWidget);
    expect(mocks.sends, isEmpty);
    await tester.tap(label('Göndər'));
    await tester.pump();
    final attachment = mocks.sends.single['attachment'] as ChatAttachment;
    expect(attachment.mime, 'audio/mp4');
    expect(attachment.type, ChatMediaType.audio);
    expect(attachment.path, backend.named('upload').single.args[1]);
    semantics.dispose();
    await flushChat(tester);
  });

  testWidgets('keeps message history available but removes text/audio composition when restricted', (tester) async {
    final semantics = tester.ensureSemantics();
    await mount(tester, restricted: true);
    await tester.pump();
    expect(find.text('Original message'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    expect(label('🎤 Səs mesajı'), findsNothing);
    expect(mocks.sends, isEmpty);
    semantics.dispose();
    await flushChat(tester);
  });

  testWidgets('edits an own text message through the composer', (tester) async {
    final semantics = tester.ensureSemantics();
    mocks.messages = [messageRow('own-edit', sender: 'sender', receiver: 'peer', content: 'Typo', extra: {'revision': 0})];
    await mount(tester);
    await tester.tap(label('Mesaj seçimləri'));
    await tester.pump();
    await tester.tap(label(chatFeature37Text('chat_edit')));
    await tester.pump();
    final box = find.byType(TextField);
    expect(tester.widget<TextField>(box).controller!.text, 'Typo');
    await tester.enterText(box, 'Fixed');
    await tester.pump();
    await tester.tap(label('Göndər'));
    await tester.pump();
    expect(mocks.edits.single.$1.id, 'own-edit');
    expect(mocks.edits.single.$2, 'Fixed');
    expect(mocks.sends, isEmpty);
    semantics.dispose();
    await flushChat(tester);
  });
}

// Ported from: src/components/chat/VoiceMessage.test.tsx
import 'package:anacan/features/chat/platform/chat_audio.dart';
import 'package:anacan/features/chat/ui/voice_message.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/chat_fakes.dart';

Finder button(String label) => find.bySemanticsLabel(label);

Future<void> mount(WidgetTester tester, Widget child, {void Function(FakeAudioPlayer player)? setup}) async {
  FakeAudioPlayer.created.clear();
  await pumpChat(tester, Center(child: SizedBox(width: 300, child: child)), overrides: [
    ...chatOverrides(backend: FakeChatBackend()),
    chatAudioPlayerProvider.overrideWithValue(() {
      final player = FakeAudioPlayer();
      setup?.call(player);
      return player;
    }),
  ]);
}

FakeAudioPlayer get player => FakeAudioPlayer.created.single;

void main() {
  testWidgets('shows a recoverable error instead of pretending a rejected play request is playing', (tester) async {
    final semantics = tester.ensureSemantics();
    await mount(tester, const VoiceMessage(src: 'https://media.example.invalid/audio.mp4'),
        setup: (p) => p.onPlay = () async => throw const ChatAudioException('NotSupportedError', 'Unsupported'));
    await tester.tap(button('Səsi dinlə'));
    await tester.pump();
    expect(button('Səsi yenidən yüklə'), findsOneWidget);
    expect(find.textContaining('Səs açılmadı'), findsOneWidget);
    expect(button('Səsi dayandır'), findsNothing);
    semantics.dispose();
    await flushChat(tester);
  });

  testWidgets('renews an expired media URL before a new user-gesture playback attempt', (tester) async {
    final semantics = tester.ensureSemantics();
    var renewals = 0;
    var reject = true;
    await mount(
      tester,
      VoiceMessage(
        src: 'https://media.example.invalid/old.mp4',
        onRenew: () async {
          renewals++;
          return 'https://media.example.invalid/fresh.mp4';
        },
      ),
      setup: (p) => p.onPlay = () async {
        if (reject) throw Exception('Expired');
      },
    );
    await tester.tap(button('Səsi dinlə'));
    await tester.pump();
    await tester.tap(button('Səsi yenidən yüklə'));
    await tester.pump();
    expect(player.src, 'https://media.example.invalid/fresh.mp4');
    expect(renewals, 1);
    expect(player.plays, 1);
    reject = false;
    await tester.tap(button('Səsi dinlə'));
    await tester.pump();
    expect(player.plays, 2);
    expect(player.src, 'https://media.example.invalid/fresh.mp4');
    semantics.dispose();
    await flushChat(tester);
  });

  testWidgets('reloads an identical renewed lease once without an automatic error loop', (tester) async {
    final semantics = tester.ensureSemantics();
    const url = 'https://media.example.invalid/same-lease.webm';
    var renewals = 0;
    await mount(tester, VoiceMessage(src: url, onRenew: () async {
      renewals++;
      return url;
    }));
    final initialLoads = player.loads.length;
    player.fire(ChatAudioEvent.error);
    await tester.pump();
    expect(player.loads.length - initialLoads, 1);
    player.fire(ChatAudioEvent.error);
    await tester.pump();
    expect(button('Səsi yenidən yüklə'), findsOneWidget);
    expect(renewals, 1);
    semantics.dispose();
    await flushChat(tester);
  });

  testWidgets('uses media events for playback state and does not create an invalid seek range for unknown duration', (tester) async {
    final semantics = tester.ensureSemantics();
    await mount(tester, const VoiceMessage(src: 'https://media.example.invalid/audio.webm'));
    player.length = double.infinity;
    player.fire(ChatAudioEvent.loadedMetadata);
    await tester.pump();
    expect(tester.getSemantics(find.bySemanticsLabel('Səsin vaxtı')), isSemantics(isSlider: true, hasEnabledState: true, isEnabled: false));
    await tester.tap(button('Səsi dinlə'));
    player.fire(ChatAudioEvent.play);
    await tester.pump();
    expect(button('Səsi dayandır'), findsOneWidget);
    player.fire(ChatAudioEvent.ended);
    await tester.pump();
    expect(button('Səsi dinlə'), findsOneWidget);
    semantics.dispose();
    await flushChat(tester);
  });
}

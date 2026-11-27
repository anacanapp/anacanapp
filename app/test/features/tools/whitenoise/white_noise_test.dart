// Ported from: src/components/tools/WhiteNoise.tsx (behaviour checks; no vitest suite)
import 'package:anacan/features/tools/data/data.dart';
import 'package:anacan/features/tools/whitenoise/white_noise.dart';
import 'package:anacan/state/white_noise_store.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../media_common/media_harness.dart';

class FakeWnSounds implements ToolsDataSource {
  @override
  Future<List<Map<String, dynamic>>> select(TableQuery query) async => query.table == 'white_noise_sounds'
      ? [
          {
            'id': 's1',
            'name': 'Yağış',
            'emoji': '🌧️',
            'color_gradient': 'from-blue-400 to-cyan-500',
            'noise_type': 'pink',
            'description': 'Yumşaq',
            'audio_url': null,
          },
          {
            'id': 's2',
            'name': 'Okean',
            'emoji': '🌊',
            'color_gradient': null,
            'noise_type': 'unknown',
            'description': '',
            'audio_url': 'https://cdn.test/o.mp3',
          },
        ]
      : [];
}

class FakeWnAudio implements WhiteNoiseAudio {
  final List<String> played = [];
  final List<double> gains = [];
  int stops = 0;
  @override
  void play(WhiteNoiseSound sound, double gain) => played.add(sound.id);
  @override
  void setGain(double gain) => gains.add(gain);
  @override
  void stop() => stops++;
}

class WnEnv {
  WnEnv() {
    env.db.tables['user_preferences'] = [
      {'id': 'p1', 'user_id': 'u1', 'white_noise_volume': 60, 'white_noise_timer': null, 'last_white_noise_sound': null},
    ];
  }
  final MediaEnv env = MediaEnv();
  final FakeWnAudio audio = FakeWnAudio();
  int now = DateTime.utc(2026, 11, 27, 22).millisecondsSinceEpoch;

  Future<void> pump(WidgetTester tester) => pumpMediaTool(
    tester,
    WhiteNoise(onBack: () {}),
    overrides: [
      ...env.overrides,
      toolsDataSourceProvider.overrideWithValue(FakeWnSounds()),
      whiteNoiseAudioProvider.overrideWithValue(audio),
      whiteNoiseClockProvider.overrideWithValue(() => now),
    ],
  );
}

void main() {
  testWidgets('groups the sounds by noise colour and restores the saved volume', (tester) async {
    final e = WnEnv();
    await e.pump(tester);
    await settle(tester);
    expect(find.text('Çəhrayı Küy'), findsOneWidget);
    expect(find.text('Bəyaz Küy'), findsOneWidget); // the unknown type joins white
    expect(find.text('Qəhvəyi Küy'), findsNothing);
    expect(find.text('60%'), findsOneWidget);
    await unmountMediaTool(tester);
  });

  testWidgets('a free user browses the sounds and a tap opens the paywall', (tester) async {
    final e = WnEnv();
    e.env.usage.isPremium = false;
    await e.pump(tester);
    await settle(tester);
    expect(find.text('Bu bölmə Premium-dadır'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('wn-sound-s1')));
    await settle(tester);
    expect(e.env.paywalls, ['Limitsiz yuxu səsləri']);
    expect(e.audio.played, isEmpty);
    await unmountMediaTool(tester);
  });

  testWidgets('premium plays a sound, saves it as the last sound, the timer stops it', (tester) async {
    final e = WnEnv();
    await e.pump(tester);
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('wn-timer-15')));
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('wn-sound-s1')));
    await settle(tester);
    expect(e.audio.played, ['s1']);
    expect(find.byKey(const ValueKey('wn-now-playing')), findsOneWidget);
    expect(find.text('15:00'), findsOneWidget);
    expect(e.env.db.tables['user_preferences']!.single['last_white_noise_sound'], 's1');
    expect(e.env.db.tables['user_preferences']!.single['white_noise_timer'], 15);

    e.now += 15 * 60 * 1000;
    await tester.pump(const Duration(minutes: 15));
    await settle(tester);
    expect(find.byKey(const ValueKey('wn-now-playing')), findsNothing);
    expect(e.env.db.tables['user_preferences']!.single['last_white_noise_sound'], isNull);
    expect(e.env.paywalls, isEmpty);
    await unmountMediaTool(tester);
  });
}

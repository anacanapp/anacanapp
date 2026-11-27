// Ported from: src/components/tools/NoiseMeter.test.tsx
import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/features/tools/media_common/audio_recording.dart';
import 'package:anacan/features/tools/noise_meter/noise_meter.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../media_common/audio_fakes.dart';
import '../media_common/media_harness.dart';

const _notStarted = 'Ölçüm başladılmayıb';
const _lastResult = 'Son ölçmənin nəticəsi';

class NoiseEnv {
  // 0.001 → 34 dB with the meter's existing calibration.
  final AudioWorld world = AudioWorld(frameId: 1, amplitude: 0.001);
  final MediaEnv env = MediaEnv(profile: Profile({'id': 'p1', 'user_id': 'noise-test'}), userId: 'noise-test');

  Future<void> pump(WidgetTester tester) =>
      pumpMediaTool(tester, NoiseMeter(onBack: () {}), overrides: [...env.overrides, audioPlatformProvider.overrideWithValue(world.platform)]);
}

Future<void> clickControl(WidgetTester tester) async {
  await tester.tap(find.byKey(const ValueKey('noise-control')));
  await settle(tester);
}

Finder inResult(Finder f) => find.descendant(of: find.byKey(const ValueKey('noise-result')), matching: f);

void main() {
  group('NoiseMeter retained result', () {
    testWidgets('keeps average/max below the control while persistence is pending and resets them for the next recording', (tester) async {
      final e = NoiseEnv();
      e.env.db.onInsert = (table, row) => never<Map<String, dynamic>>();
      await e.pump(tester);
      expect(find.text(_notStarted), findsOneWidget);
      await clickControl(tester);
      await clickControl(tester);

      expect(find.text(_notStarted), findsNothing);
      expect(inResult(find.text(_lastResult)), findsOneWidget);
      expect(inResult(find.text('34 dB')), findsNWidgets(2));
      expect(tester.getTopLeft(find.byKey(const ValueKey('noise-result'))).dy, greaterThan(tester.getTopLeft(find.byKey(const ValueKey('noise-control'))).dy));
      expect(e.world.stream.track.stops, 1);
      expect(e.world.context.closes, 1);

      e.world.analyser.amplitude = 0.0001;
      await clickControl(tester);
      await clickControl(tester);
      expect(inResult(find.text('14 dB')), findsNWidgets(2));
      await unmountMediaTool(tester);
    });

    testWidgets('distinguishes a measured silence from a measurement that never started', (tester) async {
      final e = NoiseEnv();
      e.world.analyser.amplitude = 0;
      await e.pump(tester);
      await clickControl(tester);
      await clickControl(tester);
      expect(inResult(find.text('0 dB')), findsNWidgets(2));
      expect(find.text(_notStarted), findsNothing);
      final inserts = e.env.db.callsOf('insert', 'noise_measurements');
      expect((inserts.single.body as Map)['decibel_level'], 0);
      await unmountMediaTool(tester);
    });

    testWidgets('does not fabricate a result when microphone permission is refused', (tester) async {
      final e = NoiseEnv();
      e.world.devices.answer = () => Future<MicStream>.error(const AudioException('NotAllowedError', 'Denied'));
      await e.pump(tester);
      await clickControl(tester);
      expect(find.text(_notStarted), findsOneWidget);
      expect(find.text(_lastResult), findsNothing);
      expect(e.env.db.callsOf('insert'), isEmpty);
      expect(e.env.toasts, hasLength(1));
      await unmountMediaTool(tester);
    });
  });

  group('noise meter maths', () {
    test('thresholds come from the DB keys or the fallback', () {
      expect(noiseThresholdsFrom(const []), kFallbackNoiseThresholds);
      final t = noiseThresholdsFrom([
        {'threshold_key': 'quiet', 'min_db': 35},
        {'threshold_key': 'loud', 'min_db': 65},
      ]);
      expect(t, (ideal: 35, acceptable: 50, warning: 65, danger: 70));
    });
  });
}

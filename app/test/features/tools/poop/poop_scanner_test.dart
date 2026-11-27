// Ported from: src/components/tools/PoopScanner.tsx (behaviour checks; no vitest suite — the server-side colour
//              rules are covered by src/lib/poop-safety.test.ts against supabase/functions/analyze-poop)
import 'dart:typed_data';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/domain/billing/usage_limits.dart' show UsageDecision;
import 'package:anacan/features/tools/media_common/media_ports.dart';
import 'package:anacan/features/tools/poop/poop_scanner.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../media_common/media_harness.dart';

final _png = Uint8List.fromList(const [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

class PoopEnv {
  final MediaEnv env = MediaEnv(profile: Profile({'id': 'p1', 'user_id': 'u1', 'baby_birth_date': '2026-10-01', 'baby_name': 'Ayla', 'baby_gender': 'girl'}));
  final List<MediaImageSource> picks = [];
  Future<PickedImage?> Function(MediaImageSource source) pick = (_) async => PickedImage(bytes: _png);

  Future<void> pump(WidgetTester tester) => pumpMediaTool(
    tester,
    PoopScanner(onBack: () {}),
    overrides: [
      ...env.overrides,
      mediaImagePickerProvider.overrideWithValue((source) {
        picks.add(source);
        return pick(source);
      }),
    ],
  );
}

Map<String, Object?> _analysis({String color = 'red', String concern = 'urgent', String urgency = 'immediate'}) => {
  'colorDetected': color,
  'consistency': 'soft',
  'isNormal': false,
  'concernLevel': concern,
  'explanation': 'See a doctor',
  'recommendations': ['Call now'],
  'shouldSeeDoctor': true,
  'doctorUrgency': urgency,
};

void main() {
  testWidgets('analyzes a camera photo with the baby context and offers the emergency call', (tester) async {
    final e = PoopEnv();
    e.env.db.functions['analyze-poop'] = (_) => {'success': true, 'analysis': _analysis()};
    await e.pump(tester);
    await tester.tap(find.byKey(const ValueKey('poop-camera')));
    await settle(tester);
    expect(e.picks, [MediaImageSource.camera]);
    await tester.tap(find.byKey(const ValueKey('poop-analyze')));
    await settle(tester);

    expect(e.env.usage.consumed, ['poop_scanner']);
    final body = e.env.db.callsOf('invoke', 'analyze-poop').single.body! as Map;
    expect(body['imageBase64'], 'iVBORw0KGgo=');
    expect(body['language'], 'en');
    expect((body['userContext'] as Map)['babyName'], 'Ayla');
    expect(find.text('Qırmızı'), findsOneWidget);
    expect(find.text('TƏCİLİ HƏKİMƏ MÜRACİƏT EDİN!'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('poop-emergency')));
    expect(e.env.calls.single.toString(), 'tel:103');
    await unmountMediaTool(tester);
  });

  testWidgets('a non-diaper photo is rejected with the server message and cleared', (tester) async {
    final e = PoopEnv();
    e.env.db.functions['analyze-poop'] = (_) => {
      'success': true,
      'isValidImage': false,
      'validation': {'message': 'Not a diaper'},
    };
    await e.pump(tester);
    await tester.tap(find.byKey(const ValueKey('poop-gallery')));
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('poop-analyze')));
    await settle(tester);
    expect(e.env.toasts.single.description, 'Not a diaper');
    expect(find.byKey(const ValueKey('poop-camera')), findsOneWidget);
    await unmountMediaTool(tester);
  });

  testWidgets('the daily free limit opens the paywall without calling the function', (tester) async {
    final e = PoopEnv();
    e.env.usage.onConsume = (_) async => const UsageDecision(allowed: false, remaining: 0, limit: 3);
    await e.pump(tester);
    await tester.tap(find.byKey(const ValueKey('poop-camera')));
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('poop-analyze')));
    await settle(tester);
    expect(e.env.paywalls, ['poop_scanner']);
    expect(e.env.db.callsOf('invoke'), isEmpty);
    await unmountMediaTool(tester);
  });

  testWidgets('a denied camera shows the permission toast', (tester) async {
    final e = PoopEnv();
    e.pick = (_) async => throw const MediaPickError(cameraPermissionDenied);
    await e.pump(tester);
    await tester.tap(find.byKey(const ValueKey('poop-camera')));
    await settle(tester);
    expect(e.env.toasts.single.title, 'Kamera icazəsi lazımdır');
    expect(e.picks, [MediaImageSource.camera]);
    await unmountMediaTool(tester);
  });

  test('concern styles and labels fall back to normal', () {
    expect(poopConcernLabel('urgent'), 'Təcili');
    expect(poopConcernLabel('???'), 'Normal');
    expect(poopColorLabel('purple').emoji, '❓');
  });
}

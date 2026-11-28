// Ported from: (no React suite) src/pages/Index.tsx screen switch for the health screens
import 'package:anacan/features/health_screens/register.dart';
import 'package:anacan/shell/feature_registry.dart';
import 'package:anacan/shell/nav/ids.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('registers the illness, recovery, loss and doctor report screens once', () {
    final r = FeatureRegistry();
    registerHealthScreensFeature(r);
    for (final id in [
      ScreenId.illness,
      ScreenId.recovery,
      ScreenId.recoveryKegel,
      ScreenId.doctorReport,
      ScreenId.lossGuide,
      ScreenId.lossGuideSigns,
      ScreenId.lossMemories,
    ]) {
      expect(r.screen(id), isNotNull, reason: id.id);
    }
    expect(() => registerHealthScreensFeature(r), throwsA(anything));
  });

  test('gives the partner home the loss hero label and chips', () {
    final text = partnerLossTextFor('az')!;
    expect(text.heroLabel, isNotEmpty);
    expect(text.chips, hasLength(4));
  });

  test('wires the premium entitlement', () {
    expect(healthScreensWiringOverrides(), hasLength(1));
  });
}

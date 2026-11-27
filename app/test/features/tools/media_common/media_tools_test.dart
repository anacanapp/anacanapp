// Ported from: src/components/ToolsHub.tsx (the AI & media tool registrations; no vitest suite)
import 'package:anacan/features/tools/media_common/tw_gradient.dart';
import 'package:anacan/features/tools/media_tools.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('registers the eight AI & media tools', () {
    final r = FeatureRegistry();
    registerMediaTools(r);
    for (final id in [
      ToolId.photoshoot,
      ToolId.cryTranslator,
      ToolId.poopScanner,
      ToolId.fairyTale,
      ToolId.horoscope,
      ToolId.weatherClothing,
      ToolId.whitenoise,
      ToolId.noiseMeter,
    ]) {
      expect(r.tool(id), isNotNull, reason: id.name);
    }
  });

  test('Tailwind gradient classes from the database resolve to palette stops', () {
    expect(twGradientStops('from-blue-400 to-cyan-500'), [const Color(0xFF60A5FA), const Color(0xFF06B6D4)]);
    expect(twGradientStops('from-rose-500 via-white to-pink-600'), hasLength(3));
    expect(twGradientStops('bg-red-500'), isNull);
    expect(twGradientStops(null), isNull);
  });
}

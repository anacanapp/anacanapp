// Ported from: src/components/tools/WeatherClothing.test.tsx
import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/features/tools/media_common/media_ports.dart';
import 'package:anacan/features/tools/weather/weather_clothing.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../media_common/media_harness.dart';

const _advice = {
  'temperature': 20,
  'feelsLike': 20,
  'humidity': 50,
  'windSpeed': 5,
  'uvIndex': 2,
  'weatherDescription': 'Clear',
  'clothingAdvice': 'Light clothes',
  'clothingItems': <String>[],
  'warnings': <String>[],
  'outdoorAdvice': 'Walk outside',
  'safeToGoOut': true,
  'alertLevel': 'safe',
};

class WeatherEnv {
  WeatherEnv() {
    env.db.functions['weather-clothing'] = (_) => {'success': true, 'cityName': 'Test city', 'advice': _advice};
  }
  final MediaEnv env = MediaEnv(user: const {'lifeStage': 'flow'});
  int positions = 0;
  Future<GeoPosition> Function() position = () async => const GeoPosition(41.7, 44.8);

  Future<void> pump(WidgetTester tester) => pumpMediaTool(
    tester,
    WeatherClothing(onBack: () {}),
    overrides: [
      ...env.overrides,
      geolocationProvider.overrideWithValue(() {
        positions++;
        return position();
      }),
    ],
  );

  Map<String, dynamic> get body => env.db.callsOf('invoke', 'weather-clothing').single.body! as Map<String, dynamic>;
}

void main() {
  group('weather location handling', () {
    testWidgets('uses the granted position once and sends the real coordinates', (tester) async {
      final e = WeatherEnv();
      await e.pump(tester);
      await settle(tester);
      expect(find.text('Test city'), findsOneWidget);
      expect(e.positions, 1);
      expect(e.body['lat'], 41.7);
      expect(e.body['lng'], 44.8);
      expect(find.byKey(const ValueKey('weather-fallback')), findsNothing);
      await unmountMediaTool(tester);
    });

    testWidgets('labels Baku fallback after unavailable system location, rather than claiming permission denial', (tester) async {
      final e = WeatherEnv();
      e.position = () => Future.error(const _PluginError('OS-PLUG-GLOC-0007'));
      await e.pump(tester);
      await settle(tester);
      expect(find.byKey(const ValueKey('weather-fallback')), findsOneWidget);
      expect(find.textContaining('Bakı üçün hava göstərilir'), findsOneWidget);
      expect(e.body['lat'], 40.4093);
      expect(e.body['lng'], 49.8671);
      expect(e.env.toasts, isEmpty);
      await unmountMediaTool(tester);
    });

    testWidgets('does not mistake a backend permission error for device location denial', (tester) async {
      final e = WeatherEnv();
      e.env.db.functions['weather-clothing'] = (_) => DbResult<Object?>(error: StateError('permission denied for remote service'));
      await e.pump(tester);
      await settle(tester);
      expect(e.env.toasts.map((t) => t.description), contains('Hava məlumatı alınarkən xəta baş verdi.'));
      expect(find.textContaining('Məkan icazəsi rədd edildi'), findsNothing);
      await unmountMediaTool(tester);
    });
  });

  group('weather user context', () {
    test('date-fns month and day differences', () {
      expect(differenceInMonthsFns(DateTime(2026, 11, 27), DateTime(2026, 5, 28)), 5);
      expect(differenceInMonthsFns(DateTime(2026, 11, 27), DateTime(2026, 5, 27)), 6);
      expect(differenceInDaysFns(DateTime(2026, 11, 27, 10), DateTime(2026, 11, 20, 12)), 6);
    });
  });
}

class _PluginError implements Exception {
  const _PluginError(this.code);
  final String code;
}

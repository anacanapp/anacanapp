// Ported from: (Flutter-only) contract of the az.anacan/legacy_prefs channel against the
// @capacitor/preferences native layout.

import 'package:anacan/core/storage/legacy_preferences.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  /// Mimics the iOS side: UserDefaults with the "CapacitorStorage." prefix.
  final defaults = <String, Object>{};
  final calls = <MethodCall>[];

  setUp(() {
    defaults
      ..clear()
      ..['CapacitorStorage.anacan.backend-admission.v1'] = '{"pin":1}'
      ..['flutter.unrelated'] = 'x';
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(MethodChannelLegacyPreferences.defaultChannel, (call) async {
      calls.add(call);
      final args = (call.arguments as Map?)?.cast<String, Object?>();
      switch (call.method) {
        case 'get':
          return defaults['CapacitorStorage.${args!['key']}'];
        case 'set':
          defaults['CapacitorStorage.${args!['key']}'] = args['value']!;
          return null;
        case 'remove':
          defaults.remove('CapacitorStorage.${args!['key']}');
          return null;
        case 'keys':
          return [
            for (final key in defaults.keys)
              if (key.startsWith('CapacitorStorage.')) key.substring('CapacitorStorage.'.length),
          ];
      }
      throw MissingPluginException();
    });
  });

  tearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(MethodChannelLegacyPreferences.defaultChannel, null));

  test('uses the az.anacan/legacy_prefs channel with get/set/remove/keys', () async {
    const prefs = MethodChannelLegacyPreferences();
    expect(MethodChannelLegacyPreferences.defaultChannel.name, 'az.anacan/legacy_prefs');
    expect(await prefs.get('anacan.backend-admission.v1'), '{"pin":1}');
    expect(await prefs.get('missing'), isNull);
    await prefs.set('anacan.auth.session.v1', 'v');
    expect(defaults['CapacitorStorage.anacan.auth.session.v1'], 'v');
    expect(await prefs.keys(), {'anacan.backend-admission.v1', 'anacan.auth.session.v1'});
    await prefs.remove('anacan.auth.session.v1');
    expect(defaults.containsKey('CapacitorStorage.anacan.auth.session.v1'), isFalse);
    expect(calls.map((c) => c.method), ['get', 'get', 'set', 'keys', 'remove']);
    expect(calls[2].arguments, {'key': 'anacan.auth.session.v1', 'value': 'v'});
  });

  test('surfaces native failures as exceptions (callers treat them as storage errors)', () async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
        MethodChannelLegacyPreferences.defaultChannel,
        (call) async => throw PlatformException(code: 'WRITE_FAILED'));
    await expectLater(const MethodChannelLegacyPreferences().set('k', 'v'), throwsA(isA<PlatformException>()));
  });

  test('in-memory fake records calls and supports overrides', () async {
    final fake = InMemoryLegacyPreferences({'a': '1'});
    expect(await fake.get('a'), '1');
    fake.onSet = (_, _) async => throw Exception('quota');
    await expectLater(fake.set('b', '2'), throwsException);
    expect(fake.getCalls, ['a']);
    expect(fake.setCalls.single.key, 'b');
    expect(await fake.keys(), {'a'});
  });
}

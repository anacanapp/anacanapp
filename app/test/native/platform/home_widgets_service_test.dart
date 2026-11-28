// Ported from: src/hooks/useHomeWidgetSync.ts (when the snapshot is pushed and what it carries)
import 'dart:convert';

import 'package:anacan/features/home/home_inputs.dart';
import 'package:anacan/features/settings/widget_settings_screen.dart' show kWidgetSettingsKey;
import 'package:anacan/native/platform/home_widgets/home_widgets_service.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final sent = <Map<String, dynamic>>[];
  setUp(() {
    sent.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(const MethodChannel('anacan/widgets'),
        (call) async {
      sent.add(jsonDecode((call.arguments as Map)['snapshot'] as String) as Map<String, dynamic>);
      return {'ok': true};
    });
  });
  tearDown(() => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(const MethodChannel('anacan/widgets'), null));

  ProviderContainer container({String? lifeStage = 'mommy', String? userId = 'user-1', LocalStore? store}) {
    final c = ProviderContainer(overrides: [
      localStoreProvider.overrideWithValue(store ?? LocalStore.memory({})),
      homeUserIdProvider.overrideWithValue(userId),
      homeProfileRowProvider.overrideWithValue(const {'baby_name': 'Profil', 'baby_birth_date': '2026-01-01'}),
      homeSelectedChildProvider.overrideWithValue(const {'id': 'c1', 'name': 'Murad', 'birth_date': '2026-07-29', 'avatar_emoji': '🐣'}),
      homeWidgetsAccountProvider.overrideWithValue((lifeStage: lifeStage, language: 'az', premium: false)),
      homeWidgetsServiceProvider.overrideWith((ref) => createHomeWidgetsService(ref, lifecycle: false)),
    ]);
    addTearDown(c.dispose);
    return c;
  }

  test('pushes the mommy journey of the selected child and a locked care sample without Premium', () async {
    final c = container();
    c.read(homeWidgetsServiceProvider);
    await pumpEventQueue();
    expect(sent, hasLength(1));
    final snap = sent.single;
    expect(snap['premium'], isFalse);
    expect(snap['careLocked'], isTrue);
    expect((snap['journey'] as Map)['eyebrow'], 'Murad');
    expect((snap['journey'] as Map)['emoji'], '🐣');
    expect((snap['care'] as Map)['name'], 'Nuray');
    expect(snap['locale'], isNotNull);
  });

  test('widget settings written to the LocalStore and the settings change event push again', () async {
    final store = LocalStore.memory({});
    final c = container(store: store);
    final service = c.read(homeWidgetsServiceProvider);
    await pumpEventQueue();
    store.setItem(kWidgetSettingsKey, jsonEncode({'showFeed': true, 'showNap': true, 'showActions': true, 'privacy': true}));
    await pumpEventQueue();
    expect(sent.map((s) => s['privacy']), [false, true]);
    service.changed();
    await pumpEventQueue();
    // One recomputation per trigger; it is sent only when the content changed (the locked sample's relative times
    // follow the clock, so it may differ by a millisecond).
    expect(sent.length, anyOf(2, 3));
    expect(sent.last['privacy'], isTrue);
  });

  test('nothing is pushed for a signed-out user or a stage without widgets', () async {
    container(userId: null).read(homeWidgetsServiceProvider);
    container(lifeStage: 'flow').read(homeWidgetsServiceProvider);
    await pumpEventQueue();
    expect(sent, isEmpty);
  });
}

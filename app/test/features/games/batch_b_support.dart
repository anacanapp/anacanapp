// Ported from: (test harness of the batch-B game screens — no React counterpart; mirrors the vitest mocks of
//              src/components/games/GameRewardIntegration.test.tsx and color-sort/ColorSortGame.test.tsx)
import 'dart:io';

import 'package:anacan/design/design.dart';
import 'package:anacan/domain/ads/ads_config.dart';
import 'package:anacan/domain/ads/ads_policy.dart';
import 'package:anacan/features/games/casual/ui/game_platform.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/ui_common/game_ads.dart';
import 'package:anacan/features/games/ui_common/game_data.dart';
import 'package:anacan/features/games/ui_common/game_env.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;

import '../../support/i18n_fakes.dart';

/// `useAdExperience` mock: the default ads configuration, no interstitials, rewarded results from [rewards].
class FakeGameAdsPlatform implements GameAdsPlatform {
  FakeGameAdsPlatform({AdsConfiguration? configuration, this.premium = false}) : configuration = configuration ?? defaultAdsConfiguration();
  @override
  final AdsConfiguration? configuration;
  @override
  bool premium;
  @override
  bool busy = false;

  /// Results of the next `showRewarded` calls (empty → false).
  final List<bool> rewards = [];
  int rewardedCalls = 0;

  @override
  VoidCallback registerSurface(String placement) => () {};
  @override
  bool opportunity(String placement, String key) => false;
  @override
  Future<bool> showInterstitial(String placement) async => false;
  @override
  Future<bool> showRewarded(String placement) async {
    rewardedCalls++;
    return rewards.isEmpty ? false : rewards.removeAt(0);
  }

  @override
  AdDecision decisionFor(String placement) => const AdDecision(allowed: true, reason: 'ready', waitSeconds: 0, mode: 'demo', adUnitId: null);
}

/// Reads `assets/games/**` from disk (flutter test runs in `app/`).
Future<String> readGameAsset(String path) => File(path).readAsString();

GameData? _data;

/// The bundled copy packs, loaded once per test file.
Future<GameData> loadTestGameData() async => _data ??= await GameData.load(readGameAsset);

class HapticLog {
  final List<String> calls = [];
}

List<Override> gameOverrides({
  required GameStore store,
  GameAdsPlatform? ads,
  GameData? data,
  HapticLog? haptics,
  String language = 'az',
}) =>
    [
      gameStoreProvider.overrideWithValue(store),
      gameLanguageProvider.overrideWithValue(language),
      gameAdsPlatformProvider.overrideWithValue(ads ?? FakeGameAdsPlatform()),
      gameHapticsProvider.overrideWithValue(GameHaptics(
        light: () async => haptics?.calls.add('light'),
        medium: () async => haptics?.calls.add('medium'),
      )),
      gameHeavyHapticProvider.overrideWithValue(() async => haptics?.calls.add('heavy')),
      gameAssetTextLoaderProvider.overrideWithValue(readGameAsset),
      if (data != null) gameDataProvider.overrideWith((ref) async => data),
    ];

/// Pumps [child] in the app theme at 390 × 844 with animations reduced (springs snap, decorative loops stop).
Future<void> pumpGame(
  WidgetTester tester,
  Widget child, {
  required List<Override> overrides,
  Size size = const Size(390, 844),
  bool rtl = false,
  ProviderContainer? container,
}) async {
  installTestI18n();
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final app = MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: buildAnacanTheme(Brightness.light, locale: Locale(rtl ? 'ar' : 'az'), lite: false),
    builder: (context, nav) => MediaQuery(
      data: MediaQueryData(size: size, disableAnimations: true),
      child: Directionality(textDirection: rtl ? TextDirection.rtl : TextDirection.ltr, child: nav!),
    ),
    home: child,
  );
  await tester.pumpWidget(container != null ? UncontrolledProviderScope(container: container, child: app) : ProviderScope(overrides: overrides, child: app));
}

/// Taps the first widget whose text contains [text] (like `getByRole('button', { name: /…/ })`).
Future<void> tapText(WidgetTester tester, Pattern text) async {
  final finder = find.textContaining(text);
  expect(finder, findsWidgets, reason: 'no text $text');
  await tester.tap(finder.first, warnIfMissed: false);
  await tester.pump();
}

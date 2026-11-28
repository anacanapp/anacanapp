// Ported from: (test harness for the games UI ports — the vi.mock set-up shared by the React *.test.tsx files)
import 'dart:io';

import 'package:anacan/core/auth/auth_providers.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/features/games/iki_dost/engine/engine.dart';
import 'package:anacan/features/games/iki_dost/ui/two_friends_screen.dart';
import 'package:anacan/features/games/parking/engine/engine.dart';
import 'package:anacan/features/games/parking/ui/clear_the_way_screen.dart';
import 'package:anacan/features/games/ui_common/game_ads.dart';
import 'package:anacan/features/games/ui_common/game_env.dart';
import 'package:anacan/features/games/ui_common/game_registry.dart';
import 'package:anacan/features/games/word_garden/engine/generator.dart';
import 'package:anacan/features/games/word_garden/engine/lexicon.dart';
import 'package:anacan/features/games/word_garden/engine/library.dart';
import 'package:anacan/features/games/word_garden/ui/garden_level_loader.dart';
import 'package:anacan/state/local_store.dart';
import 'package:anacan/state/persisted_store.dart' show localStoreProvider;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;

import '../../support/i18n_fakes.dart';

/// `vi.spyOn(performance, 'now')`.
class FakeGameClock implements GameClock {
  double now = 0;
  @override
  double nowMs() => now;
}

final Map<String, CompiledLexicon> _lexicons = {};

/// `loadGardenLexicon(language, revision)` from the bundled asset files (compiled once per test run).
CompiledLexicon gardenLexicon([String? revision]) {
  final target = gardenLexiconAsset('az', revision);
  return _lexicons[target.revision] ??= compileGardenLexiconAsset(File(target.asset).readAsStringSync(), 'az', revision);
}

/// The worker replaced by a direct call (`vi.mock('./workerClient')`).
Future<dynamic> _noop() async {}

/// A game test environment: memory LocalStore, app language, the fake clock and synchronous workers.
class GameTestEnv {
  GameTestEnv({this.language = 'az', Map<String, String>? storage, GameRegistry? registry, this.ads = const NoGameAdsPlatform()})
      : store = LocalStore.memory(storage),
        registry = registry ?? GameRegistry();
  String language;
  final LocalStore store;
  final GameRegistry registry;
  final FakeGameClock clock = FakeGameClock();
  GameAdsPlatform ads;
  final List<(String, Map<String, Object?>)> events = [];

  String? item(String key) => store.getItem(key);

  List<Override> overrides({List<Override> extra = const []}) => [
        localStoreProvider.overrideWithValue(store),
        queryClientProvider.overrideWithValue(QueryClient()),
        authUserProvider.overrideWithValue(null),
        gameLanguageProvider.overrideWithValue(language),
        gameClockProvider.overrideWithValue(clock),
        gameRegistryProvider.overrideWithValue(registry),
        gameAdsPlatformProvider.overrideWithValue(ads),
        gameHapticsProvider.overrideWithValue(GameHaptics(light: _noop, medium: _noop)),
        gameAnalyticsProvider.overrideWithValue(GameAnalytics(event: (name, params) => events.add((name, params)), screen: (_, _) {})),
        gameAssetTextLoaderProvider.overrideWithValue((path) async => File(path).readAsStringSync()),
        gardenLevelLoaderProvider.overrideWithValue((language, level, mode, {revision, seed}) async =>
            generateGardenLevel(gardenLexicon(revision), level, mode, seed ?? 0)),
        friendsHintRunnerProvider.overrideWithValue((level, state) async {
          final path = solveFriends(level, state).path;
          return path == null || path.isEmpty ? null : path.first;
        }),
        parkingHintRunnerProvider.overrideWithValue((level, state) async {
          final path = solveParking(level, state).path;
          return path == null || path.isEmpty ? null : path.first;
        }),
        ...extra,
      ];
}

/// Pumps [child] in the app theme with an Overlay (the game portals draw into it) at 390×844.
Future<void> pumpGame(WidgetTester tester, GameTestEnv env, Widget child, {List<Override> extra = const [], Size size = const Size(390, 844)}) async {
  installTestI18n();
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(
    overrides: env.overrides(extra: extra),
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: buildAnacanTheme(Brightness.light, locale: const Locale('az'), lite: false),
      builder: (context, nav) => MediaQuery(data: MediaQueryData(size: size, disableAnimations: true), child: nav!),
      home: Builder(builder: (context) => ColoredBox(color: AnacanTokens.of(context).a.bg, child: SingleChildScrollView(child: child))),
    ),
  ));
  await settle(tester);
}

/// Lets asset reads / generation futures finish and the frame after them build.
Future<void> settle(WidgetTester tester, [int rounds = 4]) async {
  for (var i = 0; i < rounds; i++) {
    await tester.pump();
  }
}

/// Advances the fake `performance.now()` and the frame clock together.
Future<void> advance(WidgetTester tester, GameTestEnv env, Duration duration, {Duration step = const Duration(milliseconds: 250)}) async {
  var left = duration;
  while (left > Duration.zero) {
    final next = left < step ? left : step;
    env.clock.now += next.inMicroseconds / 1000;
    await tester.pump(next);
    left -= next;
  }
}

/// `testWidgets` that unmounts and flushes LocalStore / timers afterwards.
void gameTest(String description, Future<void> Function(WidgetTester tester) body, {Timeout? timeout}) {
  testWidgets(description, (tester) async {
    await body(tester);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(days: 1));
  }, timeout: timeout);
}

/// Taps the first widget with [key] (scrolling is not needed: game screens fit the viewport).
Future<void> tapKey(WidgetTester tester, String key) => tapFinder(tester, find.byKey(ValueKey(key)).first);

Future<void> tapText(WidgetTester tester, Pattern text) => tapFinder(tester, (text is String ? find.text(text) : find.textContaining(text)).last);

Future<void> tapFinder(WidgetTester tester, Finder finder) async {
  expect(finder, findsWidgets);
  await tester.ensureVisible(finder);
  await tester.pump();
  await tester.tap(finder);
  await tester.pump();
}

/// The catalogs read from the bundled assets.
FriendsCatalog friendsCatalogFromAssets() => FriendsCatalog.parse(File('assets/games/iki_dost/catalog.json').readAsStringSync());
ParkingCatalog parkingCatalogFromAssets() => ParkingCatalog.parse(File('assets/games/parking/catalog.json').readAsStringSync());

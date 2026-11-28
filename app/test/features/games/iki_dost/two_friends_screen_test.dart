// Ported from: src/components/games/iki-dost/TwoFriends.test.tsx
import 'dart:convert';

import 'package:anacan/domain/ads/ads_config.dart';
import 'package:anacan/domain/ads/ads_policy.dart';
import 'package:anacan/features/games/iki_dost/engine/engine.dart';
import 'package:anacan/features/games/iki_dost/engine/state.dart';
import 'package:anacan/features/games/iki_dost/persistence/storage.dart';
import 'package:anacan/features/games/iki_dost/ui/two_friends_screen.dart';
import 'package:anacan/features/games/ui_common/game_ads.dart';
import 'package:anacan/features/games/ui_common/game_env.dart';
import 'package:anacan/features/games/ui_common/game_widgets.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../ui_support.dart';

class _Ads implements GameAdsPlatform {
  int transitions = 0;
  @override
  AdsConfiguration? get configuration => null;
  @override
  bool get premium => false;
  @override
  bool get busy => false;
  @override
  VoidCallback registerSurface(String placement) => () {};
  @override
  bool opportunity(String placement, String key) {
    transitions++;
    return false;
  }

  @override
  Future<bool> showInterstitial(String placement) async => false;
  @override
  Future<bool> showRewarded(String placement) async => false;
  @override
  AdDecision decisionFor(String placement) => const AdDecision(allowed: false, reason: 'configuration', waitSeconds: 0, mode: 'demo', adUnitId: null);
}

void main() {
  final catalog = friendsCatalogFromAssets();
  late GameTestEnv env;
  late _Ads ads;
  setUp(() {
    ads = _Ads();
    env = GameTestEnv(ads: ads);
  });

  Map<String, dynamic> saved() => jsonDecode(env.item(friendsStorageKey)!) as Map<String, dynamic>;
  TwoFriendsState screen(WidgetTester tester) => tester.state<TwoFriendsState>(find.byType(TwoFriends));
  Future<void> render(WidgetTester tester) => pumpGame(tester, env, TwoFriends(onBack: () {}));
  Future<void> start(WidgetTester tester) async {
    await tapKey(tester, 'tf-play');
    await settle(tester);
  }

  Future<void> move(WidgetTester tester, String direction) async {
    await advance(tester, env, const Duration(milliseconds: 140), step: const Duration(milliseconds: 140));
    await tapKey(tester, 'friends-direction-$direction');
    await settle(tester);
  }

  bool enabled(WidgetTester tester, String key) => tester.widget<GameButton>(find.byKey(ValueKey(key))).enabled;

  group('Two Friends player', () {
    gameTest('wins with a single shared controller and counts the rescue once under StrictMode', (tester) async {
      await render(tester);
      await start(tester);
      for (final direction in catalog.level(1).solution) {
        await move(tester, direction);
      }
      expect(find.text('İki dost da evdədir!'), findsOneWidget);
      expect(saved()['progress']['unlocked'], 2);
      expect(saved()['progress']['totalRescues'], 2);
      await tapKey(tester, 'tf-next');
      await settle(tester);
      expect(find.text('Səviyyə 2'), findsOneWidget);
      expect(ads.transitions, 1);
    });

    gameTest('resumes a saved path, undoes a shared move and blocks movement while paused', (tester) async {
      await render(tester);
      await start(tester);
      await move(tester, catalog.level(1).solution[0]);
      final before = saved()['round']['path'];
      await tester.pumpWidget(const SizedBox());
      await render(tester);
      await start(tester);
      expect(saved()['round']['path'], before);
      await tapKey(tester, 'tf-pause');
      expect(enabled(tester, 'friends-direction-right'), isFalse);
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();
      expect(saved()['round']['path'], before);
      await tapKey(tester, 'tf-resume');
      await tapKey(tester, 'tf-undo');
      expect(saved()['round']['path'], isEmpty);
      expect(saved()['round']['moves'], 1);
    });

    gameTest('gets an actual solver hint, persists settings and keeps future levels locked', (tester) async {
      await render(tester);
      expect(enabled(tester, 'friends-level-2'), isFalse);
      await tapKey(tester, 'tf-settings');
      await tapKey(tester, 'tf-switch-sound');
      expect(jsonDecode(env.item(friendsPreferencesKey)!)['sound'], true);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pump();
      await start(tester);
      await tapKey(tester, 'tf-hint');
      await settle(tester);
      expect(screen(tester).hint, catalog.level(1).solution[0]);
      expect(saved()['round']['hints'], 1);
      expect(enabled(tester, 'tf-undo'), isFalse);
    });

    gameTest('pauses when backgrounded and keeps Arabic UI with physical directions unchanged', (tester) async {
      env.language = 'ar';
      await render(tester);
      await start(tester);
      expect(tester.widget<Directionality>(find.byKey(const ValueKey('two-friends-screen'))).textDirection, TextDirection.rtl);
      expect(tester.widget<Directionality>(find.byKey(const ValueKey('friends-boards'))).textDirection, TextDirection.ltr);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      // Frames are off while hidden; coming back to the foreground shows the latched pause.
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await tester.pump();
      expect(screen(tester).phase, 'paused');
      expect(enabled(tester, 'friends-direction-right'), isFalse);
      expect(tester.widget<GameButton>(find.byKey(const ValueKey('friends-direction-right'))).label, 'يمين');
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    });

    gameTest('offers an undo after a river mistake without clearing the current journey', (tester) async {
      final level = catalog.level(40);
      final queue = <({FriendsState state, List<String> path})>[(state: initialFriendsState(level), path: const [])];
      final seen = <String>{};
      final lostPath = <String>[];
      for (var index = 0; index < queue.length && lostPath.isEmpty; index++) {
        for (final direction in friendDirections) {
          final current = queue[index], step = moveFriends(level, current.state, direction);
          if (step.lost) {
            lostPath.addAll([...current.path, direction]);
            break;
          }
          final key = friendsStateKey(step.state);
          if (!step.changed || seen.contains(key)) continue;
          seen.add(key);
          queue.add((state: step.state, path: [...current.path, direction]));
        }
      }
      expect(lostPath, isNotEmpty);
      final base = createFriendsProfile();
      final profile = FriendsProfile({
        ...base.json,
        'progress': {...base.progress, 'unlocked': 40},
        'round': {...createFriendsRound(40).json, 'path': lostPath.sublist(0, lostPath.length - 1), 'moves': lostPath.length - 1},
      });
      writeFriendsProfile(LocalStoreGameStore(env.store), profile);
      await render(tester);
      await start(tester);
      await move(tester, lostPath.last);
      expect(find.text('Bir dost çaya düşdü'), findsOneWidget);
      await tapKey(tester, 'tf-lost-undo');
      expect(screen(tester).phase, 'playing');
      expect(saved()['progress']['unlocked'], 40);
      expect(saved()['round']['path'], lostPath.sublist(0, lostPath.length - 1));
    });
  });
}

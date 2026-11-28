// Ported from: src/lib/local-storage.ts (localStorage surface of the game saves), src/lib/native.ts (hapticFeedback),
//              src/hooks/useScreenAnalytics.ts (trackEvent / screen views), src/components/games/word-garden/audio.ts
//              (createGardenAudio, also used by Two Friends), src/lib/app-languages.ts (appLanguageLocale + Intl.NumberFormat)
//
// The environment every game screen reads: the synchronous save store, the app language, haptics, analytics,
// sound and a monotonic clock. Each one is a provider with a working default so tests (and later native wiring)
// can replace it.
library;

import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/count_format.dart' show formatIntlNumber;
import '../../../core/i18n/language_controller.dart';
import '../../../native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import '../../../services/native/audio_players.dart' show JustAudioGameTonePlayer;
import '../../../services/native/mobile_host.dart' show isMobileHost;
import '../../../shell/shell_inputs.dart' show shellPlatformProvider;
import '../../../state/local_store.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../common/persistence/game_store.dart';

/// [GameStore] over the app's [LocalStore] (same keys and raw strings as the WebView localStorage, so saves
/// imported from the Capacitor 53.0 export are read unchanged).
class LocalStoreGameStore implements GameStore {
  LocalStoreGameStore(this.store);
  final LocalStore store;

  @override
  String? getItem(String key) => store.getItem(key);

  @override
  void setItem(String key, String value) => store.setItem(key, value);

  @override
  void removeItem(String key) => store.removeItem(key);

  @override
  Iterable<String> get keys => store.keys;
}

final gameStoreProvider = Provider<GameStore>((ref) => LocalStoreGameStore(ref.watch(localStoreProvider)));

/// `useUserStore(state => state.language) || 'az'`.
final gameLanguageProvider = Provider<String>((ref) {
  final language = ref.watch(appLanguageProvider);
  return language.isEmpty ? 'az' : language;
});

/// `new Intl.NumberFormat(appLanguageLocale(language), { maximumFractionDigits: 0 }).format(value)`.
String gameNumber(String language, num value) => formatIntlNumber(language, value, maximumFractionDigits: 0);

/// `hapticFeedback.light()` / `.medium()` of src/lib/native.ts.
class GameHaptics {
  const GameHaptics({this.light = HapticFeedback.lightImpact, this.medium = HapticFeedback.mediumImpact});
  final Future<void> Function() light;
  final Future<void> Function() medium;
}

final gameHapticsProvider = Provider<GameHaptics>((ref) => const GameHaptics());

/// `trackEvent` / `useScreenAnalytics(name, className)`.
class GameAnalytics {
  const GameAnalytics({required this.event, required this.screen});
  final void Function(String name, Map<String, Object?> params) event;
  final void Function(String screen, String className) screen;
}

final gameAnalyticsProvider = Provider<GameAnalytics>((ref) => GameAnalytics(
      event: (name, params) => ref.read(analyticsSinkProvider).logEvent(name, params),
      screen: (screen, className) => ref.read(shellPlatformProvider).logScreenView(screen, className),
    ));

/// The short sine tones of `createGardenAudio()` (letter / found / bonus / win). Flutter has no WebAudio and no
/// audio package is in pubspec yet, so the default is silent (React's "no AudioContext" branch). A native
/// implementation plays [gardenToneFrequencies] for [kind] (sine, 0.09 s apart, 0.18 s decay, gain 0.025 for
/// letters, 0.055 otherwise).
abstract interface class GameTonePlayer {
  void play(String kind, bool enabled);
  void close();
}

class SilentGameTonePlayer implements GameTonePlayer {
  const SilentGameTonePlayer();
  @override
  void play(String kind, bool enabled) {}
  @override
  void close() {}
}

/// audio.ts frequencies per kind.
List<double> gardenToneFrequencies(String kind) => switch (kind) {
      'win' => const [523.25, 659.25, 783.99, 1046.5],
      'found' => const [659.25, 880],
      'bonus' => const [783.99, 1046.5],
      _ => const [440],
    };

final gameTonePlayerFactoryProvider = Provider<GameTonePlayer Function()>(
    (ref) => isMobileHost ? JustAudioGameTonePlayer.new : () => const SilentGameTonePlayer());

/// `performance.now()` in milliseconds (monotonic). Tests replace it with a controllable clock.
abstract interface class GameClock {
  double nowMs();
}

class StopwatchGameClock implements GameClock {
  StopwatchGameClock() : _watch = Stopwatch()..start();
  final Stopwatch _watch;
  @override
  double nowMs() => _watch.elapsedMicroseconds / 1000;
}

final gameClockProvider = Provider<GameClock>((ref) => StopwatchGameClock());

/// Reads a bundled game asset as UTF-8 text without `compute` (AssetBundle.loadString moves files over 50 KB to
/// a background isolate). Tests replace it with a file reader.
final gameAssetTextLoaderProvider = Provider<Future<String> Function(String path)>(
  (ref) => (path) async => utf8.decode((await rootBundle.load(path)).buffer.asUint8List()),
);

// Ported from: src/components/games/MiniGamesHub.tsx (the lazy game imports and the `view` switch: own-screen
//              games vs. the hub's levels → game flow)
//
// The hub lists every game itself (cards, order and copy are fixed like in React); what opens when a card is
// tapped comes from this registry, so each game folder plugs in its screens with `registerGame(...)` without the
// hub importing it. A card whose game is not registered opens [GameNotAvailable].
library;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../hub/persistence/local_game_progress.dart' show GameProgress;

/// Game ids exactly as in React (`data-game-id`).
abstract final class MiniGameIds {
  static const saglamSebet = 'saglam-sebet';
  static const birlesdir = 'birlesdir';
  static const colorSort = 'color-sort';
  static const wordGarden = 'word-garden';
  static const twoFriends = 'iki-dost';
  static const leafFlight = 'leaf-flight';
  static const clearTheWay = 'clear-the-way';
  static const qabarciq = 'qabarciq';
}

sealed class GameEntry {
  const GameEntry(this.id);
  final String id;
}

/// Arguments of an own-screen game (`<WordGarden onBack />`, `<TwoFriends onBack />`, …).
class GameScreenArgs {
  const GameScreenArgs({required this.onBack});
  final VoidCallback onBack;
}

/// A game with its own full-screen flow (Söz bağı, İki dost, Tumurcuğun uçuşu, Yolunu aç, Qabarcıq).
class ScreenGameEntry extends GameEntry {
  const ScreenGameEntry({required String id, required this.builder}) : super(id);
  final Widget Function(BuildContext context, GameScreenArgs args) builder;
}

/// `<XLevels progress isLevelUnlocked onSelectLevel onBack />`.
class GameLevelsArgs {
  const GameLevelsArgs({required this.progress, required this.isLevelUnlocked, required this.onSelectLevel, required this.onBack});
  final GameProgress progress;
  final bool Function(int level) isLevelUnlocked;
  final ValueChanged<int> onSelectLevel;
  final VoidCallback onBack;
}

/// `onLevelComplete({ level, score, stars, passed })`.
class GameLevelResult {
  const GameLevelResult({required this.level, required this.score, required this.stars, required this.passed});
  final int level;
  final int score;

  /// 0–3.
  final int stars;
  final bool passed;
}

/// `<XGame key={level} level onExit onLevelComplete onNextLevel />`.
class GamePlayArgs {
  const GamePlayArgs({required this.level, required this.onExit, required this.onLevelComplete, required this.onNextLevel});
  final int level;
  final VoidCallback onExit;
  final void Function(GameLevelResult result) onLevelComplete;
  final VoidCallback onNextLevel;
}

/// A level game driven by the hub (Sağlam Səbət, Birləşdir, Rəng çeşidləmə): the hub keeps its local progress
/// (`anacan_minigame_progress_<id>`), records results, submits scores and moves between levels and game.
class LevelGameEntry extends GameEntry {
  const LevelGameEntry({
    required String id,
    required this.levels,
    required this.game,
    required this.levelCount,
    this.nextLevel,
  }) : super(id);

  final Widget Function(BuildContext context, GameLevelsArgs args) levels;

  /// Mounted with `key: ValueKey(level)` (a new level remounts the game, like React's `key`).
  final Widget Function(BuildContext context, GamePlayArgs args) game;

  /// Levels shown on the hub card (`TOTAL_LEVELS`, or the Color Sort library's current count). Watch providers
  /// through [ref] so the card follows changes.
  final int Function(WidgetRef ref) levelCount;

  /// `onNextLevel`: the next selected level from [current] (default `min(current + 1, levelCount)`). May have side
  /// effects (Color Sort adds a level pack when the last level is passed).
  final int Function(WidgetRef ref, int current)? nextLevel;
}

class GameRegistry {
  final Map<String, GameEntry> _entries = {};

  /// Registering an id twice replaces the earlier entry (hot restart safe).
  void register(GameEntry entry) => _entries[entry.id] = entry;

  GameEntry? operator [](String id) => _entries[id];
  Iterable<String> get ids => _entries.keys;
  bool contains(String id) => _entries.containsKey(id);
}

/// The process-wide registry filled by `registerGamesFeature` (and the game registration functions it is given).
final GameRegistry sharedGameRegistry = GameRegistry();

/// `registerGame(entry)` on the shared registry.
void registerGame(GameEntry entry) => sharedGameRegistry.register(entry);

/// Tests override this with their own registry.
final gameRegistryProvider = Provider<GameRegistry>((ref) => sharedGameRegistry);

// Ported from: src/hooks/useLocalGameProgress.ts
//
// `useLocalGameProgress(gameId)`: device-local level progress (unlocks, stars, best scores) under
// `anacan_minigame_progress_<gameId>`, read when first watched and written on every result. Works offline and
// signed out; the leaderboard sync is layered on top separately (hub/data/game_scores.dart).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../hub/persistence/local_game_progress.dart' as store;
import 'game_env.dart';

export '../hub/persistence/local_game_progress.dart' show GameProgress, defaultGameProgress, localProgressPrefix;

class LocalGameProgressNotifier extends Notifier<store.GameProgress> {
  LocalGameProgressNotifier(this.gameId);
  final String gameId;

  @override
  store.GameProgress build() => store.readGameProgress(ref.watch(gameStoreProvider), gameId);

  /// `recordLevelResult(level, score, stars, passed)` (written at once, quota errors ignored).
  void recordLevelResult(int level, num score, int stars, bool passed) {
    final next = store.recordLevelResult(state, level, score, stars, passed);
    store.writeGameProgress(ref.read(gameStoreProvider), gameId, next);
    state = next;
  }

  /// `isLevelUnlocked(level)`.
  bool isLevelUnlocked(int level) => state.isLevelUnlocked(level);
}

/// One progress per game id, re-read from storage whenever no screen watches it (like the hook's mount read).
final localGameProgressProvider =
    NotifierProvider.autoDispose.family<LocalGameProgressNotifier, store.GameProgress, String>(LocalGameProgressNotifier.new);

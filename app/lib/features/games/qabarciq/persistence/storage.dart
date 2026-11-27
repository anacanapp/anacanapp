// Ported from: src/components/games/qabarciq/BubblePop.tsx (localStorage best score and sound)
//
// Keys: `anacan:qabarciq:best:v1` (number string) and `anacan:qabarciq:sound:v1` ("on"/"off").
library;

import 'dart:math' as math;

import '../../common/engine/js.dart';
import '../../common/persistence/game_store.dart';
import '../engine/engine.dart';

const String bubbleBestKey = 'anacan:qabarciq:best:v1';
const String bubbleSoundKey = 'anacan:qabarciq:sound:v1';

/// `Number(localStorage.getItem(key)) || 0`.
double readBubbleBest(GameStore store) {
  try {
    final value = jsToNumber(store.getItem(bubbleBestKey));
    return value.isNaN ? 0 : value;
  } catch (_) {
    return 0;
  }
}

/// Saves a new record (`score > 0 && score > best`) like `finish()`; returns whether it was a record.
bool recordBubbleBest(GameStore store, int score, num best) {
  final capped = math.min(maxScore, score);
  final record = capped > 0 && capped > best;
  if (record) {
    try {
      store.setItem(bubbleBestKey, '$capped');
    } catch (_) {}
  }
  return record;
}

bool readBubbleSound(GameStore store) {
  try {
    return store.getItem(bubbleSoundKey) != 'off';
  } catch (_) {
    return true;
  }
}

void writeBubbleSound(GameStore store, bool on) {
  try {
    store.setItem(bubbleSoundKey, on ? 'on' : 'off');
  } catch (_) {}
}

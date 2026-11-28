// Ported from: src/lib/native.ts (hapticFeedback.heavy, nativeShare), src/components/games/qabarciq/BubblePop.tsx
// (popSound, WebAudio)
//
// Platform seams of the batch-B game screens that `ui_common/game_env.dart` does not cover (yet).
library;

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

export '../../../profile/profile_interfaces.dart' show ShareService, shareServiceProvider;

/// `hapticFeedback.heavy()` (bad catch in Sağlam Səbət, colour-bomb swap in Birləşdir). `GameHaptics` in
/// ui_common only has light/medium.
final gameHeavyHapticProvider = Provider<Future<void> Function()>((ref) => HapticFeedback.heavyImpact);

/// Bubble Pop's WebAudio pop: a sine sweep from `420 + min(combo, 10)·45` Hz up to ×2.4 (big) / ×1.8 over
/// 90 ms, gain 0.0001 → 0.22 (12 ms) → 0.0001 (160 ms). No audio package is bundled, so the default is silent
/// (React's "audio unavailable" branch).
abstract interface class BubbleSoundPlayer {
  void pop(int combo, bool big);
}

class SilentBubbleSoundPlayer implements BubbleSoundPlayer {
  const SilentBubbleSoundPlayer();
  @override
  void pop(int combo, bool big) {}
}

final bubbleSoundPlayerProvider = Provider<BubbleSoundPlayer>((ref) => const SilentBubbleSoundPlayer());

/// The frequencies the WebAudio pop sweeps between (for an audio implementation).
({double from, double to}) bubblePopFrequencies(int combo, bool big) {
  final base = 420 + (combo < 10 ? combo : 10) * 45.0;
  return (from: base, to: base * (big ? 2.4 : 1.8));
}

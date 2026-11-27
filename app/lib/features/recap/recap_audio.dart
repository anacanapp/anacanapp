// Ported from: src/components/recap/RecapScreen.tsx (`<audio src={RECAP_MUSIC_URL} preload="auto" playsInline />`)
//
// The player's music. The web uses an HTMLAudioElement; the Flutter app has no audio package yet, so the
// screen talks to this interface and the default is silent. A real implementation (e.g. just_audio playing
// `assets/recap/recap-2026.mp3`) maps one to one: position ↔ currentTime, play() ↔ play() (a failure makes
// the screen mute itself, like the rejected `audio.play()` promise), pause(), muted.
import 'package:flutter_riverpod/flutter_riverpod.dart';

abstract interface class RecapAudio {
  /// `!audio.paused`.
  bool get playing;

  /// `audio.currentTime` (seconds).
  double get position;
  set position(double seconds);

  set muted(bool value);

  /// `audio.play()`; throws when playback is refused.
  Future<void> play();
  void pause();
  void dispose();
}

/// No audio backend: never plays, never fails.
class SilentRecapAudio implements RecapAudio {
  double _position = 0;
  @override
  bool get playing => false;
  @override
  double get position => _position;
  @override
  set position(double seconds) => _position = seconds;
  @override
  set muted(bool value) {}
  @override
  Future<void> play() async {}
  @override
  void pause() {}
  @override
  void dispose() {}
}

/// Creates the player for one RecapScreen (asset: recap_export.dart `recapMusicAsset`).
final recapAudioFactoryProvider = Provider<RecapAudio Function()>((ref) => SilentRecapAudio.new);

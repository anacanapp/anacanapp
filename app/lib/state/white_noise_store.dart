// Ported from: src/store/whiteNoiseStore.ts (state shape and actions; audio left to [WhiteNoiseAudio]),
// src/lib/white-noise-audio.ts (effectiveGain)
//
// Not persisted. The Web Audio / <audio> plumbing (gain node, iOS routing, media session,
// interruption resume) is replaced by an injected audio engine.

import 'package:flutter_riverpod/flutter_riverpod.dart';

class WhiteNoiseSound {
  const WhiteNoiseSound({
    required this.id,
    required this.name,
    required this.emoji,
    required this.color,
    required this.noiseType,
    this.audioUrl,
  });
  final String id;
  final String name;
  final String emoji;
  final String color;

  /// 'white' | 'pink' | 'brown' | … (generated noise when [audioUrl] is null).
  final String noiseType;
  final String? audioUrl;
}

/// `effectiveGain(volume, muted)` of src/lib/white-noise-audio.ts.
double effectiveGain(num volume, bool muted) {
  if (muted || !volume.isFinite) return 0;
  return (volume / 100).clamp(0, 1).toDouble();
}

/// Audio engine (just_audio / audio session etc., provided by the native layer).
abstract interface class WhiteNoiseAudio {
  void play(WhiteNoiseSound sound, double gain);
  void stop();
  void setGain(double gain);
}

class NoopWhiteNoiseAudio implements WhiteNoiseAudio {
  const NoopWhiteNoiseAudio();
  @override
  void play(WhiteNoiseSound sound, double gain) {}
  @override
  void stop() {}
  @override
  void setGain(double gain) {}
}

final whiteNoiseAudioProvider = Provider<WhiteNoiseAudio>((ref) => const NoopWhiteNoiseAudio());

class WhiteNoiseState {
  const WhiteNoiseState({
    this.activeSoundId,
    this.soundName,
    this.soundEmoji,
    this.soundColor,
    this.noiseType,
    this.audioUrl,
    this.volume = 70,
    this.isMuted = false,
    this.isPlaying = false,
  });

  final String? activeSoundId;
  final String? soundName;
  final String? soundEmoji;
  final String? soundColor;
  final String? noiseType;
  final String? audioUrl;
  final num volume;
  final bool isMuted;
  final bool isPlaying;

  WhiteNoiseState copyWith({num? volume, bool? isMuted}) => WhiteNoiseState(
        activeSoundId: activeSoundId,
        soundName: soundName,
        soundEmoji: soundEmoji,
        soundColor: soundColor,
        noiseType: noiseType,
        audioUrl: audioUrl,
        volume: volume ?? this.volume,
        isMuted: isMuted ?? this.isMuted,
        isPlaying: isPlaying,
      );
}

/// `useWhiteNoiseStore`.
final whiteNoiseStoreProvider = NotifierProvider<WhiteNoiseStore, WhiteNoiseState>(WhiteNoiseStore.new);

class WhiteNoiseStore extends Notifier<WhiteNoiseState> {
  late WhiteNoiseAudio _audio;

  @override
  WhiteNoiseState build() {
    _audio = ref.watch(whiteNoiseAudioProvider);
    return const WhiteNoiseState();
  }

  void play(WhiteNoiseSound sound) {
    _audio.stop();
    _audio.play(sound, effectiveGain(state.volume, state.isMuted));
    state = WhiteNoiseState(
      activeSoundId: sound.id,
      soundName: sound.name,
      soundEmoji: sound.emoji,
      soundColor: sound.color,
      noiseType: sound.noiseType,
      audioUrl: sound.audioUrl,
      volume: state.volume,
      isMuted: state.isMuted,
      isPlaying: true,
    );
  }

  void stop() {
    _audio.stop();
    state = WhiteNoiseState(volume: state.volume, isMuted: state.isMuted);
  }

  void setVolume(num v) {
    _audio.setGain(effectiveGain(v, state.isMuted));
    state = state.copyWith(volume: v);
  }

  void setMuted(bool m) {
    _audio.setGain(effectiveGain(state.volume, m));
    state = state.copyWith(isMuted: m);
  }

  void toggleMute() => setMuted(!state.isMuted);
}

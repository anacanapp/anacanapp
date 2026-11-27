// Ported from: src/lib/white-noise-audio.ts (isIOSAudioPlatform, setAudioSessionType, resumeIfNeeded,
//              setMediaSession), src/store/whiteNoiseStore.ts (generateNoiseBuffer, the play / stop / volume plumbing
//              and the streamed-file error fallback)
//
// The store (app/lib/state/white_noise_store.dart) keeps the state and calls a [WhiteNoiseAudio] engine.
// [BackendWhiteNoiseAudio] is that engine over a small player interface ([NoisePlayerBackend]); a `just_audio`
// backend plays a looping URL or the generated WAV bytes and exposes the audio session / lock-screen controls.
// Until that package lands, the store keeps its silent default engine.
import 'dart:math' as math;
import 'dart:typed_data';

import '../../../state/white_noise_store.dart' show WhiteNoiseAudio, WhiteNoiseSound;

/// `isIOSAudioPlatform(platform, nav)`: native iOS, an iPhone/iPad/iPod user agent, or iPadOS's desktop Mac agent
/// with touch.
bool isIOSAudioPlatform(String platform, {String? userAgent, int? maxTouchPoints}) {
  if (platform == 'ios') return true;
  if (platform == 'android' || userAgent == null) return false;
  if (RegExp('iPhone|iPad|iPod', caseSensitive: false).hasMatch(userAgent)) return true;
  return RegExp('Macintosh', caseSensitive: false).hasMatch(userAgent) && (maxTouchPoints ?? 0) > 1;
}

/// `navigator.audioSession` ('auto' | 'playback' | …).
abstract interface class AudioSessionControl {
  set type(String value);
}

/// `setAudioSessionType(type, nav)`: best effort, a no-op where unsupported.
void setAudioSessionType(String type, AudioSessionControl? session) {
  if (session == null) return;
  try {
    session.type = type;
  } catch (_) {
    // unsupported value
  }
}

/// A suspended / interrupted audio graph (`AudioContext`).
abstract interface class ResumableAudioContext {
  /// 'running' | 'suspended' | 'interrupted' | 'closed'.
  String get state;
  Future<void> resume();
}

/// A paused media element (`HTMLAudioElement`).
abstract interface class ResumablePlayer {
  bool get paused;

  /// The `src` attribute (null once released).
  String? get source;
  Future<void> play();
}

/// `resumeIfNeeded(ctx, audio)`: resumes a non-running, non-closed context and a paused element with a source.
void resumeIfNeeded(ResumableAudioContext? ctx, ResumablePlayer? audio) {
  if (ctx != null && ctx.state != 'running' && ctx.state != 'closed') {
    ctx.resume().catchError((Object _) {});
  }
  if (audio != null && audio.paused && (audio.source ?? '').isNotEmpty) {
    audio.play().catchError((Object _) {});
  }
}

/// `MediaSessionInfo`.
class MediaSessionInfo {
  const MediaSessionInfo({required this.title, required this.artist});
  final String title;
  final String artist;
}

/// `navigator.mediaSession` (lock screen / notification controls).
abstract interface class MediaSessionControl {
  set metadata(MediaSessionInfo? value);

  /// 'none' | 'paused' | 'playing'.
  set playbackState(String value);
  void setActionHandler(String action, void Function()? handler);
}

/// `setMediaSession(info, onStop, nav)`: pause and stop both stop the noise; null clears the session.
void setMediaSession(MediaSessionInfo? info, void Function() onStop, MediaSessionControl? session) {
  if (session == null) return;
  try {
    if (info == null) {
      session.metadata = null;
      session.playbackState = 'none';
      for (final action in const ['pause', 'stop']) {
        try {
          session.setActionHandler(action, null);
        } catch (_) {}
      }
      return;
    }
    session.metadata = info;
    session.playbackState = 'playing';
    for (final action in const ['pause', 'stop']) {
      try {
        session.setActionHandler(action, onStop);
      } catch (_) {}
    }
  } catch (_) {
    // media session is best-effort
  }
}

/// `generateNoiseBuffer(ctx, type)`: [length] samples of white, pink (Paul Kellet) or brown noise in [-1, 1]-ish.
Float32List generateNoiseSamples(String type, int length, {math.Random? random}) {
  final rnd = random ?? math.Random();
  final data = Float32List(length);
  if (type == 'pink') {
    var b0 = 0.0, b1 = 0.0, b2 = 0.0, b3 = 0.0, b4 = 0.0, b5 = 0.0, b6 = 0.0;
    for (var i = 0; i < length; i++) {
      final white = rnd.nextDouble() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else if (type == 'brown') {
    var last = 0.0;
    for (var i = 0; i < length; i++) {
      final white = rnd.nextDouble() * 2 - 1;
      last = (last + (0.02 * white)) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    for (var i = 0; i < length; i++) {
      data[i] = rnd.nextDouble() * 2 - 1;
    }
  }
  return data;
}

/// Mono 16-bit PCM WAV of [samples] (clamped), what a file player loops for a generated noise.
Uint8List encodeWav16(Float32List samples, int sampleRate) {
  final dataBytes = samples.length * 2;
  final out = ByteData(44 + dataBytes);
  void ascii(int offset, String s) {
    for (var i = 0; i < s.length; i++) {
      out.setUint8(offset + i, s.codeUnitAt(i));
    }
  }

  ascii(0, 'RIFF');
  out.setUint32(4, 36 + dataBytes, Endian.little);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  out.setUint32(16, 16, Endian.little);
  out.setUint16(20, 1, Endian.little);
  out.setUint16(22, 1, Endian.little);
  out.setUint32(24, sampleRate, Endian.little);
  out.setUint32(28, sampleRate * 2, Endian.little);
  out.setUint16(32, 2, Endian.little);
  out.setUint16(34, 16, Endian.little);
  ascii(36, 'data');
  out.setUint32(40, dataBytes, Endian.little);
  for (var i = 0; i < samples.length; i++) {
    final v = samples[i].clamp(-1.0, 1.0);
    out.setInt16(44 + i * 2, (v * 32767).round(), Endian.little);
  }
  return out.buffer.asUint8List();
}

/// One looping playback (a `just_audio` player).
abstract interface class NoisePlayer {
  Future<void> play();
  void setVolume(double volume);

  /// Pauses and releases the decoder / network buffer.
  Future<void> dispose();

  /// Registers the load-error callback (`audio.addEventListener('error', …, { once: true })`).
  void onError(void Function() callback);
}

/// Creates players and exposes the platform audio session controls.
abstract interface class NoisePlayerBackend {
  /// 'ios' | 'android' | 'web'.
  String get platform;
  NoisePlayer url(String url);
  NoisePlayer bytes(Uint8List wav);
  AudioSessionControl? get audioSession;
  MediaSessionControl? get mediaSession;
}

/// The store's audio engine over a [NoisePlayerBackend]. Volume is the player volume (a native player honours it on
/// iOS too, so the web GainNode routing is not needed). A streamed file that fails to load is replayed once with a
/// fresh player instead of staying silent.
class BackendWhiteNoiseAudio implements WhiteNoiseAudio {
  BackendWhiteNoiseAudio(this.backend, {this.onRemoteStop, this.sampleRate = 8000, math.Random? random}) : _random = random ?? math.Random();

  final NoisePlayerBackend backend;

  /// Lock-screen pause / stop (`() => get().stop()`): the wiring points it at the store's stop.
  void Function()? onRemoteStop;
  final int sampleRate;
  final math.Random _random;

  NoisePlayer? _player;
  double _gain = 0;

  /// The current player (tests).
  NoisePlayer? get player => _player;

  @override
  void play(WhiteNoiseSound sound, double gain) {
    _release();
    _gain = gain;
    setAudioSessionType('playback', backend.audioSession);
    setMediaSession(MediaSessionInfo(title: sound.name, artist: 'Anacan'), () => onRemoteStop?.call(), backend.mediaSession);
    final url = sound.audioUrl;
    final NoisePlayer player;
    if (url != null && url.isNotEmpty) {
      player = backend.url(url);
      player.onError(() {
        if (!identical(_player, player)) return;
        final plain = backend.url(url);
        plain.setVolume(_gain);
        plain.play().catchError((Object _) {});
        _player = plain;
        player.dispose().catchError((Object _) {});
      });
    } else {
      player = backend.bytes(encodeWav16(generateNoiseSamples(sound.noiseType, sampleRate * 4, random: _random), sampleRate));
    }
    _player = player;
    player.setVolume(gain);
    player.play().catchError((Object _) {});
  }

  void _release() {
    final p = _player;
    _player = null;
    p?.dispose().catchError((Object _) {});
  }

  @override
  void stop() {
    _release();
    setAudioSessionType('auto', backend.audioSession);
    setMediaSession(null, () {}, backend.mediaSession);
  }

  @override
  void setGain(double gain) {
    _gain = gain;
    _player?.setVolume(gain);
  }
}

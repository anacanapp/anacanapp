// Ported from: src/store/whiteNoiseStore.ts (generateNoiseBuffer: 4 s white / pink / brown noise, looped; streamed
//              sounds looped; gain = effectiveGain), src/lib/white-noise-audio.ts (playback session),
//              src/components/recap/RecapScreen.tsx (`<audio src={RECAP_MUSIC_URL}>`), src/lib/word-garden/audio.ts
//              (createGardenAudio: sine tones 0.09 s apart, 0.18 s exponential decay, gain 0.025 for letters, 0.055
//              otherwise)
//
// just_audio players for the three playback seams. The Capacitor AppDelegate put the whole app in the playback
// audio-session category (silent switch ignored, `audio` background mode); [ensurePlaybackSession] does the same
// through audio_session before anything plays.
import 'dart:async';
import 'dart:io' show File;
import 'dart:math' as math;

import 'package:audio_session/audio_session.dart';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';

import '../../features/games/ui_common/game_env.dart' show GameTonePlayer, gardenToneFrequencies;
import '../../features/recap/recap_audio.dart' show RecapAudio;
import '../../features/recap/recap_export.dart' show recapMusicAsset;
import '../../state/white_noise_store.dart' show WhiteNoiseAudio, WhiteNoiseSound;

Future<void>? _session;

/// AVAudioSession `.playback` (iOS) / music focus (Android), once.
Future<void> ensurePlaybackSession() => _session ??= AudioSession.instance
    .then((s) => s.configure(const AudioSessionConfiguration.music()))
    .catchError((Object e) => debugPrint('Audio session: $e'));

/// 16-bit mono PCM samples (-1..1) as a WAV file.
Uint8List wavBytes(Float32List samples, {int sampleRate = 44100}) {
  final data = ByteData(44 + samples.length * 2);
  void ascii(int offset, String s) {
    for (var i = 0; i < s.length; i++) {
      data.setUint8(offset + i, s.codeUnitAt(i));
    }
  }

  ascii(0, 'RIFF');
  data.setUint32(4, 36 + samples.length * 2, Endian.little);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  data.setUint32(16, 16, Endian.little);
  data.setUint16(20, 1, Endian.little);
  data.setUint16(22, 1, Endian.little);
  data.setUint32(24, sampleRate, Endian.little);
  data.setUint32(28, sampleRate * 2, Endian.little);
  data.setUint16(32, 2, Endian.little);
  data.setUint16(34, 16, Endian.little);
  ascii(36, 'data');
  data.setUint32(40, samples.length * 2, Endian.little);
  for (var i = 0; i < samples.length; i++) {
    data.setInt16(44 + i * 2, (samples[i].clamp(-1.0, 1.0) * 32767).round(), Endian.little);
  }
  return data.buffer.asUint8List();
}

/// `generateNoiseBuffer(ctx, type)`: 4 seconds of white, pink (Paul Kellet) or brown noise.
Float32List generateNoise(String type, {int sampleRate = 44100, math.Random? random}) {
  final r = random ?? math.Random();
  final length = sampleRate * 4;
  final data = Float32List(length);
  if (type == 'pink') {
    var b0 = 0.0, b1 = 0.0, b2 = 0.0, b3 = 0.0, b4 = 0.0, b5 = 0.0, b6 = 0.0;
    for (var i = 0; i < length; i++) {
      final white = r.nextDouble() * 2 - 1;
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
      final white = r.nextDouble() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  } else {
    for (var i = 0; i < length; i++) {
      data[i] = r.nextDouble() * 2 - 1;
    }
  }
  return data;
}

final Map<String, Future<String>> _wavFiles = {};

/// A generated WAV as a cache file, once per [key] and process.
Future<AudioSource> wavSource(String key, Uint8List Function() build) async {
  final path = await (_wavFiles[key] ??= () async {
    final file = File('${(await getTemporaryDirectory()).path}/anacan-audio-$key.wav');
    await file.writeAsBytes(build(), flush: true);
    return file.path;
  }()
      .catchError((Object e) {
    _wavFiles.remove(key);
    throw e;
  }));
  return AudioSource.file(path);
}

/// White noise: the streamed file or the generated noise, looped, volume = gain.
class JustAudioWhiteNoise implements WhiteNoiseAudio {
  AudioPlayer? _player;

  @override
  void play(WhiteNoiseSound sound, double gain) {
    stop();
    final player = _player = AudioPlayer();
    unawaited(() async {
      try {
        await ensurePlaybackSession();
        final url = sound.audioUrl;
        // One generated 4 s buffer per noise type and process (React generated it per play; it sounds the same).
        final AudioSource source = url != null && url.isNotEmpty
            ? AudioSource.uri(Uri.parse(url))
            : await wavSource('noise-${sound.noiseType}', () => wavBytes(generateNoise(sound.noiseType)));
        await player.setLoopMode(LoopMode.one);
        await player.setVolume(gain);
        await player.setAudioSource(source);
        if (identical(_player, player)) await player.play();
      } catch (e) {
        debugPrint('Audio play failed: $e');
      }
    }());
  }

  @override
  void stop() {
    final player = _player;
    _player = null;
    if (player != null) unawaited(player.dispose().catchError((Object _) {}));
  }

  @override
  void setGain(double gain) => unawaited(_player?.setVolume(gain).catchError((Object _) {}));
}

/// The recap music (`assets/recap/recap-2026.mp3`).
class JustAudioRecapAudio implements RecapAudio {
  JustAudioRecapAudio() {
    _loaded = ensurePlaybackSession().then((_) => _player.setAsset(recapMusicAsset)).then((_) {});
  }
  final AudioPlayer _player = AudioPlayer();
  late final Future<void> _loaded;

  @override
  bool get playing => _player.playing;

  @override
  double get position => _player.position.inMicroseconds / 1e6;

  @override
  set position(double seconds) {
    final at = Duration(microseconds: (seconds * 1e6).round());
    unawaited(_loaded.then((_) => _player.seek(at)).catchError((Object _) {}));
  }

  @override
  set muted(bool value) => unawaited(_player.setVolume(value ? 0 : 1).catchError((Object _) {}));

  @override
  Future<void> play() async {
    await _loaded;
    unawaited(_player.play().catchError((Object _) {}));
  }

  @override
  void pause() => unawaited(_player.pause().catchError((Object _) {}));

  @override
  void dispose() => unawaited(_player.dispose().catchError((Object _) {}));
}

/// The garden tones, rendered to a WAV per kind.
class JustAudioGameTonePlayer implements GameTonePlayer {
  final List<AudioPlayer> _players = [];
  bool _closed = false;

  static Uint8List render(String kind, {int sampleRate = 44100}) {
    final freqs = gardenToneFrequencies(kind);
    final peak = kind == 'letter' ? 0.025 : 0.055;
    const step = 0.09, attack = 0.015, decayEnd = 0.18, stop = 0.2;
    final total = ((step * (freqs.length - 1) + stop) * sampleRate).ceil();
    final out = Float32List(total);
    for (var n = 0; n < freqs.length; n++) {
      final start = (n * step * sampleRate).round();
      final length = (stop * sampleRate).round();
      for (var i = 0; i < length && start + i < total; i++) {
        final t = i / sampleRate;
        // 0 → peak linearly in 15 ms, exponentially to 0.001 at 180 ms, held until the oscillator stops at 200 ms.
        final double envelope;
        if (t < attack) {
          envelope = peak * t / attack;
        } else if (t < decayEnd) {
          envelope = peak * math.pow(0.001 / peak, (t - attack) / (decayEnd - attack));
        } else {
          envelope = 0.001;
        }
        out[start + i] += envelope * math.sin(2 * math.pi * freqs[n] * t);
      }
    }
    return wavBytes(out, sampleRate: sampleRate);
  }

  @override
  void play(String kind, bool enabled) {
    if (!enabled || _closed) return;
    final player = AudioPlayer();
    _players.add(player);
    unawaited(() async {
      try {
        await ensurePlaybackSession();
        await player.setAudioSource(await wavSource('tone-$kind', () => render(kind)));
        await player.play();
      } catch (_) {
        // tones are best-effort
      } finally {
        _players.remove(player);
        await player.dispose();
      }
    }());
  }

  @override
  void close() {
    _closed = true;
    for (final p in List.of(_players)) {
      unawaited(p.dispose().catchError((Object _) {}));
    }
    _players.clear();
  }
}

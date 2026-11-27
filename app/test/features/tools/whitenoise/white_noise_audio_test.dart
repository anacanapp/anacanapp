// Ported from: src/lib/white-noise-audio.test.ts
//
// The helper cases keep their names. The "volume routing" cases test the same guarantees on the native engine
// (BackendWhiteNoiseAudio over a player backend): the slider and mute reach the playing sound, a stream that fails
// to load is replayed instead of staying silent, and Android plays the file at the slider volume.
import 'dart:typed_data';

import 'package:anacan/features/tools/whitenoise/white_noise_audio.dart';
import 'package:anacan/state/white_noise_store.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeSession implements AudioSessionControl {
  @override
  String type = 'auto';
}

class FakeContext implements ResumableAudioContext {
  FakeContext(this.state);
  @override
  final String state;
  int resumes = 0;
  @override
  Future<void> resume() async => resumes++;
}

class FakeElement implements ResumablePlayer {
  FakeElement(this.source);
  @override
  bool paused = true;
  @override
  String? source;
  int plays = 0;
  @override
  Future<void> play() async {
    plays++;
    paused = false;
  }
}

class FakeMediaSession implements MediaSessionControl {
  MediaSessionInfo? meta;
  String state = 'none';
  final Map<String, void Function()?> handlers = {};
  @override
  set metadata(MediaSessionInfo? value) => meta = value;
  @override
  set playbackState(String value) => state = value;
  @override
  void setActionHandler(String action, void Function()? handler) => handlers[action] = handler;
}

class FakePlayer implements NoisePlayer {
  FakePlayer({this.url, this.bytes});
  final String? url;
  final Uint8List? bytes;
  double volume = 1;
  int plays = 0;
  bool disposed = false;
  void Function()? error;
  @override
  Future<void> play() async => plays++;
  @override
  void setVolume(double v) => volume = v;
  @override
  Future<void> dispose() async => disposed = true;
  @override
  void onError(void Function() callback) => error = callback;
}

class FakeBackend implements NoisePlayerBackend {
  FakeBackend(this.platform);
  @override
  final String platform;
  final List<FakePlayer> players = [];
  @override
  final FakeSession audioSession = FakeSession();
  @override
  final FakeMediaSession mediaSession = FakeMediaSession();
  @override
  NoisePlayer url(String url) => _add(FakePlayer(url: url));
  @override
  NoisePlayer bytes(Uint8List wav) => _add(FakePlayer(bytes: wav));
  FakePlayer _add(FakePlayer p) {
    players.add(p);
    return p;
  }
}

const sound = WhiteNoiseSound(id: 'rain', name: 'Rain', emoji: 'r', color: '#000', noiseType: 'white', audioUrl: 'https://cdn.example/rain.mp3');

({ProviderContainer container, FakeBackend backend, BackendWhiteNoiseAudio engine}) setUpStore(String platform) {
  final backend = FakeBackend(platform);
  final engine = BackendWhiteNoiseAudio(backend);
  final container = ProviderContainer(overrides: [whiteNoiseAudioProvider.overrideWithValue(engine)]);
  engine.onRemoteStop = () => container.read(whiteNoiseStoreProvider.notifier).stop();
  addTearDown(container.dispose);
  return (container: container, backend: backend, engine: engine);
}

void main() {
  group('white noise audio helpers', () {
    test('detects iOS (native, iPhone UA, iPadOS desktop UA) and not Android/desktop', () {
      expect(isIOSAudioPlatform('ios'), isTrue);
      expect(isIOSAudioPlatform('android', userAgent: 'iPhone', maxTouchPoints: 5), isFalse);
      expect(isIOSAudioPlatform('web', userAgent: 'Mozilla (iPhone; CPU iPhone OS 17_0)', maxTouchPoints: 5), isTrue);
      expect(isIOSAudioPlatform('web', userAgent: 'Mozilla (Macintosh; Intel Mac OS X)', maxTouchPoints: 5), isTrue);
      expect(isIOSAudioPlatform('web', userAgent: 'Mozilla (Macintosh; Intel Mac OS X)', maxTouchPoints: 0), isFalse);
    });

    test('maps volume and mute to a clamped gain', () {
      expect(effectiveGain(70, false), closeTo(0.7, 1e-9));
      expect(effectiveGain(70, true), 0);
      expect(effectiveGain(150, false), 1);
      expect(effectiveGain(double.nan, false), 0);
    });

    test('sets audioSession type where supported and ignores it elsewhere', () {
      final session = FakeSession();
      setAudioSessionType('playback', session);
      expect(session.type, 'playback');
      expect(() => setAudioSessionType('playback', null), returnsNormally);
    });

    test('resumes an interrupted context and a paused element', () {
      final ctx = FakeContext('interrupted');
      final audio = FakeElement('x');
      resumeIfNeeded(ctx, audio);
      expect(ctx.resumes, 1);
      expect(audio.plays, 1);
      final closed = FakeContext('closed');
      resumeIfNeeded(closed, null);
      expect(closed.resumes, 0);
    });

    test('wires lock screen pause/stop to the stop callback', () {
      final session = FakeMediaSession();
      var stops = 0;
      setMediaSession(const MediaSessionInfo(title: 'Rain', artist: 'Anacan'), () => stops++, session);
      expect(session.state, 'playing');
      session.handlers['pause']?.call();
      expect(stops, 1);
      setMediaSession(null, () => stops++, session);
      expect(session.handlers['pause'], isNull);
    });
  });

  group('white noise store volume routing', () {
    test('on iOS routes a streamed sound through a GainNode and the slider changes the gain', () {
      final s = setUpStore('ios');
      final store = s.container.read(whiteNoiseStoreProvider.notifier);
      store.setVolume(50);
      store.play(sound);
      final player = s.backend.players.single;
      expect(player.url, sound.audioUrl);
      expect(player.volume, closeTo(0.5, 1e-9));
      expect(s.backend.audioSession.type, 'playback');
      store.setVolume(20);
      expect(player.volume, closeTo(0.2, 1e-9));
      store.setMuted(true);
      expect(player.volume, 0);
      store.setMuted(false);
      store.stop();
      expect(player.disposed, isTrue);
      expect(s.backend.audioSession.type, 'auto');
    });

    test('falls back to plain playback when the file cannot be loaded cross-origin', () {
      final s = setUpStore('ios');
      s.container.read(whiteNoiseStoreProvider.notifier).play(sound);
      final routed = s.backend.players.single;
      routed.error?.call();
      final plain = s.backend.players[1];
      expect(plain.url, sound.audioUrl);
      expect(plain.plays, 1);
      expect(s.engine.player, same(plain));
      expect(routed.disposed, isTrue);
    });

    test('keeps plain element playback on Android (no Web Audio for streamed sounds)', () {
      final s = setUpStore('android');
      final store = s.container.read(whiteNoiseStoreProvider.notifier);
      store.setVolume(40);
      store.play(sound);
      expect(s.backend.players, hasLength(1));
      expect(s.backend.players.single.volume, closeTo(0.4, 1e-9));
    });
  });

  group('generated noise', () {
    test('a sound without a file plays 4 s of generated noise as WAV', () {
      final s = setUpStore('android');
      s.container.read(whiteNoiseStoreProvider.notifier).play(const WhiteNoiseSound(id: 'b', name: 'Brown', emoji: 'b', color: '', noiseType: 'brown'));
      final wav = s.backend.players.single.bytes!;
      expect(String.fromCharCodes(wav.sublist(0, 4)), 'RIFF');
      expect(wav.length, 44 + 8000 * 4 * 2);
    });

    test('lock-screen stop stops the store', () {
      final s = setUpStore('ios');
      s.container.read(whiteNoiseStoreProvider.notifier).play(sound);
      expect(s.container.read(whiteNoiseStoreProvider).isPlaying, isTrue);
      s.backend.mediaSession.handlers['stop']?.call();
      expect(s.container.read(whiteNoiseStoreProvider).isPlaying, isFalse);
    });

    test('white, pink and brown samples stay in range', () {
      for (final type in ['white', 'pink', 'brown']) {
        final data = generateNoiseSamples(type, 4000);
        expect(data.every((v) => v.abs() <= 1.5), isTrue, reason: type);
      }
    });
  });
}

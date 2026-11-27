// Ported from: src/lib/audioRecording.test.ts
import 'package:anacan/features/tools/media_common/audio_recording.dart';
import 'package:anacan/features/tools/media_common/media_ports.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';
import 'audio_fakes.dart';

const _permissionTitle = 'Mikrofon icazəsi lazımdır';
const _permissionText = 'Parametrlərdən mikrofon icazəsini aktivləşdirin';
const _errorTitle = 'Mikrofon xətası';
const _unsupported = 'Bu cihazda mikrofonla işləmək dəstəklənmir. Tətbiqi və ya brauzeri yeniləyin.';
const _unavailable = 'Mikrofonu yoxlayın, ondan istifadə edən digər tətbiqləri bağlayın və yenidən cəhd edin.';
const _failed = 'Səsi emal etmək mümkün olmadı. Yenidən cəhd edin.';

void main() {
  setUp(installTestI18n);

  group('microphone acquisition and MIME selection', () {
    test('opens exactly one stream and leaves it live for the caller', () async {
      final world = AudioWorld();
      expect(await openMicrophone(world.platform), same(world.stream));
      expect(world.devices.requests, [true]);
      expect(world.stream.track.stops, 0);
    });

    test('reports unsupported capture when mediaDevices is missing', () {
      final world = AudioWorld();
      const platform = AudioPlatform();
      expect(() => openMicrophone(platform), throwsA(isA<AudioException>().having((e) => e.name, 'name', 'NotSupportedError')));
      expect(world.devices.requests, isEmpty);
    });

    for (final mimeType in ['audio/webm', 'audio/mp4', 'audio/ogg']) {
      test('selects supported $mimeType without reacquiring the microphone', () {
        final world = AudioWorld();
        world.recorders.supported = (type) => type == mimeType;
        final recorder = createAudioRecorder(world.platform, world.stream);
        expect(world.recorders.constructed.single.stream, same(world.stream));
        expect(world.recorders.constructed.single.mimeType, mimeType);
        expect(recorder.mimeType, mimeType);
        expect(world.devices.requests, isEmpty);
      });
    }

    test('prefers cross-platform MP4/AAC when multiple formats are supported', () {
      final world = AudioWorld();
      world.recorders.supported = (_) => true;
      expect(createAudioRecorder(world.platform, world.stream).mimeType, 'audio/mp4;codecs=mp4a.40.2');
    });

    test('honors an explicit allowed format list and its preference order', () {
      final world = AudioWorld();
      world.recorders.supported = (_) => true;
      createAudioRecorder(world.platform, world.stream, ['audio/mp4', 'audio/webm']);
      expect(world.recorders.constructed.single.mimeType, 'audio/mp4');
    });

    for (final supported in ['audio/mp4', 'audio/ogg', null]) {
      test('rejects unsupported WebM instead of falling back to $supported when explicitly restricted', () {
        final world = AudioWorld();
        world.recorders.supported = (type) => type == supported;
        expect(
          () => createAudioRecorder(world.platform, world.stream, ['audio/webm']),
          throwsA(isA<AudioException>().having((e) => e.name, 'name', 'NotSupportedError')),
        );
        expect(world.recorders.constructed, isEmpty);
      });
    }

    test('lets the recorder choose its real default when no candidate is supported', () {
      final world = AudioWorld();
      final recorder = createAudioRecorder(world.platform, world.stream);
      expect(world.recorders.constructed.single.mimeType, isNull);
      expect(recorder.mimeType, 'audio/ogg;codecs=opus');
    });

    test('reports a missing MediaRecorder as unsupported', () {
      final world = AudioWorld();
      final platform = AudioPlatform(mediaDevices: world.devices);
      expect(() => createAudioRecorder(platform, world.stream), throwsA(isA<AudioException>().having((e) => e.name, 'name', 'NotSupportedError')));
    });
  });

  group('recording cleanup', () {
    test('discards recording callbacks before either stop can trigger an upload', () {
      final world = AudioWorld();
      var uploads = 0;
      final recorder = FakeRecorder(world.stream, 'audio/webm')..state = 'recording';
      recorder.onstop = () => uploads++;
      recorder.ondataavailable = (_) {};
      recorder.onerror = (_) {};
      recorder.onStopCall = () => recorder.onstop?.call();
      world.stream.track.onStop = () => recorder.onstop?.call();

      releaseAudioRecording(recorder, world.stream);

      expect(recorder.stops, 1);
      expect(world.stream.track.stops, 1);
      expect(recorder.onstop, isNull);
      expect(recorder.ondataavailable, isNull);
      expect(recorder.onerror, isNull);
      expect(uploads, 0);
    });

    test('releases an acquired stream even when recorder construction never finished', () {
      final world = AudioWorld();
      releaseAudioRecording(null, world.stream);
      expect(world.stream.track.stops, 1);
    });

    test('still releases the stream when a failed recorder throws on stop', () {
      final world = AudioWorld();
      final recorder = FakeRecorder(world.stream, 'audio/webm')..state = 'recording';
      recorder.onStopCall = () => throw const AudioException('InvalidStateError', 'Failed');
      expect(() => releaseAudioRecording(recorder, world.stream), returnsNormally);
      expect(world.stream.track.stops, 1);
    });

    test('does not stop an already inactive recorder again', () {
      final world = AudioWorld();
      final recorder = FakeRecorder(world.stream, 'audio/webm');
      releaseAudioRecording(recorder, world.stream);
      expect(recorder.stops, 0);
      expect(world.stream.track.stops, 1);
    });
  });

  group('localized audio errors', () {
    for (final name in ['NotAllowedError', 'PermissionDeniedError', 'SecurityError']) {
      test('uses permission guidance only for capture denial $name', () {
        expect(
          getAudioErrorToast(AudioException(name, 'Denied')),
          const MediaToastData(title: _permissionTitle, description: _permissionText, destructive: true),
        );
        expect(getAudioErrorToast(AudioException(name, 'Recorder failed'), 'audio').description, _failed);
      });
    }

    for (final name in [
      'NotFoundError',
      'DevicesNotFoundError',
      'NotReadableError',
      'TrackStartError',
      'AbortError',
      'OverconstrainedError',
      'ConstraintNotSatisfiedError',
    ]) {
      test('gives device/busy guidance for $name', () {
        expect(getAudioErrorToast(AudioException(name)).description, _unavailable);
        expect(getAudioErrorToast(AudioException(name)).title, _errorTitle);
      });
    }

    test('distinguishes unsupported audio from permission denial', () {
      expect(getAudioErrorToast(const AudioException('NotSupportedError')).description, _unsupported);
    });

    for (final error in <Object?>[
      null,
      'permission problem',
      Exception('permission problem'),
      const AudioException('TypeError'),
      const AudioException('InvalidStateError'),
    ]) {
      test('does not infer permission denial from an unknown failure: $error', () {
        expect(getAudioErrorToast(error).description, _failed);
      });
    }
  });
}

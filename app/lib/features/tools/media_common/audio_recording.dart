// Ported from: src/lib/audioRecording.ts (openMicrophone, createAudioRecorder, releaseAudioRecording,
//              getAudioErrorToast) and the browser audio APIs CryTranslator.tsx / NoiseMeter.tsx use
//              (navigator.mediaDevices.getUserMedia, MediaRecorder, AudioContext + AnalyserNode,
//              requestAnimationFrame)
//
// The browser APIs are interfaces here ([AudioPlatform]). The default platform has none of them, which is the
// path React takes when the WebView lacks them: the tools show the "unsupported" microphone toast. A native
// adapter (`record` for capture + amplitude, see the report) fills [audioPlatformProvider].
import 'dart:typed_data';

import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/tr.dart';
import '../../../services/native/mobile_host.dart' show isMobileHost;
import '../../../services/native/record_audio.dart' show recordAudioPlatform;
import 'media_ports.dart' show MediaToastData;

/// A DOMException-like failure (`name`: `NotAllowedError`, `NotSupportedError`, `NotReadableError`, …).
class AudioException implements Exception {
  const AudioException(this.name, [this.message = '']);
  final String name;
  final String message;
  @override
  String toString() => 'AudioException($name: $message)';
}

/// `MediaStreamTrack`.
abstract interface class MediaTrack {
  void stop();
}

/// `MediaStream`.
abstract interface class MicStream {
  List<MediaTrack> getTracks();
}

/// `navigator.mediaDevices`.
abstract interface class MediaDevices {
  /// `getUserMedia({ audio: true })`.
  Future<MicStream> getUserMedia({required bool audio});
}

/// `MediaRecorder` instance.
abstract class MediaRecorderLike {
  /// 'inactive' | 'recording' | 'paused'.
  String get state;
  String get mimeType;

  /// `ondataavailable` (the chunk bytes; React reads `e.data`).
  void Function(Uint8List data)? ondataavailable;
  void Function()? onstop;
  void Function(Object? event)? onerror;
  void start([int? timeslice]);
  void stop();
}

/// The `MediaRecorder` constructor (`isTypeSupported`, `new MediaRecorder(stream, options)`).
abstract interface class MediaRecorderApi {
  bool isTypeSupported(String type);
  MediaRecorderLike create(MicStream stream, {String? mimeType});
}

/// `AnalyserNode`.
abstract interface class AudioAnalyser {
  int get frequencyBinCount;
  set fftSize(int value);
  set smoothingTimeConstant(double value);
  void getByteFrequencyData(Uint8List out);
  void getFloatTimeDomainData(Float32List out);
}

/// `MediaStreamAudioSourceNode`.
abstract interface class AudioSourceNode {
  void connect(AudioAnalyser analyser);
}

/// `AudioContext`.
abstract interface class AudioContextLike {
  AudioSourceNode createMediaStreamSource(MicStream stream);
  AudioAnalyser createAnalyser();
  Future<void> close();
}

/// `requestAnimationFrame` / `cancelAnimationFrame`.
abstract interface class FrameScheduler {
  int request(void Function() callback);
  void cancel(int id);
}

/// Frame callbacks of the Flutter scheduler.
class SchedulerFrames implements FrameScheduler {
  const SchedulerFrames();
  @override
  int request(void Function() callback) => SchedulerBinding.instance.scheduleFrameCallback((_) => callback());
  @override
  void cancel(int id) => SchedulerBinding.instance.cancelFrameCallbackWithId(id);
}

/// The browser audio surface. A null member is "undefined" in the WebView.
class AudioPlatform {
  const AudioPlatform({this.mediaDevices, this.mediaRecorder, this.audioContext, this.frames = const SchedulerFrames()});

  /// `navigator.mediaDevices` (null: no getUserMedia).
  final MediaDevices? mediaDevices;

  /// `MediaRecorder` (null: `typeof MediaRecorder === 'undefined'`).
  final MediaRecorderApi? mediaRecorder;

  /// `new AudioContext()` (null: `typeof AudioContext === 'undefined'`).
  final AudioContextLike Function()? audioContext;
  final FrameScheduler frames;
}

/// Inside the app: the `record` plugin (services/native/record_audio.dart). Elsewhere every capture path reports
/// `NotSupportedError`.
final audioPlatformProvider = Provider<AudioPlatform>((ref) => isMobileHost ? recordAudioPlatform : const AudioPlatform());

bool _microphoneOpening = false;

/// `openMicrophone()`: one getUserMedia request at a time; the stream stays live for the caller.
/// Throws synchronously when capture is unavailable.
Future<MicStream> openMicrophone(AudioPlatform platform) {
  final devices = platform.mediaDevices;
  if (devices == null) throw const AudioException('NotSupportedError', 'Microphone capture is unavailable');
  if (_microphoneOpening) return Future.error(const AudioException('NotReadableError', 'A microphone permission request is already pending'));
  _microphoneOpening = true;
  try {
    return devices.getUserMedia(audio: true).whenComplete(() => _microphoneOpening = false);
  } catch (_) {
    _microphoneOpening = false;
    rethrow;
  }
}

/// Default preference: cross-platform MP4/AAC first (Chromium may otherwise put Opus in plain MP4).
const List<String> kRecordingMimeCandidates = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm', 'audio/ogg'];

/// `createAudioRecorder(stream, allowedMimeTypes)`.
MediaRecorderLike createAudioRecorder(AudioPlatform platform, MicStream stream, [List<String>? allowedMimeTypes]) {
  final api = platform.mediaRecorder;
  if (api == null) throw const AudioException('NotSupportedError', 'Audio recording is unavailable');
  String? mimeType;
  for (final type in allowedMimeTypes ?? kRecordingMimeCandidates) {
    if (api.isTypeSupported(type)) {
      mimeType = type;
      break;
    }
  }
  if (allowedMimeTypes != null && mimeType == null) {
    throw const AudioException('NotSupportedError', 'No allowed audio recording format is supported');
  }
  return api.create(stream, mimeType: mimeType);
}

/// `releaseAudioRecording(recorder, stream)`: drops the callbacks first (stopping tracks can queue a stop
/// event), stops a live recorder (a failing stop never keeps the microphone), then stops every track.
void releaseAudioRecording(MediaRecorderLike? recorder, MicStream? stream) {
  if (recorder != null) {
    recorder.ondataavailable = null;
    recorder.onstop = null;
    recorder.onerror = null;
    try {
      if (recorder.state != 'inactive') recorder.stop();
    } catch (_) {
      // A failed recorder must not prevent releasing the microphone.
    }
  }
  for (final track in stream?.getTracks() ?? const <MediaTrack>[]) {
    try {
      track.stop();
    } catch (_) {
      // Release every remaining track.
    }
  }
}

/// The `name` of a DOMException-like error ('' for anything else).
String audioErrorName(Object? error) => error is AudioException ? error.name : '';

/// `getAudioErrorToast(error, source)`.
MediaToastData getAudioErrorToast(Object? error, [String source = 'microphone']) {
  final name = audioErrorName(error);
  if (source == 'microphone' && const ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].contains(name)) {
    return MediaToastData(
      title: tr('crytranslator_mikrofon_icazesi_lazimdir_711293', 'Mikrofon icazəsi lazımdır'),
      description: tr('crytranslator_parametrlerden_mikrofon_icazesini_aktivl_f7008f', 'Parametrlərdən mikrofon icazəsini aktivləşdirin'),
      destructive: true,
    );
  }
  final String description;
  if (name == 'NotSupportedError') {
    description = tr('audio_recording_unsupported', 'Bu cihazda mikrofonla işləmək dəstəklənmir. Tətbiqi və ya brauzeri yeniləyin.');
  } else if (const [
    'NotFoundError',
    'DevicesNotFoundError',
    'NotReadableError',
    'TrackStartError',
    'AbortError',
    'OverconstrainedError',
    'ConstraintNotSatisfiedError',
  ].contains(name)) {
    description = tr('audio_microphone_unavailable', 'Mikrofonu yoxlayın, ondan istifadə edən digər tətbiqləri bağlayın və yenidən cəhd edin.');
  } else {
    description = tr('audio_recording_failed', 'Səsi emal etmək mümkün olmadı. Yenidən cəhd edin.');
  }
  return MediaToastData(title: tr('crytranslator_mikrofon_xetasi_5f83b3', 'Mikrofon xətası'), description: description, destructive: true);
}

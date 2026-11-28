// Ported from: the browser audio APIs the WebView build used through src/lib/audioRecording.ts —
//              getUserMedia({ audio: true }) (echo cancellation, noise suppression and auto gain on, the browser
//              defaults), MediaRecorder (audio/mp4 = AAC in MP4), AudioContext + AnalyserNode (fftSize, smoothing
//              0.8, getByteFrequencyData with minDecibels -100 / maxDecibels -30, getFloatTimeDomainData) — and
//              VoiceMessage's recording (src/components/chat, MediaRecorder → Blob)
//
// [AudioPlatform] and [ChatAudioRecorder] on the `record` plugin. One AudioRecorder per microphone stream. The
// analyser reads live PCM while nothing records (noise meter); while a recording runs (cry analysis) the plugin
// cannot also stream PCM, so the analyser follows the recorder's level (amplitude in dBFS).
import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

import '../../features/chat/data/chat.dart' show ChatMediaFile;
import '../../features/chat/platform/chat_audio.dart';
import '../../features/tools/media_common/audio_recording.dart';

const int _sampleRate = 44100;

RecordConfig _config(AudioEncoder encoder) => RecordConfig(
      encoder: encoder,
      sampleRate: _sampleRate,
      numChannels: 1,
      autoGain: true,
      echoCancel: true,
      noiseSuppress: true,
    );

Future<String> _tempPath(String ext) async {
  final dir = await getTemporaryDirectory();
  return '${dir.path}/anacan-rec-${DateTime.now().microsecondsSinceEpoch}.$ext';
}

/// One microphone capture (`MediaStream`): the recorder, the live samples and the latest level.
class RecordMicStream implements MicStream, MediaTrack {
  RecordMicStream(this.recorder);
  final AudioRecorder recorder;

  /// The last 32768 samples (-1..1) of the live PCM stream.
  final Float32List _ring = Float32List(32768);
  int _written = 0;
  double _levelDb = -160;
  bool _stopped = false;
  bool _recordingFile = false;
  bool _pcmRequested = false;
  StreamSubscription<Uint8List>? _pcm;
  StreamSubscription<Amplitude>? _amplitude;
  Future<void> _chain = Future<void>.value();

  bool get stopped => _stopped;
  bool get recordingFile => _recordingFile;
  double get levelDb => _levelDb;

  /// Serialises the plugin calls (start / stop / dispose never overlap).
  Future<T> _serial<T>(Future<T> Function() work) {
    final run = _chain.then((_) => work());
    _chain = run.then((_) {}, onError: (Object _) {});
    return run;
  }

  void _addPcm(Uint8List bytes) {
    final data = ByteData.sublistView(bytes);
    for (var i = 0; i + 1 < bytes.length; i += 2) {
      _ring[_written % _ring.length] = data.getInt16(i, Endian.little) / 32768;
      _written++;
    }
  }

  /// Starts the PCM stream for the analyser when nothing records yet.
  void ensureLevelSource() {
    if (_stopped || _recordingFile || _pcmRequested) return;
    _pcmRequested = true;
    unawaited(_serial(() async {
      if (_stopped || _recordingFile) return;
      final stream = await recorder.startStream(_config(AudioEncoder.pcm16bits));
      _pcm = stream.listen(_addPcm, onError: (Object _) {});
    }).catchError((Object _) {}));
  }

  /// Copies the newest samples into [out] (zeros before the first sample).
  void latestSamples(Float32List out) {
    final n = out.length;
    for (var i = 0; i < n; i++) {
      final index = _written - n + i;
      out[i] = index < 0 ? 0 : _ring[index % _ring.length];
    }
  }

  bool get hasPcm => _written > 0 && !_recordingFile;

  /// Stops the PCM stream and records [encoder] to a file.
  Future<String> startFile(AudioEncoder encoder, String ext) => _serial(() async {
        if (_stopped) throw const AudioException('InvalidStateError', 'The microphone was released');
        _recordingFile = true;
        await _pcm?.cancel();
        _pcm = null;
        if (await recorder.isRecording()) await recorder.stop();
        final path = await _tempPath(ext);
        await recorder.start(_config(encoder), path: path);
        _amplitude = recorder.onAmplitudeChanged(const Duration(milliseconds: 50)).listen((a) => _levelDb = a.current);
        return path;
      });

  /// Stops the file recording and returns its bytes (the file is deleted).
  Future<Uint8List?> stopFile() => _serial(() async {
        await _amplitude?.cancel();
        _amplitude = null;
        final path = await recorder.stop();
        _recordingFile = false;
        if (path == null) return null;
        final file = File(path);
        try {
          return await file.readAsBytes();
        } finally {
          unawaited(file.delete().then((_) {}, onError: (Object _) {}));
        }
      });

  @override
  List<MediaTrack> getTracks() => [this];

  /// `track.stop()`: releases the microphone.
  @override
  void stop() {
    if (_stopped) return;
    _stopped = true;
    unawaited(_serial(() async {
      await _pcm?.cancel();
      await _amplitude?.cancel();
      _pcm = null;
      _amplitude = null;
      try {
        await recorder.cancel();
      } catch (_) {}
      await recorder.dispose();
    }).catchError((Object _) {}));
  }
}

/// `navigator.mediaDevices`: the microphone permission is the plugin's.
class RecordMediaDevices implements MediaDevices {
  const RecordMediaDevices();
  @override
  Future<MicStream> getUserMedia({required bool audio}) async {
    final recorder = AudioRecorder();
    bool allowed;
    try {
      allowed = await recorder.hasPermission();
    } catch (e) {
      await recorder.dispose();
      throw AudioException('NotReadableError', '$e');
    }
    if (!allowed) {
      await recorder.dispose();
      throw const AudioException('NotAllowedError', 'Permission denied');
    }
    return RecordMicStream(recorder);
  }
}

/// `MediaRecorder` for AAC in MP4 (`audio/mp4`), the format both platforms encode natively.
class RecordMediaRecorderApi implements MediaRecorderApi {
  const RecordMediaRecorderApi();
  @override
  bool isTypeSupported(String type) => type == 'audio/mp4' || type == 'audio/mp4;codecs=mp4a.40.2';
  @override
  MediaRecorderLike create(MicStream stream, {String? mimeType}) {
    if (stream is! RecordMicStream) throw const AudioException('NotSupportedError', 'Unknown stream');
    return RecordMediaRecorder(stream, mimeType ?? 'audio/mp4');
  }
}

class RecordMediaRecorder extends MediaRecorderLike {
  RecordMediaRecorder(this._stream, this._mimeType);
  final RecordMicStream _stream;
  final String _mimeType;
  String _state = 'inactive';

  @override
  String get state => _state;
  @override
  String get mimeType => _mimeType;

  void _fail(Object error) {
    _state = 'inactive';
    final handler = onerror;
    if (handler != null) handler(error is AudioException ? error : AudioException('NotReadableError', '$error'));
  }

  @override
  void start([int? timeslice]) {
    if (_state != 'inactive') throw const AudioException('InvalidStateError', 'Already recording');
    _state = 'recording';
    unawaited(_stream.startFile(AudioEncoder.aacLc, 'm4a').then((_) {}, onError: _fail));
  }

  /// One `dataavailable` with the whole recording, then `stop`.
  @override
  void stop() {
    if (_state == 'inactive') return;
    _state = 'inactive';
    unawaited(_stream.stopFile().then((bytes) {
      if (bytes != null && bytes.isNotEmpty) ondataavailable?.call(bytes);
      onstop?.call();
    }, onError: _fail));
  }
}

/// `AnalyserNode` over the stream's live samples (or its level while a recording runs).
class RecordAnalyser implements AudioAnalyser {
  RecordMicStream? stream;
  int _fftSize = 2048;
  double _smoothing = 0.8;
  Float32List _previous = Float32List(1024);

  static const double _minDecibels = -100;
  static const double _maxDecibels = -30;

  @override
  int get frequencyBinCount => _fftSize ~/ 2;

  @override
  set fftSize(int value) {
    _fftSize = value;
    _previous = Float32List(value ~/ 2);
  }

  @override
  set smoothingTimeConstant(double value) => _smoothing = value;

  @override
  void getFloatTimeDomainData(Float32List out) {
    final s = stream;
    if (s == null) return out.fillRange(0, out.length, 0);
    s.ensureLevelSource();
    if (s.hasPcm) return s.latestSamples(out);
    // Level only: a constant signal whose RMS is the recorder's level.
    final value = s.levelDb <= -160 ? 0.0 : math.pow(10, s.levelDb / 20).toDouble();
    out.fillRange(0, out.length, value);
  }

  @override
  void getByteFrequencyData(Uint8List out) {
    final s = stream;
    if (s == null) return out.fillRange(0, out.length, 0);
    s.ensureLevelSource();
    if (!s.hasPcm) {
      out.fillRange(0, out.length, _byte(s.levelDb));
      return;
    }
    final n = _fftSize;
    final samples = Float32List(n);
    s.latestSamples(samples);
    // Blackman window, magnitude / N, smoothing over time, dB, scaled to 0..255 (Web Audio's AnalyserNode).
    for (var i = 0; i < n; i++) {
      final a = 2 * math.pi * i / (n - 1);
      samples[i] *= 0.42 - 0.5 * math.cos(a) + 0.08 * math.cos(2 * a);
    }
    final bins = math.min(out.length, n ~/ 2);
    for (var k = 0; k < bins; k++) {
      var re = 0.0, im = 0.0;
      final w = -2 * math.pi * k / n;
      for (var i = 0; i < n; i++) {
        re += samples[i] * math.cos(w * i);
        im += samples[i] * math.sin(w * i);
      }
      final magnitude = math.sqrt(re * re + im * im) / n;
      final smoothed = _smoothing * _previous[k] + (1 - _smoothing) * magnitude;
      _previous[k] = smoothed;
      out[k] = _byte(smoothed <= 0 ? -1000 : 20 * math.log(smoothed) / math.ln10);
    }
  }

  static int _byte(double db) => (255 * (db - _minDecibels) / (_maxDecibels - _minDecibels)).clamp(0, 255).floor();
}

class _RecordSource implements AudioSourceNode {
  _RecordSource(this.stream);
  final RecordMicStream stream;
  @override
  void connect(AudioAnalyser analyser) {
    if (analyser is RecordAnalyser) analyser.stream = stream;
  }
}

/// `AudioContext`: analysis only (no output graph).
class RecordAudioContext implements AudioContextLike {
  @override
  AudioSourceNode createMediaStreamSource(MicStream stream) {
    if (stream is! RecordMicStream) throw const AudioException('NotSupportedError', 'Unknown stream');
    return _RecordSource(stream);
  }

  @override
  AudioAnalyser createAnalyser() => RecordAnalyser();

  @override
  Future<void> close() async {}
}

/// The audio surface of the app build.
const AudioPlatform recordAudioPlatform = AudioPlatform(
  mediaDevices: RecordMediaDevices(),
  mediaRecorder: RecordMediaRecorderApi(),
  audioContext: RecordAudioContext.new,
);

/// Voice messages: AAC in MP4 (`audio/mp4`).
class RecordChatAudioRecorder implements ChatAudioRecorder {
  RecordMicStream? _stream;

  @override
  Future<void> open() async {
    try {
      _stream = await const RecordMediaDevices().getUserMedia(audio: true) as RecordMicStream;
    } on AudioException catch (e) {
      throw ChatAudioException(e.name, e.message);
    }
  }

  @override
  Future<void> start() async {
    final stream = _stream;
    if (stream == null) throw const ChatAudioException('InvalidStateError', 'Microphone is not open');
    try {
      await stream.startFile(AudioEncoder.aacLc, 'm4a');
    } on AudioException catch (e) {
      throw ChatAudioException(e.name, e.message);
    } catch (e) {
      throw ChatAudioException('NotReadableError', '$e');
    }
  }

  @override
  Future<ChatMediaFile?> stop() async {
    final stream = _stream;
    if (stream == null || !stream.recordingFile) return null;
    try {
      final bytes = await stream.stopFile();
      if (bytes == null || bytes.isEmpty) return null;
      return ChatMediaFile(bytes, 'audio/mp4');
    } catch (e) {
      throw ChatAudioException('NotReadableError', '$e');
    } finally {
      stream.stop();
      _stream = null;
    }
  }

  @override
  Future<void> release() async {
    _stream?.stop();
    _stream = null;
  }
}

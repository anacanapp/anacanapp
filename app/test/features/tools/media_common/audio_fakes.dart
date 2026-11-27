// Ported from: (test doubles of the browser audio APIs the vitest suites stub: navigator.mediaDevices.getUserMedia,
//              MediaRecorder, AudioContext / AnalyserNode, requestAnimationFrame)
import 'dart:async';
import 'dart:typed_data';

import 'package:anacan/features/tools/media_common/audio_recording.dart';

class FakeTrack implements MediaTrack {
  int stops = 0;
  void Function()? onStop;
  @override
  void stop() {
    stops++;
    onStop?.call();
  }
}

class FakeStream implements MicStream {
  FakeStream([FakeTrack? track]) : track = track ?? FakeTrack();
  final FakeTrack track;
  @override
  List<MediaTrack> getTracks() => [track];
}

class FakeMediaDevices implements MediaDevices {
  FakeMediaDevices(this.stream);
  MicStream stream;
  final List<bool> requests = [];

  /// Replaces the answer (a pending grant, a rejection).
  Future<MicStream> Function()? answer;

  @override
  Future<MicStream> getUserMedia({required bool audio}) {
    requests.add(audio);
    return answer?.call() ?? Future.value(stream);
  }
}

class FakeRecorder extends MediaRecorderLike {
  FakeRecorder(this.stream, this.mimeType);
  final MicStream stream;
  @override
  String mimeType;
  @override
  String state = 'inactive';
  int starts = 0;
  int stops = 0;
  void Function()? onStart;
  void Function()? onStopCall;

  @override
  void start([int? timeslice]) {
    onStart?.call();
    starts++;
    state = 'recording';
  }

  @override
  void stop() {
    stops++;
    if (onStopCall != null) {
      onStopCall!();
      return;
    }
    state = 'inactive';
  }

  /// Delivers a chunk and the stop event (MockMediaRecorder.finish).
  void finish([List<int> bytes = const [0x63, 0x72, 0x79]]) {
    ondataavailable?.call(Uint8List.fromList(bytes));
    onstop?.call();
  }
}

class FakeRecorderApi implements MediaRecorderApi {
  bool Function(String type) supported = (_) => false;
  final List<({MicStream stream, String? mimeType})> constructed = [];
  final List<FakeRecorder> instances = [];

  /// `MockMediaRecorder` reports this instead of the requested type when set.
  String? reportedMimeType;

  /// Throws inside the constructor (e.g. a SecurityError) once.
  Object? failNextConstruct;
  Object? failNextStart;

  @override
  bool isTypeSupported(String type) => supported(type);

  @override
  MediaRecorderLike create(MicStream stream, {String? mimeType}) {
    final fail = failNextConstruct;
    if (fail != null) {
      failNextConstruct = null;
      throw fail;
    }
    constructed.add((stream: stream, mimeType: mimeType));
    final r = FakeRecorder(stream, reportedMimeType ?? mimeType ?? 'audio/ogg;codecs=opus');
    final startFail = failNextStart;
    if (startFail != null) {
      failNextStart = null;
      r.onStart = () => throw startFail;
    }
    instances.add(r);
    return r;
  }
}

class FakeAnalyser implements AudioAnalyser {
  FakeAnalyser({this.bins = 4, this.amplitude = 0});
  final int bins;
  double amplitude;
  @override
  int get frequencyBinCount => bins;
  @override
  set fftSize(int value) {}
  @override
  set smoothingTimeConstant(double value) {}
  @override
  void getByteFrequencyData(Uint8List out) {}
  @override
  void getFloatTimeDomainData(Float32List out) => out.fillRange(0, out.length, amplitude);
}

class FakeSource implements AudioSourceNode {
  @override
  void connect(AudioAnalyser analyser) {}
}

class FakeAudioContext implements AudioContextLike {
  FakeAudioContext(this.analyser);
  final FakeAnalyser analyser;
  int closes = 0;
  final List<MicStream> sources = [];
  Object? failSource;

  @override
  AudioSourceNode createMediaStreamSource(MicStream stream) {
    final fail = failSource;
    if (fail != null) {
      failSource = null;
      throw fail;
    }
    sources.add(stream);
    return FakeSource();
  }

  @override
  AudioAnalyser createAnalyser() => analyser;

  @override
  Future<void> close() async => closes++;
}

/// `requestAnimationFrame` stub: returns a fixed id and never calls back.
class FakeFrames implements FrameScheduler {
  FakeFrames(this.id);
  final int id;
  final List<int> cancelled = [];
  int requests = 0;
  @override
  int request(void Function() callback) {
    requests++;
    return id;
  }

  @override
  void cancel(int id) => cancelled.add(id);
}

/// The whole stubbed browser surface of one test.
class AudioWorld {
  AudioWorld({int frameId = 0, double amplitude = 0}) : frames = FakeFrames(frameId) {
    analyser = FakeAnalyser(amplitude: amplitude);
    context = FakeAudioContext(analyser);
    devices = FakeMediaDevices(stream);
  }

  final FakeStream stream = FakeStream();
  late final FakeMediaDevices devices;
  final FakeRecorderApi recorders = FakeRecorderApi();
  late final FakeAnalyser analyser;
  late final FakeAudioContext context;
  final FakeFrames frames;
  int contextConstructions = 0;
  Object? failNextContext;
  bool hasAudioContext = true;

  AudioPlatform get platform => AudioPlatform(
    mediaDevices: devices,
    mediaRecorder: recorders,
    audioContext: hasAudioContext
        ? () {
            final fail = failNextContext;
            if (fail != null) {
              failNextContext = null;
              throw fail;
            }
            contextConstructions++;
            return context;
          }
        : null,
    frames: frames,
  );

  /// A pending getUserMedia; complete it with [stream].
  Completer<MicStream> pendingGrant() {
    final c = Completer<MicStream>();
    devices.answer = () => c.future;
    return c;
  }
}

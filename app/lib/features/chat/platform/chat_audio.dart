// Ported from: src/lib/audioRecording.ts (openMicrophone / createAudioRecorder / releaseAudioRecording as an
//              interface, getAudioErrorToast), the HTMLAudioElement API VoiceMessage.tsx uses
//
// Voice recording needs a recorder plugin (`record`) that is not in pubspec yet: [chatAudioRecorderProvider]
// defaults to [UnavailableChatAudioRecorder] (the composer shows the "unsupported" microphone toast, like a
// WebView without MediaRecorder). Playback defaults to [VideoPlayerChatAudioPlayer] (video_player, already a
// dependency, plays m4a/mp3/ogg; webm only where the platform decoder has it); a `just_audio` player can replace it.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../../core/i18n/i18n.dart';
import '../../../services/native/mobile_host.dart' show isMobileHost;
import '../../../services/native/record_audio.dart' show RecordChatAudioRecorder;
import '../data/chat.dart' show ChatMediaFile;
import '../data/partner_messages.dart' show ChatToast;

/// A DOMException-like failure: [name] is `NotAllowedError`, `NotSupportedError`, `NotFoundError`, …
class ChatAudioException implements Exception {
  const ChatAudioException(this.name, [this.message = '']);
  final String name;
  final String message;
  @override
  String toString() => 'ChatAudioException($name: $message)';
}

/// `getAudioErrorToast(error, source)`.
ChatToast getAudioErrorToast(Object? error, {String source = 'microphone'}) {
  final name = error is ChatAudioException ? error.name : '';
  if (source == 'microphone' && const ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].contains(name)) {
    return ChatToast(
      title: tr('crytranslator_mikrofon_icazesi_lazimdir_711293', 'Mikrofon icazəsi lazımdır'),
      description: tr('crytranslator_parametrlerden_mikrofon_icazesini_aktivl_f7008f', 'Parametrlərdən mikrofon icazəsini aktivləşdirin'),
      destructive: true,
    );
  }
  final String description;
  if (name == 'NotSupportedError') {
    description = tr('audio_recording_unsupported', 'Bu cihazda mikrofonla işləmək dəstəklənmir. Tətbiqi və ya brauzeri yeniləyin.');
  } else if (const ['NotFoundError', 'DevicesNotFoundError', 'NotReadableError', 'TrackStartError', 'AbortError', 'OverconstrainedError',
    'ConstraintNotSatisfiedError'].contains(name)) {
    description = tr('audio_microphone_unavailable', 'Mikrofonu yoxlayın, ondan istifadə edən digər tətbiqləri bağlayın və yenidən cəhd edin.');
  } else {
    description = tr('audio_recording_failed', 'Səsi emal etmək mümkün olmadı. Yenidən cəhd edin.');
  }
  return ChatToast(title: tr('crytranslator_mikrofon_xetasi_5f83b3', 'Mikrofon xətası'), description: description, destructive: true);
}

/// One recording session (`openMicrophone` + `createAudioRecorder` + MediaRecorder).
abstract interface class ChatAudioRecorder {
  /// `openMicrophone()`: permission + capture. Throws [ChatAudioException] (toast source `microphone`).
  Future<void> open();

  /// `createAudioRecorder(stream).start()`. Throws [ChatAudioException] (toast source `audio`).
  Future<void> start();

  /// `recorder.stop()` → the recording (`new Blob(chunks, { type: recorder.mimeType })`), null when nothing was
  /// captured. Throws [ChatAudioException] (source `audio`).
  Future<ChatMediaFile?> stop();

  /// `releaseAudioRecording(recorder, stream)`: discards and frees the microphone. Never throws.
  Future<void> release();
}

/// No recorder plugin: microphone capture is unavailable (`NotSupportedError`).
class UnavailableChatAudioRecorder implements ChatAudioRecorder {
  const UnavailableChatAudioRecorder();
  @override
  Future<void> open() async => throw const ChatAudioException('NotSupportedError', 'Microphone capture is unavailable');
  @override
  Future<void> start() async => throw const ChatAudioException('NotSupportedError', 'Audio recording is unavailable');
  @override
  Future<ChatMediaFile?> stop() async => null;
  @override
  Future<void> release() async {}
}

/// Creates a recorder per recording: the `record` plugin inside the app (services/native/record_audio.dart),
/// unavailable elsewhere.
final chatAudioRecorderProvider = Provider<ChatAudioRecorder Function()>(
    (ref) => isMobileHost ? RecordChatAudioRecorder.new : () => const UnavailableChatAudioRecorder());

/// `<audio>` media events VoiceMessage listens to.
enum ChatAudioEvent { loadedMetadata, durationChange, timeUpdate, play, pause, ended, error }

/// The HTMLAudioElement subset VoiceMessage uses.
abstract interface class ChatAudioPlayer {
  /// `element.src = url; element.load()` (preload metadata).
  Future<void> load(String url);

  /// `element.play()`; throws when the source cannot play (NotSupportedError, expired URL, …).
  Future<void> play();
  Future<void> pause();
  Future<void> seek(Duration position);
  bool get paused;
  bool get ended;

  /// `currentTime` (seconds).
  double get currentTime;

  /// `duration` (seconds; NaN / infinite while unknown).
  double get duration;
  Stream<ChatAudioEvent> get events;
  Future<void> dispose();
}

/// Creates a player per voice message.
final chatAudioPlayerProvider = Provider<ChatAudioPlayer Function()>((ref) => VideoPlayerChatAudioPlayer.new);

/// [ChatAudioPlayer] over video_player (audio-only sources).
class VideoPlayerChatAudioPlayer implements ChatAudioPlayer {
  VideoPlayerController? _controller;
  final StreamController<ChatAudioEvent> _events = StreamController<ChatAudioEvent>.broadcast();
  bool _playing = false, _ended = false, _hadError = false;
  Duration _position = Duration.zero;
  Duration? _duration;
  Future<void>? _initializing;

  @override
  Stream<ChatAudioEvent> get events => _events.stream;
  @override
  bool get paused => !_playing;
  @override
  bool get ended => _ended;
  @override
  double get currentTime => _position.inMilliseconds / 1000;
  @override
  double get duration => _duration == null || _duration == Duration.zero ? double.nan : _duration!.inMilliseconds / 1000;

  void _emit(ChatAudioEvent event) {
    if (!_events.isClosed) _events.add(event);
  }

  void _onValue() {
    final value = _controller?.value;
    if (value == null) return;
    if (value.hasError && !_hadError) {
      _hadError = true;
      _playing = false;
      _emit(ChatAudioEvent.error);
      return;
    }
    if (value.duration != _duration && value.duration > Duration.zero) {
      _duration = value.duration;
      _emit(ChatAudioEvent.durationChange);
    }
    if (value.position != _position) {
      _position = value.position;
      _emit(ChatAudioEvent.timeUpdate);
    }
    final completed = value.isCompleted || (_duration != null && value.position >= _duration! && !value.isPlaying && _playing);
    if (value.isPlaying != _playing) {
      _playing = value.isPlaying;
      if (_playing) {
        _ended = false;
        _emit(ChatAudioEvent.play);
      } else if (completed) {
        _ended = true;
        _emit(ChatAudioEvent.ended);
      } else {
        _emit(ChatAudioEvent.pause);
      }
    }
  }

  @override
  Future<void> load(String url) async {
    final old = _controller;
    old?.removeListener(_onValue);
    unawaited(old?.dispose());
    _hadError = false;
    _ended = false;
    _playing = false;
    _position = Duration.zero;
    final uri = Uri.tryParse(url);
    if (uri == null) {
      _emit(ChatAudioEvent.error);
      return;
    }
    final controller = _controller = VideoPlayerController.networkUrl(uri);
    controller.addListener(_onValue);
    final init = _initializing = controller.initialize();
    try {
      await init;
      if (!identical(controller, _controller)) return;
      _duration = controller.value.duration > Duration.zero ? controller.value.duration : null;
      _emit(ChatAudioEvent.loadedMetadata);
    } catch (error) {
      debugPrint('Voice message load failed');
      if (identical(controller, _controller) && !_hadError) {
        _hadError = true;
        _emit(ChatAudioEvent.error);
      }
    }
  }

  @override
  Future<void> play() async {
    final controller = _controller;
    if (controller == null) throw const _PlaybackError();
    await _initializing;
    if (!controller.value.isInitialized || controller.value.hasError) throw const _PlaybackError();
    if (_ended) await controller.seekTo(Duration.zero);
    await controller.play();
  }

  @override
  Future<void> pause() async => _controller?.pause();

  @override
  Future<void> seek(Duration position) async => _controller?.seekTo(position);

  @override
  Future<void> dispose() async {
    _controller?.removeListener(_onValue);
    await _controller?.dispose();
    _controller = null;
    await _events.close();
  }
}

class _PlaybackError implements Exception {
  const _PlaybackError();
}

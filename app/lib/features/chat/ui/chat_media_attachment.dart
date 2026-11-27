// Ported from: src/components/chat/ChatMediaAttachment.tsx, src/styles/chat.css (.chat-message-media)
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show ALoader, px;
import '../copy/chat_copy.dart';
import '../data/chat.dart' show ChatMediaType;
import 'chat_widgets.dart';
import 'voice_message.dart';

class ChatMediaAttachment extends StatefulWidget {
  const ChatMediaAttachment({super.key, required this.src, required this.type, required this.own, required this.onRenew, required this.onPhoto});
  final String src;
  final ChatMediaType type;
  final bool own;
  final Future<String?> Function() onRenew;
  final ValueChanged<String> onPhoto;

  @override
  State<ChatMediaAttachment> createState() => _ChatMediaAttachmentState();
}

class _ChatMediaAttachmentState extends State<ChatMediaAttachment> {
  late String _url = widget.src;
  bool _failed = false, _loading = false, _automaticRetry = false, _alive = true;
  int _reload = 0;
  final GlobalKey<_ChatVideoState> _video = GlobalKey<_ChatVideoState>();
  Duration _resumeAt = Duration.zero;

  @override
  void didUpdateWidget(ChatMediaAttachment oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.src == widget.src) return;
    final video = _video.currentState;
    if (video != null && video.playing) return;
    _resumeAt = video?.position ?? Duration.zero;
    _url = widget.src;
    _failed = false;
  }

  @override
  void dispose() {
    _alive = false;
    super.dispose();
  }

  void _set(VoidCallback change) {
    if (_alive && mounted) setState(change);
  }

  Future<void> _renew() async {
    if (_loading) return;
    _set(() => _loading = true);
    try {
      final next = await widget.onRenew();
      if (_alive && next != null) {
        _resumeAt = _video.currentState?.position ?? Duration.zero;
        _set(() {
          _url = next;
          _reload++;
          _failed = false;
        });
      }
    } catch (_) {
      // Keep the retry control visible.
    } finally {
      _set(() => _loading = false);
    }
  }

  void _fail() {
    if (!_failed) _set(() => _failed = true);
    if (!_automaticRetry) {
      _automaticRetry = true;
      unawaited(_renew());
    }
  }

  /// Video `onPause`: adopt a newer lease.
  void _paused(Duration position) {
    if (widget.src != _url) {
      _resumeAt = position;
      _set(() => _url = widget.src);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.type == ChatMediaType.audio) return VoiceMessage(src: widget.src, own: widget.own, onRenew: widget.onRenew);
    final media = ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 320),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: widget.type == ChatMediaType.image
            ? Semantics(
                image: true,
                label: chatTr('chat_image', 'Şəkil'),
                child: GestureDetector(
                  onTap: () {
                    if (!_failed) widget.onPhoto(_url);
                  },
                  child: Image.network(
                    _url,
                    key: ValueKey('image-$_reload'),
                    fit: BoxFit.contain,
                    frameBuilder: (context, child, frame, sync) {
                      if (frame != null && _failed) scheduleMicrotask(() => _set(() => _failed = false));
                      return child;
                    },
                    errorBuilder: (context, _, _) {
                      scheduleMicrotask(_fail);
                      return const SizedBox(width: 120, height: 90);
                    },
                  ),
                ),
              )
            : _ChatVideo(key: _video, url: _url, reload: _reload, resumeAt: _resumeAt, onError: _fail, onPaused: _paused),
      ),
    );
    return Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      media,
      if (_failed)
        ChatNotice(
          child: Semantics(
            liveRegion: true,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(chatFollowupText('media_failed')),
              Semantics(
                container: true,
                button: true,
                enabled: !_loading,
                child: GestureDetector(
                  onTap: _loading ? null : () => unawaited(_renew()),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    _loading ? const ALoader(size: 14) : const AIcon(AIcons.rotateCcw, size: 14),
                    const SizedBox(width: 8),
                    Text(chatFollowupText('media_retry'), style: px(12, color: context.a.inkSoft)),
                  ]),
                ),
              ),
            ]),
          ),
        ),
    ]);
  }
}

/// `<video controls playsInline preload="metadata">`: tap toggles playback, a progress bar shows the position.
class _ChatVideo extends StatefulWidget {
  const _ChatVideo({super.key, required this.url, required this.reload, required this.resumeAt, required this.onError, required this.onPaused});
  final String url;
  final int reload;
  final Duration resumeAt;
  final VoidCallback onError;
  final ValueChanged<Duration> onPaused;

  @override
  State<_ChatVideo> createState() => _ChatVideoState();
}

class _ChatVideoState extends State<_ChatVideo> {
  VideoPlayerController? _controller;
  bool _wasPlaying = false, _errored = false;

  bool get playing => _controller?.value.isPlaying ?? false;
  Duration get position => _controller?.value.position ?? Duration.zero;

  @override
  void initState() {
    super.initState();
    _open();
  }

  @override
  void didUpdateWidget(_ChatVideo oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url || oldWidget.reload != widget.reload) _open();
  }

  void _open() {
    final old = _controller;
    old?.removeListener(_changed);
    unawaited(old?.dispose());
    _errored = false;
    _wasPlaying = false;
    final uri = Uri.tryParse(widget.url);
    if (uri == null) {
      _controller = null;
      scheduleMicrotask(widget.onError);
      return;
    }
    final controller = _controller = VideoPlayerController.networkUrl(uri);
    controller.addListener(_changed);
    controller.initialize().then((_) async {
      if (!mounted || !identical(controller, _controller)) return;
      final resume = widget.resumeAt;
      if (resume > Duration.zero) await controller.seekTo(resume < controller.value.duration ? resume : controller.value.duration);
      setState(() {});
    }, onError: (Object _) {
      if (mounted && identical(controller, _controller) && !_errored) {
        _errored = true;
        widget.onError();
      }
    });
  }

  void _changed() {
    final value = _controller?.value;
    if (value == null || !mounted) return;
    if (value.hasError && !_errored) {
      _errored = true;
      widget.onError();
    }
    if (_wasPlaying && !value.isPlaying) widget.onPaused(value.position);
    _wasPlaying = value.isPlaying;
    setState(() {});
  }

  @override
  void dispose() {
    _controller?.removeListener(_changed);
    unawaited(_controller?.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) {
      return Container(width: 220, height: 140, color: const Color(0xFF000000));
    }
    return GestureDetector(
      onTap: () => unawaited(controller.value.isPlaying ? controller.pause() : controller.play()),
      child: AspectRatio(
        aspectRatio: controller.value.aspectRatio,
        child: Stack(alignment: Alignment.center, children: [
          VideoPlayer(controller),
          if (!controller.value.isPlaying)
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(color: Color(0x66000000), shape: BoxShape.circle),
              alignment: Alignment.center,
              child: const AIcon(AIcons.play, size: 22, color: Color(0xFFFFFFFF)),
            ),
          Positioned(left: 0, right: 0, bottom: 0, child: VideoProgressIndicator(controller, allowScrubbing: true)),
        ]),
      ),
    );
  }
}

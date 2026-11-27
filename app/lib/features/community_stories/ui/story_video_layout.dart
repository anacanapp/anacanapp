// Ported from: src/components/community/StoryVideoLayout.tsx
//
// A video story inside its 9:16 frame: framed by the editor scene (position, zoom, rotation, background) with the
// captions painted on top, or `object-contain` for legacy stories without a layout. The `<video>` element is a
// video_player controller owned by this widget; [paused] / [muted] are applied imperatively like the React effects.
import 'dart:async';
import 'dart:io' show File;
import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';

import '../editor/story_painter.dart';
import '../editor/story_scene.dart';

class StoryVideoLayout extends StatefulWidget {
  const StoryVideoLayout({
    super.key,
    required this.src,
    required this.layout,
    this.muted = true,
    this.paused = false,
    this.onDuration,
    this.onEnded,
    this.renderText = true,
    this.loop = false,
    this.onError,
    this.onVideoSize,
    this.localFile = false,
  });

  /// URL, or a local path when [localFile] (the picked file of the editor).
  final String src;
  final Object? layout;
  final bool muted;
  final bool paused;

  /// `onLoadedMetadata` → duration in seconds.
  final void Function(double seconds)? onDuration;
  final VoidCallback? onEnded;
  final bool renderText;
  final bool loop;
  final VoidCallback? onError;

  /// `videoWidth` / `videoHeight` once the metadata loaded.
  final void Function(Size size)? onVideoSize;
  final bool localFile;

  @override
  State<StoryVideoLayout> createState() => _StoryVideoLayoutState();
}

class _StoryVideoLayoutState extends State<StoryVideoLayout> {
  VideoPlayerController? _controller;
  bool _ended = false;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    unawaited(_open());
  }

  Future<void> _open() async {
    final c = widget.localFile ? VideoPlayerController.file(File(widget.src)) : VideoPlayerController.networkUrl(Uri.parse(widget.src));
    _controller = c;
    c.addListener(_onTick);
    try {
      await c.initialize();
    } catch (_) {
      if (mounted) widget.onError?.call();
      return;
    }
    if (!mounted || _controller != c) return;
    await c.setLooping(widget.loop);
    await c.setVolume(widget.muted ? 0 : 1);
    final size = c.value.size;
    widget.onVideoSize?.call(size);
    widget.onDuration?.call(c.value.duration.inMilliseconds / 1000);
    if (!widget.paused) unawaited(c.play().catchError((Object _) {}));
    setState(() => _ready = true);
  }

  void _onTick() {
    final c = _controller;
    if (c == null) return;
    final v = c.value;
    if (v.hasError) {
      widget.onError?.call();
      return;
    }
    final ended = v.isInitialized && !widget.loop && v.duration > Duration.zero && v.position >= v.duration && !v.isPlaying;
    if (ended && !_ended) {
      _ended = true;
      widget.onEnded?.call();
    } else if (!ended) {
      _ended = false;
    }
  }

  @override
  void didUpdateWidget(StoryVideoLayout old) {
    super.didUpdateWidget(old);
    final c = _controller;
    if (c == null || !c.value.isInitialized) return;
    if (old.muted != widget.muted) unawaited(c.setVolume(widget.muted ? 0 : 1));
    if (old.paused != widget.paused) {
      unawaited((widget.paused ? c.pause() : c.play()).catchError((Object _) {}));
    }
  }

  @override
  void dispose() {
    final c = _controller;
    _controller = null;
    if (c != null) {
      c.removeListener(_onTick);
      unawaited(c.pause().catchError((Object _) {}).whenComplete(c.dispose));
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scene = parseStoryScene(widget.layout);
    final c = _controller;
    final ready = _ready && c != null && c.value.isInitialized;
    return LayoutBuilder(builder: (context, constraints) {
      final width = math.min(constraints.maxWidth, constraints.maxHeight * 9 / 16);
      final background = scene != null ? storyColor(scene.background) : const Color(0xFF000000);
      Widget video = ready ? VideoPlayer(c) : const SizedBox.shrink();
      if (scene == null) {
        return ColoredBox(
          color: background,
          child: Center(
            child: ready ? AspectRatio(aspectRatio: c.value.aspectRatio, child: video) : const SizedBox.expand(),
          ),
        );
      }
      final height = width * 16 / 9;
      final box = storyMediaBox(scene);
      video = Positioned(
        left: box.x / kStoryWidth * width - box.width / kStoryWidth * width / 2,
        top: box.y / kStoryHeight * height - box.height / kStoryHeight * height / 2,
        width: box.width / kStoryWidth * width,
        height: box.height / kStoryHeight * height,
        child: Transform.rotate(angle: box.rotation * math.pi / 180, child: video),
      );
      return ColoredBox(
        color: background,
        child: Center(
          child: SizedBox(
            width: width,
            height: height,
            child: ClipRect(
              child: ColoredBox(
                color: background,
                child: Stack(clipBehavior: Clip.hardEdge, children: [
                  video,
                  if (widget.renderText)
                    Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: StoryTextPainter(scene)))),
                ]),
              ),
            ),
          ),
        ),
      );
    });
  }
}

/// The caption layer of a video story (`drawStoryScene(ctx, null, scene, { textOnly: true })`).
class StoryTextPainter extends CustomPainter {
  StoryTextPainter(this.scene);
  final StoryScene scene;

  @override
  void paint(Canvas canvas, Size size) => drawStoryScene(canvas, size, null, scene, textOnly: true);

  @override
  bool shouldRepaint(StoryTextPainter old) => old.scene != scene;
}

// Ported from: src/components/community/MediaCarousel.tsx
//
// Fixed 360 px media box (rounded-2xl, bg-muted/30). One item renders alone; several get a fading slide (200 ms,
// 50 px in the navigation direction, mirrored in RTL), arrows, dots and an "n / N" counter. Images open the in-app
// viewer. Videos create their decoder only when played (the WebView mounted `<video preload="metadata">` near the
// viewport; natively no visibility observer is bundled) and release it when the item leaves.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';

import '../../../design/design.dart';
import 'community_widgets.dart';

class MediaItem {
  const MediaItem({required this.url, required this.video});
  final String url;
  final bool video;
}

/// `getMediaType(url)`: video extensions anywhere in the URL.
bool isVideoUrl(String url) => const ['.mp4', '.webm', '.ogg', '.mov', '.avi'].any((ext) => url.toLowerCase().contains(ext));

class MediaCarousel extends StatefulWidget {
  const MediaCarousel({super.key, required this.media, this.onOpenFullscreen});
  final List<MediaItem> media;
  final void Function(int index)? onOpenFullscreen;

  @override
  State<MediaCarousel> createState() => _MediaCarouselState();
}

class _MediaCarouselState extends State<MediaCarousel> {
  int _index = 0;
  int _direction = 1;

  void _prev() => setState(() {
        _direction = -1;
        _index = _index == 0 ? widget.media.length - 1 : _index - 1;
      });

  void _next() => setState(() {
        _direction = 1;
        _index = _index == widget.media.length - 1 ? 0 : _index + 1;
      });

  Widget _item(int index) {
    final item = widget.media[index];
    if (item.video) return _LazyVideo(key: ValueKey('video-$index-${item.url}'), url: item.url, dimmed: widget.media.length == 1);
    return CommunityButton(
      onTap: () => widget.onOpenFullscreen?.call(index),
      child: Image.network(item.url, fit: BoxFit.cover, width: double.infinity, height: double.infinity, errorBuilder: (_, _, _) => const SizedBox()),
    );
  }

  Widget _round(AIconData icon, VoidCallback onTap) => CommunityButton(
        onTap: onTap,
        child: Container(
          width: 32,
          height: 32,
          decoration: const BoxDecoration(color: Color(0x80000000), shape: BoxShape.circle), // bg-black/50
          alignment: Alignment.center,
          child: AIcon(icon, size: 20, color: const Color(0xFFFFFFFF), mirrorInRtl: true),
        ),
      );

  @override
  Widget build(BuildContext context) {
    if (widget.media.isEmpty) return const SizedBox.shrink();
    final box = BoxDecoration(color: context.tokens.shadcn.muted.withValues(alpha: 0.3), borderRadius: BorderRadius.circular(16));
    if (widget.media.length == 1) {
      return Container(height: 360, decoration: box, clipBehavior: Clip.antiAlias, child: _item(0));
    }
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final index = _index.clamp(0, widget.media.length - 1);
    return Container(
      height: 360,
      decoration: box,
      clipBehavior: Clip.antiAlias,
      child: Stack(children: [
        Positioned.fill(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            transitionBuilder: (child, animation) {
              final incoming = child.key == ValueKey(index);
              final dx = (incoming ? _direction * 50 : _direction * -50) * (rtl ? -1 : 1) / 360;
              return FadeTransition(
                opacity: animation,
                child: SlideTransition(position: Tween<Offset>(begin: Offset(dx, 0), end: Offset.zero).animate(animation), child: child),
              );
            },
            child: KeyedSubtree(key: ValueKey(index), child: _item(index)),
          ),
        ),
        PositionedDirectional(start: 8, top: 0, bottom: 0, child: Center(child: _round(AIcons.chevronLeft, _prev))),
        PositionedDirectional(end: 8, top: 0, bottom: 0, child: Center(child: _round(AIcons.chevronRight, _next))),
        Positioned(
          bottom: 8,
          left: 0,
          right: 0,
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (var i = 0; i < widget.media.length; i++)
              CommunityButton(
                onTap: () => setState(() => _index = i),
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == index ? 16 : 8,
                  height: 8,
                  decoration: BoxDecoration(color: i == index ? const Color(0xFFFFFFFF) : const Color(0x80FFFFFF), borderRadius: BorderRadius.circular(999)),
                ),
              ),
          ]),
        ),
        PositionedDirectional(
          top: 8,
          end: 8,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: const Color(0x80000000), borderRadius: BorderRadius.circular(999)),
            child: Text('${index + 1} / ${widget.media.length}', style: px(12, weight: FontWeight.w500, color: const Color(0xFFFFFFFF), height: 1.3)),
          ),
        ),
      ]),
    );
  }
}

class _LazyVideo extends StatefulWidget {
  const _LazyVideo({super.key, required this.url, required this.dimmed});
  final String url;

  /// The single-item layout dims the poster (`bg-black/20`).
  final bool dimmed;
  @override
  State<_LazyVideo> createState() => _LazyVideoState();
}

class _LazyVideoState extends State<_LazyVideo> {
  VideoPlayerController? _controller;
  bool _playing = false;

  Future<void> _toggle() async {
    var c = _controller;
    if (c == null) {
      c = _controller = VideoPlayerController.networkUrl(Uri.parse(widget.url));
      c.addListener(_sync);
      try {
        await c.initialize();
      } catch (_) {
        return;
      }
      if (!mounted) return;
    }
    if (c.value.isPlaying) {
      await c.pause();
    } else {
      await c.play();
    }
  }

  void _sync() {
    final playing = _controller?.value.isPlaying ?? false;
    if (playing != _playing && mounted) setState(() => _playing = playing);
  }

  @override
  void dispose() {
    final c = _controller;
    if (c != null) {
      c.removeListener(_sync);
      unawaited(c.pause().whenComplete(c.dispose));
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = _controller;
    return CommunityButton(
      onTap: () => unawaited(_toggle()),
      child: Stack(fit: StackFit.expand, children: [
        if (c != null && c.value.isInitialized)
          FittedBox(fit: BoxFit.cover, clipBehavior: Clip.hardEdge, child: SizedBox(width: c.value.size.width, height: c.value.size.height, child: VideoPlayer(c)))
        else
          const ColoredBox(color: Color(0xFF000000)),
        if (!_playing)
          Container(
            color: widget.dimmed ? const Color(0x33000000) : null,
            alignment: Alignment.center,
            child: Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(color: Color(0xE6FFFFFF), shape: BoxShape.circle), // bg-white/90
              alignment: Alignment.center,
              child: Padding(padding: const EdgeInsetsDirectional.only(start: 4), child: AIcon(AIcons.play, size: 32, color: context.tokens.shadcn.foreground)),
            ),
          ),
      ]),
    );
  }
}

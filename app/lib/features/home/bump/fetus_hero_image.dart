// Ported from: src/components/bump/FetusHeroImage.tsx, src/lib/illustration-image.ts (preloadImage retries,
//              isImageReady), src/components/Dashboard.tsx (FETUS_IMAGES, img style: 128×128 contain,
//              drop-shadow(0 14px 18px rgba(217, 108, 74, 0.3)))
import 'dart:async';
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/physics.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../design/design.dart';

/// `FETUS_IMAGES[month]` — bundled SVGs copied by app/tool/home/copy_assets.mjs.
String fetusAsset(int month) => 'assets/images/fetus/month-${month.clamp(1, 9)}.svg';

/// Process-wide `loaded` / `failed` sets of illustration-image.ts.
final Set<String> _loaded = {};
final Set<String> _failed = {};
final Map<String, Future<bool>> _inflight = {};
const List<Duration> _retryDelays = [Duration(milliseconds: 1500), Duration(milliseconds: 5000)];

bool isIllustrationReady(String? url) => url != null && _loaded.contains(url);

/// `preloadImage(url)`: loads with two retries; true once decoded.
Future<bool> preloadIllustration(BuildContext context, String? url) {
  if (url == null) return Future.value(false);
  if (_loaded.contains(url)) return Future.value(true);
  if (_failed.contains(url)) return Future.value(false);
  final existing = _inflight[url];
  if (existing != null) return existing;
  final provider = CachedNetworkImageProvider(url);
  Future<bool> run() async {
    for (var i = 0; i <= _retryDelays.length; i++) {
      var ok = true;
      if (!context.mounted) return false;
      await precacheImage(provider, context, onError: (_, _) => ok = false);
      if (ok) {
        _loaded.add(url);
        return true;
      }
      if (i < _retryDelays.length) await Future<void>.delayed(_retryDelays[i]);
    }
    _failed.add(url);
    return false;
  }

  final f = run().whenComplete(() => _inflight.remove(url));
  _inflight[url] = f;
  return f;
}

/// Test helper (`__resetIllustrationImageCache`).
void resetIllustrationCacheForTests() {
  _loaded.clear();
  _failed.clear();
  _inflight.clear();
}

/// CSS `filter: drop-shadow(dx dy blur color)` around an image with transparency.
class ADropShadow extends StatelessWidget {
  const ADropShadow({super.key, required this.child, required this.offset, required this.blur, required this.color});
  final Widget child;
  final Offset offset;
  final double blur;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Stack(clipBehavior: Clip.none, children: [
      Transform.translate(
        offset: offset,
        child: ImageFiltered(
          // drop-shadow's blur radius is twice the Gaussian standard deviation.
          imageFilter: ui.ImageFilter.blur(sigmaX: blur / 2, sigmaY: blur / 2, tileMode: TileMode.decal),
          child: ColorFiltered(colorFilter: ColorFilter.mode(color, BlendMode.srcIn), child: child),
        ),
      ),
      child,
    ]);
  }
}

/// The bundled illustration renders immediately; the admin-managed remote image replaces it once loaded.
class FetusHeroImage extends StatefulWidget {
  const FetusHeroImage({
    super.key,
    required this.remoteSrc,
    required this.fallbackAsset,
    this.preloadSrcs = const [],
    required this.alt,
    this.size = 128,
  });

  final String? remoteSrc;
  final String fallbackAsset;
  final List<String?> preloadSrcs;
  final String alt;
  final double size;

  @override
  State<FetusHeroImage> createState() => _FetusHeroImageState();
}

class _FetusHeroImageState extends State<FetusHeroImage> with TickerProviderStateMixin {
  String? _readySrc;
  late final AnimationController _scale = AnimationController.unbounded(vsync: this, value: 1);
  late final AnimationController _opacity = AnimationController(vsync: this, duration: const Duration(milliseconds: 300), value: 1);
  Timer? _enter;
  bool _entered = false;

  @override
  void initState() {
    super.initState();
    _readySrc = isIllustrationReady(widget.remoteSrc) ? widget.remoteSrc : null;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_entered) {
      _entered = true;
      if (!animationsDisabled(context)) {
        // initial={{ scale: 0.8, opacity: 0 }}; scale: delay .2 `type: 'spring'` (100 / 10), opacity: delay .2.
        _scale.value = 0.8;
        _opacity.value = 0;
        _enter = Timer(const Duration(milliseconds: 200), () {
          if (!mounted) return;
          _scale.animateWith(SpringSimulation(ASprings.framerDefault, 0.8, 1, 0));
          _opacity.animateTo(1, curve: ACurves.framerDefault);
        });
      }
      _load();
    }
  }

  @override
  void didUpdateWidget(FetusHeroImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.remoteSrc != widget.remoteSrc) _load();
  }

  void _load() {
    final src = widget.remoteSrc;
    if (src == null) return;
    if (isIllustrationReady(src)) {
      setState(() => _readySrc = src);
    } else {
      unawaited(preloadIllustration(context, src).then((ok) {
        if (mounted && ok && widget.remoteSrc == src) setState(() => _readySrc = src);
        // Neighbours wait for the current image so they never compete with it.
        if (mounted) {
          for (final n in widget.preloadSrcs) {
            if (n != null) unawaited(preloadIllustration(context, n));
          }
        }
      }));
    }
  }

  @override
  void dispose() {
    _enter?.cancel();
    _scale.dispose();
    _opacity.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final remote = widget.remoteSrc != null && _readySrc == widget.remoteSrc;
    final s = widget.size;
    final Widget img = remote
        ? CachedNetworkImage(
            imageUrl: widget.remoteSrc!,
            width: s,
            height: s,
            fit: BoxFit.contain,
            fadeInDuration: Duration.zero,
            errorWidget: (context, url, error) {
              // A cached remote image that later fails drops back to the bundled one.
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) setState(() => _readySrc = null);
              });
              return SvgPicture.asset(widget.fallbackAsset, width: s, height: s, fit: BoxFit.contain);
            },
          )
        : SvgPicture.asset(widget.fallbackAsset, width: s, height: s, fit: BoxFit.contain);
    return Semantics(
      image: true,
      label: widget.alt,
      child: AnimatedBuilder(
        animation: Listenable.merge([_scale, _opacity]),
        builder: (context, child) => Opacity(
          opacity: _opacity.value.clamp(0.0, 1.0),
          child: Transform.scale(scale: _scale.value, child: child),
        ),
        child: SizedBox(
          width: s,
          height: s,
          child: ADropShadow(offset: const Offset(0, 14), blur: 18, color: const Color(0x4DD96C4A), child: img),
        ),
      ),
    );
  }
}

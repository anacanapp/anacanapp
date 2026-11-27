// Ported from: src/components/StartupScreen.tsx, src/components/SplashScreen.tsx, src/styles/startup.css
//              (.anacan-startup*, @keyframes startup-progress, prefers-reduced-motion), index.html (bootstrap splash)
//
// One widget for the whole visual hand-off: the native launch screen → the bootstrap splash shown while
// `runAppStartup` runs (index.html's `.anacan-startup`) → Index's 350 ms brand splash → the "auth loading"
// StartupScreen. index.html ships `brand-mark-white.png` at 120 px, but `startup.css` (linked after the inline
// style) repaints the screen cream, which leaves a white-on-cream mark; docs/HEADER_SPLASH_38.md says the
// bootstrap, splash and loading screens share the 96 px mark + wordmark, so the bootstrap phase renders this
// widget too (docs/flutter/APP_ROOT.md, "Parity notes").
import 'package:flutter/widgets.dart';
import 'package:material_ui/material_ui.dart' show Theme;

import '../../design/motion.dart' show animationsDisabled;

/// `src/assets/brand-mark.png` (512×512, coral disc).
const String kBrandMarkAsset = 'assets/images/brand-mark.png';

/// `.anacan-startup` (light) — startup.css literals.
const Color kStartupBackground = Color(0xFFFAF7F4);
const Color kStartupInk = Color(0xFF594138);

/// `html.dark .anacan-startup`.
const Color kStartupBackgroundDark = Color(0xFF161922);
const Color kStartupInkDark = Color(0xFFF2E9E4);

/// `.anacan-startup-progress` track `#d9795825`, bar `#d97958`.
const Color _kTrack = Color(0x25D97958);
const Color _kBar = Color(0xFFD97958);

/// `filter: drop-shadow(0 12px 18px #9c503219)` (18 px blur = σ 9; Flutter's blurRadius r maps to σ = 0.577·r + 0.5).
const BoxShadow _kMarkShadow = BoxShadow(color: Color(0x199C5032), offset: Offset(0, 12), blurRadius: 14.72);

/// `<StartupScreen />`: `role="status" aria-label="Anacan" aria-busy`.
class StartupScreen extends StatelessWidget {
  const StartupScreen({super.key, this.dark});

  /// `html.dark`. Null → the ambient [Theme] brightness (Theme.of falls back to light without a theme).
  final bool? dark;

  @override
  Widget build(BuildContext context) {
    final isDark = dark ?? (Theme.of(context).brightness == Brightness.dark);
    final mq = MediaQuery.maybeOf(context);
    final pad = mq?.viewPadding ?? EdgeInsets.zero;
    final ink = isDark ? kStartupInkDark : kStartupInk;
    return Semantics(
      container: true,
      liveRegion: true,
      label: 'Anacan',
      child: ColoredBox(
        color: isDark ? kStartupBackgroundDark : kStartupBackground,
        child: Padding(
          // padding: max(24px, safe-top) 24px max(24px, safe-bottom)
          padding: EdgeInsets.fromLTRB(24, pad.top > 24 ? pad.top : 24, 24, pad.bottom > 24 ? pad.bottom : 24),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const _BrandMark(),
                const SizedBox(height: 18),
                // font: 800 28px/1.2 system-ui; letter-spacing -.04em
                Text(
                  'Anacan',
                  textDirection: TextDirection.ltr,
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    height: 1.2,
                    letterSpacing: -0.04 * 28,
                    color: ink,
                    decoration: TextDecoration.none,
                  ),
                ),
                const SizedBox(height: 18),
                const ExcludeSemantics(child: StartupProgress()),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 96,
      height: 96,
      decoration: const BoxDecoration(shape: BoxShape.circle, boxShadow: [_kMarkShadow]),
      child: Image.asset(kBrandMarkAsset, width: 96, height: 96, fit: BoxFit.contain, excludeFromSemantics: true),
    );
  }
}

/// `.anacan-startup-progress`: 48×3 track, a 24 px bar sliding to translateX(24px) and back
/// (1.4 s ease-in-out infinite alternate). Reduced motion: no animation, full width at 65 % opacity.
class StartupProgress extends StatefulWidget {
  const StartupProgress({super.key});

  static const Duration period = Duration(milliseconds: 1400);

  @override
  State<StartupProgress> createState() => _StartupProgressState();
}

class _StartupProgressState extends State<StartupProgress> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: StartupProgress.period);
  bool? _reduced;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = animationsDisabled(context);
    if (reduced == _reduced) return;
    _reduced = reduced;
    if (reduced) {
      _c.stop();
    } else {
      _c.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = _reduced ?? false;
    return ClipRRect(
      borderRadius: BorderRadius.circular(3),
      child: Container(
        width: 48,
        height: 3,
        color: _kTrack,
        // A block child starts at the inline start; the keyframe moves it +24 px in both directions
        // (in RTL it slides out of the clipped track, as in the WebView).
        alignment: AlignmentDirectional.centerStart,
        child: reduced
            ? Opacity(
                opacity: 0.65,
                child: Container(width: 48, height: 3, decoration: BoxDecoration(color: _kBar, borderRadius: BorderRadius.circular(3))),
              )
            : AnimatedBuilder(
                animation: _c,
                builder: (context, child) => Transform.translate(
                  offset: Offset(24 * Curves.easeInOut.transform(_c.value), 0),
                  child: child,
                ),
                child: Container(width: 24, height: 3, decoration: BoxDecoration(color: _kBar, borderRadius: BorderRadius.circular(3))),
              ),
      ),
    );
  }
}

/// `<SplashScreen onComplete>`: the StartupScreen; GateHost owns the 350 ms timer and the once-per-process flag.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) => const StartupScreen();
}

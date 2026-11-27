// Ported from: src/components/ForceUpdateScreen.tsx
import 'package:flutter/foundation.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';

import '../../design/a_icon.dart';
import '../../design/icons.g.dart' show AIcons;
import '../../design/motion.dart' show ACurves, animationsDisabled;
import '../../design/theme.dart';
import 'app_update/app_update.dart' show openStoreUrl;
import 'app_update_copy.dart';
import 'widgets/a_sky.dart';

/// Full-screen forced update (cannot be dismissed). Texts come from the update rule in the user's language; any
/// missing text uses the built-in 25-language labels.
class ForceUpdateScreen extends StatefulWidget {
  const ForceUpdateScreen({
    super.key,
    this.title,
    this.message,
    required this.androidUrl,
    required this.iosUrl,
    this.currentVersion,
    this.buttonLabel,
    this.language,
    this.isIos,
    this.onOpenStore,
  });

  final String? title;
  final String? message;
  final String androidUrl;
  final String iosUrl;

  /// Installed version, shown under the button so support can see it in screenshots.
  final String? currentVersion;
  final String? buttonLabel;

  /// `readAppLanguage()` (defaults to the i18n runtime's language).
  final String? language;

  /// `Capacitor.getPlatform() === 'ios'` (defaults to the target platform).
  final bool? isIos;

  /// Test hook; default opens the store URL externally.
  final void Function(String url)? onOpenStore;

  @override
  State<ForceUpdateScreen> createState() => _ForceUpdateScreenState();
}

/// JS `a || b` for optional texts.
String _or(String? a, String b) => (a != null && a.isNotEmpty) ? a : b;

class _ForceUpdateScreenState extends State<ForceUpdateScreen> with TickerProviderStateMixin {
  // initial={{ opacity: 0 }} animate={{ opacity: 1 }} (framer default tween, 300 ms).
  late final AnimationController _fade = AnimationController(vsync: this, duration: const Duration(milliseconds: 300))..forward();
  // Icon: scale 0.85 → 1 and opacity 0 → 1 with { type: 'spring', stiffness: 220 } (damping 10, mass 1).
  late final AnimationController _spring = AnimationController.unbounded(vsync: this, value: 0);
  bool _started = false;
  bool _pressed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final reduce = animationsDisabled(context) || AnacanTokens.of(context).lite;
    _spring.animateWith(SpringSimulation(const SpringDescription(mass: 1, stiffness: 220, damping: 10), 0, 1, 0));
    _reduceTransform = reduce;
  }

  bool _reduceTransform = false;

  @override
  void dispose() {
    _fade.dispose();
    _spring.dispose();
    super.dispose();
  }

  bool get _ios => widget.isIos ?? defaultTargetPlatform == TargetPlatform.iOS;

  void _update() {
    final url = _ios ? widget.iosUrl : widget.androidUrl;
    final hook = widget.onOpenStore;
    if (hook != null) {
      hook(url);
    } else {
      openStoreUrl(url);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context).a;
    final lang = widget.language;
    final pad = MediaQuery.paddingOf(context);
    final version = widget.currentVersion;
    final footer = '${_ios ? 'App Store' : 'Google Play'}'
        '${version != null && version.isNotEmpty ? ' · ${updateText(AppUpdateText.yourVersion, lang)}: $version' : ''}';

    final icon = AnimatedBuilder(
      animation: _spring,
      builder: (context, child) {
        final v = _spring.value;
        final scale = _reduceTransform ? 1.0 : 0.85 + 0.15 * v;
        return Opacity(opacity: v.clamp(0.0, 1.0), child: Transform.scale(scale: scale, child: child));
      },
      child: Container(
        width: 76,
        height: 76,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          // linear-gradient(135deg, var(--a-peach-1), #ffb9ae) — ForceUpdateScreen.tsx literal.
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [t.peach1, const Color(0xFFFFB9AE)],
          ),
        ),
        child: AIcon(AIcons.circleArrowUp, size: 36, color: t.accentInk),
      ),
    );

    final body = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        icon,
        const SizedBox(height: 24),
        Semantics(
          header: true,
          child: Text(
            _or(widget.title, updateText(AppUpdateText.required, lang)),
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w900,
              letterSpacing: em(-0.02, 24),
              height: 1.5,
              leadingDistribution: TextLeadingDistribution.even,
              color: t.ink,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          _or(widget.message, updateText(AppUpdateText.requiredBody, lang)),
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14.5, height: 1.625, leadingDistribution: TextLeadingDistribution.even, color: t.bodyText),
        ),
        const SizedBox(height: 32),
        Semantics(
          button: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (_) => setState(() => _pressed = true),
            onTapCancel: () => setState(() => _pressed = false),
            onTapUp: (_) => setState(() => _pressed = false),
            onTap: _update,
            child: Opacity(
              opacity: _pressed ? 0.9 : 1,
              child: Container(
                width: double.infinity,
                height: 56,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: t.peach2,
                  borderRadius: BorderRadius.circular(999),
                  // 0 16px 32px -12px rgba(255, 90, 95, 0.6) — ForceUpdateScreen.tsx literal.
                  boxShadow: const [BoxShadow(color: Color(0x99FF5A5F), offset: Offset(0, 16), blurRadius: 32, spreadRadius: -12)],
                ),
                child: Text(
                  _or(widget.buttonLabel, updateText(AppUpdateText.update, lang)),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 16, height: 1.5, fontWeight: FontWeight.w700, color: Color(0xFFFFFFFF)),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          footer,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12.5, height: 1.5, color: t.inkSoft),
        ),
      ],
    );

    return AScope(
      child: FadeTransition(
        opacity: CurvedAnimation(parent: _fade, curve: ACurves.framerDefault),
        child: Semantics(
          scopesRoute: true,
          explicitChildNodes: true,
          label: _or(widget.title, updateText(AppUpdateText.required, lang)),
          child: ColoredBox(
            color: t.bg,
            child: Stack(
              children: [
                const Positioned(top: 0, left: 0, right: 0, child: ASky()),
                Positioned.fill(
                  child: Padding(
                    padding: EdgeInsets.only(top: pad.top, bottom: pad.bottom, left: 28, right: 28),
                    child: Center(
                      child: SingleChildScrollView(
                        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 384), child: body),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

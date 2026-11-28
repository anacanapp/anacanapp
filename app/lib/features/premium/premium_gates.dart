// Ported from: src/components/premium/PremiumGate.tsx, src/components/premium/PremiumBlurGate.tsx,
// src/components/premium/PremiumToolBoundary.tsx
//
// The freemium UI gates other features wrap their Premium content in:
//   PremiumGate(title:, child:)              locked card → paywall (Premium sees the child)
//   PremiumBlurGate(feature:, child:)        blurred teaser + crown / lock / CTA overlay → paywall
//   PremiumToolBoundary(onClose:, child:)    a paid tool: never mounted for a free/expired account

import 'dart:ui' as ui;

import 'package:flutter/physics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../native/purchases/purchases.dart';
import 'premium_modal.dart';

/// `PremiumGate`: Premium/admin users get [child] as is; free users a dashed locked card that opens the paywall.
class PremiumGate extends ConsumerWidget {
  const PremiumGate({super.key, required this.child, required this.title, this.description, this.feature, this.emoji = '✨'});
  final Widget child;

  /// Section name on the locked card.
  final String title;
  final String? description;

  /// Analytics/paywall feature name (defaults to [title]).
  final String? feature;
  final String emoji;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(subscriptionProvider).isPremium) return child;
    final t = context.a;
    final x = context.aText;
    final card = CustomPaint(
      foregroundPainter: _DashedBorderPainter(color: t.peach2, radius: t.radiusLg),
      child: Container(
        clipBehavior: Clip.antiAlias,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(t.radiusLg), boxShadow: t.cardShadow),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            PositionedDirectional(
              top: -16,
              end: -16,
              // 90 px peach circle, translate(30%, -30%), opacity .45.
              child: Transform.translate(
                offset: Offset(Directionality.of(context) == TextDirection.rtl ? -27 : 27, -27),
                child: Opacity(
                  opacity: 0.45,
                  child: Container(
                    width: 90,
                    height: 90,
                    decoration: BoxDecoration(color: t.peach1, shape: BoxShape.circle),
                  ),
                ),
              ),
            ),
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(gradient: t.gradPeach, borderRadius: BorderRadius.circular(14)),
                  alignment: Alignment.center,
                  child: Text(emoji, style: const TextStyle(fontSize: 20)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          AIcon(AIcons.lock, size: 12, strokeWidth: 2.4, color: t.accentInk),
                          const SizedBox(width: 6),
                          Flexible(child: Text(title, style: x.aListTitle.copyWith(fontSize: 14))),
                        ],
                      ),
                      Text(description ?? tr('pgate_default_desc_v2', 'Premium ilə açılır'), style: x.aListSub),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(gradient: t.gradPeach, borderRadius: BorderRadius.circular(999)),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AIcon(AIcons.crown, size: 11, strokeWidth: 2.4, color: t.accentInk),
                      const SizedBox(width: 4),
                      Text(
                        tr('pgate_unlock', 'Aç'),
                        style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: t.accentInk),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
    return _Appear(
      child: Semantics(
        button: true,
        child: PressScale(
          scale: 0.98,
          enabled: !(AnacanTokens.of(context).lite || animationsDisabled(context)),
          onTap: () => showPremiumModal(context, feature: feature ?? title),
          child: card,
        ),
      ),
    );
  }
}

/// `PremiumBlurGate` (Flo / BabyCenter style teaser). Premium users see [child] unless [forceLock].
class PremiumBlurGate extends ConsumerWidget {
  const PremiumBlurGate({super.key, required this.feature, this.title, this.subtitle, this.cta, this.blur = 'md', this.forceLock = false, required this.child});
  final String feature;
  final String? title;
  final String? subtitle;
  final String? cta;

  /// 'sm' | 'md' | 'lg' → 4 / 7 / 12 px.
  final String blur;
  final bool forceLock;
  final Widget child;

  static const Map<String, double> blurPx = {'sm': 4, 'md': 7, 'lg': 12};

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(subscriptionProvider).isPremium && !forceLock) return child;
    final t = context.a;
    final s = AnacanTokens.of(context).shadcn;
    final heading = title ?? tr('premiumgate_default_title', 'Bu bölmə Premium-dadır');
    final sigma = (blurPx[blur] ?? 7) / 2;
    // The teaser is a neutral skeleton (`bg-muted` bars), never the real content.
    final teaser = ImageFiltered(
      imageFilter: ui.ImageFilter.compose(
        outer: const ColorFilter.matrix(_saturate09),
        inner: ui.ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
      ),
      child: Opacity(
        opacity: 0.9,
        child: Container(
          constraints: const BoxConstraints(minHeight: 170),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FractionallySizedBox(
                widthFactor: 2 / 3,
                child: Container(
                  height: 20,
                  decoration: BoxDecoration(color: s.muted, borderRadius: BorderRadius.circular(4)),
                ),
              ),
              const SizedBox(height: 16),
              Container(
                height: 48,
                decoration: BoxDecoration(color: s.muted, borderRadius: BorderRadius.circular(4)),
              ),
              const SizedBox(height: 16),
              FractionallySizedBox(
                widthFactor: 4 / 5,
                child: Container(
                  height: 20,
                  decoration: BoxDecoration(color: s.muted, borderRadius: BorderRadius.circular(4)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    void open() {
      HapticFeedback.lightImpact();
      showPremiumModal(context, feature: feature);
    }

    return Semantics(
      button: true,
      label: heading,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: open,
        child: Stack(
          children: [
            ExcludeSemantics(child: IgnorePointer(child: teaser)),
            // Overlay: soft surface gradient + centred CTA.
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [t.surface.withValues(alpha: 0.15), t.surface.withValues(alpha: 0.55), t.surface.withValues(alpha: 0.85)],
                    stops: const [0, 0.45, 1],
                  ),
                ),
                // CSS lets a taller overlay overflow the teaser box (centred, not clipped).
                child: OverflowBox(
                  minHeight: 0,
                  maxHeight: double.infinity,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const _PopIn(child: _LockBubble()),
                        const SizedBox(height: 8),
                        Text(
                          heading,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: t.ink,
                            shadows: [Shadow(color: t.surface.withValues(alpha: 0.8), blurRadius: 6, offset: const Offset(0, 1))],
                          ),
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 8),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 260),
                            child: Text(
                              subtitle!,
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 12, height: 1.5, color: t.inkSoft),
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        PressScale(
                          scale: 0.95,
                          enabled: !(AnacanTokens.of(context).lite || animationsDisabled(context)),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 9),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(999),
                              // `linear-gradient(135deg, #FF7A7E, #FF5A5F)`, shadow rgba(217,58,64,.35) (PremiumBlurGate.tsx).
                              gradient: const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [Color(0xFFFF7A7E), Color(0xFFFF5A5F)],
                              ),
                              boxShadow: const [BoxShadow(color: Color.fromRGBO(217, 58, 64, 0.35), offset: Offset(0, 6), blurRadius: 16)],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const AIcon(AIcons.crown, size: 14, strokeWidth: 2.5, color: Color(0xFFFFFFFF)),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    cta ?? tr('usepaywallconfig_premium_a_kec_2e8b0e', 'Premium-a Keç'),
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFFFFFFFF)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            // PREMIUM tag (top end).
            PositionedDirectional(
              top: 10,
              end: 14,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  // `linear-gradient(135deg, #ffe9b3, #ffd166)`, shadow rgba(180,130,0,.25) (PremiumBlurGate.tsx).
                  gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFFFE9B3), Color(0xFFFFD166)]),
                  boxShadow: const [BoxShadow(color: Color.fromRGBO(180, 130, 0, 0.25), offset: Offset(0, 2), blurRadius: 8)],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AIcon(AIcons.crown, size: 11, strokeWidth: 2.5, color: t.warnInk),
                    const SizedBox(width: 4),
                    Text(
                      trInline('PremiumBlurGate.tsx', 'PREMIUM'),
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: em(0.06, 10), color: t.warnInk),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// `saturate(0.9)` colour matrix.
const List<double> _saturate09 = [
  0.9213, 0.0715, 0.0072, 0, 0, //
  0.0213, 0.9715, 0.0072, 0, 0,
  0.0213, 0.0715, 0.9072, 0, 0,
  0, 0, 0, 1, 0,
];

class _LockBubble extends StatelessWidget {
  const _LockBubble();
  @override
  Widget build(BuildContext context) => Container(
    width: 44,
    height: 44,
    decoration: const BoxDecoration(
      shape: BoxShape.circle,
      // `linear-gradient(135deg, #ffd166, #f9a03f)`, shadow rgba(249,160,63,.45) (PremiumBlurGate.tsx).
      gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFFFD166), Color(0xFFF9A03F)]),
      boxShadow: [BoxShadow(color: Color.fromRGBO(249, 160, 63, 0.45), offset: Offset(0, 6), blurRadius: 18)],
    ),
    alignment: Alignment.center,
    child: const AIcon(AIcons.lock, size: 20, strokeWidth: 2.4, color: Color(0xFFFFFFFF)),
  );
}

/// framer `initial={{scale: .85, opacity: 0}} animate={{scale: 1, opacity: 1}} transition={{type:'spring', damping: 18, stiffness: 260}}`.
class _PopIn extends StatefulWidget {
  const _PopIn({required this.child});
  final Widget child;
  @override
  State<_PopIn> createState() => _PopInState();
}

class _PopInState extends State<_PopIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController.unbounded(vsync: this, value: 0);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (AnacanTokens.of(context).lite || animationsDisabled(context)) {
      _c.value = 1;
    } else {
      _c.animateWith(SpringSimulation(ASprings.spring(stiffness: 260, damping: 18), 0, 1, 0));
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _c,
    builder: (context, child) => Opacity(
      opacity: _c.value.clamp(0.0, 1.0),
      child: Transform.scale(scale: 0.85 + 0.15 * _c.value, child: child),
    ),
    child: widget.child,
  );
}

/// framer `initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}}` (default transitions).
class _Appear extends StatefulWidget {
  const _Appear({required this.child});
  final Widget child;
  @override
  State<_Appear> createState() => _AppearState();
}

class _AppearState extends State<_Appear> with TickerProviderStateMixin {
  late final AnimationController _o = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
  late final AnimationController _y = AnimationController.unbounded(vsync: this, value: 12);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _o.animateTo(1, curve: ACurves.framerDefault);
    if (AnacanTokens.of(context).lite || animationsDisabled(context)) {
      _y.value = 0;
    } else {
      _y.animateWith(SpringSimulation(ASprings.transform, 12, 0, 0));
    }
  }

  @override
  void dispose() {
    _o.dispose();
    _y.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge([_o, _y]),
    builder: (context, child) => Opacity(
      opacity: _o.value.clamp(0.0, 1.0),
      child: Transform.translate(offset: Offset(0, _y.value), child: child),
    ),
    child: widget.child,
  );
}

/// `border: 1px dashed`.
class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({required this.color, required this.radius});
  final Color color;
  final double radius;
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()..addRRect(RRect.fromRectAndRadius((Offset.zero & size).deflate(0.5), Radius.circular(radius)));
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    for (final metric in path.computeMetrics()) {
      for (double d = 0; d < metric.length; d += 6) {
        canvas.drawPath(metric.extractPath(d, d + 3), paint);
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter old) => old.color != color || old.radius != radius;
}

/// `PremiumToolBoundary`: a paid tool is never mounted for a free/expired account; a revocation unmounts it
/// and shows the paywall. A purchase from this paywall keeps the user in the tool while the shared
/// entitlement catches up; once the entitlement says Premium it alone decides again.
class PremiumToolBoundary extends ConsumerStatefulWidget {
  const PremiumToolBoundary({super.key, required this.child, required this.onClose, this.feature = 'tool'});
  final Widget child;
  final VoidCallback onClose;
  final String feature;

  @override
  ConsumerState<PremiumToolBoundary> createState() => _PremiumToolBoundaryState();
}

class _PremiumToolBoundaryState extends ConsumerState<PremiumToolBoundary> {
  bool _unlocked = false;

  @override
  Widget build(BuildContext context) {
    final sub = ref.watch(subscriptionProvider);
    ref.listen(subscriptionProvider.select((s) => s.isPremium), (_, premium) {
      if (premium) setState(() => _unlocked = false);
    });
    // isPremium includes a confirmed offline grant: a failed check never shows the paywall to a payer.
    if (sub.isPremium || _unlocked) return widget.child;
    if (sub.loading && !sub.entitlementReady) {
      final primary = AnacanTokens.of(context).shadcn.primary;
      // `min-h-screen flex items-center justify-center` (the tool area may have unbounded height).
      return SizedBox(
        height: MediaQuery.sizeOf(context).height,
        child: Center(
          child: SizedBox(
            width: 32,
            height: 32,
            child: CircularProgressIndicator(strokeWidth: 4, color: primary, backgroundColor: Colors.transparent),
          ),
        ),
      );
    }
    // React renders `<PremiumModal isOpen>`, a fixed full-screen layer, instead of the tool: shown above the page
    // through the nearest Overlay, so it does not depend on the (possibly unbounded) size of the tool area.
    return _FullScreenLayer(
      child: PremiumModalView(feature: widget.feature, onClose: widget.onClose, onPurchased: () => setState(() => _unlocked = true)),
    );
  }
}

/// Shows [child] over the whole screen (`position: fixed; inset: 0`) while mounted; occupies no space in place.
class _FullScreenLayer extends StatefulWidget {
  const _FullScreenLayer({required this.child});
  final Widget child;
  @override
  State<_FullScreenLayer> createState() => _FullScreenLayerState();
}

class _FullScreenLayerState extends State<_FullScreenLayer> {
  final OverlayPortalController _portal = OverlayPortalController()..show();

  @override
  Widget build(BuildContext context) {
    if (Overlay.maybeOf(context) == null) {
      return SizedBox(height: MediaQuery.sizeOf(context).height, child: widget.child);
    }
    return OverlayPortal(
      controller: _portal,
      overlayChildBuilder: (_) => Positioned.fill(child: widget.child),
      child: const SizedBox.shrink(),
    );
  }
}

// Ported from: src/components/LegalScreen.tsx, HelpScreen.tsx, BillingScreen.tsx, ProfileEditScreen.tsx,
//              shop/CheckoutScreen.tsx (sticky headers: background var(--a-nav-bg), backdrop-filter blur(18px),
//              border-bottom 1px var(--a-line)), src/styles/anacan-design.css (.a-nav.capsule blur(22px)
//              saturate(180%), html.a-lite / html.a-noblur: backdrop-filter none), src/index.css (.glass)
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';

import '../theme.dart';

/// CSS `saturate(s)` as a colour matrix (Filter Effects spec, feColorMatrix type=saturate).
List<double> saturateMatrix(double s) => <double>[
      0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0,
      0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0,
      0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0,
      0, 0, 0, 1, 0,
    ];

/// `backdrop-filter: blur(<blur>px) saturate(<saturate>)` surface.
///
/// The blur is skipped in lite / noBlur mode (`html.a-lite *, html.a-noblur * { backdrop-filter: none }`);
/// the background colour stays as given — the CSS only swaps colours where it says so
/// (capsule nav and `.glass` under `html.a-noblur`, see [AnacanTokens.navCapsule]).
///
/// Note: the brief mentioned `blur(18px) saturate(1.6)`; the source has `blur(18px)` alone on the
/// sticky screen headers and `blur(22px) saturate(180%)` on the capsule nav. Both are below.
class AGlass extends StatelessWidget {
  const AGlass({
    super.key,
    required this.child,
    required this.color,
    this.blur = 18,
    this.saturate = 1,
    this.borderRadius = BorderRadius.zero,
    this.border,
    this.boxShadow,
    this.padding,
  });

  /// Sticky screen header: `--a-nav-bg`, blur(18px), bottom border `--a-line`.
  factory AGlass.header({Key? key, required BuildContext context, required Widget child, EdgeInsetsGeometry? padding}) {
    final t = AnacanTokens.of(context).a;
    return AGlass(key: key, color: t.navBg, border: Border(bottom: BorderSide(color: t.line)), padding: padding, child: child);
  }

  /// `.a-nav.capsule`: radius 34, 1px `--nav-glass-edge`, `--nav-glass-shadow`, blur(22px) saturate(180%).
  factory AGlass.navCapsule({Key? key, required BuildContext context, required Widget child}) {
    final n = AnacanTokens.of(context).navCapsule;
    return AGlass(
      key: key,
      color: n.glass,
      blur: 22,
      saturate: 1.8,
      borderRadius: BorderRadius.circular(34),
      border: Border.all(color: n.glassEdge),
      boxShadow: n.glassShadow,
      padding: const EdgeInsets.all(6),
      child: child,
    );
  }

  final Widget child;
  final Color color;
  final double blur;
  final double saturate;
  final BorderRadius borderRadius;
  final BoxBorder? border;
  final List<BoxShadow>? boxShadow;
  final EdgeInsetsGeometry? padding;

  /// `backdrop-filter: blur(<length>)`: the length *is* the Gaussian standard deviation
  /// (unlike box-shadow blur radii), so it maps 1:1 to Flutter's sigma.
  static ui.ImageFilter filter(double blur, double saturate) {
    final b = ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur, tileMode: TileMode.clamp);
    if (saturate == 1) return b;
    return ui.ImageFilter.compose(outer: b, inner: ColorFilter.matrix(saturateMatrix(saturate)));
  }

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final content = Container(
      padding: padding,
      decoration: BoxDecoration(color: color, borderRadius: borderRadius, border: border),
      child: child,
    );
    Widget surface = content;
    if (tokens.blurEnabled && blur > 0) {
      surface = ClipRRect(
        borderRadius: borderRadius,
        child: BackdropFilter(filter: filter(blur, saturate), child: content),
      );
    }
    if (boxShadow == null || boxShadow!.isEmpty) return surface;
    return DecoratedBox(decoration: BoxDecoration(borderRadius: borderRadius, boxShadow: boxShadow), child: surface);
  }
}

// Ported from: src/styles/anacan-design.css (.a-card, .a-tag, .a-eyebrow / .a-wordmark top bar used by the partner
//              v2 screens), lucide-react `fill` props of the partner screens, framer `whileTap` buttons
//
// Small widget kit shared by the partner screens.
import 'package:flutter/foundation.dart' show SynchronousFuture;
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_svg/flutter_svg.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';

/// A lucide icon with a `fill` (React `style={{ fill }}` / `className="fill-white/40"`), the stroke in [color].
class PartnerLucide extends StatelessWidget {
  const PartnerLucide(this.icon, {super.key, required this.size, required this.color, required this.fill, this.strokeWidth = 2});
  final AIconData icon;
  final double size;
  final Color color;
  final Color fill;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) => SizedBox(
        width: size,
        height: size,
        child: SvgPicture(_FillLoader(icon.asset, strokeWidth, fill, theme: SvgTheme(currentColor: color)), width: size, height: size),
      );
}

String _hex(Color c) {
  final v = c.toARGB32() & 0xFFFFFF;
  return '#${v.toRadixString(16).padLeft(6, '0')}';
}

class _FillLoader extends SvgLoader<String> {
  const _FillLoader(this.asset, this.strokeWidth, this.fill, {super.theme});
  final String asset;
  final double strokeWidth;
  final Color fill;
  static final Map<String, String> _sources = {};

  @override
  Future<String?> prepareMessage(BuildContext? context) {
    final cached = _sources[asset];
    if (cached != null) return SynchronousFuture<String?>(cached);
    final bundle = context != null ? DefaultAssetBundle.of(context) : rootBundle;
    return bundle.loadString(asset).then((s) => _sources[asset] = s);
  }

  @override
  bool get provideSvgInIsolate => false;

  @override
  String provideSvg(String? message) {
    final opacity = (fill.a).toStringAsFixed(3);
    var src = (message ?? '').replaceFirst('fill="none"', 'fill="${_hex(fill)}" fill-opacity="$opacity"');
    if (strokeWidth != 2) src = src.replaceFirst('stroke-width="2"', 'stroke-width="$strokeWidth"');
    return src;
  }

  @override
  SvgCacheKey cacheKey(BuildContext? context) =>
      SvgCacheKey(keyData: (asset, strokeWidth, fill.toARGB32()), theme: getTheme(context), colorMapper: null);

  @override
  bool operator ==(Object other) =>
      other is _FillLoader && other.asset == asset && other.strokeWidth == strokeWidth && other.fill == fill && other.theme == theme;

  @override
  int get hashCode => Object.hash(asset, strokeWidth, fill, theme);
}

/// A framer `motion.button` with `whileTap={{ scale }}`.
class PartnerTap extends StatelessWidget {
  const PartnerTap({super.key, required this.child, this.onTap, this.scale = 0.95, this.semanticLabel, this.enabled = true});
  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  final String? semanticLabel;
  final bool enabled;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        enabled: enabled && onTap != null,
        label: semanticLabel,
        child: PressScale(scale: scale, enabled: enabled && onTap != null, onTap: enabled ? onTap : null, child: child),
      );
}

/// `.a-card` (padding 18 unless given).
class PartnerCard extends StatelessWidget {
  const PartnerCard({super.key, required this.child, this.padding, this.color, this.border});
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Color? color;

  /// Replaces the 1px `--a-line` border (inline `border`).
  final BoxBorder? border;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: padding ?? const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: color ?? a.surface,
        borderRadius: BorderRadius.circular(a.radiusLg),
        border: border ?? Border.all(color: a.line),
        boxShadow: a.cardShadow,
      ),
      child: child,
    );
  }
}

/// Text with the inline `fontSize / fontWeight / color` of the partner screens (line height 1.5).
TextStyle pText(double size, {FontWeight weight = FontWeight.w400, Color? color, double height = 1.5, double? ls}) => TextStyle(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: ls == null ? null : ls * size,
      leadingDistribution: TextLeadingDistribution.even,
    );

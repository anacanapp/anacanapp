// Ported from: node_modules/lucide-react/dist/esm/Icon.js (lucide-react 0.462.0 defaults),
//              src/lib/dynamicIcon.ts, src/components/BottomNav.tsx (react-icons RiApps2AiLine)
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// An exported SVG icon asset (see app/tool/design/gen_icons.mjs).
@immutable
class AIconData {
  const AIconData(this.asset, {required this.name, this.filled = false});

  /// Asset path, e.g. `assets/icons/lucide/heart.svg`.
  final String asset;

  /// Kebab-case lucide name (`heart`, `triangle-alert`).
  final String name;

  /// Filled glyph (fill="currentColor"): [AIcon.strokeWidth] does not apply.
  final bool filled;

  @override
  bool operator ==(Object other) => other is AIconData && other.asset == asset;

  @override
  int get hashCode => asset.hashCode;

  @override
  String toString() => 'AIconData($name)';
}

/// lucide-react `<Icon size color strokeWidth absoluteStrokeWidth />`.
///
/// Defaults match lucide: 24px, `currentColor` (here: ambient [IconTheme] colour, which
/// follows [DefaultTextStyle] colour in [AScope]), stroke width 2 in the 24-unit viewBox.
/// `absoluteStrokeWidth` keeps the stroke at [strokeWidth] logical px at any size.
class AIcon extends StatelessWidget {
  const AIcon(
    this.icon, {
    super.key,
    this.size,
    this.color,
    this.strokeWidth = 2,
    this.absoluteStrokeWidth = false,
    this.semanticLabel,
    this.mirrorInRtl = false,
  });

  final AIconData icon;
  final double? size;
  final Color? color;
  final double strokeWidth;
  final bool absoluteStrokeWidth;
  final String? semanticLabel;

  /// For `className="rtl:rotate-180"` / `rtl:-scale-x-100` chevrons and arrows.
  final bool mirrorInRtl;

  @override
  Widget build(BuildContext context) {
    final iconTheme = IconTheme.of(context);
    final s = size ?? iconTheme.size ?? 24;
    final c = color ?? iconTheme.color ?? DefaultTextStyle.of(context).style.color ?? const Color(0xFF000000);
    final sw = absoluteStrokeWidth ? strokeWidth * 24 / s : strokeWidth;
    Widget child = SvgPicture(
      _ASvgAssetLoader(icon.asset, strokeWidth: icon.filled ? null : sw, theme: SvgTheme(currentColor: c)),
      width: s,
      height: s,
      semanticsLabel: semanticLabel,
      excludeFromSemantics: semanticLabel == null,
    );
    if (mirrorInRtl && Directionality.maybeOf(context) == TextDirection.rtl) {
      child = Transform.flip(flipX: true, child: child);
    }
    return SizedBox(width: s, height: s, child: child);
  }
}

/// Loads the SVG asset and rewrites lucide's `stroke-width="2"` for non-default widths.
/// `currentColor` is resolved by flutter_svg through [SvgTheme.currentColor].
class _ASvgAssetLoader extends SvgLoader<String> {
  const _ASvgAssetLoader(this.asset, {required this.strokeWidth, super.theme});

  final String asset;
  final double? strokeWidth;

  static final Map<String, String> _sources = <String, String>{};

  /// Pre-loads icon sources so first paint needs no asset I/O (call at startup if wanted).
  static Future<void> warm(Iterable<String> assets, [AssetBundle? bundle]) async {
    for (final a in assets) {
      _sources[a] ??= await (bundle ?? rootBundle).loadString(a);
    }
  }

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
    final src = message ?? '';
    final sw = strokeWidth;
    if (sw == null || sw == 2) return src;
    return src.replaceFirst('stroke-width="2"', 'stroke-width="${_fmt(sw)}"');
  }

  static String _fmt(double v) => v == v.roundToDouble() ? v.toInt().toString() : v.toString();

  @override
  SvgCacheKey cacheKey(BuildContext? context) =>
      SvgCacheKey(keyData: (asset, strokeWidth), theme: getTheme(context), colorMapper: null);

  @override
  bool operator ==(Object other) =>
      other is _ASvgAssetLoader && other.asset == asset && other.strokeWidth == strokeWidth && other.theme == theme;

  @override
  int get hashCode => Object.hash(asset, strokeWidth, theme);
}

/// Pre-loads icon SVG sources (e.g. the bottom-nav set) so they render on the first frame.
Future<void> warmIcons(Iterable<AIconData> icons, [AssetBundle? bundle]) =>
    _ASvgAssetLoader.warm(icons.map((i) => i.asset), bundle);

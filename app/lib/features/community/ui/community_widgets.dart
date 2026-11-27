// Ported from: src/styles/anacan-design.css (.community-count-badge, .community-feed-tabs .a-tab(.active), .a-tag,
//              .a-list-title, .a-list-sub, .a-scope), src/index.css (.community-native-text), src/components/ui/
//              {skeleton,avatar}.tsx, lucide `Loader2` + animate-spin
import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../design/design.dart';
import '../../chat/ui/chat_widgets.dart' show ChatAvatar, charAt0;
import '../../settings/ui/settings_ui.dart' show px, ALoader;

export '../../chat/ui/chat_widgets.dart' show ChatAvatar, charAt0;
export '../../settings/ui/settings_ui.dart' show px, ALoader, ARingSpinner, VGap, ATopbar, AIconBtn, AWordmark, AEyebrow;

/// `.community-native-text` (15px / 1.6) inside `.a-scope` on `--a-bg`.
class CommunityScope extends StatelessWidget {
  const CommunityScope({super.key, required this.child, this.background = true});
  final Widget child;
  final bool background;
  @override
  Widget build(BuildContext context) {
    final body = DefaultTextStyle.merge(style: px(15, color: context.a.ink, height: 1.6), child: child);
    return background ? ColoredBox(color: context.a.bg, child: body) : body;
  }
}

/// `.community-count-badge` (top/end -4, min 18x18, #d74757, white 10/800).
class CommunityCountBadge extends StatelessWidget {
  const CommunityCountBadge(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => PositionedDirectional(
        top: -4,
        end: -4,
        child: Container(
          constraints: const BoxConstraints(minWidth: 18),
          height: 18,
          padding: const EdgeInsets.symmetric(horizontal: 4),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: const Color(0xFFD74757), borderRadius: BorderRadius.circular(999)), // anacan-design.css literal
          child: Text(text, style: px(10, weight: FontWeight.w800, color: const Color(0xFFFFFFFF), height: 1)),
        ),
      );
}

/// One `.community-feed-tabs .a-tab` chip (min-height 42, padding 10x13, 13px, 1px line, surface; active peach).
class CommunityTabChip extends StatelessWidget {
  const CommunityTabChip({super.key, required this.label, required this.active, required this.onTap, this.icon});
  final String label;
  final bool active;
  final VoidCallback onTap;
  final AIconData? icon;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final color = active ? a.accentInk : a.inkSoft;
    return Semantics(
      button: true,
      selected: active,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 42),
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
          decoration: BoxDecoration(
            color: active ? a.peach1 : a.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: active ? a.peach2 : a.line),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (icon != null) ...[AIcon(icon!, size: 15, color: color), const SizedBox(width: 6)],
            Text(label, style: px(13, weight: FontWeight.w700, color: color, height: 1.2)),
          ]),
        ),
      ),
    );
  }
}

/// `.community-feed-tabs` (flex, gap 7, horizontal scroll, padding 3 1 10, margin-bottom 8).
class CommunityFeedTabs extends StatelessWidget {
  const CommunityFeedTabs({super.key, required this.children, this.semanticLabel});
  final List<Widget> children;
  final String? semanticLabel;
  @override
  Widget build(BuildContext context) => Semantics(
        label: semanticLabel,
        container: true,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(1, 3, 1, 10),
            child: Row(children: [
              for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(width: 7), children[i]],
            ]),
          ),
        ),
      );
}

/// `.a-tag` (pill, surface-soft chip, 11/600) with an optional `.on` state.
class ATagChip extends StatelessWidget {
  const ATagChip({super.key, required this.child, this.onTap, this.on = false, this.enabled = true});
  final Widget child;
  final VoidCallback? onTap;
  final bool on;
  final bool enabled;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget body = Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
      decoration: BoxDecoration(
        color: on ? a.tagOnBg : a.surfaceSoft,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: on ? a.peach2 : a.line),
      ),
      child: DefaultTextStyle.merge(
        style: px(11, weight: FontWeight.w600, color: on ? a.accentInk : a.inkSoft, height: 1.3),
        child: IconTheme.merge(data: IconThemeData(color: on ? a.accentInk : a.inkSoft, size: 14), child: child),
      ),
    );
    if (!enabled) body = Opacity(opacity: 0.4, child: body);
    return Semantics(
      button: onTap != null,
      enabled: enabled,
      selected: on,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: enabled ? onTap : null, child: body),
    );
  }
}

/// `.a-list-title` / `.a-list-sub`.
TextStyle aListTitle(BuildContext context) => px(14, weight: FontWeight.w700, color: context.a.ink, height: 1.35);
TextStyle aListSub(BuildContext context) => px(12, color: context.a.inkSoft, height: 1.45);

/// shadcn `<Skeleton>` (`animate-pulse rounded-md bg-muted`).
class ASkeleton extends StatefulWidget {
  const ASkeleton({super.key, this.height, this.width, this.radius = 16, this.circle = false});
  final double? height;
  final double? width;
  final double radius;
  final bool circle;
  @override
  State<ASkeleton> createState() => _ASkeletonState();
}

class _ASkeletonState extends State<ASkeleton> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 2));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!MediaQuery.disableAnimationsOf(context) && !_c.isAnimating) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          // pulse: opacity 1 → .5 → 1 (cubic-bezier(.4,0,.6,1))
          final t = _c.value;
          final opacity = t < 0.5 ? 1 - t : t;
          return Opacity(
            opacity: opacity.clamp(0.5, 1.0),
            child: Container(
              height: widget.height,
              width: widget.width,
              decoration: BoxDecoration(
                color: context.tokens.shadcn.muted,
                shape: widget.circle ? BoxShape.circle : BoxShape.rectangle,
                borderRadius: widget.circle ? null : BorderRadius.circular(widget.radius),
              ),
            ),
          );
        },
      );
}

/// A tap target with a label (`<button aria-label>`).
class CommunityButton extends StatelessWidget {
  const CommunityButton({super.key, required this.child, this.onTap, this.label, this.enabled = true, this.selected, this.tapScale});
  final Widget child;
  final VoidCallback? onTap;
  final String? label;
  final bool enabled;
  final bool? selected;
  final double? tapScale;

  @override
  Widget build(BuildContext context) {
    Widget body = child;
    if (tapScale != null) {
      body = PressScale(scale: tapScale!, enabled: enabled && onTap != null, onTap: enabled ? onTap : null, child: body);
    } else {
      body = GestureDetector(behavior: HitTestBehavior.opaque, onTap: enabled ? onTap : null, child: body);
    }
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      selected: selected,
      excludeSemantics: label != null,
      child: body,
    );
  }
}

/// The initial-letter avatar fallback used across the community screens.
Widget avatarInitial(BuildContext context, String? name, {String fallback = 'A', double size = 14, Color? color}) =>
    Text(charAt0(name).isEmpty ? fallback : charAt0(name), style: px(size, weight: FontWeight.w700, color: color ?? context.a.accentInk, height: 1));

/// The avatar of a profile card (`<Avatar><AvatarImage/><AvatarFallback/></Avatar>`).
class CommunityAvatar extends StatelessWidget {
  const CommunityAvatar({super.key, required this.size, this.url, this.name, this.fallback = 'A', this.fallbackColor, this.border, this.fallbackWidget});
  final double size;
  final String? url;
  final String? name;
  final String fallback;
  final Color? fallbackColor;
  final BoxBorder? border;
  final Widget? fallbackWidget;
  @override
  Widget build(BuildContext context) => ChatAvatar(
        size: size,
        url: url,
        border: border,
        fallbackColor: fallbackColor,
        fallback: fallbackWidget ?? avatarInitial(context, name, fallback: fallback, size: size * 0.4),
      );
}

/// lucide `Loader2` + `animate-spin`.
Widget spinner({double size = 16, Color? color}) => ALoader(size: size, color: color);

const Map<String, String> _filledPaths = {
  'heart': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  'bookmark': '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  'pin': '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  'badge-check': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4" fill="none"/>',
};

String _hex(Color c) => '#${(c.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';

/// A lucide glyph with `fill` (e.g. `<Heart fill="currentColor" />`, `<BadgeCheck fill="#0095F6" color="#fff" />`).
class LucideFilled extends StatelessWidget {
  const LucideFilled(this.name, {super.key, required this.size, required this.fill, Color? stroke, this.strokeWidth = 2}) : stroke = stroke ?? fill;
  final String name;
  final double size;
  final Color fill;
  final Color stroke;
  final double strokeWidth;
  @override
  Widget build(BuildContext context) {
    final svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${_hex(fill)}" fill-opacity="${fill.a}" '
        'stroke="${_hex(stroke)}" stroke-width="$strokeWidth" stroke-linecap="round" stroke-linejoin="round">${_filledPaths[name]}</svg>';
    return SvgPicture.string(svg, width: size, height: size);
  }
}
// Ported from: src/components/tools/play/play-together.css (.pt-*), src/components/tools/exercises/kid-exercises.css
//              (.ke-*): the two stylesheets share the same classes under different prefixes (chips, cards, week dots,
//              headings, eyebrow, empty line, CTA, sticky bar)
//
// Look primitives shared by Uşaqla oyun and Uşaq məşqləri.
import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/count_format.dart' show formatIntlNumber;
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show cssUpper, px;
import '../health_common/health_ui.dart' show ATap;

/// `fill(template, vars)`: `{name}` placeholders; unknown names stay.
String kidsFill(String template, Map<String, Object> vars) =>
    template.replaceAllMapped(RegExp(r'\{([a-z]+)\}'), (m) => vars.containsKey(m[1]) ? '${vars[m[1]]}' : m[0]!);

/// `new Intl.NumberFormat(language).format(n)` (falls back to the plain number).
String kidsNum(String language, num n) {
  try {
    return formatIntlNumber(language, n);
  } catch (_) {
    return '$n';
  }
}

/// `.pt-wrap` / `.ke-wrap` (column, gap 10, padding-bottom 24).
class KidsWrap extends StatelessWidget {
  const KidsWrap({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 10), children[i]],
        ]),
      );
}

/// `.pt-h2` / `.ke-h2` (16/800 ink, 14 above).
class KidsH2 extends StatelessWidget {
  const KidsH2(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) =>
      Padding(padding: const EdgeInsets.only(top: 14), child: Text(text, style: px(16, weight: FontWeight.w800, color: context.a.ink)));
}

/// `.pt-sub` / `.ke-sub` (12.5 ink-soft, margin -6 0 2, line-height 1.4).
class KidsSub extends StatelessWidget {
  const KidsSub(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Transform.translate(
        offset: const Offset(0, -6),
        child: Padding(
          padding: const EdgeInsets.only(bottom: 2),
          child: Text(text, style: px(12.5, color: context.a.inkSoft, height: 1.4)),
        ),
      );
}

/// `.pt-eyebrow` / `.ke-eyebrow` (11/800, .04em, upper-case, ink-soft, 6 below, optional leading icon gap 5).
class KidsEyebrow extends StatelessWidget {
  const KidsEyebrow(this.text, {super.key, this.icon, this.color, this.language});
  final String text;
  final Widget? icon;
  final Color? color;
  final String? language;
  @override
  Widget build(BuildContext context) {
    final c = color ?? context.a.inkSoft;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(children: [
        if (icon != null) ...[IconTheme.merge(data: IconThemeData(color: c), child: icon!), const SizedBox(width: 5)],
        Flexible(child: Text(cssUpper(text, language), style: px(11, weight: FontWeight.w800, color: c, ls: 0.44))),
      ]),
    );
  }
}

/// `.pt-card` / `.ke-card` (surface, 1px line, `--a-radius-lg`, padding 14) with tinted variants.
class KidsCard extends StatelessWidget {
  const KidsCard({super.key, required this.child, this.background, this.borderless = false});
  final Widget child;
  final Color? background;
  final bool borderless;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: background ?? a.surface,
        borderRadius: BorderRadius.circular(a.radiusLg),
        border: Border.all(color: borderless ? const Color(0x00000000) : a.line),
      ),
      child: child,
    );
  }
}

/// `.pt-chip` / `.ke-chip` (pill, padding 7 12, 12.5/700, surface + line; `.on` coral / on-coral).
class KidsChip extends StatelessWidget {
  const KidsChip({super.key, required this.label, required this.on, required this.onTap, this.leading, this.tab = false});
  final String label;
  final bool on;
  final VoidCallback onTap;
  final Widget? leading;

  /// `role="tab"` (`aria-selected`).
  final bool tab;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = on ? a.onCoral : a.ink;
    return Semantics(
      button: !tab,
      selected: on,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: on ? a.coral : a.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: on ? a.coral : a.line),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            if (leading != null) ...[IconTheme.merge(data: IconThemeData(color: fg), child: leading!), const SizedBox(width: 4)],
            Text(label, maxLines: 1, softWrap: false, style: px(12.5, weight: FontWeight.w700, color: fg)),
          ]),
        ),
      ),
    );
  }
}

/// `.pt-ages` / `.pt-cats` / `.ke-ages` / `.ke-filters` (horizontal scroll row, gap 6, padding 2 0 4, no scrollbar).
class KidsChipRow extends StatelessWidget {
  const KidsChipRow({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.only(top: 2, bottom: 4),
        child: Row(children: [
          for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(width: 6), children[i]],
        ]),
      );
}

/// `.pt-week` / `.ke-week`: seven 12px dots (gap 6); `.on` coral, `.today` a 2px coral-soft outline 1px off.
class KidsWeekDots extends StatelessWidget {
  const KidsWeekDots({super.key, required this.days, this.hint});
  final List<({String day, bool on, bool today, String label})> days;
  final String? hint;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final row = Row(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 0; i < days.length; i++) ...[
        if (i > 0) const SizedBox(width: 6),
        Semantics(
          label: days[i].label,
          child: SizedBox(
            width: 12,
            height: 12,
            child: Stack(clipBehavior: Clip.none, children: [
              // `outline: 2px solid; outline-offset: 1px` draws outside the box without taking space.
              if (days[i].today)
                Positioned(
                  left: -3,
                  top: -3,
                  right: -3,
                  bottom: -3,
                  child: DecoratedBox(decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: a.coralSoft, width: 2))),
                ),
              Positioned.fill(
                child: DecoratedBox(
                  key: ValueKey('kids-dot-${days[i].day}'),
                  decoration: BoxDecoration(
                    color: days[i].on ? a.coral : a.surfaceSoft,
                    shape: BoxShape.circle,
                    border: Border.all(color: days[i].on ? a.coral : a.line),
                  ),
                ),
              ),
            ]),
          ),
        ),
      ],
    ]);
    // `title={hint}`: no hover on a phone; exposed to assistive technology.
    return hint == null ? row : Semantics(tooltip: hint, child: row);
  }
}

/// `.pt-empty` / `.ke-empty` (13 ink-soft, centred, padding 18 8).
class KidsEmpty extends StatelessWidget {
  const KidsEmpty(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 18),
        child: Text(text, textAlign: TextAlign.center, style: px(13, color: context.a.inkSoft)),
      );
}

/// `.a-cta-btn.pt-cta` / `.ke-cta` (full width, centred, gap 8; `.done` on `--a-ok`).
class KidsCta extends StatelessWidget {
  const KidsCta({super.key, required this.label, required this.onTap, this.icon, this.done = false, this.buttonKey});
  final String label;
  final VoidCallback onTap;
  final AIconData? icon;
  final bool done;
  final Key? buttonKey;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return ATap(
      onTap: onTap,
      selected: done,
      child: Container(
        key: buttonKey,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
        decoration: BoxDecoration(color: done ? a.ok : a.peach2, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          if (icon != null) ...[AIcon(icon!, size: 16, color: const Color(0xFFFFFFFF)), const SizedBox(width: 8)],
          Flexible(child: Text(label, textAlign: TextAlign.center, style: px(12.5, weight: FontWeight.w700, color: const Color(0xFFFFFFFF)))),
        ]),
      ),
    );
  }
}

/// `position: sticky; bottom: calc(76px + env(safe-area-inset-bottom))` inside the shell's scroll view: the child
/// sits in flow at the end of the page; while that place is below the sticky line, a copy is pinned to the line
/// (an [OverlayPortal]) and the in-flow copy is hidden.
class KidsStickyBottom extends StatefulWidget {
  const KidsStickyBottom({super.key, required this.child, this.bottom = 76});
  final Widget child;
  final double bottom;
  @override
  State<KidsStickyBottom> createState() => _KidsStickyBottomState();
}

class _KidsStickyBottomState extends State<KidsStickyBottom> {
  final OverlayPortalController _portal = OverlayPortalController();
  final GlobalKey _slot = GlobalKey();
  ScrollPosition? _position;
  bool _pinned = false;
  double _width = 0;
  double _left = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final next = Scrollable.maybeOf(context)?.position;
    if (next != _position) {
      _position?.removeListener(_check);
      _position = next;
      _position?.addListener(_check);
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _check());
  }

  @override
  void dispose() {
    _position?.removeListener(_check);
    super.dispose();
  }

  void _check() {
    if (!mounted) return;
    final box = _slot.currentContext?.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize || !box.attached) return;
    final mq = MediaQuery.of(context);
    final line = mq.size.height - widget.bottom - mq.padding.bottom;
    final top = box.localToGlobal(Offset.zero);
    final pinned = top.dy + box.size.height > line;
    if (pinned != _pinned || box.size.width != _width || top.dx != _left) {
      setState(() {
        _pinned = pinned;
        _width = box.size.width;
        _left = top.dx;
      });
    }
    if (pinned && Overlay.maybeOf(context) != null) {
      if (!_portal.isShowing) _portal.show();
    } else if (_portal.isShowing) {
      _portal.hide();
    }
  }

  @override
  Widget build(BuildContext context) {
    final inFlow = KeyedSubtree(key: _slot, child: Visibility.maintain(visible: !_pinned || Overlay.maybeOf(context) == null, child: widget.child));
    if (Overlay.maybeOf(context) == null) return inFlow;
    final mq = MediaQuery.of(context);
    return OverlayPortal(
      controller: _portal,
      overlayChildBuilder: (_) => Positioned(
        left: _left,
        width: _width,
        bottom: widget.bottom + mq.padding.bottom,
        child: AScope(child: widget.child),
      ),
      child: inFlow,
    );
  }
}

/// A short `setInterval` that is cancelled with its owner.
class KidsTicker {
  Timer? _t;
  void start(Duration every, VoidCallback tick) {
    _t?.cancel();
    _t = Timer.periodic(every, (_) => tick());
  }

  void stop() {
    _t?.cancel();
    _t = null;
  }
}

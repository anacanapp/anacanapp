// Ported from: src/styles/anacan-design.css, src/index.css, tailwind.config.ts (visual inventory of the
//              generated tokens and the a-* primitives; no React counterpart — developer gallery only)
import 'package:material_ui/material_ui.dart';

import 'design.dart';

/// Developer gallery of every token and primitive, with light/dark, RTL and lite toggles.
/// Not routed from main.dart; push it from a debug menu: `MaterialPageRoute(builder: (_) => const DesignGallery())`.
class DesignGallery extends StatefulWidget {
  const DesignGallery({super.key, this.initialDark = false, this.initialRtl = false});
  final bool initialDark;
  final bool initialRtl;

  @override
  State<DesignGallery> createState() => _DesignGalleryState();
}

class _DesignGalleryState extends State<DesignGallery> {
  late bool _dark = widget.initialDark;
  late bool _rtl = widget.initialRtl;
  bool _lite = false;

  @override
  Widget build(BuildContext context) {
    return GalleryFrame(
      dark: _dark,
      rtl: _rtl,
      lite: _lite,
      child: Builder(
        builder: (context) {
          final t = AnacanTokens.of(context);
          return ColoredBox(
            color: t.a.bg,
            child: SafeArea(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                children: <Widget>[
                  Wrap(spacing: 8, runSpacing: 8, children: <Widget>[
                    _toggle('Dark', _dark, (v) => setState(() => _dark = v)),
                    _toggle('RTL (ar)', _rtl, (v) => setState(() => _rtl = v)),
                    _toggle('Lite', _lite, (v) => setState(() => _lite = v)),
                  ]),
                  const GalleryTypography(),
                  const GalleryPrimitives(),
                  const GalleryIcons(),
                  const GallerySwatches(),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _toggle(String label, bool v, ValueChanged<bool> on) => AButton(
        variant: v ? AButtonVariant.accent : AButtonVariant.ghost,
        size: AButtonSize.sm,
        onPressed: () => on(!v),
        child: Text(label),
      );
}

/// Theme + direction + scope wrapper used by the gallery and the golden tests.
class GalleryFrame extends StatelessWidget {
  const GalleryFrame({super.key, required this.child, this.dark = false, this.rtl = false, this.lite = false});
  final Widget child;
  final bool dark;
  final bool rtl;
  final bool lite;

  @override
  Widget build(BuildContext context) {
    final locale = rtl ? const Locale('ar') : const Locale('az');
    final theme = buildAnacanTheme(dark ? Brightness.dark : Brightness.light, locale: locale, lite: lite);
    return Theme(
      data: theme,
      child: Directionality(
        textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
        child: DefaultTextStyle(
          style: theme.textTheme.bodyMedium!,
          child: AToastHost(child: AScope(child: child)),
        ),
      ),
    );
  }
}

class _H extends StatelessWidget {
  const _H(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 24, bottom: 10),
        child: Text(text.toUpperCase(), style: context.aText.a3Eyebrow),
      );
}

/// a-/a3- text styles in the scope font, plus the body (Nunito) default outside the scope.
class GalleryTypography extends StatelessWidget {
  const GalleryTypography({super.key});

  @override
  Widget build(BuildContext context) {
    final x = context.aText;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final sample = rtl ? 'مرحبا أنا كان' : 'Salam, Anacan';
    final styles = <String, TextStyle>{
      'a3-wordmark': x.a3Wordmark,
      'a3-title': x.a3Title,
      'a3-sec-title': x.a3SecTitle,
      'a-section-title': x.aSectionTitle,
      'a-card-title': x.aCardTitle,
      'a3-hero-line': x.a3HeroLine,
      'a3-meta': x.a3Meta,
      'a3-link': x.a3Link,
      'a-cta-text': x.aCtaText,
      'a-list-title': x.aListTitle,
      'a-list-sub': x.aListSub,
    };
    final body = Theme.of(context).textTheme.bodyMedium!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const _H('Typography'),
        for (final e in styles.entries)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(children: <Widget>[
              SizedBox(width: 108, child: Text(e.key, style: x.a3Meta.copyWith(fontSize: 10))),
              Expanded(child: Text(sample, style: e.value, maxLines: 1, overflow: TextOverflow.ellipsis)),
            ]),
          ),
        Row(children: <Widget>[
          SizedBox(width: 108, child: Text('body (no scope)', style: x.a3Meta.copyWith(fontSize: 10))),
          Expanded(child: DefaultTextStyle(style: body, child: Text(sample))),
        ]),
      ],
    );
  }
}

/// Cards, sections, rings, buttons, tabs, sheet, toasts, glass.
class GalleryPrimitives extends StatefulWidget {
  const GalleryPrimitives({super.key, this.animate = true});

  /// false = rings without draw-in (stable goldens).
  final bool animate;

  @override
  State<GalleryPrimitives> createState() => _GalleryPrimitivesState();
}

class _GalleryPrimitivesState extends State<GalleryPrimitives> {
  String _seg = 'day';
  String _tab = 'w';
  String _tool = 'a';

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context);
    final a = t.a;
    final x = context.aText;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const _H('Cards & sections'),
        ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            ACardHead(title: 'a-card', trailing: AButton(variant: AButtonVariant.pillSoft, onPressed: () {}, child: const Text('a-btn-soft'))),
            Text('Padding 18, 1px --a-line, --a-radius-lg, --a-card-shadow', style: x.aCtaText),
          ]),
        ),
        const SizedBox(height: 12),
        ACard(
          variant: ACardVariant.list,
          child: Column(children: <Widget>[
            AListRow(
              first: true,
              title: 'a-list-row',
              subtitle: 'a-list-sub',
              leading: AListIcon(background: ATint.peach.of(a).$1, foreground: ATint.peach.of(a).$2, child: const AIcon(AIcons.heart, size: 20)),
              trailing: AIcon(AIcons.chevronRight, size: 18, color: a.inkFaint, mirrorInRtl: true),
            ),
            AListRow(
              title: 'c-blue tint',
              subtitle: 'second row has a top border',
              leading: AListIcon(background: ATint.blue.of(a).$1, foreground: ATint.blue.of(a).$2, child: const AIcon(AIcons.droplets, size: 20)),
            ),
          ]),
        ),
        ASection(
          title: 'a3-sec',
          linkLabel: 'Hamısı',
          onLink: () {},
          child: ACard(variant: ACardVariant.a3, child: Text('a3-card + a3-pad', style: x.a3Meta)),
        ),
        ASection(
          variant: ASectionVariant.a,
          title: 'a-section',
          linkLabel: 'a-section-link',
          child: ACard(variant: ACardVariant.cta, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
              decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
              child: Text('A-CTA-BADGE', style: x.aCtaBadge),
            ),
            Padding(padding: const EdgeInsets.only(top: 16, bottom: 8), child: Text('a-cta-title', style: x.aCtaTitle)),
            Text('a-cta-text with line-height 1.7 and --a-body-text colour.', style: x.aCtaText),
            const SizedBox(height: 12),
            AButton(variant: AButtonVariant.cta, onPressed: () {}, trailing: const AIcon(AIcons.chevronRight, size: 14, mirrorInRtl: true), child: const Text('a-cta-btn')),
          ])),
        ),
        const _H('Rings'),
        Wrap(spacing: 16, runSpacing: 16, crossAxisAlignment: WrapCrossAlignment.center, children: <Widget>[
          ARing(
            progress: 0.62,
            size: 136,
            strokeWidth: 10,
            tip: true,
            drawIn: widget.animate,
            child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[
              Text('24', style: x.a3RingValue),
              Text('həftə', style: x.a3RingLabel),
            ]),
          ),
          ARing(progress: 0.3, size: 44, strokeWidth: 4, drawIn: widget.animate, child: Text('30%', style: x.a3TkLabel)),
          const AConicRing(percent: 40, value: '1.2L', label: 'su'),
        ]),
        const _H('Buttons'),
        Wrap(spacing: 8, runSpacing: 8, children: <Widget>[
          for (final v in <AButtonVariant>[AButtonVariant.ink, AButtonVariant.accent, AButtonVariant.ghost, AButtonVariant.soft, AButtonVariant.danger])
            AButton(variant: v, size: AButtonSize.sm, onPressed: () {}, child: Text(v.name)),
          AButton(variant: AButtonVariant.accent, size: AButtonSize.sm, onPressed: null, child: const Text('disabled')),
          AButton(variant: AButtonVariant.pillSolid, onPressed: () {}, child: const Text('a-btn-solid')),
          AIconButton(solid: true, onPressed: () {}, icon: const AIcon(AIcons.bell, size: 20)),
          AIconButton(onPressed: () {}, icon: const AIcon(AIcons.moon, size: 20)),
        ]),
        const SizedBox(height: 8),
        AButton(variant: AButtonVariant.accent, block: true, onPressed: () {}, leading: const AIcon(AIcons.sparkles, size: 18), child: const Text('a3-btn accent block')),
        const _H('Tabs'),
        ASegmentedTabs<String>(
          items: const <ASegmentItem<String>>[ASegmentItem('day', 'Gün'), ASegmentItem('week', 'Həftə'), ASegmentItem('month', 'Ay')],
          selected: _seg,
          onChanged: (v) => setState(() => _seg = v),
        ),
        const SizedBox(height: 10),
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: ASegmentedTabs<String>(
            style: ASegmentedStyle.aTabs,
            items: const <ASegmentItem<String>>[ASegmentItem('w', 'Çəki'), ASegmentItem('h', 'Boy'), ASegmentItem('c', 'Baş çevrəsi')],
            selected: _tab,
            onChanged: (v) => setState(() => _tab = v),
          ),
        ),
        const SizedBox(height: 10),
        ASegmentedTabs<String>(
          style: ASegmentedStyle.toolTabs,
          items: const <ASegmentItem<String>>[ASegmentItem('a', 'Plan'), ASegmentItem('b', 'Tarix'), ASegmentItem('c', 'Məsləhət')],
          selected: _tool,
          onChanged: (v) => setState(() => _tool = v),
        ),
        const _H('Glass'),
        SizedBox(
          height: 96,
          child: Stack(children: <Widget>[
            Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(gradient: a.gradCta, borderRadius: BorderRadius.circular(20)))),
            Positioned(
              left: 12,
              right: 12,
              top: 12,
              child: AGlass.header(context: context, padding: const EdgeInsets.all(12), child: Text('AGlass.header (blur 18)', style: x.a3SecTitle)),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        AGlass.navCapsule(
          context: context,
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: const <Widget>[
            AIcon(AIcons.heart),
            AIcon(AIcons.baby),
            AIcon(AIcons.riApps2AiLine),
            AIcon(AIcons.bell),
          ]),
        ),
        const _H('Sheet (inline)'),
        SizedBox(
          height: 360,
          child: MediaQuery.removePadding(
            context: context,
            removeTop: true,
            removeBottom: true,
            child: Align(
              alignment: Alignment.bottomCenter,
              child: ASheet(
                full: false,
                title: const Text('a3-sheet'),
                onClose: () {},
                footer: AButton(variant: AButtonVariant.accent, block: true, onPressed: () {}, child: const Text('a3-sheet-bar')),
                children: <Widget>[Text('a3-sheet-body: column, gap 20, padding 6 16 28', style: x.a3Meta)],
              ),
            ),
          ),
        ),
        const _H('Toasts'),
        ASonnerToast.preview(type: AToastType.success, title: 'Yadda saxlanıldı', description: 'sonner toast.success'),
        const SizedBox(height: 8),
        ASonnerToast.preview(type: AToastType.error, title: 'Xəta baş verdi'),
        const SizedBox(height: 8),
        ARadixToast.preview(title: 'Radix toast', description: 'shadcn useToast()'),
        const SizedBox(height: 8),
        ARadixToast.preview(title: 'Destructive', description: 'variant: destructive', destructive: true),
      ],
    );
  }
}

/// A sample of the exported icons (every icon is exercised by test/design/icons_test.dart).
class GalleryIcons extends StatelessWidget {
  const GalleryIcons({super.key, this.limit = 48});
  final int limit;

  @override
  Widget build(BuildContext context) {
    final icons = AIcons.byImportName.values.toSet().take(limit).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
      const _H('Icons (lucide 24px / stroke 2)'),
      Wrap(spacing: 12, runSpacing: 12, children: <Widget>[for (final i in icons) AIcon(i)]),
      const SizedBox(height: 12),
      Wrap(spacing: 12, children: <Widget>[
        const AIcon(AIcons.heart, size: 16),
        const AIcon(AIcons.heart, size: 32, strokeWidth: 1.5),
        AIcon(AIcons.heart, size: 32, color: AnacanTokens.of(context).a.coral, strokeWidth: 2.5),
        const AIcon(AIcons.chevronLeft, mirrorInRtl: true),
      ]),
    ]);
  }
}

/// Every generated token as a swatch / gradient / shadow / value row.
class GallerySwatches extends StatelessWidget {
  const GallerySwatches({super.key, this.groups});

  /// Subset of group names (`shadcn`, `a`, `navCapsule`, `onboarding`, `aRing`, `lifeStages`); null = all.
  final Set<String>? groups;

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context);
    final all = <String, Map<String, Object>>{
      'a': t.a.byCssName,
      'shadcn': t.shadcn.byCssName,
      'navCapsule': t.navCapsule.byCssName,
      'onboarding': t.onboarding.byCssName,
      'aRing': t.aRing.byCssName,
      'lifeStages': <String, Object>{
        for (final e in t.lifeStages.entries) ...<String, Object>{
          '${e.key} base': e.value.base,
          '${e.key} light': e.value.light,
          '${e.key} dark': e.value.dark,
          '${e.key} gradient': e.value.gradient,
        },
      },
    };
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
      for (final g in all.entries)
        if (groups == null || groups!.contains(g.key)) ...<Widget>[
          _H('Tokens · ${g.key}'),
          Wrap(spacing: 8, runSpacing: 8, children: <Widget>[for (final e in g.value.entries) _Swatch(name: e.key, value: e.value)]),
        ],
    ]);
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch({required this.name, required this.value});
  final String name;
  final Object value;

  @override
  Widget build(BuildContext context) {
    final a = AnacanTokens.of(context).a;
    final label = Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: context.aText.a3Meta.copyWith(fontSize: 9.5, height: 1.2));
    Widget preview;
    final v = value;
    if (v is Color) {
      preview = Container(decoration: BoxDecoration(color: v, borderRadius: BorderRadius.circular(10), border: Border.all(color: a.line)));
    } else if (v is Gradient) {
      preview = Container(decoration: BoxDecoration(gradient: v, borderRadius: BorderRadius.circular(10)));
    } else if (v is List<BoxShadow>) {
      preview = Container(margin: const EdgeInsets.all(8), decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(8), boxShadow: v));
    } else if (v is Cubic) {
      preview = CustomPaint(painter: _CurvePainter(v, a.coral, a.line));
    } else {
      preview = Center(child: Text('$v', style: context.aText.a3Chip));
    }
    return SizedBox(
      width: 74,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
        SizedBox(width: 74, height: 44, child: preview),
        const SizedBox(height: 3),
        label,
      ]),
    );
  }
}

class _CurvePainter extends CustomPainter {
  _CurvePainter(this.curve, this.color, this.grid);
  final Curve curve;
  final Color color;
  final Color grid;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = grid);
    final p = Path();
    for (var i = 0; i <= 40; i++) {
      final x = i / 40;
      final y = curve.transform(x);
      final o = Offset(x * size.width, size.height - y * size.height * 0.8 - size.height * 0.1);
      i == 0 ? p.moveTo(o.dx, o.dy) : p.lineTo(o.dx, o.dy);
    }
    canvas.drawPath(p, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = color);
  }

  @override
  bool shouldRepaint(_CurvePainter old) => old.curve != curve || old.color != color;
}

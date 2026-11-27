// Ported from: src/components/tools/anacan/ToolKit.tsx (ToolPage, ToolHeader, ToolSectionsContext,
//              ToolSectionsBar, ToolEmpty, ToolLoading), src/styles/anacan-design.css (.a-scope, .a-shell, .a-topbar,
//              .a-eyebrow, .a-wordmark, .a-topbar-actions, .a-icon-btn, .a-card, .a-list-title, .a-list-sub,
//              .a-tool-sections, .a-tool-tabs, .a-tool-tab(.on), .a-tool-intro, .a-tool-intro-text,
//              .a-tool-intro-link), src/styles/startup.css (.a-topbar gap / min-height / padding-block, 44px back button)
//
// Shared chrome of every tool screen: peach page, top bar (+ merged-tool section tabs), empty and loading states.
// See app/lib/features/tools/README.md for the React → Dart table.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../shell/nav/shell_controller.dart' show scrollMemoryProvider;
import '../../settings/ui/settings_ui.dart' show AEyebrow, AIconBtn, ARingSpinner, AWordmark;

/// CSS `box-shadow` blur → Flutter `blurRadius` (sigma = blur / 2).
double _cssBlur(double blur) => (blur / 2 - 0.5) / 0.57735;

// ── ToolPage ──

/// `<ToolPage noShell>`: `.a-scope` page on `--a-bg` with `pb-24` (96px) and, unless [noShell], the `.a-shell`
/// 20px inline padding. Scrolls the shell's scroll container to the top when it mounts (`useScrollToTop()`).
///
/// The Tools tab is a box tab inside the shell's single scroll view: a tool body gets unbounded height, so use
/// plain Columns (no `Expanded`, no unbounded `ListView`). `minHeight: 100%` of the web page resolves to `auto`
/// there (the parent has no fixed height), so no minimum height is applied.
class ToolPage extends ConsumerStatefulWidget {
  const ToolPage({super.key, required this.child, this.noShell = false});

  final Widget child;

  /// Full-bleed screens: no `.a-shell` horizontal padding.
  final bool noShell;

  @override
  ConsumerState<ToolPage> createState() => _ToolPageState();
}

class _ToolPageState extends ConsumerState<ToolPage> {
  @override
  void initState() {
    super.initState();
    // Central guard: every tool page starts at the top, even when the tool itself forgets useScrollToTop.
    ref.read(scrollMemoryProvider).scrollToTop();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Padding(
          padding: EdgeInsets.only(left: widget.noShell ? 0 : 20, right: widget.noShell ? 0 : 20, bottom: 96),
          child: widget.child,
        ),
      ),
    );
  }
}

// ── Merged tool sections (ToolSectionsContext) ──

/// One tab of a merged host tool.
@immutable
class ToolSection {
  const ToolSection({required this.id, required this.label, this.locked = false});
  final String id;
  final String label;

  /// Premium section for a free user (small lock after the label).
  final bool locked;

  @override
  bool operator ==(Object other) => other is ToolSection && other.id == id && other.label == label && other.locked == locked;
  @override
  int get hashCode => Object.hash(id, label, locked);
}

/// `ToolSectionsValue`: provided by the Tools hub around an open tool; tools need no changes.
@immutable
class ToolSectionsValue {
  const ToolSectionsValue({this.sections, this.active, this.onSelect, this.intro, this.link});

  /// Host sections (tabs) when there are more than one.
  final List<ToolSection>? sections;
  final String? active;
  final ValueChanged<String>? onSelect;

  /// One-line intro (sleep pair: the tool's own description).
  final String? intro;

  /// Link to the companion tool.
  final ({String label, VoidCallback onOpen})? link;
}

/// `ToolSectionsContext.Provider` / `useContext(ToolSectionsContext)`.
class ToolSections extends InheritedWidget {
  const ToolSections({super.key, required this.value, required super.child});

  final ToolSectionsValue? value;

  /// The nearest value, or null (a tool rendered outside the hub).
  static ToolSectionsValue? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<ToolSections>()?.value;

  @override
  bool updateShouldNotify(ToolSections oldWidget) {
    final a = value, b = oldWidget.value;
    if (a == null || b == null) return a != b;
    return !listEquals(a.sections, b.sections) || a.active != b.active || a.intro != b.intro || a.link?.label != b.link?.label ||
        a.onSelect != b.onSelect || a.link?.onOpen != b.link?.onOpen;
  }
}

/// `<ToolSectionsBar />` (`.a-tool-sections`): section tabs of a merged host and/or the companion intro line.
/// Renders nothing outside the hub or when there is nothing to show. [ToolHeader] already includes it.
class ToolSectionsBar extends StatelessWidget {
  const ToolSectionsBar({super.key});

  @override
  Widget build(BuildContext context) {
    final ctx = ToolSections.maybeOf(context);
    if (ctx == null) return const SizedBox.shrink();
    final tabs = ctx.sections != null && ctx.sections!.length > 1 ? ctx.sections! : null;
    if (tabs == null && ctx.intro == null && ctx.link == null) return const SizedBox.shrink();
    final hasIntro = (ctx.intro != null && ctx.intro!.isNotEmpty) || ctx.link != null;
    // `.a-tool-sections { display: flex; flex-direction: column; gap: 8px; margin: -4px 0 12px }`
    return Transform.translate(
      offset: const Offset(0, -4),
      child: Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (tabs != null) _ToolTabs(tabs: tabs, active: ctx.active, onSelect: ctx.onSelect),
            if (tabs != null && hasIntro) const SizedBox(height: 8),
            if (hasIntro) _ToolIntro(intro: ctx.intro, link: ctx.link),
          ],
        ),
      ),
    );
  }
}

/// `.a-tool-tabs` (role tablist): `--a-line` track, padding 4, gap 4, radius 999, horizontal scroll; each
/// `.a-tool-tab` is `flex: 1 0 auto` (content width, the free space shared equally), min-height 36, padding 0 14.
class _ToolTabs extends StatelessWidget {
  const _ToolTabs({required this.tabs, required this.active, required this.onSelect});
  final List<ToolSection> tabs;
  final String? active;
  final ValueChanged<String>? onSelect;

  static const double _pad = 14;
  static const double _gap = 4;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = context.aText.aToolTab;
    final scaler = MediaQuery.textScalerOf(context);
    final dir = Directionality.of(context);
    double contentWidth(ToolSection t) {
      final tp = TextPainter(text: TextSpan(text: t.label, style: style), textDirection: dir, textScaler: scaler, maxLines: 1)..layout();
      final w = tp.width + _pad * 2 + (t.locked ? 4 + 10 : 0);
      tp.dispose();
      return w;
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: a.line, borderRadius: BorderRadius.circular(999)),
      child: LayoutBuilder(builder: (context, c) {
        final widths = tabs.map(contentWidth).toList();
        final used = widths.fold<double>(0, (s, w) => s + w) + _gap * (tabs.length - 1);
        final extra = c.maxWidth.isFinite && used < c.maxWidth ? (c.maxWidth - used) / tabs.length : 0.0;
        final row = Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < tabs.length; i++) ...[
              if (i > 0) const SizedBox(width: _gap),
              SizedBox(width: widths[i] + extra, child: _tab(context, tabs[i], style)),
            ],
          ],
        );
        return SingleChildScrollView(scrollDirection: Axis.horizontal, child: row);
      }),
    );
  }

  Widget _tab(BuildContext context, ToolSection t, TextStyle style) {
    final a = context.a;
    final on = active == t.id;
    final color = on ? a.ink : a.inkSoft;
    return Semantics(
      selected: on,
      button: true,
      label: t.label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onSelect == null ? null : () => onSelect!(t.id),
        child: Container(
          key: ValueKey('tool-tab-${t.id}'),
          constraints: const BoxConstraints(minHeight: 36),
          padding: const EdgeInsets.symmetric(horizontal: _pad),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: on ? a.surface : null,
            borderRadius: BorderRadius.circular(999),
            // `.a-tool-tab.on { box-shadow: 0 1px 6px rgba(0,0,0,.08) }`
            boxShadow: on ? [BoxShadow(color: const Color(0x14000000), offset: const Offset(0, 1), blurRadius: _cssBlur(6))] : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(t.label, maxLines: 1, softWrap: false, style: style.copyWith(color: color)),
              if (t.locked)
                Padding(
                  padding: const EdgeInsetsDirectional.only(start: 4),
                  child: Opacity(opacity: 0.7, child: AIcon(AIcons.lock, size: 10, strokeWidth: 2.6, color: color)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// `.a-tool-intro`: surface row (padding 8 12, radius 14, 12px / 1.35 `--a-ink-soft`), a two-line intro and the
/// coral companion link with a chevron.
class _ToolIntro extends StatelessWidget {
  const _ToolIntro({required this.intro, required this.link});
  final String? intro;
  final ({String label, VoidCallback onOpen})? link;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final text = TextStyle(fontSize: 12, height: 1.35, color: a.inkSoft, leadingDistribution: TextLeadingDistribution.even);
    final hasIntro = intro != null && intro!.isNotEmpty;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(14)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          if (hasIntro) Flexible(child: Text(intro!, maxLines: 2, overflow: TextOverflow.ellipsis, style: text)),
          if (hasIntro && link != null) const SizedBox(width: 10),
          if (link != null)
            Semantics(
              button: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: link!.onOpen,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    // `color: var(--a-coral-text, #E0484E)`: the variable is always defined.
                    Text(link!.label, maxLines: 1, softWrap: false, style: text.copyWith(fontWeight: FontWeight.w700, color: a.coralText, height: 1.5)),
                    const SizedBox(width: 2),
                    AIcon(AIcons.chevronRight, size: 13, strokeWidth: 2.6, color: a.coralText, mirrorInRtl: true),
                  ]),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── ToolHeader ──

/// `<ToolHeader title eyebrow onBack actions />`: `.a-topbar` (startup.css: gap 12, min-height 64, padding-block 12)
/// with the 44px `.a-icon-btn` back button (`whileTap` 0.9, `ArrowLeft` 16, mirrored in RTL, label
/// `common_back`), the `.a-eyebrow` line, the 16px `.a-wordmark` title and `.a-topbar-actions` (gap 8), followed by
/// [ToolSectionsBar].
class ToolHeader extends StatelessWidget {
  const ToolHeader({super.key, required this.title, this.eyebrow, this.eyebrowChild, this.onBack, this.actions = const []});

  final String title;

  /// Small upper-case line above the title.
  final String? eyebrow;

  /// A rich eyebrow (ReactNode); rendered in the `.a-eyebrow` style (upper-case strings yourself).
  final Widget? eyebrowChild;
  final VoidCallback? onBack;

  /// Right-side buttons (use [ToolIconButton] / `AButton(variant: AButtonVariant.pillSoft)`).
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final eyebrowWidget = eyebrowChild != null
        ? Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: DefaultTextStyle.merge(
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: a.onBgSoft, height: 1.5),
              child: eyebrowChild!,
            ),
          )
        : eyebrow != null
            ? AEyebrow(eyebrow!)
            : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Row(children: [
                    if (onBack != null) ...[
                      ToolIconButton(
                        onTap: onBack,
                        size: 44,
                        semanticLabel: tr('common_back', 'Geri'),
                        icon: const AIcon(AIcons.arrowLeft, size: 16, mirrorInRtl: true),
                      ),
                      const SizedBox(width: 10),
                    ],
                    Flexible(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [?eyebrowWidget, AWordmark(title, fontSize: 16)],
                      ),
                    ),
                  ]),
                ),
                if (actions.isNotEmpty) ...[
                  const SizedBox(width: 12),
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    for (var i = 0; i < actions.length; i++) ...[if (i > 0) const SizedBox(width: 8), actions[i]],
                  ]),
                ],
              ],
            ),
          ),
        ),
        const ToolSectionsBar(),
      ],
    );
  }
}

/// `.a-icon-btn` (38px; 44px in the top bar, startup.css) with framer `whileTap={{ scale }}` (default 0.9).
class ToolIconButton extends StatelessWidget {
  const ToolIconButton({super.key, required this.icon, this.onTap, this.size = 38, this.tapScale = 0.9, this.semanticLabel});
  final Widget icon;
  final VoidCallback? onTap;
  final double size;
  final double tapScale;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final button = AIconBtn(icon: icon, onTap: onTap, size: size, tapScale: tapScale, semanticLabel: semanticLabel);
    // `.a-icon-btn:disabled { opacity: 0.4 }`
    return onTap == null ? Opacity(opacity: 0.4, child: button) : button;
  }
}

// ── ToolEmpty / ToolLoading ──

/// `<ToolEmpty icon title text action />`: `.a-card` (padding 34 18, centred) with a 64px `--a-surface-soft`
/// circle (emoji 28px), `.a-list-title`, `.a-list-sub` (16px below when there is an action) and the action.
class ToolEmpty extends StatelessWidget {
  const ToolEmpty({super.key, required this.icon, required this.title, this.text, this.action});

  /// An emoji `Text('🍼')` or an [AIcon].
  final Widget icon;
  final String title;
  final String? text;

  /// Optional CTA, e.g. `AButton(variant: AButtonVariant.cta, …)`.
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    return ACard(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 34),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            margin: const EdgeInsets.only(bottom: 16),
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.surfaceSoft, shape: BoxShape.circle),
            child: DefaultTextStyle.merge(style: const TextStyle(fontSize: 28, height: 1.5), child: icon),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(title, textAlign: TextAlign.center, style: x.aListTitle),
          ),
          if (text != null)
            Padding(
              padding: EdgeInsets.only(bottom: action != null ? 16 : 0),
              child: Text(text!, textAlign: TextAlign.center, style: x.aListSub),
            ),
          ?action,
        ],
      ),
    );
  }
}

/// `<ToolLoading />`: full-screen (`min-h-screen`) `--a-bg` with the 32px peach spinner (3px `--a-peach-2` ring,
/// top transparent).
class ToolLoading extends StatelessWidget {
  const ToolLoading({super.key});

  @override
  Widget build(BuildContext context) {
    return AScope(
      child: Container(
        color: context.a.bg,
        constraints: BoxConstraints(minHeight: MediaQuery.sizeOf(context).height),
        alignment: Alignment.center,
        child: ARingSpinner(size: 32, width: 3, color: context.a.peach2),
      ),
    );
  }
}

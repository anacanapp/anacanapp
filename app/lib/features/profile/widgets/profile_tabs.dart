// Ported from: src/components/profile/ProfileTabs.tsx
//
// Profile layout "Mən · Ailə · Ayarlar": centred identity, a segmented switch with a sliding pill
// (framer layoutId, spring 420/34) and one short page per tab; plus the tinted row list (ProfileRows).
import 'package:flutter/physics.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart';

enum ProfileTab { me, family, settings }

/// One row of [ProfileRows]. [tint] = (background, ink); default `--a-surface-soft` / `--a-ink-soft`.
class ProfileRow {
  const ProfileRow({required this.id, required this.icon, required this.label, this.sub, this.badge, this.tint});
  final String id;
  final AIconData icon;
  final String label;
  final String? sub;
  final String? badge;
  final (Color, Color)? tint;
}

class ProfileRows extends StatelessWidget {
  const ProfileRows({super.key, required this.rows, required this.onPick, this.title, this.compact = false});
  final List<ProfileRow> rows;
  final ValueChanged<String> onPick;
  final String? title;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const SizedBox.shrink();
    final a = context.a;
    final x = context.aText;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
        if (title != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
            child: Text(cssUpper(title!), style: px(12, weight: FontWeight.w800, color: a.inkSoft, ls: 0.06)),
          ),
        ACard(
          variant: ACardVariant.list,
          child: Column(children: <Widget>[
            for (var i = 0; i < rows.length; i++)
              Semantics(
                button: true,
                child: GestureDetector(
                  key: ValueKey<String>('profile-row-${rows[i].id}'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onPick(rows[i].id),
                  child: Container(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: compact ? 10 : 14),
                    decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: a.line))),
                    child: Row(children: <Widget>[
                      Container(
                        width: compact ? 30 : 38,
                        height: compact ? 30 : 38,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: rows[i].tint?.$1 ?? a.surfaceSoft, borderRadius: BorderRadius.circular(compact ? 10 : 12)),
                        child: AIcon(rows[i].icon, size: compact ? 14 : 18, color: rows[i].tint?.$2 ?? a.inkSoft),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                          Text(rows[i].label, style: compact ? x.aListSub.copyWith(fontWeight: FontWeight.w600) : x.aListTitle),
                          if (rows[i].sub != null && !compact) Padding(padding: const EdgeInsets.only(top: 2), child: Text(rows[i].sub!, style: x.aListSub)),
                        ]),
                      ),
                      if (rows[i].badge != null) ...<Widget>[const SizedBox(width: 12), ATagOn(rows[i].badge!)],
                      const SizedBox(width: 12),
                      AIcon(AIcons.chevronRight, size: compact ? 14 : 16, color: a.inkFaint, mirrorInRtl: true),
                    ]),
                  ),
                ),
              ),
          ]),
        ),
      ]),
    );
  }
}

class ProfileTabs extends StatelessWidget {
  const ProfileTabs({
    super.key,
    required this.tab,
    required this.onTab,
    required this.name,
    required this.avatarUrl,
    required this.emoji,
    required this.badge,
    required this.onEdit,
    required this.me,
    required this.family,
    required this.settings,
    this.showFamily = true,
    this.avatarBuilder,
  });
  final ProfileTab tab;
  final ValueChanged<ProfileTab> onTab;
  final String name;
  final String? avatarUrl;
  final String emoji;
  final String badge;
  final VoidCallback onEdit;
  final Widget me;
  final Widget family;
  final Widget settings;
  final bool showFamily;

  /// Renders a remote avatar (cached network image in the app; tests pass a placeholder).
  final Widget Function(String url)? avatarBuilder;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final tabs = <(ProfileTab, String)>[
      (ProfileTab.me, tr('profiletabs_me', 'Mən')),
      if (showFamily) (ProfileTab.family, tr('profiletabs_family', 'Ailə')),
      (ProfileTab.settings, tr('profiletabs_settings', 'Ayarlar')),
    ];
    final active = tabs.any((t) => t.$1 == tab) ? tab : ProfileTab.me;
    final activeIndex = tabs.indexWhere((t) => t.$1 == active);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
      Padding(
        padding: const EdgeInsets.fromLTRB(0, 6, 0, 4),
        child: Column(children: <Widget>[
          Container(
            width: 76,
            height: 76,
            clipBehavior: Clip.antiAlias,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: a.gradPeach,
              shape: BoxShape.circle,
              boxShadow: <BoxShadow>[BoxShadow(color: a.coralSoft, spreadRadius: 4)],
            ),
            child: avatarUrl != null && avatarUrl!.isNotEmpty && avatarBuilder != null
                ? SizedBox.expand(child: avatarBuilder!(avatarUrl!))
                : Text(emoji, style: const TextStyle(fontSize: 34, height: 1.2)),
          ),
          const SizedBox(height: 6 + 4),
          Text(name, textAlign: TextAlign.center, style: px(19, weight: FontWeight.w700, color: a.ink, ls: -0.02)),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(color: a.coralSoft, borderRadius: BorderRadius.circular(999)),
            child: Text(badge, style: px(12, weight: FontWeight.w800, color: a.peachInk)),
          ),
          const SizedBox(height: 6 + 4),
          Semantics(
            button: true,
            child: GestureDetector(
              key: const ValueKey<String>('profile-edit'),
              behavior: HitTestBehavior.opaque,
              onTap: onEdit,
              child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                AIcon(AIcons.squarePen, size: 14, strokeWidth: 2.2, color: a.coralText),
                const SizedBox(width: 6),
                Text(tr('profiletabs_edit', 'Profili redaktə et'), style: px(13, weight: FontWeight.w800, color: a.coralText)),
              ]),
            ),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      Semantics(
        label: tr('untranslated_profil_v8b0sk', 'Profil'),
        container: true,
        child: Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.line)),
          child: _TabStrip(tabs: tabs, activeIndex: activeIndex, onTab: onTab),
        ),
      ),
      KeyedSubtree(
        key: ValueKey<ProfileTab>(active),
        child: switch (active) {
          ProfileTab.me => me,
          ProfileTab.family => family,
          ProfileTab.settings => settings,
        },
      ),
    ]);
  }
}

class _TabStrip extends StatefulWidget {
  const _TabStrip({required this.tabs, required this.activeIndex, required this.onTab});
  final List<(ProfileTab, String)> tabs;
  final int activeIndex;
  final ValueChanged<ProfileTab> onTab;
  @override
  State<_TabStrip> createState() => _TabStripState();
}

class _TabStripState extends State<_TabStrip> with SingleTickerProviderStateMixin {
  late final AnimationController _pos = AnimationController.unbounded(vsync: this, value: widget.activeIndex.toDouble());

  @override
  void didUpdateWidget(_TabStrip old) {
    super.didUpdateWidget(old);
    if (old.activeIndex != widget.activeIndex) {
      if (animationsDisabled(context)) {
        _pos.value = widget.activeIndex.toDouble();
      } else {
        _pos.animateWith(SpringSimulation(ASprings.spring(stiffness: 420, damping: 34), _pos.value, widget.activeIndex.toDouble(), _pos.velocity));
      }
    }
  }

  @override
  void dispose() {
    _pos.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final n = widget.tabs.length;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return LayoutBuilder(builder: (context, c) {
      final w = (c.maxWidth - 4 * (n - 1)) / n;
      return Stack(children: <Widget>[
        AnimatedBuilder(
          animation: _pos,
          builder: (context, _) {
            final left = _pos.value * (w + 4);
            return Positioned(
              top: 0,
              bottom: 0,
              left: rtl ? null : left,
              right: rtl ? left : null,
              width: w,
              child: DecoratedBox(decoration: BoxDecoration(color: a.deep, borderRadius: BorderRadius.circular(12))),
            );
          },
        ),
        Row(children: <Widget>[
          for (var i = 0; i < n; i++) ...<Widget>[
            if (i > 0) const SizedBox(width: 4),
            Expanded(
              child: Semantics(
                selected: i == widget.activeIndex,
                button: true,
                child: GestureDetector(
                  key: ValueKey<String>('profile-tab-${widget.tabs[i].$1.name}'),
                  behavior: HitTestBehavior.opaque,
                  onTap: () => widget.onTab(widget.tabs[i].$1),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Text(
                      widget.tabs[i].$2,
                      textAlign: TextAlign.center,
                      style: px(13.5, weight: i == widget.activeIndex ? FontWeight.w900 : FontWeight.w800, color: i == widget.activeIndex ? a.onDeep : a.ink),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ]),
      ]);
    });
  }
}

// Ported from: src/components/BottomNav.tsx, src/styles/anacan-design.css (.a-nav-wrap, .a-nav, .dark .a-nav,
//              .a-nav-item(.active), .a-nav-label, .a-nav-ai-icon, .a-nav-badge, .a-nav.capsule (+ .dark,
//              html.a-noblur, @supports fallback), .a-nav.capsule .a-nav-item(.active), .a-nav-avatar,
//              .a-nav.capsule .a-nav-badge, prefers-reduced-motion), src/index.css (.pb-nav)
//
// Not ported because the React component does not render them: the `.a-nav-ind` sliding indicator
// (480 ms bounce) exists in the CSS but BottomNav.tsx never emits it — the active tab is the item's own
// background (classic peach / capsule glass bubble). No haptic, no hide-on-scroll; the nav stays behind
// the keyboard (it is `position: fixed` to the layout viewport).
import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n/tr.dart';
import '../../design/design.dart';
import '../nav/ids.dart';
import '../nav/shell_controller.dart' show chatChromeHiddenProvider;
import '../shell_inputs.dart';

/// `.pb-nav`: nav height (~78px) + safe area + breathing room, the scroll container's bottom padding.
const double kPbNav = 108;

/// `.a-nav-wrap` padding-bottom (plus the safe-area inset).
const double kNavWrapBottom = 12;

/// `.a-nav-wrap` side padding.
const double kNavWrapSide = 16;

/// Pure bottom nav (both `bottom_nav_style` variants). [BottomNavCapsule] wires it to providers.
class BottomNavBar extends StatelessWidget {
  const BottomNavBar({
    super.key,
    required this.activeTab,
    required this.onTabChange,
    this.isPartner = false,
    this.style = BottomNavStyle.classic,
    this.unreadMessages = 0,
    this.communityUnread = 0,
    this.avatarUrl,
    this.displayName,
  });

  final ShellTab activeTab;
  final ValueChanged<ShellTab> onTabChange;
  final bool isPartner;
  final BottomNavStyle style;
  final int unreadMessages;
  final int communityUnread;
  final String? avatarUrl;
  final String? displayName;

  /// `data-tour="tab-<id>"` anchors for the onboarding tour.
  static final Map<String, GlobalKey> tourKeys = {};
  static GlobalKey tourKey(ShellTab tab) => tourKeys.putIfAbsent('tab-${tab.id}', () => GlobalKey(debugLabel: 'tab-${tab.id}'));

  /// Item key for tests (`nav-item-<id>`).
  static Key itemKey(ShellTab tab) => ValueKey('nav-item-${tab.id}');

  List<NavTabSpec> get tabs => isPartner ? kPartnerNavTabs : kWomanNavTabs;

  /// `(tab.id === 'chat' || (tab.id === 'home' && !isPartner)) && unreadCount > 0`.
  String? messageBadgeFor(ShellTab tab) {
    final shows = (tab == ShellTab.chat || (tab == ShellTab.home && !isPartner)) && unreadMessages > 0;
    return shows ? (unreadMessages > 9 ? '9+' : '$unreadMessages') : null;
  }

  /// Community unread posts (women only), `99+` cap.
  String? communityBadgeFor(ShellTab tab) {
    final shows = tab == ShellTab.community && !isPartner && communityUnread > 0;
    return shows ? (communityUnread > 99 ? '99+' : '$communityUnread') : null;
  }

  @override
  Widget build(BuildContext context) {
    final capsule = style == BottomNavStyle.capsule;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final t = AnacanTokens.of(context);
    final items = <Widget>[
      for (final spec in tabs)
        _NavItem(
          key: itemKey(spec.tab),
          spec: spec,
          active: activeTab == spec.tab,
          capsule: capsule,
          isPartner: isPartner,
          badges: [messageBadgeFor(spec.tab), communityBadgeFor(spec.tab)].whereType<String>().toList(),
          avatarUrl: avatarUrl,
          initial: _initial(displayName),
          onTap: () => onTabChange(spec.tab),
        ),
    ];
    final nav = capsule ? _capsule(context, t, items) : _classic(context, t, items);
    // .a-nav-wrap: fixed to the bottom, centred, pointer-events only on the nav itself.
    return Padding(
      padding: EdgeInsets.fromLTRB(kNavWrapSide, 0, kNavWrapSide, kNavWrapBottom + bottom),
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: capsule ? 360 : 394),
          child: Semantics(container: true, label: trInline('BottomNav.tsx', 'Primary'), explicitChildNodes: true, child: nav),
        ),
      ),
    );
  }

  static String _initial(String? name) {
    final n = (name ?? '').trim();
    return n.isEmpty ? '' : n.substring(0, 1).toUpperCase();
  }

  Widget _classic(BuildContext context, AnacanTokens t, List<Widget> items) {
    // .a-nav: padding 8, radius 24, --a-nav-bg, 1px --a-nav-border,
    // box-shadow 0 20px 40px -18px rgba(217,108,74,.4) (dark rgba(0,0,0,.6)) — one-off literals in the CSS.
    final shadow = BoxShadow(
      color: t.isDark ? const Color(0x99000000) : const Color(0x66D96C4A),
      offset: const Offset(0, 20),
      blurRadius: _cssBlur(40),
      spreadRadius: -18,
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        color: t.a.navBg,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: t.a.navBorder),
        boxShadow: [shadow],
      ),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) const SizedBox(width: 2),
              Expanded(child: items[i]),
            ],
          ],
        ),
      ),
    );
  }

  Widget _capsule(BuildContext context, AnacanTokens t, List<Widget> items) {
    final n = t.navCapsule;
    return AInsetShadow(
      shadows: n.glassShadowInset,
      borderRadius: BorderRadius.circular(34),
      child: AGlass.navCapsule(
        context: context,
        child: LayoutBuilder(builder: (context, c) {
          // flex: 1 1 0 with max-width 64 and gap 2, justify-content: space-between.
          final width = ((c.maxWidth - 2 * (items.length - 1)) / items.length).clamp(0.0, 64.0);
          return Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [for (final item in items) SizedBox(width: width, height: 52, child: item)],
          );
        }),
      ),
    );
  }
}

/// CSS box-shadow blur length → Flutter blurRadius (σ = blur / 2; the token generator uses the same map).
double _cssBlur(double cssBlur) => (cssBlur / 2 - 0.5) / 0.57735;

class _NavItem extends StatelessWidget {
  const _NavItem({
    super.key,
    required this.spec,
    required this.active,
    required this.capsule,
    required this.isPartner,
    required this.badges,
    required this.avatarUrl,
    required this.initial,
    required this.onTap,
  });

  final NavTabSpec spec;
  final bool active;
  final bool capsule;
  final bool isPartner;
  final List<String> badges;
  final String? avatarUrl;
  final String initial;
  final VoidCallback onTap;

  static AIconData _icon(ShellTab tab, bool isPartner) => switch (tab) {
        ShellTab.home => AIcons.house,
        ShellTab.tools => AIcons.riApps2AiLine,
        ShellTab.community => AIcons.users,
        ShellTab.ai => isPartner ? AIcons.compass : AIcons.sparkles,
        ShellTab.profile => AIcons.user,
        ShellTab.together => AIcons.heartHandshake,
        ShellTab.chat => AIcons.messageCircle,
        ShellTab.cakes => AIcons.house,
      };

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context);
    final reduce = animationsDisabled(context);
    final label = tr(spec.labelKey, spec.labelAz);
    final scope = AScope.scopeStyle(t);

    Widget item = capsule ? _capsuleItem(context, t, reduce) : _classicItem(context, t, scope, label, reduce);
    item = Stack(
      clipBehavior: Clip.none,
      children: [
        item,
        if (badges.isNotEmpty)
          for (final b in badges) _Badge(text: b, capsule: capsule),
      ],
    );
    return Semantics(
      button: true,
      selected: active,
      label: label,
      excludeSemantics: true,
      child: KeyedSubtree(
        key: BottomNavBar.tourKey(spec.tab),
        child: PressScale(scale: 0.92, onTap: onTap, child: item),
      ),
    );
  }

  Widget _classicItem(BuildContext context, AnacanTokens t, TextStyle scope, String label, bool reduce) {
    final color = active ? t.a.accentInk : t.a.inkFaint;
    const d = Duration(milliseconds: 150);
    Widget icon;
    if (spec.special) {
      icon = Container(
        width: 30,
        height: 30,
        margin: const EdgeInsets.only(bottom: 1),
        decoration: BoxDecoration(shape: BoxShape.circle, gradient: t.a.gradPeach),
        alignment: Alignment.center,
        child: AIcon(_icon(spec.tab, isPartner), size: 15, strokeWidth: 2.4, color: t.a.accentInk),
      );
    } else {
      final size = spec.tab == ShellTab.tools && !isPartner ? 17.0 : 19.0;
      icon = TweenAnimationBuilder<Color?>(
        tween: ColorTween(end: color),
        duration: reduce ? Duration.zero : d,
        curve: ACurves.cssEase,
        builder: (context, c, _) => AIcon(_icon(spec.tab, isPartner), size: size, strokeWidth: active ? 2.4 : 2, color: c),
      );
    }
    return AnimatedContainer(
      duration: reduce ? Duration.zero : d,
      curve: ACurves.cssEase,
      padding: const EdgeInsets.fromLTRB(2, 9, 2, 8),
      decoration: BoxDecoration(
        color: active ? t.a.peach1 : t.a.peach1.withValues(alpha: 0),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          icon,
          const SizedBox(height: 3),
          AnimatedDefaultTextStyle(
            duration: reduce ? Duration.zero : d,
            curve: ACurves.cssEase,
            style: scope.copyWith(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              height: 1.5,
              leadingDistribution: TextLeadingDistribution.even,
              color: color,
            ),
            child: Text(label, maxLines: 1, softWrap: false, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
          ),
        ],
      ),
    );
  }

  Widget _capsuleItem(BuildContext context, AnacanTokens t, bool reduce) {
    final n = t.navCapsule;
    final color = active ? n.iconOn : n.icon;
    final bg = Duration(milliseconds: reduce ? 0 : 220);
    final fg = Duration(milliseconds: reduce ? 0 : 200);
    Widget icon;
    if (spec.tab == ShellTab.profile) {
      icon = _Avatar(url: avatarUrl, initial: initial, active: active);
    } else if (spec.special) {
      // .a-nav.capsule .a-nav-ai-icon: no circle, coral glyph.
      icon = AIcon(_icon(spec.tab, isPartner), size: 21, strokeWidth: 2.1, color: t.a.coral);
    } else {
      final data = spec.tab == ShellTab.tools ? AIcons.layoutGrid : _icon(spec.tab, isPartner);
      final sw = spec.tab == ShellTab.tools ? (active ? 2.3 : 1.9) : (active ? 2.4 : 2.0);
      icon = TweenAnimationBuilder<Color?>(
        tween: ColorTween(end: color),
        duration: fg,
        curve: ACurves.cssEase,
        builder: (context, c, _) => AIcon(data, size: 22, strokeWidth: sw, color: c),
      );
    }
    final radius = BorderRadius.circular(26);
    return AnimatedContainer(
      duration: bg,
      curve: ACurves.ease,
      decoration: BoxDecoration(
        color: active ? n.bubble : n.bubble.withValues(alpha: 0),
        borderRadius: radius,
        boxShadow: active ? n.bubbleShadow : const [],
      ),
      child: AInsetShadow(
        shadows: active ? n.bubbleShadowInset : const [],
        borderRadius: radius,
        child: Center(child: icon),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.url, required this.initial, required this.active});
  final String? url;
  final String initial;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context);
    final ring = active
        ? BoxShadow(color: t.a.coral, spreadRadius: 2)
        : BoxShadow(color: t.navCapsule.icon, spreadRadius: 1.5);
    Widget child;
    if (url != null && url!.isNotEmpty) {
      child = Image.network(url!, width: 30, height: 30, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox());
    } else if (initial.isNotEmpty) {
      child = Text(
        initial,
        style: AScope.scopeStyle(t).copyWith(fontSize: 12, fontWeight: FontWeight.w900, color: t.a.peachInk, height: 1),
      );
    } else {
      child = AIcon(AIcons.user, size: 16, strokeWidth: 2.2, color: t.a.peachInk);
    }
    return Container(
      width: 30,
      height: 30,
      decoration: BoxDecoration(color: t.a.coralSoft, borderRadius: BorderRadius.circular(15), boxShadow: [ring]),
      clipBehavior: Clip.antiAlias,
      alignment: Alignment.center,
      child: child,
    );
  }
}

/// `.a-nav-badge` (scale 0 → 1 with framer's default scale spring).
class _Badge extends StatefulWidget {
  const _Badge({required this.text, required this.capsule});
  final String text;
  final bool capsule;

  @override
  State<_Badge> createState() => _BadgeState();
}

class _BadgeState extends State<_Badge> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController.unbounded(vsync: this, value: 0);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.value == 0 && !_c.isAnimating) {
      if (animationsDisabled(context) || AnacanTokens.of(context).lite) {
        _c.value = 1;
      } else {
        _c.animateWith(SpringSimulation(ASprings.tapScale, 0, 1, 0));
      }
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context);
    final capsule = widget.capsule;
    // Classic: #e05555 with a 2px --a-nav-bg ring; capsule: --a-coral with a 2px --nav-glass-edge ring.
    final bg = capsule ? t.a.coral : const Color(0xFFE05555);
    final ring = capsule ? t.navCapsule.glassEdge : t.a.navBg;
    // top: 5px (capsule 7px); inset-inline-start: calc(50% + 5px) (capsule + 4px).
    return PositionedDirectional(
      top: capsule ? 7 : 5,
      start: 0,
      end: 0,
      child: LayoutBuilder(builder: (context, c) {
        final start = c.maxWidth / 2 + (capsule ? 4 : 5);
        return Padding(
          padding: EdgeInsetsDirectional.only(start: start),
          child: Align(
            alignment: AlignmentDirectional.topStart,
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, child) => Transform.scale(scale: _c.value, child: child),
              child: Container(
                key: const ValueKey('nav-badge'),
                constraints: const BoxConstraints(minWidth: 15),
                height: 15,
                padding: const EdgeInsets.symmetric(horizontal: 4),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: [BoxShadow(color: ring, spreadRadius: 2)],
                ),
                alignment: Alignment.center,
                child: Text(
                  widget.text,
                  style: AScope.scopeStyle(t).copyWith(
                    fontSize: 8.5,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFFFFFFFF),
                    height: 1,
                  ),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }
}

/// The bottom nav wired to the shell inputs (`BottomNav` with its hooks). Hidden while a full-screen
/// chat holds a lease (`useChatChromeHidden`).
class BottomNavCapsule extends ConsumerWidget {
  const BottomNavCapsule({super.key, required this.activeTab, required this.onTabChange, required this.isPartner});
  final ShellTab activeTab;
  final ValueChanged<ShellTab> onTabChange;
  final bool isPartner;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (ref.watch(chatChromeHiddenProvider)) return const SizedBox.shrink();
    final user = ref.watch(shellUserProvider);
    return BottomNavBar(
      activeTab: activeTab,
      onTabChange: onTabChange,
      isPartner: isPartner,
      style: ref.watch(bottomNavStyleProvider),
      unreadMessages: ref.watch(unreadMessagesCountProvider),
      communityUnread: ref.watch(unreadCommunityPostsCountProvider),
      avatarUrl: user.avatarUrl,
      displayName: user.displayName,
    );
  }
}

// Ported from: src/pages/Index.tsx (post-gate render: user profile → sub-screen (.a-subscreen) → Messages →
//              frame: status-bar spacer, single [data-scroll-container] with pb-nav, tab content keyed by tab
//              with the pageVariants enter animation and no exit animation, frame overlays, BottomNav;
//              isAnacanRedesignHome background; ad-preferences back → settings; useSwipeNavigation wiring),
//              src/styles/startup.css (.a-subscreen), src/components/blog/BlogLinkHost.tsx (full-screen
//              article over everything), src/hooks/useSwipeNavigation.ts (document touch listeners)
import 'package:flutter/physics.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../design/design.dart';
import '../feature_registry.dart';
import '../nav/ids.dart';
import '../nav/scroll_memory.dart';
import '../nav/shell_controller.dart';
import '../nav/shell_machine.dart' show layerFor;
import '../nav/shell_state.dart';
import '../nav/swipe.dart';
import '../shell_inputs.dart';
import 'bottom_nav_capsule.dart';

/// The shell after the gates: renders the layer Index would render for the current [ShellState].
class ShellScaffold extends ConsumerWidget {
  const ShellScaffold({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(shellProvider);
    final user = ref.watch(shellUserProvider);
    final registry = ref.watch(featureRegistryProvider);
    final controller = ref.read(shellProvider.notifier);
    final guard = user.guard;

    Widget body;
    switch (layerFor(state, guard)) {
      case ShellLayer.userProfile:
        final id = state.viewingUserId!;
        final b = registry.overlay(ShellOverlayId.userProfile);
        final args = ShellOverlayArgs(onClose: controller.closeUserProfile, userId: id);
        body = SubScreenFrame(
          key: ValueKey('user:$id'),
          child: b != null ? b(context, args) : ShellPlaceholder(kind: 'overlay', id: 'userProfile:$id', onBack: args.onClose),
        );
      case ShellLayer.subScreen:
        final screen = resolveSubScreen(state.activeScreen, guard)!;
        final b = registry.screen(screen.id);
        final onBack = screen.id == ScreenId.adPreferences
            ? () => controller.openScreen(ScreenId.settings.id)
            : controller.closeScreen;
        final args = ShellScreenArgs(screen: screen, onBack: onBack);
        body = SubScreenFrame(
          // ErrorBoundary key: the screen id (`aptek` keeps one boundary for all its views).
          key: ValueKey('screen:${screen.id == ScreenId.aptek ? 'aptek' : screen.raw}'),
          child: b != null ? b(context, args) : ShellPlaceholder(kind: 'screen', id: screen.raw, onBack: onBack),
        );
      case ShellLayer.motherChat:
        final b = registry.overlay(ShellOverlayId.motherChat);
        final args = ShellOverlayArgs(onClose: controller.closeMotherChat);
        body = KeyedSubtree(
          key: const ValueKey('mother-chat'),
          child: b != null ? b(context, args) : ShellPlaceholder(kind: 'overlay', id: 'motherChat', onBack: args.onClose),
        );
      case ShellLayer.frame:
        body = const ShellFrame(key: ValueKey('frame'));
    }

    final blogOpen = controller.blogOverlayOpen;
    final children = <Widget>[
      Positioned.fill(child: body),
      if (blogOpen)
        Positioned.fill(
          child: _BlogArticleLayer(slug: state.blogOverlay!.slug, onClose: controller.closeBlogOverlay),
        ),
    ];
    return SwipeNavigationDetector(
      enabled: user.isAuthenticated && !blogOpen,
      onSwipeBack: controller.swipeBack,
      onSwipeForward: controller.swipeForward,
      child: Stack(children: children),
    );
  }
}

/// `.a-subscreen`: full height, safe-area top/inline padding, `--a-bg`, the child fills and scrolls itself.
class SubScreenFrame extends StatelessWidget {
  const SubScreenFrame({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final pad = MediaQuery.paddingOf(context);
    return ColoredBox(
      color: AnacanTokens.of(context).a.bg,
      child: Padding(
        padding: EdgeInsets.only(top: pad.top, left: pad.left, right: pad.right),
        child: MediaQuery.removePadding(context: context, removeTop: true, child: SizedBox.expand(child: child)),
      ),
    );
  }
}

class _BlogArticleLayer extends ConsumerWidget {
  const _BlogArticleLayer({required this.slug, required this.onClose});
  final String slug;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final b = ref.watch(featureRegistryProvider).overlay(ShellOverlayId.blogArticle);
    final args = ShellOverlayArgs(onClose: onClose, slug: slug);
    return ColoredBox(
      color: AnacanTokens.of(context).shadcn.background,
      child: AScope(
        child: KeyedSubtree(
          key: ValueKey('blog:$slug'),
          child: b != null ? b(context, args) : ShellPlaceholder(kind: 'overlay', id: 'blogArticle:$slug', onBack: onClose),
        ),
      ),
    );
  }
}

/// The main frame: status-bar spacer, the single scroll container with the tab content, frame overlays and
/// the bottom nav.
class ShellFrame extends ConsumerStatefulWidget {
  const ShellFrame({super.key});

  @override
  ConsumerState<ShellFrame> createState() => _ShellFrameState();
}

class _ShellFrameState extends ConsumerState<ShellFrame> {
  final ScrollController _scroll = ScrollController();
  late final _ControllerHandle _handle = _ControllerHandle(_scroll);
  late final ScrollMemory _memory;

  @override
  void initState() {
    super.initState();
    _memory = ref.read(scrollMemoryProvider);
    _memory.container = _handle;
  }

  @override
  void dispose() {
    if (identical(_memory.container, _handle)) _memory.container = null;
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(shellProvider);
    final user = ref.watch(shellUserProvider);
    final registry = ref.watch(featureRegistryProvider);
    final controller = ref.read(shellProvider.notifier);
    final t = AnacanTokens.of(context);
    final pad = MediaQuery.paddingOf(context);
    final tab = state.activeTab;
    final partnerRole = user.isPartnerRole;
    final partnerVariant = partnerRole && tab != ShellTab.community;
    final stage = user.lifeStage;

    // Redesigned (anacan-demo) screens paint their own peach background.
    final redesign = !partnerRole &&
        ((tab == ShellTab.home && (stage == 'mommy' || stage == 'bump' || stage == 'flow')) ||
            tab == ShellTab.tools ||
            tab == ShellTab.community ||
            tab == ShellTab.ai ||
            tab == ShellTab.profile);
    final frameBg = redesign ? t.a.bg : t.shadcn.background;
    final spacerBg = redesign ? t.a.bg : t.shadcn.card;
    final pbNav = kPbNav + pad.bottom;

    final tabKey = ValueKey('${partnerVariant ? 'partner-' : ''}${tab.id}');
    Widget content = const SizedBox.shrink();
    ShellSliverBody? sliverBody;
    var fills = false;
    if (tabHasContent(tab, user.guard)) {
      final reg = registry.tab(tab, partner: partnerVariant);
      fills = reg?.fillsViewport ?? false;
      final args = ShellTabArgs(tab: tab, partner: partnerVariant, state: state);
      final slivers = reg?.slivers;
      if (slivers != null) {
        sliverBody = slivers(context, args);
      } else {
        content = reg != null ? reg.builder(context, args) : ShellPlaceholder(kind: 'tab', id: '${partnerVariant ? 'partner-' : ''}${tab.id}', fill: false);
      }
      // ToolsHub is keyed by toolsResetKey (it reads initialTool on mount only).
      if (tab == ShellTab.tools) {
        final key = ValueKey('tools:${state.toolsResetKey}');
        if (sliverBody != null) {
          sliverBody = ShellSliverBody(sliver: KeyedSubtree(key: key, child: sliverBody.sliver), background: sliverBody.background);
        } else {
          content = KeyedSubtree(key: key, child: content);
        }
      }
      if (sliverBody == null) content = TabEnter(key: tabKey, child: content);
    }

    // One scroll container for every tab ([data-scroll-container]): a CustomScrollView whose identity never
    // changes, so the scroll memory's controller stays attached across tabs. Sliver bodies go in as they are
    // (lazy lists); box bodies are one SliverToBoxAdapter. The last sliver is the `pb-nav` clearance.
    final body = sliverBody;
    final scrollView = LayoutBuilder(builder: (context, c) {
      final Widget main;
      if (body != null) {
        main = SliverTabEnter(key: tabKey, sliver: body.sliver);
      } else {
        final child = fills ? SizedBox(height: (c.maxHeight - pbNav).clamp(0.0, double.infinity), child: content) : content;
        main = SliverToBoxAdapter(child: ConstrainedBox(constraints: BoxConstraints(minWidth: c.maxWidth), child: child));
      }
      final background = body?.background;
      return Stack(
        fit: StackFit.expand,
        children: [
          // Page-top decoration of a sliver body, behind the content, moving with the scroll offset.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: background == null
                ? const SizedBox.shrink()
                : TabEnter(key: tabKey, child: ScrollLinkedBackground(controller: _scroll, child: background)),
          ),
          CustomScrollView(
            key: const ValueKey('shell-scroll'),
            controller: _scroll,
            physics: const ClampingScrollPhysics(),
            slivers: [main, SliverToBoxAdapter(child: SizedBox(height: pbNav))],
          ),
        ],
      );
    });

    return ColoredBox(
      color: frameBg,
      child: Stack(
        children: [
          Positioned.fill(
            child: Column(
              children: [
                Container(height: pad.top, color: spacerBg),
                Expanded(
                  child: MediaQuery.removePadding(context: context, removeTop: true, child: scrollView),
                ),
              ],
            ),
          ),
          for (final overlay in registry.frameOverlays) Builder(builder: overlay),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: BottomNavCapsule(activeTab: tab, onTabChange: controller.selectTab, isPartner: partnerRole),
          ),
        ],
      ),
    );
  }
}

class _ControllerHandle implements ScrollContainerHandle {
  _ControllerHandle(this.c);
  final ScrollController c;

  @override
  double get offset => c.hasClients ? c.offset : 0;

  @override
  void jumpTo(double offset) {
    if (!c.hasClients) return;
    final p = c.position;
    // `scrollTop = x` clamps to the scrollable range.
    final v = offset.clamp(p.minScrollExtent, p.hasContentDimensions ? p.maxScrollExtent : offset);
    if (v != p.pixels) c.jumpTo(v);
  }
}

/// `pageVariants` enter: opacity 0 → 1 (framer tween 300 ms, `[0.25, 0.1, 0.35, 1]`) and y 10 → 0 (framer's
/// default transform spring 500 / 25). Reduced motion and lite devices (`MotionConfig reducedMotion`) skip
/// the transform; opacity still animates. There is deliberately no exit animation.
class TabEnter extends StatefulWidget {
  const TabEnter({super.key, required this.child});
  final Widget child;

  static const Duration opacityDuration = Duration(milliseconds: 300);

  @override
  State<TabEnter> createState() => _TabEnterState();
}

class _TabEnterState extends State<TabEnter> with TickerProviderStateMixin {
  late final AnimationController _opacity = AnimationController(vsync: this, duration: TabEnter.opacityDuration);
  late final AnimationController _y = AnimationController.unbounded(vsync: this, value: 10);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final reduce = animationsDisabled(context) || AnacanTokens.of(context).lite;
    _opacity.forward();
    if (reduce) {
      _y.value = 0;
    } else {
      _y.animateWith(SpringSimulation(ASprings.transform, 10, 0, 0));
    }
  }

  @override
  void dispose() {
    _opacity.dispose();
    _y.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_opacity, _y]),
      child: widget.child,
      builder: (context, child) => Opacity(
        opacity: ACurves.framerDefault.transform(_opacity.value),
        child: Transform.translate(offset: Offset(0, _y.value), child: child),
      ),
    );
  }
}

/// [TabEnter] for a sliver body: the same opacity tween and y spring, applied with [SliverOpacity] and a paint
/// translation of the sliver (no layout change, like a CSS transform).
class SliverTabEnter extends StatefulWidget {
  const SliverTabEnter({super.key, required this.sliver});
  final Widget sliver;

  @override
  State<SliverTabEnter> createState() => _SliverTabEnterState();
}

class _SliverTabEnterState extends State<SliverTabEnter> with TickerProviderStateMixin {
  late final AnimationController _opacity = AnimationController(vsync: this, duration: TabEnter.opacityDuration);
  late final AnimationController _y = AnimationController.unbounded(vsync: this, value: 10);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final reduce = animationsDisabled(context) || AnacanTokens.of(context).lite;
    _opacity.forward();
    if (reduce) {
      _y.value = 0;
    } else {
      _y.animateWith(SpringSimulation(ASprings.transform, 10, 0, 0));
    }
  }

  @override
  void dispose() {
    _opacity.dispose();
    _y.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_opacity, _y]),
      child: widget.sliver,
      builder: (context, child) => SliverOpacity(
        opacity: ACurves.framerDefault.transform(_opacity.value),
        sliver: _SliverTranslateY(dy: _y.value, sliver: child!),
      ),
    );
  }
}

class _SliverTranslateY extends SingleChildRenderObjectWidget {
  const _SliverTranslateY({required this.dy, required Widget sliver}) : super(child: sliver);
  final double dy;

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderSliverTranslateY(dy);

  @override
  void updateRenderObject(BuildContext context, _RenderSliverTranslateY renderObject) => renderObject.dy = dy;
}

class _RenderSliverTranslateY extends RenderProxySliver {
  _RenderSliverTranslateY(this._dy);
  double _dy;

  set dy(double value) {
    if (value == _dy) return;
    _dy = value;
    markNeedsPaint();
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    final c = child;
    if (c != null && c.geometry!.visible) context.paintChild(c, offset + Offset(0, _dy));
  }

  @override
  void applyPaintTransform(RenderObject child, Matrix4 transform) {
    super.applyPaintTransform(child, transform);
    transform.multiply(Matrix4.translationValues(0, _dy, 0));
  }

  @override
  bool hitTestChildren(SliverHitTestResult result, {required double mainAxisPosition, required double crossAxisPosition}) {
    final c = child;
    return c != null &&
        c.geometry!.hitTestExtent > 0 &&
        c.hitTest(result, mainAxisPosition: mainAxisPosition - _dy, crossAxisPosition: crossAxisPosition);
  }
}

/// Paints [child] shifted up by the scroll offset of [controller] (content-anchored, behind the scroll view).
class ScrollLinkedBackground extends StatelessWidget {
  const ScrollLinkedBackground({super.key, required this.controller, required this.child});
  final ScrollController controller;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: controller,
        child: child,
        builder: (context, child) {
          final offset = controller.hasClients && controller.positions.length == 1 ? controller.offset : 0.0;
          return Transform.translate(offset: Offset(0, -offset), child: child);
        },
      ),
    );
  }
}

/// Edge swipe back/forward over the whole shell (passive pointer listener; never blocks scrolling).
class SwipeNavigationDetector extends StatefulWidget {
  const SwipeNavigationDetector({
    super.key,
    required this.child,
    required this.onSwipeBack,
    required this.onSwipeForward,
    this.enabled = true,
  });

  final Widget child;
  final VoidCallback onSwipeBack;
  final VoidCallback onSwipeForward;
  final bool enabled;

  @override
  State<SwipeNavigationDetector> createState() => _SwipeNavigationDetectorState();
}

class _SwipeNavigationDetectorState extends State<SwipeNavigationDetector> {
  final SwipeGestureTracker _tracker = SwipeGestureTracker();
  int? _pointer;

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return widget.child;
    // useIsRtl(): the app root sets Directionality from the language (`textDirectionFor`).
    final rtl = Directionality.maybeOf(context) == TextDirection.rtl;
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (e) {
        if (_pointer != null) return; // touches[0] only
        _pointer = e.pointer;
        _tracker.start(e.position.dx, e.position.dy, MediaQuery.sizeOf(context).width);
      },
      onPointerMove: (e) {
        if (e.pointer == _pointer) _tracker.move(e.position.dx, e.position.dy);
      },
      onPointerUp: (e) {
        if (e.pointer != _pointer) return;
        _pointer = null;
        switch (_tracker.end(e.position.dx, e.position.dy, rtl: rtl)) {
          case SwipeOutcome.back:
            widget.onSwipeBack();
          case SwipeOutcome.forward:
            widget.onSwipeForward();
          case SwipeOutcome.none:
            break;
        }
      },
      onPointerCancel: (e) {
        if (e.pointer != _pointer) return;
        _pointer = null;
        _tracker.cancel();
      },
      child: widget.child,
    );
  }
}

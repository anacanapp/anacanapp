// Ported from: src/components/anacan/Sheet.tsx (vaul Drawer, shouldScaleBackground, useOverlayBackHandler),
//              src/styles/anacan-design.css (.a3-sheet-overlay, .a3-sheet, .a3-sheet.full, .a3-grabber,
//              .a3-sheet-head, .a3-sheet-body, .a3-sheet-bar, .a3-icon-btn.solid),
//              node_modules/vaul 0.9.9 (TRANSITIONS 0.5s cubic-bezier(0.32,0.72,0,1), VELOCITY_THRESHOLD 0.4 px/ms,
//              CLOSE_THRESHOLD 0.25, dampenValue for upward drag, WINDOW_TOP_OFFSET 26, BORDER_RADIUS 8)
import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../icons.g.dart';
import '../motion.dart';
import '../theme.dart';
import 'a_button.dart';

/// Sheet chrome (`.a3-sheet a-scope`): grabber, header (close/back + title + actions),
/// scrolling body (`data-vaul-no-drag`), optional sticky footer bar. Usable inline (gallery,
/// goldens); [showASheet] adds the overlay, slide, drag-to-dismiss and back handling.
class ASheet extends StatelessWidget {
  const ASheet({
    super.key,
    required this.title,
    required this.children,
    this.footer,
    this.actions = const <Widget>[],
    this.onClose,
    this.onBack,
    this.full = true,
    this.bodyController,
    this.closeLabel = 'Close',
    this.backLabel = 'Back',
  });

  final Widget title;

  /// `.a3-sheet-body` children (column, gap 20).
  final List<Widget> children;
  final Widget? footer;
  final List<Widget> actions;
  final VoidCallback? onClose;

  /// Shows ChevronLeft (mirrored in RTL) instead of X.
  final VoidCallback? onBack;

  /// `.a3-sheet.full`: fixed height `100dvh - safe-top - 24px` (default true in Sheet.tsx).
  final bool full;
  final ScrollController? bodyController;

  /// aria-labels; pass `rd('close')` / `rd('back')` from the i18n layer.
  final String closeLabel;
  final String backLabel;

  /// `max-height: calc(100dvh - env(safe-area-inset-top) - 24px)`.
  static double maxHeightOf(BuildContext context) {
    final mq = MediaQuery.of(context);
    return mq.size.height - mq.viewPadding.top - 24;
  }

  @override
  Widget build(BuildContext context) {
    final t = AnacanTokens.of(context).a;
    final x = context.aText;
    final mq = MediaQuery.of(context);
    final safeBottom = mq.padding.bottom;
    final head = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 2, 16, 4),
        child: Row(
          children: <Widget>[
            AIconButton(
              solid: true,
              semanticLabel: onBack != null ? backLabel : closeLabel,
              onPressed: onBack ?? onClose,
              icon: onBack != null
                  ? const AIcon(AIcons.chevronLeft, size: 18, mirrorInRtl: true)
                  : const AIcon(AIcons.x, size: 18),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: DefaultTextStyle.merge(
                style: x.a3SheetTitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                child: Semantics(header: true, child: title),
              ),
            ),
            for (final a in actions) ...<Widget>[const SizedBox(width: 8), a],
          ],
        ),
      ),
    );
    final body = SingleChildScrollView(
      controller: bodyController,
      padding: EdgeInsets.fromLTRB(16, 6, 16, 28 + safeBottom),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (var i = 0; i < children.length; i++) ...<Widget>[if (i > 0) const SizedBox(height: 20), children[i]],
        ],
      ),
    );
    final bar = footer == null
        ? null
        : Container(
            padding: EdgeInsets.fromLTRB(16, 10, 16, 12 + safeBottom),
            decoration: BoxDecoration(color: t.surface, boxShadow: <BoxShadow>[BoxShadow(color: t.line, offset: const Offset(0, -1))]),
            child: footer,
          );
    final maxH = maxHeightOf(context);
    return AScope(
      child: Container(
        constraints: BoxConstraints(maxHeight: maxH),
        height: full ? maxH : null,
        decoration: BoxDecoration(
          color: t.bg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          // 0 -12px 40px rgba(42, 33, 32, 0.22)
          boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x382A2120), offset: Offset(0, -12), blurRadius: 33.775)],
        ),
        child: Column(
          mainAxisSize: full ? MainAxisSize.max : MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Center(
              child: Container(
                width: 38,
                height: 5,
                margin: const EdgeInsets.only(top: 8),
                decoration: BoxDecoration(color: t.lineStrong, borderRadius: BorderRadius.circular(5)),
              ),
            ),
            head,
            if (full) Expanded(child: body) else Flexible(child: body),
            ?bar,
          ],
        ),
      ),
    );
  }
}

/// `[vaul-drawer-wrapper]`: the app layer that recedes (scale (w-26)/w, translateY(safe-top + 14px),
/// radius 8, origin top, black behind) while a sheet with `scaleBackground` is open.
///
/// Parity note: src/ never renders a `[vaul-drawer-wrapper]` element, so on the web the background
/// does NOT scale today (vaul returns early). Only add this wrapper if that is intended to change.
class AVaulWrapper extends StatelessWidget {
  const AVaulWrapper({super.key, required this.child});
  final Widget child;

  /// 0 = no sheet, 1 = sheet fully open (max over open sheets).
  static final ValueNotifier<double> progress = ValueNotifier<double>(0);

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    return ValueListenableBuilder<double>(
      valueListenable: progress,
      child: child,
      builder: (context, p, child) {
        if (p <= 0) return child!;
        final w = mq.size.width;
        final scale = 1 - p * (1 - (w - 26) / w);
        return ColoredBox(
          color: const Color(0xFF000000),
          child: Transform(
            alignment: Alignment.topCenter,
            transform: Matrix4.identity()
              ..scaleByDouble(scale, scale, 1, 1)
              ..translateByDouble(0, p * (mq.viewPadding.top + 14), 0, 1),
            child: ClipRRect(borderRadius: BorderRadius.circular(8 * p), child: child),
          ),
        );
      },
    );
  }
}

/// Opens [ASheet] as a modal route: `.a3-sheet-overlay` (rgba(30,12,12,.22)), slide-up over 500ms
/// `cubic-bezier(.32,.72,0,1)`, drag the grabber/header/footer down to dismiss, Android back closes
/// it (or calls [onBack]), keyboard inset lifts the sheet.
Future<T?> showASheet<T>(
  BuildContext context, {
  required Widget title,
  required List<Widget> Function(BuildContext context) builder,
  Widget? footer,
  List<Widget> actions = const <Widget>[],
  VoidCallback? onBack,
  bool full = true,
  bool scaleBackground = true,
  String closeLabel = 'Close',
  String backLabel = 'Back',
  bool useRootNavigator = true,
}) {
  return Navigator.of(context, rootNavigator: useRootNavigator).push<T>(
    ASheetRoute<T>(
      scaleBackground: scaleBackground,
      onBack: onBack,
      builder: (ctx) => ASheet(
        title: title,
        footer: footer,
        actions: actions,
        full: full,
        onBack: onBack,
        onClose: () => Navigator.of(ctx).maybePop(),
        closeLabel: closeLabel,
        backLabel: backLabel,
        children: builder(ctx),
      ),
    ),
  );
}

class ASheetRoute<T> extends PopupRoute<T> {
  ASheetRoute({required this.builder, this.scaleBackground = true, this.onBack});

  final WidgetBuilder builder;
  final bool scaleBackground;
  final VoidCallback? onBack;

  @override
  Color? get barrierColor => const Color(0x00000000); // overlay is painted by the frame (follows drag)

  @override
  bool get barrierDismissible => true;

  @override
  String? get barrierLabel => 'Dismiss';

  @override
  Duration get transitionDuration => ADurations.sheet;

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) {
    return _ASheetFrame(route: this, child: Builder(builder: builder));
  }
}

class _ASheetFrame extends StatefulWidget {
  const _ASheetFrame({required this.route, required this.child});
  final ASheetRoute<dynamic> route;
  final Widget child;

  @override
  State<_ASheetFrame> createState() => _ASheetFrameState();
}

class _ASheetFrameState extends State<_ASheetFrame> with SingleTickerProviderStateMixin {
  late final AnimationController _pos = AnimationController(vsync: this);
  final GlobalKey _sheetKey = GlobalKey();
  double _drag = 0; // px, + = down
  DateTime? _dragStart;
  bool _closing = false;

  @override
  void initState() {
    super.initState();
    widget.route.animation!.addStatusListener(_onRouteStatus);
    _pos.addListener(_syncBackground);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_pos.value == 0 && !_pos.isAnimating && !_closing) _animateTo(1);
  }

  void _onRouteStatus(AnimationStatus s) {
    if (s == AnimationStatus.reverse && !_closing) {
      _closing = true;
      _animateTo(0);
    }
  }

  void _syncBackground() {
    if (widget.route.scaleBackground) AVaulWrapper.progress.value = _pos.value;
  }

  void _animateTo(double v) {
    if (animationsDisabled(context)) {
      _pos.value = v;
      return;
    }
    _pos.animateTo(v, duration: ADurations.sheet, curve: ACurves.spring);
  }

  double get _height => (_sheetKey.currentContext?.size?.height ?? 1).clamp(1, double.infinity);

  void _onDragStart(DragStartDetails d) {
    _dragStart = DateTime.now();
    _drag = 0;
    _pos.stop();
  }

  void _onDragUpdate(DragUpdateDetails d) {
    setState(() {
      _drag += d.delta.dy;
      if (_drag > 0) _pos.value = (1 - _drag / _height).clamp(0.0, 1.0);
    });
  }

  void _onDragEnd(DragEndDetails d) {
    final ms = math.max(1, DateTime.now().difference(_dragStart ?? DateTime.now()).inMilliseconds);
    final dist = _drag;
    final velocity = dist.abs() / ms; // vaul: px/ms over the whole drag
    setState(() => _drag = math.min(_drag, 0));
    if (dist <= 0) {
      setState(() => _drag = 0);
      _animateTo(1);
      return;
    }
    if (velocity > 0.4 || dist >= _height * 0.25) {
      Navigator.of(context).maybePop();
      if (widget.route.onBack != null) _animateTo(1); // back handler decided not to close
      return;
    }
    _drag = 0;
    _animateTo(1);
  }

  /// vaul dampenValue: 8 * (ln(v + 1) - 2), only for upward drags.
  double get _upOffset => _drag < 0 ? -math.max(0.0, 8 * (math.log(-_drag + 1) - 2)) : 0.0;

  @override
  void dispose() {
    widget.route.animation?.removeStatusListener(_onRouteStatus);
    if (widget.route.scaleBackground) AVaulWrapper.progress.value = 0;
    _pos.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    Widget sheet = KeyedSubtree(key: _sheetKey, child: widget.child);
    sheet = GestureDetector(
      behavior: HitTestBehavior.translucent,
      onVerticalDragStart: _onDragStart,
      onVerticalDragUpdate: _onDragUpdate,
      onVerticalDragEnd: _onDragEnd,
      child: sheet,
    );
    final frame = AnimatedBuilder(
      animation: _pos,
      child: sheet,
      builder: (context, child) {
        final h = _height;
        final dy = (1 - _pos.value) * h + _upOffset;
        return Stack(
          children: <Widget>[
            Positioned.fill(
              child: IgnorePointer(
                child: Opacity(opacity: _pos.value.clamp(0.0, 1.0), child: const ColoredBox(color: Color(0x381E0C0C))),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: mq.viewInsets.bottom,
              child: Transform.translate(offset: Offset(0, dy), child: child),
            ),
          ],
        );
      },
    );
    final onBack = widget.route.onBack;
    return PopScope<dynamic>(
      canPop: onBack == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && onBack != null) onBack();
      },
      child: frame,
    );
  }
}

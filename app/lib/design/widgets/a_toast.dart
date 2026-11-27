// Ported from: src/components/ui/sonner.tsx (Sonner Toaster: mobileOffset bottom calc(96px + safe-bottom),
//              classNames bg-background text-foreground border-border shadow-lg), node_modules/sonner 1.7.4
//              (styles.css [data-styled]: padding 16, radius 8, gap 6, 13px, system-ui font; title 500/1.5,
//              description 400/1.4; VISIBLE_TOASTS 3, GAP 14, mobile offset 16, TOAST_LIFETIME 4000,
//              SWIPE_THRESHOLD 20, removal 400ms), src/components/ui/toast.tsx + toaster.tsx (Radix: top
//              viewport p-4 pt-[1rem+safe-top], rounded-md, border, p-6 pe-8, shadow-lg, destructive variant,
//              slide-in-from-top-full / fade-out-80 + slide-out-to-right-full (RTL left), close X 16px
//              text-foreground/50 opacity-0), src/hooks/use-toast.ts (TOAST_LIMIT 1), Radix default duration 5000
import 'dart:async';

import 'package:flutter/widgets.dart';

import '../icons.g.dart';
import '../motion.dart';
import '../theme.dart';

/// sonner `toast.success/error/info/warning/message`.
enum AToastType { normal, success, error, info, warning }

class _SonnerToast {
  _SonnerToast(this.id, this.type, this.title, this.description, this.duration);
  final int id;
  final AToastType type;
  final String title;
  final String? description;
  final Duration duration;
  Timer? timer;
  bool removed = false;
}

class _RadixToast {
  _RadixToast(this.id, this.title, this.description, this.destructive, this.action, this.duration);
  final int id;
  final String? title;
  final String? description;
  final bool destructive;
  final Widget? action;
  final Duration duration;
  Timer? timer;
  bool closing = false;
}

/// Imperative API for both toast systems the web app mounts (App.tsx renders `<Toaster />`
/// and `<Sonner />` side by side).
class AToastController extends ChangeNotifier {
  int _seq = 0;
  final List<_SonnerToast> _sonner = <_SonnerToast>[];
  final List<_RadixToast> _radix = <_RadixToast>[];

  static const Duration sonnerLifetime = Duration(milliseconds: 4000);
  static const Duration radixDuration = Duration(milliseconds: 5000);
  static const Duration sonnerRemoval = Duration(milliseconds: 400);
  static const Duration radixExit = Duration(milliseconds: 150);

  // ── sonner ──
  int message(String title, {String? description, Duration? duration}) => _addSonner(AToastType.normal, title, description, duration);
  int success(String title, {String? description, Duration? duration}) => _addSonner(AToastType.success, title, description, duration);
  int error(String title, {String? description, Duration? duration}) => _addSonner(AToastType.error, title, description, duration);
  int info(String title, {String? description, Duration? duration}) => _addSonner(AToastType.info, title, description, duration);
  int warning(String title, {String? description, Duration? duration}) => _addSonner(AToastType.warning, title, description, duration);

  int _addSonner(AToastType type, String title, String? description, Duration? duration) {
    final t = _SonnerToast(++_seq, type, title, description, duration ?? sonnerLifetime);
    _sonner.insert(0, t);
    t.timer = Timer(t.duration, () => dismiss(t.id));
    notifyListeners();
    return t.id;
  }

  // ── Radix (shadcn useToast) ──
  /// `toast({ title, description, variant: 'destructive', action })`; TOAST_LIMIT 1 replaces the current one.
  int show({String? title, String? description, bool destructive = false, Widget? action, Duration duration = radixDuration}) {
    for (final r in _radix) {
      r.timer?.cancel();
    }
    _radix.clear();
    final t = _RadixToast(++_seq, title, description, destructive, action, duration);
    _radix.add(t);
    t.timer = Timer(duration, () => dismiss(t.id));
    notifyListeners();
    return t.id;
  }

  void dismiss(int id) {
    for (final s in _sonner) {
      if (s.id == id && !s.removed) {
        s.removed = true;
        s.timer?.cancel();
        notifyListeners();
        Timer(sonnerRemoval, () {
          _sonner.remove(s);
          notifyListeners();
        });
      }
    }
    for (final r in _radix) {
      if (r.id == id && !r.closing) {
        r.closing = true;
        r.timer?.cancel();
        notifyListeners();
        Timer(radixExit, () {
          _radix.remove(r);
          notifyListeners();
        });
      }
    }
  }

  @override
  void dispose() {
    for (final s in _sonner) {
      s.timer?.cancel();
    }
    for (final r in _radix) {
      r.timer?.cancel();
    }
    super.dispose();
  }
}

/// Mounts both toast viewports above [child]. Find the controller with [AToastHost.of].
class AToastHost extends StatefulWidget {
  const AToastHost({super.key, required this.child, this.controller});
  final Widget child;
  final AToastController? controller;

  static AToastController of(BuildContext context) {
    final s = context.dependOnInheritedWidgetOfExactType<_AToastScope>();
    assert(s != null, 'No AToastHost above this context');
    return s!.controller;
  }

  @override
  State<AToastHost> createState() => _AToastHostState();
}

class _AToastScope extends InheritedWidget {
  const _AToastScope({required this.controller, required super.child});
  final AToastController controller;
  @override
  bool updateShouldNotify(_AToastScope old) => old.controller != controller;
}

class _AToastHostState extends State<AToastHost> {
  late final AToastController _own = AToastController();
  AToastController get _c => widget.controller ?? _own;

  @override
  void dispose() {
    _own.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _AToastScope(
      controller: _c,
      child: Stack(
        children: <Widget>[
          widget.child,
          Positioned.fill(
            child: ListenableBuilder(
              listenable: _c,
              builder: (context, _) => Stack(
                children: <Widget>[
                  if (_c._sonner.isNotEmpty) _SonnerViewport(controller: _c, toasts: _c._sonner.take(3).toList()),
                  if (_c._radix.isNotEmpty) _RadixViewport(controller: _c, toast: _c._radix.last),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────── sonner ───────────────────────────────

class _SonnerViewport extends StatelessWidget {
  const _SonnerViewport({required this.controller, required this.toasts});
  final AToastController controller;
  final List<_SonnerToast> toasts;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    // ≤600px: left/right 16px (mobile offset), bottom calc(96px + safe-area-bottom).
    return Positioned(
      left: 16,
      right: 16,
      bottom: 96 + mq.viewPadding.bottom,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.bottomCenter,
        children: <Widget>[
          for (var i = toasts.length - 1; i >= 0; i--)
            i == 0
                ? ASonnerToast(key: ValueKey<int>(toasts[i].id), toast: toasts[i], controller: controller, index: 0)
                : Positioned.fill(child: ASonnerToast(key: ValueKey<int>(toasts[i].id), toast: toasts[i], controller: controller, index: i)),
        ],
      ),
    );
  }
}

/// One sonner toast. Behind toasts (index > 0) are drawn collapsed: front toast's size,
/// content hidden, lifted 14px·index and scaled 1 − 0.05·index (`[data-expanded=false]`).
class ASonnerToast extends StatefulWidget {
  const ASonnerToast({super.key, required this.toast, required this.controller, required this.index});
  final Object toast;
  final AToastController controller;
  final int index;

  /// Static look for galleries/goldens.
  static Widget preview({required AToastType type, required String title, String? description}) =>
      _SonnerCard(type: type, title: title, description: description);

  @override
  State<ASonnerToast> createState() => _ASonnerToastState();
}

class _ASonnerToastState extends State<ASonnerToast> with SingleTickerProviderStateMixin {
  // 400ms `ease` for transform/opacity (sonner: transition transform .4s, opacity .4s).
  late final AnimationController _in = AnimationController(vsync: this, duration: const Duration(milliseconds: 400));
  Offset _swipe = Offset.zero;

  _SonnerToast get _t => widget.toast as _SonnerToast;

  @override
  void initState() {
    super.initState();
    _in.forward();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (animationsDisabled(context)) _in.value = 1;
  }

  @override
  void didUpdateWidget(ASonnerToast old) {
    super.didUpdateWidget(old);
    if (_t.removed && _in.status != AnimationStatus.reverse) _in.reverse();
  }

  @override
  void dispose() {
    _in.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final i = widget.index;
    final card = _SonnerCard(type: _t.type, title: _t.title, description: _t.description, hideContent: i > 0);
    return AnimatedBuilder(
      animation: _in,
      child: card,
      builder: (context, child) {
        final v = ACurves.cssEase.transform(_in.value);
        return LayoutBuilder(builder: (context, c) {
          final h = c.hasBoundedHeight ? c.maxHeight : 60.0;
          final lift = -14.0 * i;
          return Transform.translate(
            offset: Offset(_swipe.dx, (1 - v) * h + lift + _swipe.dy),
            child: Transform.scale(
              scale: 1 - 0.05 * i,
              alignment: Alignment.topCenter,
              child: Opacity(opacity: v.clamp(0.0, 1.0), child: child),
            ),
          );
        });
      },
    ).let((w) => i > 0
        ? w
        : GestureDetector(
            onPanUpdate: (d) => setState(() {
              // Position bottom-right → swipe directions bottom / right.
              _swipe = Offset((_swipe.dx + d.delta.dx).clamp(0, double.infinity), (_swipe.dy + d.delta.dy).clamp(0, double.infinity));
            }),
            onPanEnd: (_) {
              if (_swipe.dx >= 20 || _swipe.dy >= 20) {
                widget.controller.dismiss(_t.id);
              } else {
                setState(() => _swipe = Offset.zero);
              }
            },
            child: w,
          ));
  }
}

extension _Let<T> on T {
  R let<R>(R Function(T) f) => f(this);
}

class _SonnerCard extends StatelessWidget {
  const _SonnerCard({required this.type, required this.title, this.description, this.hideContent = false});
  final AToastType type;
  final String title;
  final String? description;
  final bool hideContent;

  @override
  Widget build(BuildContext context) {
    final s = AnacanTokens.of(context).shadcn;
    // sonner's toaster sets `font-family: ui-sans-serif, system-ui, …` → platform font (inherit: false).
    final base = TextStyle(inherit: false, fontSize: 13, color: s.foreground, leadingDistribution: TextLeadingDistribution.even);
    final icon = switch (type) {
      AToastType.success => AIcons.sonnerSuccess,
      AToastType.error => AIcons.sonnerError,
      AToastType.info => AIcons.sonnerInfo,
      AToastType.warning => AIcons.sonnerWarning,
      AToastType.normal => null,
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: s.background,
        border: Border.all(color: s.border),
        borderRadius: BorderRadius.circular(8),
        boxShadow: AToastShadows.tailwindLg,
      ),
      child: Opacity(
        opacity: hideContent ? 0 : 1,
        child: Row(
          children: <Widget>[
            if (icon != null) ...<Widget>[
              // [data-icon]: 16×16 box, margin-inline -3px / 4px; svg 20px, margin-inline-start -1px.
              Padding(
                padding: const EdgeInsetsDirectional.only(start: 0, end: 4),
                child: SizedBox(
                  width: 16,
                  height: 16,
                  child: OverflowBox(
                    maxWidth: 20,
                    maxHeight: 20,
                    alignment: AlignmentDirectional.centerStart,
                    child: Transform.translate(offset: const Offset(-4, 0), child: AIcon(icon, size: 20, color: s.foreground)),
                  ),
                ),
              ),
              const SizedBox(width: 6),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(title, style: base.copyWith(fontWeight: FontWeight.w500, height: 1.5)),
                  if (description != null)
                    Text(description!, style: base.copyWith(fontWeight: FontWeight.w400, height: 1.4, color: s.mutedForeground)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tailwind `shadow-lg`: 0 10px 15px -3px rgb(0 0 0 / .1), 0 4px 6px -4px rgb(0 0 0 / .1).
abstract final class AToastShadows {
  static const List<BoxShadow> tailwindLg = <BoxShadow>[
    BoxShadow(color: Color(0x1A000000), offset: Offset(0, 10), blurRadius: 12.124, spreadRadius: -3),
    BoxShadow(color: Color(0x1A000000), offset: Offset(0, 4), blurRadius: 4.330, spreadRadius: -4),
  ];
}

// ─────────────────────────────── Radix (shadcn) ───────────────────────────────

class _RadixViewport extends StatelessWidget {
  const _RadixViewport({required this.controller, required this.toast});
  final AToastController controller;
  final _RadixToast toast;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 16 + mq.viewPadding.top, 16, 16),
        child: ARadixToast(key: ValueKey<int>(toast.id), toast: toast, controller: controller),
      ),
    );
  }
}

/// shadcn `<Toast>` look (Radix): enter slides from the top (150ms), exit fades to 0.8 and slides
/// out to the right (left in RTL); swipe right (left in RTL) > 50px dismisses.
class ARadixToast extends StatefulWidget {
  const ARadixToast({super.key, required this.toast, required this.controller});
  final Object toast;
  final AToastController controller;

  /// Static look for galleries/goldens.
  static Widget preview({String? title, String? description, bool destructive = false, Widget? action}) =>
      _RadixCard(title: title, description: description, destructive: destructive, action: action, onClose: () {});

  @override
  State<ARadixToast> createState() => _ARadixToastState();
}

class _ARadixToastState extends State<ARadixToast> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 150));
  double _swipe = 0;
  _RadixToast get _t => widget.toast as _RadixToast;

  @override
  void initState() {
    super.initState();
    _c.forward();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (animationsDisabled(context)) _c.value = 1;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final closing = _t.closing;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) => LayoutBuilder(builder: (context, c) {
        final v = ACurves.tailwind.transform(_c.value);
        final w = c.maxWidth;
        if (closing) {
          // fade-out-80 + slide-out-to-right-full over 150ms (driven by removal timer).
          return TweenAnimationBuilder<double>(
            tween: Tween<double>(begin: 0, end: 1),
            duration: AToastController.radixExit,
            builder: (context, e, child) => Opacity(
              opacity: 1 - 0.2 * e,
              child: Transform.translate(offset: Offset((rtl ? -1 : 1) * (w * e) + _swipe, 0), child: child),
            ),
            child: child,
          );
        }
        return FractionalTranslation(
          translation: Offset(0, -(1 - v)),
          child: Transform.translate(offset: Offset(_swipe, 0), child: child),
        );
      }),
      child: GestureDetector(
        onHorizontalDragUpdate: (d) => setState(() {
          _swipe += d.delta.dx;
          _swipe = rtl ? _swipe.clamp(double.negativeInfinity, 0) : _swipe.clamp(0, double.infinity);
        }),
        onHorizontalDragEnd: (_) {
          if (_swipe.abs() >= 50) {
            widget.controller.dismiss(_t.id);
          } else {
            setState(() => _swipe = 0);
          }
        },
        child: _RadixCard(
          title: _t.title,
          description: _t.description,
          destructive: _t.destructive,
          action: _t.action,
          onClose: () => widget.controller.dismiss(_t.id),
        ),
      ),
    );
  }
}

class _RadixCard extends StatelessWidget {
  const _RadixCard({this.title, this.description, required this.destructive, this.action, required this.onClose});
  final String? title;
  final String? description;
  final bool destructive;
  final Widget? action;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final s = AnacanTokens.of(context).shadcn;
    final bg = destructive ? s.destructive : s.background;
    final fg = destructive ? s.destructiveForeground : s.foreground;
    final border = destructive ? s.destructive : s.border;
    // text-sm: 14px / 20px.
    final sm = TextStyle(fontSize: 14, height: 20 / 14, color: fg, leadingDistribution: TextLeadingDistribution.even);
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(TwRadius.md),
        boxShadow: AToastShadows.tailwindLg,
      ),
      child: Stack(
        children: <Widget>[
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(24, 24, 32, 24),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      if (title != null) Text(title!, style: sm.copyWith(fontWeight: FontWeight.w600)),
                      if (title != null && description != null) const SizedBox(height: 4),
                      if (description != null) Opacity(opacity: 0.9, child: Text(description!, style: sm)),
                    ],
                  ),
                ),
                if (action != null) ...<Widget>[const SizedBox(width: 16), action!],
              ],
            ),
          ),
          // ToastClose: absolute end-2 top-2 p-1, X 16px, text-foreground/50, opacity-0 (hover-only on
          // the web, so invisible but tappable on touch devices — kept as is).
          PositionedDirectional(
            end: 8,
            top: 8,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onClose,
              child: Opacity(
                opacity: 0,
                child: Padding(padding: const EdgeInsets.all(4), child: AIcon(AIcons.x, size: 16, color: fg.withValues(alpha: 0.5))),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Ported from: src/components/onboarding/GlassTour.tsx, src/components/onboarding/glass-tour.css
//
// Glass guided tour over the real app. Every sub-step first moves the app to its screen, then highlights a
// `data-tour` target (spot), explains the open screen (coach), asks for push (push) or shows a full card
// (card). Tapping the highlighted element advances the tour; the rest of the screen is blocked only while
// something is highlighted, so on tool pages the user can use the tool itself.
//
// Targets are [GlobalKey]s: tabs come from the shell (`BottomNavBar.tourKey`), everything else from
// [TourTargets] (the Tools hub attaches `TourTargets.key('tool-<id>')`, `'tools-free'`, `'tools-premium'`).

import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../shell/nav/back_button.dart';
import '../../shell/nav/shell_controller.dart' show backDispatcherProvider;
import '../../shell/widgets/bottom_nav_capsule.dart' show BottomNavBar;
import 'onboarding_tour.dart';

/// `data-tour="…"` targets outside the bottom nav.
abstract final class TourTargets {
  static final Map<String, GlobalKey> _keys = {};
  static GlobalKey key(String id) => _keys.putIfAbsent(id, () => GlobalKey(debugLabel: 'tour:$id'));

  /// The key of [id] (`tab-*` → the shell's nav keys).
  static GlobalKey? lookup(String id) => id.startsWith('tab-') ? BottomNavBar.tourKeys[id] : _keys[id];
}

String _fill(String text, Map<String, Object?> vars) => text.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => '${vars[m[1]] ?? ''}');

/// glass-tour.css colours (literal rgba values).
abstract final class _Gt {
  static const Color glassLight = Color.fromRGBO(255, 255, 255, 0.82);
  static const Color glassDark = Color.fromRGBO(28, 30, 38, 0.84);
  static const Color glassLightSolid = Color.fromRGBO(255, 255, 255, 0.96);
  static const Color glassDarkSolid = Color.fromRGBO(40, 42, 50, 0.97);
  static const Color edgeLight = Color.fromRGBO(255, 255, 255, 0.75);
  static const Color edgeDark = Color.fromRGBO(255, 255, 255, 0.16);
  static const Color inkLight = Color(0xFF2B2523);
  static const Color dimLight = Color.fromRGBO(40, 20, 30, 0.36);
  static const Color dimDark = Color.fromRGBO(0, 0, 0, 0.55);
  static const Color wrapLight = Color.fromRGBO(255, 228, 222, 0.55);
  static const Color wrapDark = Color.fromRGBO(10, 10, 16, 0.6);
  static const Color kickDark = Color(0xFFFFB3B0);
}

class GlassTour extends ConsumerStatefulWidget {
  const GlassTour({
    super.key,
    required this.plan,
    required this.name,
    required this.stage,
    required this.isPremium,
    required this.aiFreePerDay,
    required this.tools,
    required this.onNavigate,
    required this.onPush,
    required this.onPremium,
    required this.onFinish,
    this.targetLookup = TourTargets.lookup,
  });
  final List<TourStep> plan;
  final String name;
  final String stage;
  final bool isPremium;
  final int aiFreePerDay;
  final List<TourTool> tools;
  final void Function(TourNav nav) onNavigate;
  final Future<void> Function() onPush;
  final VoidCallback onPremium;

  /// (`'done' | 'skipped'`, `'<step>:<sub>'`)
  final void Function(String status, String step) onFinish;
  final GlobalKey? Function(String id) targetLookup;

  @override
  ConsumerState<GlassTour> createState() => _GlassTourState();
}

class _GlassTourState extends ConsumerState<GlassTour> {
  int _si = 0, _ui = 0;
  Rect? _rect;
  bool _missing = false, _busy = false;
  String _lastNav = '';
  Timer? _poll;
  int _tries = 0;
  VoidCallback? _releaseBack;
  bool _scrolled = false;

  TourStep get _step => widget.plan[_si];
  TourSub get _sub => _step.subs[_ui];
  bool get _hasMood => widget.plan.any((s) => s.id == 'mood');
  bool get _isLast => _si == widget.plan.length - 1 && _ui == _step.subs.length - 1;

  String _toolName(String? id) => widget.tools.where((t) => t.id == id).firstOrNull?.name ?? '';
  String _toolText(String? id) => widget.tools.where((t) => t.id == id).firstOrNull?.description ?? '';

  void _finish(String status) => widget.onFinish(status, '${_step.id}:$_ui');

  void _next() {
    if (!mounted) return;
    setState(() {
      if (_ui < _step.subs.length - 1) {
        _ui++;
      } else if (_si < widget.plan.length - 1) {
        _si++;
        _ui = 0;
      }
    });
    _enterSub();
  }

  void _prev() {
    setState(() {
      if (_ui > 0) {
        _ui--;
      } else if (_si > 0) {
        _si--;
        _ui = widget.plan[_si].subs.length - 1;
      }
    });
    _enterSub();
  }

  @override
  void initState() {
    super.initState();
    // Android back: one sub-step back; on the first card it closes the tour.
    _releaseBack = ref.read(backDispatcherProvider).push(() {
      if (_si == 0 && _ui == 0) {
        _finish('skipped');
      } else {
        _prev();
      }
      return true;
    }, BackLayer.overlay);
    WidgetsBinding.instance.addPostFrameCallback((_) => _enterSub());
  }

  @override
  void dispose() {
    _poll?.cancel();
    _releaseBack?.call();
    super.dispose();
  }

  void _enterSub() {
    // 1) move the app to the sub-step's screen (only when it changes, so tools are not remounted needlessly)
    final key = _sub.nav.key;
    if (key != _lastNav) {
      _lastNav = key;
      widget.onNavigate(_sub.nav);
    }
    // 2) find and track the highlighted element
    _poll?.cancel();
    setState(() {
      _rect = null;
      _missing = false;
    });
    _tries = 0;
    _scrolled = false;
    if (_sub.kind != 'spot' || _sub.target == null) return;
    _measureLoop();
  }

  bool _measure() {
    final ctx = widget.targetLookup(_sub.target!)?.currentContext;
    final box = ctx?.findRenderObject();
    if (box is! RenderBox || !box.hasSize || !box.attached) return false;
    final topLeft = box.localToGlobal(Offset.zero);
    final r = topLeft & box.size;
    if (r.width == 0 || r.height == 0) return false;
    final vh = MediaQuery.sizeOf(context).height;
    if (!_scrolled && (r.top < 60 || r.bottom > vh - 90)) {
      _scrolled = true;
      Scrollable.ensureVisible(ctx!, alignment: 0.5);
      return false;
    }
    if (_rect != r) setState(() => _rect = r);
    return true;
  }

  void _measureLoop() {
    if (!mounted) return;
    if (_measure()) {
      // keep tracking (resize / scroll) on every frame while highlighted
      _poll = Timer.periodic(const Duration(milliseconds: 100), (_) {
        if (mounted && _sub.kind == 'spot') _measure();
      });
      return;
    }
    if (++_tries > 30) {
      setState(() => _missing = true);
      return;
    }
    _poll = Timer(const Duration(milliseconds: 100), _measureLoop);
  }

  ({String title, String text, String? where}) _copy() {
    String where(String area) => '${tr('obtour_here', 'Siz buradasınız')}: $area';
    final toolsArea = tr('obtour_where_tools', 'Alətlər');
    final sub = _sub;
    switch (sub.copy) {
      case 'mood_tab':
        return (title: tr('obtour_mood_tab_title', 'Əvvəlcə Alətlər'), text: tr('obtour_mood_tab_text', 'Aşağıdakı menyuda bu düyməyə basın.'), where: null);
      case 'mood_tile':
        return (title: tr('obtour_mood_tile_title', 'Əhval Gündəliyi burada'), text: tr('obtour_mood_tile_text', 'Ödənişsiz alətlər arasındadır. Basın, açaq.'), where: where(toolsArea));
      case 'mood_log':
        return (
          title: tr('obtour_mood_log_title', 'Bu gün necəsiniz?'),
          text: tr('obtour_mood_log_text', 'Əhvalınızı seçib yadda saxlayın. Gündə 5 saniyə kifayətdir.'),
          where: where('$toolsArea › ${_toolName(sub.toolId)}'),
        );
      case 'push':
        return (
          title: _hasMood ? tr('obtour_push_title', 'Axşamlar əhval yoxlamasını xatırladaq?') : tr('obtour_push_title_general', 'Vacib xatırlatmaları göndərək?'),
          text: tr('obtour_push_text', 'Yalnız faydalı xatırlatmalar. İstənilən an Ayarlardan söndürə bilərsiniz.'),
          where: null,
        );
      case 'tools_tab':
        return (title: tr('obtour_tools_tab_title', 'Bütün alətlər burada'), text: tr('obtour_tools_tab_text', 'Aşağıdakı menyuda Alətlər düyməsinə basın.'), where: null);
      case 'tools_list_free':
        return (title: tr('obtour_tools_free_title', 'Bunlar sizdə ödənişsizdir'), text: tr('obtour_tools_free_text', 'Hər zaman açıqdır. İkisinə birlikdə baxaq.'), where: where(toolsArea));
      case 'tools_list_premium':
        return (
          title: tr('obtour_tools_premium_title', 'Premium alətləriniz açıqdır'),
          text: tr('obtour_tools_premium_text', 'Mərhələnizə görə ən faydalıları yuxarıdadır. İkisinə baxaq.'),
          where: where(toolsArea),
        );
      case 'tool_page':
        return (title: _toolName(sub.toolId), text: _toolText(sub.toolId), where: where('$toolsArea › ${_toolName(sub.toolId)}'));
      case 'ai_tab':
        return (title: tr('obtour_ai_tab_title', 'Anacan AI'), text: tr('obtour_ai_tab_text', 'Gecə 3-də də cavab verir. Basın, açaq.'), where: null);
      case 'ai_screen_free':
        return (
          title: tr('obtour_ai_title', 'İstədiyinizi soruşun'),
          text: _fill(tr('obtour_ai_free_text', 'Gündə {n} sual ödənişsizdir. Sualınızı yazın və ya hazır suallardan birini seçin.'), {'n': widget.aiFreePerDay}),
          where: where(tr('obtour_where_ai', 'Anacan AI')),
        );
      case 'ai_screen_premium':
        return (
          title: tr('obtour_ai_title', 'İstədiyinizi soruşun'),
          text: tr('obtour_ai_premium_text', 'Limitsizdir. Sualınızı yazın və ya hazır suallardan birini seçin.'),
          where: where(tr('obtour_where_ai', 'Anacan AI')),
        );
      case 'community_tab':
        return (
          title: tr('obtour_community_tab_title', 'İcma'),
          text: widget.stage == 'flow'
              ? tr('obtour_community_tab_text_flow', 'Sizin kimi qadınlar: sual verin, təcrübə paylaşın.')
              : tr('obtour_community_tab_text_mom', 'Sizin kimi analar: sual verin, təcrübə paylaşın.'),
          where: null,
        );
      case 'community_screen':
        return (
          title: tr('obtour_community_title', 'Burada tək deyilsiniz'),
          text: tr('obtour_community_text', 'Maraqlı mövzuları izləyin, cavablar bildiriş kimi gəlsin.'),
          where: where(tr('obtour_where_community', 'İcma')),
        );
      default:
        return (title: '', text: '', where: null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final dark = tokens.isDark;
    final ink = dark ? const Color(0xFFFFFFFF) : _Gt.inkLight;
    return AScope(
      child: DefaultTextStyle.merge(
        style: TextStyle(color: ink),
        child: Material(type: MaterialType.transparency, child: _sub.kind == 'card' ? _card(context, dark, ink) : _coach(context, dark, ink)),
      ),
    );
  }

  Widget _glass({required Widget child, required BorderRadius radius, required EdgeInsets padding, required bool dark}) {
    final blur = AnacanTokens.of(context).blurEnabled;
    final panel = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: blur ? (dark ? _Gt.glassDark : _Gt.glassLight) : (dark ? _Gt.glassDarkSolid : _Gt.glassLightSolid),
        borderRadius: radius,
        border: Border.all(color: dark ? _Gt.edgeDark : _Gt.edgeLight),
        boxShadow: [BoxShadow(color: Color.fromRGBO(0, 0, 0, dark ? 0.7 : 0.45), offset: const Offset(0, 24), blurRadius: 48, spreadRadius: -24)],
      ),
      child: child,
    );
    if (!blur) return panel;
    return ClipRRect(
      borderRadius: radius,
      child: BackdropFilter(
        filter: ui.ImageFilter.compose(outer: ColorFilter.matrix(saturateMatrix(1.8)), inner: ui.ImageFilter.blur(sigmaX: 15, sigmaY: 15)),
        child: panel,
      ),
    );
  }

  Widget _btn(String label, VoidCallback? onTap, {String variant = 'primary', bool full = false}) {
    final dark = AnacanTokens.of(context).isDark;
    final (Gradient? gradient, Color? color, Color fg, List<BoxShadow> shadow) = switch (variant) {
      'ghost' => (null, dark ? const Color.fromRGBO(255, 255, 255, 0.14) : const Color.fromRGBO(255, 255, 255, 0.6), dark ? Colors.white : _Gt.inkLight, const <BoxShadow>[]),
      'gold' => (
          const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFFFE7A3), Color(0xFFF6C453)]),
          null,
          const Color(0xFF5A3A00),
          const [BoxShadow(color: Color.fromRGBO(246, 196, 83, 0.9), offset: Offset(0, 10), blurRadius: 22, spreadRadius: -10)],
        ),
      _ => (
          const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color.fromRGBO(255, 110, 114, 0.97), Color.fromRGBO(255, 90, 95, 0.97)]),
          null,
          Colors.white,
          const [BoxShadow(color: Color.fromRGBO(255, 90, 95, 0.8), offset: Offset(0, 10), blurRadius: 22, spreadRadius: -10)],
        ),
    };
    Widget body = Container(
      width: full ? double.infinity : null,
      padding: full ? const EdgeInsets.all(15) : const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
      decoration: BoxDecoration(gradient: gradient, color: color, borderRadius: BorderRadius.circular(full ? 16 : 14), boxShadow: shadow),
      child: Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: full ? 15 : 14, fontWeight: FontWeight.w700, color: fg)),
    );
    if (onTap == null) body = Opacity(opacity: 0.6, child: body);
    return Semantics(button: true, child: GestureDetector(onTap: onTap, child: body));
  }

  Widget _link(String label, VoidCallback onTap) => Semantics(
        button: true,
        child: GestureDetector(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(6),
            child: Opacity(opacity: 0.72, child: Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13.5))),
          ),
        ),
      );

  Widget _card(BuildContext context, bool dark, Color ink) {
    final padding = MediaQuery.paddingOf(context);
    final blur = AnacanTokens.of(context).blurEnabled;
    late final Widget card;
    String art = '';
    switch (_sub.copy) {
      case 'welcome':
        card = Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text(tr('obtour_welcome_kick', 'Planın hazırdır'),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: dark ? _Gt.kickDark : (context.a.accentInk))),
          const SizedBox(height: 4),
          Text(_fill(tr('obtour_welcome_title', 'Xoş gəldin, {name}!'), {'name': widget.name}),
              style: TextStyle(fontSize: 24, height: 1.15, letterSpacing: em(-0.03, 24), fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Opacity(
            opacity: 0.82,
            child: Text(tr('obtour_welcome_text', 'Sənə əsas yerləri göstərək: alətlər, Anacan AI və İcma. Təxminən 40 saniyə.'), style: const TextStyle(fontSize: 14, height: 1.45)),
          ),
          const SizedBox(height: 14),
          _btn(tr('obtour_start', 'Başlayaq'), _next, full: true),
          const SizedBox(height: 10),
          _link(tr('obtour_later', 'Sonra, özüm baxaram'), () => _finish('skipped')),
        ]);
      case 'premium':
        art = '👑';
        final items = <(String, String)>[
          (
            '📊',
            widget.stage == 'flow'
                ? tr('obtour_prem_b1_flow', 'Ovulyasiya və simptom analizi')
                : widget.stage == 'bump'
                    ? tr('obtour_prem_b1_bump', 'Hamiləlik alətləri: təpik, sancı, çəki')
                    : tr('obtour_prem_b1_mommy', 'Bütün izləmə alətləri: yuxu, qidalanma, boy-çəki'),
          ),
          ('✨', tr('obtour_prem_b2', 'Limitsiz Anacan AI')),
          ('📄', tr('obtour_prem_b3', 'Həkim üçün PDF hesabat')),
          widget.stage == 'flow' ? ('💊', tr('obtour_prem_b4_flow', 'Vitamin və qidalanma izləmə')) : ('👨‍👩‍👧', tr('obtour_prem_b4', 'Partnyor hesabı')),
          ('🚫', tr('obtour_prem_b5', 'Reklamsız təcrübə')),
        ];
        final itemBg = dark ? const Color.fromRGBO(255, 255, 255, 0.08) : const Color.fromRGBO(255, 255, 255, 0.6);
        final itemEdge = dark ? const Color.fromRGBO(255, 255, 255, 0.14) : _Gt.edgeLight;
        card = Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFFFE7A3), Color(0xFFF6C453)]),
              ),
              child: Text('👑 ${tr('obtour_premium_badge', 'Anacan Premium')}',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF6A4500))),
            ),
          ),
          Text(tr('obtour_premium_title', 'Daha çoxunu açın'), style: TextStyle(fontSize: 24, height: 1.15, letterSpacing: em(-0.03, 24), fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Opacity(opacity: 0.82, child: Text(tr('obtour_premium_text', 'Ödənişsiz plan sizdə qalır. Premium ilə əlavə olaraq:'), style: const TextStyle(fontSize: 14, height: 1.45))),
          const SizedBox(height: 14),
          for (final (icon, text) in items)
            Container(
              margin: const EdgeInsets.only(bottom: 7),
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
              decoration: BoxDecoration(color: itemBg, border: Border.all(color: itemEdge), borderRadius: BorderRadius.circular(14)),
              child: Row(children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(color: dark ? const Color.fromRGBO(255, 255, 255, 0.14) : const Color.fromRGBO(255, 255, 255, 0.6), borderRadius: BorderRadius.circular(10)),
                  alignment: Alignment.center,
                  child: Text(icon),
                ),
                const SizedBox(width: 10),
                Expanded(child: Text(text, style: const TextStyle(fontSize: 13))),
              ]),
            ),
          const SizedBox(height: 9),
          _btn(tr('obtour_premium_cta', 'Premium-a bax'), () {
            _finish('done');
            widget.onPremium();
          }, variant: 'gold', full: true),
          const SizedBox(height: 10),
          _link(tr('obtour_premium_free', 'Ödənişsiz davam et'), _next),
        ]);
      default:
        art = '✨';
        card = Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text(tr('obtour_final_title', 'Hazırsınız!'), style: TextStyle(fontSize: 24, height: 1.15, letterSpacing: em(-0.03, 24), fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Opacity(
            opacity: 0.82,
            child: Text(tr('obtour_final_text', 'Hər şey yerindədir. Sualınız olsa, Anacan AI həmişə buradadır.'), style: const TextStyle(fontSize: 14, height: 1.45)),
          ),
          const SizedBox(height: 14),
          _btn(tr('obtour_final_cta', 'Başla'), () => _finish('done'), full: true),
        ]);
    }
    Widget wrap = Container(
      color: dark ? _Gt.wrapDark : _Gt.wrapLight,
      padding: EdgeInsets.fromLTRB(12, 0, 12, 16 + padding.bottom),
      child: Column(children: [
        Expanded(
          child: Center(
            child: Text(art, style: const TextStyle(fontSize: 84, shadows: [Shadow(color: Color.fromRGBO(0, 0, 0, 0.18), offset: Offset(0, 16), blurRadius: 24)])),
          ),
        ),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: _glass(child: card, radius: BorderRadius.circular(32), padding: const EdgeInsets.fromLTRB(20, 22, 20, 18), dark: dark),
        ),
      ]),
    );
    if (blur) {
      wrap = ClipRect(
        child: BackdropFilter(
          filter: ui.ImageFilter.compose(outer: ColorFilter.matrix(saturateMatrix(1.5)), inner: ui.ImageFilter.blur(sigmaX: 9, sigmaY: 9)),
          child: wrap,
        ),
      );
    }
    return Semantics(scopesRoute: true, explicitChildNodes: true, child: wrap);
  }

  Widget _coach(BuildContext context, bool dark, Color ink) {
    final size = MediaQuery.sizeOf(context);
    final padding = MediaQuery.paddingOf(context);
    final copy = _copy();
    final sub = _sub;
    final rect = _rect;
    final spot = sub.kind == 'spot' && rect != null && !_missing;
    final pad = (sub.target ?? '').startsWith('tab-') ? 4.0 : 6.0;
    final hole = spot ? Rect.fromLTWH(rect.left - pad, rect.top - pad, rect.width + pad * 2, rect.height + pad * 2) : null;
    final vh = size.height;
    double? top, bottom;
    if (hole != null) {
      if (hole.center.dy > vh / 2) {
        bottom = (vh - hole.top + 14).clamp(16.0, double.infinity);
      } else {
        top = (hole.bottom + 14).clamp(double.negativeInfinity, vh - 260);
      }
    } else {
      bottom = 96 + padding.bottom;
    }
    final counted = countedSteps(widget.plan);
    final stepNo = widget.plan.take(_si + 1).where((s) => s.id != 'welcome' && s.id != 'final').length;
    final whereBg = dark ? const Color.fromRGBO(255, 255, 255, 0.12) : const Color.fromRGBO(255, 255, 255, 0.55);
    final whereEdge = dark ? const Color.fromRGBO(255, 255, 255, 0.16) : _Gt.edgeLight;
    final pushBg = dark ? const Color.fromRGBO(255, 255, 255, 0.08) : const Color.fromRGBO(255, 255, 255, 0.42);
    final pushEdge = dark ? const Color.fromRGBO(255, 255, 255, 0.14) : _Gt.edgeLight;

    final coach = Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Opacity(
        opacity: 0.78,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(children: [
            Expanded(child: Text(_fill(tr('obtour_step', '{n} / {total}'), {'n': stepNo, 'total': counted}), style: const TextStyle(fontSize: 11.5))),
            if (_step.subs.length > 1)
              Row(children: [
                for (var k = 0; k < _step.subs.length; k++) ...[
                  if (k > 0) const SizedBox(width: 4),
                  Opacity(
                    opacity: k == _ui ? 1 : 0.25,
                    child: Container(width: k == _ui ? 16 : 6, height: 6, decoration: BoxDecoration(color: ink, borderRadius: BorderRadius.circular(3))),
                  ),
                ],
              ]),
          ]),
        ),
      ),
      if (copy.where != null)
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(color: whereBg, border: Border.all(color: whereEdge), borderRadius: BorderRadius.circular(999)),
            child: Text('📍 ${copy.where}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: dark ? _Gt.kickDark : context.a.accentInk)),
          ),
        ),
      Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Text(copy.title, style: TextStyle(fontSize: 17, height: 1.25, fontWeight: FontWeight.w800, letterSpacing: em(-0.02, 17))),
      ),
      if (copy.text.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Opacity(opacity: 0.82, child: Text(copy.text, style: const TextStyle(fontSize: 13.5, height: 1.45))),
        ),
      if (sub.kind == 'push')
        Container(
          margin: const EdgeInsets.only(top: 2, bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: pushBg, border: Border.all(color: pushEdge), borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            Expanded(child: _btn(tr('obtour_push_no', 'İndi yox'), _busy ? null : _next, variant: 'ghost')),
            const SizedBox(width: 8),
            Expanded(
              child: _btn(tr('obtour_push_yes', 'Bəli, xatırlat'), _busy
                  ? null
                  : () async {
                      setState(() => _busy = true);
                      try {
                        await widget.onPush();
                      } finally {
                        if (mounted) setState(() => _busy = false);
                        _next();
                      }
                    }),
            ),
          ]),
        ),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Semantics(
          button: true,
          child: GestureDetector(
            onTap: () => _finish('skipped'),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Opacity(opacity: 0.7, child: Text(tr('obtour_skip', 'Turu bağla'), style: const TextStyle(fontSize: 13))),
            ),
          ),
        ),
        if (sub.kind != 'push') _btn(_isLast ? tr('obtour_finish', 'Bitir') : tr('obtour_next', 'Davam'), _isLast ? () => _finish('done') : _next),
      ]),
    ]);

    final dim = dark ? _Gt.dimDark : _Gt.dimLight;
    return Stack(children: [
      if (hole != null) ...[
        // `box-shadow: 0 0 0 200vmax` dim around the hole + a white pulsing ring.
        Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: _HolePainter(hole, dim, (sub.target ?? '').startsWith('tab-') ? 20 : 20)))),
        // Blocks around the hole; the hole itself lets taps through to the app.
        Positioned(left: 0, top: 0, right: 0, height: hole.top.clamp(0, double.infinity), child: const _Block()),
        Positioned(left: 0, top: hole.bottom, right: 0, bottom: 0, child: const _Block()),
        Positioned(left: 0, top: hole.top, width: hole.left.clamp(0, double.infinity), height: hole.height, child: const _Block()),
        Positioned(left: hole.right, top: hole.top, right: 0, height: hole.height, child: const _Block()),
        // Tapping the highlighted element is the same as "next" (the app performs its own navigation).
        Positioned.fromRect(
          rect: hole,
          child: Listener(behavior: HitTestBehavior.translucent, onPointerUp: (_) => Timer(Duration.zero, _next)),
        ),
      ],
      Positioned(
        left: 14,
        right: 14,
        top: top,
        bottom: bottom,
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Semantics(
              liveRegion: true,
              label: copy.title,
              child: _glass(child: coach, radius: BorderRadius.circular(26), padding: const EdgeInsets.fromLTRB(16, 15, 16, 14), dark: dark),
            ),
          ),
        ),
      ),
    ]);
  }
}

class _Block extends StatelessWidget {
  const _Block();
  @override
  Widget build(BuildContext context) => GestureDetector(behavior: HitTestBehavior.opaque, child: const SizedBox.expand());
}

class _HolePainter extends CustomPainter {
  _HolePainter(this.hole, this.dim, this.radius);
  final Rect hole;
  final Color dim;
  final double radius;
  @override
  void paint(Canvas canvas, Size size) {
    final rr = RRect.fromRectAndRadius(hole, Radius.circular(radius));
    final path = Path()
      ..fillType = PathFillType.evenOdd
      ..addRect(Offset.zero & size)
      ..addRRect(rr);
    canvas.drawPath(path, Paint()..color = dim);
    canvas.drawRRect(
      rr.inflate(6),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = const Color.fromRGBO(255, 255, 255, 0.95),
    );
  }

  @override
  bool shouldRepaint(_HolePainter old) => old.hole != hole || old.dim != dim;
}

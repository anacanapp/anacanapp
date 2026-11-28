// Ported from: src/components/tools/weaning/WeaningScreens.tsx, src/styles/anacan-design.css (.a-wean*)
//
// The screens of the weaning tool: intro, readiness, plan builder, plan hub (+ timeline), step detail, daily
// check-in and its result, and the guides (nutrition, mother, myths, night, finish).
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design/design.dart';
import '../../../domain/health/emergency.dart' show fillEmergencyNumber;
import '../../../domain/js_compat.dart';
import '../../../domain/weaning/weaning.dart';
import '../../premium/premium_gates.dart' show PremiumBlurGate;
import '../kit/kit.dart' show safetyCallLauncherProvider;
import '../parenting/programme_ui.dart';
import 'weaning_copy.dart';
import 'weaning_sync.dart';

/// 'intro' | 'ready' | 'builder' | 'hub' | 'step' | 'checkin' | 'result' | 'nutrition' | 'mother' | 'myths' | 'night'
/// | 'finish'
typedef WeaningScreen = String;

class WeaningCtx {
  const WeaningCtx({
    required this.today,
    required this.isPremium,
    required this.childName,
    required this.childGender,
    required this.childId,
    required this.ageMonths,
    required this.emergency,
    required this.local,
    required this.plan,
    required this.stepId,
    required this.go,
    required this.update,
    required this.setPlan,
    required this.openTool,
    required this.share,
    required this.fmt,
    required this.toast,
    required this.confirm,
    required this.call,
  });
  final String today;
  final bool isPremium;
  final String childName;
  final String? childGender;
  final String? childId;
  final int? ageMonths;
  final String emergency;
  final WeaningLocal local;
  final WeaningPlan? plan;
  final String? stepId;
  final void Function(WeaningScreen screen, {String? stepId, bool reset}) go;
  final void Function(WeaningLocal Function(WeaningLocal s) fn) update;
  final void Function(WeaningPlan? plan) setPlan;
  final void Function(String toolId) openTool;
  final void Function(String title, String text) share;
  final String Function(String day) fmt;

  /// sonner `toast` / `toast.success`.
  final void Function(String message, {bool success}) toast;
  final Future<bool> Function(String message) confirm;

  /// `<a href="tel:…">`.
  final void Function(String number) call;
}

const String _premium = 'Premium';
String _ftKey(FeedType t, [String suffix = '']) => 'weaning_ft_$t$suffix';
String _stepTitle(WeaningStep s) => '${feedIcons[s.type]} ${stepLabel(s)}';
String _partnerHint(FeedType t) => wt(t == 'night' || t == 'bedtime' || t == 'nap' ? 'weaning_partner_sleep' : 'weaning_partner_day');

// ── Pieces (.a-wean-*) ───────────────────────────────────────────────────────────────────────

({Color? bg, Gradient? gradient, Color fg}) _tone(ATokens a, Tone tone) => switch (tone) {
      'mint' => (bg: a.green1, gradient: null, fg: a.greenInk),
      'amber' => (bg: a.yellow1, gradient: null, fg: a.warnInk),
      'red' => (bg: null, gradient: a.alertBg, fg: a.alertInk),
      'sky' => (bg: a.blue1, gradient: null, fg: a.blueInk),
      'prem' => (bg: a.lav1, gradient: null, fg: a.lavInk),
      _ => (bg: a.peach1, gradient: null, fg: a.accentInk),
    };

/// `.a-wean` column (gap 12).
class _Wean extends StatelessWidget {
  const _Wean({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Gap(gap: 12, children: children);
}

/// `.a-wean-card`.
class WCard extends StatelessWidget {
  const WCard({super.key, required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: a.surface, border: Border.all(color: a.line), borderRadius: BorderRadius.circular(20), boxShadow: a.cardShadow),
      child: Gap(gap: 8, children: children),
    );
  }
}

Widget _h3(BuildContext context, String text) => Text(text, style: css(15, weight: FontWeight.w800, em: -0.01, color: context.a.ink));
Widget _p(BuildContext context, String text) => Text(text, style: css(13, color: context.a.bodyText));
Widget _lab(BuildContext context, String text) => Text(text, style: css(13, weight: FontWeight.w700, color: context.a.ink));
Widget _small(BuildContext context, String text) => Text(text, style: css(11.5, height: 1.45, color: context.a.inkSoft));

/// `.a-wean-btn` (`ghost`, `small`).
class WBtn extends StatelessWidget {
  const WBtn({super.key, required this.label, required this.onTap, this.ghost = false, this.small = false, this.disabled = false, this.trailing});
  final String label;
  final VoidCallback onTap;
  final bool ghost;
  final bool small;
  final bool disabled;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = ghost ? a.ink : a.onCoral;
    final body = Container(
      constraints: BoxConstraints(minHeight: small ? 38 : 46),
      padding: EdgeInsets.symmetric(horizontal: small ? 14 : 16, vertical: small ? 8 : 12),
      decoration: BoxDecoration(
        color: ghost ? a.surface : a.coral,
        borderRadius: BorderRadius.circular(999),
        border: ghost ? Border.all(color: a.line) : null,
        boxShadow: ghost ? a.cardShadow : a.coralShadow,
      ),
      child: Row(mainAxisSize: small ? MainAxisSize.min : MainAxisSize.max, mainAxisAlignment: MainAxisAlignment.center, children: [
        Flexible(child: Text(label, textAlign: TextAlign.center, style: css(small ? 12.5 : 14, weight: FontWeight.w700, color: fg))),
        if (trailing != null) ...[const SizedBox(width: 6), trailing!],
      ]),
    );
    final btn = Tap(label: label, enabled: !disabled, onTap: onTap, excludeSemantics: true, child: Opacity(opacity: disabled ? 0.45 : 1, child: body));
    return small ? Align(alignment: AlignmentDirectional.centerStart, child: btn) : btn;
  }
}

/// `.a-wean-chip` (`aria-pressed`).
class WChip extends StatelessWidget {
  const WChip({super.key, required this.label, required this.pressed, required this.onTap, this.sub});
  final String label;
  final bool pressed;
  final VoidCallback onTap;
  final String? sub;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Tap(
      label: label,
      pressed: pressed,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: pressed ? a.peach1 : a.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: pressed ? a.coral : a.lineStrong, width: 1.5),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(label, style: css(12.5, weight: pressed ? FontWeight.w700 : FontWeight.w400, height: 1.35, color: pressed ? a.accentInk : a.ink)),
          if (sub != null) Text(sub!, style: css(11, weight: FontWeight.w500, height: 1.35, color: a.inkSoft)),
        ]),
      ),
    );
  }
}

/// `.a-wean-pill.is-<tone>`.
class WPill extends StatelessWidget {
  const WPill(this.text, {super.key, this.tone = 'coral', this.icon});
  final String text;
  final String tone;
  final Widget? icon;
  @override
  Widget build(BuildContext context) {
    final c = _tone(context.a, tone);
    return Align(
      alignment: AlignmentDirectional.centerStart,
      widthFactor: 1,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
        decoration: BoxDecoration(color: c.bg, gradient: c.gradient, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[icon!, const SizedBox(width: 4)],
          Flexible(child: Text(text, style: css(11, weight: FontWeight.w700, color: c.fg))),
        ]),
      ),
    );
  }
}

Widget _freePill() => WPill(wt('weaning_free'), tone: 'mint');
Widget _premiumPill(BuildContext context) =>
    WPill(_premium, tone: 'prem', icon: AIcon(AIcons.crown, size: 11, strokeWidth: 2.5, color: context.a.lavInk));

/// `.a-wean-alert.is-<tone>` (role=alert for red).
class WAlert extends StatelessWidget {
  const WAlert({super.key, required this.tone, required this.title, this.children = const []});
  final Tone tone;
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final c = _tone(context.a, tone);
    return Semantics(
      liveRegion: tone == 'red',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
        decoration: BoxDecoration(color: c.bg, gradient: c.gradient, borderRadius: BorderRadius.circular(16)),
        child: DefaultTextStyle.merge(
          style: css(13, color: c.fg),
          child: Gap(gap: 6, children: [
            Text(title, style: css(13.5, weight: FontWeight.w700, color: c.fg)),
            ...children,
          ]),
        ),
      ),
    );
  }
}

/// `.a-wean-list` row: an icon square (28, radius 10) and the text.
Widget _li(BuildContext context, String ic, Widget body, {bool square = true}) {
  final a = context.a;
  return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
    square
        ? Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(10)),
            child: Text(ic, style: css(14, weight: FontWeight.w800, height: 1.2, color: a.ink)),
          )
        : Text(ic, style: css(13, height: 1.45)),
    const SizedBox(width: 10),
    Expanded(child: DefaultTextStyle.merge(style: css(13, height: 1.45), child: body)),
  ]);
}

Widget _list(List<Widget> rows) => Gap(gap: 8, children: rows);

/// `.a-wean-toggle`.
class _Toggle extends StatelessWidget {
  const _Toggle({required this.pressed, required this.onToggle, required this.label, super.key});
  final bool pressed;
  final VoidCallback onToggle;
  final String label;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Tap(
      label: label,
      pressed: pressed,
      onTap: onToggle,
      excludeSemantics: true,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 44,
        height: 26,
        padding: const EdgeInsets.all(3),
        alignment: pressed ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
        decoration: BoxDecoration(color: pressed ? a.coral : a.lineStrong, borderRadius: BorderRadius.circular(99)),
        child: Container(width: 20, height: 20, decoration: const BoxDecoration(color: Color(0xFFFFFFFF), shape: BoxShape.circle)),
      ),
    );
  }
}

/// `.a-wean-kv` (dt / dd pairs).
Widget _kv(BuildContext context, List<(String, String)> rows) {
  final a = context.a;
  return Table(
    columnWidths: const {0: IntrinsicColumnWidth(), 1: FlexColumnWidth()},
    children: [
      for (final r in rows)
        TableRow(children: [
          Padding(padding: const EdgeInsets.only(right: 10, bottom: 4), child: Text(r.$1, style: css(12.5, color: a.inkSoft))),
          Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(r.$2, style: css(12.5, weight: FontWeight.w700, color: a.ink))),
        ]),
    ],
  );
}

/// `.a-wean-call`.
class _Call extends StatelessWidget {
  const _Call({required this.ctx});
  final WeaningCtx ctx;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final label = wf('weaning_call_emergency', {'emergency': ctx.emergency});
    return Semantics(
      link: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        key: const ValueKey('weaning-call'),
        behavior: HitTestBehavior.opaque,
        onTap: () => ctx.call(ctx.emergency),
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          decoration: BoxDecoration(color: a.pinkInk, borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const AIcon(AIcons.phone, size: 15, color: Color(0xFFFFFFFF)),
            const SizedBox(width: 6),
            Text(label, style: css(13, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
          ]),
        ),
      ),
    );
  }
}

/// `.a-wean-sec`.
Widget _sec(BuildContext context, String text, Widget? pill) => Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Flexible(child: Text(text.toUpperCase(), style: css(12, weight: FontWeight.w800, em: 0.06, color: context.a.onBgSoft))),
        ?pill,
      ]),
    );

// ── Intro ────────────────────────────────────────────────────────────────────────────────────
class IntroScreen extends StatelessWidget {
  const IntroScreen({super.key, required this.ctx});
  final WeaningCtx ctx;

  void _setContinue(bool v) {
    ctx.update((s) => s.copyWith(continueBF: v));
    if (v) ctx.toast(wt('weaning_continue_saved'), success: true);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final local = ctx.local;
    return _Wean(children: [
      Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(24)),
        child: Gap(gap: 8, children: [
          if (ctx.ageMonths != null) WPill('${ctx.childName} · ${wf('weaning_age_months', {'n': ctx.ageMonths})}'),
          Text(wt('weaning_intro_title'), style: css(22, weight: FontWeight.w800, height: 1.15, em: -0.02, color: a.ink)),
          Text(wt('weaning_intro_text'), style: css(13, color: a.bodyText)),
        ]),
      ),
      if (local.continueBF)
        WAlert(tone: 'mint', title: wt('weaning_continue_active_title'), children: [
          Text(wt('weaning_continue_active_text')),
          WBtn(label: wt('weaning_continue_undo'), ghost: true, small: true, onTap: () => _setContinue(false)),
        ]),
      Grid(columns: 3, gap: 8, children: [
        for (final p in const [('🐢', 'weaning_principle_gradual'), ('🤍', 'weaning_principle_safe'), ('🫶', 'weaning_principle_choice')])
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
            decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16), boxShadow: a.cardShadow),
            child: Column(children: [
              Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(p.$1, style: css(20, height: 1.2))),
              Text(wt(p.$2), textAlign: TextAlign.center, style: css(11.5, weight: FontWeight.w700, height: 1.3, color: a.ink)),
            ]),
          ),
      ]),
      ctx.plan != null
          ? WBtn(label: wt('weaning_cta_open_plan'), onTap: () => ctx.go('hub', reset: true))
          : WBtn(label: wt('weaning_cta_build'), onTap: () => ctx.go('ready')),
      WCard(children: [
        _h3(context, wt('weaning_read_first')),
        _list([
          for (final l in const [('🥛', 'weaning_link_nutrition', 'nutrition'), ('🚫', 'weaning_link_myths', 'myths'), ('💗', 'weaning_link_mother', 'mother'), ('🌙', 'weaning_link_night', 'night')])
            _li(context, l.$1, Align(alignment: AlignmentDirectional.centerStart, child: WChip(label: wt(l.$2), pressed: false, onTap: () => ctx.go(l.$3)))),
        ]),
      ]),
      if (!local.continueBF)
        WCard(children: [
          _h3(context, wt('weaning_continue_title')),
          _p(context, wt('weaning_continue_text')),
          WBtn(label: wt('weaning_continue_btn'), ghost: true, small: true, onTap: () => _setContinue(true)),
        ]),
      _small(context, wt('weaning_sources')),
    ]);
  }
}

// ── Readiness ────────────────────────────────────────────────────────────────────────────────
class ReadyScreen extends StatelessWidget {
  const ReadyScreen({super.key, required this.ctx});
  final WeaningCtx ctx;

  Readiness _with(Readiness r, {Object? sick = _same, Object? change = _same, Object? allergy = _same, List<String>? reasons}) => Readiness(
        sick: identical(sick, _same) ? r.sick : sick as bool?,
        change: identical(change, _same) ? r.change : change as bool?,
        allergy: identical(allergy, _same) ? r.allergy : allergy as bool?,
        reasons: reasons ?? r.reasons,
      );

  @override
  Widget build(BuildContext context) {
    final r = ctx.local.readiness;
    final v = readinessVerdict(ctx.ageMonths, r);
    final canAsk = ctx.ageMonths != null && v.canPlan;
    final answered = readinessAnswered(r);
    void set(String k, bool val) => ctx.update((s) => s.copyWith(
        readiness: k == 'sick'
            ? _with(s.readiness, sick: val)
            : k == 'change'
                ? _with(s.readiness, change: val)
                : _with(s.readiness, allergy: val)));
    void toggleReason(String id) => ctx.update((s) {
          final has = s.readiness.reasons.contains(id);
          return s.copyWith(readiness: _with(s.readiness, reasons: has ? s.readiness.reasons.where((x) => x != id).toList() : [...s.readiness.reasons, id]));
        });
    bool? value(String k) => k == 'sick' ? r.sick : k == 'change' ? r.change : r.allergy;
    Widget yn(String k, String q, [String? help]) => Semantics(
          container: true,
          label: wt(q),
          child: WCard(key: ValueKey('weaning-q-$k'), children: [
            _lab(context, wt(q)),
            if (help != null) _p(context, wt(help)),
            WrapRow(gap: 8, children: [
              WChip(key: ValueKey('weaning-q-$k-yes'), label: wt('weaning_yes'), pressed: value(k) == true, onTap: () => set(k, true)),
              WChip(key: ValueKey('weaning-q-$k-no'), label: wt('weaning_no'), pressed: value(k) == false, onTap: () => set(k, false)),
            ]),
          ]),
        );
    return _Wean(children: [
      WCard(children: [
        _kv(context, [
          (
            wt('weaning_child'),
            ctx.ageMonths == null ? ctx.childName : wf('weaning_from_profile', {'name': ctx.childName, 'age': wf('weaning_age_months', {'n': ctx.ageMonths})}),
          ),
        ]),
      ]),
      if (canAsk) ...[
        yn('sick', 'weaning_q_sick'),
        yn('change', 'weaning_q_change', 'weaning_q_change_help'),
        yn('allergy', 'weaning_q_allergy'),
        WCard(children: [
          _lab(context, wt('weaning_reason_title')),
          _p(context, wt('weaning_reason_help')),
          WrapRow(gap: 8, children: [
            for (final id in reasons) WChip(label: wt('weaning_reason_$id'), pressed: r.reasons.contains(id), onTap: () => toggleReason(id)),
          ]),
        ]),
      ],
      if (canAsk && r.reasons.contains('pregnant')) WAlert(tone: 'sky', title: wt('weaning_pregnant_title'), children: [Text(wt('weaning_pregnant_text'))]),
      if (canAsk && r.allergy == true) WAlert(tone: 'amber', title: wt('weaning_allergy_title'), children: [Text(wt('weaning_allergy_text'))]),
      if (answered || !canAsk) WAlert(tone: v.tone, title: wt(v.title), children: [Text(wt(v.text))]),
      v.canPlan
          ? WBtn(label: wt(v.delay != 0 ? 'weaning_ready_continue_delay' : 'weaning_ready_continue'), disabled: !answered, onTap: () => ctx.go('builder'))
          : WBtn(label: wt('weaning_read_nutrition'), ghost: true, onTap: () => ctx.go('nutrition')),
    ]);
  }
}

const Object _same = Object();

// ── Plan builder ─────────────────────────────────────────────────────────────────────────────
class BuilderScreen extends StatefulWidget {
  const BuilderScreen({super.key, required this.ctx});
  final WeaningCtx ctx;
  @override
  State<BuilderScreen> createState() => _BuilderScreenState();
}

class _BuilderScreenState extends State<BuilderScreen> {
  String _startChoice = 'recommended';

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final a = context.a;
    final feeds = ctx.local.feeds, pace = ctx.local.pace, nightMode = ctx.local.nightMode;
    final v = readinessVerdict(ctx.ageMonths, ctx.local.readiness);
    if (!v.canPlan) return ReadyScreen(ctx: ctx);
    final delay = _startChoice == 'recommended' ? v.delay : 0;
    final start = addDaysToDay(ctx.today, delay);
    final steps = planStepCount(feeds, nightMode);
    Feeds patch(Feeds f, String k, Object value) => Feeds(
          morning: k == 'morning' ? value as bool : f.morning,
          day: k == 'day' ? value as num : f.day,
          nap: k == 'nap' ? value as bool : f.nap,
          bedtime: k == 'bedtime' ? value as bool : f.bedtime,
          night: k == 'night' ? value as num : f.night,
        );
    void setFeed(String k, Object value) => ctx.update((s) => s.copyWith(feeds: patch(s.feeds, k, value)));
    Widget row(String k, FeedType icon) {
      final label = wt('weaning_feed_$k');
      final isCount = k == 'day' || k == 'night';
      final count = k == 'day' ? feeds.day : feeds.night;
      final on = k == 'morning' ? feeds.morning : k == 'nap' ? feeds.nap : feeds.bedtime;
      Widget stepBtn(String text, String lbl, bool disabled, VoidCallback onTap, String key) => Tap(
            key: ValueKey(key),
            label: lbl,
            enabled: !disabled,
            onTap: onTap,
            excludeSemantics: true,
            child: Opacity(
              opacity: disabled ? 0.4 : 1,
              child: Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(10)),
                child: Text(text, style: css(18, color: a.ink, height: 1.2)),
              ),
            ),
          );
      return Container(
        key: ValueKey('weaning-feed-$k'),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(border: k == 'night' ? null : Border(bottom: BorderSide(color: a.line))),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${feedIcons[icon]} $label', style: css(13, weight: FontWeight.w700, color: a.ink)),
              Text(wt('weaning_feed_${k}_sub'), style: css(11.5, color: a.inkSoft)),
            ]),
          ),
          const SizedBox(width: 10),
          if (isCount)
            Row(mainAxisSize: MainAxisSize.min, children: [
              stepBtn('−', wt('weaning_decrease'), count <= 0, () => setFeed(k, math.max(0, count - 1)), 'weaning-$k-minus'),
              const SizedBox(width: 10),
              ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 22),
                child: Text(jsNumberToString(count), textAlign: TextAlign.center, style: css(13, weight: FontWeight.w800, color: a.ink)),
              ),
              const SizedBox(width: 10),
              stepBtn('+', wt('weaning_increase'), count >= feedMax[k]!, () => setFeed(k, math.min(feedMax[k]!, count + 1)), 'weaning-$k-plus'),
            ])
          else
            _Toggle(key: ValueKey('weaning-$k-toggle'), pressed: on, label: label, onToggle: () => setFeed(k, !on)),
        ]),
      );
    }

    void make() {
      final plan = createPlan(feeds: feeds, pace: pace, nightMode: nightMode, start: start, childId: ctx.childId);
      ctx.setPlan(plan);
      ctx.toast(wt(ctx.isPremium ? 'weaning_plan_created_premium' : 'weaning_plan_created_free'), success: true);
      ctx.go('hub', reset: true);
    }

    return _Wean(children: [
      WCard(children: [
        _h3(context, wt('weaning_builder_q')),
        _p(context, wt('weaning_builder_help')),
        Column(children: [row('morning', 'morning'), row('day', 'day'), row('nap', 'nap'), row('bedtime', 'bedtime'), row('night', 'night')]),
      ]),
      WCard(children: [
        _lab(context, wt('weaning_pace')),
        WrapRow(gap: 8, children: [
          for (final p in paces)
            WChip(key: ValueKey('weaning-pace-$p'), label: wt('weaning_pace_$p'), sub: wt('weaning_pace_${p}_sub'), pressed: pace == p, onTap: () => ctx.update((s) => s.copyWith(pace: p))),
        ]),
        _small(context, wf('weaning_no_cold_turkey', {'n': minDays})),
      ]),
      if (feeds.night > 0)
        WCard(children: [
          _lab(context, wt('weaning_night_title')),
          WrapRow(gap: 8, children: [
            for (final m in const ['last', 'separate'])
              WChip(label: wt(m == 'last' ? 'weaning_night_last' : 'weaning_night_separate'), pressed: nightMode == m, onTap: () => ctx.update((s) => s.copyWith(nightMode: m))),
          ]),
          _small(context, wt('weaning_night_help')),
        ]),
      if (v.delay > 0)
        WCard(children: [
          _lab(context, wt('weaning_start')),
          WrapRow(gap: 8, children: [
            WChip(
              label: wf('weaning_start_recommended', {'date': ctx.fmt(addDaysToDay(ctx.today, v.delay))}),
              pressed: _startChoice == 'recommended',
              onTap: () => setState(() => _startChoice = 'recommended'),
            ),
            WChip(label: wt('weaning_start_today'), pressed: _startChoice == 'today', onTap: () => setState(() => _startChoice = 'today')),
          ]),
        ]),
      WCard(children: [
        _kv(context, [
          (wt('weaning_steps_count'), jsNumberToString(steps)),
          (wt('weaning_duration'), wf('weaning_weeks', {'n': planWeeks(feeds, nightMode, pace)})),
          (wt('weaning_start'), delay != 0 ? '${ctx.fmt(start)} ${wt('weaning_start_delay_note')}' : ctx.fmt(start)),
        ]),
      ]),
      WBtn(key: const ValueKey('weaning-make-plan'), label: wt('weaning_make_plan'), disabled: steps == 0, onTap: make),
    ]);
  }
}

// ── Plan hub ─────────────────────────────────────────────────────────────────────────────────
class _Ring extends StatelessWidget {
  const _Ring({required this.done, required this.total});
  final int done;
  final int total;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    // SVG viewBox 84, r = 34, stroke 10: the stroke centre circle is 78 wide.
    return Semantics(
      label: '$done/$total',
      child: SizedBox(
        width: 84,
        height: 84,
        child: Center(
          child: ARing(
            progress: total != 0 ? done / total : 0,
            size: 78,
            strokeWidth: 10,
            trackColor: a.surfaceSoft,
            fillColor: a.coral,
            drawIn: false,
            mirrorInRtl: false,
            child: Text('$done/$total', style: css(16, weight: FontWeight.w800, height: 1, color: a.ink)),
          ),
        ),
      ),
    );
  }
}

class Timeline extends StatelessWidget {
  const Timeline({super.key, required this.ctx, required this.plan});
  final WeaningCtx ctx;
  final WeaningPlan plan;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget st(String state, Widget dot, String title, String sub, VoidCallback onTap, bool last, {Key? key}) {
      final cur = state == 'cur';
      return Tap(
        key: key,
        onTap: onTap,
        child: Padding(
          padding: EdgeInsets.only(bottom: last ? 0 : 12),
          child: Stack(children: [
            if (!last)
              PositionedDirectional(start: 16, top: 30, bottom: -12, child: Container(width: 2, color: a.lineStrong)),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: state == 'done' ? a.green1 : cur ? a.coral : a.surface,
                  border: Border.all(color: state == 'done' ? a.greenInk : cur ? a.coral : a.lineStrong, width: 2),
                ),
                child: DefaultTextStyle.merge(
                  style: css(13, weight: FontWeight.w800, height: 1.2, color: state == 'done' ? a.greenInk : cur ? const Color(0xFFFFFFFF) : a.ink),
                  child: dot,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: a.surface,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: a.cardShadow,
                    border: cur ? Border.all(color: a.coral, width: 2) : null,
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(title, style: css(13.5, weight: FontWeight.w700, color: a.ink)),
                    Text(sub, style: css(11.5, color: a.inkSoft)),
                  ]),
                ),
              ),
            ]),
          ]),
        ),
      );
    }

    final rows = <Widget>[];
    for (var i = 0; i < plan.steps.length; i++) {
      final s = plan.steps[i];
      final state = stepState(s, ctx.today);
      final last = i == plan.steps.length - 1 && plan.nightMode != 'separate';
      rows.add(st(
        state,
        Text(state == 'done' ? '✓' : '${i + 1}'),
        _stepTitle(s),
        '${ctx.fmt(s.start)} – ${ctx.fmt(addDaysToDay(s.start, s.len - 1))} · ${wf('weaning_days', {'n': s.len})}'
            '${state == 'cur' && plan.status == 'active' ? ' · ${wt('weaning_now')}' : ''}',
        () => ctx.go('step', stepId: s.id),
        last,
        key: ValueKey('weaning-tl-${s.id}'),
      ));
    }
    if (plan.nightMode == 'separate') {
      rows.add(st('future', const Text('🌙'), wt('weaning_link_night'), wt('weaning_night_later_sub'), () => ctx.go('night'), true));
    }
    return Column(key: const ValueKey('weaning-timeline'), crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
  }
}

class HubScreen extends StatelessWidget {
  const HubScreen({super.key, required this.ctx});
  final WeaningCtx ctx;

  @override
  Widget build(BuildContext context) {
    final plan = ctx.plan;
    if (plan == null) return IntroScreen(ctx: ctx);
    final a = context.a;
    final today = ctx.today, isPremium = ctx.isPremium;
    final total = plan.steps.length;
    final dn = doneCount(plan);
    final s = currentStep(plan);
    void save(WeaningPlan next) => ctx.setPlan(next);

    void complete() {
      final next = completeCurrent(plan, today);
      save(next);
      final n = currentStep(next);
      ctx.toast(n != null ? wf('weaning_toast_next', {'label': stepLabel(n), 'date': ctx.fmt(n.start)}) : wt('weaning_toast_all_done'), success: true);
    }

    void begin() {
      save(startNow(plan, today));
      if (s != null) ctx.toast(wf('weaning_toast_started', {'label': stepLabel(s)}), success: true);
    }

    void resume() {
      final r = resumePlan(plan, today);
      save(r.plan);
      ctx.toast(wt(r.shifted ? 'weaning_toast_resumed_dates' : 'weaning_toast_resumed'), success: true);
    }

    void togglePause() {
      if (plan.status == 'paused') return resume();
      save(pausePlan(plan, 'manual'));
      ctx.toast(wt('weaning_toast_paused'));
    }

    void sharePartner() {
      final step = s ?? plan.steps.last;
      ctx.share(wt('weaning_partner_share_title'), '${stepLabel(step)}: ${wt(_ftKey(step.type, '_swap'))}\n${_partnerHint(step.type)}');
    }

    Future<void> cancel() async {
      if (!await ctx.confirm(wt('weaning_cancel_confirm'))) return;
      save(cancelPlan(plan));
      ctx.toast(wt('weaning_toast_cancelled'));
      ctx.go('intro', reset: true);
    }

    Widget todayCard;
    if (plan.status == 'paused') {
      final doctor = plan.pauseReason == 'doctor';
      todayCard = WAlert(tone: doctor ? 'red' : 'amber', title: wt(doctor ? 'weaning_paused_doctor_title' : 'weaning_paused_manual_title'), children: [
        Text(wt(doctor ? 'weaning_paused_doctor_text' : 'weaning_paused_manual_text')),
        WBtn(label: wt(doctor ? 'weaning_resume_doctor' : 'weaning_resume'), ghost: true, small: true, onTap: resume),
      ]);
    } else if (s == null) {
      todayCard = WAlert(tone: 'mint', title: wt('weaning_all_done'), children: [
        WBtn(label: wt('weaning_finish_card_btn'), small: true, onTap: () => ctx.go('finish')),
      ]);
    } else if (stepState(s, today) == 'future') {
      final idx = currentStepIndex(plan);
      final prev = idx > 0 ? plan.steps[idx - 1] : null;
      todayCard = prev != null
          ? WCard(children: [
              WPill('✓ ${stepLabel(prev)}', tone: 'mint'),
              _h3(context, wf('weaning_next', {'label': _stepTitle(s)})),
              _p(context, isPremium ? wf('weaning_next_text', {'date': ctx.fmt(s.start)}) : wt('weaning_next_text_free')),
              canStartNow(plan, today)
                  ? WBtn(label: wt('weaning_start_now'), ghost: true, small: true, onTap: begin)
                  : _small(context, wf('weaning_earliest', {'date': ctx.fmt(addDaysToDay(prev.start, minDays)), 'n': minDays})),
            ])
          : WCard(children: [
              if (isPremium) WPill(wf('weaning_starts_on', {'date': ctx.fmt(s.start)}), tone: 'sky'),
              _h3(context, wf('weaning_starts_in', {'n': daysBetween(today, s.start)})),
              _p(context, wt('weaning_prepare')),
            ]);
    } else {
      final day = stepDay(s, today);
      final ready = canComplete(s, today);
      todayCard = KeyedSubtree(
        key: const ValueKey('weaning-today'),
        child: WCard(children: [
          WPill(wf('weaning_step_day', {'day': day, 'len': s.len})),
          _h3(context, wf('weaning_replacing', {'label': _stepTitle(s)})),
          Text.rich(TextSpan(style: css(13, color: a.bodyText), children: [
            TextSpan(text: wt('weaning_swap_label'), style: const TextStyle(fontWeight: FontWeight.w700)),
            TextSpan(text: ' ${wt(_ftKey(s.type, '_swap'))}'),
          ])),
          WrapRow(gap: 8, children: [
            WBtn(key: const ValueKey('weaning-how'), label: wt('weaning_how'), small: true, onTap: () => ctx.go('step', stepId: s.id)),
            WBtn(key: const ValueKey('weaning-complete'), label: wt('weaning_complete'), ghost: true, small: true, disabled: !ready, onTap: complete),
          ]),
          if (!ready) _small(context, wf('weaning_complete_wait', {'date': ctx.fmt(nextUnlockDay(s))})),
        ]),
      );
    }

    Widget tile(String ic, String label, VoidCallback onTap, {Key? key}) => Tap(
          key: key,
          label: label,
          onTap: onTap,
          excludeSemantics: true,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
            decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
            child: Column(children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(13)),
                child: Text(ic, style: css(19, height: 1.2)),
              ),
              const SizedBox(height: 6),
              Text(label, textAlign: TextAlign.center, style: css(11.5, weight: FontWeight.w700, height: 1.25, color: a.ink)),
            ]),
          ),
        );

    return _Wean(children: [
      WCard(children: [
        Row(children: [
          _Ring(done: dn, total: total),
          const SizedBox(width: 14),
          Expanded(
            child: Gap(gap: 4, crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(wt(plan.pace == 'gentle' ? 'weaning_plan_gentle' : 'weaning_plan_medium'), style: css(15, weight: FontWeight.w700, color: a.ink)),
              if (isPremium) _p(context, '${ctx.fmt(plan.steps.first.start)} – ${ctx.fmt(planLastDay(plan))}'),
              isPremium ? WPill('🔔 ${wt('weaning_reminders_on')}', tone: 'sky') : WPill('🔔 ${wt('weaning_reminders_premium')}', tone: 'prem'),
            ]),
          ),
        ]),
      ]),
      todayCard,
      WBtn(key: const ValueKey('weaning-checkin'), label: '📝 ${wt('weaning_checkin_btn')}', ghost: true, onTap: () => ctx.go('checkin'), trailing: _freePill()),
      _sec(context, wt('weaning_plan_section'), isPremium ? null : _premiumPill(context)),
      isPremium
          ? Timeline(ctx: ctx, plan: plan)
          : PremiumBlurGate(
              feature: 'weaning_plan',
              title: wt('weaning_lock_title'),
              subtitle: wt('weaning_lock_text'),
              cta: wt('weaning_lock_cta'),
              forceLock: true,
              child: Timeline(ctx: ctx, plan: plan),
            ),
      _sec(context, wt('weaning_guide_section'), _freePill()),
      Grid(columns: 3, gap: 8, children: [
        tile('🥛', wt('weaning_tile_nutrition'), () => ctx.go('nutrition')),
        tile('💗', wt('weaning_tile_mother'), () => ctx.go('mother')),
        tile('🚫', wt('weaning_tile_myths'), () => ctx.go('myths')),
        tile('🌙', wt('weaning_tile_night'), () => ctx.go('night')),
        tile('👨', wt('weaning_tile_partner'), sharePartner),
        if (plan.status != 'finished')
          tile(plan.status == 'paused' ? '▶️' : '⏸️', wt(plan.status == 'paused' ? 'weaning_resume' : 'weaning_tile_pause'), togglePause, key: const ValueKey('weaning-pause')),
      ]),
      if (plan.status != 'finished') WBtn(key: const ValueKey('weaning-cancel'), label: wt('weaning_cancel_plan'), ghost: true, small: true, onTap: () => unawaited(cancel())),
      _small(context, wt('weaning_disclaimer')),
    ]);
  }
}

// ── Step detail ──────────────────────────────────────────────────────────────────────────────
class StepScreen extends StatelessWidget {
  const StepScreen({super.key, required this.ctx});
  final WeaningCtx ctx;
  @override
  Widget build(BuildContext context) {
    final plan = ctx.plan;
    WeaningStep? s;
    if (plan != null) {
      for (final x in plan.steps) {
        if (x.id == ctx.stepId) s = x;
      }
      s ??= currentStep(plan);
    }
    if (plan == null || s == null) return HubScreen(ctx: ctx);
    final step = s;
    void extend() {
      ctx.setPlan(extendStep(plan, step.id, extendStepDays));
      ctx.toast(wt('weaning_toast_extended'), success: true);
    }

    return _Wean(children: [
      WCard(children: [_h3(context, '${feedIcons[step.type]} ${wt('weaning_swap_title')}'), _p(context, wt(_ftKey(step.type, '_swap')))]),
      WCard(children: [
        _h3(context, wt('weaning_how_title')),
        _list([
          for (final i in const [1, 2, 3]) _li(context, '•', Text(wt(_ftKey(step.type, '_tip$i')))),
          _li(context, '🤲', Text(wt('weaning_first_days'))),
        ]),
      ]),
      WCard(children: [
        _h3(context, wt('weaning_cries_title')),
        _list([for (final i in const [1, 2, 3]) _li(context, '$i', Text(wt('weaning_cries_$i')))]),
      ]),
      WCard(children: [
        _h3(context, '👨 ${wt('weaning_partner_title')}'),
        _p(context, _partnerHint(step.type)),
        WBtn(
          key: const ValueKey('weaning-partner-send'),
          label: wt('weaning_partner_send'),
          ghost: true,
          small: true,
          onTap: () => ctx.share(wt('weaning_partner_share_title'), '${stepLabel(step)}: ${wt(_ftKey(step.type, '_swap'))}\n${_partnerHint(step.type)}'),
        ),
      ]),
      if (step.status != 'done' && plan.status != 'finished') WBtn(key: const ValueKey('weaning-extend'), label: wt('weaning_extend'), ghost: true, small: true, onTap: extend),
    ]);
  }
}

// ── Daily check-in ───────────────────────────────────────────────────────────────────────────
class CheckinScreen extends StatefulWidget {
  const CheckinScreen({super.key, required this.ctx});
  final WeaningCtx ctx;
  @override
  State<CheckinScreen> createState() => _CheckinScreenState();
}

class _CheckinScreenState extends State<CheckinScreen> {
  CheckinAnswers _c = emptyCheckin;

  void _set(CheckinAnswers next) => setState(() => _c = next);

  void _submit() {
    final ctx = widget.ctx;
    final res = evaluateCheckin(_c);
    final p = ctx.plan;
    final plan = p != null && (p.status == 'active' || p.status == 'paused') ? p : null;
    final stored = makeCheckin(_c, res, p?.id);
    final nextPlan = plan != null ? applyCheckin(plan, res) : null;
    ctx.update((s) {
      final base = s.copyWith(checkins: [stored, ...s.checkins], lastResult: res);
      return nextPlan != null && !identical(nextPlan, plan) ? base.copyWith(plan: nextPlan, planDirty: true) : base;
    });
    ctx.go('result');
  }

  @override
  Widget build(BuildContext context) {
    final ctx = widget.ctx;
    final a = context.a;
    Widget opt(List<(String, String)> items, String? value, void Function(String v) set) => WrapRow(gap: 8, children: [
          for (final it in items) WChip(label: wt(it.$2), pressed: value == it.$1, onTap: () => set(it.$1)),
        ]);
    Widget tg(bool value, String l, void Function(bool v) set) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(children: [
            Expanded(child: Text(wt(l), style: css(13, color: a.ink))),
            const SizedBox(width: 10),
            _Toggle(key: ValueKey('weaning-ci-$l'), pressed: value, label: wt(l), onToggle: () => set(!value)),
          ]),
        );
    return _Wean(children: [
      WCard(children: [
        _lab(context, '👧 ${wf('weaning_ci_child', {'name': ctx.childName})}'),
        Row(children: [
          for (final m in const [('happy', '😊', 'weaning_ci_mood_happy'), ('ok', '🙂', 'weaning_ci_mood_ok'), ('sad', '😢', 'weaning_ci_mood_sad')]) ...[
            if (m.$1 != 'happy') const SizedBox(width: 6),
            Expanded(
              child: Tap(
                label: wt(m.$3),
                pressed: _c.childMood == m.$1,
                excludeSemantics: true,
                onTap: () => _set(_c.copyWith(childMood: m.$1)),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: _c.childMood == m.$1 ? a.peach1 : a.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: _c.childMood == m.$1 ? a.coral : a.line, width: 1.5),
                  ),
                  child: Text(m.$2, style: css(22, height: 1.2)),
                ),
              ),
            ),
          ],
        ]),
        _lab(context, wt('weaning_ci_diapers')),
        opt(const [('ok', 'weaning_ci_diapers_ok'), ('few', 'weaning_ci_diapers_few')], _c.diapers, (v) => _set(_c.copyWith(diapers: v))),
        tg(_c.childSick, 'weaning_ci_sick', (v) => _set(_c.copyWith(childSick: v))),
      ]),
      WCard(children: [
        _lab(context, '🤱 ${wt('weaning_ci_breasts')}'),
        opt(const [('none', 'weaning_ci_full_none'), ('some', 'weaning_ci_full_some'), ('much', 'weaning_ci_full_much')], _c.fullness,
            (v) => _set(_c.copyWith(fullness: v))),
        tg(_c.lump, 'weaning_ci_lump', (v) => _set(_c.copyWith(lump: v))),
        tg(_c.red, 'weaning_ci_red', (v) => _set(_c.copyWith(red: v))),
        tg(_c.fever, 'weaning_ci_fever', (v) => _set(_c.copyWith(fever: v))),
      ]),
      WCard(children: [
        _lab(context, '💗 ${wt('weaning_ci_mother')}'),
        opt(const [('good', 'weaning_ci_mother_good'), ('mixed', 'weaning_ci_mother_mixed'), ('low', 'weaning_ci_mother_low')], _c.motherMood,
            (v) => _set(_c.copyWith(motherMood: v))),
      ]),
      WBtn(key: const ValueKey('weaning-ci-save'), label: wt('weaning_ci_save'), disabled: !checkinComplete(_c), onTap: _submit),
      _small(context, wt('weaning_ci_note')),
    ]);
  }
}

class ResultScreen extends StatelessWidget {
  const ResultScreen({super.key, required this.ctx});
  final WeaningCtx ctx;
  @override
  Widget build(BuildContext context) {
    final r = ctx.local.lastResult;
    if (r == null) return CheckinScreen(ctx: ctx);
    final plan = ctx.plan;
    return _Wean(children: [
      WAlert(tone: r.tone, title: wt(r.title), children: [
        _list([for (final k in r.items) _li(context, '•', Text(fillEmergencyNumber(wt(k), ctx.emergency)), square: false)]),
      ]),
      if (r.emergency) _Call(ctx: ctx),
      if (plan != null && (r.action == 'extend' || r.action == 'slow'))
        WCard(children: [_h3(context, wt('weaning_res_updated_title')), _p(context, wt('weaning_res_updated_text'))]),
      if (plan != null && r.action == 'offerPause' && plan.status == 'active')
        WBtn(
          label: wt('weaning_res_pause_btn'),
          ghost: true,
          onTap: () {
            ctx.setPlan(pausePlan(plan, 'manual'));
            ctx.toast(wt('weaning_toast_paused'));
            ctx.go('hub', reset: true);
          },
        ),
      if (r.moodLink) WBtn(label: wt('weaning_res_mood_btn'), ghost: true, onTap: () => ctx.openTool('mood-diary')),
      WBtn(label: wt(plan != null ? 'weaning_back_to_plan' : 'weaning_back_to_guide'), onTap: () => ctx.go(plan != null ? 'hub' : 'intro', reset: true)),
    ]);
  }
}

// ── Guides ───────────────────────────────────────────────────────────────────────────────────
class NutritionScreen extends StatelessWidget {
  const NutritionScreen({super.key, required this.ctx});
  final WeaningCtx ctx;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final allergy = ctx.local.readiness.allergy == true;
    final cups = ctx.local.cups.date == ctx.today ? ctx.local.cups.n : 0;
    final ml = cups * cupMl;
    final status = milkStatus(cups);
    void setCups(int n) => ctx.update((s) => s.copyWith(cups: (date: ctx.today, n: math.max(0, math.min(maxCups, n)))));
    final tone = status == 'over' ? 'red' : status == 'good' ? 'mint' : 'sky';
    return _Wean(children: [
      if (allergy)
        WAlert(tone: 'amber', title: wt('weaning_nut_allergy_title'), children: [Text(wt('weaning_nut_allergy_text'))])
      else ...[
        KeyedSubtree(
          key: const ValueKey('weaning-cow-milk'),
          child: WCard(children: [_h3(context, wt('weaning_nut_milk_title')), _p(context, wt('weaning_nut_milk_text'))]),
        ),
        WCard(children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Flexible(child: _h3(context, wf('weaning_nut_today', {'ml': ml}))),
            WPill(wt('weaning_nut_status_$status'), tone: tone),
          ]),
          ExcludeSemantics(
            child: WrapRow(gap: 6, children: [
              for (var i = 0; i < maxCups; i++)
                Container(
                  width: 34,
                  height: 42,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    color: a.surface,
                    border: Border.all(color: i < cups && (i + 1) * cupMl > milkMaxMl ? a.alertInk : a.lineStrong, width: 2),
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(6), bottom: Radius.circular(10)),
                  ),
                  alignment: Alignment.bottomCenter,
                  // `.a-wean-cup.full::after { height: 75%; background: #f4f1ea }` (literal)
                  child: i < cups ? const FractionallySizedBox(heightFactor: 0.75, widthFactor: 1, child: ColoredBox(color: Color(0xFFF4F1EA))) : null,
                ),
            ]),
          ),
          WrapRow(gap: 8, children: [
            WBtn(label: wt('weaning_nut_cup_minus'), ghost: true, small: true, disabled: cups <= 0, onTap: () => setCups(cups - 1)),
            WBtn(key: const ValueKey('weaning-cup-plus'), label: wt('weaning_nut_cup_plus'), small: true, disabled: cups >= maxCups, onTap: () => setCups(cups + 1)),
          ]),
          if (status == 'over') WAlert(key: const ValueKey('weaning-milk-over'), tone: 'red', title: wt('weaning_nut_status_over'), children: [Text(wt('weaning_nut_over_warn'))]),
          _small(context, wt('weaning_nut_target')),
        ]),
      ],
      WCard(children: [
        _h3(context, wt('weaning_nut_iron_title')),
        _list([
          for (final (i, ic) in const ['🥩', '🫘', '🥣', '💧'].indexed) _li(context, ic, Text(wt('weaning_nut_iron_${i + 1}'))),
        ]),
        WBtn(
          label: wt('weaning_nut_solid_btn'),
          ghost: true,
          small: true,
          onTap: () => ctx.openTool('solid-food-guide'),
          trailing: ctx.isPremium ? null : _premiumPill(context),
        ),
      ]),
      _small(context, wt('weaning_disclaimer')),
    ]);
  }
}

class MotherScreen extends StatelessWidget {
  const MotherScreen({super.key, required this.ctx});
  final WeaningCtx ctx;
  @override
  Widget build(BuildContext context) => _Wean(children: [
        WCard(children: [
          _h3(context, wt('weaning_mother_body_title')),
          _list([for (final i in const [1, 2, 3]) _li(context, '$i', Text(wt('weaning_mother_body_$i')))]),
        ]),
        WCard(children: [
          _h3(context, wt('weaning_mother_feel_title')),
          _p(context, wt('weaning_mother_feel_text')),
          WBtn(label: wt('weaning_mother_mood_btn'), ghost: true, small: true, onTap: () => ctx.openTool('mood-diary'), trailing: _freePill()),
        ]),
        WAlert(tone: 'red', title: wt('weaning_mother_doctor_title'), children: [
          Text(fillEmergencyNumber(wt('weaning_mother_doctor_text'), ctx.emergency)),
          _Call(ctx: ctx),
        ]),
        WCard(children: [_h3(context, wt('weaning_mother_bind_title')), _p(context, wt('weaning_mother_bind_text'))]),
        _small(context, wt('weaning_disclaimer')),
      ]);
}

const int _mythCount = 7;

class MythsScreen extends StatelessWidget {
  const MythsScreen({super.key, required this.ctx});
  final WeaningCtx ctx;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final myths = [for (var i = 1; i <= _mythCount; i++) (wt('weaning_myth_$i'), wt('weaning_myth_${i}_fact'))];
    return _Wean(children: [
      _small(context, wt('weaning_myths_intro')),
      for (final (i, m) in myths.indexed)
        Container(
          key: ValueKey('weaning-myth-$i'),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
          child: Gap(gap: 6, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('🚫', style: css(13)),
              const SizedBox(width: 8),
              Expanded(child: Text(m.$1, style: css(13, weight: FontWeight.w700, color: a.ink))),
            ]),
            Padding(padding: const EdgeInsetsDirectional.only(start: 26), child: Text(m.$2, style: css(12.5, color: a.bodyText))),
          ]),
        ),
      WBtn(
        label: wt('weaning_myths_share'),
        ghost: true,
        onTap: () => ctx.share(wt('weaning_myths_title'), myths.map((m) => '🚫 ${m.$1}\n${m.$2}').join('\n\n')),
      ),
    ]);
  }
}

class NightScreen extends StatelessWidget {
  const NightScreen({super.key, required this.ctx});
  final WeaningCtx ctx;
  @override
  Widget build(BuildContext context) => _Wean(children: [
        WCard(children: [_h3(context, wt('weaning_night_sep_title')), _p(context, wt('weaning_night_sep_text'))]),
        WCard(children: [
          _h3(context, wt('weaning_night_stages_title')),
          _list([
            for (final i in const [1, 2, 3])
              _li(
                context,
                '$i',
                Text.rich(TextSpan(children: [
                  TextSpan(text: wt('weaning_night_stage${i}_title'), style: const TextStyle(fontWeight: FontWeight.w700)),
                  TextSpan(text: ' ${wt('weaning_night_stage${i}_text')}'),
                ])),
              ),
          ]),
        ]),
        WAlert(tone: 'amber', title: wt('weaning_night_nocry_title'), children: [Text(wt('weaning_night_nocry_text'))]),
        WBtn(label: wt('weaning_night_sleep_btn'), ghost: true, small: true, onTap: () => ctx.openTool('sleep-training')),
      ]);
}

class FinishScreen extends StatelessWidget {
  const FinishScreen({super.key, required this.ctx});
  final WeaningCtx ctx;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final plan = ctx.plan;
    final from = plan != null ? plan.steps.first.start : ctx.today;
    final to = plan != null && plan.status == 'finished' ? isoDay(jsParseDate(plan.updatedAt) ?? DomainClock.now()) : ctx.today;
    final heroKey = ctx.childGender == 'girl'
        ? 'weaning_finish_hero_girl'
        : ctx.childGender == 'boy'
            ? 'weaning_finish_hero_boy'
            : 'weaning_finish_hero_other';
    return _Wean(children: [
      Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(24)),
        child: Gap(gap: 8, children: [
          Text(wf(heroKey, {'name': ctx.childName}), style: css(22, weight: FontWeight.w800, height: 1.15, em: -0.02, color: a.ink)),
          Text(wf('weaning_finish_range', {'from': ctx.fmt(from), 'to': ctx.fmt(to)}), style: css(13, color: a.bodyText)),
        ]),
      ),
      WCard(children: [
        _h3(context, wt('weaning_finish_memory_title')),
        _p(context, wt('weaning_finish_memory_text')),
        WBtn(label: wt('weaning_finish_album_btn'), small: true, onTap: () => ctx.openTool('baby-album')),
      ]),
      WCard(children: [_h3(context, wt('weaning_finish_next_title')), _p(context, wt('weaning_finish_next_text'))]),
      WCard(children: [_h3(context, wt('weaning_finish_relact_title')), _p(context, wt('weaning_finish_relact_text'))]),
    ]);
  }
}

/// `<a href="tel:…">` through the safety strip's launcher.
void Function(String number) weaningCall(WidgetRef ref) => (number) => unawaited(ref.read(safetyCallLauncherProvider)(Uri(scheme: 'tel', path: number)));

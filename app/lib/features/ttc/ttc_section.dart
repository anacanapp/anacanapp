// Ported from: src/components/ttc/TtcSection.tsx, src/styles/care.css (.cx-* TTC rules)
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/physics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' show DateFormat;
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../state/calendar_utils.dart' show calculateDueDate;
import '../../state/user_store.dart';
import '../home_flow/data/flow_hooks.dart';
import '../home_flow/data/flow_repository.dart';
import '../home_flow/flow_platform.dart';
import '../home_flow/widgets/flow_common.dart';
import '../home_flow/widgets/flow_ui.dart';
import 'ttc.dart';

// TtcSection.tsx literals.
const Color _period = Color(0xFFFF8AA4);
const Color _fertile = Color(0xFFC7AEF5);
const Color _ovulation = Color(0xFF5B3AA5);
const Color _bbt = Color(0xFF63ACDF);

Color _chanceColor(BuildContext c, Chance chance) => switch (chance) {
      'medium' => const Color(0xFFB07AD8),
      'high' => const Color(0xFF8B5CF6),
      'peak' => _ovulation,
      _ => c.a.inkSoft,
    };

String _short(DateTime d) => DateFormat.MMMd(appLanguage(currentLanguage()).intlLocale).format(d);
String _long(DateTime d) => DateFormat.yMMMMd(appLanguage(currentLanguage()).intlLocale).format(d);

// ── cx-* primitives ──

TextStyle _sub(BuildContext c, {double size = 13, Color? color, FontWeight? weight}) =>
    TextStyle(fontSize: size, height: 1.45, color: color ?? c.a.inkSoft, fontWeight: weight);

class _CxCard extends StatelessWidget {
  const _CxCard({required this.child, this.color, this.gradient, this.border = true, this.padding = const EdgeInsets.all(16), this.top = 0});
  final Widget child;
  final Color? color;
  final Gradient? gradient;
  final bool border;
  final EdgeInsets padding;
  final double top;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      margin: EdgeInsets.only(top: top),
      padding: padding,
      decoration: BoxDecoration(
        color: gradient == null ? (color ?? a.surface) : null,
        gradient: gradient,
        border: border ? Border.all(color: a.line) : null,
        borderRadius: BorderRadius.circular(a.radiusLg),
        boxShadow: a.cardShadow,
      ),
      child: child,
    );
  }
}

/// `.cx-seg` with `aria-pressed` buttons.
class _CxSeg<T> extends StatelessWidget {
  const _CxSeg({required this.items, required this.selected, required this.onTap, this.background, this.shadow, this.selectedColor});
  final List<(T, String)> items;
  final T? selected;
  final ValueChanged<T> onTap;
  final Color? background;
  final List<BoxShadow>? shadow;
  final Color? Function(T value)? selectedColor;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: background ?? a.surfaceSoft, borderRadius: BorderRadius.circular(16), boxShadow: shadow),
      child: Row(children: [
        for (final (i, it) in items.indexed) ...[
          if (i > 0) const SizedBox(width: 4),
          Expanded(
            child: Semantics(
              button: true,
              toggled: selected == it.$1,
              label: it.$2,
              excludeSemantics: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onTap(it.$1),
                child: Container(
                  constraints: const BoxConstraints(minHeight: 38),
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(
                    color: selected == it.$1 ? a.surface : null,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: selected == it.$1 ? const [BoxShadow(color: Color(0x14000000), offset: Offset(0, 2), blurRadius: 8)] : null,
                  ),
                  child: Text(it.$2,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: selected == it.$1 ? (selectedColor?.call(it.$1) ?? a.ink) : a.inkSoft)),
                ),
              ),
            ),
          ),
        ],
      ]),
    );
  }
}

class _CxIcon extends StatelessWidget {
  const _CxIcon(this.emoji, this.bg);
  final String emoji;
  final Color bg;
  @override
  Widget build(BuildContext context) => Container(
        width: 42,
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
        child: Text(emoji, style: const TextStyle(fontSize: 20)),
      );
}

/// `.cx-input` with the inline overrides (min-height 36, 13px, padding 0 8).
class _CxInputBox extends StatelessWidget {
  const _CxInputBox({required this.child, this.width});
  final Widget child;
  final double? width;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      width: width,
      constraints: const BoxConstraints(minHeight: 36),
      alignment: AlignmentDirectional.centerStart,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: a.lineStrong, width: 2)),
      child: DefaultTextStyle.merge(style: TextStyle(fontSize: 13, color: a.ink), child: child),
    );
  }
}

// ── FlowGoalSection ──

class FlowGoalSection extends ConsumerStatefulWidget {
  const FlowGoalSection({
    super.key,
    required this.lastPeriodDate,
    required this.cycleLength,
    required this.periodLength,
    required this.ovulation,
    required this.ovulationConfirmed,
  });
  final DateTime lastPeriodDate;
  final int cycleLength;
  final int periodLength;
  final DateTime ovulation;
  final bool ovulationConfirmed;

  @override
  ConsumerState<FlowGoalSection> createState() => _FlowGoalSectionState();
}

class _FlowGoalSectionState extends ConsumerState<FlowGoalSection> {
  FlowGoal _goal = 'track';
  TtcState _state = {};
  Object? _seenGoal;
  Object? _seenState;

  Future<void> _changeGoal(String uid, TtcText t, FlowGoal next) async {
    if (next == _goal) return;
    final prev = _goal;
    setState(() => _goal = next);
    unawaited(ref.read(flowHapticsProvider).medium());
    TtcState? nextState;
    if (next == 'conceive' && _state['started_on'] == null) {
      nextState = {..._state, 'started_on': ymd(flowNow())};
      setState(() => _state = nextState!);
    }
    final toast = flowToast(context);
    try {
      await saveFlowGoal(ref.read(flowRepositoryProvider), uid, next, nextState);
      unawaited(ref.read(flowRefreshProfileProvider)());
    } catch (_) {
      if (mounted) setState(() => _goal = prev);
      toast?.error(t('error'));
    }
  }

  Future<void> _updateState(String uid, TtcText t, TtcState next) async {
    setState(() => _state = next);
    final toast = flowToast(context);
    try {
      await saveTtcState(ref.read(flowRepositoryProvider), uid, next);
    } catch (_) {
      toast?.error(t('error'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final t = TtcText.of(language);
    final uid = ref.watch(flowUserIdProvider);
    final profile = ref.watch(flowProfileRowProvider);
    final pGoal = profile?['flow_goal'];
    final pState = profile?['ttc_state'];
    if (pGoal != null && pGoal != _seenGoal) {
      _seenGoal = pGoal;
      _goal = pGoal as String;
    }
    if (pState is Map && !identical(pState, _seenState)) {
      _seenState = pState;
      _state = Map<String, Object?>.from(pState);
    }
    if (uid == null) return const SizedBox.shrink();
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: EdgeInsets.only(bottom: _goal == 'conceive' ? 12 : 0),
          child: Semantics(
            label: t('goal_title'),
            child: _CxSeg<String>(
              background: a.surface,
              shadow: a.cardShadow,
              items: [('track', '🌙 ${t('goal_track')}'), ('conceive', '🌱 ${t('goal_conceive')}')],
              selected: _goal,
              onTap: (g) => unawaited(_changeGoal(uid, t, g)),
            ),
          ),
        ),
        if (_goal == 'conceive')
          _TtcHome(
            t: t,
            lastPeriodDate: widget.lastPeriodDate,
            cycleLength: widget.cycleLength,
            periodLength: widget.periodLength,
            ovulation: widget.ovulation,
            ovulationConfirmed: widget.ovulationConfirmed,
            state: _state,
            onState: (s) => _updateState(uid, t, s),
          ),
      ]),
    );
  }
}

class _TtcHome extends ConsumerStatefulWidget {
  const _TtcHome({
    required this.t,
    required this.lastPeriodDate,
    required this.cycleLength,
    required this.periodLength,
    required this.ovulation,
    required this.ovulationConfirmed,
    required this.state,
    required this.onState,
  });
  final TtcText t;
  final DateTime lastPeriodDate;
  final int cycleLength;
  final int periodLength;
  final DateTime ovulation;
  final bool ovulationConfirmed;
  final TtcState state;
  final Future<void> Function(TtcState) onState;

  @override
  ConsumerState<_TtcHome> createState() => _TtcHomeState();
}

class _TtcHomeState extends ConsumerState<_TtcHome> {
  int? _picked;

  void _openLog(String? lastTest) {
    Navigator.of(context, rootNavigator: true).push(ASheetRoute<void>(
      builder: (ctx) => _TtcLogSheet(
        t: widget.t,
        lastTest: lastTest,
        onTest: (result) async {
          final today = ymd(flowNow());
          final tests = [
            ...((widget.state['tests'] as List?) ?? const []).where((x) => (x as Map)['date'] != today),
            {'date': today, 'result': result},
          ];
          await widget.onState({...widget.state, 'tests': tests});
          if (result == 'positive') {
            if (ctx.mounted) Navigator.of(ctx).pop();
            _openPositive();
          }
          if (result == 'faint' && mounted) flowToast(context)?.message(widget.t('faint_hint'));
        },
      ),
    ));
  }

  void _openPositive() {
    if (!mounted) return;
    Navigator.of(context, rootNavigator: true).push(ASheetRoute<void>(
      builder: (ctx) => _PositiveSheet(
        t: widget.t,
        lastPeriodDate: widget.lastPeriodDate,
        onLater: () {
          final d = flowNow();
          unawaited(widget.onState({...widget.state, 'snooze_until': ymd(DateTime(d.year, d.month, d.day + 2))}));
          Navigator.of(ctx).pop();
        },
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final t = widget.t;
    final state = widget.state;
    final today = flowNow();
    final cycleDay = dayDiff(today, widget.lastPeriodDate) + 1;
    final months = monthsTrying(state['started_on'] as String?, today);
    final ov = widget.ovulation;
    final fertileStart = DateTime(ov.year, ov.month, ov.day - 5);
    final fertileEnd = DateTime(ov.year, ov.month, ov.day + 1);
    final inWindow = !today.isBefore(fertileStart) && dayDiff(today, fertileEnd) <= 0;
    final lpd = widget.lastPeriodDate;
    final shown = _picked != null ? DateTime(lpd.year, lpd.month, lpd.day + _picked! - 1) : today;
    final chance = chanceFor(shown, ov);
    final checklist = (state['checklist'] as Map?)?.cast<String, Object?>() ?? const {};
    final done = kChecklistKeys.where((k) => checklist[k] == true).length;
    final tests = (state['tests'] as List?) ?? const [];
    final lastTest = tests.isEmpty ? null : (tests.last as Map)['result'] as String?;
    final threshold = doctorThresholdFor(state, today);
    final monthsText = months == null || months < 1
        ? t('months_first')
        : months >= threshold
            ? fill(t('months_doctor'), {'n': months})
            : fill(t('months_normal'), {'n': months});
    final snooze = state['snooze_until'] as String?;
    final haptics = ref.read(flowHapticsProvider);
    final gate = ref.watch(flowPremiumGateProvider);

    return FramerEnter(
      dy: 12,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _CxCard(
          child: Column(children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Flexible(
                child: Text(cssUpper(months != null && months > 0 ? fill(t('eyebrow'), {'n': months + 1}) : t('eyebrow_start')),
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: em(0.07, 11), color: a.inkSoft)),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(999)),
                child: Text(t('goal_pill'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: a.lavInk)),
              ),
            ]),
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: FertilityRing(
                cycleLength: widget.cycleLength,
                periodLength: widget.periodLength,
                cycleDay: cycleDay,
                ovulationDay: dayDiff(ov, lpd) + 1,
                picked: _picked,
                onPick: (d) {
                  setState(() => _picked = d == _picked ? null : d);
                  unawaited(haptics.light());
                },
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Text('${fill(t('cycle_day'), {'n': _picked ?? cycleDay})}${_picked != null ? ' · ${_short(shown)}' : ''}',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: a.inkSoft)),
                  Text(t('chances.$chance'),
                      style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, letterSpacing: -0.56, height: 1.15, color: _chanceColor(context, chance))),
                  Text(t('chance'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: a.inkSoft)),
                ]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Wrap(alignment: WrapAlignment.center, spacing: 14, runSpacing: 10, children: [
                for (final (c, l) in [(_period, t('legend.period')), (_fertile, t('legend.fertile')), (_ovulation, t('legend.ovulation')), (a.ink, t('legend.today'))])
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Container(width: 10, height: 10, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
                    const SizedBox(width: 5),
                    Text(l, style: TextStyle(fontSize: 11.5, color: a.inkSoft)),
                  ]),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text.rich(
                TextSpan(children: [
                  inWindow
                      ? TextSpan(text: t('window_today'), style: TextStyle(fontWeight: FontWeight.w700, color: a.lavInk))
                      : TextSpan(text: fill(t('window'), {'range': '${_short(fertileStart)} – ${_short(fertileEnd)}'})),
                  TextSpan(text: ' · ${fill(t('ovulation'), {'date': _short(ov)})}'),
                ]),
                textAlign: TextAlign.center,
                style: _sub(context),
              ),
            ),
            if (widget.ovulationConfirmed)
              Text('✓ ${t('ovulation_confirmed')}', textAlign: TextAlign.center, style: _sub(context, color: a.greenInk, weight: FontWeight.w700)),
            Text(t('tap_day'), textAlign: TextAlign.center, style: _sub(context, size: 11.5, color: a.inkFaint)),
          ]),
        ),
        if (lastTest == 'positive' && (snooze == null || snooze.compareTo(ymd(today)) <= 0))
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: GestureDetector(
              onTap: _openPositive,
              child: _CxCard(
                border: false,
                gradient: CssLinearGradient(angle: 135, colors: [a.green1, a.surface]),
                child: Row(children: [
                  _CxIcon('🎉', a.surface),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text('${t('positive_title')} · ${t('positive_switch')}',
                        style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: a.greenInk)),
                  ),
                ]),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Row(children: [
            for (final (i, q) in [
              ('🧪', t('quick_lh'), a.lav1),
              ('🌡️', t('quick_bbt'), a.blue1),
              ('💞', t('quick_intimacy'), a.pink1),
              ('🤰', t('quick_test'), a.green1),
            ].indexed) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(
                child: PressScale.css(
                  scale: 0.96,
                  duration: const Duration(milliseconds: 120),
                  onTap: () => _openLog(lastTest),
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 80),
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
                    decoration: BoxDecoration(color: q.$3, borderRadius: BorderRadius.circular(20)),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(q.$1, style: const TextStyle(fontSize: 24, height: 1)),
                      const SizedBox(height: 6),
                      Text(q.$2, textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: a.ink)),
                    ]),
                  ),
                ),
              ),
            ],
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: gate(context, title: t('bbt_chart'), description: t('bbt_premium'), emoji: '🌡️', feature: 'ttc_bbt_chart', child: _BbtCard(t: t)),
        ),
        _CxCard(
          top: 12,
          color: months != null && months >= threshold ? a.yellow1 : a.surface,
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _CxIcon('🤍', a.lav1),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(monthsText, style: _sub(context, size: 13.5, color: a.ink)),
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(children: [
                    Flexible(child: Text(t('started_on'), style: _sub(context))),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () async {
                        final started = state['started_on'] as String?;
                        final init = started != null ? DateTime.tryParse(started) ?? today : today;
                        final picked = await showDatePicker(
                            context: context, initialDate: init.isAfter(today) ? today : init, firstDate: DateTime(2000), lastDate: today, initialDatePickerMode: DatePickerMode.year);
                        if (picked != null) {
                          unawaited(widget.onState({...state, 'started_on': '${picked.year}-${picked.month.toString().padLeft(2, '0')}-01'}));
                        }
                      },
                      child: _CxInputBox(child: Text(((state['started_on'] as String?) ?? '').isEmpty ? '' : (state['started_on'] as String).substring(0, 7))),
                    ),
                  ]),
                ),
                _BirthYearField(
                  year: validBirthYear(state['birth_year'], today),
                  max: maxBirthYear(today),
                  onSave: (y) {
                    final next = {...state};
                    if (y == null) {
                      next.remove('birth_year');
                    } else {
                      next['birth_year'] = y;
                    }
                    unawaited(widget.onState(next));
                  },
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    formatTr('clinical_ttc_doctor_rule', '35 yaşdan kiçik: 12 ay, 35 və yuxarı: 6 ay cəhddən sonra həkimə müraciət edin. Sizin üçün: {n} ay.', {'n': threshold}),
                    style: _sub(context, size: 11.5, color: a.inkFaint),
                  ),
                ),
              ]),
            ),
          ]),
        ),
        _CxCard(
          top: 12,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Flexible(child: Text(t('checklist_title'), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: a.ink))),
              Text('$done / ${kChecklistKeys.length}', style: _sub(context)),
            ]),
            Container(
              margin: const EdgeInsets.fromLTRB(0, 10, 0, 4),
              height: 8,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(99)),
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: AnimatedFractionallySizedBox(
                  duration: const Duration(milliseconds: 300),
                  widthFactor: done / kChecklistKeys.length,
                  child: Container(decoration: BoxDecoration(color: a.green2, borderRadius: BorderRadius.circular(99))),
                ),
              ),
            ),
            for (final (i, k) in kChecklistKeys.indexed)
              Container(
                decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: a.line))),
                child: _ChecklistRow(
                  title: t('checklist.$k.title'),
                  desc: t('checklist.$k.desc'),
                  done: checklist[k] == true,
                  onToggle: () {
                    unawaited(haptics.light());
                    unawaited(widget.onState({...state, 'checklist': {...checklist, k: checklist[k] != true}}));
                  },
                ),
              ),
          ]),
        ),
        _CxCard(
          top: 12,
          border: false,
          color: a.lav1,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('✨ ${t('tips_title')}', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: a.lavInk)),
            Padding(
              padding: const EdgeInsetsDirectional.only(top: 4, start: 18),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                for (final tip in t.list('tips'))
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('• ', style: _sub(context, color: a.ink)),
                      Expanded(child: Text(tip, style: _sub(context, color: a.ink))),
                    ]),
                  ),
              ]),
            ),
          ]),
        ),
      ]),
    );
  }
}

/// Optional birth year; saved on blur / Enter so typing does not write partial years.
class _BirthYearField extends StatefulWidget {
  const _BirthYearField({required this.year, required this.max, required this.onSave});
  final int? year;
  final int max;
  final ValueChanged<int?> onSave;
  @override
  State<_BirthYearField> createState() => _BirthYearFieldState();
}

class _BirthYearFieldState extends State<_BirthYearField> {
  late final TextEditingController _c = TextEditingController(text: widget.year?.toString() ?? '');
  final FocusNode _f = FocusNode();

  @override
  void initState() {
    super.initState();
    _f.addListener(() {
      if (!_f.hasFocus) _commit();
    });
  }

  @override
  void didUpdateWidget(_BirthYearField old) {
    super.didUpdateWidget(old);
    if (old.year != widget.year) _c.text = widget.year?.toString() ?? '';
  }

  void _commit() {
    final trimmed = _c.text.trim();
    if (trimmed.isEmpty) {
      if (widget.year != null) widget.onSave(null);
      return;
    }
    final next = validBirthYear(trimmed);
    if (next == null) {
      _c.text = widget.year?.toString() ?? '';
      return;
    }
    if (next != widget.year) widget.onSave(next);
  }

  @override
  void dispose() {
    _c.dispose();
    _f.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(children: [
        Flexible(child: Text(tr('clinical_ttc_birth_year', 'Doğum iliniz'), style: _sub(context))),
        const SizedBox(width: 8),
        _CxInputBox(
          width: 96,
          child: Stack(children: [
            ValueListenableBuilder<TextEditingValue>(
              valueListenable: _c,
              builder: (context, v, _) => v.text.isEmpty ? Text('${widget.max - 18}', style: TextStyle(color: a.inkFaint)) : const SizedBox(),
            ),
            EditableText(
              controller: _c,
              focusNode: _f,
              style: TextStyle(fontSize: 13, color: a.ink),
              cursorColor: a.peach2,
              backgroundCursorColor: a.inkFaint,
              keyboardType: TextInputType.number,
              onSubmitted: (_) => _f.unfocus(),
            ),
          ]),
        ),
      ]),
    );
  }
}

/// SVG fertility ring: one arc per cycle day (gap 1.6°), today marker, tap a day to see its chance.
class FertilityRing extends StatelessWidget {
  const FertilityRing({
    super.key,
    required this.cycleLength,
    required this.periodLength,
    required this.cycleDay,
    required this.ovulationDay,
    required this.picked,
    required this.onPick,
    required this.child,
  });
  final int cycleLength;
  final int periodLength;
  final int cycleDay;
  final int ovulationDay;
  final int? picked;
  final ValueChanged<int> onPick;
  final Widget child;

  static const double size = 236, r = 98;

  int get n => math.min(45, math.max(20, cycleLength));

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(children: [
        Positioned.fill(
          child: GestureDetector(
            onTapUp: (d) {
              final o = d.localPosition - const Offset(size / 2, size / 2);
              if ((o.distance - r).abs() > 11) return;
              var deg = math.atan2(o.dy, o.dx) * 180 / math.pi + 90;
              if (deg < 0) deg += 360;
              onPick((deg / (360 / n)).floor().clamp(0, n - 1) + 1);
            },
            child: CustomPaint(
              painter: _RingPainter(
                n: n,
                periodLength: periodLength,
                ovulationDay: ovulationDay,
                picked: picked,
                marker: math.min(n, math.max(1, cycleDay)),
                rest: a.surfaceSoft,
                surface: a.surface,
                ink: a.ink,
              ),
            ),
          ),
        ),
        Positioned.fill(child: IgnorePointer(child: Center(child: child))),
      ]),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.n, required this.periodLength, required this.ovulationDay, required this.picked, required this.marker, required this.rest, required this.surface, required this.ink});
  final int n;
  final int periodLength;
  final int ovulationDay;
  final int? picked;
  final int marker;
  final Color rest;
  final Color surface;
  final Color ink;

  Color _color(int day) {
    if (day <= periodLength) return _period;
    if (day == ovulationDay) return _ovulation;
    if (day >= ovulationDay - 5 && day <= ovulationDay + 1) return _fertile;
    return rest;
  }

  @override
  void paint(Canvas canvas, Size s) {
    const c = Offset(FertilityRing.size / 2, FertilityRing.size / 2);
    const r = FertilityRing.r, gap = 1.6;
    final seg = 360 / n;
    final rect = Rect.fromCircle(center: c, radius: r);
    for (var i = 0; i < n; i++) {
      final day = i + 1;
      final a0 = (i * seg - 90 + gap / 2) * math.pi / 180;
      final a1 = ((i + 1) * seg - 90 - gap / 2) * math.pi / 180;
      canvas.drawArc(
        rect,
        a0,
        a1 - a0,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = picked == day ? 22 : 16
          ..strokeCap = StrokeCap.butt
          ..color = _color(day),
      );
    }
    final ma = ((marker - 0.5) * seg - 90) * math.pi / 180;
    final m = c + Offset(math.cos(ma), math.sin(ma)) * r;
    canvas.drawCircle(m, 11, Paint()..color = surface);
    canvas.drawCircle(
        m,
        11,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3.5
          ..color = ink);
  }

  @override
  bool shouldRepaint(_RingPainter o) =>
      o.n != n || o.periodLength != periodLength || o.ovulationDay != ovulationDay || o.picked != picked || o.marker != marker || o.rest != rest || o.ink != ink;
}

class _ChecklistRow extends StatelessWidget {
  const _ChecklistRow({required this.title, required this.desc, required this.done, required this.onToggle});
  final String title;
  final String desc;
  final bool done;
  final VoidCallback onToggle;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Semantics(
      button: true,
      toggled: done,
      label: title,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onToggle,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(children: [
            // framer `animate={{ scale: done ? [1, 1.25, 1] : 1 }}`
            TweenAnimationBuilder<double>(
              key: ValueKey(done),
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 300),
              builder: (context, v, child) => Transform.scale(scale: done ? 1 + 0.25 * math.sin(v * math.pi) : 1, child: child),
              child: Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: done ? a.green2 : null,
                  border: Border.all(color: done ? a.green2 : a.inkFaint, width: 2),
                ),
                child: done ? const Text('✓', style: TextStyle(fontSize: 13, color: TwColors.white, height: 1)) : null,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title,
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: done ? a.inkSoft : a.ink,
                        decoration: done ? TextDecoration.lineThrough : null)),
                Padding(padding: const EdgeInsets.only(top: 1), child: Text(desc, style: TextStyle(fontSize: 12, color: a.inkSoft))),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

class _BbtCard extends ConsumerWidget {
  const _BbtCard({required this.t});
  final TtcText t;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final now = flowNow();
    final logs = ref.watch(flowDailyLogsQuery((ymd(DateTime(now.year, now.month, now.day - 13)), ymd(now)))).data ?? const [];
    final days = [
      for (var i = 0; i < 14; i++)
        () {
          final key = ymd(DateTime(now.year, now.month, now.day - 13 + i));
          final row = logs.where((l) => l['log_date'] == key).firstOrNull;
          final sex = row?['sexual_activity'];
          return (temp: (row?['temperature'] as num?)?.toDouble(), lh: row?['ovulation_test'] as String?, intimacy: sex == 'unprotected' || sex == 'protected');
        }(),
    ];
    final shift = bbtShift([for (final d in days) d.temp]);
    return _CxCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Flexible(child: Text('🌡️ ${t('bbt_title')}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: a.ink))),
          Text(t('bbt_chart'), style: _sub(context)),
        ]),
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: SizedBox(height: 120, child: CustomPaint(painter: _BbtPainter(days, shift, a.surface))),
        ),
        shift != null
            ? Text('↑ ${t('bbt_shift')}', style: _sub(context, color: a.lavInk, weight: FontWeight.w700))
            : Text(t('bbt_hint'), style: _sub(context)),
      ]),
    );
  }
}

/// `<svg viewBox="0 0 320 120" preserveAspectRatio="none">` (x stretched to the width; emoji are not stretched).
class _BbtPainter extends CustomPainter {
  _BbtPainter(this.days, this.shift, this.surface);
  final List<({double? temp, String? lh, bool intimacy})> days;
  final int? shift;
  final Color surface;

  @override
  void paint(Canvas canvas, Size size) {
    const w = 320.0, h = 120.0, pad = 12.0;
    final sx = size.width / w, sy = size.height / h;
    final present = [for (final d in days) if (d.temp != null) d.temp!];
    final lo = present.isNotEmpty ? present.reduce(math.min) - 0.15 : 36.2;
    final hi = present.isNotEmpty ? present.reduce(math.max) + 0.15 : 37.0;
    double x(int i) => (pad + i / 13 * (w - pad * 2)) * sx;
    double y(double v) => (14 + (hi - v) / math.max(0.1, hi - lo) * (h - 40)) * sy;
    if (shift != null) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(x(shift!) - 6 * sx, 8 * sy, (w - x(shift!) / sx) * sx, (h - 34) * sy), Radius.elliptical(8 * sx, 8 * sy)),
        Paint()..color = _fertile.withValues(alpha: 0.18),
      );
    }
    final pts = [for (var i = 0; i < days.length; i++) if (days[i].temp != null) Offset(x(i), y(days[i].temp!))];
    if (pts.length > 1) {
      final path = Path()..moveTo(pts.first.dx, pts.first.dy);
      for (final p in pts.skip(1)) {
        path.lineTo(p.dx, p.dy);
      }
      canvas.drawPath(
          path,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.5
            ..strokeJoin = StrokeJoin.round
            ..color = _bbt);
    }
    for (final p in pts) {
      canvas.drawCircle(p, 3.6, Paint()..color = surface);
      canvas.drawCircle(
          p,
          3.6,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.2
            ..color = _bbt);
    }
    void emoji(String e, double fs, double cx, double baseline) {
      final tp = TextPainter(text: TextSpan(text: e, style: TextStyle(fontSize: fs)), textDirection: TextDirection.ltr)..layout();
      tp.paint(canvas, Offset(cx - tp.width / 2, baseline - tp.computeDistanceToActualBaseline(TextBaseline.alphabetic)));
    }

    for (var i = 0; i < days.length; i++) {
      if (days[i].lh != null && days[i].lh != 'negative') emoji('🧪', 10, x(i), (h - 14) * sy);
      if (days[i].intimacy) emoji('💞', 9, x(i), (h - 2) * sy);
    }
  }

  @override
  bool shouldRepaint(_BbtPainter o) => true;
}

class _TtcLogSheet extends ConsumerStatefulWidget {
  const _TtcLogSheet({required this.t, required this.lastTest, required this.onTest});
  final TtcText t;
  final String? lastTest;
  final Future<void> Function(PregnancyTest result) onTest;
  @override
  ConsumerState<_TtcLogSheet> createState() => _TtcLogSheetState();
}

class _TtcLogSheetState extends ConsumerState<_TtcLogSheet> {
  String? _lh;
  double? _temp;
  bool _intimacy = false;
  String? _test;
  Object? _seen = const Object();

  void _bump(double d) {
    setState(() => _temp = (math.min(38.5, math.max(35.0, (_temp ?? 36.5) + d)) * 100).round() / 100);
    unawaited(ref.read(flowHapticsProvider).light());
  }

  Future<void> _submit(Map<String, dynamic>? log) async {
    final t = widget.t;
    final toast = flowToast(context);
    final sex = log?['sexual_activity'];
    try {
      await ref.read(saveFlowDailyLogMutation.notifier).mutateAsync({
        'log_date': ymd(flowNow()),
        'ovulation_test': _lh,
        'temperature': _temp,
        'sexual_activity': _intimacy ? (sex == 'protected' ? 'protected' : 'unprotected') : (sex == 'none' ? 'none' : null),
      });
      if (_test != null) await widget.onTest(_test!);
      toast?.success(t('saved'));
      if (_test != 'positive' && mounted) Navigator.of(context).pop();
    } catch (_) {
      toast?.error(t('error'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final t = widget.t;
    final log = ref.watch(flowDailyLogQuery(ymd(flowNow()))).data;
    final saving = ref.watch(saveFlowDailyLogMutation).isPending;
    if (!identical(log, _seen)) {
      _seen = log;
      _lh = log?['ovulation_test'] as String?;
      _temp = (log?['temperature'] as num?)?.toDouble();
      _intimacy = log?['sexual_activity'] == 'unprotected' || log?['sexual_activity'] == 'protected';
      _test = null;
    }
    TextStyle field = TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: a.inkSoft);
    Widget step(String s, double d) => GestureDetector(
          onTap: () => _bump(d),
          child: Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: a.surfaceSoft, shape: BoxShape.circle),
            child: Text(s, style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: a.ink, height: 1)),
          ),
        );
    return ASheet(
      full: false,
      title: Text(t('log_title')),
      onClose: () => Navigator.of(context).maybePop(),
      footer: Opacity(
        opacity: saving ? 0.45 : 1,
        child: AButton(variant: AButtonVariant.accent, block: true, onPressed: saving ? null : () => unawaited(_submit(log)), child: Text(t('save'))),
      ),
      children: [
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('🧪 ${t('lh_title')}', style: field)),
          _CxSeg<String>(
            items: [for (final v in ['negative', 'positive', 'peak']) (v, t('lh.$v'))],
            selected: _lh,
            selectedColor: (v) => v != 'negative' ? a.lavInk : null,
            onTap: (v) => setState(() => _lh = _lh == v ? null : v),
          ),
          const SizedBox(height: 16),
          Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('🌡️ ${t('bbt_title')} · ${t('bbt_hint')}', style: field)),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            step('−', -0.05),
            const SizedBox(width: 16),
            SizedBox(
              width: 130,
              child: Text(_temp == null ? '—' : '${_temp!.toStringAsFixed(2)}°',
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, color: _temp == null ? a.inkFaint : a.ink)),
            ),
            const SizedBox(width: 16),
            step('+', 0.05),
          ]),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('💞 ${t('intimacy_title')}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: a.ink)),
                Text('🔒 ${t('intimacy_desc')}', style: _sub(context)),
              ]),
            ),
            const SizedBox(width: 12),
            ShadSwitch(checked: _intimacy, checkedColor: a.peach2, semanticLabel: t('intimacy_title'), onChanged: (v) => setState(() => _intimacy = v)),
          ]),
          const SizedBox(height: 16),
          Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('🤰 ${t('test_title')} · ${t('test_desc')}', style: field)),
          _CxSeg<String>(
            items: [for (final v in ['negative', 'faint', 'positive']) (v, t('test.$v'))],
            selected: _test,
            selectedColor: (v) => v == 'positive' ? a.greenInk : null,
            onTap: (v) => setState(() => _test = _test == v ? null : v),
          ),
          if (widget.lastTest != null && _test == null)
            Padding(padding: const EdgeInsets.only(top: 6), child: Text(t('test.${widget.lastTest}'), style: _sub(context))),
        ]),
      ],
    );
  }
}

class _PositiveSheet extends ConsumerStatefulWidget {
  const _PositiveSheet({required this.t, required this.lastPeriodDate, required this.onLater});
  final TtcText t;
  final DateTime lastPeriodDate;
  final VoidCallback onLater;
  @override
  ConsumerState<_PositiveSheet> createState() => _PositiveSheetState();
}

class _PositiveSheetState extends ConsumerState<_PositiveSheet> with SingleTickerProviderStateMixin {
  bool _visit = true;
  bool _busy = false;
  late final AnimationController _pop = AnimationController.unbounded(vsync: this, value: 0)
    ..animateWith(SpringSimulation(ASprings.spring(stiffness: 260, damping: 12), 0, 1, 0));

  @override
  void dispose() {
    _pop.dispose();
    super.dispose();
  }

  DateTime get _due => calculateDueDate(widget.lastPeriodDate) ?? widget.lastPeriodDate.add(const Duration(days: 280));

  Future<void> _go() async {
    final uid = ref.read(flowUserIdProvider);
    if (uid == null) return;
    final t = widget.t;
    final toast = flowToast(context);
    setState(() => _busy = true);
    try {
      final lmp = widget.lastPeriodDate;
      await switchToPregnancy(ref.read(flowRepositoryProvider), uid, ymd(lmp), ymd(_due));
      if (_visit) {
        final visitDate = DateTime(lmp.year, lmp.month, lmp.day + 49);
        if (visitDate.isAfter(flowNow())) {
          unawaited(ref.read(flowAddAppointmentProvider)({
            'title': t('positive_visit'),
            'description': t('positive_visit_desc'),
            'event_date': ymd(visitDate),
            'event_type': 'doctor',
            'reminder_enabled': true,
          }));
        }
      }
      final store = ref.read(userStoreProvider.notifier);
      store.setLastPeriodDate(lmp);
      store.setDueDate(_due);
      store.setLifeStage('bump');
      unawaited(ref.read(flowRefreshProfileProvider)());
      toast?.success(t('switched'));
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      toast?.error(t('error'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final t = widget.t;
    Widget li(String emoji, Color bg, String title, String small, {Widget? trailing}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(children: [
            _CxIcon(emoji, bg),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: a.ink)),
                Padding(padding: const EdgeInsets.only(top: 1), child: Text(small, style: TextStyle(fontSize: 12, color: a.inkSoft))),
              ]),
            ),
            if (trailing != null) ...[const SizedBox(width: 12), trailing],
          ]),
        );
    return ASheet(
      full: false,
      title: Text(t('positive_title')),
      onClose: () => Navigator.of(context).maybePop(),
      footer: Column(mainAxisSize: MainAxisSize.min, children: [
        AButton(variant: AButtonVariant.accent, block: true, onPressed: _busy ? null : () => unawaited(_go()), child: Text(t('positive_switch'))),
        const SizedBox(height: 8),
        AButton(variant: AButtonVariant.ghost, block: true, onPressed: widget.onLater, child: Text(t('positive_later'))),
      ]),
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 4),
          child: Column(children: [
            AnimatedBuilder(
              animation: _pop,
              builder: (context, child) => Transform.rotate(
                angle: -20 * (1 - _pop.value) * math.pi / 180,
                child: Transform.scale(scale: 0.4 + 0.6 * _pop.value, child: child),
              ),
              child: const Text('🎉', style: TextStyle(fontSize: 64, height: 1)),
            ),
            Padding(padding: const EdgeInsets.only(top: 10), child: Text(t('positive_body'), textAlign: TextAlign.center, style: _sub(context, size: 14.5))),
          ]),
        ),
        _CxCard(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          child: Column(children: [
            li('📅', a.lav1, fill(t('positive_lmp'), {'date': _long(widget.lastPeriodDate)}), fill(t('positive_due'), {'date': _long(_due)})),
            Divider(height: 1, thickness: 1, color: a.line),
            li('🩺', a.green1, t('positive_visit'), t('positive_visit_desc'),
                trailing: ShadSwitch(checked: _visit, checkedColor: a.peach2, semanticLabel: t('positive_visit'), onChanged: (v) => setState(() => _visit = v))),
            Divider(height: 1, thickness: 1, color: a.line),
            li('💞', a.pink1, t('positive_partner'), t('positive_partner_desc')),
          ]),
        ),
      ],
    );
  }
}

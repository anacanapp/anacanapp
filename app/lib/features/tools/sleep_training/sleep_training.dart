// Ported from: src/components/tools/SleepTraining.tsx, src/styles/babycare.css (.st-*), src/lib/widget-actions.ts
//              (consumeWidgetAction)
//
// Sleep training (babies 1–12 months): a hero with the age band and what is next, four tabs — Today (next-nap
// section, live sleep timer, night wake-ups, the day timeline from the wake-up time, the bedtime routine, a past
// sleep), Week (7-day chart with deletable sessions, averages, ranges, insights), Plan (method, steps, 14-day
// calendar with ratings) and Safety. The plan is kept per child on the phone and synced with the account
// (useSleepTrainingPlan → [SleepTrainingPlanController]). A home-screen widget "Sleep" tap starts the timer.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show TextField, InputDecoration, InputBorder, Material, MaterialType;

import '../../../core/i18n/tr.dart';
import '../../../core/offline/connectivity.dart' show connectivitySourceProvider;
import '../../../design/design.dart';
import '../../../domain/baby/baby_logs_range.dart';
import '../../../domain/health/emergency.dart' show getEmergencyNumber;
import '../../../domain/js_compat.dart';
import '../../../domain/sleep/sleep_predict.dart';
import '../../../domain/sleep/sleep_training.dart';
import '../../../shell/nav/shell_controller.dart' show widgetActionStoreProvider;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../baby/hooks/use_baby_care_actions.dart' show babyLogsRangeQuery, bc, refreshBabyLogsRange;
import '../../baby/hooks/use_baby_logs.dart' show babyLogsActionsProvider;
import '../../../core/cache/cache.dart' show queryClientProvider;
import '../kit/kit.dart';
import '../parenting/programme_ports.dart';
import '../parenting/programme_ui.dart';
import 'next_nap_section.dart';
import 'sleep_training_plan.dart';
import 'sleep_training_sync.dart' show sleepPlanRemoteProvider;

// ── Data seams ─────────────────────────────────────────────────────────────────────────────────

/// `useBabyLogsRange(14).logs`.
final sleepTrainingLogsProvider = Provider.autoDispose<List<BabyLogRow>>(
    (ref) => ref.watch(babyLogsRangeQuery(14)).data ?? const <BabyLogRow>[],
    name: 'sleepTrainingLogsProvider');

/// `useBabyLogs().addLog` / `deleteLog` as the sleep tool uses them; each returns the error (null = ok).
class SleepLogActions {
  const SleepLogActions({required this.addSleep, required this.delete});
  final Future<Object?> Function(DateTime start, DateTime end) addSleep;
  final Future<Object?> Function(String id) delete;
}

final sleepTrainingLogActionsProvider = Provider<SleepLogActions>((ref) => SleepLogActions(
      addSleep: (start, end) async {
        final res = await ref.read(babyLogsActionsProvider).addLog(logType: 'sleep', startTime: jsToIsoString(start), endTime: jsToIsoString(end));
        if (res.error == null) unawaited(refreshBabyLogsRange(ref.read(queryClientProvider)));
        return res.error;
      },
      delete: (id) async {
        final error = await ref.read(babyLogsActionsProvider).deleteLog(id);
        if (error == null) unawaited(refreshBabyLogsRange(ref.read(queryClientProvider)));
        return error;
      },
    ), name: 'sleepTrainingLogActionsProvider');

// ── Small pieces ───────────────────────────────────────────────────────────────────────────────

/// 'lav' | 'blue' | 'green' | 'peach' | 'yellow' | 'pink' | 'neutral' (`.st-<tone>`: background + ink).
({Color bg, Color fg}) stTone(ATokens a, String tone) => switch (tone) {
      'lav' => (bg: a.lav1, fg: a.lavInk),
      'blue' => (bg: a.blue1, fg: a.blueInk),
      'green' => (bg: a.green1, fg: a.greenInk),
      'peach' => (bg: a.peach1, fg: a.accentInk),
      'yellow' => (bg: a.yellow1, fg: a.warnInk),
      'pink' => (bg: a.pink1, fg: a.alertInk),
      _ => (bg: a.surfaceSoft, fg: a.inkSoft),
    };

String _dur(num m) => formatMinutes(m, hour: bc('babytracker_hour_short'), minute: bc('babytracker_minute_short'));
String _clockOf(DateTime d) => formatClock(minutesOfDay(d));
String _one(num? x) => x == null ? '' : x.toStringAsFixed(1);

String _blockLabel(ScheduleBlock b, int i) => b.type == 'nap'
    ? bc('sleeptraining_block_nap')
    : b.type == 'bedtime'
        ? bc('sleeptraining_block_bedtime')
        : i == 0
            ? bc('sleeptraining_block_morning')
            : bc('sleeptraining_block_awake');

class _Ico extends StatelessWidget {
  const _Ico(this.icon, {this.tone = 'lav', this.size = 36});
  final AIconData icon;
  final String tone;
  final double size;
  @override
  Widget build(BuildContext context) {
    final c = stTone(context.a, tone);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(jsRound(size * 0.34).toDouble())),
      child: AIcon(icon, size: jsRound(size * 0.5).toDouble(), strokeWidth: 2.2, color: c.fg),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.title, this.subtitle, this.icon, this.tone = 'lav', this.aside, required this.children});
  final String title;
  final String? subtitle;
  final AIconData? icon;
  final String tone;
  final Widget? aside;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return ACard(
      variant: ACardVariant.a3,
      child: Gap(gap: 12, children: [
        Row(children: [
          if (icon != null) ...[_Ico(icon!, tone: tone), const SizedBox(width: 12)],
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: css(16, weight: FontWeight.w700, em: -0.01, color: a.ink)),
              if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 2), child: Text(subtitle!, style: context.aText.a3Meta)),
            ]),
          ),
          if (aside != null) ...[const SizedBox(width: 12), aside!],
        ]),
        ...children,
      ]),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.label, {this.tone = 'neutral', this.icon});
  final String label;
  final String tone;
  final AIconData? icon;
  @override
  Widget build(BuildContext context) {
    final c = stTone(context.a, tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[AIcon(icon!, size: 12, strokeWidth: 2.4, color: c.fg), const SizedBox(width: 4)],
        Text(label, style: css(11.5, weight: FontWeight.w700, color: c.fg)),
      ]),
    );
  }
}

class _ProgressCircle extends StatelessWidget {
  const _ProgressCircle({required this.value, required this.total, this.size = 64, this.tone = 'green'});
  final int value;
  final int total;
  final double size;
  final String tone;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final p = total > 0 ? math.min(1, math.max(0, value / total)).toDouble() : 0.0;
    final stroke = tone == 'blue' ? a.blue2 : tone == 'lav' ? a.lav2 : a.green2;
    return Semantics(
      label: '$value/$total',
      child: ARing(
        progress: p,
        size: size,
        strokeWidth: 7,
        trackColor: a.lineStrong,
        fillColor: stroke,
        drawIn: false,
        mirrorInRtl: false,
        child: Text('$value/$total', style: css(jsRound(size * 0.22).toDouble(), weight: FontWeight.w800, height: 1, color: a.ink)),
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({
    required this.value,
    required this.minusLabel,
    required this.plusLabel,
    required this.onMinus,
    required this.onPlus,
    this.minusDisabled = false,
    this.plusDisabled = false,
    this.tone = 'lav',
    this.width = 44,
    this.compact = false,
    this.keyPrefix = 'stepper',
  });
  final String value;
  final String minusLabel;
  final String plusLabel;
  final VoidCallback onMinus;
  final VoidCallback onPlus;
  final bool minusDisabled;
  final bool plusDisabled;
  final String tone;
  final double width;
  final bool compact;
  final String keyPrefix;

  @override
  Widget build(BuildContext context) {
    final c = stTone(context.a, tone);
    final size = compact ? 34.0 : 40.0;
    Widget btn(String label, VoidCallback onTap, bool disabled, AIconData icon, String k) => Tap(
          key: ValueKey('$keyPrefix-$k'),
          label: label,
          enabled: !disabled,
          onTap: onTap,
          excludeSemantics: true,
          child: Opacity(
            opacity: disabled ? 0.4 : 1,
            child: Container(
              width: size,
              height: size,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: c.bg, shape: BoxShape.circle),
              child: AIcon(icon, size: 18, strokeWidth: 2.4, color: c.fg),
            ),
          ),
        );
    return Row(mainAxisSize: MainAxisSize.min, children: [
      btn(minusLabel, onMinus, minusDisabled, AIcons.minus, 'minus'),
      const SizedBox(width: 6),
      ConstrainedBox(
        constraints: BoxConstraints(minWidth: width),
        child: Text(value, textAlign: TextAlign.center, style: css(18, weight: FontWeight.w800, color: context.a.ink)),
      ),
      const SizedBox(width: 6),
      btn(plusLabel, onPlus, plusDisabled, AIcons.plus, 'plus'),
    ]);
  }
}

class _LinkButton extends StatelessWidget {
  const _LinkButton({required this.label, required this.onTap, this.tone = 'neutral', this.icon, super.key});
  final String label;
  final VoidCallback onTap;
  final String tone;
  final AIconData? icon;
  @override
  Widget build(BuildContext context) {
    final fg = stTone(context.a, tone).fg;
    return Tap(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[AIcon(icon!, size: 14, strokeWidth: 2.2, color: fg), const SizedBox(width: 4)],
          Flexible(child: Text(label, style: css(12.5, weight: FontWeight.w700, color: fg))),
        ]),
      ),
    );
  }
}

/// `.st-checkrow`.
class _CheckRow extends StatelessWidget {
  const _CheckRow({required this.on, required this.label, required this.onTap, super.key});
  final bool on;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Tap(
      pressed: on,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: on ? a.green1 : a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AIcon(on ? AIcons.circleCheck : AIcons.circle, size: 20, color: on ? a.greenInk : a.inkFaint),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: css(13, color: a.ink))),
        ]),
      ),
    );
  }
}

/// `.st-note.st-<tone>-soft`.
class _Note extends StatelessWidget {
  const _Note({required this.icon, required this.tone, required this.text});
  final AIconData icon;
  final String tone;
  final String text;
  @override
  Widget build(BuildContext context) {
    final c = stTone(context.a, tone);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: c.bg, borderRadius: BorderRadius.circular(16)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.only(top: 1), child: AIcon(icon, size: 18, strokeWidth: 2.2, color: c.fg)),
        const SizedBox(width: 12),
        Expanded(child: Text(text, style: css(13, color: context.a.ink))),
      ]),
    );
  }
}

const Map<String, ({AIconData icon, String tone})> _methodInfo = {
  'gentle_pickup': (icon: AIcons.hand, tone: 'peach'),
  'chair': (icon: AIcons.armchair, tone: 'lav'),
  'fading': (icon: AIcons.trendingDown, tone: 'blue'),
  'timed_checks': (icon: AIcons.timer, tone: 'yellow'),
};
const Map<String, ({AIconData icon, String tone})> _rateInfo = {
  'easy': (icon: AIcons.smile, tone: 'green'),
  'medium': (icon: AIcons.meh, tone: 'yellow'),
  'hard': (icon: AIcons.frown, tone: 'pink'),
};
const Map<String, ({AIconData icon, String tone})> _routineIcon = {
  'bath': (icon: AIcons.bath, tone: 'blue'),
  'pajamas': (icon: AIcons.shirt, tone: 'lav'),
  'feed': (icon: AIcons.milk, tone: 'peach'),
  'story': (icon: AIcons.bookOpen, tone: 'yellow'),
  'dim_lights': (icon: AIcons.lightbulb, tone: 'yellow'),
  'crib_drowsy': (icon: AIcons.bedDouble, tone: 'blue'),
};
const List<String> _warnings = ['sleeptraining_warn_breath', 'sleeptraining_warn_blue', 'sleeptraining_warn_limp', 'sleeptraining_warn_feeds', 'sleeptraining_warn_fever'];
const Map<String, ({AIconData icon, String tone, String key})> _insights = {
  'no_data': (icon: AIcons.info, tone: 'neutral', key: 'sleeptraining_insight_no_data'),
  'need_more_data': (icon: AIcons.info, tone: 'neutral', key: 'sleeptraining_insight_need_more'),
  'naps_below_range': (icon: AIcons.lightbulb, tone: 'yellow', key: 'sleeptraining_insight_naps_below'),
  'nap_short': (icon: AIcons.lightbulb, tone: 'yellow', key: 'sleeptraining_insight_nap_short'),
  'night_short': (icon: AIcons.lightbulb, tone: 'yellow', key: 'sleeptraining_insight_night_short'),
  'wake_window_long': (icon: AIcons.lightbulb, tone: 'yellow', key: 'sleeptraining_insight_wake_long'),
  'wake_window_short': (icon: AIcons.lightbulb, tone: 'yellow', key: 'sleeptraining_insight_wake_short'),
  'total_below_range': (icon: AIcons.lightbulb, tone: 'yellow', key: 'sleeptraining_insight_total_below'),
  'all_good': (icon: AIcons.circleCheck, tone: 'green', key: 'sleeptraining_insight_all_good'),
};
const Map<String, String> _bandKey = {
  '1-3': 'sleeptraining_band_1_3',
  '4-6': 'sleeptraining_band_4_6',
  '7-9': 'sleeptraining_band_7_9',
  '10-12': 'sleeptraining_band_10_12',
};

// ── Today ────────────────────────────────────────────────────────────────────────────────────

/// `SleepClock`: elapsed time since [since], ticking every second.
class _SleepClock extends StatefulWidget {
  const _SleepClock({required this.since, required this.style});
  final DateTime since;
  final TextStyle style;
  @override
  State<_SleepClock> createState() => _SleepClockState();
}

class _SleepClockState extends State<_SleepClock> {
  Timer? _t;
  @override
  void initState() {
    super.initState();
    _t = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      Text(formatClockSeconds((DomainClock.nowMs() - widget.since.millisecondsSinceEpoch) / 1000), style: widget.style);
}

class _LiveSleep extends StatelessWidget {
  const _LiveSleep({
    required this.sleepingSince,
    required this.nightWakes,
    required this.busy,
    required this.todaySummary,
    required this.onStart,
    required this.onStop,
    required this.onDiscard,
    required this.onNightWake,
  });
  final DateTime? sleepingSince;
  final num nightWakes;
  final bool busy;
  final String todaySummary;
  final VoidCallback onStart;
  final VoidCallback onStop;
  final VoidCallback onDiscard;
  final ValueChanged<int> onNightWake;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final asleep = sleepingSince != null;
    final meta = context.aText.a3Meta;
    return _Card(
      title: bc('sleeptraining_live_title'),
      subtitle: bc('sleeptraining_live_subtitle'),
      icon: AIcons.moon,
      tone: 'lav',
      aside: _Pill(asleep ? bc('sleeptraining_state_sleeping') : bc('sleeptraining_state_awake'), tone: asleep ? 'blue' : 'yellow', icon: asleep ? AIcons.moon : AIcons.sun),
      children: [
        Gap(gap: 10, crossAxisAlignment: CrossAxisAlignment.center, children: [
          Tap(
            key: const ValueKey('sleep-live-button'),
            label: asleep ? bc('sleeptraining_live_stop') : bc('sleeptraining_live_start'),
            enabled: !busy,
            onTap: asleep ? onStop : onStart,
            child: Opacity(
              opacity: busy ? 0.7 : 1,
              child: Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: asleep ? a.coralStrong : a.lav1,
                  border: asleep ? null : Border.all(color: a.lav2, width: 3),
                  boxShadow: a.cardShadow,
                ),
                child: DefaultTextStyle.merge(
                  style: css(14, weight: FontWeight.w800, color: asleep ? a.onCoral : a.lavInk),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: asleep
                      ? [
                          _SleepClock(since: sleepingSince!, style: css(28, weight: FontWeight.w800, height: 1, color: a.onCoral)),
                          const SizedBox(height: 4),
                          Row(mainAxisSize: MainAxisSize.min, children: [
                            AIcon(AIcons.sun, size: 15, strokeWidth: 2.4, color: a.onCoral),
                            const SizedBox(width: 4),
                            Text(bc('sleeptraining_live_stop'), style: css(13, weight: FontWeight.w800, color: a.onCoral)),
                          ]),
                        ]
                      : [
                          AIcon(AIcons.moon, size: 36, strokeWidth: 2, color: a.lavInk),
                          const SizedBox(height: 4),
                          Text(bc('sleeptraining_live_start'), style: css(13, weight: FontWeight.w800, color: a.lavInk)),
                        ]),
                ),
              ),
            ),
          ),
          if (asleep) ...[
            Text(bc('sleeptraining_live_since', {'time': _clockOf(sleepingSince!)}), style: meta),
            _LinkButton(key: const ValueKey('sleep-discard'), label: bc('sleeptraining_live_discard'), onTap: onDiscard),
          ] else
            Text(bc('sleeptraining_live_hint'), style: meta, textAlign: TextAlign.center),
        ]),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(18)),
          child: Row(children: [
            const _Ico(AIcons.bellRing, tone: 'blue'),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(bc('sleeptraining_night_wakes'), style: css(14.5, weight: FontWeight.w600, color: a.ink)),
                Text(bc('sleeptraining_night_wakes_sub'), style: meta),
              ]),
            ),
            _Stepper(
              keyPrefix: 'night-wakes',
              tone: 'blue',
              compact: true,
              value: jsNumberToString(nightWakes),
              width: 24,
              minusLabel: bc('sleeptraining_night_wakes_less'),
              plusLabel: bc('sleeptraining_night_wakes_more'),
              minusDisabled: nightWakes <= 0,
              onMinus: () => onNightWake(-1),
              onPlus: () => onNightWake(1),
            ),
          ]),
        ),
        Text(todaySummary, style: meta, textAlign: TextAlign.center),
      ],
    );
  }
}

({AIconData icon, String tone, String tip}) _blockTip(ScheduleBlock b, int i) {
  if (b.type == 'nap') return (icon: AIcons.cloudMoon, tone: 'lav', tip: bc('sleeptraining_tip_nap'));
  if (b.type == 'bedtime') return (icon: AIcons.moon, tone: 'blue', tip: bc('sleeptraining_tip_bedtime'));
  return i == 0 ? (icon: AIcons.sun, tone: 'yellow', tip: bc('sleeptraining_tip_morning')) : (icon: AIcons.coffee, tone: 'yellow', tip: bc('sleeptraining_tip_awake'));
}

Color _segColor(ATokens a, String kind) => kind == 'wake' ? a.yellow2 : kind == 'nap' ? a.lav2 : a.blue2;

class _DayTimeline extends StatefulWidget {
  const _DayTimeline({required this.schedule, required this.wakeTime, required this.now, required this.onShiftWake, required this.onPickWake});
  final List<ScheduleBlock> schedule;
  final String wakeTime;
  final DateTime now;
  final ValueChanged<int> onShiftWake;
  final ValueChanged<String> onPickWake;
  @override
  State<_DayTimeline> createState() => _DayTimelineState();
}

class _DayTimelineState extends State<_DayTimeline> {
  int? _open;
  void _toggle(int i) => setState(() => _open = _open == i ? null : i);

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final meta = context.aText.a3Meta;
    final schedule = widget.schedule;
    final segments = timelineSegments(schedule);
    final status = scheduleStatus(schedule, widget.now);
    final wakeMinute = parseClock(widget.wakeTime) ?? wakeMin;
    final nowPct = minutesOfDay(widget.now) / 1440 * 100;
    return _Card(
      title: bc('sleeptraining_timeline_title'),
      subtitle: bc('sleeptraining_timeline_subtitle'),
      icon: AIcons.cloudMoon,
      tone: 'yellow',
      children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(bc('sleeptraining_wake_title'), style: css(14.5, weight: FontWeight.w600, color: a.ink)),
              Text(bc('sleeptraining_wake_hint'), style: meta),
            ]),
          ),
          const SizedBox(width: 12),
          _Stepper(
            keyPrefix: 'wake',
            tone: 'yellow',
            value: widget.wakeTime,
            width: 64,
            minusLabel: bc('sleeptraining_wake_earlier'),
            plusLabel: bc('sleeptraining_wake_later'),
            minusDisabled: wakeMinute <= wakeMin,
            plusDisabled: wakeMinute >= wakeMax,
            onMinus: () => widget.onShiftWake(-15),
            onPlus: () => widget.onShiftWake(15),
          ),
        ]),
        WrapRow(gap: 6, children: [
          for (final v in wakePresets)
            Tap(
              key: ValueKey('wake-preset-$v'),
              pressed: widget.wakeTime == v,
              onTap: () => widget.onPickWake(v),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: widget.wakeTime == v ? a.yellow1 : a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                child: Text(v, style: css(12, weight: FontWeight.w800, color: widget.wakeTime == v ? a.warnInk : a.inkSoft)),
              ),
            ),
        ]),
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: LayoutBuilder(builder: (context, c) {
            final w = c.maxWidth;
            return Stack(clipBehavior: Clip.none, children: [
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    height: 38,
                    color: a.surfaceSoft,
                    child: Stack(children: [
                      for (final s in segments)
                        Positioned(
                          top: 0,
                          bottom: 0,
                          left: s.startPct / 100 * w,
                          width: s.widthPct / 100 * w,
                          child: Tap(
                            label: '${_blockLabel(schedule[s.blockIndex], s.blockIndex)} ${schedule[s.blockIndex].start}',
                            onTap: () => _toggle(s.blockIndex),
                            child: Opacity(
                              opacity: _open == null || _open == s.blockIndex ? 1 : 0.45,
                              child: Container(
                                decoration: BoxDecoration(
                                  color: _segColor(a, s.kind),
                                  border: Border(right: BorderSide(color: a.surface)),
                                ),
                              ),
                            ),
                          ),
                        ),
                    ]),
                  ),
                ),
                const SizedBox(height: 4),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  for (final h in const ['00', '06', '12', '18', '24']) Text(h, style: css(10, weight: FontWeight.w700, color: a.inkFaint)),
                ]),
              ]),
              Positioned(
                top: -4,
                bottom: 14,
                left: nowPct / 100 * w - 1.5,
                width: 3,
                child: Container(decoration: BoxDecoration(color: a.ink, borderRadius: BorderRadius.circular(2))),
              ),
            ]);
          }),
        ),
        WrapRow(gap: 12, children: [
          for (final k in const ['wake', 'nap', 'night'])
            Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 10, height: 10, decoration: BoxDecoration(color: _segColor(a, k), borderRadius: BorderRadius.circular(4))),
              const SizedBox(width: 6),
              Text(
                  k == 'wake'
                      ? bc('sleeptraining_legend_awake')
                      : k == 'nap'
                          ? bc('sleeptraining_legend_nap')
                          : bc('sleeptraining_legend_night'),
                  style: css(11.5, weight: FontWeight.w700, color: a.inkSoft)),
            ]),
        ]),
        Gap(gap: 8, children: [
          for (var i = 0; i < schedule.length; i++) _block(context, schedule[i], i, status),
        ]),
        if (schedule.any((b) => b.type == 'bedtime')) Padding(padding: const EdgeInsets.only(top: 10), child: Text(bc('sleeptraining_schedule_note'), style: meta)),
      ],
    );
  }

  Widget _block(BuildContext context, ScheduleBlock b, int i, ScheduleStatus status) {
    final a = context.a;
    final tip = _blockTip(b, i);
    final isOpen = _open == i, isNow = status.currentIndex == i;
    final sub = b.type == 'bedtime'
        ? bc('sleeptraining_block_night_sub', {'time': widget.schedule[0].start})
        : '${b.start}–${b.end} · ${_dur(blockMinutes(b))}';
    final lit = isOpen || isNow;
    final c = stTone(a, tip.tone);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Tap(
        key: ValueKey('sleep-block-$i'),
        onTap: () => _toggle(i),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: lit ? c.bg : a.surfaceSoft,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: isNow ? a.inkSoft : const Color(0x00000000), width: 2),
          ),
          child: Row(children: [
            _Ico(tip.icon, tone: tip.tone, size: 34),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${_blockLabel(b, i)}${b.type == 'bedtime' ? ' · ${b.start}' : ''}', style: css(14.5, weight: FontWeight.w600, color: a.ink)),
                Text(sub, style: context.aText.a3Meta),
              ]),
            ),
            if (isNow)
              _Pill(bc('sleeptraining_now'), tone: tip.tone)
            else if (status.nextIndex == i)
              _Pill(bc('sleeptraining_next')),
            const SizedBox(width: 12),
            Transform.rotate(angle: isOpen ? math.pi : 0, child: AIcon(AIcons.chevronDown, size: 16, color: a.inkFaint)),
          ]),
        ),
      ),
      if (isOpen)
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 2),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(padding: const EdgeInsets.only(top: 3), child: AIcon(AIcons.lightbulb, size: 13, color: a.warnInk)),
            const SizedBox(width: 6),
            Expanded(child: Text(tip.tip, style: css(12.5, color: a.ink))),
          ]),
        ),
    ]);
  }
}

class _Routine extends StatelessWidget {
  const _Routine({required this.done, required this.streak, required this.onToggle});
  final List<String> done;
  final int streak;
  final ValueChanged<String> onToggle;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final count = routineSteps.where(done.contains).length, complete = count == routineSteps.length;
    return _Card(
      title: bc('sleeptraining_routine_title'),
      subtitle: bc('sleeptraining_routine_subtitle'),
      icon: AIcons.bedDouble,
      tone: 'blue',
      aside: streak > 0 ? _Pill(bc('sleeptraining_streak', {'days': streak}), tone: 'peach', icon: AIcons.flame) : null,
      children: [
        Row(children: [
          _ProgressCircle(value: count, total: routineSteps.length, tone: complete ? 'green' : 'blue'),
          const SizedBox(width: 14),
          Expanded(child: Text(complete ? bc('sleeptraining_routine_done') : bc('sleeptraining_routine_hint'), style: context.aText.a3Meta)),
        ]),
        Grid(columns: 2, gap: 8, children: [
          for (final s in routineSteps)
            Tap(
              key: ValueKey('routine-$s'),
              pressed: done.contains(s),
              onTap: () => onToggle(s),
              child: Container(
                constraints: const BoxConstraints(minHeight: 84),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: done.contains(s) ? a.green1 : a.surfaceSoft, borderRadius: BorderRadius.circular(18)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    _Ico(_routineIcon[s]!.icon, tone: done.contains(s) ? 'green' : _routineIcon[s]!.tone, size: 32),
                    Container(
                      width: 22,
                      height: 22,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: done.contains(s) ? a.green2 : null,
                        border: done.contains(s) ? null : Border.all(color: a.lineStrong, width: 2),
                      ),
                      child: done.contains(s) ? const AIcon(AIcons.check, size: 13, strokeWidth: 3, color: Color(0xFFFFFFFF)) : null,
                    ),
                  ]),
                  const SizedBox(height: 8),
                  Text(bc('sleeptraining_step_$s'), style: css(13, weight: FontWeight.w700, height: 1.3, color: a.ink)),
                ]),
              ),
            ),
        ]),
      ],
    );
  }
}

/// `<input type="time">`: HH:MM text.
class _TimeField extends StatefulWidget {
  const _TimeField({required this.label, required this.value, required this.onChanged, super.key});
  final String label;
  final String value;
  final ValueChanged<String> onChanged;
  @override
  State<_TimeField> createState() => _TimeFieldState();
}

class _TimeFieldState extends State<_TimeField> {
  late final TextEditingController _c = TextEditingController(text: widget.value);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(widget.label, style: context.aText.a3FieldLabel)),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
        child: Material(
          type: MaterialType.transparency,
          child: TextField(
            controller: _c,
            onChanged: widget.onChanged,
            keyboardType: TextInputType.datetime,
            style: context.aText.a3FieldInput,
            decoration: const InputDecoration(border: InputBorder.none, isDense: true, contentPadding: EdgeInsets.symmetric(vertical: 12)),
          ),
        ),
      ),
    ]);
  }
}

class _PastSleep extends StatefulWidget {
  const _PastSleep({required this.busy, required this.onSave});
  final bool busy;
  final Future<bool> Function(String day, String start, String end) onSave;
  @override
  State<_PastSleep> createState() => _PastSleepState();
}

class _PastSleepState extends State<_PastSleep> {
  bool _open = false;
  String _day = 'today';
  String _start = '13:00';
  String _end = '14:00';

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return ACard(
      variant: ACardVariant.a3,
      child: Gap(gap: 12, children: [
        Tap(
          key: const ValueKey('past-sleep-toggle'),
          onTap: () => setState(() => _open = !_open),
          child: Row(children: [
            const _Ico(AIcons.pencil, tone: 'neutral'),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(bc('sleeptraining_manual_title'), style: css(16, weight: FontWeight.w700, em: -0.01, color: a.ink)),
                Text(bc('sleeptraining_manual_subtitle'), style: context.aText.a3Meta),
              ]),
            ),
            Transform.rotate(angle: _open ? math.pi : 0, child: AIcon(AIcons.chevronDown, size: 18, color: a.inkFaint)),
          ]),
        ),
        if (_open)
          Gap(gap: 12, children: [
            ASegmentedTabs<String>(
              items: [ASegmentItem('today', bc('sleeptraining_day_today')), ASegmentItem('yesterday', bc('sleeptraining_day_yesterday'))],
              selected: _day,
              onChanged: (d) => setState(() => _day = d),
            ),
            Grid(columns: 2, gap: 8, children: [
              _TimeField(key: const ValueKey('past-sleep-start'), label: bc('sleeptraining_log_start'), value: _start, onChanged: (v) => _start = v),
              _TimeField(key: const ValueKey('past-sleep-end'), label: bc('sleeptraining_log_end'), value: _end, onChanged: (v) => _end = v),
            ]),
            Text(bc('sleeptraining_manual_hint'), style: context.aText.a3Meta),
            AButton(
              key: const ValueKey('past-sleep-save'),
              variant: AButtonVariant.accent,
              block: true,
              onPressed: widget.busy
                  ? null
                  : () async {
                      if (await widget.onSave(_day, _start, _end) && mounted) setState(() => _open = false);
                    },
              child: Text(bc('sleeptraining_log_save')),
            ),
          ]),
      ]),
    );
  }
}

// ── Week ─────────────────────────────────────────────────────────────────────────────────────

class _WeekChart extends StatefulWidget {
  const _WeekChart({required this.days, required this.band, required this.language, required this.onDelete});
  final List<SleepDay> days;
  final AgeBand band;
  final String language;
  final ValueChanged<String> onDelete;
  @override
  State<_WeekChart> createState() => _WeekChartState();
}

class _WeekChartState extends State<_WeekChart> {
  late int _sel = widget.days.length - 1;
  String? _armed;

  Color _bar(ATokens a, String kind) => switch (kind) {
        'today' => a.blue2,
        'within' => a.green2,
        'below' => a.yellow2,
        'above' => a.lav2,
        _ => a.lineStrong,
      };

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final days = widget.days;
    final norms = bandNorms[widget.band]!;
    final low = norms.totalSleepHours[0], high = norms.totalSleepHours[1];
    final maxH = [high + 2.0, ...days.map((d) => d.totalMinutes / 60)].reduce(math.max);
    final index = math.min(_sel, days.length - 1), day = days[index];
    String kind(SleepDay d, int i) {
      if (d.totalMinutes == 0) return 'none';
      if (i == days.length - 1) return 'today';
      final h = d.totalMinutes / 60;
      return h < low ? 'below' : h > high ? 'above' : 'within';
    }

    String dayMonth(DateTime d) => dateFnsDayMonth(d, widget.language);
    return _Card(
      title: bc('sleeptraining_chart_title'),
      subtitle: bc('sleeptraining_chart_subtitle'),
      icon: AIcons.chartColumn,
      tone: 'blue',
      children: [
        SizedBox(
          height: 130,
          child: Stack(children: [
            for (final h in [low, high])
              Positioned(left: 0, right: 0, bottom: h / maxH * 130, child: _Dashed(color: a.lineStrong)),
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              for (var i = 0; i < days.length; i++) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(
                  child: Tap(
                    key: ValueKey('chart-day-$i'),
                    pressed: i == index,
                    label: '${dayMonth(days[i].date)} · ${days[i].totalMinutes > 0 ? _dur(days[i].totalMinutes) : bc('sleeptraining_chart_none')}',
                    excludeSemantics: true,
                    onTap: () => setState(() {
                      _sel = i;
                      _armed = null;
                    }),
                    child: Container(
                      height: 130,
                      decoration: BoxDecoration(color: i == index ? a.surfaceSoft : null, borderRadius: BorderRadius.circular(12)),
                      child: LayoutBuilder(builder: (context, c) {
                        final d = days[i];
                        final pct = d.totalMinutes == 0 ? 4.0 : math.max(6, d.totalMinutes / 60 / maxH * 100).toDouble();
                        return Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                          Padding(
                            padding: const EdgeInsets.only(bottom: 3),
                            child: Text(d.totalMinutes > 0 ? (d.totalMinutes / 60).toStringAsFixed(1) : '',
                                style: css(10, weight: FontWeight.w800, color: a.inkSoft)),
                          ),
                          Container(
                            width: math.min(30, c.maxWidth * 0.62),
                            height: math.max(4, pct / 100 * 130 - 20),
                            decoration: BoxDecoration(color: _bar(a, kind(d, i)), borderRadius: BorderRadius.circular(8)),
                          ),
                        ]);
                      }),
                    ),
                  ),
                ),
              ],
            ]),
          ]),
        ),
        Row(children: [
          for (var i = 0; i < days.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: Text(localeWeekdayShort(days[i].date, widget.language),
                  textAlign: TextAlign.center,
                  style: css(10.5, weight: i == index ? FontWeight.w800 : FontWeight.w600, color: i == index ? a.ink : a.inkSoft)),
            ),
          ],
        ]),
        WrapRow(gap: 12, children: [
          for (final k in const ['within', 'below', 'above', 'today'])
            Row(mainAxisSize: MainAxisSize.min, children: [
              Container(width: 10, height: 10, decoration: BoxDecoration(color: _bar(a, k), borderRadius: BorderRadius.circular(4))),
              const SizedBox(width: 6),
              Text(bc('sleeptraining_chart_$k'), style: css(11.5, weight: FontWeight.w700, color: a.inkSoft)),
            ]),
        ]),
        Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(dayMonth(day.date), style: css(14.5, weight: FontWeight.w600, color: a.ink)),
            Text(day.totalMinutes > 0 ? _dur(day.totalMinutes) : bc('sleeptraining_chart_none'), style: context.aText.a3Meta),
          ]),
          if (day.sessions.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Gap(gap: 8, children: [
                for (final s in day.sessions)
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                    child: Row(children: [
                      _Ico(s.kind == 'night' ? AIcons.moon : AIcons.cloudMoon, tone: s.kind == 'night' ? 'blue' : 'lav', size: 32),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(s.kind == 'night' ? bc('sleeptraining_kind_night') : bc('sleeptraining_kind_nap'), style: css(14.5, weight: FontWeight.w600, color: a.ink)),
                          Text('${_clockOf(s.start)}–${_clockOf(s.end)} · ${_dur(s.minutes)}', style: context.aText.a3Meta),
                        ]),
                      ),
                      Tap(
                        key: ValueKey('sleep-delete-${s.id}'),
                        label: _armed == s.id ? bc('sleeptraining_delete_confirm') : bc('sleeptraining_delete'),
                        onTap: () {
                          if (_armed == s.id) {
                            setState(() => _armed = null);
                            widget.onDelete(s.id);
                          } else {
                            setState(() => _armed = s.id);
                          }
                        },
                        child: Container(
                          constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          decoration: BoxDecoration(color: _armed == s.id ? a.pink1 : null, borderRadius: BorderRadius.circular(999)),
                          child: Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
                            AIcon(AIcons.trash2, size: 15, color: _armed == s.id ? a.alertInk : a.inkSoft),
                            if (_armed == s.id) ...[
                              const SizedBox(width: 4),
                              Text(bc('sleeptraining_delete_sure'), style: css(12, weight: FontWeight.w700, color: a.alertInk)),
                            ],
                          ]),
                        ),
                      ),
                    ]),
                  ),
              ]),
            ),
        ]),
      ],
    );
  }
}

/// `border-top: 1.5px dashed`.
class _Dashed extends StatelessWidget {
  const _Dashed({required this.color});
  final Color color;
  @override
  Widget build(BuildContext context) => CustomPaint(size: const Size(double.infinity, 1.5), painter: _DashPainter(color));
}

class _DashPainter extends CustomPainter {
  _DashPainter(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = 1.5;
    for (double x = 0; x < size.width; x += 6) {
      canvas.drawLine(Offset(x, 0), Offset(math.min(x + 3, size.width), 0), p);
    }
  }

  @override
  bool shouldRepaint(_DashPainter old) => old.color != color;
}

class _Stat extends StatelessWidget {
  const _Stat({required this.icon, required this.tone, required this.label, required this.value});
  final AIconData icon;
  final String tone;
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: context.a.surfaceSoft, borderRadius: BorderRadius.circular(18)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _Ico(icon, tone: tone, size: 28),
          Padding(padding: const EdgeInsets.only(top: 8), child: Text(value, style: css(17, weight: FontWeight.w700, color: context.a.ink))),
          Text(label, style: context.aText.a3Meta),
        ]),
      );
}

class _Averages extends StatelessWidget {
  const _Averages({required this.summary, required this.nightWakeAvg});
  final SleepSummary summary;
  final double? nightWakeAvg;
  @override
  Widget build(BuildContext context) {
    final none = bc('sleeptraining_no_value');
    String v(num? m) => m == null ? none : _dur(m);
    return _Card(
      title: bc('sleeptraining_avg_title'),
      icon: AIcons.activity,
      tone: 'green',
      subtitle: summary.daysWithData > 0 ? bc('sleeptraining_avg_days', {'count': summary.daysWithData}) : bc('sleeptraining_avg_empty'),
      children: [
        Grid(columns: 2, gap: 8, children: [
          _Stat(icon: AIcons.moon, tone: 'blue', label: bc('sleeptraining_sum_total'), value: v(summary.avgDailyMinutes)),
          _Stat(icon: AIcons.cloudMoon, tone: 'lav', label: bc('sleeptraining_sum_naps'), value: summary.avgNapsPerDay == null ? none : _one(summary.avgNapsPerDay)),
          _Stat(icon: AIcons.timer, tone: 'lav', label: bc('sleeptraining_sum_nap_len'), value: v(summary.avgNapMinutes)),
          _Stat(icon: AIcons.moon, tone: 'blue', label: bc('sleeptraining_sum_night'), value: v(summary.avgLongestNightMinutes)),
          _Stat(icon: AIcons.target, tone: 'yellow', label: bc('sleeptraining_sum_window'), value: v(summary.avgWakeWindowMinutes)),
          _Stat(icon: AIcons.bellRing, tone: 'pink', label: bc('sleeptraining_sum_wakes'), value: nightWakeAvg == null ? none : _one(nightWakeAvg)),
        ]),
        if (summary.medianBedtime != null && summary.medianWakeTime != null)
          Text(bc('sleeptraining_bedtime_line', {'bed': summary.medianBedtime, 'wake': summary.medianWakeTime}), style: context.aText.a3Meta),
      ],
    );
  }
}

class _Meter extends StatelessWidget {
  const _Meter({required this.label, required this.value, required this.range, required this.format});
  final String label;
  final double? value;
  final List<num> range;
  final String Function(num) format;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final max = math.max(range[1] * 1.6, (value ?? 0) * 1.1);
    final state = value == null ? null : value! < range[0] ? 'below' : value! > range[1] ? 'above' : 'within';
    final tone = state == 'within' ? 'green' : state == 'below' ? 'yellow' : state == 'above' ? 'lav' : 'neutral';
    final text = state == null ? bc('sleeptraining_no_value') : bc('sleeptraining_chart_$state');
    final dot = tone == 'green' ? a.green2 : tone == 'yellow' ? a.yellow2 : tone == 'lav' ? a.lav2 : a.inkFaint;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Flexible(child: Text(label, style: css(14.5, weight: FontWeight.w600, color: a.ink))),
        _Pill(text, tone: tone),
      ]),
      Padding(
        padding: const EdgeInsets.only(top: 10, bottom: 6),
        child: LayoutBuilder(builder: (context, c) {
          final w = c.maxWidth;
          return SizedBox(
            height: 8,
            child: Stack(clipBehavior: Clip.none, children: [
              Positioned.fill(child: Container(decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)))),
              Positioned(
                top: 0,
                bottom: 0,
                left: range[0] / max * w,
                width: (range[1] - range[0]) / max * w,
                child: Container(
                  decoration: BoxDecoration(color: a.green1, borderRadius: BorderRadius.circular(999), border: Border.all(color: a.green2, width: 1.5)),
                ),
              ),
              if (value != null)
                Positioned(
                  top: -3,
                  left: math.min(100, value! / max * 100) / 100 * w - 7,
                  child: Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(color: dot, shape: BoxShape.circle, border: Border.all(color: a.surface, width: 2)),
                  ),
                ),
            ]),
          );
        }),
      ),
      Text(
        '${bc('sleeptraining_meter_line', {'low': format(range[0]), 'high': format(range[1])})}'
        '${value != null ? ' · ${bc('sleeptraining_meter_yours', {'value': format(value!)})}' : ''}',
        style: context.aText.a3Meta,
      ),
    ]);
  }
}

class _Ranges extends StatelessWidget {
  const _Ranges({required this.summary, required this.band});
  final SleepSummary summary;
  final AgeBand band;
  @override
  Widget build(BuildContext context) {
    final n = bandNorms[band]!;
    return _Card(
      title: bc('sleeptraining_ranges_title'),
      subtitle: bc('sleeptraining_ranges_subtitle'),
      icon: AIcons.target,
      tone: 'lav',
      children: [
        Gap(gap: 12, children: [
          _Meter(label: bc('sleeptraining_sum_naps'), value: summary.avgNapsPerDay, range: n.naps, format: (x) => jsIsInteger(x) ? jsNumberToString(x) : x.toStringAsFixed(1)),
          _Meter(label: bc('sleeptraining_sum_nap_len'), value: summary.avgNapMinutes, range: n.napMinutes, format: _dur),
          _Meter(
              label: bc('sleeptraining_sum_night'),
              value: summary.avgLongestNightMinutes,
              range: [n.longestNightHours[0] * 60, n.longestNightHours[1] * 60],
              format: _dur),
          _Meter(label: bc('sleeptraining_sum_window'), value: summary.avgWakeWindowMinutes, range: n.wakeWindowMinutes, format: _dur),
        ]),
      ],
    );
  }
}

class _Insights extends StatelessWidget {
  const _Insights({required this.insights});
  final List<Insight> insights;
  @override
  Widget build(BuildContext context) => _Card(
        title: bc('sleeptraining_insights_title'),
        icon: AIcons.lightbulb,
        tone: 'yellow',
        children: [
          Gap(gap: 8, children: [
            for (final i in insights.take(3)) _Note(icon: _insights[i]!.icon, tone: _insights[i]!.tone, text: bc(_insights[i]!.key)),
          ]),
        ],
      );
}

// ── Plan ─────────────────────────────────────────────────────────────────────────────────────

class _Plan extends StatefulWidget {
  const _Plan({required this.state, required this.todayKey, required this.months, required this.onPick, required this.onToggleStep, required this.onRate, required this.onReset});
  final PlanState state;
  final String todayKey;
  final int months;
  final ValueChanged<String> onPick;
  final ValueChanged<String> onToggleStep;
  final void Function(int day, String? rating, bool clear) onRate;
  final VoidCallback onReset;
  @override
  State<_Plan> createState() => _PlanState();
}

class _PlanState extends State<_Plan> {
  bool _changing = false;
  bool _resetArmed = false;

  Future<void> _openRate(int day) async {
    final state = widget.state;
    final current = state.planDone[jsNumberToString(day)];
    await showASheet<void>(
      context,
      full: false,
      title: Text(bc('sleeptraining_plan_day', {'day': day})),
      builder: (sheet) {
        final a = sheet.a;
        return [
          Text(bc('sleeptraining_rate_question'), style: sheet.aText.a3Meta),
          const SizedBox(height: 12),
          Gap(gap: 12, children: [
            for (final r in ratings)
              Tap(
                key: ValueKey('rate-$r'),
                pressed: current == r,
                onTap: () {
                  widget.onRate(day, r, false);
                  Navigator.of(sheet).pop();
                },
                child: Builder(builder: (_) {
                  final c = stTone(a, _rateInfo[r]!.tone);
                  return Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: c.bg,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: current == r ? c.fg : const Color(0x00000000), width: 2),
                    ),
                    child: Row(children: [
                      AIcon(_rateInfo[r]!.icon, size: 22, color: c.fg),
                      const SizedBox(width: 12),
                      Text(bc('sleeptraining_rate_$r'), style: css(15, weight: FontWeight.w800, color: c.fg)),
                    ]),
                  );
                }),
              ),
            if (state.planDone.containsKey(jsNumberToString(day)))
              _LinkButton(
                key: const ValueKey('rate-clear'),
                icon: AIcons.undo2,
                label: bc('sleeptraining_rate_clear'),
                onTap: () {
                  widget.onRate(day, null, true);
                  Navigator.of(sheet).pop();
                },
              ),
          ]),
        ];
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final state = widget.state;
    final method = state.method;
    final today = state.planStartDate != null ? planDayNumber(state.planStartDate!, widget.todayKey) : 0;
    final progress = planProgress(state);
    final finished = today > planDays;

    if (method == null || _changing) {
      return _Card(
        title: bc('sleeptraining_plan_title'),
        subtitle: bc('sleeptraining_plan_intro'),
        icon: AIcons.target,
        tone: 'peach',
        children: [
          if (widget.months < 4) _Note(icon: AIcons.triangleAlert, tone: 'yellow', text: bc('sleeptraining_plan_young')),
          Grid(columns: 2, gap: 8, children: [
            for (final m in methods)
              Tap(
                key: ValueKey('method-$m'),
                pressed: method == m,
                onTap: () {
                  widget.onPick(m);
                  setState(() => _changing = false);
                },
                child: Builder(builder: (context) {
                  final info = _methodInfo[m]!;
                  final c = stTone(a, info.tone);
                  final on = method == m;
                  return Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: on ? c.bg : a.surfaceSoft,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: on ? c.fg : const Color(0x00000000), width: 2),
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _Ico(info.icon, tone: info.tone, size: 34),
                      const SizedBox(height: 8),
                      Text(bc('sleeptraining_method_$m'), style: css(13.5, weight: FontWeight.w700, color: a.ink)),
                      const SizedBox(height: 8),
                      Text(bc('sleeptraining_method_${m}_desc'), style: context.aText.a3Meta.copyWith(fontSize: 12, height: 1.4)),
                    ]),
                  );
                }),
              ),
          ]),
          if (_changing) _LinkButton(icon: AIcons.undo2, label: bc('sleeptraining_plan_keep'), onTap: () => setState(() => _changing = false)),
        ],
      );
    }

    final info = _methodInfo[method]!;
    return Gap(gap: 12, children: [
      _Card(
        title: bc('sleeptraining_method_$method'),
        subtitle: bc('sleeptraining_method_${method}_desc'),
        icon: info.icon,
        tone: info.tone,
        children: [
          Row(children: [
            _ProgressCircle(value: progress.completed, total: planDays, size: 72),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(bc('sleeptraining_plan_progress', {'done': progress.completed, 'total': planDays}), style: css(14.5, weight: FontWeight.w600, color: a.ink)),
                Text(finished ? bc('sleeptraining_plan_finished') : today >= 1 ? bc('sleeptraining_plan_today', {'day': today}) : '', style: context.aText.a3Meta),
              ]),
            ),
          ]),
          WrapRow(gap: 4, children: [
            _LinkButton(key: const ValueKey('plan-change'), icon: AIcons.undo2, label: bc('sleeptraining_plan_change'), onTap: () => setState(() => _changing = true)),
            _LinkButton(
              key: const ValueKey('plan-reset'),
              icon: AIcons.rotateCcw,
              tone: _resetArmed ? 'pink' : 'neutral',
              label: _resetArmed ? bc('sleeptraining_plan_reset_sure') : bc('sleeptraining_plan_reset'),
              onTap: () {
                if (_resetArmed) {
                  setState(() => _resetArmed = false);
                  widget.onReset();
                } else {
                  setState(() => _resetArmed = true);
                }
              },
            ),
          ]),
        ],
      ),
      _Card(
        title: bc('sleeptraining_steps_title'),
        subtitle: bc('sleeptraining_steps_subtitle'),
        icon: AIcons.listChecks,
        tone: 'lav',
        children: [
          Gap(gap: 8, children: [
            for (final s in methodSteps[method]!)
              _CheckRow(key: ValueKey('plan-step-$s'), on: state.stepsDone.contains(s), label: bc('sleeptraining_$s'), onTap: () => widget.onToggleStep(s)),
          ]),
        ],
      ),
      _Card(
        title: bc('sleeptraining_calendar_title'),
        subtitle: bc('sleeptraining_calendar_subtitle'),
        icon: AIcons.calendar,
        tone: 'green',
        children: [
          Grid(columns: 7, gap: 6, children: [
            for (var d = 1; d <= planDays; d++) _day(context, d, today),
          ]),
          WrapRow(gap: 12, children: [
            for (final r in ratings) _Pill(bc('sleeptraining_rate_$r'), tone: _rateInfo[r]!.tone, icon: _rateInfo[r]!.icon),
          ]),
          Text(bc('sleeptraining_plan_stop_note'), style: context.aText.a3Meta),
        ],
      ),
    ]);
  }

  Widget _day(BuildContext context, int d, int today) {
    final a = context.a;
    final key = '$d';
    final marked = widget.state.planDone.containsKey(key);
    final rating = widget.state.planDone[key];
    final tone = rating != null ? _rateInfo[rating]!.tone : marked ? 'lav' : 'neutral';
    final c = stTone(a, tone);
    final label = bc('sleeptraining_plan_day', {'day': d});
    final disabled = d > today;
    return Tap(
      key: ValueKey('plan-day-$d'),
      label: rating != null ? '$label · ${bc('sleeptraining_rate_$rating')}' : label,
      enabled: !disabled,
      excludeSemantics: true,
      onTap: () => unawaited(_openRate(d)),
      child: Opacity(
        opacity: disabled ? 0.6 : 1,
        child: AspectRatio(
          aspectRatio: 1,
          child: Container(
            decoration: BoxDecoration(
              color: marked ? c.bg : a.surfaceSoft,
              borderRadius: BorderRadius.circular(14),
              border: d == today ? Border.all(color: a.coralStrong, width: 2) : null,
            ),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('$d', style: css(13, weight: FontWeight.w700, color: marked ? c.fg : a.inkSoft)),
              SizedBox(
                height: 14,
                child: marked ? AIcon(rating != null ? _rateInfo[rating]!.icon : AIcons.check, size: 14, strokeWidth: 2.4, color: c.fg) : null,
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

// ── Safety ───────────────────────────────────────────────────────────────────────────────────

class _Safety extends ConsumerWidget {
  const _Safety({required this.done, required this.emergency, required this.onToggle});
  final List<String> done;
  final String emergency;
  final ValueChanged<String> onToggle;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final count = safetyItems.where(done.contains).length, complete = count == safetyItems.length;
    return Gap(gap: 12, children: [
      _Card(
        title: bc('sleeptraining_safety_title'),
        subtitle: bc('sleeptraining_safety_subtitle'),
        icon: AIcons.shieldCheck,
        tone: 'green',
        children: [
          Row(children: [
            _ProgressCircle(value: count, total: safetyItems.length),
            const SizedBox(width: 14),
            Expanded(child: Text(complete ? bc('sleeptraining_safety_done') : bc('sleeptraining_safety_hint'), style: context.aText.a3Meta)),
          ]),
          Gap(gap: 8, children: [
            for (final s in safetyItems) _CheckRow(key: ValueKey('safety-$s'), on: done.contains(s), label: bc('sleeptraining_safe_$s'), onTap: () => onToggle(s)),
          ]),
        ],
      ),
      _Card(
        title: bc('sleeptraining_warning_title'),
        icon: AIcons.triangleAlert,
        tone: 'pink',
        children: [
          Gap(gap: 8, children: [for (final k in _warnings) _Note(icon: AIcons.triangleAlert, tone: 'pink', text: bc(k))]),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(18)),
            child: Row(children: [
              const _Ico(AIcons.phone, tone: 'pink'),
              const SizedBox(width: 12),
              Expanded(child: Text(bc('sleeptraining_emergency_line', {'number': emergency}), style: css(14.5, weight: FontWeight.w600, color: a.ink))),
              const SizedBox(width: 12),
              AButton(
                key: const ValueKey('sleep-emergency-call'),
                variant: AButtonVariant.accent,
                size: AButtonSize.sm,
                onPressed: () => unawaited(ref.read(safetyCallLauncherProvider)(Uri(scheme: 'tel', path: emergency))),
                child: Text(bc('sleeptraining_emergency_call')),
              ),
            ]),
          ),
        ],
      ),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.info, size: 14, color: a.inkSoft)),
        const SizedBox(width: 8),
        Expanded(child: Text(bc('sleeptraining_disclaimer'), style: css(12, color: a.inkSoft))),
      ]),
    ]);
  }
}

// ── Screen ───────────────────────────────────────────────────────────────────────────────────

class SleepTraining extends ConsumerStatefulWidget {
  const SleepTraining({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<SleepTraining> createState() => _SleepTrainingState();
}

class _SleepTrainingState extends ConsumerState<SleepTraining> {
  SleepTrainingPlanController? _plan;
  String _tab = 'today';
  bool _busy = false;
  bool _lock = false;
  DateTime _now = DomainClock.now();
  Timer? _tick;
  String? _widgetAction;

  @override
  void initState() {
    super.initState();
    _widgetAction = ref.read(widgetActionStoreProvider).consume();
    _tick = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() => _now = DomainClock.now());
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    _plan?.dispose();
    super.dispose();
  }

  SleepTrainingPlanController _controller(String? userId, String? childId) {
    final cur = _plan;
    if (cur != null && cur.userId == userId && cur.childId == childId) return cur;
    cur?.dispose();
    final next = SleepTrainingPlanController(
      store: ref.read(localStoreProvider),
      remote: ref.read(sleepPlanRemoteProvider),
      userId: userId,
      childId: childId,
      connectivity: ref.read(connectivitySourceProvider),
    )..addListener(() {
        if (mounted) setState(() {});
      });
    _plan = next;
    // A "Sleep" tap on the home-screen widget starts the sleep timer right away.
    if (_widgetAction == 'sleep') {
      _widgetAction = null;
      if (next.state.pendingSleepStart == null) next.update((s) => setPendingSleep(s, jsToIsoString(DomainClock.now())));
    }
    return next;
  }

  void _toast(String title, {bool destructive = false}) {
    if (!mounted) return;
    AToastHost.of(context).show(title: title, destructive: destructive);
  }

  Future<bool> _guarded(Future<bool> Function() fn) async {
    if (_lock) return false;
    _lock = true;
    setState(() => _busy = true);
    try {
      return await fn();
    } finally {
      _lock = false;
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _save(ProgrammeChild? child, DateTime start, DateTime end) async {
    if (child == null) {
      _toast(bc('sleeptraining_no_child'), destructive: true);
      return false;
    }
    final error = await ref.read(sleepTrainingLogActionsProvider).addSleep(start, end);
    if (error != null) {
      _toast(bc('sleeptraining_save_failed'), destructive: true);
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final inputs = ref.watch(programmeInputsProvider);
    final child = inputs.child;
    final plan = _controller(inputs.userId, child?.id);
    final logs = ref.watch(sleepTrainingLogsProvider);
    final now = _now;
    final todayKey = localDateKey(now);
    final state = plan.state;
    final header = ToolHeader(onBack: widget.onBack, eyebrow: bc('sleeptraining_eyebrow'), title: bc('sleeptraining_title'));

    if (!plan.loaded) return ToolPage(child: header);
    final birth = child?.birthDate != null ? jsParseDate(child!.birthDate!) : null;
    if (child == null || birth == null) {
      return ToolPage(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          header,
          ToolEmpty(icon: const Text('🌙'), title: bc('sleeptraining_title'), text: bc('sleeptraining_no_birthdate')),
        ]),
      );
    }
    final months = monthsOld(birth, now);
    final band = ageBand(months);
    if (band == null) {
      return ToolPage(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          header,
          ToolEmpty(icon: const Text('🌙'), title: bc('sleeptraining_age_label', {'months': months}), text: bc('sleeptraining_out_of_range')),
        ]),
      );
    }
    final schedule = buildSchedule(wakeTime: state.wakeTime, band: band);
    final entries = sleepEntries(logs);
    final status = scheduleStatus(schedule, now);
    final week = sleepDays(entries, now, 7);
    final todayDay = week.last;
    final summary = sleepSummary(sessions: entries, band: band, now: now);
    final sleepingSince = state.pendingSleepStart != null ? jsParseDate(state.pendingSleepStart!) : null;
    final nightWakes = state.nightWakes[nightKey(now)] ?? 0;
    final profileCc = inputs.profileCountryCode;
    final emergency = getEmergencyNumber(profileCc != null && profileCc.isNotEmpty ? profileCc : child.countryCode);
    final wakeClock = parseClock(state.wakeTime);
    final morningWake = wakeClock == null ? null : DateTime(now.year, now.month, now.day, wakeClock ~/ 60, wakeClock % 60);
    final predicted = predictNextNap(entries: entries, band: band, now: now, sleepingSince: sleepingSince, morningWake: morningWake);

    final todaySummary = todayDay.totalMinutes > 0 ? bc('sleeptraining_today_summary', {'time': _dur(todayDay.totalMinutes)}) : bc('sleeptraining_today_none');
    String napOrBed(bool bed) => bed ? bc('sleeptraining_block_bedtime') : bc('sleeptraining_block_nap');
    final ({bool sleeping, String title, String detail}) hero;
    if (sleepingSince != null) {
      hero = (sleeping: true, title: bc('sleeptraining_hero_sleeping'), detail: bc('sleeptraining_live_since', {'time': _clockOf(sleepingSince)}));
    } else if (predicted.windowStart != null && predicted.minutesToStart != null) {
      hero = predicted.minutesToStart! > 0
          ? (
              sleeping: false,
              title: bc('sleeptraining_hero_next', {'label': napOrBed(predicted.isBedtime)}),
              detail: bc('sleeptraining_hero_in', {'time': _dur(predicted.minutesToStart!), 'clock': _clockOf(predicted.windowStart!)}),
            )
          : (
              sleeping: false,
              title: bc('sleeptraining_hero_now', {'label': napOrBed(predicted.isBedtime)}),
              detail: bc('sleeptraining_hero_until', {'time': _clockOf(predicted.windowEnd ?? predicted.windowStart!)}),
            );
    } else if (status.currentIndex != null) {
      hero = (
        sleeping: false,
        title: bc('sleeptraining_hero_now', {'label': _blockLabel(schedule[status.currentIndex!], status.currentIndex!)}),
        detail: bc('sleeptraining_hero_until', {'time': schedule[status.currentIndex!].end}),
      );
    } else if (status.nextIndex != null && status.minutesToNext != null) {
      hero = (
        sleeping: false,
        title: bc('sleeptraining_hero_next', {'label': _blockLabel(schedule[status.nextIndex!], status.nextIndex!)}),
        detail: bc('sleeptraining_hero_in', {'time': _dur(status.minutesToNext!), 'clock': schedule[status.nextIndex!].start}),
      );
    } else {
      hero = (sleeping: false, title: bc('sleeptraining_hero_idle'), detail: bc('sleeptraining_hero_idle_detail'));
    }

    void startSleep() {
      unawaited(ref.read(programmeHapticProvider)());
      plan.update((s) => setPendingSleep(s, jsToIsoString(DomainClock.now())));
    }

    void discard() {
      plan.update((s) => setPendingSleep(s, null));
      _toast(bc('sleeptraining_discarded'));
    }

    void stopSleep() => unawaited(_guarded(() async {
          if (sleepingSince == null) return false;
          final end = DomainClock.now();
          final minutes = jsRoundInt((end.millisecondsSinceEpoch - sleepingSince.millisecondsSinceEpoch) / 60000);
          if (minutes < minSleepMinutes) {
            plan.update((s) => setPendingSleep(s, null));
            _toast(bc('sleeptraining_too_short'));
            return false;
          }
          if (minutes > maxSleepMinutes) {
            _toast(bc('sleeptraining_too_long'), destructive: true);
            return false;
          }
          if (!await _save(child, sleepingSince, end)) return false;
          plan.update((s) => setPendingSleep(s, null));
          unawaited(ref.read(programmeHapticProvider)());
          _toast(bc('sleeptraining_saved', {'time': _dur(minutes)}));
          return true;
        }));

    Future<bool> savePast(String day, String startText, String endText) => _guarded(() async {
          final s = parseClock(startText), e = parseClock(endText);
          if (s == null || e == null) {
            _toast(bc('sleeptraining_manual_invalid'), destructive: true);
            return false;
          }
          final base = dayOffset(DomainClock.now(), day == 'today' ? 0 : -1);
          final start = DateTime(base.year, base.month, base.day, s ~/ 60, s % 60);
          final end = DateTime(base.year, base.month, base.day + (e <= s ? 1 : 0), e ~/ 60, e % 60);
          if (end.millisecondsSinceEpoch > DomainClock.nowMs()) {
            _toast(bc('sleeptraining_manual_future'), destructive: true);
            return false;
          }
          final minutes = jsRoundInt((end.millisecondsSinceEpoch - start.millisecondsSinceEpoch) / 60000);
          if (minutes < minSleepMinutes || minutes > maxSleepMinutes) {
            _toast(bc('sleeptraining_manual_length'), destructive: true);
            return false;
          }
          if (!await _save(child, start, end)) return false;
          _toast(bc('sleeptraining_saved', {'time': _dur(minutes)}));
          return true;
        });

    Future<void> removeSleep(String id) async {
      final error = await ref.read(sleepTrainingLogActionsProvider).delete(id);
      _toast(error != null ? bc('sleeptraining_delete_failed') : bc('sleeptraining_deleted'), destructive: error != null);
    }

    final a = context.a;
    final heroBox = Container(
      key: const ValueKey('sleep-hero'),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(a.radiusXl)),
      child: Stack(children: [
        // `.st-hero::before`
        Positioned.directional(
          textDirection: Directionality.of(context),
          end: -34,
          top: -34,
          child: Opacity(opacity: 0.28, child: Container(width: 130, height: 130, decoration: BoxDecoration(color: a.lav2, shape: BoxShape.circle))),
        ),
        Padding(
          padding: const EdgeInsets.all(18),
          child: Gap(gap: 14, children: [
            Row(children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16)),
                child: AIcon(AIcons.moonStar, size: 24, strokeWidth: 2.1, color: a.lavInk),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(bc(_bandKey[band]!).toUpperCase(), style: context.aText.a3Eyebrow),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(bc('sleeptraining_age_label', {'months': months}), style: css(20, weight: FontWeight.w700, height: 1.2, color: a.ink)),
                  ),
                ]),
              ),
            ]),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18)),
              child: Row(children: [
                Container(
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: stTone(a, hero.sleeping ? 'blue' : 'yellow').bg, borderRadius: BorderRadius.circular(12)),
                  child: AIcon(hero.sleeping ? AIcons.moon : AIcons.sun, size: 18, color: stTone(a, hero.sleeping ? 'blue' : 'yellow').fg),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(hero.title, style: css(14.5, weight: FontWeight.w600, color: a.ink)),
                    Text(hero.detail, style: context.aText.a3Meta),
                  ]),
                ),
              ]),
            ),
            Row(children: [
              AIcon(AIcons.activity, size: 14, color: a.lavInk),
              const SizedBox(width: 6),
              Flexible(child: Text(todaySummary, style: css(12.5, weight: FontWeight.w700, color: a.lavInk))),
            ]),
          ]),
        ),
      ]),
    );

    final body = <Widget>[
      heroBox,
      ASegmentedTabs<String>(
        items: [for (final t in const ['today', 'week', 'plan', 'safety']) ASegmentItem(t, bc('sleeptraining_tab_$t'))],
        selected: _tab,
        onChanged: (t) => setState(() => _tab = t),
      ),
      if (_tab == 'today') ...[
        NextNapSection(
          entries: entries,
          band: band,
          now: now,
          birth: birth,
          childName: child.name ?? '',
          sleepingSince: sleepingSince,
          morningWake: morningWake,
          busy: _busy,
          onStartSleep: startSleep,
        ),
        _LiveSleep(
          sleepingSince: sleepingSince,
          nightWakes: nightWakes,
          busy: _busy,
          todaySummary: todaySummary,
          onStart: startSleep,
          onStop: stopSleep,
          onDiscard: discard,
          onNightWake: (d) => plan.update((s) => adjustNightWakes(s, nightKey(DomainClock.now()), d)),
        ),
        _DayTimeline(
          schedule: schedule,
          wakeTime: state.wakeTime,
          now: now,
          onShiftWake: (d) => plan.update((s) => setWake(s, shiftWake(s.wakeTime, d))),
          onPickWake: (v) => plan.update((s) => setWake(s, v)),
        ),
        _Routine(
          done: state.routineDone[todayKey] ?? const [],
          streak: routineStreak(state.routineDone, todayKey),
          onToggle: (st) => plan.update((s) => toggleRoutine(s, localDateKey(DomainClock.now()), st)),
        ),
        _PastSleep(busy: _busy, onSave: savePast),
      ],
      if (_tab == 'week') ...[
        _WeekChart(days: week, band: band, language: inputs.language, onDelete: (id) => unawaited(removeSleep(id))),
        _Averages(summary: summary, nightWakeAvg: averageNightWakes(state.nightWakes, todayKey)),
        _Ranges(summary: summary, band: band),
        _Insights(insights: summary.insights),
      ],
      if (_tab == 'plan')
        _Plan(
          state: state,
          todayKey: todayKey,
          months: months,
          onPick: (m) => plan.update((s) => pickMethod(s, m, localDateKey(DomainClock.now()))),
          onToggleStep: (st) => plan.update((s) => toggleStep(s, st)),
          onRate: (d, r, clear) => plan.update((s) => ratePlanDay(s, d, r, clear)),
          onReset: () => plan.update(resetPlan),
        ),
      if (_tab == 'safety') _Safety(done: state.safetyDone, emergency: emergency, onToggle: (it) => plan.update((s) => toggleSafety(s, it))),
      // The safety tab already has its own call row; the other tabs get the one-line strip.
      if (_tab != 'safety') SafetyStrip(signs: tr('safety_sleep_signs', 'Zəng edin: nəfəs dayanması, göyərmiş dodaqlar, hərarət, qeyri-adi yuxululuq')),
    ];
    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        header,
        Padding(padding: const EdgeInsets.only(top: 14), child: Gap(gap: 12, children: body)),
      ]),
    );
  }
}

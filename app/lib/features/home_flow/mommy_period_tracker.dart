// Ported from: src/components/mommy/MommyPeriodTracker.tsx (MommyPeriodBanner, MommyCycleCard, MommyPhaseTips,
//              MommyPeriodTracker = screen `mommy-period`)
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/cycle/period_flow.dart';
import '../../domain/js_compat.dart' show parseIsoDateFns;
import '../../state/state.dart';
import 'copy/flow_copy.dart';
import 'data/flow_hooks.dart';
import 'data/phase_info.dart';
import 'flow_daily_logger.dart';
import 'flow_period_calendar.dart';
import 'flow_platform.dart';
import 'logic/mommy_period.dart';
import 'symptom_pattern_report.dart';
import 'widgets/flow_common.dart';
import 'widgets/flow_ui.dart';

String _endedKey(String userId) => 'anacan.mommyPeriod.endedOn.$userId';

/// Mommy home card: an invitation before anything is recorded; afterwards a minimal tracker (status, last 14 days
/// with tap-to-toggle, started / still on / ended). [onOpen] opens the full screen (`mommy-period`).
class MommyPeriodBanner extends ConsumerStatefulWidget {
  const MommyPeriodBanner({super.key, required this.onOpen});
  final VoidCallback onOpen;
  @override
  ConsumerState<MommyPeriodBanner> createState() => _MommyPeriodBannerState();
}

class _MommyPeriodBannerState extends ConsumerState<MommyPeriodBanner> {
  String? _endedOn;
  String? _endedFor;

  String? _readEnded(String? uid) {
    if (uid == null) return null;
    try {
      return ref.read(localStoreProvider).getItem(_endedKey(uid));
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final uid = ref.watch(flowUserIdProvider);
    if (_endedFor != uid) {
      _endedFor = uid;
      _endedOn = _readEnded(uid);
    }
    final profile = ref.watch(flowProfileRowProvider);
    final logs = ref.watch(periodDayLogsQuery(null)).data ?? const <Map<String, dynamic>>[];
    final pending = ref.watch(recordPeriodDaysMutation).isPending;
    final birth = profile?['baby_birth_date'] as String?;
    final since = birth != null && birth.length >= 10 ? birth.substring(0, 10) : (birth?.isNotEmpty == true ? birth : null);
    final flowDays = [
      for (final r in logs)
        if ((since == null || (r['log_date'] as String).compareTo(since) >= 0) && hasPeriodFlow(r['flow_intensity'])) r['log_date'] as String
    ];
    final today = ymd(flowNow());
    final status = mommyPeriodStatus(flowDays, today, _endedOn);
    String t(String key) => feature37Text(key, language);
    final toast = flowToast(context);

    void save(PeriodWrite input, [String? ended]) {
      ref.read(recordPeriodDaysMutation.notifier).mutate(input, onSuccess: (_, _, _) {
        if (ended != null && uid != null) {
          try {
            ref.read(localStoreProvider).setItem(_endedKey(uid), ended);
          } catch (_) {/* device-only marker */}
          if (mounted) setState(() => _endedOn = ended);
        }
        toast?.success(t('period_saved'));
      }, onError: (_, _, _) => toast?.error(t('period_failed')));
    }

    void logToday() => save(PeriodWrite(dates: [today], flow: 'unspecified', preserveExisting: true));
    void endOn(String last) {
      final start = parseIsoDateFns(status.start!)!;
      final end = parseIsoDateFns(last)!;
      final days = <DateTime>[];
      for (var d = start; !d.isAfter(end); d = DateTime(d.year, d.month, d.day + 1)) {
        days.add(d);
      }
      save(PeriodWrite(dates: days, flow: 'unspecified', complete: true, preserveExisting: true), last);
    }

    void toggleDay(String day) {
      if (since != null && day.compareTo(since) < 0) return;
      save(PeriodWrite(dates: [day], flow: flowDays.contains(day) ? 'clear' : 'unspecified'));
    }

    Widget pill(String label, {required bool solid, required VoidCallback? onTap}) => Expanded(
          child: AButton(
            variant: solid ? AButtonVariant.pillSolid : AButtonVariant.pillSoft,
            block: true,
            onPressed: onTap,
            child: Text(label),
          ),
        );

    if (status.state == 'none') {
      return Container(
        key: const ValueKey('mommy-period-banner'),
        margin: const EdgeInsets.symmetric(vertical: 16),
        child: ACard(
          color: a.pink1,
          child: Row(children: [
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: widget.onOpen,
                child: Row(children: [
                  AListIcon(background: const Color(0x00000000), child: const AIcon(AIcons.calendarDays, size: 22)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(t('period_banner_title'), style: x.aListTitle),
                      Padding(padding: const EdgeInsets.only(top: 2), child: Text(t('period_banner_body'), style: x.aListSub)),
                    ]),
                  ),
                ]),
              ),
            ),
            const SizedBox(width: 12),
            AButton(variant: AButtonVariant.pillSoft, onPressed: pending ? null : logToday, child: Text(t('period_start'))),
          ]),
        ),
      );
    }

    final ongoing = status.state == 'today' || status.state == 'askToday';
    final strip = recentDays(today);
    return Container(
      key: const ValueKey('mommy-period-card'),
      margin: const EdgeInsets.symmetric(vertical: 16),
      child: ACard(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(gradient: a.gradPink, borderRadius: BorderRadius.circular(13)),
              child: AIcon(AIcons.droplets, size: 17, color: a.berryInk),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t('period_card_title'), style: x.aListTitle),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    ongoing
                        ? t('period_day_n').replaceFirst('{n}', '${status.dayNumber}')
                        : t('period_last_short').replaceFirst('{date}', flowFormat(parseIsoDateFns(status.lastDay!)!, 'd MMM')),
                    style: x.aListSub,
                  ),
                ),
              ]),
            ),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: widget.onOpen,
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(t('period_calendar'), style: x.aSectionLink),
                const SizedBox(width: 4),
                AIcon(AIcons.chevronRight, size: 13, color: a.onBgSoft, mirrorInRtl: true),
              ]),
            ),
          ]),
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Semantics(
              container: true,
              label: t('period_card_title'),
              child: Row(children: [
                for (final (i, day) in strip.indexed) ...[
                  if (i > 0) const SizedBox(width: 3),
                  Expanded(child: _StripDay(
                    key: ValueKey('strip-$day'),
                    day: day,
                    on: flowDays.contains(day),
                    today: day == today,
                    disabled: (since != null && day.compareTo(since) < 0) || pending,
                    onTap: () => toggleDay(day),
                  )),
                ],
              ]),
            ),
          ),
          if (status.state == 'askToday') Padding(padding: const EdgeInsets.only(top: 10), child: Text(t('period_ask_today'), style: x.aListSub)),
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Row(children: [
              if (status.state == 'idle') pill(t('period_start'), solid: false, onTap: pending ? null : logToday),
              if (status.state == 'askToday') ...[
                pill(t('period_continue'), solid: false, onTap: pending ? null : logToday),
                const SizedBox(width: 8),
                pill(t('period_end'), solid: true, onTap: pending ? null : () => endOn(status.lastDay!)),
              ],
              if (status.state == 'today') pill(t('period_end'), solid: true, onTap: pending ? null : () => endOn(today)),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// `.a-period-day` (+ `.on` #ef4b6c, `.today` ink border, `:disabled` 0.35).
class _StripDay extends StatelessWidget {
  const _StripDay({super.key, required this.day, required this.on, required this.today, required this.disabled, required this.onTap});
  final String day;
  final bool on;
  final bool today;
  final bool disabled;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final d = parseIsoDateFns(day)!;
    return Semantics(
      button: true,
      toggled: on,
      enabled: !disabled,
      label: flowFormat(d, 'd MMMM'),
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: disabled ? null : onTap,
        child: Opacity(
          opacity: disabled ? 0.35 : 1,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 26),
              child: AspectRatio(
                aspectRatio: 1,
                child: Container(
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: on ? const Color(0xFFEF4B6C) : a.surfaceSoft, // anacan-design.css .a-period-day.on
                    border: Border.all(color: today ? a.ink : const Color(0x00000000), width: 1.5),
                  ),
                  child: Text('${d.day}', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, height: 1, color: on ? TwColors.white : a.inkSoft)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Period-module style overview inside the Mommy period screen.
class _MommyCycleCard extends StatelessWidget {
  const _MommyCycleCard({required this.insights, required this.language});
  final MommyCycleInsights insights;
  final String language;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    String t(String k) => feature37Text(k, language);
    String date(String d) => flowFormat(parseIsoDateFns(d)!, 'd MMM');
    final pct = (insights.cycleDay / insights.cycleLength * 100).round().clamp(0, 100);
    final anomalies = insights.cycles.where((c) => c.anomalous).length;
    return ACard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ACardHead(title: t('cycle_now'), trailing: Text(t('next_period').replaceFirst('{date}', date(insights.nextPeriod)), style: x.aListSub)),
        Row(children: [
          AConicRing(percent: pct.toDouble(), value: '${insights.cycleDay}', label: t('cycle_day'), fillColor: a.coral),
          const SizedBox(width: 16),
          Expanded(
            child: IntrinsicHeight(
              child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                for (final (i, v) in [
                  ('${insights.daysUntilNext < 0 ? 0 : insights.daysUntilNext}', t('days_left')),
                  ('${insights.cycleLength}', t('cycle_days')),
                  ('${insights.periodLength}', t('period_days_short')),
                ].indexed) ...[
                  if (i > 0) const SizedBox(width: 6),
                  Expanded(child: ATrioItem(value: v.$1, label: v.$2, padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4))),
                ],
              ]),
            ),
          ),
        ]),
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(
            insights.learned
                ? t('forecast_learned').replaceFirst('{n}', '${insights.cycles.where((c) => !c.anomalous).take(6).length}')
                : t('forecast_default'),
            style: x.aListSub,
          ),
        ),
        if (anomalies > 0)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(t('cycle_anomaly_note').replaceFirst('{n}', '$anomalies'), style: x.aListSub.copyWith(color: a.warnInk)),
          ),
        if (insights.cycles.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(padding: const EdgeInsets.only(bottom: 4), child: aTodayInfoEyebrow(context, t('recent_cycles'))),
              for (final (i, c) in insights.cycles.take(3).indexed)
                ARankRow(first: i == 0, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(date(c.start), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: a.ink)),
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(t('cycle_len').replaceFirst('{n}', '${c.length}'), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: a.inkSoft)),
                      ),
                    ]),
                  ),
                  if (c.anomalous) ARankTag(text: t('cycle_anomaly_badge'), background: a.yellow1, color: a.warnInk),
                ]),
            ]),
          ),
        Padding(padding: const EdgeInsets.only(top: 10), child: Text(t('postpartum_note'), style: x.aListSub)),
      ]),
    );
  }
}

/// The Period module's "tips for this phase", for the phase of the postpartum cycle.
class _MommyPhaseTips extends ConsumerWidget {
  const _MommyPhaseTips({required this.phase});
  final String phase;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final x = context.aText;
    final tips = ref.watch(phaseTipsQuery(phase)).data ?? const [];
    final info = kPhaseInfo[phase]!;
    if (tips.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      ASectionHead(
        title: tr('flowdashboard_bu_faza_ucun_meslehetler_14b952', 'Bu Faza Üçün Məsləhətlər'),
        trailing: ATag(
          borderless: true,
          background: info.color.withValues(alpha: 0x22 / 255),
          color: info.color,
          weight: FontWeight.w700,
          child: Text('${info.emoji} ${info.labelAz}'),
        ),
      ),
      for (final (i, tip) in tips.take(4).indexed) ...[
        if (i > 0) const SizedBox(height: 10),
        ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              AListIcon(background: a.surfaceSoft, child: Text('${tip['emoji'] ?? ''}', style: const TextStyle(fontSize: 18))),
              const SizedBox(width: 13),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${tip['title'] ?? ''}', style: x.aListTitle),
                  Text(kCategoryInfo[tip['category']]?.labelAz ?? '', style: x.aListValue.copyWith(color: info.color)),
                ]),
              ),
            ]),
            Padding(padding: const EdgeInsets.only(top: 10), child: Text('${tip['content'] ?? ''}', style: TextStyle(fontSize: 12, height: 1.55, color: a.inkSoft))),
          ]),
        ),
      ],
    ]);
  }
}

/// The flow period tracker as the Mommy stage embeds it (screen `mommy-period`). Scrolls itself (sub-screen).
class PeriodTrackerView extends ConsumerWidget {
  const PeriodTrackerView({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final x = context.aText;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final profile = ref.watch(flowProfileRowProvider);
    final logs = ref.watch(periodDayLogsQuery(null)).data ?? const <Map<String, dynamic>>[];
    final gate = ref.watch(flowPremiumGateProvider);
    final birth = profile?['baby_birth_date'] as String?;
    final since = birth == null || birth.isEmpty ? null : (birth.length >= 10 ? birth.substring(0, 10) : birth);
    final observed = [
      for (final r in logs)
        if ((since == null || (r['log_date'] as String).compareTo(since) >= 0) && hasPeriodFlow(r['flow_intensity'])) r['log_date'] as String
    ];
    final latest = observed.isEmpty ? null : (observed.toList()..sort()).last;
    final now = flowNow();
    final insights = mommyCycleInsights(observed, ymd(now));
    String t(String k) => feature37Text(k, language);
    final children = <Widget>[
      Padding(
        padding: const EdgeInsets.fromLTRB(0, 16, 0, 6),
        child: Row(children: [
          AIconSquareButton(semanticLabel: t('back_mommy'), onTap: onBack, icon: const AIcon(AIcons.arrowLeft, size: 18, mirrorInRtl: true)),
          const SizedBox(width: 8),
          Expanded(child: Text(t('period_title'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: -0.16, color: a.onBg))),
        ]),
      ),
      Text(t('period_body'), style: x.aListSub),
      FlowPeriodCalendar(trackingOnly: true, fromDate: since),
      if (insights != null)
        _MommyCycleCard(insights: insights, language: language)
      else
        ACard(
          child: Row(children: [
            const AIcon(AIcons.droplets, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${t('period_days')}: ${observed.length}', style: x.aListTitle),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(latest != null ? '${t('period_last')}: $latest' : t('period_empty'), style: x.aListSub),
                ),
              ]),
            ),
          ]),
        ),
      if (insights != null) _MommyPhaseTips(phase: phaseForCycleDay(insights.cycleDay, insights.cycleLength, insights.periodLength)),
      gate(context,
          title: tr('flowdailylogger_gundelik_qeyd_32e154', 'Gündəlik Qeyd'),
          description: tr('pgate_flow_logger', 'Əhval, simptom, qanaxma və fertillik qeydləri — proqnozlar bunlarla dəqiqləşir'),
          emoji: '📝',
          feature: 'flow_daily_logger',
          child: const FlowDailyLogger(compact: true)),
      if (insights != null)
        gate(context,
            title: tr('pgate_symptom_title', 'Simptom analizi'),
            description: tr('pgate_symptom', 'Fazalara görə simptom nümunələriniz'),
            emoji: '🧠',
            feature: 'flow_symptom_report',
            child: SymptomPatternReport(
              anchor: SymptomAnchor(
                lastPeriodDate: DateTime(now.year, now.month, now.day - (insights.cycleDay - 1), now.hour, now.minute),
                cycleLength: insights.cycleLength,
                periodLength: insights.periodLength,
              ),
            )),
      Text(t('period_tracking_note'), style: x.aListSub),
    ];
    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 96), // .a-shell, pb-24
          children: [
            for (final (i, c) in children.indexed) ...[if (i > 0) const SizedBox(height: 16), c],
          ],
        ),
      ),
    );
  }
}

/// `MommyPeriodTracker({ onBack })` (default export).
typedef MommyPeriodTracker = PeriodTrackerView;


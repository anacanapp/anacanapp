// Ported from: src/components/flow/FlowDashboard.tsx
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/cycle/cycle_predictions.dart' as cp;
import '../../domain/cycle/cycle_utils.dart';
import '../../domain/cycle/period_flow.dart';
import '../../domain/dates/local_date.dart' show storedCalendarDate;
import '../../domain/js_compat.dart' show differenceInCalendarDays, jsRoundInt, parseIsoDateFns, startOfDay;
import '../../state/user_store.dart';
import '../ttc/ttc_section.dart';
import 'cycle_anomaly_banner.dart';
import 'cycle_trend_chart.dart';
import 'daily_story_cards.dart';
import 'data/flow_hooks.dart';
import 'data/phase_info.dart';
import 'flow_cycle_stats.dart';
import 'flow_daily_logger.dart';
import 'flow_mood_chart.dart';
import 'flow_period_calendar.dart';
import 'flow_platform.dart';
import 'flow_reminders_card.dart';
import 'period_delay_banner.dart';
import 'pill_reminder_card.dart';
import 'symptom_pattern_report.dart';
import 'widgets/flow_common.dart';
import 'widgets/flow_ui.dart';

/// date-fns `differenceInDays(left, right)`: whole days, the last partial day not counted.
int differenceInDaysFns(DateTime left, DateTime right) {
  int cmp(DateTime a, DateTime b) => a.isBefore(b) ? -1 : (a.isAfter(b) ? 1 : 0);
  final sign = cmp(left, right);
  final diff = differenceInCalendarDays(left, right).abs();
  final moved = DateTime(left.year, left.month, left.day - sign * diff, left.hour, left.minute, left.second, left.millisecond);
  final notFull = cmp(moved, right) == -sign ? 1 : 0;
  final r = sign * (diff - notFull);
  return r == 0 ? 0 : r;
}

const _categories = ['all', 'nutrition', 'exercise', 'selfcare', 'mood'];
const _categoryIcons = {
  'all': AIcons.sparkles,
  'nutrition': AIcons.apple,
  'exercise': AIcons.dumbbell,
  'selfcare': AIcons.heart,
  'mood': AIcons.brain,
};

class FlowDashboard extends ConsumerStatefulWidget {
  const FlowDashboard({super.key});
  @override
  ConsumerState<FlowDashboard> createState() => _FlowDashboardState();
}

class _FlowDashboardState extends ConsumerState<FlowDashboard> {
  String _category = 'all';

  // ── period dialogs ──

  Future<void> _openPeriodDialog(List<Map<String, dynamic>> periodDays) async {
    final now = flowNow();
    final since = ymd(DateTime(now.year, now.month, now.day - 89));
    final initialKeys = [
      for (final l in periodDays)
        if ((l['log_date'] as String).compareTo(since) >= 0 && hasPeriodFlow(l['flow_intensity'])) l['log_date'] as String
    ];
    var selected = initialKeys.isNotEmpty ? [for (final k in initialKeys) parseIsoDateFns(k)!] : [now];
    var marking = false;
    final toast = flowToast(context);
    await showFlowAlertDialog<void>(context, builder: (ctx) {
      final s = ctx.tokens.shadcn;
      return StatefulBuilder(builder: (ctx, setD) {
        Future<void> submit() async {
          setD(() => marking = true);
          try {
            final keys = {for (final d in selected) ymd(d)};
            final added = keys.where((d) => !initialKeys.contains(d)).toList();
            final removed = initialKeys.where((d) => !keys.contains(d)).toList();
            final m = ref.read(recordPeriodDaysMutation.notifier);
            if (removed.isNotEmpty) await m.mutateAsync(PeriodWrite(dates: removed, flow: 'clear'));
            if (added.isNotEmpty) await m.mutateAsync(PeriodWrite(dates: added, flow: 'unspecified', preserveExisting: true));
            toast?.success(tr('flow_days_saved', 'Period günləri qeyd edildi'),
                description: tr('flow_selected_day_count', '{count} gün seçilib').replaceFirst('{count}', '${selected.length}'));
            if (ctx.mounted) Navigator.of(ctx).pop();
          } catch (_) {
            toast?.error(tr('flowdashboard_xeta_bas_verdi_yeniden_cehd_ed_816221', 'Xəta baş verdi, yenidən cəhd edin'));
          } finally {
            if (ctx.mounted) setD(() => marking = false);
          }
        }

        return ShadAlertDialogPanel(
          title: tr('flow_record_days', 'Period günlərini qeyd et'),
          description: tr('flow_select_observed_days', 'Axın olan günləri seçin. Hər gün ayrıca qeyd olunur; gələcək günlər proqnoz olaraq qalır.'),
          body: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Center(
                child: ShadDayPicker(
                  multiple: true,
                  selected: selected,
                  onSelect: (d) => setD(() => selected = d),
                  isDisabled: (d) => d.isAfter(flowNow()),
                ),
              ),
            ),
            Text(tr('flow_selected_day_count', '{count} gün seçilib').replaceFirst('{count}', '${selected.length}'),
                textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 20 / 14, color: s.mutedForeground)),
          ],
          actions: [
            ShadButton(outline: true, label: tr('flowdashboard_legv_et_b5e49c', 'Ləğv et'), onPressed: marking ? null : () => Navigator.of(ctx).pop()),
            ShadButton(
              label: marking ? tr('untranslated_qeyd_edilir_df7cba', 'Qeyd edilir...') : tr('flow_qeyd_et', 'Qeyd et'),
              color: TwColors.red500,
              foreground: TwColors.white,
              onPressed: marking || (selected.isEmpty && initialKeys.isEmpty) ? null : () => unawaited(submit()),
            ),
          ],
        );
      });
    });
  }

  Future<void> _openPeriodEndDialog(DateTime lastPeriodDate) async {
    var end = flowNow();
    var marking = false;
    final toast = flowToast(context);
    await showFlowAlertDialog<void>(context, builder: (ctx) {
      final s = ctx.tokens.shadcn;
      return StatefulBuilder(builder: (ctx, setD) {
        Future<void> submit() async {
          setD(() => marking = true);
          try {
            final start = startOfDay(lastPeriodDate);
            final e = startOfDay(end);
            final len = differenceInCalendarDays(e, start) + 1;
            if (len < 1 || len > 90) throw StateError('INVALID_PERIOD_RANGE');
            await ref.read(recordPeriodDaysMutation.notifier).mutateAsync(PeriodWrite(
                  dates: [for (var i = 0; i < len; i++) DateTime(start.year, start.month, start.day + i)],
                  flow: 'unspecified',
                  complete: true,
                  preserveExisting: true,
                ));
            toast?.success(tr('flowdashboard_period_bitisi_qeyd_edildi_7aef98', 'Period bitişi qeyd edildi! ✅'));
            if (ctx.mounted) Navigator.of(ctx).pop();
          } catch (_) {
            toast?.error(tr('flowdashboard_xeta_bas_verdi_yeniden_cehd_ed_816221', 'Xəta baş verdi, yenidən cəhd edin'));
          } finally {
            if (ctx.mounted) setD(() => marking = false);
          }
        }

        final bold = TextStyle(fontWeight: FontWeight.w700, color: s.mutedForeground);
        return ShadAlertDialogPanel(
          title: tr('flowdashboard_period_bitisi_d0fdcc', '✅ Period bitişi'),
          description: tr('flowdashboard_periodunuzun_bitdiyi_tarixi_se_aa37b7', 'Periodunuzun bitdiyi tarixi seçin:'),
          body: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Center(
                child: ShadDayPicker(
                  selected: [end],
                  onSelect: (d) => d.isEmpty ? null : setD(() => end = d.first),
                  isDisabled: (d) => d.isAfter(flowNow()) || d.isBefore(startOfDay(lastPeriodDate)),
                ),
              ),
            ),
            Text.rich(
              TextSpan(text: '${tr('flowdashboard_secilen_tarix_104372', 'Seçilən tarix:')} ', children: [
                TextSpan(text: flowFormat(end, 'd MMMM yyyy'), style: bold),
                const TextSpan(text: ' • Period: '),
                TextSpan(text: '${differenceInCalendarDays(end, lastPeriodDate) + 1} ${tr('flowdashboard_gun_54e78d', 'gün')}', style: bold),
              ]),
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, height: 20 / 14, color: s.mutedForeground),
            ),
          ],
          actions: [
            ShadButton(outline: true, label: tr('flowdashboard_legv_et_b5e49c', 'Ləğv et'), onPressed: marking ? null : () => Navigator.of(ctx).pop()),
            ShadButton(
              label: marking ? tr('untranslated_qeyd_edilir_df7cba', 'Qeyd edilir...') : tr('flow_qeyd_et', 'Qeyd et'),
              color: TwColors.green600,
              foreground: TwColors.white,
              onPressed: marking ? null : () => unawaited(submit()),
            ),
          ],
        );
      });
    });
  }

  // ── build ──

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final user = ref.watch(userStoreProvider);
    final cycleLength = ref.watch(effectiveCycleLengthProvider);
    final periodLength = user.periodLength;
    final language = user.language;
    final now = flowNow();
    final cycleData = user.getCycleData(today: now);
    final cycles = ref.watch(cycleHistoryQuery).data ?? const <Map<String, dynamic>>[];
    final adaptive = cp.computeAdaptiveCycleStats(toCycleHistory(cycles), cycleLength == 0 ? 28 : cycleLength, periodLength == 0 ? 5 : periodLength);
    final periodDays = ref.watch(periodDayLogsQuery(null)).data ?? const <Map<String, dynamic>>[];
    final labels = ref.watch(flowUpcomingLabelsQuery).data;

    String dyn(String? db, String az, String key, String en) {
      if (language == 'en') return en;
      if (language == 'az') return (db != null && db.isNotEmpty) ? db : tr(key, az);
      return tr(key, az);
    }

    final labelNext = dyn(labels?['flow_label_next_period'], 'Növbəti Period', 'flowdashboard_novbeti_period_b29c4a', 'Upcoming Period');
    final labelFertile = dyn(labels?['flow_label_fertile_window'], 'Reproduktiv Dövr', 'flowdashboard_reproduktiv_dovr_80642c', 'Fertile Window');
    final labelOvulation = dyn(labels?['flow_label_ovulation_day'], 'Ovulyasiya Günü', 'flowdashboard_ovulyasiya_gunu_811e84', 'Ovulation Day');

    final lastPeriodDate = storedCalendarDate(cycleData?.lastPeriodDate) ?? now;
    final phaseInfo = getPhaseInfoForDate(now, lastPeriodDate, cycleLength, periodLength);
    final todayPeriod = periodDays.where((l) => l['log_date'] == ymd(now)).firstOrNull;
    final phase = todayPeriod != null && hasPeriodFlow(todayPeriod['flow_intensity']) ? 'menstrual' : phaseInfo.phase;
    final currentDay = phaseInfo.dayInCycle;
    final nextPeriod = getNextPeriodDate(lastPeriodDate, cycleLength);
    final fertile = getFertileWindow(lastPeriodDate, cycleLength);
    final logs = ref.watch(flowDailyLogsQuery((null, null))).data ?? const <Map<String, dynamic>>[];
    final refined = cp.refineOvulation([for (final l in logs) cp.OvulationSignalLog.fromJson(l)], lastPeriodDate, fertile.ovulationDate);
    final ovulation = refined.ovulationDate ?? fertile.ovulationDate;
    final fertileStart = refined.fertileWindowStart ?? fertile.start;
    final fertileEnd = refined.fertileWindowEnd ?? fertile.end;
    final tipsQ = ref.watch(phaseTipsQuery(phase));
    final tips = tipsQ.data ?? const <Map<String, dynamic>>[];
    final filtered = _category == 'all' ? tips : tips.where((t) => t['category'] == _category).toList();
    final daysUntil = differenceInDaysFns(nextPeriod, now);
    final info = kPhaseInfo[phase]!;
    final slots = ref.watch(flowHomeSlotsProvider);
    final gate = ref.watch(flowPremiumGateProvider);

    double phaseProgress() {
      final days = {'menstrual': periodLength, 'follicular': 8, 'ovulation': 3, 'luteal': 12};
      final start = {'menstrual': 1, 'follicular': periodLength + 1, 'ovulation': 14, 'luteal': 17};
      final inPhase = currentDay - start[phase]! + 1;
      final v = inPhase / days[phase]! * 100;
      return v < 100 ? v : 100;
    }

    Widget phaseTag() => ATag(
          borderless: true,
          background: info.color.withValues(alpha: 0x22 / 255),
          color: info.color,
          weight: FontWeight.w700,
          child: Text('${info.emoji} ${info.labelAz}'),
        );

    Widget section(Widget child, {double top = 22}) => Padding(padding: EdgeInsets.only(top: top), child: child);
    Widget gradIcon(Gradient g, Color c, AIconData icon) => Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(gradient: g, borderRadius: BorderRadius.circular(13)),
          child: AIcon(icon, size: 17, color: c),
        );
    Widget gated(Duration delay, String title, String description, String emoji, String feature, Widget child) => section(
          FramerEnter(delay: delay, child: Builder(builder: (ctx) => gate(ctx, title: title, description: description, emoji: emoji, feature: feature, child: child))),
        );
    Widget insight(AIconData icon, String label, String value) => AStatTile(
          icon: AStatTileIcon(color: a.surface, border: Border.all(color: a.line), child: AIcon(icon, size: 15, color: a.peach2)),
          label: label,
          value: value,
        );
    final hours = tr('common_hours', 'saat');
    final pct = (currentDay / (cycleLength == 0 ? 28 : cycleLength) * 100).round().clamp(0, 100);

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const PeriodDelayBanner(),
      FlowGoalSection(
        lastPeriodDate: lastPeriodDate,
        cycleLength: cycleLength == 0 ? 28 : cycleLength,
        periodLength: periodLength == 0 ? 5 : periodLength,
        ovulation: ovulation,
        ovulationConfirmed: refined.confirmed,
      ),
      const DailyStoryCards(),
      if (slots.upcomingAppointments != null) Builder(builder: slots.upcomingAppointments!),

      // Currently — phase status card
      section(AFadeIn(
        child: ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            ACardHead(title: tr('flowdashboard_hal_hazirda_b78349', 'Hal-hazırda'), trailing: phaseTag()),
            Row(children: [
              AConicRing(percent: pct.toDouble(), value: '$currentDay', label: tr('flowdashboard_tsikl_gunu_b9e250', 'Tsikl günü'), fillColor: info.color),
              const SizedBox(width: 16),
              Expanded(
                child: IntrinsicHeight(
                  child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    for (final (i, t) in [
                      ('${daysUntil > 0 ? daysUntil : 0}', tr('flowdashboard_gun_qaldi_993281', 'gün qaldı')),
                      ('$cycleLength', tr('flowdashboard_gun_tsikl_bb0ab6', 'gün tsikl')),
                      ('$periodLength', tr('flowdashboard_gun_period_957849', 'gün period')),
                    ].indexed) ...[
                      if (i > 0) const SizedBox(width: 6),
                      Expanded(child: ATrioItem(value: t.$1, label: t.$2, padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4))),
                    ],
                  ]),
                ),
              ),
            ]),
            AInlineBar(percent: phaseProgress(), color: info.color, animate: true, top: 16),
            Container(
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
              decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(13)),
              child: Row(children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    // FlowDashboard.tsx literals: high #63bd8b, medium #ffc94d
                    color: adaptive.confidence == 'high' ? const Color(0xFF63BD8B) : adaptive.confidence == 'medium' ? const Color(0xFFFFC94D) : a.inkFaint,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    adaptive.basedOnCycles >= 2
                        ? tr('flowdashboard_adaptiv_proqnoz', 'Proqnoz son {n} tsiklə əsasən öyrənir · dəqiqlik ±{sd} gün')
                            .replaceFirst('{n}', '${adaptive.basedOnCycles}')
                            .replaceFirst('{sd}', '${jsRoundInt(adaptive.stdDev) < 1 ? 1 : jsRoundInt(adaptive.stdDev)}')
                        : tr('flowdashboard_proqnoz_deqiqlesir', 'Proqnoz dəqiqləşir — period günlərini qeyd etməyə davam edin 📈'),
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: a.inkSoft, height: 1.4),
                  ),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Row(children: [
                Expanded(
                  child: ACtaButton(
                    label: tr('flow_record_days', 'Period günlərini qeyd et'),
                    icon: AIcon(AIcons.circleDot, size: 16, strokeWidth: 2.2, color: a.bg),
                    color: a.ink,
                    foreground: a.bg,
                    height: 46,
                    expand: true,
                    onTap: () => unawaited(_openPeriodDialog(periodDays)),
                  ),
                ),
                if (phase == 'menstrual' && cycleData != null) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: ACtaButton(
                      label: tr('flowdashboard_periodum_bitdi_c1b3ea', '✅ Periodum bitdi'),
                      gradient: a.gradPink,
                      foreground: a.alertInk,
                      height: 46,
                      expand: true,
                      onTap: () => unawaited(_openPeriodEndDialog(lastPeriodDate)),
                    ),
                  ),
                ],
              ]),
            ),
          ]),
        ),
      )),

      if (slots.partnerHomeCard != null) Builder(builder: (ctx) => slots.partnerHomeCard!(ctx, daysUntil)),

      // Interactive period calendar, then water tracking (FlowDashboard.test.tsx order)
      section(const FlowPeriodCalendar(), top: 22),
      if (slots.waterWidget != null) section(Builder(builder: slots.waterWidget!)),

      // Phase tips
      section(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ASectionHead(title: tr('flowdashboard_bu_faza_ucun_meslehetler_14b952', 'Bu Faza Üçün Məsləhətlər'), trailing: phaseTag()),
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                for (final (i, cat) in _categories.indexed) ...[
                  if (i > 0) const SizedBox(width: 2),
                  Semantics(
                    button: true,
                    selected: _category == cat,
                    child: GestureDetector(
                      onTap: () => setState(() => _category = cat),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        curve: ACurves.cssEase,
                        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
                        decoration: BoxDecoration(color: _category == cat ? a.peach1 : null, borderRadius: BorderRadius.circular(999)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          AIcon(_categoryIcons[cat]!, size: 13, strokeWidth: 2.2, color: _category == cat ? a.accentInk : a.inkSoft),
                          const SizedBox(width: 5),
                          Text(cat == 'all' ? tr('flowdashboard_hamisi_c73c4d', 'Hamısı') : kCategoryInfo[cat]!.labelAz,
                              style: x.aTab.copyWith(color: _category == cat ? a.accentInk : a.inkSoft)),
                        ]),
                      ),
                    ),
                  ),
                ],
              ]),
            ),
          ),
        ),
        if (tipsQ.isLoading)
          ACard(
            padding: const EdgeInsets.symmetric(vertical: 28),
            child: Center(child: SizedBox(width: 24, height: 24, child: _Spinner(color: a.peach2))),
          )
        else
          Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final (i, tip) in filtered.take(5).indexed) ...[
              if (i > 0) const SizedBox(height: 10),
              FramerEnter(
                key: ValueKey('tip-${tip['id']}'),
                dx: -20,
                dy: 0,
                delay: Duration(milliseconds: 50 * i),
                child: ACard(
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
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text('${tip['content'] ?? ''}', style: TextStyle(fontSize: 12, height: 1.55, color: a.inkSoft)),
                    ),
                  ]),
                ),
              ),
            ],
            if (filtered.isEmpty)
              ACard(
                padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 18),
                child: Text(tr('flowdashboard_bu_kateqoriyada_meslehet_yoxdur_2e13ec', 'Bu kateqoriyada məsləhət yoxdur'), textAlign: TextAlign.center, style: x.aListSub),
              ),
          ]),
      ])),

      // Upcoming events
      section(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ASectionHead(title: tr('flowdashboard_qarsidan_gelenler_dc6614', 'Qarşıdan Gələnlər')),
        AFadeIn(
          child: ACard(
            variant: ACardVariant.list,
            child: Column(children: [
              AListRow(
                first: true,
                leading: gradIcon(a.gradPink, a.berryInk, AIcons.droplets),
                title: labelNext,
                subtitle: flowFormat(nextPeriod, 'd MMMM'),
                trailing: Text(
                  daysUntil > 0
                      ? tr('flowdashboard_x_gun_qaldi', '{days} gün qaldı').replaceFirst('{days}', '$daysUntil')
                      : tr('flowdashboard_bu_gun_786fd4', 'Bu gün'),
                  style: x.aListValue,
                ),
              ),
              AListRow(
                leading: gradIcon(a.gradGreen, a.greenInk, AIcons.heart),
                title: labelFertile,
                subtitle: '${flowFormat(fertileStart, 'd MMMM')} – ${flowFormat(fertileEnd, 'd MMMM')}',
                trailing: refined.confirmed
                    ? ARankTag(
                        maxWidth: 120,
                        background: a.green1,
                        color: a.greenInk,
                        text: refined.source == 'mucus' ? tr('flowdashboard_maye_tesdiqli', '💧 Maye təsdiqli') : tr('flowdashboard_test_tesdiqli', '✓ Test təsdiqli'),
                      )
                    : null,
              ),
              AListRow(
                leading: gradIcon(a.gradYellow, a.warnInk, AIcons.sparkles),
                title: labelOvulation,
                subtitle: flowFormat(ovulation, 'd MMMM'),
                trailing: refined.confirmed
                    ? ARankTag(
                        maxWidth: 120,
                        background: a.yellow1,
                        color: a.warnInk,
                        text: refined.source == 'opk_peak'
                            ? tr('flowdashboard_pik_lh', '🌟 Pik LH')
                            : refined.source == 'opk_positive'
                                ? tr('flowdashboard_lh_yukselisi', '➕ LH yüksəlişi')
                                : tr('flowdashboard_maye_siqnali', '💧 Maye siqnalı'),
                      )
                    : null,
              ),
            ]),
          ),
        ),
      ])),

      gated(const Duration(milliseconds: 400), tr('flowdailylogger_gundelik_qeyd_32e154', 'Gündəlik Qeyd'),
          tr('pgate_flow_logger', 'Əhval, simptom, qanaxma və fertillik qeydləri — proqnozlar bunlarla dəqiqləşir'), '📝', 'flow_daily_logger',
          const FlowDailyLogger(compact: true)),
      gated(const Duration(milliseconds: 500), tr('pgate_mood_chart_title', 'Əhval qrafiki'), tr('pgate_mood_chart', '30 günlük əhval, enerji və ağrı analizi'), '📊',
          'flow_mood_chart', const FlowMoodChart()),
      gated(const Duration(milliseconds: 600), tr('pgate_cycle_stats_title', 'Tsikl statistikası'), tr('pgate_cycle_stats', 'Tsikl tarixçəniz və dəqiqlik göstəriciləri'),
          '📈', 'flow_cycle_stats', const FlowCycleStats()),
      gated(const Duration(milliseconds: 650), tr('pgate_trend_title', 'Tsikl trendi'), tr('pgate_trend', 'Son tsikllərin müqayisəli trend qrafiki'), '📉',
          'flow_trend_chart', const CycleTrendChart()),
      const CycleAnomalyBanner(),
      gated(const Duration(milliseconds: 680), tr('pgate_symptom_title', 'Simptom analizi'), tr('pgate_symptom', 'Fazalara görə simptom nümunələriniz'), '🧠',
          'flow_symptom_report', const SymptomPatternReport()),
      gated(
        const Duration(milliseconds: 700),
        tr('pgate_reminders_title', 'Xatırlatıcılar'),
        tr('pgate_reminders', 'Period, PMS, dərman və su xatırlatıcıları'),
        '🔔',
        'flow_reminders',
        const Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [PillReminderCard(), SizedBox(height: 12), FlowRemindersCard()]),
      ),

      // Daily insights (.a-section.a-grid-2: the grid's margin-top 14 wins)
      FramerEnter(
        delay: const Duration(milliseconds: 800),
        child: AGrid2(children: [
          insight(AIcons.flame, tr('flowdashboard_enerji_seviyyesi_961691', 'Enerji Səviyyəsi'),
              phase == 'follicular' || phase == 'ovulation' ? tr('flowdashboard_yuksek_492584', 'Yüksək') : tr('common_normal', 'Normal')),
          insight(AIcons.moon, tr('flowdashboard_tovsiye_edilen_yuxu_e219dd', 'Tövsiyə Edilən Yuxu'), phase == 'luteal' ? '8-9 $hours' : '7-8 $hours'),
          insight(
              AIcons.apple,
              tr('untranslated_fokus_qida_lyi3h2', 'Fokus Qida'),
              phase == 'menstrual'
                  ? tr('flowdashboard_demir_30bf6c', 'Dəmir')
                  : phase == 'luteal'
                      ? tr('flowdashboard_maqnezium_f7238a', 'Maqnezium')
                      : tr('flowdashboard_protein_a47bc2', 'Protein')),
          insight(
              AIcons.dumbbell,
              tr('flowdashboard_mesq_intensivliyi_f59d1b', 'Məşq İntensivliyi'),
              phase == 'menstrual'
                  ? tr('flowdashboard_yungul_2a8010', 'Yüngül')
                  : phase == 'ovulation'
                      ? tr('flowdashboard_intensiv_f123bc', 'İntensiv')
                      : tr('common_orta', 'Orta')),
        ]),
      ),
    ]);
  }
}

/// `w-6 h-6 rounded-full animate-spin` with `border: 2px solid var(--a-peach-2); border-top-color: transparent`.
class _Spinner extends StatefulWidget {
  const _Spinner({required this.color});
  final Color color;
  @override
  State<_Spinner> createState() => _SpinnerState();
}

class _SpinnerState extends State<_Spinner> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!animationsDisabled(context) && !_c.isAnimating) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(
        turns: _c,
        child: CustomPaint(painter: _SpinnerPainter(widget.color), size: const Size(24, 24)),
      );
}

class _SpinnerPainter extends CustomPainter {
  _SpinnerPainter(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = color;
    // three of four border sides visible (top transparent): a 270° arc starting at 3 o'clock' minus the top quarter.
    canvas.drawArc((Offset.zero & size).deflate(1), -0.25 * 3.14159265, 1.5 * 3.14159265, false, p);
  }

  @override
  bool shouldRepaint(_SpinnerPainter old) => old.color != color;
}

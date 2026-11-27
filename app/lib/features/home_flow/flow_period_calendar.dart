// Ported from: src/components/flow/FlowPeriodCalendar.tsx
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/data/data.dart' hide Row;
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/cycle/cycle_utils.dart';
import '../../domain/cycle/period_flow.dart';
import '../../state/user_store.dart';
import 'data/flow_hooks.dart';
import 'widgets/flow_common.dart';
import 'widgets/flow_ui.dart';

class _FlowOption {
  const _FlowOption(this.key, this.label, this.emoji, this.light, this.dark);
  final String key;
  final String label;
  final String emoji;
  final Color light;
  final Color dark;
}

List<_FlowOption> _flowOptions() => [
      _FlowOption('unspecified', tr('flow_had_flow', 'Axın oldu'), '🩸', TwColors.red100, op(TwColors.red900, 0.3)),
      _FlowOption('light', tr('flowperiodcalendar_yungul_2a8010', 'Yüngül'), '💧', TwColors.red200, op(TwColors.red900, 0.3)),
      _FlowOption('medium', tr('common_orta', 'Orta'), '💧💧', TwColors.red300, op(TwColors.red800, 0.4)),
      _FlowOption('heavy', tr('flowperiodcalendar_guclu_0fda31', 'Güclü'), '💧💧💧', TwColors.red400, op(TwColors.red700, 0.5)),
      _FlowOption('none', tr('flow_no_flow', 'Axın olmadı'), '⚪', TwColors.slate100, TwColors.slate800),
      _FlowOption('spotting', tr('flowdailylogger_lekelenme_8e7b1e', 'Ləkələnmə'), '🔵', TwColors.blue100, op(TwColors.blue900, 0.3)),
    ];

class FlowPeriodCalendar extends ConsumerStatefulWidget {
  const FlowPeriodCalendar({super.key, this.trackingOnly = false, this.fromDate});

  /// Mommy observation-only mode: no predicted / fertile / ovulation days.
  final bool trackingOnly;

  /// Days before this `yyyy-MM-dd` cannot be recorded.
  final String? fromDate;

  @override
  ConsumerState<FlowPeriodCalendar> createState() => _FlowPeriodCalendarState();
}

class _FlowPeriodCalendarState extends ConsumerState<FlowPeriodCalendar> {
  DateTime _month = flowNow();

  bool _isFuture(DateTime d) => d.isAfter(flowNow());

  void _tapDay(DateTime date, Rows logs) {
    if (_isFuture(date) || (widget.fromDate != null && ymd(date).compareTo(widget.fromDate!) < 0)) return;
    final key = ymd(date);
    final selectedLog = logs.where((l) => l['log_date'] == key).firstOrNull;
    final toast = flowToast(context);
    showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: tr('flowperiodcalendar_legv_et_b5e49c', 'Ləğv et'),
      barrierColor: const Color(0x66000000), // bg-black/40
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (ctx, _, _) => _FlowPickerSheet(
        date: date,
        selectedLog: selectedLog,
        onSelect: (flow) => _select(ctx, date, flow, toast),
      ),
      transitionBuilder: (ctx, anim, _, child) {
        // framer: overlay opacity tween; panel y 300 → 0 spring 300/25 (approximated by --a-spring over 300 ms).
        final t = ACurves.spring.transform(anim.value);
        return Opacity(
          opacity: ACurves.framerDefault.transform(anim.value),
          child: Transform.translate(offset: Offset(0, 300 * (1 - t)), child: child),
        );
      },
    );
  }

  void _select(BuildContext sheetContext, DateTime date, PeriodFlowAction flow, AToastController? toast) {
    ref.read(recordPeriodDaysMutation.notifier).mutate(PeriodWrite(dates: [date], flow: flow), onSuccess: (_, _, _) {
      toast?.success(
        flow == 'clear' ? tr('flowperiodcalendar_period_gunu_silindi_c4a18f', 'Period günü silindi') : tr('flow_day_saved', 'Günün qeydi saxlanıldı'),
        description: formatDatePattern(date, 'd MMMM'),
      );
      if (sheetContext.mounted) Navigator.of(sheetContext).pop();
    }, onError: (_, _, _) => toast?.error(tr('flow_save_failed', 'Qeyd saxlanılmadı. Yenidən cəhd edin.')));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final s = context.tokens.shadcn;
    final cycleLength = ref.watch(effectiveCycleLengthProvider);
    final user = ref.watch(userStoreProvider);
    final periodLength = user.periodLength;
    final lastPeriodDate = user.getCycleData(today: flowNow())?.lastPeriodDate ?? flowNow();
    final logs = ref.watch(periodDayLogsQuery(null)).data ?? const <Map<String, dynamic>>[];
    final pending = ref.watch(recordPeriodDaysMutation).isPending;
    final now = flowNow();
    final todayKey = ymd(now);
    final todayLog = logs.where((l) => l['log_date'] == todayKey).firstOrNull;
    final todayHasFlow = todayLog != null && hasPeriodFlow(todayLog['flow_intensity']);
    final logged = {for (final l in logs) if (hasPeriodFlow(l['flow_intensity'])) l['log_date'] as String};
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final leading = DateTime(_month.year, _month.month, 1).weekday % 7;
    final toast = flowToast(context);

    Widget dayCell(DateTime day) {
      final key = ymd(day);
      final isLogged = logged.contains(key);
      final phase = getPhaseInfoForDate(day, lastPeriodDate, cycleLength, periodLength);
      final record = logs.where((l) => l['log_date'] == key).firstOrNull;
      final predicted = !widget.trackingOnly && record == null && phase.isPeriodDay;
      final future = _isFuture(day);
      final fertile = !widget.trackingOnly && phase.isFertileDay && !isLogged;
      final ovulation = !widget.trackingOnly && phase.isOvulationDay && !isLogged;
      final intensity = record?['flow_intensity'] as String?;
      final spotting = intensity == 'spotting';
      final isToday = key == todayKey;
      final disabled = future || pending || (widget.fromDate != null && key.compareTo(widget.fromDate!) < 0);

      Color? bg;
      Color fg;
      if (isLogged) {
        if (intensity == 'heavy') {
          bg = dk(context, op(TwColors.red500, 0.9), op(TwColors.red600, 0.8));
          fg = TwColors.white;
        } else if (intensity == 'light') {
          bg = dk(context, TwColors.red200, op(TwColors.red900, 0.4));
          fg = dk(context, TwColors.red800, TwColors.red300);
        } else {
          bg = dk(context, op(TwColors.red400, 0.8), op(TwColors.red500, 0.6));
          fg = TwColors.white;
        }
      } else if (predicted) {
        bg = dk(context, op(TwColors.red100, 0.6), op(TwColors.red900, 0.2));
        fg = dk(context, TwColors.red600, TwColors.red400);
      } else if (ovulation) {
        bg = dk(context, TwColors.pink200, op(TwColors.pink800, 0.4));
        fg = dk(context, TwColors.pink800, TwColors.pink300);
      } else if (fertile) {
        bg = dk(context, TwColors.pink100, op(TwColors.pink900, 0.3));
        fg = dk(context, TwColors.pink700, TwColors.pink400);
      } else if (future) {
        fg = op(s.mutedForeground, 0.4);
      } else {
        fg = s.foreground;
      }
      final dotColor = switch (intensity) { 'light' => TwColors.red300, 'heavy' => TwColors.red600, _ => TwColors.red400 };
      Widget cell = Container(
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
        alignment: Alignment.center,
        child: Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
          Text('${day.day}', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, height: 16 / 12, color: fg)),
          if (isLogged) Positioned(bottom: 2, child: _dot(6, dotColor)),
          if (spotting) Positioned(bottom: 2, child: _dot(6, TwColors.blue400)),
          if (predicted && !isLogged) Positioned(bottom: 2, child: _dot(4, dk(context, TwColors.red300, TwColors.red600))),
        ]),
      );
      if (predicted) cell = DashedRRectBorder(color: dk(context, TwColors.red300, TwColors.red700), radius: 12, child: cell);
      return LayoutBuilder(builder: (context, c) {
        Widget body = isToday
            ? Stack(clipBehavior: Clip.none, children: [
                Positioned(left: -3, top: -3, right: -3, bottom: -3, child: _todayRing(context, s, cell)),
              ])
            : cell;
        if (ovulation) {
          body = Stack(clipBehavior: Clip.none, children: [
            Positioned.fill(child: body),
            const PositionedDirectional(top: -2, end: -2, child: Text('🌸', style: TextStyle(fontSize: 8, height: 1))),
          ]);
        }
        return Semantics(
          button: true,
          enabled: !disabled,
          toggled: isLogged,
          label: formatDatePattern(day, 'd MMMM yyyy'),
          child: KeyedSubtree(
            key: ValueKey('flow-day-$key'),
            child: PressScale(
              scale: 0.85,
              enabled: !future,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: disabled ? null : () => _tapDay(day, logs),
                child: SizedBox(width: c.maxWidth, height: c.maxWidth, child: body),
              ),
            ),
          ),
        );
      });
    }

    final cells = <Widget>[
      for (var i = 0; i < leading; i++) const SizedBox(),
      for (var d = 1; d <= daysInMonth; d++) dayCell(DateTime(_month.year, _month.month, d)),
    ];
    Widget grid(List<Widget> items) {
      final rows = <Widget>[];
      for (var i = 0; i < items.length; i += 7) {
        if (i > 0) rows.add(const SizedBox(height: 4));
        rows.add(Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (var j = 0; j < 7; j++) ...[
            if (j > 0) const SizedBox(width: 4),
            Expanded(child: AspectRatio(aspectRatio: 1, child: i + j < items.length ? items[i + j] : const SizedBox())),
          ],
        ]));
      }
      return Column(children: rows);
    }

    final dayLabels = [
      tr('day_sun_short', 'B'), tr('day_mon_short', 'BE'), tr('day_tue_short', 'ÇA'), tr('day_wed_short', 'Ç'),
      tr('day_thu_short', 'CA'), tr('day_fri_short', 'C'), tr('day_sat_short', 'Ş'),
    ];
    Widget legend(Widget dot, String label) => Row(mainAxisSize: MainAxisSize.min, children: [
          dot,
          const SizedBox(width: 6),
          Text(label, style: TextStyle(fontSize: 10, height: 1.5, color: s.mutedForeground)),
        ]);

    return AFadeIn(
      child: ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Row(children: [
              Expanded(child: Text(tr('flowperiodcalendar_period_teqvimi_d04269', 'Period Təqvimi'), style: context.aText.heading(context.aText.aCardTitle))),
              AIconSquareButton(
                size: 28,
                onTap: () => setState(() => _month = DateTime(_month.year, _month.month - 1, 1)),
                icon: const AIcon(AIcons.chevronLeft, size: 14, mirrorInRtl: true),
              ),
              const SizedBox(width: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 100),
                child: Text(formatDatePattern(_month, 'MMMM yyyy'), textAlign: TextAlign.center, style: aSectionLinkStyle(context, color: a.ink)),
              ),
              const SizedBox(width: 8),
              AIconSquareButton(
                size: 28,
                onTap: () => setState(() => _month = DateTime(_month.year, _month.month + 1, 1)),
                icon: const AIcon(AIcons.chevronRight, size: 14, mirrorInRtl: true),
              ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(children: [
              AIcon(AIcons.droplets, size: 13, color: a.inkSoft),
              const SizedBox(width: 6),
              Expanded(child: Text(tr('flowperiodcalendar_gune_toxunaraq_period_gunlerin_3b5f8a', 'Günə toxunaraq period günlərini qeyd edin'), style: context.aText.aListSub)),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Semantics(
              button: true,
              enabled: !pending,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: pending
                    ? null
                    : () {
                        if (todayHasFlow) {
                          _tapDay(flowNow(), logs);
                          return;
                        }
                        ref.read(recordPeriodDaysMutation.notifier).mutate(
                              PeriodWrite(dates: [flowNow()], flow: 'unspecified'),
                              onSuccess: (_, _, _) => toast?.success(tr('flow_day_saved', 'Günün qeydi saxlanıldı')),
                              onError: (_, _, _) => toast?.error(tr('flow_save_failed', 'Qeyd saxlanılmadı. Yenidən cəhd edin.')),
                            );
                      },
                child: Opacity(
                  opacity: pending ? 0.5 : 1,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: dk(context, TwColors.red100, op(TwColors.red900, 0.3)), borderRadius: BorderRadius.circular(12)),
                    child: Text(
                      todayHasFlow ? tr('flow_today_recorded', 'Bu gün qeyd olunub') : tr('flow_had_flow_today', 'Bu gün axın oldu'),
                      style: TextStyle(fontSize: 14, height: 20 / 14, fontWeight: FontWeight.w600, color: dk(context, TwColors.red800, TwColors.red200)),
                    ),
                  ),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              for (var i = 0; i < 7; i++) ...[
                if (i > 0) const SizedBox(width: 4),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Text(dayLabels[i], textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: a.inkFaint, height: 1.5)),
                  ),
                ),
              ],
            ]),
          ),
          grid(cells),
          Container(
            margin: const EdgeInsets.only(top: 16),
            padding: const EdgeInsets.only(top: 12),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: s.border))),
            child: Wrap(alignment: WrapAlignment.center, crossAxisAlignment: WrapCrossAlignment.center, spacing: 12, runSpacing: 12, children: [
              legend(_dot(12, TwColors.red400), tr('flowperiodcalendar_qeyd_edilen_d67bc1', 'Qeyd edilən')),
              if (!widget.trackingOnly) ...[
                legend(
                  DashedRRectBorder(color: TwColors.red300, radius: 6, child: _dot(12, TwColors.red200)),
                  tr('untranslated_proqnoz_rt0tdx', 'Proqnoz'),
                ),
                legend(_dot(12, TwColors.pink300), tr('flowperiodcalendar_mehsuldar_7ab8a5', 'Məhsuldar')),
                legend(const Text('🌸', style: TextStyle(fontSize: 12, height: 16 / 12)), tr('untranslated_ovulyasiya_h9aw8t', 'Ovulyasiya')),
              ],
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _todayRing(BuildContext context, ShadcnTokens s, Widget cell) => Container(
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(15), border: Border.all(color: s.primary, width: 2)),
        padding: const EdgeInsets.all(1),
        child: Container(decoration: BoxDecoration(color: s.background, borderRadius: BorderRadius.circular(13)), child: cell),
      );

  static Widget _dot(double size, Color color) =>
      Container(width: size, height: size, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
}

class _FlowPickerSheet extends ConsumerWidget {
  const _FlowPickerSheet({required this.date, required this.selectedLog, required this.onSelect});
  final DateTime date;
  final Map<String, dynamic>? selectedLog;
  final ValueChanged<PeriodFlowAction> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = context.tokens.shadcn;
    final pending = ref.watch(recordPeriodDaysMutation).isPending;
    final title = formatDatePattern(date, 'd MMMM yyyy');
    final selectedKey = selectedLog == null ? null : periodFlowLabel(selectedLog!['flow_intensity']);
    final options = _flowOptions();

    Widget option(_FlowOption o) {
      final pressed = selectedKey == o.key;
      Widget w = Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: dk(context, o.light, o.dark),
          borderRadius: BorderRadius.circular(TwRadius.r2xl),
          border: pressed ? Border.all(color: TwColors.red500, width: 2) : null,
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(o.emoji, style: const TextStyle(fontSize: 24, height: 32 / 24)),
          const SizedBox(height: 8),
          Text(o.label, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, height: 16 / 12, fontWeight: FontWeight.w600, color: s.foreground)),
        ]),
      );
      return Semantics(
        button: true,
        toggled: pressed,
        enabled: !pending,
        label: '${o.emoji} ${o.label}',
        excludeSemantics: true,
        child: PressScale(scale: 0.92, child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: pending ? null : () => onSelect(o.key), child: w)),
      );
    }

    return AScope(
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Semantics(
          explicitChildNodes: true,
          scopesRoute: true,
          namesRoute: true,
          label: title,
          child: Container(
            width: double.infinity,
            constraints: const BoxConstraints(maxWidth: 448),
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 96),
            decoration: BoxDecoration(color: s.card, borderRadius: const BorderRadius.vertical(top: Radius.circular(TwRadius.r2xl))),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Center(
                child: Container(width: 40, height: 4, decoration: BoxDecoration(color: op(s.mutedForeground, 0.3), borderRadius: BorderRadius.circular(999))),
              ),
              const SizedBox(height: 16),
              Text('🩸 $title', textAlign: TextAlign.center, style: TextStyle(fontSize: 16, height: 1.5, fontWeight: FontWeight.w700, color: s.foreground)),
              const SizedBox(height: 4),
              Text(tr('flowperiodcalendar_axinti_intensivliyini_secin_7d78ea', 'Axıntı intensivliyini seçin'),
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 20 / 14, color: s.mutedForeground)),
              const SizedBox(height: 20),
              option(options[0]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: option(options[1])),
                const SizedBox(width: 12),
                Expanded(child: option(options[2])),
                const SizedBox(width: 12),
                Expanded(child: option(options[3])),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: option(options[4])),
                const SizedBox(width: 12),
                Expanded(child: option(options[5])),
              ]),
              if (selectedLog != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: _TextButton(
                    label: tr('flow_clear_day', 'Bu günün qeydini sil'),
                    color: TwColors.red600,
                    onTap: pending ? null : () => onSelect('clear'),
                  ),
                ),
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: _TextButton(
                  label: tr('flowperiodcalendar_legv_et_b5e49c', 'Ləğv et'),
                  color: s.mutedForeground,
                  onTap: () => Navigator.of(context).pop(),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

class _TextButton extends StatelessWidget {
  const _TextButton({required this.label, required this.color, required this.onTap});
  final String label;
  final Color color;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        excludeSemantics: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 20 / 14, color: color)),
          ),
        ),
      );
}

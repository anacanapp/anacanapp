// Ported from: src/components/CalendarScreen.tsx (ScreenId `calendar`: month grid with cycle / appointment / mood
//              markers, legend, selected-day details, add / edit appointment), src/hooks/usePeriodDayLogs.ts (query)
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/cache/cache.dart';
import '../../core/data/row.dart' hide Row;
import '../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../core/i18n/tr.dart';
import '../../design/design.dart';
import '../../domain/cycle/cycle_utils.dart';
import '../../domain/cycle/period_flow.dart';
import '../../domain/dates/local_date.dart';
import '../../state/user_store.dart';
import '../home/appointments/upcoming_appointments.dart' show appointmentSheetOpenerProvider;
import '../home/data/appointments.dart';
import '../home/data/daily_logs.dart';
import '../home/data/home_repository.dart';
import '../home/home_inputs.dart';
import '../home/widgets/home_widgets.dart';

/// `usePeriodDayLogs()` — key `['period-day-logs', userId, undefined, undefined]`, stale 0.
final periodDayLogsQuery = queryProvider<Rows>((ref) {
  final userId = ref.watch(homeUserIdProvider);
  return QueryOptions<Rows>(
    queryKey: ['period-day-logs', userId, null, null],
    enabled: userId != null,
    staleTime: Duration.zero,
    codec: QueryCodecs.rows,
    queryFn: (_) async => userId == null ? <Map<String, dynamic>>[] : ref.read(homeRepositoryProvider).periodDayLogs(userId),
  );
});

/// Palette dot colours (`DOT`).
abstract final class CalendarDots {
  static const Color period = Color(0xFFFF8AA4); // pink-2
  static const Color fertile = Color(0xFF63BD8B); // green-2
  static const Color ovulation = Color(0xFFFFC94D); // yellow-2
  static const Color appointment = Color(0xFFAB84EE); // lav-2
  static const Color mood = Color(0xFF63ACDF); // blue-2
}

typedef CalendarDayEvent = ({String type, String label, Color color});

bool _sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

class CalendarScreen extends ConsumerStatefulWidget {
  const CalendarScreen({super.key, required this.onBack, this.now});
  final VoidCallback onBack;
  final DateTime Function()? now;

  @override
  ConsumerState<CalendarScreen> createState() => CalendarScreenState();
}

class CalendarScreenState extends ConsumerState<CalendarScreen> {
  late DateTime _month = _today();
  DateTime? _selected;

  DateTime _today() => (widget.now ?? DateTime.now)();

  void selectDate(DateTime d) => setState(() => _selected = d);

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(userStoreProvider);
    final lifeStage = user.lifeStage;
    final cycleLength = user.cycleLength;
    final periodLength = user.periodLength;
    final appointments = ref.watch(appointmentsQuery).data ?? const <Appointment>[];
    ref.watch(dailyLogsProvider);
    final logs = ref.watch(dailyLogsProvider).logs;
    final periodDays = ref.watch(periodDayLogsQuery).data ?? const <Map<String, dynamic>>[];
    final today = _today();
    final cycleData = user.getCycleData(today: today);
    final preg = user.getPregnancyData();
    final lastPeriodDate = cycleData?.lastPeriodDate ?? today;
    final t = context.a;
    final x = context.aText;
    final open = ref.read(appointmentSheetOpenerProvider);

    List<CalendarDayEvent> eventsOf(DateTime day) {
      final events = <CalendarDayEvent>[];
      final key = localDateKey(day);
      for (final a in appointments.where((a) => a.eventDate == key)) {
        events.add((type: 'appointment', label: a.title, color: CalendarDots.appointment));
      }
      final log = logs.where((l) => l['log_date'] == key).firstOrNull;
      final mood = log?.number('mood');
      if (mood != null && mood != 0) events.add((type: 'mood', label: tr('calendarscreen_ehval_qeyd_aa4f19', 'Æhval qeyd'), color: CalendarDots.mood));
      if (lifeStage == 'flow' && cycleData != null) {
        final info = getPhaseInfoForDate(day, lastPeriodDate, cycleLength, periodLength);
        final period = periodDays.where((p) => p['log_date'] == key).firstOrNull;
        if (period != null && hasPeriodFlow(period['flow_intensity'])) {
          events.add((type: 'period', label: tr('flow_had_flow', 'Axın oldu'), color: CalendarDots.period));
        } else if (period == null && info.isPeriodDay) {
          events.add((type: 'period', label: tr('flow_predicted_period', 'Proqnozlaşdırılan period'), color: CalendarDots.period));
        }
        if (info.isOvulationDay) {
          events.add((type: 'ovulation', label: 'Ovulyasiya', color: CalendarDots.ovulation));
        } else if (info.isFertileDay && !info.isPeriodDay) {
          events.add((type: 'fertile', label: tr('calendarscreen_fertil_gun_653ae1', 'Fertil gün'), color: CalendarDots.fertile));
        }
      }
      final due = preg?.dueDate;
      if (lifeStage == 'bump' && due != null && _sameDay(day, due)) {
        events.add((type: 'appointment', label: tr('calendarscreen_dogus_tarixi_e2caea', 'Doğuş tarixi'), color: CalendarDots.appointment));
      }
      return events;
    }

    ({Color? bg, Color? ink}) styleOf(DateTime day) {
      if (lifeStage != 'flow' || cycleData == null) return (bg: null, ink: null);
      final info = getPhaseInfoForDate(day, lastPeriodDate, cycleLength, periodLength);
      final period = periodDays.where((p) => p['log_date'] == localDateKey(day)).firstOrNull;
      if (period != null && hasPeriodFlow(period['flow_intensity'])) return (bg: t.pink2, ink: t.pinkInk);
      if (period == null && info.isPeriodDay) return (bg: t.pink1, ink: t.pinkInk);
      if (info.isOvulationDay) return (bg: t.yellow1, ink: t.yellowInk);
      if (info.isFertileDay) return (bg: t.green1, ink: t.greenInk);
      return (bg: null, ink: null);
    }

    final first = DateTime(_month.year, _month.month, 1);
    final daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final padding = first.weekday - 1; // Monday first
    final currentCycleDay = lifeStage == 'flow' && cycleData != null ? getCycleDayForDate(today, lastPeriodDate, cycleLength) : null;
    final selected = _selected;
    final selectedEvents = selected == null ? const <CalendarDayEvent>[] : eventsOf(selected);
    final selectedAppointments = selected == null ? const <Appointment>[] : appointments.where((a) => a.eventDate == localDateKey(selected)).toList();

    Widget iconBtn(AIconData icon, VoidCallback onTap, String label, {double scale = 0.95, Key? key}) => AIconBtn(
          key: key,
          semanticLabel: label,
          tapScale: scale,
          onTap: onTap,
          child: AIcon(icon, size: 16, mirrorInRtl: icon == AIcons.arrowLeft || icon == AIcons.chevronLeft || icon == AIcons.chevronRight),
        );

    final stats = [
      (icon: AIcons.droplets, value: periodLength, label: tr('calendarscreen_gun_period_957849', 'gün period'), bg: t.pink1, ink: t.pinkInk),
      (icon: AIcons.calendar, value: cycleLength, label: tr('calendarscreen_gun_tsikl_bb0ab6', 'gün tsikl'), bg: t.peach1, ink: t.accentInk),
      (icon: AIcons.sparkles, value: cycleLength - 14, label: tr('calendarscreen_ovulyasiya_gunu_e20a0b', 'ovulyasiya günü'), bg: t.yellow1, ink: t.yellowInk),
    ];
    final legend = [
      (color: CalendarDots.period, label: tr('untranslated_menstruasiya_6pect0', 'Menstruasiya')),
      (color: CalendarDots.fertile, label: tr('calendarscreen_fertil_gunler_65de2c', 'Fertil günlər')),
      (color: CalendarDots.ovulation, label: tr('untranslated_ovulyasiya_h9aw8t', 'Ovulyasiya')),
      (color: CalendarDots.appointment, label: tr('untranslated_randevu_xc37do', 'Randevu')),
    ];
    final weekdays = ['B.e.', tr('calendarscreen_c_a_5c29b2', 'Ç.a.'), tr('calendarscreen_c_399abb', 'Ç.'), 'C.a.', 'C.', tr('calendarscreen_s_f3ddc2', 'Ş.'), 'B.'];

    Widget card(Widget child) => ACard(child: child);

    final header = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 64),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(children: [
          iconBtn(AIcons.arrowLeft, widget.onBack, tr('common_geri', 'Geri'), scale: 0.9, key: const ValueKey('calendar-back')),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              if (currentCycleDay != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(cssUppercase('${tr('calendarscreen_tsikl_gunu_51cdf3', 'Tsikl günü:')} $currentCycleDay / $cycleLength', user.language),
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: t.onBgSoft, height: 1.5)),
                ),
              Text(tr('calendarscreen_teqvim_584bdd', 'Təqvim'),
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: -0.16, color: t.onBg, height: 1.35)),
            ]),
          ),
          if (selected != null) ...[
            const SizedBox(width: 12),
            iconBtn(AIcons.plus, () => open(context, defaultDate: selected), tr('calendarscreen_elave_et_6e1b9b', 'Əlavə et'), key: const ValueKey('calendar-add')),
          ],
        ]),
      ),
    );

    final grid = LayoutBuilder(builder: (context, c) {
      final cell = (c.maxWidth - 6 * 4) / 7;
      final cells = <Widget>[
        for (var i = 0; i < padding; i++) SizedBox(width: cell, height: cell),
        for (var d = 1; d <= daysInMonth; d++)
          Builder(builder: (context) {
            final day = DateTime(_month.year, _month.month, d);
            final events = eventsOf(day);
            final st = styleOf(day);
            final isToday = _sameDay(day, today);
            final isSel = selected != null && _sameDay(day, selected);
            final bg = isSel ? t.peach2 : (st.bg ?? (isToday ? t.peach1 : const Color(0x00000000)));
            final fg = isSel ? const Color(0xFFFFFFFF) : (st.ink ?? (isToday ? t.accentInk : t.ink));
            return GestureDetector(
              key: ValueKey('calendar-day-$d'),
              onTap: () => selectDate(day),
              child: PressScale(
                child: Container(
                  width: cell,
                  height: cell,
                  decoration: BoxDecoration(
                    color: bg,
                    borderRadius: BorderRadius.circular(12),
                    border: isSel ? null : Border.all(color: isToday ? t.peach2 : const Color(0x00000000), width: 2),
                    boxShadow: isSel ? [BoxShadow(color: t.surface, spreadRadius: 2), BoxShadow(color: t.peach2, spreadRadius: 4)] : null,
                  ),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text('$d', style: TextStyle(fontSize: 13, fontWeight: isToday || isSel ? FontWeight.w800 : FontWeight.w500, color: fg, height: 1.5)),
                    if (events.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          for (var i = 0; i < events.length && i < 3; i++) ...[
                            if (i > 0) const SizedBox(width: 2),
                            Container(width: 6, height: 6, decoration: BoxDecoration(color: isSel ? const Color(0xFFFFFFFF) : events[i].color, shape: BoxShape.circle)),
                          ],
                        ]),
                      ),
                  ]),
                ),
              ),
            );
          }),
      ];
      return Wrap(spacing: 4, runSpacing: 4, children: cells);
    });

    final slivers = <Widget>[
      SliverToBoxAdapter(child: header),
      if (lifeStage == 'flow')
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Row(children: [
              for (var i = 0; i < stats.length; i++) ...[
                if (i > 0) const SizedBox(width: 10),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                    decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(18), boxShadow: t.cardShadow),
                    child: Column(children: [
                      Container(
                        width: 30,
                        height: 30,
                        margin: const EdgeInsets.only(bottom: 6),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: stats[i].bg, borderRadius: BorderRadius.circular(10)),
                        child: AIcon(stats[i].icon, size: 14, color: stats[i].ink),
                      ),
                      Text('${stats[i].value}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: t.ink, height: 1.5)),
                      Text(stats[i].label, textAlign: TextAlign.center, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: t.inkSoft, height: 1.5)),
                    ]),
                  ),
                ),
              ],
            ]),
          ),
        ),
      SliverToBoxAdapter(
        child: FramerEnter(
          y: 20,
          child: card(Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                iconBtn(AIcons.chevronLeft, () => setState(() => _month = DateTime(_month.year, _month.month - 1, 1)),
                    tr('calendarscreen_evvelki_ay', 'Ævvəlki ay'), key: const ValueKey('calendar-prev')),
                Text(
                  _capitalize(formatDatePattern(_month, 'MMMM yyyy')),
                  key: const ValueKey('calendar-month'),
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, letterSpacing: -0.16, color: t.ink, height: 1.5),
                ),
                iconBtn(AIcons.chevronRight, () => setState(() => _month = DateTime(_month.year, _month.month + 1, 1)),
                    tr('calendarscreen_novbeti_ay', 'Növbəti ay'), key: const ValueKey('calendar-next')),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(children: [
                for (var i = 0; i < 7; i++) ...[
                  if (i > 0) const SizedBox(width: 4),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text(weekdays[i], textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: t.inkSoft, height: 1.5)),
                    ),
                  ),
                ],
              ]),
            ),
            grid,
          ])),
        ),
      ),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.only(top: 14),
          child: FramerEnter(
            y: 20,
            delay: const Duration(milliseconds: 100),
            child: card(Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(tr('calendarscreen_isareler_c13095', 'İşarələr'), style: x.aCardTitle)),
              LayoutBuilder(builder: (context, c) {
                final w = (c.maxWidth - 8) / 2;
                return Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final l in legend)
                    Container(
                      width: w,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(color: t.surfaceSoft, borderRadius: BorderRadius.circular(12)),
                      child: Row(children: [
                        Container(width: 12, height: 12, decoration: BoxDecoration(color: l.color, shape: BoxShape.circle)),
                        const SizedBox(width: 8),
                        Flexible(child: Text(l.label, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: t.inkSoft, height: 1.5))),
                      ]),
                    ),
                ]);
              }),
            ])),
          ),
        ),
      ),
      if (selected != null)
        SliverToBoxAdapter(
          child: Padding(
            key: const ValueKey('calendar-selected'),
            padding: const EdgeInsets.only(top: 14),
            child: FramerEnter(
              key: ValueKey(localDateKey(selected)),
              y: 20,
              child: card(Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                        Text(formatDatePattern(selected, 'd MMMM, EEEE'), style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: t.ink, height: 1.5)),
                        if (lifeStage == 'flow' && cycleData != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text('${tr('calendarscreen_tsikl_gunu_51cdf3', 'Tsikl günü:')} ${getCycleDayForDate(selected, lastPeriodDate, cycleLength)}',
                                style: TextStyle(fontSize: 11, color: t.inkSoft, height: 1.5)),
                          ),
                      ]),
                    ),
                    AButton(
                      key: const ValueKey('calendar-add-soft'),
                      variant: AButtonVariant.pillSoft,
                      onPressed: () => open(context, defaultDate: selected),
                      leading: const AIcon(AIcons.plus, size: 14),
                      child: Text(tr('calendarscreen_elave_et_6e1b9b', 'Əlavə et')),
                    ),
                  ]),
                ),
                if (selectedEvents.isEmpty && selectedAppointments.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Column(children: [
                      Padding(padding: const EdgeInsets.only(bottom: 8), child: AIcon(AIcons.calendar, size: 36, color: t.inkFaint)),
                      Text(tr('calendarscreen_bu_gun_ucun_hadise_yoxdur_a394c8', 'Bu gün üçün hadisə yoxdur'),
                          style: TextStyle(fontSize: 13, color: t.inkSoft, height: 1.5)),
                    ]),
                  )
                else ...[
                  for (final e in selectedEvents)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                        decoration: BoxDecoration(color: t.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                        child: Row(children: [
                          Container(width: 12, height: 12, decoration: BoxDecoration(color: e.color, shape: BoxShape.circle)),
                          const SizedBox(width: 12),
                          Expanded(child: Text(e.label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: t.ink, height: 1.5))),
                        ]),
                      ),
                    ),
                  for (final a in selectedAppointments)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: GestureDetector(
                        key: ValueKey('calendar-appt-${a.id}'),
                        onTap: () => open(context, appointment: a),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
                          decoration: BoxDecoration(color: t.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                          child: Row(children: [
                            Container(width: 12, height: 12, decoration: const BoxDecoration(color: CalendarDots.appointment, shape: BoxShape.circle)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(a.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: t.ink, height: 1.5)),
                            ),
                            const SizedBox(width: 12),
                            DefaultTextStyle.merge(
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.inkSoft),
                              child: Row(mainAxisSize: MainAxisSize.min, children: [
                                if (a.reminderEnabled) ...[AIcon(AIcons.bell, size: 12, color: t.inkSoft), const SizedBox(width: 6)],
                                if (a.eventTime != null) ...[Text(a.eventTime!.length > 5 ? a.eventTime!.substring(0, 5) : a.eventTime!), const SizedBox(width: 6)],
                                AIcon(AIcons.chevronRight, size: 14, color: t.inkSoft, mirrorInRtl: true),
                              ]),
                            ),
                          ]),
                        ),
                      ),
                    ),
                ],
              ])),
            ),
          ),
        ),
      const SliverToBoxAdapter(child: SizedBox(height: 96)),
    ];

    return AScope(
      child: ColoredBox(
        color: t.bg,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: CustomScrollView(key: const ValueKey('calendar-scroll'), slivers: slivers),
        ),
      ),
    );
  }
}

/// `className="capitalize"` (first letter of each word).
String _capitalize(String s) => s.split(' ').map((w) => w.isEmpty ? w : (w[0] == 'i' ? 'İ' : w[0].toUpperCase()) + w.substring(1)).join(' ');

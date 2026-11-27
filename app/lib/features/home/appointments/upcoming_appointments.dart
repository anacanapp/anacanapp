// Ported from: src/components/home/UpcomingAppointments.tsx (home "Upcoming" card: next 4 appointments,
//              add / edit in the AppointmentSheet)
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../domain/js_compat.dart' show DomainClock;

import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../data/appointments.dart';
import '../home_inputs.dart';
import '../widgets/home_widgets.dart';
import 'appointment_sheet.dart';

/// Opens the appointment sheet; tests override it to observe the call.
typedef AppointmentSheetOpener = Future<void> Function(BuildContext context, {Appointment? appointment, DateTime? defaultDate});

final appointmentSheetOpenerProvider = Provider<AppointmentSheetOpener>((ref) => showAppointmentSheet);

class UpcomingAppointments extends ConsumerWidget {
  const UpcomingAppointments({super.key, this.now});
  final DateTime Function()? now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(homeUserIdProvider);
    final list = ref.watch(appointmentsQuery).data ?? const <Appointment>[];
    if (user == null) return const SizedBox.shrink();
    final n = (now ?? DomainClock.now)();
    final today = DateTime(n.year, n.month, n.day);
    // Appointments come ordered by date and time.
    final upcoming = list
        .where((a) {
          final d = storedCalendarDate(a.eventDate);
          return d != null && !d.isBefore(today);
        })
        .take(4)
        .toList();
    final open = ref.read(appointmentSheetOpenerProvider);
    final t = context.a;
    final x = context.aText;

    return AHomeSection(
      title: tr('calendarscreen_teqvim_584bdd', 'Təqvim'),
      trailing: GestureDetector(
        key: const ValueKey('upcoming-add'),
        behavior: HitTestBehavior.opaque,
        onTap: () => open(context),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AIcon(AIcons.plus, size: 14, strokeWidth: 2.2, color: t.onBgSoft),
            const SizedBox(width: 4),
            Text(rd('upcoming_add'), style: x.aSectionLink),
          ],
        ),
      ),
      child: ACard(
        variant: ACardVariant.list,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (upcoming.isEmpty)
              AListRow(
                key: const ValueKey('upcoming-empty'),
                first: true,
                onTap: () => open(context),
                leading: AGradIcon(gradient: t.gradPeach, foreground: t.accentInk, child: const AIcon(AIcons.plus, size: 17)),
                title: '',
                subtitle: null,
                trailing: null,
              ).withSub(rd('upcoming_empty'), x.aListSub)
            else
              for (var i = 0; i < upcoming.length; i++)
                _row(
                  context,
                  upcoming[i],
                  today,
                  first: i == 0,
                  onTap: () => open(context, appointment: upcoming[i]),
                ),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, Appointment a, DateTime today, {required bool first, required VoidCallback onTap}) {
    final t = context.a;
    final x = context.aText;
    final date = storedCalendarDate(a.eventDate)!;
    final days = DateTime.utc(date.year, date.month, date.day).difference(DateTime.utc(today.year, today.month, today.day)).inDays;
    final time = a.eventTime == null ? null : (a.eventTime!.length > 5 ? a.eventTime!.substring(0, 5) : a.eventTime);
    final sub = [dateFnsFormat(date, 'd MMMM'), ?time].where((s) => s.isNotEmpty).join(' · ');
    final when = days == 0
        ? rd('today')
        : days == 1
        ? rd('tomorrow')
        : rd('in_days', {'n': days});
    return GestureDetector(
      key: ValueKey('upcoming-${a.id}'),
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          border: first ? null : Border(top: BorderSide(color: t.line)),
        ),
        child: Row(
          children: [
            AGradIcon(gradient: t.gradPeach, foreground: t.accentInk, child: const AIcon(AIcons.calendar, size: 17)),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(a.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aListTitle),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (a.reminderEnabled) ...[
                          Semantics(
                            label: rd('appt_remind'),
                            child: AIcon(AIcons.bell, size: 11, color: t.inkSoft),
                          ),
                          const SizedBox(width: 4),
                        ],
                        Flexible(child: Text(sub, style: x.aListSub)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 13),
            Text(when, textAlign: TextAlign.end, style: x.aListValue),
          ],
        ),
      ),
    );
  }
}

extension on AListRow {
  /// The empty-state row shows only a `.a-list-sub` paragraph (white-space normal) next to the icon.
  Widget withSub(String text, TextStyle style) => Builder(
    builder: (context) {
      return GestureDetector(
        key: key,
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              ?leading,
              const SizedBox(width: 13),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(text, style: style),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// `format(date, pattern, { locale })` with date-fns names: date-fns' `az` locale capitalises month and weekday
/// names ("23 Noyabr", "Bazar ertəsi"), intl's `az` data does not.
String dateFnsFormat(DateTime date, String pattern) {
  final text = formatDatePattern(date, pattern);
  if (currentLanguage() != 'az') return text;
  var out = text;
  for (final name in _azDateFnsNames) {
    final lower = name.replaceAll('İ', 'i').toLowerCase();
    out = out.replaceAll(lower, name);
  }
  return out;
}

const List<String> _azDateFnsNames = [
  // Longest first so "bazar ertəsi" wins over "bazar".
  'Çərşənbə axşamı', 'Cümə axşamı', 'Bazar ertəsi', 'Çərşənbə', 'Bazar', 'Cümə', 'Şənbə',
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
];

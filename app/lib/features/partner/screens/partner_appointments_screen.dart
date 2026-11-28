// Ported from: src/components/partner/v2/PartnerAppointmentsScreen.tsx
//
// Her appointments, read-only for the partner (RLS "Partners can view linked appointments"): upcoming ones and the
// last five past ones of the last 30 days. When she does not share appointments a respectful empty state shows.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../settings/ui/settings_ui.dart' show FadeRise;
import '../data/partner_data.dart';
import '../ui/partner_ui.dart';
import 'data/screens_backend.dart';
import 'screens_format.dart';
import 'screens_ui.dart';

/// Upcoming (from today, as loaded) and past (newest first) appointments.
({List<Map<String, dynamic>> upcoming, List<Map<String, dynamic>> past}) splitAppointments(List<Map<String, dynamic>> rows, String today) => (
      upcoming: rows.where((r) => '${r['event_date']}'.compareTo(today) >= 0).toList(),
      past: rows.where((r) => '${r['event_date']}'.compareTo(today) < 0).toList().reversed.toList(),
    );

class PartnerAppointmentsScreen extends ConsumerStatefulWidget {
  const PartnerAppointmentsScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<PartnerAppointmentsScreen> createState() => _PartnerAppointmentsScreenState();
}

class _PartnerAppointmentsScreenState extends ConsumerState<PartnerAppointmentsScreen> {
  List<Map<String, dynamic>> _appointments = const [];
  bool _loading = true;
  (String?, bool)? _deps;
  int _seq = 0;

  void _sync(String? userId, bool share) {
    if (_deps == (userId, share)) return;
    _deps = (userId, share);
    final run = ++_seq;
    if (userId == null || userId.isEmpty || !share) {
      _loading = false;
      return;
    }
    unawaited(() async {
      try {
        final rows = await ref.read(partnerScreensBackendProvider).appointmentsFrom(userId, daysAgoKey(30));
        if (mounted && run == _seq) setState(() => _appointments = rows);
      } catch (error) {
        debugPrint('partner appointments: $error');
      } finally {
        if (mounted && run == _seq) setState(() => _loading = false);
      }
    }());
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final data = ref.watch(partnerDataProvider);
    final share = data.sharing.shareAppointments;
    _sync(data.partnerProfile?.userId, share);
    final today = todayKey();
    final split = splitAppointments(_appointments, today);

    Widget section(String title, List<Map<String, dynamic>> rows, bool highlight) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(title, style: context.aText.aSectionTitle)),
          for (final (i, r) in rows.indexed) ...[
            if (i > 0) const SizedBox(height: 8),
            FadeRise(
              key: ValueKey('apt-${r['id']}'),
              dy: 10,
              delay: Duration(milliseconds: i * 40),
              child: _AppointmentRow(row: r, highlight: highlight, today: today),
            ),
          ],
        ]);

    return PartnerSubScreen(
      onBack: widget.onBack,
      eyebrow: tr('partnerv2_onun_vizitleri', 'Onun vizitləri'),
      title: tr('partnerv2_randevular', 'Randevular'),
      children: [
        if (!share)
          PartnerEmptyCard(
            icon: AIcons.calendarHeart,
            title: tr('partnerv2_paylasim_bagli', 'Paylaşım bağlıdır'),
            sub: tr('partnerv2_randevu_paylasimi_bagli_izah', 'Həyat yoldaşınız randevu paylaşımını hazırda bağlayıb.'),
          )
        else if (_loading)
          const PartnerRingLoader()
        else if (_appointments.isEmpty)
          PartnerEmptyCard(
            icon: AIcons.calendarHeart,
            circle: a.blue1,
            iconColor: a.blueInk,
            title: tr('partnerv2_randevu_yoxdur', 'Randevu yoxdur'),
            sub: tr('partnerv2_randevu_yoxdur_izah', 'Həyat yoldaşınız randevu əlavə etdikdə burada görünəcək.'),
          )
        else ...[
          if (split.upcoming.isNotEmpty) section(tr('partnerv2_qarsidan_gelen', 'Qarşıdan gələn'), split.upcoming, true),
          if (split.upcoming.isNotEmpty && split.past.isNotEmpty) const SizedBox(height: 16),
          if (split.past.isNotEmpty) section(tr('partnerv2_kecmis', 'Keçmiş'), split.past.take(5).toList(), false),
        ],
      ],
    );
  }
}

class _AppointmentRow extends StatelessWidget {
  const _AppointmentRow({required this.row, required this.highlight, required this.today});
  final Map<String, dynamic> row;
  final bool highlight;
  final String today;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final (icon, bg, ink) = switch (row['event_type']) {
      'pill' => (AIcons.pill, a.green1, a.greenInk),
      'reminder' => (AIcons.bell, a.yellow1, a.yellowInk),
      _ => (AIcons.stethoscope, a.blue1, a.blueInk),
    };
    final date = '${row['event_date'] ?? ''}';
    final isToday = date == today;
    final day = storedCalendarDate(date);
    final time = row['event_time'] is String ? row['event_time'] as String : null;
    final description = row['description'] is String ? row['description'] as String : null;
    final when = '${day == null ? date : fmtWeekdayDayMonth(day)}${time != null && time.isNotEmpty ? ' · ${time.length > 5 ? time.substring(0, 5) : time}' : ''}';
    return Opacity(
      opacity: highlight ? 1 : 0.6,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: a.surface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: a.cardShadow,
          border: Border.all(color: isToday ? a.blue2 : const Color(0x00000000), width: 1.5),
        ),
        child: Row(children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14)),
            child: AIcon(icon, size: 18, color: ink),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text('${row['title'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(13.5, weight: FontWeight.w700, color: a.ink))),
                if (isToday) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: a.blue2, borderRadius: BorderRadius.circular(999)),
                    child: Text(tr('partnerv2_bu_gun', 'Bu gün'), style: pText(9.5, weight: FontWeight.w800, color: const Color(0xFFFFFFFF))),
                  ),
                ],
              ]),
              Padding(padding: const EdgeInsets.only(top: 1), child: Text(when, style: pText(11.5, color: a.inkSoft))),
              if (description != null && description.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: Text(description, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(11, color: a.inkFaint)),
                ),
            ]),
          ),
        ]),
      ),
    );
  }
}

// Ported from: the data effects of src/components/partner/v2/NextAppointmentCard.tsx and PartnerBabyTodayCard.tsx
//
// The mother's next appointment (RLS "Partners can view linked appointments") and today's baby log totals (live
// on her baby_logs), as the two partner home cards read them. Errors are silent: the card does not show.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart' show DomainClock;
import 'partner_backend.dart';

/// `AppointmentRow`.
typedef PartnerAppointment = ({String id, String title, String eventDate, String? eventTime, String? eventType});

/// The first appointment from today of [motherUserId], or null.
final partnerNextAppointmentProvider = FutureProvider.autoDispose.family<PartnerAppointment?, String>((ref, motherUserId) async {
  if (motherUserId.isEmpty) return null;
  try {
    final rows = await ref.read(partnerBackendProvider).nextAppointment(motherUserId, todayKey());
    if (rows.isEmpty) return null;
    final r = rows.first;
    return (
      id: '${r['id'] ?? ''}',
      title: '${r['title'] ?? ''}',
      eventDate: '${r['event_date'] ?? ''}',
      eventTime: r['event_time'] is String ? r['event_time'] as String : null,
      eventType: r['event_type'] is String ? r['event_type'] as String : null,
    );
  } catch (_) {
    return null;
  }
});

/// `DayAgg` of PartnerBabyTodayCard.
@immutable
class BabyDayAgg {
  const BabyDayAgg({required this.feeds, required this.totalMl, required this.sleepMin, required this.sleepOngoing, required this.diapers});
  final int feeds;
  final num totalMl;
  final double sleepMin;
  final bool sleepOngoing;
  final int diapers;
}

/// Aggregates today's `baby_logs` rows.
BabyDayAgg aggregateBabyDay(List<Map<String, dynamic>> logs) {
  final feeds = logs.where((l) => l['log_type'] == 'feeding').toList();
  final sleeps = logs.where((l) => l['log_type'] == 'sleep').toList();
  var sleepMin = 0.0;
  for (final l in sleeps) {
    final end = DateTime.tryParse('${l['end_time'] ?? ''}');
    final start = DateTime.tryParse('${l['start_time'] ?? ''}');
    if (l['end_time'] == null || end == null || start == null) continue;
    final m = end.difference(start).inMilliseconds / 60000;
    sleepMin += m > 0 ? m : 0;
  }
  return BabyDayAgg(
    feeds: feeds.length,
    totalMl: feeds.fold<num>(0, (s, l) => s + (l['amount_ml'] is num ? l['amount_ml'] as num : 0)),
    sleepMin: sleepMin,
    sleepOngoing: sleeps.any((l) => l['end_time'] == null),
    diapers: logs.where((l) => l['log_type'] == 'diaper').length,
  );
}

/// Today's totals of [motherUserId]'s baby logs, refreshed on every change of her rows; null until loaded.
final partnerBabyTodayProvider = NotifierProvider.autoDispose.family<PartnerBabyTodayController, BabyDayAgg?, String>(PartnerBabyTodayController.new);

class PartnerBabyTodayController extends Notifier<BabyDayAgg?> {
  PartnerBabyTodayController(this.motherUserId);
  final String motherUserId;

  @override
  BabyDayAgg? build() {
    if (motherUserId.isEmpty) return null;
    scheduleMicrotask(() {
      if (ref.mounted) unawaited(fetchToday());
    });
    ref.read(partnerBackendProvider).subscribe(ref,
        channelPrefix: 'partner-baby-strip-$motherUserId',
        table: 'baby_logs',
        filter: 'user_id=eq.$motherUserId',
        onChange: (_) => unawaited(fetchToday()));
    return null;
  }

  Future<void> fetchToday() async {
    try {
      final now = DomainClock.now();
      final startOfDay = DateTime(now.year, now.month, now.day);
      final rows = await ref.read(partnerBackendProvider).babyLogsSince(motherUserId, startOfDay.toUtc().toIso8601String());
      if (ref.mounted) state = aggregateBabyDay(rows);
    } catch (_) {
      // silent
    }
  }
}

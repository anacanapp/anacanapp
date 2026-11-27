// Ported from: src/components/mommy/QuickStatsWidget.tsx
//
// Weekly review: per-day mini-dot sparklines of the last 7 days (feeding count, sleep hours, diapers).
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart';
import '../../baby/hooks/use_baby_logs.dart';
import 'mommy_ui.dart';

class DayStats {
  const DayStats(this.date, this.feedingCount, this.sleepHours, this.diaperCount);
  final String date;
  final int feedingCount;
  final double sleepHours;
  final int diaperCount;
}

/// `getWeeklyStats()`: oldest → today.
List<DayStats> weeklyStats(List<BabyLog> logs, [DateTime? now]) {
  final n = now ?? DomainClock.now();
  return [
    for (var i = 6; i >= 0; i--)
      () {
        final dateStr = localDateKey(DateTime(n.year, n.month, n.day - i, n.hour, n.minute));
        final day = [for (final l in logs) if (localDayOf(l.startTime) == dateStr) l];
        var sleepMinutes = 0.0;
        for (final l in day.where((l) => l.logType == 'sleep')) {
          final s = l.start, e = l.end;
          if (s != null && e != null) sleepMinutes += (e.millisecondsSinceEpoch - s.millisecondsSinceEpoch) / 60000;
        }
        return DayStats(
          dateStr,
          day.where((l) => l.logType == 'feeding').length,
          jsRound(sleepMinutes / 60 * 10) / 10,
          day.where((l) => l.logType == 'diaper').length,
        );
      }(),
  ];
}

/// `Number.prototype.toFixed(1)`.
String toFixed1(double v) => (jsRound(v * 10) / 10).toStringAsFixed(1);

class QuickStatsWidget extends ConsumerWidget {
  const QuickStatsWidget({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(appLanguageProvider);
    final logs = ref.watch(babyLogsProvider).logs;
    final stats = weeklyStats(logs);
    double avg(num Function(DayStats d) f) => stats.fold<num>(0, (s, d) => s + f(d)) / 7;
    final rows = [
      ('feeding', '🍽️', tr('quickstatswidget_ort_qidalanma', 'Ort. qidalanma'), toFixed1(avg((d) => d.feedingCount)),
          [for (final d in stats) d.feedingCount.toDouble()]),
      ('sleep', '🌙', tr('quickstatswidget_ort_yuxu_s', 'Ort. yuxu (s)'), toFixed1(avg((d) => d.sleepHours)), [for (final d in stats) d.sleepHours]),
      ('diaper', '🧷', tr('quickstatswidget_ort_bez', 'Ort. bez'), toFixed1(avg((d) => d.diaperCount)),
          [for (final d in stats) d.diaperCount.toDouble()]),
    ];
    final t = context.a;
    final x = context.aText;
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ASectionHead(title: tr('quickstatswidget_heftelik_baxis_625baf', 'Həftəlik Baxış')),
          AFadeIn(
            child: ACard(
              variant: ACardVariant.list,
              child: Column(
                children: [
                  for (var r = 0; r < rows.length; r++)
                    () {
                      final (key, icon, label, value, data) = rows[r];
                      final max = data.fold<double>(1, (m, v) => v > m ? v : m);
                      return AListRow(
                        key: ValueKey('quickstats-$key'),
                        first: r == 0,
                        title: label,
                        subtitle: tr('mommy_this_week', 'Bu həftə'),
                        leading: AListIcon(background: t.surfaceSoft, child: Text(icon, style: const TextStyle(fontSize: 17))),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(
                              height: 18,
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  for (var i = 0; i < data.length; i++) ...[
                                    if (i > 0) const SizedBox(width: 3),
                                    Container(
                                      width: 4,
                                      height: 4 + jsRound(data[i] / max * 13),
                                      decoration: BoxDecoration(
                                        color: i == data.length - 1 && data[i] > 0 ? t.peach2 : t.lineStrong,
                                        borderRadius: BorderRadius.circular(2),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            Text(value, style: x.aListValue),
                          ],
                        ),
                      );
                    }(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

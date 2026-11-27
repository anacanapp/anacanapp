// Ported from: src/lib/baby-logs-range.test.ts

import 'package:anacan/domain/baby/baby_logs_range.dart';
import 'package:anacan/domain/js_compat.dart';
import 'package:flutter_test/flutter_test.dart';

String iso(int h, [int m = 0, int day = 26]) => jsToIsoString(DateTime(2026, 10, day, h, m));

final logs = [
  BabyLogRow(id: '1', logType: 'feeding', feedType: 'breast_left', startTime: iso(8), endTime: iso(8, 15)),
  BabyLogRow(id: '2', logType: 'feeding', feedType: 'formula', notes: '120 ml', startTime: iso(11)),
  BabyLogRow(id: '3', logType: 'feeding', feedType: 'solid', notes: 'Banan', startTime: iso(14)),
  BabyLogRow(id: '4', logType: 'sleep', startTime: iso(9), endTime: iso(10, 30)),
  BabyLogRow(id: '5', logType: 'diaper', diaperType: 'wet', startTime: iso(9)),
  BabyLogRow(id: '6', logType: 'diaper', diaperType: 'mixed', startTime: iso(13)),
  BabyLogRow(id: '7', logType: 'diaper', diaperType: 'dirty', startTime: iso(13, 0, 25)),
];

void main() {
  group('baby log statistics', () {
    test('summarises feeding with breast minutes, formula ml and the average gap', () {
      final s = feedingStats(logs);
      expect([s.total, s.left, s.right, s.breastMinutes, s.formulaCount, s.formulaMl, s.solidCount], [3, 1, 0, 15, 1, 120, 1]);
      expect(s.averageGapMinutes, 180);
      expect(s.last?.kind, 'solid');
    });

    test('summarises sleep and diapers', () {
      final sl = sleepStats(logs);
      expect([sl.totalMinutes, sl.longestMinutes], [90, 90]);
      final d = diaperStats(logs);
      expect([d.total, d.wet, d.dirty, d.mixed], [3, 1, 1, 1]);
    });

    test('builds daily trend points and newest-first history', () {
      final now = DateTime(2026, 10, 26, 20);
      final trend = trendPoints(logs, 'diaper', now, 7);
      expect(trend, hasLength(7));
      expect(trend[6].count, 2);
      expect(trend[5].count, 1);
      expect(trendPoints(logs, 'sleep', now, 90), hasLength(13));
      final h = dailyHistory(logs, now, 2)[0];
      expect([h.feedings, h.formulaMl, h.sleepMinutes, h.diapers], [3, 120, 90, 2]);
    });

    test('formats durations and parses ml', () {
      expect(formatMinutes(95, hour: 's', minute: 'dəq'), '1 s 35 dəq');
      expect(formatMinutes(60, hour: 'h', minute: 'min'), '1 h');
      expect(formatClockSeconds(3725), '1:02:05');
      expect(mlFromNotes('90,5 ml'), 90.5);
      expect(mlFromNotes('Banan'), isNull);
    });
  });
}

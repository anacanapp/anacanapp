// Ported from: src/lib/health-report-data.test.ts
import 'dart:convert';

import 'package:anacan/features/health_screens/doctor_report/health_report_data.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, dynamic> row(Map<String, dynamic> values) => {
      'id': 'log',
      'log_type': 'feeding',
      'start_time': '2026-09-15T12:00:00',
      'end_time': null,
      'feed_type': null,
      'diaper_type': null,
      'amount_ml': null,
      'notes': null,
      ...values,
    };

void main() {
  group('clinical report source data', () {
    test('uses seven calendar days, calendar months, and no artificial cutoff for all records', () {
      final now = DateTime(2026, 9, 15, 15);
      expect(getReportRange('1week', now).startDay, '2026-09-09');
      expect(getReportRange('1month', now).startDay, '2026-08-15');
      expect(getReportRange('3months', now).startDay, '2026-06-15');
      expect(getReportRange('all', now).start, isNull);
    });

    test('does not turn missing measurements or unlogged days into zeros', () {
      expect(meanRecorded([null, null, '', 'bad']), (value: null, count: 0));
      expect(meanRecorded([null, 0, 6, '8']), (value: 14 / 3, count: 3));
    });

    test('clips completed sleep at the reporting boundary, splits midnight, and excludes ongoing sleep', () {
      final range = getReportRange('1week', DateTime(2026, 9, 15, 12));
      final result = summarizeBabyCare([
        row({'log_type': 'sleep', 'start_time': '2026-09-08T22:00:00', 'end_time': '2026-09-09T02:00:00'}),
        row({'log_type': 'sleep', 'start_time': '2026-09-14T23:00:00', 'end_time': '2026-09-15T01:00:00'}),
        row({'log_type': 'sleep', 'start_time': '2026-09-15T10:00:00', 'end_time': null}),
      ], range);
      expect(result.sleepMinutes, 240);
      expect(result.sleepDays, 3);
      expect(result.sleepAverage, 80);
      expect(result.ongoingSleep, 1);
    });

    test('preserves feeding types and does not invent wet/dirty events for unknown diapers', () {
      final result = summarizeBabyCare([
        row({'feed_type': 'breast_left'}),
        row({'feed_type': 'right'}),
        row({'feed_type': 'formula', 'amount_ml': 120}),
        row({'feed_type': 'formula', 'notes': '90 ml'}),
        row({'feed_type': 'solid'}),
        row({'log_type': 'diaper', 'diaper_type': null}),
        row({'log_type': 'diaper', 'diaper_type': 'mixed'}),
        row({'log_type': 'diaper', 'diaper_type': 'wet'}),
      ], getReportRange('1month', DateTime(2026, 9, 15, 15)));
      expect(
        (result.feeding, result.breast, result.formula, result.solid, result.formulaMl, result.formulaAmounts),
        (5, 2, 2, 1, 210, 2),
      );
      expect((result.feedingAverage, result.feedingDays, result.diapers, result.wet, result.dirty, result.mixed, result.unknownDiapers), (5, 1, 3, 1, 0, 1, 1));
    });

    test('loads all report pages and exposes failures instead of returning an empty clinical result', () async {
      final source = List.generate(2105, (id) => {'id': id});
      final result = await fetchAllReportRows<Map<String, int>>((from, to) async => source.sublist(from, to + 1 > source.length ? source.length : to + 1));
      expect(result, hasLength(2105));
      await expectLater(fetchAllReportRows<Object>((from, to) async => throw StateError('offline')), throwsA(isA<StateError>().having((e) => e.message, 'message', 'offline')));
    });

    test('rehydrates persisted report dates before any age/duration calculations', () {
      final original = HealthReportSnapshot(range: getReportRange('1month', DateTime(2026, 9, 15, 15)));
      final restored = rehydrateReportSnapshot(jsonDecode(jsonEncode(original.toJson())));
      expect(restored.range.end.millisecondsSinceEpoch, original.range.end.millisecondsSinceEpoch);
      expect(restored.range.start?.millisecondsSinceEpoch, original.range.start?.millisecondsSinceEpoch);
      expect(summarizeBabyCare(const [], restored.range).sleepAverage, isNull);
    });
  });
}

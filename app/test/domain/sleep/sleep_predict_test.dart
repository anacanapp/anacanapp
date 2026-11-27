// Ported from: src/lib/sleep-widgets.test.ts ("next nap prediction" and "sleep notifications plan" groups; the
// home-widget groups test src/lib/home-widgets.ts + widget JSON, which belong to the widgets port)

import 'package:anacan/domain/sleep/nap_alerts.dart';
import 'package:anacan/domain/sleep/sleep_predict.dart';
import 'package:anacan/domain/sleep/sleep_training.dart';
import 'package:flutter_test/flutter_test.dart';

DateTime at(int h, [int m = 0, int dayOffset = 0]) => DateTime(2026, 11, 10 + dayOffset, h, m);
SleepEntry nap(DateTime s, DateTime e, [String? id]) =>
    SleepEntry(id: id ?? '${s.millisecondsSinceEpoch}', start: s, end: e, minutes: (e.difference(s).inMilliseconds / 60000).round(), kind: 'nap');

void main() {
  group('next nap prediction', () {
    test('learns the awake time from logged daytime gaps', () {
      final entries = <SleepEntry>[];
      for (var d = -6; d <= -1; d++) {
        entries.addAll([nap(at(9, 0, d), at(10, 0, d)), nap(at(12, 30, d), at(13, 30, d))]);
      }
      final gaps = awakeGaps(entries, at(14));
      expect(gaps.every((g) => g == 150), true);
      final ww = personalWakeWindow(entries, '4-6', at(14));
      expect(ww.samples, 6);
      expect(ww.minutes, greaterThan(120));
      expect(ww.minutes, lessThan(150));
    });

    test('opens the window after the age wake time and pulls it earlier with sleepy cues', () {
      final entries = [nap(at(10, 40), at(12, 45))];
      final base = predictNextNap(entries: entries, band: '1-3', now: at(13, 0));
      expect(base.state, 'early');
      expect(base.lastWake?.millisecondsSinceEpoch, at(12, 45).millisecondsSinceEpoch);
      expect(base.awakeMinutes, 15);
      expect(base.windowStart!.millisecondsSinceEpoch, greaterThan(at(13, 30).millisecondsSinceEpoch));
      final cued = predictNextNap(entries: entries, band: '1-3', now: at(13, 0), cues: ['yawn', 'rub_eyes']);
      expect((base.windowStart!.millisecondsSinceEpoch - cued.windowStart!.millisecondsSinceEpoch) / 60000, 10);
      expect(predictNextNap(entries: entries, band: '1-3', now: at(13, 0), sleepingSince: at(12, 59)).state, 'sleeping');
      expect(predictNextNap(entries: const [], band: '1-3', now: at(13, 0)).state, 'unknown');
      expect(predictNextNap(entries: entries, band: '1-3', now: at(16, 30)).state, 'overtired');
    });

    test('turns a late window into bedtime and plans the rest of the day', () {
      final late = predictNextNap(entries: [nap(at(17, 0), at(18, 0))], band: '7-9', now: at(18, 10));
      expect(late.isBedtime, true);
      final entries = [nap(at(9, 0), at(9, 45))];
      final next = predictNextNap(entries: entries, band: '4-6', now: at(10, 0));
      final plan = predictDay(entries: entries, band: '4-6', now: at(10, 0), next: next);
      expect(plan.first.status, 'done');
      expect(plan.where((p) => p.status == 'predicted' && p.kind == 'nap').length, greaterThanOrEqualTo(2));
      expect(plan.last.kind, 'bedtime');
      expect(plan.last.start.millisecondsSinceEpoch, bedtimeFor('4-6', at(10)).millisecondsSinceEpoch);
      expect(windowFactor(0), lessThan(windowFactor(3)));
    });

    test('lists upcoming regressions from the birth date', () {
      final birth = DateTime(2026, 7, 1);
      final list = upcomingRegressions(birth, DateTime(2026, 10, 1));
      expect(list.first.key, 'm4');
      expect(list.first.daysUntil, greaterThan(0));
      expect(upcomingRegressions(birth, DateTime(2026, 10, 25)).first.active, true);
    });
  });

  group('sleep notifications plan', () {
    final text = NapAlertText(napTitle: (m) => 'in $m', napBody: 'b', longTitle: 'l', longBody: 'lb', regressTitle: 'r', regressBody: 'rb');
    test('schedules before the window, for long naps and before regressions, never in quiet hours', () {
      final now = at(13, 0);
      final next = predictNextNap(entries: [nap(at(10, 40), at(12, 45))], band: '1-3', now: now);
      final planned = planNapAlerts(settings: defaultNapAlerts, now: now, next: next, sleepingSince: null, regression: null, text: text);
      expect(planned, hasLength(1));
      expect(planned[0].at.millisecondsSinceEpoch, next.windowStart!.millisecondsSinceEpoch - 15 * 60000);
      final long = planNapAlerts(
          settings: defaultNapAlerts, now: now, next: next.copyWith(state: 'sleeping', windowStart: null), sleepingSince: at(12, 30), regression: null, text: text);
      expect(long[0].at.millisecondsSinceEpoch, at(14, 30).millisecondsSinceEpoch);
      expect(planNapAlerts(settings: defaultNapAlerts.copyWith(enabled: false), now: now, next: next, sleepingSince: null, regression: null, text: text), isEmpty);
      expect(inQuietHours(at(23)), true);
      expect(inQuietHours(at(8)), false);
    });

    test('regression alert at 10:00 a week before, and stored settings parse like readNapAlerts', () {
      final birth = DateTime(2026, 7, 1);
      final reg = upcomingRegressions(birth, DateTime(2026, 9, 1)).first;
      final planned = planNapAlerts(
          settings: defaultNapAlerts, now: DateTime(2026, 9, 1, 12), next: const NextNap(state: 'unknown'), sleepingSince: null, regression: reg, text: text);
      expect(planned.single.id, NapAlertIds.regression);
      expect([planned.single.at.hour, planned.single.at.minute], [10, 0]);
      expect(parseNapAlerts(null).lead, 15);
      expect(parseNapAlerts('{"lead":5,"quiet":false}').toJson(), {'enabled': true, 'lead': 5, 'longNap': true, 'regression': true, 'quiet': false});
      expect(parseNapAlerts('{"lead":7}').lead, 15);
      expect(parseNapAlerts('nope').enabled, true);
    });
  });

  test('band norms used by the prediction', () => expect(bandNorms['4-6']!.wakeWindowMinutes, [90, 150]));
}

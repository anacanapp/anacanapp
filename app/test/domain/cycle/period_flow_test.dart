// Ported from: src/lib/period-flow.test.ts

import 'package:anacan/domain/cycle/period_flow.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('keeps selected local days rather than converting midnight to the previous UTC day', () {
    expect(localPeriodDate(DateTime(2026, 9, 14, 0, 0)), '2026-09-14');
    expect(localPeriodDate('2026-09-14'), '2026-09-14');
  });
  test('retains all five explicitly selected days and makes repeated selections idempotent', () {
    expect(
      validatePeriodDates(['2026-09-14', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'], DateTime(2026, 9, 14)),
      ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'],
    );
  });
  test('distinguishes had-flow without an amount from no flow, spotting, or no record', () {
    expect(hasPeriodFlow(null), true);
    expect(hasPeriodFlow('unspecified'), true);
    expect(hasPeriodFlow('medium'), true);
    expect(hasPeriodFlow('none'), false);
    expect(hasPeriodFlow('spotting'), false);
    expect(hasPeriodFlow(periodFlowUndefined), false);
    expect(periodFlowLabel(null), 'unspecified');
  });
  test('does not allow empty, malformed or predicted future days to be recorded', () {
    for (final dates in [<Object>[], <Object>['not-a-date'], <Object>['2026-09-15']]) {
      expect(() => validatePeriodDates(dates, DateTime(2026, 9, 14)), throwsA(isA<PeriodDateError>()));
    }
  });
}

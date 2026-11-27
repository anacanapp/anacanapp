// Ported from: src/lib/maternity-regional.test.ts

import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/maternity/maternity_regional.dart';
import 'package:flutter_test/flutter_test.dart';

const dueDate = '2026-12-01';
RegionalMaternityResult calc(RegionalMaternityInput i) => calculateRegionalMaternity(i);
Matcher throwsCode(String pattern) => throwsA(isA<MaternityError>().having((e) => e.code, 'code', matches(pattern)));

void main() {
  test('has one explicit regional rule for each of the twelve expansion countries', () {
    expect([...regionalMaternityCountries]..sort(), ['CN', 'ES', 'FR', 'ID', 'IN', 'JP', 'KR', 'NL', 'PL', 'PT', 'SE', 'VN']);
  });
  test('keeps the Chinese national floor separate from provincial money and adds only specified extensions', () {
    final r = calc(const RegionalMaternityInput(country: 'CN', dueDate: dueDate, earnings: [20000]));
    expect([r.days, r.money, r.agency], [98, null, true]);
    expect(calc(const RegionalMaternityInput(country: 'CN', dueDate: dueDate, birthCount: 2, complicated: true)).days, 128);
  });
  test('uses actual calendar months and the certified Indonesian staged wage rule', () {
    final normal = calc(const RegionalMaternityInput(country: 'ID', dueDate: '2026-08-15', earnings: [10000000]));
    expect(normal.months, 3);
    expect(normal.days, 92);
    expect(formatYmd(normal.end), '2026-11-14');
    expect(normal.money, 30000000);
    expect(calc(const RegionalMaternityInput(country: 'ID', dueDate: dueDate, certifiedExtraMonths: 3, earnings: [10000000])).money, 55000000);
    expect(() => calc(const RegionalMaternityInput(country: 'ID', dueDate: dueDate, certifiedExtraMonths: 4)), throwsA(isA<MaternityError>()));
  });
  test('applies French family-size periods, salary ceilings and year-bound cash limits', () {
    final r = calc(const RegionalMaternityInput(country: 'FR', dueDate: dueDate, earnings: [8000, 8000, 8000]));
    expect([r.days, r.daily, r.money], [112, 104.02, 11650.24]);
    expect(calc(const RegionalMaternityInput(country: 'FR', dueDate: dueDate, earnings: [8000, 8000, 1000])).daily, 78);
    expect(calc(const RegionalMaternityInput(country: 'FR', dueDate: dueDate, existingChildren: 2)).days, 182);
    expect(calc(const RegionalMaternityInput(country: 'FR', dueDate: dueDate, birthCount: 2)).days, 238);
    expect(calc(const RegionalMaternityInput(country: 'FR', dueDate: dueDate, birthCount: 3)).days, 322);
    final y = calc(const RegionalMaternityInput(country: 'FR', dueDate: '2028-12-01', earnings: [4000, 4000, 4000]));
    expect([y.money, y.yearUnsupported], [null, true]);
  });
  test('distinguishes Spain first-year and later flexible weeks, including a sole parent', () {
    final r = calc(const RegionalMaternityInput(country: 'ES', dueDate: dueDate, earnings: [50]));
    expect([r.days, r.entitlementDays, r.money], [119, 133, 5950]);
    expect(calc(const RegionalMaternityInput(country: 'ES', dueDate: dueDate, includeFlexible: true)).days, 133);
    final s = calc(const RegionalMaternityInput(country: 'ES', dueDate: dueDate, soleParent: true));
    expect([s.days, s.entitlementDays], [196, 224]);
    expect(calc(const RegionalMaternityInput(country: 'ES', dueDate: dueDate, soleParent: true, birthCount: 2, includeFlexible: true)).days, 238);
    expect(() => calc(const RegionalMaternityInput(country: 'ES', dueDate: '2025-01-01')), throwsCode('DATE_UNSUPPORTED'));
  });
  test('does not price the other Portuguese parent leave with the claimant wage', () {
    final a = calc(const RegionalMaternityInput(country: 'PT', dueDate: dueDate, earnings: [1350]));
    expect([a.days, a.daily, a.money], [120, 45, 5400]);
    final b = calc(const RegionalMaternityInput(country: 'PT', dueDate: dueDate, portuguesePlan: 'shared150', earnings: [1350]));
    expect([b.days, b.entitlementDays, b.money], [120, 150, 5400]);
    final c = calc(const RegionalMaternityInput(country: 'PT', dueDate: dueDate, portuguesePlan: 'shared180-90', earnings: [1350]));
    expect([c.days, c.entitlementDays, c.daily, c.money], [120, 180, 40.5, 4860]);
    expect(() => calc(const RegionalMaternityInput(country: 'PT', dueDate: dueDate, portuguesePlan: 'shared150', ownDays: 150)), throwsCode('PERSONAL_DAYS'));
    final d = calc(const RegionalMaternityInput(country: 'PT', dueDate: dueDate, birthCount: 2, earnings: [1350]));
    expect([d.agency, d.money], [true, null]);
  });
  test('values Vietnamese leave in insured months and handles a leap-year calendar', () {
    final v = calc(const RegionalMaternityInput(country: 'VN', dueDate: '2028-01-15', birthCount: 2, earnings: [10000000]));
    expect(v.months, 7);
    expect(v.money, 70000000);
    expect(formatYmd(v.end), '2028-08-14');
    expect(v.days, isNot(210));
    expect(() => calc(const RegionalMaternityInput(country: 'VN', dueDate: dueDate, startDate: '2026-08-01')), throwsCode('START_OUTSIDE'));
  });
  test('uses India surviving-child rule rather than automatically extending for twins', () {
    final a = calc(const RegionalMaternityInput(country: 'IN', dueDate: dueDate, birthCount: 2, earnings: [500]));
    expect([a.days, a.money], [182, 91000]);
    final b = calc(const RegionalMaternityInput(country: 'IN', dueDate: dueDate, existingChildren: 2));
    expect([b.days, b.before], [84, 42]);
  });
  test('reproduces the Japanese insurer rounding example and its birth-day convention', () {
    final r = calc(const RegionalMaternityInput(country: 'JP', dueDate: dueDate, earnings: [170000]));
    expect([r.days, r.daily, r.money], [98, 3780, 370440]);
    expect(formatYmd(r.start), '2026-10-21');
    expect(formatYmd(r.end), '2027-01-26');
    expect(calc(const RegionalMaternityInput(country: 'JP', dueDate: dueDate, earnings: [400000], shortInsuranceJapan: true, paidSalaryDaily: 1000)).daily, 6113);
    final p = calc(const RegionalMaternityInput(country: 'JP', dueDate: dueDate, startDate: dueDate, earnings: [170000]));
    expect(p.days, 57);
    expect(formatYmd(p.end), '2027-01-26');
  });
  test('preserves Korean premature/multiple minima and never fabricates the mixed insurance award', () {
    final a = calc(const RegionalMaternityInput(country: 'KR', dueDate: dueDate));
    expect([a.days, a.agency, a.money], [90, true, null]);
    expect(calc(const RegionalMaternityInput(country: 'KR', dueDate: dueDate, premature: true)).days, 100);
    final b = calc(const RegionalMaternityInput(country: 'KR', dueDate: dueDate, birthCount: 2, premature: true));
    expect([b.days, b.before], [120, 60]);
  });
  test('uses Polish maternity durations and treats the combined allowance option separately', () {
    expect([for (var n = 1; n <= 5; n++) calc(RegionalMaternityInput(country: 'PL', dueDate: dueDate, birthCount: n)).days], [140, 217, 231, 245, 259]);
    expect(calc(const RegionalMaternityInput(country: 'PL', dueDate: dueDate, earnings: [100], combinedPoland: true)).money, 11410);
  });
  test('uses UWV due-date counting and a valid prenatal window without an uncapped salary estimate', () {
    final v = calc(const RegionalMaternityInput(country: 'NL', dueDate: dueDate, earnings: [5000]));
    expect([v.days, v.agency, v.money], [112, true, null]);
    expect(formatYmd(v.start), '2026-10-21');
    expect(calc(const RegionalMaternityInput(country: 'NL', dueDate: dueDate, birthCount: 2)).days, 140);
    expect(() => calc(const RegionalMaternityInput(country: 'NL', dueDate: dueDate, startDate: '2026-11-25')), throwsCode('START_OUTSIDE'));
  });
  test('keeps Swedish family allocation distinct from a person selected benefit days', () {
    final a = calc(const RegionalMaternityInput(country: 'SE', dueDate: dueDate, earnings: [800]));
    expect([a.days, a.entitlementDays, a.incomeDays, a.minimumDays, a.money], [240, 480, 195, 45, 164100]);
    final b = calc(const RegionalMaternityInput(country: 'SE', dueDate: dueDate, birthCount: 2, soleParent: true));
    expect([b.days, b.entitlementDays], [660, 660]);
    expect(() => calc(const RegionalMaternityInput(country: 'SE', dueDate: dueDate, swedenIncomeDays: 391)), throwsCode('PERSONAL_DAYS'));
  });
  test('rejects malformed dates and nonfinite or negative earnings', () {
    expect(() => calc(const RegionalMaternityInput(country: 'FR', dueDate: '2026-02-30')), throwsCode('DATE_INVALID'));
    for (final amount in [double.nan, double.infinity, -1]) {
      expect(() => calc(RegionalMaternityInput(country: 'PL', dueDate: dueDate, earnings: [amount])), throwsCode('INPUT_INVALID'));
    }
  });
}

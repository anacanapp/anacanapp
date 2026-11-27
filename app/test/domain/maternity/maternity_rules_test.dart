// Tests for app/lib/domain/maternity/maternity_rules.dart. MaternityCalculator.tsx and useMaternityBenefits.ts have
// no vitest suite; expected values follow the TypeScript arithmetic (and test/domain/fixtures/maternity_calc.*
// are produced by running that arithmetic in Node, see app/tool/domain/gen_fixtures.mjs).

import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/domain/maternity/maternity_rules.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers.dart';

void main() {
  test('the rules table keeps Azerbaijan first and every country has leave days', () {
    expect(maternityRules.first.code, 'AZ');
    expect(maternityRuleFor('ZZ').code, 'AZ');
    for (final r in maternityRules) {
      expect(r.normalDaysBefore + r.normalDaysAfter, greaterThan(0), reason: r.code);
      expect(r.guidelines('xx'), r.guidelines('en'));
    }
  });

  test('Azerbaijan benefit uses the minimum salary and the 25 × pension monthly cap', () {
    final b = calculateAzBenefit(const MaternityConfig(), 300, 'normal');
    expect(b['monthlySalaryUsed'], 400);
    expect(b['dailySalary'], jsRound(400 * 12 / 365 * 100) / 100);
    expect(b['totalLeaveDays'], 126);
    final capped = calculateAzBenefit(const MaternityConfig(), 100000, 'multiple');
    expect(capped['dailySalary'], jsRound(25 * 320 * 12 / 365 * 100) / 100);
    expect(capped['totalLeaveDays'], 140);
    expect(MaternityConfig.fromRows([{'config_key': 'min_salary', 'value': 0}, {'config_key': 'birth_benefit', 'value': 800}]).minSalary, 400);
  });

  test('leave dates: mother before the due date, father from the due date', () {
    final az = maternityRuleFor('AZ');
    final m = calculateMaternityLeave(rule: az, role: 'mother', pregnancyType: 'normal', eddDate: '2026-12-01T00:00')!;
    expect(formatYmd(m.leaveStartDate), formatYmd(DateTime(2026, 12, 1).subtract(const Duration(days: 70))));
    expect(m.totalDays, 126);
    expect(formatYmd(m.returnToWorkDate), formatYmd(addDays(DateTime(2026, 9, 22), 126)));
    final f = calculateMaternityLeave(rule: az, role: 'father', pregnancyType: 'normal', eddDate: '2026-12-01T00:00')!;
    expect(f.daysAfter, 14);
    expect(f.benefit?['isPaternity'], true);
    expect(calculateMaternityLeave(rule: az, role: 'mother', pregnancyType: 'normal', eddDate: ''), isNull);
  });

  test('matches the TypeScript calculator for every country (fixture)', () {
    final fixture = loadFixture('maternity_calc')! as List;
    for (final c in fixture.cast<Map>()) {
      final r = calculateMaternityLeave(
        rule: maternityRuleFor(c['code'] as String),
        role: c['role'] as String,
        pregnancyType: c['pregnancyType'] as String,
        eddDate: c['edd'] as String,
        salary: c['salary'] as String,
        isAz: c['isAz'] as bool,
        azConfig: c['azConfig'] == true ? const MaternityConfig() : null,
      )!;
      final out = {
        'daysBefore': r.daysBefore,
        'daysAfter': r.daysAfter,
        'totalDays': r.totalDays,
        'start': formatYmd(r.leaveStartDate),
        'end': formatYmd(r.leaveEndDate),
        'return': formatYmd(r.returnToWorkDate),
        'benefit': r.benefit,
      };
      expectJsonClose(out, c['out'], path: '${c['code']}/${c['role']}/${c['pregnancyType']}');
    }
  }, skip: fixtureSkip('maternity_calc'));
}

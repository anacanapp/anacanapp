// Ported from: src/data/maternityRules.ts (types + table, generated into data/maternity_rules_data.g.dart),
// src/components/tools/MaternityCalculator.tsx (handleCalculate: leave dates and benefit estimate),
// src/hooks/useMaternityBenefits.ts (calculateBenefit for Azerbaijan with the maternity_config values)

import 'dart:math' as math;

import '../js_compat.dart';
import 'data/maternity_rules_data.g.dart';

/// One country of the maternity rules table. Text fields keep the TypeScript names (`name_az`, `guidelines_en`...).
class MaternityRule {
  const MaternityRule(this.raw);
  final Map<String, Object?> raw;

  String get code => raw['code']! as String;
  String get nameAz => raw['name_az']! as String;
  String get nameEn => raw['name_en']! as String;
  String get flag => raw['flag']! as String;
  int get normalDaysBefore => (raw['normalDaysBefore']! as num).toInt();
  int get normalDaysAfter => (raw['normalDaysAfter']! as num).toInt();
  int get complicatedDaysAfter => (raw['complicatedDaysAfter']! as num).toInt();
  int get multipleDaysBefore => (raw['multipleDaysBefore']! as num).toInt();
  int get multipleDaysAfter => (raw['multipleDaysAfter']! as num).toInt();
  num? get payPercentage => raw['payPercentage'] as num?;
  num? get tenureRequirementMonths => raw['tenureRequirementMonths'] as num?;
  Map<String, Object?>? get paternity => (raw['paternity'] as Map?)?.cast<String, Object?>();
  Map<String, Object?>? get parental => (raw['parental'] as Map?)?.cast<String, Object?>();
  Map<String, Object?>? get compensation => (raw['compensation'] as Map?)?.cast<String, Object?>();

  /// `guidelines_<lang>` with the `_en` fallback for languages without their own list.
  List<Map<String, Object?>> guidelines(String lang) {
    final list = raw['guidelines_$lang'] ?? raw['guidelines_en'];
    return [for (final g in (list as List? ?? const [])) (g as Map).cast<String, Object?>()];
  }
}

final List<MaternityRule> maternityRules = [for (final r in maternityRulesData) MaternityRule(r)];

/// `maternityRules.find(r => r.code === code) || maternityRules[0]`.
MaternityRule maternityRuleFor(String code) => maternityRules.firstWhere((r) => r.code == code, orElse: () => maternityRules[0]);

/// public.maternity_config values with the hook's fallbacks (`configMap[key] || default`).
class MaternityConfig {
  const MaternityConfig({
    this.birthBenefit = 600,
    this.normalDaysBefore = 70,
    this.normalDaysAfter = 56,
    this.complicatedDaysAfter = 70,
    this.multipleDaysBefore = 70,
    this.multipleDaysAfter = 70,
    this.minSalary = 400,
    this.minPension = 320,
  });
  final num birthBenefit;
  final num normalDaysBefore;
  final num normalDaysAfter;
  final num complicatedDaysAfter;
  final num multipleDaysBefore;
  final num multipleDaysAfter;
  final num minSalary;

  /// Minimum monthly labour pension; the monthly benefit is capped at 25 times this amount.
  final num minPension;

  /// From active maternity_config rows (`config_key`, `value`).
  factory MaternityConfig.fromRows(List<Map<String, Object?>> rows) {
    final m = <String, num>{for (final r in rows) r['config_key']! as String: r['value']! as num};
    num v(String key, num d) => (m[key] == null || m[key] == 0 || m[key]!.isNaN) ? d : m[key]!;
    return MaternityConfig(
      birthBenefit: v('birth_benefit', 600),
      normalDaysBefore: v('normal_leave_days_before', 70),
      normalDaysAfter: v('normal_leave_days_after', 56),
      complicatedDaysAfter: v('complicated_leave_days_after', 70),
      multipleDaysBefore: v('multiple_leave_days_before', 70),
      multipleDaysAfter: v('multiple_leave_days_after', 70),
      minSalary: v('min_salary', 400),
      minPension: v('min_monthly_pension', 320),
    );
  }
}

/// 'normal' | 'complicated' | 'multiple'
typedef PregnancyType = String;

/// useMaternityBenefits.calculateBenefit (Azerbaijan, backend config).
Map<String, num> calculateAzBenefit(MaternityConfig config, num monthlySalary, PregnancyType pregnancyType) {
  final validSalary = math.max(monthlySalary, config.minSalary);
  final dailyCap = 25 * config.minPension * 12 / 365;
  final dailySalary = math.min(validSalary * 12 / 365, dailyCap);
  num daysBefore, daysAfter;
  switch (pregnancyType) {
    case 'multiple':
      daysBefore = config.multipleDaysBefore;
      daysAfter = config.multipleDaysAfter;
    case 'complicated':
      daysBefore = config.normalDaysBefore;
      daysAfter = config.complicatedDaysAfter;
    default:
      daysBefore = config.normalDaysBefore;
      daysAfter = config.normalDaysAfter;
  }
  final total = daysBefore + daysAfter;
  final benefit = dailySalary * total;
  return {
    'dailySalary': jsRound(dailySalary * 100) / 100,
    'daysBefore': daysBefore,
    'daysAfter': daysAfter,
    'totalLeaveDays': total,
    'maternityBenefit': jsRound(benefit * 100) / 100,
    'birthBenefit': config.birthBenefit,
    'totalBenefit': jsRound((benefit + config.birthBenefit) * 100) / 100,
    'monthlySalaryUsed': validSalary,
  };
}

class MaternityLeaveResult {
  const MaternityLeaveResult({
    required this.daysBefore,
    required this.daysAfter,
    required this.totalDays,
    required this.leaveStartDate,
    required this.leaveEndDate,
    required this.returnToWorkDate,
    required this.benefit,
    required this.rule,
  });
  final int daysBefore;
  final int daysAfter;
  final int totalDays;
  final DateTime leaveStartDate;
  final DateTime leaveEndDate;
  final DateTime returnToWorkDate;

  /// The calculator's benefitResult object (same keys as the TypeScript), or null.
  final Map<String, Object?>? benefit;
  final MaternityRule rule;
}

/// `parseFloat(salary) || 0`.
double _parseSalary(String salary) {
  final m = RegExp(r'^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?').firstMatch(salary);
  final v = m == null ? double.nan : double.parse(m[0]!.trim());
  return v.isNaN ? 0 : v;
}

/// MaternityCalculator.handleCalculate. [eddDate] is the picker value (`new Date(eddDate)`); null result when it
/// is empty or invalid. [isAz] picks the Azerbaijani formula text, [azConfig] enables the backend-config path for
/// AZ mothers.
MaternityLeaveResult? calculateMaternityLeave({
  required MaternityRule rule,
  required String role,
  required PregnancyType pregnancyType,
  required String eddDate,
  String salary = '',
  bool isAz = true,
  MaternityConfig? azConfig,
}) {
  if (eddDate.isEmpty) return null;
  final edd = jsParseDate(eddDate);
  if (edd == null) return null;
  var daysBefore = 0, daysAfter = 0;
  DateTime leaveStart;
  if (role == 'father') {
    final p = rule.paternity;
    daysAfter = p == null ? 0 : ((p['days'] as num?)?.toInt() ?? 0);
    leaveStart = edd;
  } else {
    daysBefore = rule.normalDaysBefore;
    daysAfter = rule.normalDaysAfter;
    if (pregnancyType == 'complicated') {
      daysAfter = rule.complicatedDaysAfter;
    } else if (pregnancyType == 'multiple') {
      daysBefore = rule.multipleDaysBefore;
      daysAfter = rule.multipleDaysAfter;
    }
    leaveStart = subDays(edd, daysBefore);
  }
  final totalDays = daysBefore + daysAfter;
  final leaveEnd = addDays(leaveStart, totalDays > 0 ? totalDays - 1 : 0);
  final returnDate = addDays(leaveEnd, 1);
  Map<String, Object?>? benefit;
  final comp = rule.compensation;
  if (rule.code == 'AZ' && azConfig != null && role == 'mother') {
    benefit = {
      ...calculateAzBenefit(azConfig, _parseSalary(salary), pregnancyType),
      'currency': 'AZN',
      'isNativeAz': true,
      'formula': isAz ? (comp?['formulaDescription_az']) : (comp?['formulaDescription_en']),
    };
  } else if (comp != null && comp['type'] != 'UNPAID') {
    final salaryNum = _parseSalary(salary);
    final dailyWage = salaryNum / 30.416;
    num dailyBenefit = 0, totalBenefit = 0;
    final type = comp['type'];
    bool has(Object? v) => v != null && v != 0;
    if (type == 'PERCENTAGE_UNCAPPED' || type == 'PERCENTAGE_CAPPED') {
      final pct = has(comp['percentage']) ? comp['percentage'] as num : 100;
      dailyBenefit = dailyWage * (pct / 100);
      if (has(comp['maxCapDaily']) && dailyBenefit > (comp['maxCapDaily'] as num)) dailyBenefit = comp['maxCapDaily'] as num;
      if (has(comp['minCapDaily']) && dailyBenefit < (comp['minCapDaily'] as num)) dailyBenefit = comp['minCapDaily'] as num;
      totalBenefit = dailyBenefit * totalDays;
      if (has(comp['maxCapTotal']) && totalBenefit > (comp['maxCapTotal'] as num)) totalBenefit = comp['maxCapTotal'] as num;
    } else if (type == 'FLAT_RATE') {
      dailyBenefit = has(comp['flatRateDaily']) ? comp['flatRateDaily'] as num : 0;
      totalBenefit = dailyBenefit * totalDays;
    } else if (type == 'COMPLEX') {
      if (rule.code == 'GB') {
        final first = math.min(totalDays, 42), second = math.max(0, math.min(totalDays - 42, 231));
        totalBenefit = dailyWage * 0.9 * first + math.min(26.29, dailyWage * 0.9) * second;
      } else if (rule.code == 'AE') {
        final first = math.min(totalDays, 45), second = math.max(0, math.min(totalDays - 45, 15));
        totalBenefit = dailyWage * first + dailyWage * 0.5 * second;
      }
    }
    benefit = {
      'maternityBenefit': totalBenefit,
      'dailySalary': dailyWage,
      'totalBenefit': totalBenefit,
      'isCustom': true,
      'currency': comp['currency'],
      'formula': isAz ? comp['formulaDescription_az'] : comp['formulaDescription_en'],
    };
  }
  final paternity = rule.paternity;
  if (role == 'father' && paternity != null) {
    benefit = {
      'isPaternity': true,
      'formula': isAz ? paternity['payDescription_az'] : paternity['payDescription_en'],
    };
  }
  return MaternityLeaveResult(
    daysBefore: daysBefore,
    daysAfter: daysAfter,
    totalDays: totalDays,
    leaveStartDate: leaveStart,
    leaveEndDate: leaveEnd,
    returnToWorkDate: returnDate,
    benefit: benefit,
    rule: rule,
  );
}

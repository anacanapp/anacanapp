// Ported from: src/lib/maternity-regional.ts (policy currencies from src/data/maternity-regional.json)
//
// Country-specific planning arithmetic for the twelve expansion countries. Entitlement and the personal award
// stay with the relevant agency; unknown schemes never turn into a zero cash award.

import 'dart:math' as math;

import '../js_compat.dart';
import 'data/maternity_regional_data.g.dart';

export 'data/maternity_regional_data.g.dart' show regionalMaternityCountries, regionalMaternityCurrency;

bool isRegionalMaternityCountry(String code) => regionalMaternityCurrency.containsKey(code);

/// '120' | '150' | 'shared150' | 'shared180' | 'shared180-90'
typedef PortuguesePlan = String;

class RegionalMaternityInput {
  const RegionalMaternityInput({
    required this.country,
    required this.dueDate,
    this.startDate,
    this.birthCount,
    this.existingChildren,
    this.complicated = false,
    this.premature = false,
    this.certifiedExtraMonths,
    this.soleParent = false,
    this.includeFlexible = false,
    this.portuguesePlan,
    this.ownDays,
    this.combinedPoland = false,
    this.shortInsuranceJapan = false,
    this.earnings,
    this.paidSalaryDaily,
    this.swedenIncomeDays,
    this.swedenMinimumDays,
  });
  final String country;
  final String dueDate;
  final String? startDate;
  final num? birthCount;
  final num? existingChildren;
  final bool complicated;
  final bool premature;
  final num? certifiedExtraMonths;
  final bool soleParent;
  final bool includeFlexible;
  final PortuguesePlan? portuguesePlan;
  final num? ownDays;
  final bool combinedPoland;
  final bool shortInsuranceJapan;
  final List<num>? earnings;
  final num? paidSalaryDaily;
  final num? swedenIncomeDays;
  final num? swedenMinimumDays;
}

class RegionalMaternityResult {
  const RegionalMaternityResult({
    required this.days,
    this.months,
    required this.entitlementDays,
    required this.before,
    required this.start,
    required this.end,
    required this.returnDate,
    required this.money,
    required this.daily,
    required this.currency,
    required this.agency,
    required this.yearUnsupported,
    this.incomeDays,
    this.minimumDays,
  });
  final num days;
  final int? months;
  final num entitlementDays;
  final num before;
  final DateTime start;
  final DateTime end;
  final DateTime returnDate;
  final double? money;
  final double? daily;
  final String currency;
  final bool agency;
  final bool yearUnsupported;
  final num? incomeDays;
  final num? minimumDays;
}

class MaternityError implements Exception {
  const MaternityError(this.code);
  final String code;
  @override
  String toString() => code;
}

DateTime _civil(String value) {
  final date = parseIsoDateFns(value);
  if (!RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value) || date == null || formatYmd(date) != value) {
    throw const MaternityError('MATERNITY_DATE_INVALID');
  }
  return date;
}

bool _integer(num value, num min, num max) => jsIsInteger(value) && value >= min && value <= max;

/// `Math.round((value + Number.EPSILON) * 100) / 100`.
double _round2(num value) => jsRound((value + 2.220446049250313e-16) * 100) / 100;

const Map<String, String> _rulesFrom = {
  'CN': '2012-04-28', 'ID': '2024-07-02', 'ES': '2025-07-31', 'VN': '2025-07-01', 'KR': '2025-02-23', 'PL': '2023-04-26', 'SE': '2024-07-01',
};

const Map<String, List<num>> _ptPlans = {
  '120': [120, 1, 0],
  '150': [150, .8, 0],
  'shared150': [150, 1, 30],
  'shared180': [180, .83, 30],
  'shared180-90': [180, .9, 60],
};

int _ms(DateTime d) => d.millisecondsSinceEpoch;

RegionalMaternityResult calculateRegionalMaternity(RegionalMaternityInput input) {
  final country = input.country;
  if (!isRegionalMaternityCountry(country)) throw const MaternityError('MATERNITY_COUNTRY_INVALID');
  final due = _civil(input.dueDate);
  final count = input.birthCount ?? 1, existing = input.existingChildren ?? 0, extra = input.certifiedExtraMonths ?? 0;
  final from = _rulesFrom[country];
  if (from != null && input.dueDate.compareTo(from) < 0) throw const MaternityError('MATERNITY_RULE_DATE_UNSUPPORTED');
  if (!_integer(count, 1, country == 'SE' ? 4 : 5) || !_integer(existing, 0, 20) || !_integer(extra, 0, 3)) {
    throw const MaternityError('MATERNITY_INPUT_INVALID');
  }
  final earnings = input.earnings ?? const <num>[];
  final paid = input.paidSalaryDaily ?? 0;
  if (earnings.any((v) => !v.isFinite || v < 0 || v > 1e10) || !paid.isFinite || paid < 0) {
    throw const MaternityError('MATERNITY_INPUT_INVALID');
  }
  num before = 0, days = 0, entitlementDays = 0, rate = 1;
  int? months;
  var birthIncludedBefore = false;
  var agency = const ['CN', 'KR', 'NL'].contains(country);
  num? incomeDays, minimumDays;
  switch (country) {
    case 'CN':
      before = 15;
      days = 98 + (input.complicated ? 15 : 0) + (count - 1) * 15;
    case 'ID':
      months = (3 + extra).toInt();
    case 'FR':
      before = count >= 3 ? 168 : count == 2 ? 84 : existing >= 2 ? 56 : 42;
      days = before + (count >= 2 ? 154 : existing >= 2 ? 126 : 70);
    case 'ES':
      final additional = (count - 1) * (input.soleParent ? 14 : 7), flexible = input.soleParent ? 28 : 14;
      entitlementDays = (input.soleParent ? 224 : 133) + additional;
      days = entitlementDays - (input.includeFlexible ? 0 : flexible);
    case 'PT':
      final selected = _ptPlans[input.portuguesePlan == null || input.portuguesePlan!.isEmpty ? '120' : input.portuguesePlan!];
      if (selected == null) throw const MaternityError('MATERNITY_PLAN_INVALID');
      final total = selected[0], fraction = selected[1], otherDays = selected[2];
      entitlementDays = total;
      rate = fraction;
      days = input.ownDays ?? total - otherDays;
      if (!_integer(days, otherDays != 0 ? 72 : 42, total - otherDays)) throw const MaternityError('MATERNITY_PERSONAL_DAYS_INVALID');
      if (count > 1) agency = true;
    case 'VN':
      months = (6 + count - 1).toInt();
    case 'IN':
      before = existing >= 2 ? 42 : 56;
      days = existing >= 2 ? 84 : 182;
    case 'JP':
      before = count > 1 ? 98 : 42;
      days = before + 56;
      birthIncludedBefore = true;
    case 'KR':
      before = count > 1 ? 60 : 45;
      days = count > 1 ? 120 : input.premature ? 100 : 90;
    case 'PL':
      days = const [140, 217, 231, 245, 259][count.toInt() - 1];
      rate = input.combinedPoland ? .815 : 1;
    case 'NL':
      before = count > 1 ? 70 : 42;
      days = count > 1 ? 140 : 112;
      birthIncludedBefore = true;
    case 'SE':
      final incomePool = count == 1 ? 390 : 480 + (count - 2) * 180, minimumPool = count == 1 ? 90 : 180;
      entitlementDays = incomePool + minimumPool;
      incomeDays = input.swedenIncomeDays ?? (input.soleParent ? incomePool : incomePool / 2);
      minimumDays = input.swedenMinimumDays ?? (input.soleParent ? minimumPool : minimumPool / 2);
      if (!_integer(incomeDays, 0, input.soleParent ? incomePool : incomePool - 90) ||
          !_integer(minimumDays, 0, minimumPool) ||
          incomeDays + minimumDays < 1) {
        throw const MaternityError('MATERNITY_PERSONAL_DAYS_INVALID');
      }
      days = incomeDays + minimumDays;
  }
  final start = input.startDate != null && input.startDate!.isNotEmpty
      ? _civil(input.startDate!)
      : addDays(due, (-before + (birthIncludedBefore ? 1 : 0)).toInt());
  if (country == 'VN' && (_ms(start) < _ms(subMonths(due, 2)) || _ms(start) > _ms(due))) {
    throw const MaternityError('MATERNITY_START_OUTSIDE_WINDOW');
  }
  if (country == 'NL') {
    final earliest = addDays(due, 1 - (count > 1 ? 70 : 42)), latest = addDays(due, 1 - (count > 1 ? 56 : 28));
    if (_ms(start) < _ms(earliest) || _ms(start) > _ms(latest)) throw const MaternityError('MATERNITY_START_OUTSIDE_WINDOW');
  }
  if (country == 'JP') {
    if (_ms(start) < _ms(addDays(due, (1 - before).toInt())) || _ms(start) > _ms(addDays(due, 56))) {
      throw const MaternityError('MATERNITY_START_OUTSIDE_WINDOW');
    }
    days = differenceInCalendarDays(addDays(due, 57), start);
  }
  if (const ['CN', 'IN', 'PL', 'PT'].contains(country) && _ms(start) > _ms(due)) throw const MaternityError('MATERNITY_START_OUTSIDE_WINDOW');
  if ((country == 'CN' && _ms(start) < _ms(subDays(due, 15))) ||
      (country == 'IN' && _ms(start) < _ms(subDays(due, before.toInt()))) ||
      (country == 'PL' && _ms(start) < _ms(subDays(due, 42))) ||
      (country == 'PT' && _ms(start) < _ms(subDays(due, 30)))) {
    throw const MaternityError('MATERNITY_START_OUTSIDE_WINDOW');
  }
  final end = months != null && months != 0 ? subDays(addMonths(start, months), 1) : addDays(start, (days - 1).toInt());
  if (months != null && months != 0) days = differenceInCalendarDays(addMonths(start, months), start);
  if (entitlementDays == 0) entitlementDays = days;
  double? money, daily;
  var yearUnsupported = false;
  final amount = earnings.isEmpty ? null : earnings[0];
  if (!agency && amount != null && amount > 0) {
    if (country == 'FR') {
      if (start.year != 2026) {
        yearUnsupported = true;
      } else if (earnings.length == 3 && earnings.every((v) => v > 0)) {
        final monthlyCap = subMonths(start, 1).year == 2025 ? 3925 : 4005;
        final sum = earnings.fold<num>(0, (s, v) => s + math.min(v, monthlyCap));
        daily = math.min(104.02, math.max(11.12, _round2(sum / 91.25 * .79)));
      }
    } else if (country == 'JP') {
      final reference = input.shortInsuranceJapan
          ? math.min(amount, formatYmd(start).compareTo('2025-04-01') >= 0 ? 320000 : 300000)
          : amount;
      daily = math.max(0, jsRound(jsRound(reference / 30 / 10) * 10 * 2 / 3) - (input.paidSalaryDaily ?? 0)).toDouble();
    } else if (country == 'VN') {
      money = (amount * months!).toDouble();
    } else if (country == 'ID') {
      money = (amount * (math.min(months!, 4) + math.max(0, months - 4) * .75)).toDouble();
    } else if (country == 'PT') {
      if (start.year != 2026) {
        yearUnsupported = true;
      } else {
        daily = math.max(14.32, _round2(amount / 30 * rate));
      }
    } else if (country == 'SE') {
      money = (amount * incomeDays! + 180 * minimumDays!).toDouble();
    } else {
      daily = (amount * rate).toDouble();
    }
    if (daily != null) money = daily * days;
  }
  return RegionalMaternityResult(
    days: days,
    months: months,
    entitlementDays: entitlementDays,
    before: before,
    start: start,
    end: end,
    returnDate: addDays(end, 1),
    money: money == null ? null : _round2(money),
    daily: daily,
    currency: regionalMaternityCurrency[country]!,
    agency: agency,
    yearUnsupported: yearUnsupported,
    incomeDays: incomeDays,
    minimumDays: minimumDays,
  );
}

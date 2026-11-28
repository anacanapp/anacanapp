// Ported from: src/lib/ads/brandTargeting.ts
//
// anacan-brand-ads-v3 targeting and audience buckets, mirroring brand_ads_targeting_matches_v1 /
// brand_ads_audience_facts_v1 (supabase/migrations/20261022120000_brand_ads_v3.sql); the server is authoritative.
import 'package:flutter/foundation.dart';

const List<String> kAudienceTiers = ['free', 'premium'];
const List<String> kLifeStages = ['flow', 'bump', 'mommy', 'partner'];
const List<String> kNativeTemplates = ['classic', 'spotlight', 'split', 'minimal', 'offer', 'expert'];
const List<String> kAudienceDimensions = ['placement', 'platform', 'language', 'country', 'tier', 'stage', 'trimester', 'week_bucket', 'child_age_bucket'];
const int kAnonymity = 20;
const int kMaxChildAgeDays = 2190;

@immutable
class BrandTargeting {
  const BrandTargeting({
    this.audienceTiers,
    this.targetLifeStages,
    this.targetLanguages,
    this.targetCountries,
    this.targetPregnancyWeekMin,
    this.targetPregnancyWeekMax,
    this.targetPregnancyWeeks,
    this.targetChildAgeMinDays,
    this.targetChildAgeMaxDays,
    this.isPremiumOnly,
  });
  final List<String>? audienceTiers;
  final List<String>? targetLifeStages;
  final List<String>? targetLanguages;
  final List<String>? targetCountries;
  final num? targetPregnancyWeekMin;
  final num? targetPregnancyWeekMax;
  final List<num>? targetPregnancyWeeks;
  final num? targetChildAgeMinDays;
  final num? targetChildAgeMaxDays;
  final bool? isPremiumOnly;
}

@immutable
class AudienceFacts {
  const AudienceFacts({required this.stage, this.week, this.childDays, required this.country, required this.tier});
  final String stage;
  final int? week;
  final int? childDays;
  final String country;
  final String tier;

  AudienceFacts copyWith({String? stage, int? Function()? week, int? Function()? childDays, String? tier}) => AudienceFacts(
        stage: stage ?? this.stage,
        week: week != null ? week() : this.week,
        childDays: childDays != null ? childDays() : this.childDays,
        country: country,
        tier: tier ?? this.tier,
      );
}

const int _day = 86400000;

int? _utcDay(Object value) {
  DateTime? date;
  if (value is String) {
    if (value.length < 10) return null;
    date = DateTime.tryParse('${value.substring(0, 10)}T00:00:00Z');
  } else if (value is DateTime) {
    date = value.toUtc();
  }
  if (date == null) return null;
  return (DateTime.utc(date.year, date.month, date.day).millisecondsSinceEpoch / _day).floor();
}

/// Same convention as getPregnancyWeek: LMP first, else due date − 280 days; floor(days / 7), 0–40.
int? pregnancyWeek(String? lastPeriod, String? dueDate, [DateTime? today]) {
  final now = today ?? DateTime.now();
  int? lmp;
  if (lastPeriod != null && lastPeriod.isNotEmpty) {
    lmp = _utcDay(lastPeriod);
  } else if (dueDate != null && dueDate.isNotEmpty) {
    final due = _utcDay(dueDate);
    lmp = due == null ? null : due - 280;
  }
  if (lmp == null) return null;
  final days = _utcDay(now)! - lmp;
  return days < 0 ? null : (days / 7).floor().clamp(0, 40);
}

int? childAgeDays(String? birthDate, [DateTime? today]) {
  if (birthDate == null || birthDate.isEmpty) return null;
  final birth = _utcDay(birthDate);
  if (birth == null) return null;
  final days = _utcDay(today ?? DateTime.now())! - birth;
  return days >= 0 ? days : null;
}

String? trimesterOf(int? week) => week == null ? null : week < 14 ? '1' : week < 28 ? '2' : '3';

String? weekBucket(int? week) {
  if (week == null) return null;
  if (week <= 4) return '1-4';
  final start = ((week - 1) / 4).floor() * 4 + 1;
  return '$start-${start + 3 < 42 ? start + 3 : 42}';
}

String? childAgeBucket(int? days) {
  if (days == null) return null;
  return days < 91 ? '0-3m' : days < 183 ? '3-6m' : days < 365 ? '6-12m' : days < 730 ? '12-24m' : days < 1095 ? '24-36m' : '36m+';
}

/// Months are entered in the portal; the server stores days (1 month = 30.4375 days).
int monthsToDays(num months) => (months * 30.4375).round();
double daysToMonths(num days) => (days / 30.4375 * 10).round() / 10;

List<String> effectiveTiers(BrandTargeting targeting, bool branded) {
  final tiers = targeting.audienceTiers;
  if (tiers != null && tiers.isNotEmpty) return tiers;
  if (branded) return const ['free'];
  return targeting.isPremiumOnly == true ? const ['premium'] : const ['free', 'premium'];
}

bool matchesBrandTargeting(BrandTargeting targeting, AudienceFacts facts, String language, bool branded) {
  if (!effectiveTiers(targeting, branded).contains(facts.tier)) return false;
  bool listed(List<String>? values, String value) => values == null || values.isEmpty || values.contains(value);
  if (!listed(targeting.targetLifeStages, facts.stage) || !listed(targeting.targetLanguages, language) || !listed(targeting.targetCountries, facts.country)) return false;
  final min = targeting.targetPregnancyWeekMin, max = targeting.targetPregnancyWeekMax, weeks = targeting.targetPregnancyWeeks;
  final childMin = targeting.targetChildAgeMinDays, childMax = targeting.targetChildAgeMaxDays;
  final hasWeek = min != null || max != null || (weeks != null && weeks.isNotEmpty), hasChild = childMin != null || childMax != null;
  if (!hasWeek && !hasChild) return true;
  final week = facts.week, days = facts.childDays;
  final weekOk = hasWeek && week != null && (min == null || week >= min) && (max == null || week <= max) && (weeks == null || weeks.isEmpty || weeks.contains(week));
  final childOk = hasChild && days != null && (childMin == null || days >= childMin) && (childMax == null || days <= childMax);
  // Pregnancy and child windows are alternatives (e.g. week 34–40 OR newborn 0–90 days).
  return weekOk || childOk;
}

/// 'tiers' | 'week_range' | 'week_list' | 'child_range' — portal-side validation (ad_creative_payload_v1 repeats it).
List<String> targetingErrors(BrandTargeting targeting) {
  final errors = <String>[];
  bool isInt(num? value, int low, int high) => value == null || (value == value.truncate() && value >= low && value <= high);
  final tiers = targeting.audienceTiers;
  if (tiers == null || tiers.isEmpty || tiers.any((t) => !kAudienceTiers.contains(t))) errors.add('tiers');
  final min = targeting.targetPregnancyWeekMin, max = targeting.targetPregnancyWeekMax;
  if (!isInt(min, 1, 42) || !isInt(max, 1, 42) || (min != null && max != null && min > max)) errors.add('week_range');
  if (targeting.targetPregnancyWeeks?.any((w) => !isInt(w, 1, 42)) ?? false) errors.add('week_list');
  final childMin = targeting.targetChildAgeMinDays, childMax = targeting.targetChildAgeMaxDays;
  if (!isInt(childMin, 0, kMaxChildAgeDays) || !isInt(childMax, 0, kMaxChildAgeDays) || (childMin != null && childMax != null && childMin > childMax)) {
    errors.add('child_range');
  }
  return errors;
}

/// "5, 8-10, 12" → [5, 8, 9, 10, 12]; invalid tokens are reported, not silently dropped.
({List<int> weeks, bool invalid}) parseWeekList(String input) {
  final weeks = <int>{};
  var invalid = false;
  for (final token in input.split(RegExp(r'[\s,;]+')).where((t) => t.isNotEmpty)) {
    final range = RegExp(r'^(\d{1,2})-(\d{1,2})$').firstMatch(token);
    final single = RegExp(r'^\d{1,2}$').hasMatch(token) ? int.parse(token) : null;
    final from = range != null ? int.parse(range.group(1)!) : single;
    final to = range != null ? int.parse(range.group(2)!) : single;
    if (from == null || to == null || from < 1 || to > 42 || from > to) {
      invalid = true;
      continue;
    }
    for (var week = from; week <= to; week++) {
      weeks.add(week);
    }
  }
  return (weeks: weeks.toList()..sort(), invalid: invalid);
}

@immutable
class AudienceRow {
  const AudienceRow({required this.bucket, required this.reach, required this.impressions, required this.clicks, this.other = false});
  final String bucket;
  final int reach;
  final int impressions;
  final int clicks;
  final bool other;
}

/// Client mirror of the server's k-anonymity rule: buckets under k distinct people are merged into "other"; a
/// single hidden bucket also hides the smallest visible one so it cannot be derived by subtraction; "other"
/// itself is dropped when still under k.
List<AudienceRow> suppressAudience(List<AudienceRow> rows, [int k = kAnonymity]) {
  final ranked = rows.where((r) => !r.other).toList()..sort((a, b) => a.reach != b.reach ? a.reach - b.reach : a.bucket.compareTo(b.bucket));
  final hidden = <AudienceRow>{...ranked.where((r) => r.reach < k)};
  if (hidden.length == 1) {
    for (final row in ranked) {
      if (!hidden.contains(row)) {
        hidden.add(row);
        break;
      }
    }
  }
  final visible = ranked.where((r) => !hidden.contains(r)).toList()
    ..sort((a, b) => a.impressions != b.impressions ? b.impressions - a.impressions : a.bucket.compareTo(b.bucket));
  final merged = [...hidden, ...rows.where((r) => r.other)];
  if (merged.isEmpty) return visible;
  // Reach of merged buckets is an upper bound when people span buckets; the server recounts distinct people.
  var reach = 0, impressions = 0, clicks = 0;
  for (final row in merged) {
    reach += row.reach;
    impressions += row.impressions;
    clicks += row.clicks;
  }
  final other = AudienceRow(bucket: 'other', reach: reach, impressions: impressions, clicks: clicks, other: true);
  return other.reach >= k ? [...visible, other] : visible;
}

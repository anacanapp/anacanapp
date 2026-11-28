// Ported from: src/lib/ads/brandTargeting.test.ts
import 'package:anacan/features/banners/brand_targeting.dart';
import 'package:flutter_test/flutter_test.dart';

final today = DateTime.parse('2026-10-22T09:00:00Z');
AudienceFacts facts({String stage = 'bump', int? week = 30, int? childDays, String tier = 'free'}) =>
    AudienceFacts(stage: stage, week: week, childDays: childDays, country: 'AZ', tier: tier);

void main() {
  group('audience facts (mirror of brand_ads_audience_facts_v1)', () {
    test('derives the pregnancy week from LMP first, then due date − 280 days, clamped like getPregnancyWeek', () {
      expect(pregnancyWeek('2026-07-30', null, today), 12);
      expect(pregnancyWeek(null, '2027-05-06', today), 12);
      expect(pregnancyWeek('2025-01-01', null, today), 40);
      expect(pregnancyWeek('2026-11-01', null, today), isNull);
      expect(pregnancyWeek(null, null, today), isNull);
    });
    test('derives child age in days and the coarse buckets stored on receipts', () {
      expect(childAgeDays('2026-10-01', today), 21);
      expect(childAgeDays('2027-01-01', today), isNull);
      expect([0, 90, 91, 182, 183, 364, 365, 729, 730, 1094, 1095].map(childAgeBucket).toList(),
          ['0-3m', '0-3m', '3-6m', '3-6m', '6-12m', '6-12m', '12-24m', '12-24m', '24-36m', '24-36m', '36m+']);
      expect([0, 4, 5, 8, 13, 14, 27, 28, 40].map(weekBucket).toList(), ['1-4', '1-4', '5-8', '5-8', '13-16', '13-16', '25-28', '25-28', '37-40']);
      expect([0, 13, 14, 27, 28, 40].map(trimesterOf).toList(), ['1', '1', '2', '2', '3', '3']);
      expect(trimesterOf(null), isNull);
      expect(weekBucket(null), isNull);
    });
    test('converts portal months to stored days and back', () {
      expect(monthsToDays(6), 183);
      expect(daysToMonths(183), 6);
      expect(monthsToDays(0), 0);
    });
  });

  group('targeting (mirror of brand_ads_targeting_matches_v1)', () {
    test('serves premium and free together only when the brand selects both tiers', () {
      const both = BrandTargeting(audienceTiers: ['free', 'premium']);
      expect(matchesBrandTargeting(both, facts(tier: 'premium'), 'az', true), isTrue);
      expect(matchesBrandTargeting(both, facts(tier: 'free'), 'az', true), isTrue);
      expect(matchesBrandTargeting(const BrandTargeting(audienceTiers: ['premium']), facts(tier: 'free'), 'az', true), isFalse);
    });
    test('keeps legacy behaviour when tiers are unset: brand ads free-only, house banners follow is_premium_only', () {
      expect(effectiveTiers(const BrandTargeting(), true), ['free']);
      expect(effectiveTiers(const BrandTargeting(), false), ['free', 'premium']);
      expect(effectiveTiers(const BrandTargeting(isPremiumOnly: true), false), ['premium']);
      expect(matchesBrandTargeting(const BrandTargeting(), facts(tier: 'premium'), 'az', true), isFalse);
    });
    test('applies pregnancy-week ranges, exact weeks and child-age windows (windows are alternatives)', () {
      expect(matchesBrandTargeting(const BrandTargeting(targetPregnancyWeekMin: 28, targetPregnancyWeekMax: 40), facts(), 'az', true), isTrue);
      expect(matchesBrandTargeting(const BrandTargeting(targetPregnancyWeekMin: 31), facts(), 'az', true), isFalse);
      expect(matchesBrandTargeting(const BrandTargeting(targetPregnancyWeeks: [12, 30]), facts(), 'az', true), isTrue);
      expect(matchesBrandTargeting(const BrandTargeting(targetPregnancyWeeks: [12]), facts(), 'az', true), isFalse);
      const window = BrandTargeting(targetPregnancyWeekMin: 34, targetChildAgeMinDays: 0, targetChildAgeMaxDays: 90);
      expect(matchesBrandTargeting(window, facts(week: 35), 'az', true), isTrue);
      expect(matchesBrandTargeting(window, facts(stage: 'mommy', week: null, childDays: 40), 'az', true), isTrue);
      expect(matchesBrandTargeting(window, facts(stage: 'mommy', week: null, childDays: 200), 'az', true), isFalse);
      expect(matchesBrandTargeting(const BrandTargeting(targetChildAgeMaxDays: 90), facts(stage: 'flow', week: null), 'az', true), isFalse);
    });
    test('still applies stage, language and country filters', () {
      expect(matchesBrandTargeting(const BrandTargeting(targetLifeStages: ['mommy', 'partner']), facts(), 'az', true), isFalse);
      expect(matchesBrandTargeting(const BrandTargeting(targetLanguages: ['ar']), facts(), 'az', true), isFalse);
      expect(matchesBrandTargeting(const BrandTargeting(targetCountries: ['TR']), facts(), 'az', true), isFalse);
      expect(matchesBrandTargeting(const BrandTargeting(targetLifeStages: [], targetLanguages: [], targetCountries: []), facts(), 'az', true), isTrue);
    });
    test('validates portal input before it reaches ad_creative_payload_v1', () {
      expect(targetingErrors(const BrandTargeting(audienceTiers: ['free'])), isEmpty);
      expect(targetingErrors(const BrandTargeting(audienceTiers: [])), ['tiers']);
      expect(targetingErrors(const BrandTargeting(audienceTiers: ['free'], targetPregnancyWeekMin: 30, targetPregnancyWeekMax: 20)), ['week_range']);
      expect(targetingErrors(const BrandTargeting(audienceTiers: ['free'], targetPregnancyWeeks: [0, 43])), ['week_list']);
      expect(targetingErrors(const BrandTargeting(audienceTiers: ['free'], targetChildAgeMinDays: 100, targetChildAgeMaxDays: 10)), ['child_range']);
      expect(targetingErrors(const BrandTargeting(audienceTiers: ['free'], targetChildAgeMaxDays: 5000)), ['child_range']);
    });
    test('parses exact week lists with ranges and reports invalid tokens', () {
      final a = parseWeekList('5, 8-10;12 5');
      expect(a.weeks, [5, 8, 9, 10, 12]);
      expect(a.invalid, isFalse);
      final b = parseWeekList('0, 30-28, abc, 41-42');
      expect(b.weeks, [41, 42]);
      expect(b.invalid, isTrue);
      final c = parseWeekList('');
      expect(c.weeks, isEmpty);
      expect(c.invalid, isFalse);
    });
  });

  group('k-anonymous audience rows', () {
    AudienceRow row(String bucket, int reach, {bool other = false}) => AudienceRow(bucket: bucket, reach: reach, impressions: reach * 3, clicks: reach, other: other);
    test('keeps buckets at or above k and merges small ones into Other when that group reaches k', () {
      final result = suppressAudience([row('az', 120), row('tr', 30), row('ru', 12), row('de', 9)], 20);
      expect(result.map((r) => r.bucket).toList(), ['az', 'tr', 'other']);
      expect(result.last.other, isTrue);
      expect(result.last.reach, 21);
    });
    test('hides the smallest visible bucket too when exactly one bucket is small (no derivation by subtraction)', () {
      final result = suppressAudience([row('az', 120), row('tr', 30), row('ru', 3)], 20);
      expect(result.map((r) => r.bucket).toList(), ['az', 'other']);
      expect(result.where((r) => r.bucket == 'tr'), isEmpty);
    });
    test('drops Other when the merged group is still below k', () {
      expect(suppressAudience([row('az', 50), row('ru', 4), row('de', 5)], 20).map((r) => r.bucket).toList(), ['az']);
    });
    test('passes through an Other row that the server already merged', () {
      final result = suppressAudience([row('az', 50), row('tr', 40), row('other', 25, other: true)], 20);
      expect(result.map((r) => r.bucket).toList(), ['az', 'tr', 'other']);
    });
  });
}

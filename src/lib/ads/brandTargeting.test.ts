import { describe, expect, it } from 'vitest';
import { childAgeBucket, childAgeDays, daysToMonths, effectiveTiers, matchesBrandTargeting, monthsToDays, parseWeekList, pregnancyWeek,
  suppressAudience, targetingErrors, trimesterOf, weekBucket, type AudienceFacts } from './brandTargeting';

const today = new Date('2026-10-22T09:00:00Z');
const facts = (patch: Partial<AudienceFacts> = {}): AudienceFacts => ({ stage: 'bump', week: 30, child_days: null, country: 'AZ', tier: 'free', ...patch });

describe('audience facts (mirror of brand_ads_audience_facts_v1)', () => {
  it('derives the pregnancy week from LMP first, then due date − 280 days, clamped like getPregnancyWeek', () => {
    expect(pregnancyWeek('2026-07-30', null, today)).toBe(12);
    expect(pregnancyWeek(null, '2027-05-06', today)).toBe(12);
    expect(pregnancyWeek('2025-01-01', null, today)).toBe(40);
    expect(pregnancyWeek('2026-11-01', null, today)).toBeNull();
    expect(pregnancyWeek(null, null, today)).toBeNull();
  });
  it('derives child age in days and the coarse buckets stored on receipts', () => {
    expect(childAgeDays('2026-10-01', today)).toBe(21);
    expect(childAgeDays('2027-01-01', today)).toBeNull();
    expect([0, 90, 91, 182, 183, 364, 365, 729, 730, 1094, 1095].map(childAgeBucket))
      .toEqual(['0-3m', '0-3m', '3-6m', '3-6m', '6-12m', '6-12m', '12-24m', '12-24m', '24-36m', '24-36m', '36m+']);
    expect([0, 4, 5, 8, 13, 14, 27, 28, 40].map(weekBucket)).toEqual(['1-4', '1-4', '5-8', '5-8', '13-16', '13-16', '25-28', '25-28', '37-40']);
    expect([0, 13, 14, 27, 28, 40].map(trimesterOf)).toEqual(['1', '1', '2', '2', '3', '3']);
    expect(trimesterOf(null)).toBeNull(); expect(weekBucket(null)).toBeNull();
  });
  it('converts portal months to stored days and back', () => {
    expect(monthsToDays(6)).toBe(183); expect(daysToMonths(183)).toBe(6); expect(monthsToDays(0)).toBe(0);
  });
});

describe('targeting (mirror of brand_ads_targeting_matches_v1)', () => {
  it('serves premium and free together only when the brand selects both tiers', () => {
    const both = { audience_tiers: ['free', 'premium'] as const };
    expect(matchesBrandTargeting({ audience_tiers: [...both.audience_tiers] }, facts({ tier: 'premium' }), 'az', true)).toBe(true);
    expect(matchesBrandTargeting({ audience_tiers: [...both.audience_tiers] }, facts({ tier: 'free' }), 'az', true)).toBe(true);
    expect(matchesBrandTargeting({ audience_tiers: ['premium'] }, facts({ tier: 'free' }), 'az', true)).toBe(false);
  });
  it('keeps legacy behaviour when tiers are unset: brand ads free-only, house banners follow is_premium_only', () => {
    expect(effectiveTiers({}, true)).toEqual(['free']);
    expect(effectiveTiers({}, false)).toEqual(['free', 'premium']);
    expect(effectiveTiers({ is_premium_only: true }, false)).toEqual(['premium']);
    expect(matchesBrandTargeting({}, facts({ tier: 'premium' }), 'az', true)).toBe(false);
  });
  it('applies pregnancy-week ranges, exact weeks and child-age windows (windows are alternatives)', () => {
    expect(matchesBrandTargeting({ target_pregnancy_week_min: 28, target_pregnancy_week_max: 40 }, facts(), 'az', true)).toBe(true);
    expect(matchesBrandTargeting({ target_pregnancy_week_min: 31 }, facts(), 'az', true)).toBe(false);
    expect(matchesBrandTargeting({ target_pregnancy_weeks: [12, 30] }, facts(), 'az', true)).toBe(true);
    expect(matchesBrandTargeting({ target_pregnancy_weeks: [12] }, facts(), 'az', true)).toBe(false);
    const window = { target_pregnancy_week_min: 34, target_child_age_min_days: 0, target_child_age_max_days: 90 };
    expect(matchesBrandTargeting(window, facts({ week: 35 }), 'az', true)).toBe(true);
    expect(matchesBrandTargeting(window, facts({ stage: 'mommy', week: null, child_days: 40 }), 'az', true)).toBe(true);
    expect(matchesBrandTargeting(window, facts({ stage: 'mommy', week: null, child_days: 200 }), 'az', true)).toBe(false);
    expect(matchesBrandTargeting({ target_child_age_max_days: 90 }, facts({ stage: 'flow', week: null }), 'az', true)).toBe(false);
  });
  it('still applies stage, language and country filters', () => {
    expect(matchesBrandTargeting({ target_life_stages: ['mommy', 'partner'] }, facts(), 'az', true)).toBe(false);
    expect(matchesBrandTargeting({ target_languages: ['ar'] }, facts(), 'az', true)).toBe(false);
    expect(matchesBrandTargeting({ target_countries: ['TR'] }, facts(), 'az', true)).toBe(false);
    expect(matchesBrandTargeting({ target_life_stages: [], target_languages: [], target_countries: [] }, facts(), 'az', true)).toBe(true);
  });
  it('validates portal input before it reaches ad_creative_payload_v1', () => {
    expect(targetingErrors({ audience_tiers: ['free'] })).toEqual([]);
    expect(targetingErrors({ audience_tiers: [] })).toEqual(['tiers']);
    expect(targetingErrors({ audience_tiers: ['free'], target_pregnancy_week_min: 30, target_pregnancy_week_max: 20 })).toEqual(['week_range']);
    expect(targetingErrors({ audience_tiers: ['free'], target_pregnancy_weeks: [0, 43] })).toEqual(['week_list']);
    expect(targetingErrors({ audience_tiers: ['free'], target_child_age_min_days: 100, target_child_age_max_days: 10 })).toEqual(['child_range']);
    expect(targetingErrors({ audience_tiers: ['free'], target_child_age_max_days: 5000 })).toEqual(['child_range']);
  });
  it('parses exact week lists with ranges and reports invalid tokens', () => {
    expect(parseWeekList('5, 8-10;12 5')).toEqual({ weeks: [5, 8, 9, 10, 12], invalid: false });
    expect(parseWeekList('0, 30-28, abc, 41-42')).toEqual({ weeks: [41, 42], invalid: true });
    expect(parseWeekList('')).toEqual({ weeks: [], invalid: false });
  });
});

describe('k-anonymous audience rows', () => {
  const row = (bucket: string, reach: number) => ({ bucket, reach, impressions: reach * 3, clicks: reach });
  it('keeps buckets at or above k and merges small ones into Other when that group reaches k', () => {
    const result = suppressAudience([row('az', 120), row('tr', 30), row('ru', 12), row('de', 9)], 20);
    expect(result.map(item => item.bucket)).toEqual(['az', 'tr', 'other']);
    expect(result.at(-1)).toMatchObject({ other: true, reach: 21 });
  });
  it('hides the smallest visible bucket too when exactly one bucket is small (no derivation by subtraction)', () => {
    const result = suppressAudience([row('az', 120), row('tr', 30), row('ru', 3)], 20);
    expect(result.map(item => item.bucket)).toEqual(['az', 'other']);
    expect(result.find(item => item.bucket === 'tr')).toBeUndefined();
  });
  it('drops Other when the merged group is still below k', () => {
    expect(suppressAudience([row('az', 50), row('ru', 4), row('de', 5)], 20).map(item => item.bucket)).toEqual(['az']);
  });
  it('passes through an Other row that the server already merged', () => {
    const result = suppressAudience([row('az', 50), row('tr', 40), { ...row('other', 25), other: true }], 20);
    expect(result.map(item => item.bucket)).toEqual(['az', 'tr', 'other']);
  });
});

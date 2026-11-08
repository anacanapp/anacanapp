import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { ageFromBirthYear, doctorThreshold, doctorThresholdFor, validBirthYear } from './ttc';

describe('TTC doctor threshold by age', () => {
  const now = new Date(2026, 10, 8);

  it('uses 6 months from age 35 and 12 months below 35', () => {
    expect(doctorThreshold(35)).toBe(6);
    expect(doctorThreshold(34)).toBe(12);
    expect(doctorThresholdFor({ birth_year: 1991 }, now)).toBe(6); // 35
    expect(doctorThresholdFor({ birth_year: 1985 }, now)).toBe(6); // 41
    expect(doctorThresholdFor({ birth_year: 1992 }, now)).toBe(12); // 34
    expect(doctorThresholdFor({ birth_year: 2000 }, now)).toBe(12);
  });

  it('keeps 12 months when the age is unknown or invalid', () => {
    expect(doctorThresholdFor(undefined, now)).toBe(12);
    expect(doctorThresholdFor({}, now)).toBe(12);
    expect(doctorThresholdFor({ birth_year: 1800 }, now)).toBe(12);
    expect(doctorThresholdFor({ birth_year: 2025 }, now)).toBe(12);
    expect(doctorThresholdFor({ birth_year: 1990.5 }, now)).toBe(12);
  });

  it('validates birth years and derives the age', () => {
    expect(validBirthYear('1990', now)).toBe(1990);
    expect(validBirthYear('abc', now)).toBeNull();
    expect(validBirthYear(2014, now)).toBe(2014);
    expect(validBirthYear(2015, now)).toBeNull();
    expect(ageFromBirthYear(1991, now)).toBe(35);
    expect(ageFromBirthYear(null, now)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { ruleProblems, type UpdateRule } from './AdminAppUpdates';

const rule = (patch: Partial<UpdateRule> = {}): UpdateRule => ({
  name: '51 hazırdır', mode: 'soft', platform: 'ios', below_version: '51.0', min_version: null, languages: null, countries: null,
  audience: 'test', percent: 100, frequency: 'daily', texts: { en: { title: 'A new version is ready' } }, ios_url: null, android_url: null,
  starts_at: null, ends_at: null, priority: 0, enabled: false, ...patch,
});

describe('update rule validation', () => {
  it('accepts a complete rule', () => expect(ruleProblems(rule())).toEqual([]));
  it('needs a name, a version and some text', () => {
    expect(ruleProblems(rule({ name: ' ', below_version: '51', texts: {} }))).toHaveLength(2);
    expect(ruleProblems(rule({ below_version: 'abc' }))[0]).toMatch(/versiya/);
  });
  it('rejects an empty language list and bad percent', () => {
    expect(ruleProblems(rule({ languages: [], audience: 'percent', percent: 0 }))).toHaveLength(2);
  });
});

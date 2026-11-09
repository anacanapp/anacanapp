import { describe, expect, it } from 'vitest';
import { canonicalToolId, isMergedAway, resolveToolTarget } from './merged-tools';

const all = (ids: string[]) => (id: string) => ids.includes(id);

describe('merged tools', () => {
  it('opens a child on its host section when the host is available', () => {
    const av = all(['mental-health', 'baby-tracker', 'blood-pressure', 'whitenoise']);
    expect(resolveToolTarget('mood', av)).toEqual({ host: 'mental-health', section: 'mood' });
    expect(resolveToolTarget('mood-diary', av)).toEqual({ host: 'mental-health', section: 'mood' });
    expect(resolveToolTarget('teething-tracker', av)).toEqual({ host: 'baby-tracker', section: 'teething' });
    expect(resolveToolTarget('growth-tracker', av)).toEqual({ host: 'baby-tracker', section: 'baby-growth' });
    expect(resolveToolTarget('blood-sugar', av)).toEqual({ host: 'blood-pressure', section: 'blood-sugar' });
    expect(resolveToolTarget('noise-meter', av)).toEqual({ host: 'whitenoise', section: 'noise-meter' });
    expect(resolveToolTarget('kick', av)).toEqual({ host: 'kick', section: 'kick' });
  });
  it('keeps a child standalone where its host is not available (e.g. mood in the cycle stage)', () => {
    const av = all(['mood']);
    expect(resolveToolTarget('mood', av)).toEqual({ host: 'mood', section: 'mood' });
    expect(isMergedAway('mood', av)).toBe(false);
    expect(isMergedAway('mood', all(['mental-health']))).toBe(true);
    expect(canonicalToolId('white-noise')).toBe('whitenoise');
  });
});

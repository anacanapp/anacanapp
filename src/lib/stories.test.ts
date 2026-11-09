import { describe, expect, it } from 'vitest';
import { azOrdinal, parseStoryText, storiesEnabledFor, storyMatches, storyVars, storyVarsUsed, STORY_THEMES, type StoryContext } from './stories';
import { STORIES_AZ, WEEKS, MONTHS, PHASES } from '@/data/stories/az';
import { ILLUSTRATION_NAMES } from '@/components/stories/illustrations';

const tables = { weeks: WEEKS, months: MONTHS, phases: PHASES };
const TOOLS = new Set(['fetal-growth', 'kick', 'nutrition', 'danger-signs', 'baby-growth', 'whitenoise', 'solid-food-guide', 'mental-health', 'exercise',
  'vitamin-tracker', 'mood', 'hospital', 'blood-sugar', 'blood-pressure', 'safety', 'contraction', 'names', 'baby-tracker', 'teething', 'cry-translator',
  'sleep-training', 'first-aid', 'mini-games', 'vaccine-calendar', 'weather-clothing', 'noise-meter', 'blog', 'fairy-tale', 'doctors', 'shopping']);
const SCREENS = new Set(['calendar', 'partner-sharing', 'billing', 'doctor-report', 'recovery']);

describe('story helpers', () => {
  it('builds Azerbaijani ordinals', () => {
    expect([1, 3, 6, 9, 10, 12, 20, 23, 26, 30, 40].map((n) => `${n}${azOrdinal(n)}`))
      .toEqual(['1-ci', '3-cü', '6-cı', '9-cu', '10-cu', '12-ci', '20-ci', '23-cü', '26-cı', '30-cu', '40-cı']);
  });
  it('parses markers without HTML', () => {
    expect(parseStoryText('Körpən ==banan== __boydadır__ **indi**')).toEqual([
      { text: 'Körpən ', kind: 'plain' }, { text: 'banan', kind: 'mark' }, { text: ' ', kind: 'plain' }, { text: 'boydadır', kind: 'hl' }, { text: ' ', kind: 'plain' }, { text: 'indi', kind: 'bold' }]);
  });
  it('is shown to admins in admin mode, to everyone when on, and only in Azerbaijani', () => {
    expect(storiesEnabledFor('admin', { isAdmin: true, language: 'az' })).toBe(true);
    expect(storiesEnabledFor('admin', { isAdmin: false, language: 'az' })).toBe(false);
    expect(storiesEnabledFor('on', { isAdmin: false, language: 'az' })).toBe(true);
    expect(storiesEnabledFor('on', { isAdmin: false, language: 'ru' })).toBe(false);
    expect(storiesEnabledFor('on', { isAdmin: true, language: 'az', role: 'partner' })).toBe(false);
    expect(storiesEnabledFor('off', { isAdmin: true, language: 'az' })).toBe(false);
  });
});

describe('story audience', () => {
  const pick = (ctx: StoryContext) => STORIES_AZ.filter((s) => storyMatches(s, ctx, storyVars(ctx, tables))).map((s) => s.id);
  it('fits the pregnancy week', () => {
    const w10 = pick({ stage: 'bump', week: 10 });
    const w34 = pick({ stage: 'bump', week: 34 });
    expect(w10).toContain('bump-folic');
    expect(w10).not.toContain('bump-bag');
    expect(w34).toContain('bump-bag');
    expect(w34).not.toContain('bump-folic');
    expect(w34).not.toContain('mom-hunger');
  });
  it('fits the baby age and hides personal stories without data', () => {
    expect(pick({ stage: 'mommy', babyMonths: 7, babyName: 'Nuray' })).toContain('mom-teething');
    expect(pick({ stage: 'mommy', babyMonths: 1 })).not.toContain('mom-teething');
    expect(pick({ stage: 'mommy', babyMonths: null })).not.toContain('mom-this-month');
  });
  it('fits the cycle phase', () => {
    expect(pick({ stage: 'flow', cycleDay: 2 })).toContain('flow-iron');
    expect(pick({ stage: 'flow', cycleDay: 20 })).not.toContain('flow-iron');
    expect(pick({ stage: 'flow', cycleDay: 20 })).toContain('flow-pms');
  });
  it('hides the Premium promo from Premium users', () => {
    expect(pick({ stage: 'mommy', babyMonths: 3, isPremium: true })).not.toContain('all-premium');
    expect(pick({ stage: 'mommy', babyMonths: 3, isPremium: false })).toContain('all-premium');
  });
  it('fills the week story from the table', () => {
    const v = storyVars({ stage: 'bump', week: 24 }, tables);
    expect(v.weekLabel).toBe('24-cü həftə');
    expect(v.fruit).toBe('qarğıdalı');
  });
});

describe('story data', () => {
  it('has many stories with valid themes, art, templates, links and plain copy', () => {
    expect(STORIES_AZ.length).toBeGreaterThanOrEqual(80);
    const ids = new Set<string>();
    for (const s of STORIES_AZ) {
      expect(ids.has(s.id), s.id).toBe(false); ids.add(s.id);
      expect(STORY_THEMES[s.theme], s.id).toBeTruthy();
      expect(ILLUSTRATION_NAMES, s.id).toContain(s.illus);
      expect(JSON.stringify(s), s.id).not.toMatch(/[—–<>]/);
      for (const sl of s.slides) {
        if (sl.illus) expect(ILLUSTRATION_NAMES, s.id).toContain(sl.illus);
        if (sl.t === 'quiz') expect(sl.correct! >= 0 && sl.correct! < sl.options!.length, s.id).toBe(true);
        if (sl.cta) {
          const n = sl.cta.nav;
          expect(!!n.tool ? TOOLS.has(n.tool) : !!n.tab ? ['ai', 'community'].includes(n.tab) : SCREENS.has(n.screen!), `${s.id} ${JSON.stringify(n)}`).toBe(true);
        }
      }
      expect(storyVarsUsed(s).every((k) => ['week', 'weekLabel', 'fruit', 'lengthCm', 'weightG', 'weekNote', 'babyName', 'babyMonths', 'milestone', 'milestoneShort', 'cycleDay', 'cycleLabel', 'phase', 'phaseTip'].includes(k)), s.id).toBe(true);
    }
  });
});

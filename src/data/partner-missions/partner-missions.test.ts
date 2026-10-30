import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dailyMissionId, missionPoolsFor, PARTNER_MISSIONS, pickDailyMissions } from './index';

const dir = join(__dirname);
const languages = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const read = (lang: string) => JSON.parse(readFileSync(join(dir, `${lang}.json`), 'utf8')) as Record<string, string[]>;

describe('partner missions', () => {
  it('has text for every mission in all 21 languages', () => {
    expect(languages.sort()).toHaveLength(21);
    const keys = PARTNER_MISSIONS.map((m) => m.key).sort();
    for (const lang of languages) {
      const text = read(lang);
      expect(Object.keys(text).sort(), lang).toEqual(keys);
      for (const [key, value] of Object.entries(text)) {
        expect(value, `${lang}.${key}`).toHaveLength(2);
        expect(value.every((s) => s.trim().length > 0), `${lang}.${key}`).toBe(true);
      }
    }
  });

  it('chooses pools by the woman\'s stage', () => {
    expect(missionPoolsFor({ lifeStage: 'flow' })).toEqual(['flow']);
    expect(missionPoolsFor({ lifeStage: 'bump', pregnancyWeek: 20 })).toEqual(['bump']);
    expect(missionPoolsFor({ lifeStage: 'bump', pregnancyWeek: 35 })).toEqual(['bump_late', 'bump']);
    expect(missionPoolsFor({ lifeStage: 'mommy', babyAgeDays: 30 })).toEqual(['newborn', 'mommy']);
    expect(missionPoolsFor({ lifeStage: 'mommy', babyAgeDays: 200 })).toEqual(['mommy']);
    expect(missionPoolsFor({})).toEqual([]);
  });

  it('never shows pregnancy tasks outside pregnancy and is stable for a day', () => {
    const day = new Date(2026, 9, 30);
    for (const stage of [{ lifeStage: 'flow' }, { lifeStage: 'mommy', babyAgeDays: 200 }]) {
      const picked = pickDailyMissions(stage, day);
      expect(picked).toHaveLength(7);
      expect(picked.some((m) => m.pool === 'bump' || m.pool === 'bump_late')).toBe(false);
      expect(new Set(picked.map((m) => m.key)).size).toBe(7);
      expect(pickDailyMissions(stage, day)).toEqual(picked);
    }
    const late = pickDailyMissions({ lifeStage: 'bump', pregnancyWeek: 37 }, day);
    expect(late.slice(0, 4).every((m) => m.pool === 'bump_late' || m.pool === 'bump')).toBe(true);
    expect(late.filter((m) => m.pool === 'bump_late').length).toBeGreaterThan(0);
  });

  it('stores one id per day and mission', () => {
    expect(dailyMissionId('any_walk', new Date(2026, 9, 30))).toBe('daily-20261030-any_walk');
  });
});

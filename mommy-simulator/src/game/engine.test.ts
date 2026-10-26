import { describe, expect, it } from 'vitest';
import { CHAPTERS, FURNITURE } from './content';
import { activityById, chapterCanAdvance, createState, dailyGoals, DEFAULT_AVATAR, goalsComplete, reducer, validateState } from './engine';
import type { ActivityId, GameState } from './types';
import { parseSave } from './persistence';
import { BIRTH_CHAPTER, FIRST_BABY_CHAPTER } from './scenario';
import { currentStep, missionFinished, simulationWeek } from './progression';
import { householdActivityIssue } from './luzern';

const start = (chapter = 0) => reducer(createState(), { type: 'START', avatar: DEFAULT_AVATAR, chapter, language: 'az' });
function activity(state: GameState, id: ActivityId, quality = 0) {
  let next = reducer(state, { type: 'BEGIN', id, quality });
  for (let i = 0; i < 10; i++) next = reducer(next, { type: 'TICK', dt: 1 });
  return next;
}

describe('a complete family story', () => {
  it('plays every ordered mission from the pregnancy test through birth and the first year', () => {
    let state = start();
    for (let chapter = 0; chapter < CHAPTERS.length; chapter++) {
      expect(state.chapter).toBe(chapter);
      const expectedWeek = CHAPTERS[chapter].week;
      expect(simulationWeek(state)).toBe(expectedWeek);
      for (const step of CHAPTERS[chapter].mission.steps) {
        expect(currentStep(state)?.id).toBe(step.id);
        if (step.travelTo) state = reducer(state, { type: 'TRAVEL', location: step.travelTo });
        else if (step.action === 'birth') {
          for (let stage = 1; stage <= 4; stage++) state = reducer(state, { type: 'BIRTH_STAGE', stage });
          state = reducer(state, { type: 'BIRTH_COMPLETE', quality: 85 });
        } else {
          if (step.action === 'birthplan') state = reducer(state, { type: 'BIRTH_PLAN', plan: 'vaginal' });
          if (householdActivityIssue(state, step.action) === 'stockLow') {
            state = reducer(state, { type: 'TRAVEL', location: 'market' });
            state = reducer(state, { type: 'SHOP', basket: { vegetables: 3, milk: 3, bread: 3 } });
            state = reducer(state, { type: 'TRAVEL', location: 'home' });
          }
          state = activity(state, step.action, step.interactive ? 80 : 0);
        }
        expect(state.missions.completed).toContain(step.id);
        expect(validateState(state)).toBe(true);
      }
      expect(missionFinished(state)).toBe(true);
      const coins = state.coins;
      state = reducer(state, { type: 'CLAIM_MISSION' });
      expect(state.coins).toBe(coins + CHAPTERS[chapter].mission.reward);
      expect(reducer(state, { type: 'CLAIM_MISSION' })).toBe(state);
      expect(chapterCanAdvance(state)).toBe(chapter < CHAPTERS.length - 1);
      if (chapter < CHAPTERS.length - 1) state = reducer(state, { type: 'ADVANCE_CHAPTER' });
    }
    expect(state.missions.completed).toHaveLength(CHAPTERS.reduce((n, c) => n + c.mission.steps.length, 0));
    expect(state.pregnancy.born).toBe(true);
    expect(state.pregnancy.appointments.length).toBe(2);
    expect(state.stars).toBe(41);
    expect(state.memories.some(m => m.id === 'birth-story')).toBe(true);
    expect(state.unlockedChapter).toBe(CHAPTERS.length - 1);
  });

  it('keeps missions ordered, requires interactive play and prevents premature birth', () => {
    const state = start();
    const outOfOrder = activity(state, 'cook', 100);
    expect(currentStep(outOfOrder)?.action).toBe('test');
    const skippedGame = activity(state, 'test', 0);
    expect(currentStep(skippedGame)?.action).toBe('test');
    expect(reducer(state, { type: 'BIRTH_COMPLETE', quality: 100 })).toBe(state);
    expect(reducer(state, { type: 'BIRTH_STAGE', stage: 1 })).toBe(state);
    const done = activity(state, 'test', 100);
    expect(currentStep(done)?.action).toBe('cook');
  });

  it('supports caesarean birth with one durable first-embrace receipt', () => {
    const beforeBirth = CHAPTERS.slice(0, BIRTH_CHAPTER).flatMap(c => c.mission.steps.map(s => s.id));
    let state: GameState = { ...start(), chapter: BIRTH_CHAPTER, unlockedChapter: BIRTH_CHAPTER,
      missions: { completed: beforeBirth, quality: {}, rewards: [] } };
    state = reducer(state, { type: 'BIRTH_PLAN', plan: 'cesarean' });
    for (const step of CHAPTERS[BIRTH_CHAPTER].mission.steps.slice(0, -1)) {
      if (step.travelTo) state = reducer(state, { type: 'TRAVEL', location: step.travelTo });
      else state = activity(state, step.action, 100);
    }
    expect(state.location).toBe('clinic');
    expect(reducer(state, { type: 'BIRTH_STAGE', stage: 4 })).toBe(state);
    for (let stage = 1; stage <= 4; stage++) state = reducer(state, { type: 'BIRTH_STAGE', stage });
    state = reducer(state, { type: 'BIRTH_COMPLETE', quality: 90 });
    expect(state.pregnancy.born).toBe(true);
    expect(state.pregnancy.birthPlan).toBe('cesarean');
    expect(reducer(state, { type: 'BIRTH_COMPLETE', quality: 90 })).toBe(state);
    expect(state.memories.filter(m => m.id === 'birth-story')).toHaveLength(1);
    expect(reducer(state, { type: 'ADVANCE_CHAPTER' }).chapter).toBe(FIRST_BABY_CHAPTER);
  });

  it('bounds elapsed time, pauses needs and forbids overlapping or wrong-stage actions', () => {
    const state = start(), idle = reducer(state, { type: 'SETTINGS', settings: { speed: 0 } });
    expect(reducer(idle, { type: 'TICK', dt: 3600 })).toBe(idle);
    expect(reducer(state, { type: 'BEGIN', id: 'feed' })).toBe(state);
    const busy = reducer(state, { type: 'BEGIN', id: 'cook' });
    expect(reducer(busy, { type: 'BEGIN', id: 'rest' })).toBe(busy);
    const ticked = reducer(busy, { type: 'TICK', dt: 100000 });
    expect(ticked.activity?.elapsed).toBeLessThanOrEqual(1.1);
    expect(reducer(state, { type: 'TICK', dt: NaN })).toBe(state);
    expect(reducer(state, { type: 'ADVANCE_CHAPTER' })).toBe(state);
    expect(reducer(state, { type: 'SLEEP' })).toBe(state);
    expect(reducer(start(4), { type: 'BEGIN', id: 'pack' }).activity).toBeNull();
  });

  it('rewards care, recovery and family support without negative stats', () => {
    let state = { ...start(4), needs: { ...start(4).needs, energy: 3, babyFood: 2, comfort: 4 } };
    const before = state.coins;
    for (const id of ['help', 'feed', 'rest', 'diaper', 'lullaby'] as const) state = activity(state, id, 100);
    expect(state.needs.energy).toBeGreaterThan(20);
    expect(state.needs.babyFood).toBeGreaterThan(45);
    expect(state.coins).toBeGreaterThan(before);
    expect(Object.values(state.needs).every(n => n >= 0 && n <= 100)).toBe(true);
    expect(state.skills.care).toBeGreaterThan(0);
  });

  it('guards the economy, duplicate purchases and blocked decor placements', () => {
    const state = start();
    expect(reducer(state, { type: 'BUY', itemId: 'not-real' })).toBe(state);
    const item = FURNITURE.find(i => i.id === 'moon-lamp')!;
    const bought = reducer(state, { type: 'BUY', itemId: item.id });
    expect(bought.coins).toBe(state.coins - item.price);
    expect(reducer(bought, { type: 'BUY', itemId: item.id })).toBe(bought);
    expect(reducer({ ...state, coins: 0 }, { type: 'BUY', itemId: item.id }).inventory).not.toContain(item.id);
    const invalid = { id: 'fixture', itemId: item.id, x: -3.65, z: .35, rotation: 0 };
    expect(reducer(bought, { type: 'PLACE', placement: invalid })).toBe(bought);
    const valid = { ...invalid, x: 4.5, z: 3.25 };
    const placed = reducer(bought, { type: 'PLACE', placement: valid });
    expect(placed.placements).toHaveLength(1);
    expect(reducer(placed, { type: 'PLACE', placement: { ...valid, id: 'duplicate' } })).toBe(placed);
    expect(validateState(placed)).toBe(true);
  });
});

describe('durable, bounded game saves', () => {
  it('restores identity and progress while retiring interrupted activities', () => {
    const state = reducer(activity(start(4), 'help'), { type: 'BEGIN', id: 'feed' });
    const loaded = parseSave(JSON.stringify(state));
    expect(loaded?.avatar).toEqual(DEFAULT_AVATAR);
    expect(loaded?.chapter).toBe(FIRST_BABY_CHAPTER + 1);
    expect(loaded?.totalActions).toBe(1);
    expect(loaded?.activity).toBeNull();
  });

  it('rejects malformed, out-of-bounds and non-game input', () => {
    const state = start();
    for (const patch of [{ chapter: 100 }, { coins: -10 }, { avatar: { ...state.avatar, skin: 'javascript:x' } },
      { needs: { ...state.needs, energy: NaN } }, { placements: [{ id: 'x', itemId: 'not-owned', x: 0, z: 0, rotation: 0 }] },
      { memories: [{ id: 'bad', photo: '<script>' }] }, { settings: { ...state.settings, speed: 50 } }]) {
      expect(parseSave(JSON.stringify({ ...state, ...patch }))).toBeNull();
    }
    expect(parseSave('{broken')).toBeNull();
    expect(parseSave(JSON.stringify({ session: 'not-a-save' }))).toBeNull();
    expect(activityById('rest').effect.energy).toBeGreaterThan(0);
  });
  it('upgrades the earlier native save without losing the family, coins or photos', () => {
    const current = start();
    const legacy = { ...current, schema: 1, chapter: 4, unlockedChapter: 4, coins: 476,
      avatar: { ...current.avatar, name: 'Leyla' }, memories: [{ id: 'legacy-photo', kind: 'photo', chapter: 4, day: 1,
        title: ['Ev', 'Home', 'Ev'], description: ['Xatirə', 'Memory', 'Anı'], icon: 'camera', photo: 'data:image/jpeg;base64,AAAA' }] };
    delete (legacy as Partial<typeof legacy>).missions;
    delete (legacy as Partial<typeof legacy>).pregnancy;
    const loaded = parseSave(JSON.stringify(legacy));
    expect(loaded?.schema).toBe(3);
    expect(loaded?.coins).toBe(476);
    expect(loaded?.avatar.name).toBe('Leyla');
    expect(loaded?.pregnancy.born).toBe(true);
    expect(loaded?.memories[0].photo).toBe(legacy.memories[0].photo);
    expect(loaded?.chapter).toBe(10);
  });
});

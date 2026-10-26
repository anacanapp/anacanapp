import { describe, expect, it } from 'vitest';
import { createState, DEFAULT_AVATAR, reducer, validateState } from './engine';
import { dailyLifeGoals, GROCERY_PRODUCTS, groceryTotal, MEAL_INGREDIENTS } from './luzern';
import { householdVisuals, interiorFamily, interiorLight, layoutInteriorPins, roomForActivity } from './interior';
import { activityById } from './engine';
import { parseSave } from './persistence';
import type { ActivityId, GameState } from './types';

const start = () => reducer(createState(), { type: 'START', avatar: DEFAULT_AVATAR, chapter: 0, language: 'az' });
const finish = (state: GameState, id: ActivityId) => {
  let next = reducer(state, { type: 'BEGIN', id, quality: 100 });
  for (let i = 0; i < 10; i++) next = reducer(next, { type: 'TICK', dt: 1 });
  return next;
};

describe('a durable Luzern household', () => {
  it('charges exact CHF centimes, replenishes the pantry, and retains purchases on reload', () => {
    const home = start(), market = reducer(home, { type: 'TRAVEL', location: 'market' });
    const basket = { vegetables: 2, milk: 1, bread: 1 }, cost = groceryTotal(basket);
    const bought = reducer(market, { type: 'SHOP', basket });
    expect(bought.household.cash).toBe(home.household.cash - cost);
    expect(bought.household.groceries).toEqual({ ...home.household.groceries, vegetables: 5, milk: 4, bread: 4 });
    expect(bought.coins).toBe(home.coins);
    expect(bought.household.purchases).toBe(1);
    const loaded = parseSave(JSON.stringify(bought));
    expect(loaded?.household).toEqual(bought.household);
    expect(validateState(bought)).toBe(true);
  });

  it('rejects unpaid, invalid, unaffordable, over-capacity and busy checkouts atomically', () => {
    const home = start(), market = reducer(home, { type: 'TRAVEL', location: 'market' });
    expect(reducer(home, { type: 'SHOP', basket: { milk: 1 } })).toBe(home);
    expect(reducer(market, { type: 'BEGIN', id: 'groceries' })).toBe(market);
    for (const basket of [{}, { milk: -1 }, { milk: .5 }, { milk: 7 }, { milk: NaN }, { cash: 1 }]) {
      expect(reducer(market, { type: 'SHOP', basket })).toBe(market);
    }
    const poor = { ...market, household: { ...market.household, cash: 100 } };
    expect(reducer(poor, { type: 'SHOP', basket: { milk: 1 } })).toBe(poor);
    const full = { ...market, household: { ...market.household, groceries: { ...market.household.groceries, milk: 40 } } };
    expect(reducer(full, { type: 'SHOP', basket: { milk: 1, bread: 1 } })).toBe(full);
    const paid = reducer(market, { type: 'SHOP', basket: { milk: 1 } }), busy = reducer(paid, { type: 'BEGIN', id: 'groceries', quality: 100 });
    expect(reducer(busy, { type: 'SHOP', basket: { milk: 1 } })).toBe(busy);
  });

  it('consumes real ingredients, blocks an empty pantry and resumes after a market visit', () => {
    const initial = start();
    let state = initial;
    for (let n = 0; n < 3; n++) state = finish(state, 'cook');
    expect(state.household.meals).toBe(3);
    for (const id of MEAL_INGREDIENTS) expect(state.household.groceries[id]).toBe(0);
    expect(state.household.groceries.fruit).toBe(initial.household.groceries.fruit);
    expect(reducer(state, { type: 'BEGIN', id: 'cook', quality: 100 })).toBe(state);
    const cash = state.household.cash;
    state = reducer(state, { type: 'TRAVEL', location: 'market' });
    state = reducer(state, { type: 'SHOP', basket: { vegetables: 1, milk: 1, bread: 1 } });
    state = reducer(state, { type: 'TRAVEL', location: 'home' });
    state = finish(state, 'cook');
    expect(state.household.meals).toBe(4);
    expect(state.household.cash).toBe(cash - GROCERY_PRODUCTS.filter(p => MEAL_INGREDIENTS.includes(p.id)).reduce((sum, p) => sum + p.price, 0));
    expect(validateState(state)).toBe(true);
  });

  it('conserves laundry across partial loads, clean backlog, cancellation and folding', () => {
    const base = start(), state = { ...base, household: { ...base.household, laundry: { dirty: 9, clean: 2, folded: 3 } } };
    const interrupted = reducer(reducer(state, { type: 'BEGIN', id: 'laundry' }), { type: 'CANCEL_ACTIVITY' });
    expect(interrupted.household.laundry).toEqual(state.household.laundry);
    const first = finish(state, 'laundry');
    expect(first.household.laundry).toEqual({ dirty: 5, clean: 0, folded: 9 });
    const second = finish(first, 'laundry');
    expect(second.household.laundry).toEqual({ dirty: 0, clean: 0, folded: 14 });
    expect(reducer(second, { type: 'BEGIN', id: 'laundry' })).toBe(second);
    expect(parseSave(JSON.stringify(second))?.household.laundry).toEqual(second.household.laundry);
  });

  it('cleans visible dust, shares work, and generates next-day laundry and weather', () => {
    const base = start(), state = { ...base, dailyActions: 3, household: { ...base.household, cleanliness: 30 } };
    const cleaned = finish(state, 'clean');
    expect(cleaned.household.cleanliness).toBeGreaterThan(52);
    expect(householdVisuals(cleaned).dust).toBeLessThan(householdVisuals(state).dust);
    const shared = finish(cleaned, 'help');
    expect(shared.household.relationship).toBe(84);
    const next = reducer(shared, { type: 'SLEEP' });
    expect(next.household.laundry.dirty).toBe(state.household.laundry.dirty + 3);
    expect(next.household.chores).toEqual([]);
    expect(next.household.cleanliness).toBe(shared.household.cleanliness - 8);
    expect(next.household.weather).toBe('cloudy');
    expect(validateState(next)).toBe(true);
  });

  it('requires all daily chores and grants the daily reward only once', () => {
    const base = start();
    expect(reducer(base, { type: 'CLAIM_LIFE_DAY' })).toBe(base);
    const done = { ...base, household: { ...base.household, chores: dailyLifeGoals(base) } };
    const rewarded = reducer(done, { type: 'CLAIM_LIFE_DAY' });
    expect(rewarded.coins).toBe(done.coins + 45);
    expect(rewarded.household.cash).toBe(done.household.cash);
    expect(reducer(rewarded, { type: 'CLAIM_LIFE_DAY' })).toBe(rewarded);
  });

  it('keeps a completed laundry goal stable and substitutes cleaning when the basket starts empty', () => {
    const state = start(), washed = finish(state, 'laundry');
    expect(dailyLifeGoals(washed)).toContain('laundry');
    const empty = { ...state, household: { ...state.household, laundry: { dirty: 0, clean: 0, folded: 6 } } };
    expect(dailyLifeGoals(empty)).toContain('clean');
    expect(dailyLifeGoals(empty)).not.toContain('laundry');
  });
});

describe('the room follows the actual family', () => {
  it('shows no baby before birth and changes from newborn cuddles to a playing toddler', () => {
    const base = start();
    expect(interiorFamily(base, 'nursery').holding).toBe(false);
    expect(interiorFamily(base, 'nursery').childVisible).toBe(false);
    const born = { ...base, chapter: 10, pregnancy: { ...base.pregnancy, born: true } };
    expect(interiorFamily(born, 'nursery')).toMatchObject({ holding: true, childVisible: false, cribReady: true });
    expect(interiorFamily(born, 'clinic')).toMatchObject({ motherActivity: 'skin', holding: true });
    const toddler = { ...born, chapter: 13 };
    expect(interiorFamily(toddler, 'nursery')).toMatchObject({ stage: 'toddler', holding: false, childVisible: true });
    expect(interiorFamily(toddler, 'bathroom').fatherVisible).toBe(false);
  });

  it('keeps bedroom rest and bathroom laundry in the selected room and clinic care at the clinic', () => {
    const base = start();
    expect(roomForActivity(activityById('rest'), base, 'bedroom')).toBe('bedroom');
    expect(roomForActivity(activityById('laundry'), base, 'bathroom')).toBe('bathroom');
    expect(roomForActivity(activityById('cook'), base, 'living')).toBe('kitchen');
    expect(roomForActivity(activityById('feed'), { ...base, location: 'clinic' }, 'nursery')).toBe('clinic');
  });

  it('changes light for morning, rain and late evening', () => {
    const base = start(), noon = { ...base, time: 12 * 60 };
    expect(interiorLight(noon).daylight).toBeGreaterThan(.9);
    expect(interiorLight({ ...noon, household: { ...base.household, weather: 'rain' } }).daylight).toBeLessThan(.5);
    expect(interiorLight({ ...base, time: 23 * 60 })).toMatchObject({ daylight: 0, lamps: 1 });
  });

  it('separates overlapping object buttons inside a small phone viewport', () => {
    const pins = layoutInteriorPins(['feed', 'diaper', 'play', 'lullaby', 'read', 'talk'].map(id => ({ id: id as ActivityId, x: 265, y: 200 })), 320, 350);
    expect(pins).toHaveLength(6);
    for (const pin of pins) {
      expect(pin.x).toBeGreaterThanOrEqual(30); expect(pin.x).toBeLessThanOrEqual(234);
      expect(pin.y).toBeGreaterThanOrEqual(35); expect(pin.y).toBeLessThanOrEqual(306);
      for (const other of pins.filter(other => other.id !== pin.id)) expect(Math.hypot(pin.x - other.x, pin.y - other.y)).toBeGreaterThanOrEqual(56);
    }
  });
});

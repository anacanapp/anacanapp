import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveOnboardingSetup, claimOnboardingOffer, completeOnboarding } from './onboarding-persistence';
import { newOnboardingDraft, newOnboardingChild, type OnboardingDraft } from './onboarding-model';

const actor = '11111111-1111-4111-8111-111111111111', backend = 'https://api.anacan.az';
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-22T12:00:00Z')); });
afterEach(() => vi.useRealTimers());
function database() {
  const tables: Record<string, any[]> = { profiles: [{ user_id: actor, life_stage: null, name: 'Aysel', country_code: 'AZ', avatar_url: 'preserved', onboarding_answers: { retained: 'yes' } }], user_children: [], user_preferences: [] };
  const writes: { table: string; body: any }[] = [];
  let account = actor, realm = backend;
  let fail: ((table: string, body: any, after: boolean) => boolean) | null = null;
  const read = (row: any, key: string) => key.split(/->>?/).reduce((value, part) => value?.[part], row);
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: account } } }, error: null }) },
    from(table: string) {
      let operation = 'select', body: any, many = true;
      const filters: ((row: any) => boolean)[] = [];
      const query: any = {
        select() { return query; }, eq(key: string, value: any) { filters.push(row => read(row, key) === value); return query; },
        is(key: string, value: any) { filters.push(row => (read(row, key) ?? null) === value); return query; },
        update(value: any) { operation = 'update'; body = structuredClone(value); return query; },
        insert(value: any) { operation = 'insert'; body = structuredClone(value); return query; },
        upsert(value: any) { operation = 'upsert'; body = structuredClone(value); return query; },
        single() { many = false; return query; }, maybeSingle() { many = false; return query; },
        then(resolve: any, reject: any) {
          return Promise.resolve().then(() => {
            if (operation !== 'select' && fail?.(table, body, false)) return { data: null, error: { code: 'TEST_FAILURE' } };
            let rows = tables[table].filter(row => filters.every(filter => filter(row)));
            if (operation === 'insert') {
              if (tables[table].some(row => row.id === body.id)) return { data: null, error: { code: '23505' } };
              rows = [structuredClone(body)]; tables[table].push(...rows);
            } else if (operation === 'upsert') {
              const found = tables[table].find(row => row.user_id === body.user_id);
              if (found) { Object.assign(found, body); rows = [found]; } else { rows = [structuredClone(body)]; tables[table].push(...rows); }
            } else if (operation === 'update') rows.forEach(row => Object.assign(row, body));
            if (operation !== 'select') {
              writes.push({ table, body });
              if (fail?.(table, body, true)) return { data: null, error: { code: 'LOST_RESPONSE' } };
            }
            return { data: structuredClone(many ? rows : rows[0] ?? null), error: null };
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { tables, writes, port: { client: client as any, realm: () => realm }, setActor: (value: string) => { account = value; },
    setRealm: (value: string) => { realm = value; }, setFailure: (value: typeof fail) => { fail = value; } };
}
function fixture(stage: 'bump' | 'mommy' | 'flow'): OnboardingDraft {
  const draft = { ...newOnboardingDraft(actor, backend, 'Aysel'), stage, pregnancyDate: '2026-06-01', lastPeriodDate: '2026-09-01', saveStarted: true };
  draft.children[0] = { ...draft.children[0], name: 'Leyla', birthDate: '2026-08-01', gender: 'girl', term: 'preterm', gestationalWeeks: 34 };
  draft.answers = { budget: 'value', sleep: 'poor', supportLevel: 'some', duration: 'year', bumpSymptoms: ['nausea'], feeding: 'mixed', regularity: 'irregular' };
  return draft;
}
describe('confirmed, resumable data writes', () => {
  it.each(['bump', 'mommy', 'flow'] as const)('%s writes all applicable values and preserves unrelated profile fields', async stage => {
    const db = database(), draft = fixture(stage);
    const result = await saveOnboardingSetup(draft, 'ka', () => {}, db.port);
    expect(result).toMatchObject({ user_id: actor, name: 'Aysel', life_stage: stage, country_code: 'AZ', avatar_url: 'preserved',
      onboarding_answers: { retained: 'yes', sleep: 'poor', budget: 'value', notifications: 'skipped', journey: { version: 3, id: draft.id, completedAt: null } } });
    expect(db.tables.user_preferences[0]).toMatchObject({ user_id: actor, language: 'ka' });
    expect(db.writes.at(-1)?.table).toBe('profiles');
    if (stage === 'mommy') {
      expect(db.tables.user_children).toHaveLength(1);
      expect(db.tables.user_children[0]).toMatchObject({ id: draft.children[0].id, birth_date: '2026-08-01', due_date: '2026-09-12', gender: 'girl' });
      expect(result).toMatchObject({ baby_name: 'Leyla', baby_count: 1 });
    } else if (stage === 'bump') expect(result).toMatchObject({ last_period_date: '2026-06-01', due_date: '2027-03-08' });
    else expect(result).toMatchObject({ last_period_date: '2026-09-01', cycle_length: 28, period_length: 5 });
  });
  it('never completes after a child error and retries with the same child IDs', async () => {
    const db = database(), draft = fixture('mommy');
    draft.babyCount = 2; draft.children.push({ ...newOnboardingChild(), name: 'Ali', gender: 'boy', birthDate: '2026-08-01', term: 'preterm' });
    db.setFailure((table, body, after) => table === 'user_children' && body.name === 'Ali' && !after);
    await expect(saveOnboardingSetup(draft, 'az', () => {}, db.port)).rejects.toThrow('ONBOARDING_CHILD_SAVE_FAILED');
    expect(db.tables.profiles[0].life_stage).toBeNull(); expect(db.tables.user_children).toHaveLength(1);
    db.setFailure(null); await saveOnboardingSetup(draft, 'az', () => {}, db.port);
    expect(db.tables.user_children).toHaveLength(2); expect(db.tables.profiles[0].baby_count).toBe(2);
  });
  it('recovers a lost profile commit response without duplicate children or date changes', async () => {
    const db = database(), draft = fixture('mommy');
    db.setFailure((table, _body, after) => table === 'profiles' && after);
    await expect(saveOnboardingSetup(draft, 'ar', () => {}, db.port)).rejects.toThrow('ONBOARDING_PROFILE_SAVE_FAILED');
    db.setFailure(null); const before = db.writes.length;
    await saveOnboardingSetup(draft, 'ar', () => {}, db.port);
    expect(db.writes).toHaveLength(before); expect(db.tables.user_children).toHaveLength(1);
  });
  it('stops on preference failures, account changes or backend changes', async () => {
    const db = database(), draft = fixture('bump');
    db.setFailure((table, _body, after) => table === 'user_preferences' && !after);
    await expect(saveOnboardingSetup(draft, 'az', () => {}, db.port)).rejects.toThrow('ONBOARDING_PREFERENCES_SAVE_FAILED');
    expect(db.tables.profiles[0].life_stage).toBeNull();
    db.setActor('other'); await expect(saveOnboardingSetup(draft, 'az', () => {}, db.port)).rejects.toThrow('ONBOARDING_ACCOUNT_CHANGED');
    db.setActor(actor); db.setRealm('https://other.example');
    await expect(saveOnboardingSetup(draft, 'az', () => {}, db.port)).rejects.toThrow('ONBOARDING_ACCOUNT_CHANGED');
  });
  it('only explicit notification permission grants enable push preferences', async () => {
    for (const choice of ['granted','denied','skipped'] as const) {
      const db = database(); db.tables.user_preferences.push({ user_id: actor, push_enabled: false });
      await saveOnboardingSetup({ ...fixture('flow'), notifications: choice }, 'ru', () => {}, db.port);
      expect(db.tables.user_preferences[0].push_enabled).toBe(choice === 'granted');
    }
  });
  it('does not overwrite an established profile during a repeated setup', async () => {
    const db = database(); db.tables.profiles[0].life_stage = 'bump'; db.tables.profiles[0].last_period_date = '2026-07-01';
    await expect(saveOnboardingSetup(fixture('flow'), 'az', () => {}, db.port)).rejects.toThrow('ONBOARDING_PROFILE_ALREADY_CONFIGURED');
    expect(db.writes).toHaveLength(0); expect(db.tables.profiles[0].last_period_date).toBe('2026-07-01');
  });
  it('claims the offer once across concurrent clients and preserves answers on completion', async () => {
    const db = database(); await saveOnboardingSetup(fixture('flow'), 'az', () => {}, db.port);
    const attempts = await Promise.all([claimOnboardingOffer(actor, backend, db.port), claimOnboardingOffer(actor, backend, db.port)]);
    expect(attempts.filter(result => result.changed)).toHaveLength(1);
    expect((await claimOnboardingOffer(actor, backend, db.port)).changed).toBe(false);
    const done = await completeOnboarding(actor, backend, 'free', db.port);
    expect(done.profile.onboarding_answers).toMatchObject({ sleep: 'poor', retained: 'yes', journey: { outcome: 'free' } });
    expect((await completeOnboarding(actor, backend, 'purchased', db.port)).changed).toBe(false);
    expect((await claimOnboardingOffer(actor, backend, db.port)).changed).toBe(false);
  });
});

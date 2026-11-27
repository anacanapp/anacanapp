import { describe, expect, it } from 'vitest';
import { feedingLinkVisible, feedsFromLogs, homeCardState, isWeaningQuestion, weaningOfferable } from './weaning-entry';
import { createPlan, DEFAULT_FEEDS, isoDay } from './weaning';

const NOW = new Date(2026, 10, 6, 12, 0, 0);
const base = { lifeStage: 'mommy', birthDate: '2025-09-01', setting: 'on', plan: null, continueBF: false, now: NOW };

describe('weaningOfferable', () => {
  it('needs the Ana module, the admin switch and a child of 12+ months', () => {
    expect(weaningOfferable(base)).toBe(true);
    expect(weaningOfferable({ ...base, lifeStage: 'bump' })).toBe(false);
    expect(weaningOfferable({ ...base, setting: 'off' })).toBe(false);
    expect(weaningOfferable({ ...base, setting: undefined })).toBe(false);
    expect(weaningOfferable({ ...base, birthDate: '2026-03-01' })).toBe(false); // 8 months
    expect(weaningOfferable({ ...base, birthDate: null })).toBe(false);
  });
});

describe('homeCardState', () => {
  it('shows the one-time intro card', () => {
    expect(homeCardState({ ...base, dismissed: false }).kind).toBe('intro');
  });
  it('stays hidden after "continue breastfeeding" or dismiss', () => {
    expect(homeCardState({ ...base, continueBF: true, dismissed: false }).kind).toBe('hidden');
    expect(homeCardState({ ...base, dismissed: true }).kind).toBe('hidden');
  });
  it('shows plan progress when a plan runs, even after dismiss', () => {
    const plan = createPlan({ feeds: DEFAULT_FEEDS, pace: 'gentle', nightMode: 'last', start: isoDay(NOW), childId: null, now: NOW });
    plan.steps[0] = { ...plan.steps[0], status: 'done' };
    const s = homeCardState({ ...base, plan, dismissed: true });
    expect(s.kind).toBe('active');
    if (s.kind === 'active') { expect(s.done).toBe(1); expect(s.total).toBe(plan.steps.length); expect(s.step?.id).toBe(plan.steps[1].id); expect(s.paused).toBe(false); }
    expect(homeCardState({ ...base, plan: { ...plan, status: 'paused' }, dismissed: false })).toMatchObject({ kind: 'active', paused: true });
  });
  it('is hidden for a finished plan once the mother dismissed the card', () => {
    const plan = { ...createPlan({ feeds: DEFAULT_FEEDS, pace: 'gentle', nightMode: 'last', start: isoDay(NOW), childId: null, now: NOW }), status: 'finished' as const };
    expect(homeCardState({ ...base, plan, dismissed: true }).kind).toBe('hidden');
  });
});

describe('feedingLinkVisible', () => {
  it('only without a running plan and without "continue breastfeeding"', () => {
    expect(feedingLinkVisible(base)).toBe(true);
    expect(feedingLinkVisible({ ...base, continueBF: true })).toBe(false);
    const plan = createPlan({ feeds: DEFAULT_FEEDS, pace: 'gentle', nightMode: 'last', start: isoDay(NOW), childId: null, now: NOW });
    expect(feedingLinkVisible({ ...base, plan })).toBe(false);
    expect(feedingLinkVisible({ ...base, setting: 'off' })).toBe(false);
  });
});

describe('feedsFromLogs', () => {
  const at = (daysAgo: number, h: number, feed_type = 'breast_left') => {
    const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(h, 10, 0, 0);
    return { log_type: 'feeding', feed_type, start_time: d.toISOString() };
  };
  it('counts breastfeeds by time of day over the logged days', () => {
    const logs = [1, 2, 3, 4].flatMap((d) => [at(d, 7), at(d, 11), at(d, 15), at(d, 20), at(d, 2)]);
    // per day: morning 1, daytime 2 (one is the nap feed), bedtime 1, night 1
    expect(feedsFromLogs(logs, DEFAULT_FEEDS, NOW)).toEqual({ morning: true, day: 1, nap: true, bedtime: true, night: 1 });
  });
  it('ignores formula, solids, other logs and logs older than 7 days', () => {
    const logs = [1, 2, 3].flatMap((d) => [at(d, 11), at(d, 23)]);
    const noise = [at(1, 10, 'formula'), { log_type: 'sleep', feed_type: null, start_time: at(1, 10).start_time }, at(9, 10), at(10, 23)];
    expect(feedsFromLogs([...logs, ...noise], { ...DEFAULT_FEEDS, nap: false }, NOW)).toEqual({ morning: false, day: 1, nap: false, bedtime: false, night: 1 });
  });
  it('needs at least 3 logged days', () => {
    expect(feedsFromLogs([at(1, 11), at(2, 11)], DEFAULT_FEEDS, NOW)).toBeNull();
    expect(feedsFromLogs([], DEFAULT_FEEDS, NOW)).toBeNull();
  });
  it('clamps to the builder limits', () => {
    const logs = [1, 2, 3].flatMap((d) => [9, 10, 11, 12, 13, 14, 15, 16, 22, 23, 0, 1, 2].map((h) => at(d, h)));
    const f = feedsFromLogs(logs, DEFAULT_FEEDS, NOW)!;
    expect(f.day).toBeLessThanOrEqual(4);
    expect(f.night).toBeLessThanOrEqual(3);
  });
});

describe('isWeaningQuestion', () => {
  it.each([
    'Qızım 14 aylıqdır, onu süddən necə ayırım?', 'Döşdən ayırmaq istəyirəm', 'Əmizdirməni necə dayandırım?',
    'How do I wean my toddler?', 'when to stop breastfeeding', 'Как отлучить ребенка от груди?',
    'Bebeğimi sütten kesmek istiyorum', 'Wie kann ich abstillen?', 'Comment réussir le sevrage ?', '如何给宝宝断奶', 'كيف أفطم طفلي',
  ])('detects: %s', (q) => expect(isWeaningQuestion(q)).toBe(true));
  it.each(['Körpəm gecə tez-tez oyanır', 'How much milk should my baby drink?', 'Süd azdır, nə edim?', '', null])('ignores: %s', (q) => expect(isWeaningQuestion(q as string)).toBe(false));
});

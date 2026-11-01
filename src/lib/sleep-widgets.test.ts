import { describe, expect, it } from 'vitest';
import type { SleepEntry } from './sleep-training';
import { awakeGaps, bedtimeFor, personalWakeWindow, predictDay, predictNextNap, upcomingRegressions, windowFactor } from './sleep-predict';
import { DEFAULT_NAP_ALERTS, inQuietHours, planNapAlerts } from './nap-alerts';
import { babyAgeText, buildWidgetSnapshot, compactDuration, DEFAULT_WIDGET_SETTINGS } from './home-widgets';
import { lastFeed } from '@/hooks/useHomeWidgetSync';
import az from '@/data/widgets/az.json';

const at = (h: number, m = 0, dayOffset = 0) => new Date(2026, 10, 10 + dayOffset, h, m);
const nap = (s: Date, e: Date, id = String(s.getTime())): SleepEntry => ({ id, start: s, end: e, minutes: Math.round((e.getTime() - s.getTime()) / 60000), kind: 'nap' });

describe('next nap prediction', () => {
  it('learns the awake time from logged daytime gaps', () => {
    const entries: SleepEntry[] = [];
    for (let d = -6; d <= -1; d++) {
      entries.push(nap(at(9, 0, d), at(10, 0, d)), nap(at(12, 30, d), at(13, 30, d)));
    }
    const gaps = awakeGaps(entries, at(14));
    expect(gaps.every((g) => g === 150)).toBe(true);
    const ww = personalWakeWindow(entries, '4-6', at(14));
    expect(ww.samples).toBe(6);
    expect(ww.minutes).toBeGreaterThan(120);
    expect(ww.minutes).toBeLessThan(150);
  });

  it('opens the window after the age wake time and pulls it earlier with sleepy cues', () => {
    const entries = [nap(at(10, 40), at(12, 45))];
    const base = predictNextNap({ entries, band: '1-3', now: at(13, 0) });
    expect(base.state).toBe('early');
    expect(base.lastWake?.getTime()).toBe(at(12, 45).getTime());
    expect(base.awakeMinutes).toBe(15);
    expect(base.windowStart!.getTime()).toBeGreaterThan(at(13, 30).getTime());
    const cued = predictNextNap({ entries, band: '1-3', now: at(13, 0), cues: ['yawn', 'rub_eyes'] });
    expect((base.windowStart!.getTime() - cued.windowStart!.getTime()) / 60000).toBe(10);
    expect(predictNextNap({ entries, band: '1-3', now: at(13, 0), sleepingSince: at(12, 59) }).state).toBe('sleeping');
    expect(predictNextNap({ entries: [], band: '1-3', now: at(13, 0) }).state).toBe('unknown');
    expect(predictNextNap({ entries, band: '1-3', now: at(16, 30) }).state).toBe('overtired');
  });

  it('turns a late window into bedtime and plans the rest of the day', () => {
    const late = predictNextNap({ entries: [nap(at(17, 0), at(18, 0))], band: '7-9', now: at(18, 10) });
    expect(late.isBedtime).toBe(true);
    const entries = [nap(at(9, 0), at(9, 45))];
    const next = predictNextNap({ entries, band: '4-6', now: at(10, 0) });
    const plan = predictDay({ entries, band: '4-6', now: at(10, 0), next });
    expect(plan[0].status).toBe('done');
    expect(plan.filter((p) => p.status === 'predicted' && p.kind === 'nap').length).toBeGreaterThanOrEqual(2);
    expect(plan[plan.length - 1].kind).toBe('bedtime');
    expect(plan[plan.length - 1].start.getTime()).toBe(bedtimeFor('4-6', at(10)).getTime());
    expect(windowFactor(0)).toBeLessThan(windowFactor(3));
  });

  it('lists upcoming regressions from the birth date', () => {
    const birth = new Date(2026, 6, 1);
    const list = upcomingRegressions(birth, new Date(2026, 9, 1));
    expect(list[0].key).toBe('m4');
    expect(list[0].daysUntil).toBeGreaterThan(0);
    expect(upcomingRegressions(birth, new Date(2026, 9, 25))[0].active).toBe(true);
  });
});

const BAND_MID = 120;

describe('sleep notifications plan', () => {
  const text = { napTitle: (m: number) => `in ${m}`, napBody: 'b', longTitle: 'l', longBody: 'lb', regressTitle: 'r', regressBody: 'rb' };
  it('schedules before the window, for long naps and before regressions, never in quiet hours', () => {
    const now = at(13, 0);
    const next = predictNextNap({ entries: [nap(at(10, 40), at(12, 45))], band: '1-3', now });
    const planned = planNapAlerts({ settings: DEFAULT_NAP_ALERTS, now, next, sleepingSince: null, regression: null, text });
    expect(planned).toHaveLength(1);
    expect(planned[0].at.getTime()).toBe(next.windowStart!.getTime() - 15 * 60000);
    const long = planNapAlerts({ settings: DEFAULT_NAP_ALERTS, now, next: { ...next, state: 'sleeping', windowStart: null }, sleepingSince: at(12, 30), regression: null, text });
    expect(long[0].at.getTime()).toBe(at(14, 30).getTime());
    expect(planNapAlerts({ settings: { ...DEFAULT_NAP_ALERTS, enabled: false }, now, next, sleepingSince: null, regression: null, text })).toEqual([]);
    expect(inQuietHours(at(23))).toBe(true);
    expect(inQuietHours(at(8))).toBe(false);
  });
});

describe('home widgets', () => {
  it('never puts the real feeding or sleep data into the snapshot without Premium (shows a locked sample)', () => {
    const care = { name: 'Murad', age: '3', emoji: '👶', lastFeedAt: 1, lastFeedText: 'x', nextNapStart: 2, nextNapEnd: 3, nextNapIsBedtime: false, sleepingSince: null, todayFeeds: 1, todaySleep: '1', todayDiapers: 1 };
    const free = buildWidgetSnapshot({ text: az, premium: false, settings: DEFAULT_WIDGET_SETTINGS, journey: null, care });
    // Non-Premium: a locked sample preview, never the user's real data.
    expect(free.careLocked).toBe(true);
    expect(free.care?.name).not.toBe('Murad');
    expect(free.care?.lastFeedAt).not.toBe(1);
    expect(free.care?.nextNapStart).not.toBe(2);
    expect(free.labels.premiumTitle).toBe(az.premium_title);
    expect(free.links.premium).toBe('anacan://premium');
    const paid = buildWidgetSnapshot({ text: az, premium: true, settings: { ...DEFAULT_WIDGET_SETTINGS, showFeed: false }, journey: null, care });
    expect(paid.careLocked).toBe(false);
    expect(paid.care?.lastFeedAt).toBeNull();
    expect(paid.care?.nextNapStart).toBe(2);
  });

  it('formats age, durations and the last feed', () => {
    expect(babyAgeText(az, new Date(2026, 6, 29), new Date(2026, 10, 10))).toBe('3 ay 12 gün');
    expect(babyAgeText(az, new Date(2026, 10, 1), new Date(2026, 10, 10))).toBe('9 gün');
    expect(babyAgeText(az, new Date(2025, 7, 10), new Date(2026, 10, 10))).toBe('1 yaş 3 ay');
    expect(compactDuration(az, 100)).toBe('1s 40d');
    expect(compactDuration(az, 25)).toBe('25 dəq');
    const feed = lastFeed(az, [
      { id: '1', log_type: 'feeding', feed_type: 'breast_left', start_time: '2026-11-10T10:00:00.000Z', end_time: '2026-11-10T10:14:00.000Z' },
      { id: '2', log_type: 'feeding', feed_type: 'formula', start_time: '2026-11-10T07:00:00.000Z' }
    ]);
    expect(feed?.text).toBe('Sol sinə · 14 dəq');
  });
});

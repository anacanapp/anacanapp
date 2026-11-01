import { describe, expect, it } from 'vitest';
import { DISABLED_CONFIG, parseReviewConfig, reviewDecision, type ReviewState } from './review-prompt';

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 20);
const on = { ...DISABLED_CONFIG, enabled: true };
const state = (over: Partial<ReviewState> = {}): ReviewState => ({
  now, platform: 'ios', build: 50, firstUseAt: now - 30 * DAY, sessions: 10, askedAt: [], lastCrashAt: null, lossRecovery: false, ...over
});

describe('store review gating', () => {
  it('stays off until the remote switch is on (crash fix first)', () => {
    expect(reviewDecision('milestone', DISABLED_CONFIG, state())).toEqual({ ok: false, reason: 'disabled' });
    expect(reviewDecision('milestone', on, state())).toEqual({ ok: true });
    expect(parseReviewConfig(null).enabled).toBe(false);
    expect(parseReviewConfig('{"enabled":true,"min_build_ios":"48"}')).toMatchObject({ enabled: true, min_build_ios: 48 });
  });

  it('blocks old builds, recent crashes, sensitive periods and the web', () => {
    expect(reviewDecision('milestone', { ...on, min_build_ios: 51 }, state()).ok).toBe(false);
    expect(reviewDecision('milestone', { ...on, min_build_android: 99 }, state()).ok).toBe(true);
    expect(reviewDecision('milestone', on, state({ lastCrashAt: now - 2 * DAY }))).toEqual({ ok: false, reason: 'recent_crash' });
    expect(reviewDecision('milestone', on, state({ lastCrashAt: now - 8 * DAY })).ok).toBe(true);
    expect(reviewDecision('milestone', on, state({ lossRecovery: true })).ok).toBe(false);
    expect(reviewDecision('milestone', on, state({ platform: 'web' })).ok).toBe(false);
  });

  it('respects day 7, session count, cooldown and the yearly cap', () => {
    expect(reviewDecision('day7', on, state({ firstUseAt: now - 6 * DAY }))).toEqual({ ok: false, reason: 'before_day7' });
    expect(reviewDecision('day7', on, state({ firstUseAt: now - 7 * DAY })).ok).toBe(true);
    expect(reviewDecision('pregnancy_week', on, state({ sessions: 2 })).ok).toBe(false);
    expect(reviewDecision('milestone', on, state({ askedAt: [now - 30 * DAY] }))).toEqual({ ok: false, reason: 'cooldown' });
    expect(reviewDecision('milestone', { ...on, cooldown_days: 20 }, state({ askedAt: [now - 300 * DAY, now - 200 * DAY, now - 30 * DAY] }))).toEqual({ ok: false, reason: 'yearly_cap' });
  });
});

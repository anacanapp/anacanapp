import { describe, expect, it } from 'vitest';
import { buildTourPlan, countedSteps, isNewAccount, isToolOpenForUser, isTourEligible, shouldAskPush, type TourInput, type TourTool } from './onboardingTour';

const tool = (id: string, open = true): TourTool => ({ id, name: id, open });
const mommyTools = [tool('mood'), tool('vaccine-calendar'), tool('danger-signs'), tool('baby-album'), tool('baby-growth', false), tool('teething', false)];
const input = (patch: Partial<TourInput> = {}): TourInput => ({ stage: 'mommy', isPremium: false, push: 'prompt', tools: mommyTools, ...patch });
const pushSubs = (plan: ReturnType<typeof buildTourPlan>) => plan.flatMap((s) => s.subs).filter((u) => u.kind === 'push');
const toolPages = (plan: ReturnType<typeof buildTourPlan>) => plan.flatMap((s) => s.subs).filter((u) => u.copy === 'tool_page').map((u) => u.toolId);

describe('onboarding tour plan', () => {
  it('free users get mood, tools, AI + community and Premium; Premium users skip the Premium step', () => {
    const free = buildTourPlan(input());
    expect(free.map((s) => s.id)).toEqual(['welcome', 'mood', 'tools', 'ai', 'premium', 'final']);
    expect(countedSteps(free)).toBe(4);
    const premium = buildTourPlan(input({ isPremium: true, tools: mommyTools.map((t) => ({ ...t, open: true })) }));
    expect(premium.map((s) => s.id)).toEqual(['welcome', 'mood', 'tools', 'ai', 'final']);
  });

  it('asks for push only when the OS can still prompt, and only once', () => {
    expect(pushSubs(buildTourPlan(input({ push: 'prompt' })))).toHaveLength(1);
    for (const push of ['granted', 'denied', 'unsupported'] as const) expect(pushSubs(buildTourPlan(input({ push })))).toHaveLength(0);
    expect(shouldAskPush('granted')).toBe(false);
    // without a mood tool the single push ask moves to the end of the AI step
    const noMood = buildTourPlan(input({ tools: mommyTools.filter((t) => t.id !== 'mood') }));
    expect(pushSubs(noMood)).toHaveLength(1);
    expect(noMood.find((s) => s.id === 'ai')!.subs.at(-1)!.kind).toBe('push');
  });

  it('never opens a locked tool for a free user and never repeats the mood tool', () => {
    const free = toolPages(buildTourPlan(input()));
    expect(free).toEqual(['vaccine-calendar', 'danger-signs']);
    const premium = toolPages(buildTourPlan(input({ isPremium: true, tools: mommyTools.map((t) => ({ ...t, open: true })) })));
    expect(premium).toEqual(['baby-growth', 'teething']);
    expect(buildTourPlan(input()).find((s) => s.id === 'tools')!.subs.some((u) => u.target === 'tools-premium')).toBe(false);
  });

  it('skips tools that are not active for the stage', () => {
    const flow = buildTourPlan(input({ stage: 'flow', tools: [tool('mood'), tool('doctors')] }));
    expect(toolPages(flow)).toEqual(['doctors']);
    const bare = buildTourPlan(input({ stage: 'flow', tools: [] }));
    expect(bare.map((s) => s.id)).toEqual(['welcome', 'tools', 'ai', 'premium', 'final']);
    expect(bare.find((s) => s.id === 'tools')!.subs[0].target).toBe('tab-tools');
  });

  it('opens a tool only through the Tools tab', () => {
    for (const sub of buildTourPlan(input()).flatMap((s) => s.subs)) if (sub.nav.tool) expect(sub.nav.tab).toBe('tools');
  });
});

describe('tool openness and eligibility', () => {
  it('matches the Tools page rule', () => {
    expect(isToolOpenForUser({ tool_id: 'mood', is_premium: false }, false, false)).toBe(true);
    expect(isToolOpenForUser({ tool_id: 'mood', is_premium: true }, false, false)).toBe(false);
    expect(isToolOpenForUser({ tool_id: 'mood', is_premium: false }, true, false)).toBe(false);
    expect(isToolOpenForUser({ tool_id: 'baby-growth', is_premium: false }, false, false)).toBe(false);
    expect(isToolOpenForUser({ tool_id: 'baby-growth', is_premium: true }, true, true)).toBe(true);
  });

  const now = Date.parse('2026-11-06T10:00:00Z');
  const base = { setting: 'on', since: '2026-11-05T08:00:00Z', accountCreatedAt: '2026-11-06T09:00:00Z', journey: null, role: 'mother', lifeStage: 'mommy', lossRecoveryActive: false, onboarded: true, now };
  it('shows the tour only to new, eligible accounts that have not seen it', () => {
    expect(isTourEligible(base)).toBe(true);
    expect(isTourEligible({ ...base, setting: 'off' })).toBe(false);
    expect(isTourEligible({ ...base, journey: { status: 'started' } })).toBe(false);
    expect(isTourEligible({ ...base, role: 'partner' })).toBe(false);
    expect(isTourEligible({ ...base, lossRecoveryActive: true })).toBe(false);
    expect(isTourEligible({ ...base, onboarded: false })).toBe(false);
    expect(isTourEligible({ ...base, accountCreatedAt: '2026-11-01T00:00:00Z' })).toBe(false);
    expect(isTourEligible({ ...base, now: Date.parse('2026-11-25T10:00:00Z') })).toBe(false);
    expect(isTourEligible({ ...base, since: null })).toBe(false);
    expect(isTourEligible({ ...base, lifeStage: null })).toBe(false);
  });
  it('treats accounts younger than a day as new', () => {
    expect(isNewAccount('2026-11-06T09:00:00Z', now)).toBe(true);
    expect(isNewAccount('2026-11-04T09:00:00Z', now)).toBe(false);
    expect(isNewAccount(null, now)).toBe(false);
  });
});

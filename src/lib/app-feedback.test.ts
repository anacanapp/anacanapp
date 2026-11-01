import { describe, expect, it, vi } from 'vitest';

const insert = vi.fn(async () => ({ error: null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ insert }) } }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'ios' } }));

import { feedbackPromptDue, sendAppFeedback } from './app-feedback';

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 20);
const base = { now, firstUseAt: now - 20 * DAY, sessions: 8, sentAt: null, dismissedAt: null, lastStoreRequestAt: null, lossRecovery: false };

describe('in-app feedback', () => {
  it('asks on its own once from day 14, respecting dismissals and store requests', () => {
    expect(feedbackPromptDue(base)).toBe(true);
    expect(feedbackPromptDue({ ...base, firstUseAt: now - 10 * DAY })).toBe(false);
    expect(feedbackPromptDue({ ...base, sessions: 3 })).toBe(false);
    expect(feedbackPromptDue({ ...base, sentAt: now - 200 * DAY })).toBe(false);
    expect(feedbackPromptDue({ ...base, dismissedAt: now - 30 * DAY })).toBe(false);
    expect(feedbackPromptDue({ ...base, dismissedAt: now - 100 * DAY })).toBe(true);
    expect(feedbackPromptDue({ ...base, lastStoreRequestAt: now - 2 * DAY })).toBe(false);
    expect(feedbackPromptDue({ ...base, lossRecovery: true })).toBe(false);
  });

  it('sends the rating to the team as a support ticket, never to a store', async () => {
    await sendAppFeedback({ userId: 'u1', rating: 2, reasons: ['crash', 'slow'], message: 'It closes on the feeding screen', subject: 'App feedback', lifeStage: 'mommy', language: 'en' });
    const row = (insert.mock.calls[0] as unknown[])[0] as Record<string, string>;
    expect(row).toMatchObject({ user_id: 'u1', category: 'app_feedback', priority: 'high', status: 'open', subject: 'App feedback 2★' });
    expect(row.message).toContain('★★☆☆☆ (2/5)');
    expect(row.message).toContain('Reasons: crash, slow');
    expect(row.message).toContain('It closes on the feeding screen');
    expect(row.message).not.toMatch(/apps\.apple\.com|play\.google\.com/);
  });
});

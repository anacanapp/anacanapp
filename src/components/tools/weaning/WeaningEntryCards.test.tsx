import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

let setting: unknown = 'on';
let birthDate = '2025-06-01';
const logs: Array<{ log_type: string; feed_type: string; start_time: string }> = [];

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useChildren', () => ({ useChildren: () => ({ selectedChild: { id: 'c1', birth_date: birthDate }, children: [] }) }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSetting: () => setting }));
vi.mock('@/integrations/supabase/client', () => {
  // select().eq().eq().gte() is awaited, optionally after one more .eq('child_id').
  const result = () => Promise.resolve({ data: logs, error: null });
  const q: any = { select: () => q, eq: () => q, gte: () => Object.assign(result(), { eq: result }) };
  return { supabase: { from: () => q } };
});

import { WeaningAiCard, WeaningFeedingLink, WeaningHomeCard } from './WeaningEntryCards';
import { useUserStore } from '@/store/userStore';
import { PUSH_NAV_EVENT } from '@/lib/pushNav';
import { createPlan, DEFAULT_FEEDS, isoDay } from '@/lib/weaning';

const KEY = 'anacan.weaning.v1.u1';
const stored = () => JSON.parse(localStorage.getItem(KEY) || '{}');

beforeEach(() => {
  localStorage.clear();
  setting = 'on'; birthDate = '2025-06-01'; logs.length = 0;
  useUserStore.setState({ lifeStage: 'mommy' } as never);
});

describe('WeaningHomeCard', () => {
  it('shows the one-time choice card and remembers "continue breastfeeding"', () => {
    render(<WeaningHomeCard />);
    expect(screen.getByTestId('weaning-home-intro')).toBeTruthy();
    fireEvent.click(screen.getByText('Davam edirəm'));
    expect(screen.queryByTestId('weaning-home-intro')).toBeNull();
    expect(stored().continueBF).toBe(true);
  });

  it('can be dismissed for this child', () => {
    const { unmount } = render(<WeaningHomeCard />);
    fireEvent.click(screen.getByLabelText('Bağla'));
    expect(screen.queryByTestId('weaning-home-intro')).toBeNull();
    unmount();
    render(<WeaningHomeCard />);
    expect(screen.queryByTestId('weaning-home-intro')).toBeNull();
  });

  it('is hidden when the admin switch is off, outside the Ana module or under 12 months', () => {
    setting = 'off';
    const a = render(<WeaningHomeCard />); expect(a.container.innerHTML).toBe(''); a.unmount();
    setting = 'on'; useUserStore.setState({ lifeStage: 'bump' } as never);
    const b = render(<WeaningHomeCard />); expect(b.container.innerHTML).toBe(''); b.unmount();
    useUserStore.setState({ lifeStage: 'mommy' } as never); birthDate = isoDay(new Date(Date.now() - 200 * 86400000));
    const c = render(<WeaningHomeCard />); expect(c.container.innerHTML).toBe('');
  });

  it('shows the running plan and opens the tool', () => {
    const plan = createPlan({ feeds: DEFAULT_FEEDS, pace: 'gentle', nightMode: 'last', start: isoDay(new Date()), childId: 'c1' });
    localStorage.setItem(KEY, JSON.stringify({ v: 1, plan, planDirty: false, checkins: [], lastResult: null, continueBF: true }));
    const spy = vi.fn(); window.addEventListener(PUSH_NAV_EVENT, spy as EventListener);
    render(<WeaningHomeCard />);
    fireEvent.click(screen.getByTestId('weaning-home-active').querySelector('button')!);
    expect((spy.mock.calls[0][0] as CustomEvent).detail).toEqual({ tool: 'weaning' });
    window.removeEventListener(PUSH_NAV_EVENT, spy as EventListener);
  });
});

describe('WeaningFeedingLink', () => {
  it('prefills the plan builder from the last 7 days and opens the tool', async () => {
    const now = Date.now();
    for (let d = 1; d <= 3; d++) for (const h of [7, 11, 15, 20, 2]) {
      const t = new Date(now - d * 86400000); t.setHours(h, 5, 0, 0);
      logs.push({ log_type: 'feeding', feed_type: 'breast_left', start_time: t.toISOString() });
    }
    const spy = vi.fn(); window.addEventListener(PUSH_NAV_EVENT, spy as EventListener);
    render(<WeaningFeedingLink />);
    await act(async () => { fireEvent.click(screen.getByTestId('weaning-feeding-link')); });
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(stored().feeds).toEqual({ morning: true, day: 1, nap: true, bedtime: true, night: 1 });
    window.removeEventListener(PUSH_NAV_EVENT, spy as EventListener);
  });

  it('is hidden after "continue breastfeeding"', () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, plan: null, continueBF: true }));
    const { container } = render(<WeaningFeedingLink />);
    expect(container.innerHTML).toBe('');
  });
});

describe('WeaningAiCard', () => {
  it('shows only when the tool is offered', () => {
    const a = render(<WeaningAiCard />); expect(screen.getByTestId('weaning-ai-card')).toBeTruthy(); a.unmount();
    setting = 'off';
    const b = render(<WeaningAiCard />); expect(b.container.innerHTML).toBe('');
  });
});

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  kids: [] as { id: string; name: string; birth_date: string }[],
  selected: null as string | null,
}));

vi.mock('@/lib/tr', () => ({
  tr: (_k: string, fallback: string) => fallback,
  formatTr: (_k: string, fallback: string, values: Record<string, unknown>) =>
    fallback.replace(/\{(\w+)\}/g, (m, name) => (name in values ? String(values[name]) : m)),
  getPersistedLanguage: () => 'az',
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isAdmin: false }) }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSetting: () => 'on' }));
vi.mock('@/hooks/useDisabledTools', () => ({ useDisabledTools: () => ({ disabledTools: [], isToolDisabled: () => false }) }));
vi.mock('@/store/userStore', () => ({
  useUserStore: (sel: (s: { language: string; lifeStage: string }) => unknown) => sel({ language: 'az', lifeStage: 'mommy' }),
}));
vi.mock('@/hooks/useChildren', () => ({
  useChildren: () => ({ selectedChild: mocks.kids.find((k) => k.id === mocks.selected) ?? mocks.kids[0] ?? null, children: mocks.kids }),
}));
vi.mock('@/lib/analytics', () => ({ analytics: { logToolUsed: vi.fn() } }));
const subMock = vi.hoisted(() => ({ isPremium: true }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: subMock.isPremium, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/parenting-reminders', async (orig) => ({ ...(await orig<typeof import('@/lib/parenting-reminders')>()), syncParentingReminders: vi.fn() }));

import ParentingHomeCard from './ParentingHomeCard';
import { loadParentingContent } from '@/data/parenting';
import content from '@/data/parenting/az';
import { clearParentingTarget, peekParentingTarget } from '@/lib/parenting-target';

beforeAll(async () => { await loadParentingContent('az', { overrides: false }); });
const NOW = new Date(2026, 10, 7, 10);
const TEEN = { id: 'teen', name: 'Ali', birth_date: '2010-02-01' };
const KID = { id: 'kid-b', name: 'Nur', birth_date: '2020-03-01' }; // 6 years → 6–12

beforeEach(() => { localStorage.clear(); mocks.kids = []; mocks.selected = null; clearParentingTarget(); });
afterEach(cleanup);

describe('Tərbiyə home card is Premium-only', () => {
  it('renders nothing for a free user', () => {
    subMock.isPremium = false;
    try {
      render(<ParentingHomeCard onOpen={() => {}} />);
      expect(screen.queryByTestId('parenting-home-card')).toBeNull();
    } finally { subMock.isPremium = true; }
  });
});

describe('Tərbiyə home card with several children', () => {
  it('stays when the selected child is 13+ but a younger sibling exists, with the sibling’s band', () => {
    mocks.kids = [TEEN, KID];
    mocks.selected = 'teen';
    render(<ParentingHomeCard onOpen={vi.fn()} now={NOW} />);
    expect(screen.getByTestId('parenting-home-card')).toHaveTextContent('6–12 yaş');
  });

  it('is hidden when every child is 13+', () => {
    mocks.kids = [TEEN];
    render(<ParentingHomeCard onOpen={vi.fn()} now={NOW} />);
    expect(screen.queryByTestId('parenting-home-card')).toBeNull();
  });

  it('"Continue" opens a sibling’s running programme for that child', () => {
    mocks.kids = [{ id: 'kid-a', name: 'Aysel', birth_date: '2024-07-07' }, KID];
    const p = content.programmes[0];
    localStorage.setItem('anacan.parenting.v1.u1', JSON.stringify({
      v: 1, band: null, quizzes: {}, saved: [], programmes: {}, rootChild: 'kid-a', rootChildAt: '2026-11-01T00:00:00.000Z',
      children: { 'kid-b': { band: null, quizzes: {}, programmes: { [p.id]: { startedAt: '2026-11-06', done: ['2026-11-06'], updatedAt: '2026-11-06T08:00:00.000Z' } } } },
    }));
    const onOpen = vi.fn();
    render(<ParentingHomeCard onOpen={onOpen} now={NOW} />);
    fireEvent.click(screen.getByTestId('parenting-home-continue'));
    expect(onOpen).toHaveBeenCalled();
    expect(peekParentingTarget()).toEqual({ kind: 'programme', id: p.id, child: 'kid-b' });
  });
});

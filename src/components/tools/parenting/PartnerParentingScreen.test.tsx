import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PartnerChild } from '@/hooks/usePartnerData';

const mocks = vi.hoisted(() => ({
  partnerChildren: [] as PartnerChild[],
  view: vi.fn(),
}));

vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback, getPersistedLanguage: () => 'az' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/usePartnerData', async (orig) => ({
  ...(await orig<typeof import('@/hooks/usePartnerData')>()),
  usePartnerData: () => ({ partnerProfile: null, partnerChildren: mocks.partnerChildren }),
}));
vi.mock('./ParentingTool', () => ({
  ParentingToolView: (props: unknown) => { mocks.view(props); return <div data-testid="tool-view" />; },
}));

import PartnerParentingScreen from './PartnerParentingScreen';
import { normalizePartnerChildren } from '@/hooks/usePartnerData';
import { milestoneAge, pickParentingChild } from '@/lib/parenting';

const NOW = new Date(2026, 10, 7, 10);
type ViewProps = { child: { id?: string; due_date?: string | null; birth_date?: string | null }; kids: PartnerChild[] };
const lastProps = () => mocks.view.mock.calls.at(-1)![0] as ViewProps;
/** The age ParentingToolView's milestone check uses for the child it picks. */
const partnerMilestone = () => {
  const { child, kids } = lastProps();
  const picked = pickParentingChild(kids, { preferred: child.id, now: NOW });
  return milestoneAge(picked?.birth_date, picked?.due_date, NOW);
};

beforeEach(() => { mocks.view.mockClear(); });
afterEach(cleanup);

describe('partner_children_v1 rows', () => {
  it('keep a valid due date and give null when the old function has none', () => {
    const rows = normalizePartnerChildren([
      { id: 'a', name: 'Aysel', birth_date: '2026-01-08', gender: 'girl', avatar_emoji: null, sort_order: 0, is_current: true, due_date: '2026-03-15' },
      { id: 'b', name: 'Murad', birth_date: '2024-07-07', gender: 'boy', avatar_emoji: null, is_current: false },
      { id: 'c', name: 'X', birth_date: null, gender: null, avatar_emoji: null, is_current: false, due_date: 'soon' },
      null, { name: 'no id' },
    ]);
    expect(rows.map((r) => [r.id, r.due_date])).toEqual([['a', '2026-03-15'], ['b', null], ['c', null]]);
  });
});

describe('partner Tərbiyə corrected age', () => {
  it('a preterm baby gets the corrected age on the partner side (10 months, born ~31 weeks → 7 corrected months)', () => {
    mocks.partnerChildren = normalizePartnerChildren([
      { id: 'a', name: 'Aysel', birth_date: '2026-01-08', gender: 'girl', avatar_emoji: null, is_current: true, due_date: '2026-03-15' },
    ]);
    render(<PartnerParentingScreen onBack={vi.fn()} />);
    expect(lastProps().child).toMatchObject({ id: 'a', due_date: '2026-03-15' });
    expect(partnerMilestone()).toEqual({ months: 7, corrected: true });
  });

  it('without due_date (old function) the partner keeps calendar age', () => {
    mocks.partnerChildren = normalizePartnerChildren([
      { id: 'a', name: 'Aysel', birth_date: '2026-01-08', gender: 'girl', avatar_emoji: null, is_current: true },
    ]);
    render(<PartnerParentingScreen onBack={vi.fn()} />);
    expect(lastProps().child).not.toHaveProperty('due_date');
    expect(partnerMilestone()).toEqual({ months: 9, corrected: false });
  });
});

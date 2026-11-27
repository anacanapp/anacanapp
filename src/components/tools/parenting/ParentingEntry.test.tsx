import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  lifeStage: 'mommy' as string,
  language: 'az' as string,
  setting: 'on' as unknown,
  disabled: [] as string[],
  birth: '2024-07-07' as string | null,
  partnerProfile: null as Record<string, unknown> | null,
  partnerChildren: [] as { id: string; name: string; birth_date: string | null; is_current: boolean; gender: null; avatar_emoji: null }[],
  view: vi.fn(),
}));

vi.mock('@/lib/tr', () => ({
  tr: (_k: string, fallback: string) => fallback,
  formatTr: (_k: string, fallback: string, values: Record<string, unknown>) =>
    fallback.replace(/\{(\w+)\}/g, (m, name) => (name in values ? String(values[name]) : m)),
  getPersistedLanguage: () => 'az',
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/analytics', () => ({ analytics: { logToolUsed: vi.fn() } }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSetting: (key: string) => (key === 'parenting_tool' ? mocks.setting : undefined) }));
vi.mock('@/hooks/useDisabledTools', () => ({
  useDisabledTools: () => ({ disabledTools: mocks.disabled, isToolDisabled: (id: string) => mocks.disabled.includes(id) }),
}));
vi.mock('@/store/userStore', () => ({
  useUserStore: (sel: (s: { language: string; lifeStage: string }) => unknown) => sel({ language: mocks.language, lifeStage: mocks.lifeStage }),
}));
vi.mock('@/hooks/useChildren', () => ({
  useChildren: () => {
    const child = mocks.birth ? { id: 'c1', name: 'Aysel', birth_date: mocks.birth } : null;
    return { selectedChild: child, children: child ? [child] : [] };
  },
}));
vi.mock('@/hooks/usePartnerData', () => ({
  usePartnerData: () => ({ partnerProfile: mocks.partnerProfile, partnerChildren: mocks.partnerChildren }),
}));
vi.mock('./ParentingTool', () => ({
  ParentingToolView: (props: { child: unknown; partner?: boolean }) => { mocks.view(props); return <div data-testid="tool-view" />; },
}));

import { ParentingAiCard } from './ParentingEntry';
import PartnerParentingScreen from './PartnerParentingScreen';
import { loadParentingContent } from '@/data/parenting';
import { PUSH_NAV_EVENT } from '@/lib/pushNav';
import { clearParentingTarget, peekParentingTarget } from '@/lib/parenting-nav';
import { isParentingPartnerVisible, partnerParentingChild } from '@/lib/parenting';

beforeAll(async () => { await loadParentingContent('az', { overrides: false }); });
beforeEach(() => {
  Object.assign(mocks, { lifeStage: 'mommy', language: 'az', setting: 'on', disabled: [], birth: '2024-07-07', partnerProfile: null, partnerChildren: [] });
  mocks.view.mockClear();
  clearParentingTarget();
});
afterEach(cleanup);

const nav = () => {
  const seen: unknown[] = [];
  const on = (e: Event) => seen.push((e as CustomEvent).detail);
  window.addEventListener(PUSH_NAV_EVENT, on);
  return { seen, stop: () => window.removeEventListener(PUSH_NAV_EVENT, on) };
};

describe('Anacan.AI → Tərbiyə suggestion card', () => {
  it('suggests the best SOS card for the mother and opens the tool on it', async () => {
    render(<ParentingAiCard question="3 yaşlı oğlum axşamlar yatmaq istəmir, nə edim?" />);
    const card = await screen.findByTestId('parenting-ai-card');
    expect(card).toHaveTextContent('Tərbiyə · SOS kartı');
    expect(card).toHaveTextContent('Yatmaq istəmir');
    const n = nav();
    act(() => { fireEvent.click(card); });
    n.stop();
    expect(n.seen).toEqual([{ tool: 'parenting' }]);
    expect(peekParentingTarget()).toEqual({ kind: 'sos', id: 'bedtime-refusal' });
  });

  it('suggests an article for a general question', async () => {
    render(<ParentingAiCard question="Uşağım tez-tez yalan danışır" />);
    expect(await screen.findByTestId('parenting-ai-card')).toHaveTextContent('Tərbiyə · Məqalə');
  });

  it.each([
    ['the switch is off', { setting: 'off' }],
    ['the app language has no content', { language: 'en' }],
    ['the module is not Ana', { lifeStage: 'bump' }],
    ['the tool is disabled for the language', { disabled: ['parenting'] }],
    ['the child is 13 or older', { birth: '2010-01-01' }],
  ])('stays hidden when %s', (_label, patch) => {
    Object.assign(mocks, patch);
    render(<ParentingAiCard question="isterika edir" />);
    expect(screen.queryByTestId('parenting-ai-card')).toBeNull();
  });

  it('stays hidden for a question that is not about parenting', () => {
    render(<ParentingAiCard question="Körpəmin qızdırması var, nə verim?" />);
    expect(screen.queryByTestId('parenting-ai-card')).toBeNull();
  });

  it('works for the partner of an Ana-module mother and opens the partner screen', async () => {
    mocks.lifeStage = 'partner';
    render(<ParentingAiCard question="Qızım qardaşını vurur" partner={{ lifeStage: 'mommy', babyBirthDate: '2021-03-01' }} />);
    const n = nav();
    act(() => { fireEvent.click(screen.getByTestId('parenting-ai-card')); });
    n.stop();
    expect(n.seen).toEqual([{ screen: 'partner-parenting' }]);
    cleanup();
    render(<ParentingAiCard question="Qızım qardaşını vurur" partner={{ lifeStage: 'bump' }} />);
    expect(screen.queryByTestId('parenting-ai-card')).toBeNull();
  });
});

describe('Tərbiyə in partner mode', () => {
  const base = { womanLifeStage: 'mommy', language: 'az', setting: 'on', birthDate: '2022-05-01', now: new Date(2026, 10, 7) };

  it('is visible to the partner of an Ana-module mother under the same switch and content rules', () => {
    expect(isParentingPartnerVisible(base)).toBe(true);
    expect(isParentingPartnerVisible({ ...base, birthDate: null })).toBe(true);
    expect(isParentingPartnerVisible({ ...base, womanLifeStage: 'bump' })).toBe(false);
    expect(isParentingPartnerVisible({ ...base, womanLifeStage: null })).toBe(false);
    expect(isParentingPartnerVisible({ ...base, setting: 'off' })).toBe(false);
    expect(isParentingPartnerVisible({ ...base, language: 'xx' as never })).toBe(false);
    expect(isParentingPartnerVisible({ ...base, birthDate: '2012-01-01' })).toBe(false);
  });

  it('reads for her current child he can see, else her profile baby', () => {
    const kids = [
      { name: 'Ali', birth_date: '2019-01-01', is_current: false },
      { name: 'Aysel', birth_date: '2024-07-07', is_current: true },
    ];
    expect(partnerParentingChild(kids, null)).toEqual({ name: 'Aysel', birth_date: '2024-07-07' });
    expect(partnerParentingChild([kids[0]], null)).toEqual({ name: 'Ali', birth_date: '2019-01-01' });
    expect(partnerParentingChild([], { baby_name: 'Nur', baby_birth_date: '2025-01-01' })).toEqual({ name: 'Nur', birth_date: '2025-01-01' });
    expect(partnerParentingChild([], null)).toBeNull();
  });

  it('the partner screen opens the same tool in partner mode with her child', () => {
    mocks.partnerProfile = { baby_name: 'Nur', baby_birth_date: '2025-01-01' };
    mocks.partnerChildren = [{ id: 'k', name: 'Aysel', birth_date: '2024-07-07', is_current: true, gender: null, avatar_emoji: null }];
    render(<PartnerParentingScreen onBack={vi.fn()} />);
    expect(screen.getByTestId('tool-view')).toBeInTheDocument();
    expect(mocks.view).toHaveBeenCalledWith(expect.objectContaining({ partner: true, child: { id: 'k', name: 'Aysel', birth_date: '2024-07-07' }, kids: mocks.partnerChildren }));
  });
});

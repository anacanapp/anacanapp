import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Cfg = Record<string, unknown>;
const mocks = vi.hoisted(() => ({
  premium: false,
  query: { data: undefined as Cfg[] | undefined, isPending: false, isError: false, fetchStatus: 'idle', refetch: vi.fn() },
}));

vi.mock('@/lib/tr', () => ({ tr: (_k: string, fallback: string) => fallback, formatTr: (_k: string, fallback: string) => fallback }));
vi.mock('@/lib/babycare-i18n', () => ({ bc: (k: string) => k }));
vi.mock('@/lib/feature37-i18n', () => ({ feature37Text: (k: string) => k }));
vi.mock('@/lib/followup-i18n', () => ({ followupText: (k: string) => k }));
vi.mock('@/lib/weaning-copy', () => ({ wt: (k: string) => k }));
vi.mock('@/lib/parenting-copy', () => ({ pt: (k: string) => k }));
vi.mock('@/lib/weaning', () => ({ isWeaningTileVisible: () => false }));
vi.mock('@/lib/parenting', () => ({ isParentingTileVisible: () => false }));
vi.mock('@/lib/sleep-training', () => ({ sleepTrainingEligible: () => false }));
vi.mock('@/hooks/useScrollToTop', () => ({ useScrollToTop: vi.fn() }));
vi.mock('@/lib/scrollMemory', () => ({ saveScroll: vi.fn(), restoreScroll: vi.fn() }));
vi.mock('@/lib/backButton', () => ({ pushBackHandler: () => () => {} }));
vi.mock('@/components/BlogScreen', () => ({ default: () => null }));
vi.mock('@/store/userStore', () => {
  const state = { lifeStage: 'mommy', language: 'az', countryCode: 'AZ', getPregnancyData: () => ({ currentWeek: 0 }) };
  return { useUserStore: (sel: (s: typeof state) => unknown) => sel(state) };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: null, isAdmin: false }) }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: mocks.premium }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useDynamicTools', () => ({ useToolConfigs: () => mocks.query }));
vi.mock('@/components/banners/BannerSlot', () => ({ default: () => null }));
vi.mock('@/components/ads/AdExperienceProvider', () => ({ AdInlineAnchor: () => null, AdSurface: () => null }));
vi.mock('@/hooks/useChildren', () => ({ useChildren: () => ({ selectedChild: null, children: [] }) }));
vi.mock('@/hooks/useDisabledTools', () => ({ useDisabledTools: () => ({ disabledTools: ['cakes', 'mini-games'], isToolDisabled: () => true }) }));
vi.mock('@/hooks/useAppSettings', () => ({ useAppSetting: () => null }));
vi.mock('@/hooks/useFirstAid', () => ({ usePrefetchFirstAid: vi.fn() }));
vi.mock('./PremiumModal', () => ({ PremiumModal: ({ isOpen, analyticsSource }: { isOpen: boolean; analyticsSource?: string }) => (isOpen ? <div data-testid="paywall" data-source={analyticsSource} /> : null) }));
vi.mock('./premium/PremiumToolBoundary', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('./aptek/AptekEntry', () => ({ AptekSearchResults: () => null }));

import ToolsHub from './ToolsHub';

const cfg = (tool_id: string, name: string, extra: Cfg = {}): Cfg => ({
  tool_id, name, description: '', icon: 'Wrench', color: 'pink', bg_color: 'pink', life_stages: ['mommy'],
  is_premium: true, premium_type: 'none', premium_limit: 0, ...extra,
});

afterEach(() => {
  cleanup();
  mocks.premium = false;
  Object.assign(mocks.query, { data: undefined, isPending: false, isError: false, fetchStatus: 'idle' });
});

describe('ToolsHub loading, offline and search', () => {
  it('shows a skeleton, not "not found", while the first config load runs', () => {
    Object.assign(mocks.query, { isPending: true, fetchStatus: 'fetching' });
    render(<ToolsHub />);
    expect(screen.getByLabelText('Alətlər yüklənir')).toBeTruthy();
    expect(screen.queryByText('Alət tapılmadı')).toBeNull();
  });

  it('shows an offline/retry card when the load is paused offline or fails', () => {
    Object.assign(mocks.query, { isPending: true, fetchStatus: 'paused' });
    render(<ToolsHub />);
    expect(screen.getByText('Alətlər yüklənmədi')).toBeTruthy();
    expect(screen.queryByText('Alət tapılmadı')).toBeNull();
    fireEvent.click(screen.getByText('Yenidən cəhd edin'));
    expect(mocks.query.refetch).toHaveBeenCalled();
  });

  it('search is accent-insensitive and "not found" only appears for a real empty search', () => {
    Object.assign(mocks.query, { data: [cfg('recipes', 'Reseptlər'), cfg('cry-translator', 'Ağlama tərcüməçisi')] });
    render(<ToolsHub />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'aglama terc' } });
    expect(screen.getByText('Ağlama tərcüməçisi')).toBeTruthy();
    expect(screen.queryByText('Reseptlər')).toBeNull();
    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByText('Alət tapılmadı')).toBeTruthy();
  });
});

describe('ToolsHub free vs Premium gating', () => {
  it('limited tools sit in the free section with a hint and open for free users; premium tools show the paywall', () => {
    Object.assign(mocks.query, { data: [
      cfg('recipes', 'Reseptlər', { premium_type: 'premium_only' }),
      cfg('cry-translator', 'Ağlama tərcüməçisi'),
      cfg('photoshoot', 'Foto çəkiliş', { premium_type: 'limited_total', premium_limit: 3 }),
      cfg('poop-scanner', 'Nəcis skaneri', { premium_type: 'limited_total', premium_limit: 3 }),
      // Code tools: rows carry order/stage only (is_active false for old builds); name and access come from code.
      cfg('solid-food-guide', 'Əlavə qida (row)', { is_premium: false, is_active: false }),
      cfg('baby-tracker', 'Körpə izləyicisi (row)', { is_premium: false, is_active: false }),
    ] });
    render(<ToolsHub />);
    // recipes (code list); poop-scanner has no in-tool limit, so an admin limited_total keeps it Premium.
    expect(screen.getAllByText('Pulsuz · limitli')).toHaveLength(1);
    // 2026-11-09: Əlavə qida bələdçisi is Premium-only.
    expect(screen.getByText('Premium alətlər').closest('section')!.textContent).toContain('sfg_home_title');
    const free = screen.getByText('Ödənişsiz alətlər').closest('section')!;
    expect(free.textContent).toContain('Reseptlər');
    expect(free.textContent).not.toContain('Foto çəkiliş');
    expect(free.textContent).not.toContain('Nəcis skaneri');
    expect(free.textContent).not.toContain('babytracker_tool_name');
    const premium = screen.getByText('Premium alətlər').closest('section')!;
    expect(premium.textContent).toContain('Ağlama tərcüməçisi');
    // Fotosessiya: Premium section, but it opens for a free user (no paywall on the tile).
    expect(premium.textContent).toContain('Foto çəkiliş');
    // Baby tracker stays fully Premium (owner decision 2026-11-08).
    expect(premium.textContent).toContain('babytracker_tool_name');

    fireEvent.click(screen.getByText('Ağlama tərcüməçisi'));
    expect(screen.getByTestId('paywall')).toBeTruthy();
    // The paywall view is attributed to the tool, not the generic 'tool' source.
    expect(screen.getByTestId('paywall').getAttribute('data-source')).toBe('cry-translator');
  });

  it('a free user can open a limited tool without the paywall', () => {
    Object.assign(mocks.query, { data: [cfg('horoscope', 'Bürc')] });
    render(<ToolsHub />);
    fireEvent.click(screen.getByText('Bürc'));
    expect(screen.queryByTestId('paywall')).toBeNull();
    expect(screen.queryByText('Ödənişsiz alətlər')).toBeNull();
  });
});

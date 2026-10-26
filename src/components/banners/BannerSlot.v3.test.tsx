import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Banner } from '@/hooks/useBanners';

const state = vi.hoisted(() => ({ banners: [] as Partial<Banner>[], premium: false, rpc: vi.fn() }));
vi.mock('@/hooks/useBanners', () => ({
  useBanners: () => ({ data: state.banners, isLoading: false }),
  useIncrementBannerClick: () => ({ mutate: vi.fn() }), useIncrementBannerImpression: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: state.premium }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: state.rpc } }));
vi.mock('./LeadFormSheet', () => ({ default: ({ bannerId }: { bannerId: string }) => <div data-testid="lead-sheet">{bannerId}</div> }));
import BannerSlot from './BannerSlot';

const base = (patch: Partial<Banner>): Partial<Banner> => ({ id: 'b', title: 'Brand title', placement: 'home_top', banner_type: 'native', link_type: 'external',
  link_url: 'https://brand.example', is_premium_only: false, branded: true, sponsor_name: 'Brand', ...patch });
beforeEach(() => { state.banners = []; state.premium = false; });
afterEach(cleanup);

describe('BannerSlot with anacan-brand-ads-v3 creatives', () => {
  it('shows a brand ad to Premium members only when the brand targets the Premium tier', () => {
    state.premium = true;
    state.banners = [base({ id: 'both', title: 'Both tiers', measurement_version: 3, audience_tiers: ['free', 'premium'], native_template: 'spotlight' }),
      base({ id: 'free', title: 'Free only', measurement_version: 3, audience_tiers: ['free'] }),
      base({ id: 'legacy', title: 'Legacy v2', measurement_version: 2 })];
    render(<BannerSlot placement="home_top" />);
    expect(screen.queryByText('Both tiers')).toBeTruthy();
    expect(screen.queryByText('Free only')).toBeNull();
    expect(screen.queryByText('Legacy v2')).toBeNull();
  });
  it('keeps legacy free-user behaviour and renders the chosen v3 template', () => {
    state.banners = [base({ id: 'tpl', title: 'Offer', measurement_version: 3, audience_tiers: ['free'], native_template: 'offer', creative_options: { offer_code: 'ANA10' } }),
      base({ id: 'premium-only', title: 'Premium only', measurement_version: 3, audience_tiers: ['premium'] }),
      base({ id: 'legacy', title: 'Legacy v2', measurement_version: 2 })];
    const { container } = render(<BannerSlot placement="home_top" />);
    expect(container.querySelector('[data-template="offer"]')).toBeTruthy();
    expect(screen.getByText('ANA10')).toBeTruthy();
    expect(screen.queryByText('Premium only')).toBeNull();
    expect(screen.queryByText('Legacy v2')).toBeTruthy();
  });
  it('opens the in-app lead form instead of navigating for lead-form creatives', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    state.banners = [base({ id: 'lead', title: 'Get a sample', link_type: 'lead_form', link_url: null, lead_form: true, measurement_version: 3, audience_tiers: ['free'], native_template: 'minimal' })];
    render(<BannerSlot placement="home_top" />);
    expect(screen.queryByTestId('lead-sheet')).toBeNull();
    fireEvent.click(screen.getByText('Get a sample'));
    expect(screen.getByTestId('lead-sheet').textContent).toBe('lead');
    expect(open).not.toHaveBeenCalled(); open.mockRestore();
  });
  it('ignores lead-form links that the server did not mark as live', () => {
    state.banners = [base({ id: 'lead', title: 'Not live', link_type: 'lead_form', link_url: null, lead_form: false, measurement_version: 3, audience_tiers: ['free'] })];
    render(<BannerSlot placement="home_top" />);
    fireEvent.click(screen.getByText('Not live'));
    expect(screen.queryByTestId('lead-sheet')).toBeNull();
  });
});

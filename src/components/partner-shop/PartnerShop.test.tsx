import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OLIVIA_CATALOG, oliviaImportRows } from '@/lib/olivia-catalog';
import { storefrontFromRpc, type Storefront } from '@/lib/partner-shop';

const state = vi.hoisted(() => ({ visible: true }));
const track = vi.hoisted(() => vi.fn());
const partner = { id: 'p1', slug: 'olivia', name: 'Olivia', logo_url: '/partners/olivia/logo.png', icon_url: '/partners/olivia/icon.png', website_url: 'https://olivia.az', brand_color: '#9B16D9', status: 'admin_only' };
const store: Storefront = storefrontFromRpc({ partners: [partner], products: oliviaImportRows().map((r, i) => ({ ...r, id: `p${i}`, partner_id: 'p1', sales_count: 100 - i })) });

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isAdmin: true, profile: {} }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useChildren', () => ({ useChildren: () => ({ selectedChild: null, getChildAge: () => null }) }));
vi.mock('@/store/userStore', () => ({
  useUserStore: (pick: (s: unknown) => unknown) => pick({ lifeStage: 'bump', getPregnancyData: () => ({ currentWeek: 35 }), lastPeriodDate: null, cycleLength: 28 }),
}));
vi.mock('@/hooks/usePartnerShop', async (orig) => ({
  ...(await orig<typeof import('@/hooks/usePartnerShop')>()),
  usePartnerStorefront: () => ({ data: state.visible ? store : { partners: new Map(), products: [] }, isLoading: false }),
  trackShopEvent: track, trackShopImpressions: vi.fn(),
}));

import { PartnerHomeCard, PartnerShopSection } from './PartnerShop';

afterEach(() => { cleanup(); state.visible = true; track.mockReset(); try { localStorage.clear(); } catch { /* */ } });

describe('Partner storefront', () => {
  it('shows the hospital bag hero at week 35, partner marks and adds the whole bundle', () => {
    render(<PartnerShopSection />);
    expect(screen.getByText('Xəstəxana çantası bir yerdə')).toBeTruthy();
    expect(screen.getByText('Olivia ilə')).toBeTruthy();
    expect(screen.getAllByLabelText('Olivia').length).toBeGreaterThan(3);
    fireEvent.click(screen.getByText('Hamısını səbətə at'));
    expect(screen.getByText('Səbətdədir ✓')).toBeTruthy();
    expect(screen.getByLabelText(`Partnyor səbəti, ${OLIVIA_CATALOG.collections.bag.length} məhsul`)).toBeTruthy();
    expect(track).toHaveBeenCalledWith(expect.any(Array), 'bundle', 'shop_hero');
  });
  it('product sheet says "by" with the partner logo and opens the partner site', () => {
    render(<PartnerShopSection />);
    fireEvent.click(screen.getAllByRole('button', { name: /Butterfly Maxi Thick/ })[0]);
    expect(screen.getByAltText('Olivia').getAttribute('src')).toBe('/partners/olivia/logo.png');
    expect(screen.getByText('Olivia saytında bax')).toBeTruthy();
  });
  it('renders nothing when the server returns no partner products', () => {
    state.visible = false;
    const { container } = render(<><PartnerShopSection /><PartnerHomeCard lifeStage="mommy" babyMonths={7} /></>);
    expect(container.textContent).toBe('');
  });
  it('home card follows the baby age and opens the shop', () => {
    const onOpen = vi.fn();
    render(<PartnerHomeCard lifeStage="mommy" babyMonths={7} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('İlk diş vaxtı'));
    expect(onOpen).toHaveBeenCalledWith('shop');
  });
});

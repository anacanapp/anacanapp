import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OLIVIA_CATALOG, oliviaImportRows, oliviaFromRow, type OliviaProduct } from '@/lib/olivia-shop';

const auth = vi.hoisted(() => ({ isAdmin: true }));
const products: OliviaProduct[] = oliviaImportRows().map((r, i) => oliviaFromRow({ ...r, id: `p${i}` })!);

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isAdmin: auth.isAdmin, profile: {} }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/hooks/useChildren', () => ({ useChildren: () => ({ selectedChild: null, getChildAge: () => null }) }));
vi.mock('@/store/userStore', () => ({
  useUserStore: (pick: (s: unknown) => unknown) => pick({ lifeStage: 'bump', getPregnancyData: () => ({ currentWeek: 35 }), lastPeriodDate: null, cycleLength: 28 }),
}));
vi.mock('@/hooks/useOliviaShop', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useOliviaShop')>()),
  useOliviaProducts: () => ({ data: auth.isAdmin ? products : [], isLoading: false }),
}));

import { OliviaHomeCard, OliviaShopSection } from './OliviaShop';

afterEach(() => { cleanup(); auth.isAdmin = true; try { localStorage.clear(); } catch { /* */ } });

describe('Olivia storefront', () => {
  it('shows the hospital bag hero at week 35 and adds the whole bundle', () => {
    render(<OliviaShopSection />);
    expect(screen.getByText('Xəstəxana çantası bir yerdə')).toBeTruthy();
    fireEvent.click(screen.getByText('Hamısını səbətə at'));
    expect(screen.getByText('Səbətdədir ✓')).toBeTruthy();
    expect(screen.getByLabelText(`Olivia səbəti, ${OLIVIA_CATALOG.collections.bag.length} məhsul`)).toBeTruthy();
  });
  it('renders nothing for non-admins', () => {
    auth.isAdmin = false;
    const { container } = render(<><OliviaShopSection /><OliviaHomeCard lifeStage="mommy" babyMonths={7} /></>);
    expect(container.textContent).toBe('');
  });
  it('home card follows the baby age and opens the shop', () => {
    const onOpen = vi.fn();
    render(<OliviaHomeCard lifeStage="mommy" babyMonths={7} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('İlk diş vaxtı'));
    expect(onOpen).toHaveBeenCalledWith('shop');
  });
});

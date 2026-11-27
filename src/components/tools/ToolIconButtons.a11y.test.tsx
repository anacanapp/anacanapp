import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ShoppingItem } from '@/hooks/useShoppingItems';
import type { AffiliateProduct } from '@/hooks/useAffiliateProducts';

const state = vi.hoisted(() => {
  const item = (id: string, name: string, is_checked: boolean): ShoppingItem => ({
    id, user_id: 'u', partner_id: null, name, quantity: 1, is_checked, priority: 'medium', added_by: null,
    created_at: '2026-11-08T08:00:00Z',
  });
  return { saved: false, items: [item('a', 'Bez', false), item('b', 'Süd', true)] };
});

vi.mock('@/hooks/useShoppingItems', () => {
  return {
    useShoppingItems: () => ({
      items: state.items, loading: false, addItem: vi.fn(async () => ({})), toggleItem: vi.fn(), deleteItem: vi.fn(),
      uncheckedCount: 1, checkedCount: 1,
    }),
  };
});
vi.mock('@/hooks/useDefaultShoppingItems', () => ({ useDefaultShoppingItems: () => ({ items: [] }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: null }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useScrollToTop', () => ({ useScrollToTop: () => {} }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: () => {} }));
vi.mock('@/hooks/useProviderReviews', () => ({
  useProviderReviews: () => ({
    reviews: [], userReview: null, isLoading: false, isAuthenticated: true,
    submitReview: { mutate: vi.fn(), isPending: false }, deleteReview: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock('@/hooks/useAffiliateProducts', () => ({
  useIsProductSaved: () => ({ data: state.saved }),
  useSaveProduct: () => ({ mutate: vi.fn() }),
  useUnsaveProduct: () => ({ mutate: vi.fn() }),
}));

import ShoppingList from './ShoppingList';
import ProviderReviews from './doctors/ProviderReviews';
import AffiliateProductCard from './affiliate/AffiliateProductCard';

beforeEach(() => { localStorage.setItem('anacan-language', 'az'); state.saved = false; });
afterEach(cleanup);

describe('tool icon buttons have accessible names', () => {
  it('ShoppingList: back, add, toggle and delete buttons are named', () => {
    render(<ShoppingList onBack={() => {}} />);
    expect(screen.getByRole('button', { name: 'Geri' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Əlavə et' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bez' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getAllByRole('button', { name: 'Sil' }).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByText(/Alınmış məhsullar/));
    expect(screen.getByRole('button', { name: 'Süd' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByRole('button', { name: 'Sil' })).toHaveLength(2);
  });

  it('ProviderReviews: each rating star is a named, pressed-state button', () => {
    render(<ProviderReviews providerId="p1" providerName="Klinika" />);
    fireEvent.click(screen.getByRole('button', { name: 'Rəy yaz' }));
    for (let n = 1; n <= 5; n++) {
      expect(screen.getByRole('button', { name: `Qiymət: ${n}/5` })).toBeTruthy();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Qiymət: 4/5' }));
    expect(screen.getByRole('button', { name: 'Qiymət: 4/5' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Qiymət: 2/5' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('AffiliateProductCard: save toggle is named and exposes its state', () => {
    const product = {
      id: 'x', name: 'Stroller', name_az: 'Uşaq arabası', description: null, description_az: null, category: 'gear',
      category_az: null, price: 100, currency: 'AZN', original_price: null, affiliate_url: 'https://example.com',
      platform: 'amazon', image_url: null, images: [], video_url: null, store_name: null, store_logo_url: null,
      rating: 4, review_count: 0, review_summary: null,
    } as unknown as AffiliateProduct;
    state.saved = true;
    render(<AffiliateProductCard product={product} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Yadda saxla' }).getAttribute('aria-pressed')).toBe('true');
  });
});

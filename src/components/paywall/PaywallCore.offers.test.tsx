import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PaywallCore from './PaywallCore';

const mocks = vi.hoisted(() => ({ intro: 19.99, purchase: vi.fn(), legacyPurchase: vi.fn(), restore: vi.fn(), toast: vi.fn() }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: any) => selector({ language: 'en' }) }));
vi.mock('@/lib/revenuecat', () => ({ isNativePlatform: () => true, getPlatform: () => 'ios' }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/lib/analytics', () => ({ analytics: { logPaywallClicked: vi.fn() } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/usePremiumConfig', () => ({ usePremiumConfig: () => ({ features: [] }) }));
vi.mock('@/hooks/usePaywallConfig', () => ({ usePaywallConfig: () => ({ yearly_label: 'Yearly', monthly_label: 'Monthly', yearly_suffix: '/month',
  monthly_suffix: '/month', yearly_total_suffix: '/year', savings_badge: '{percent}% saved', purchasing_text: 'Processing',
  restore_text: 'Restore', terms_label: 'Terms', privacy_label: 'Privacy', cancel_notice: 'Cancel anytime' }) }));
vi.mock('@/hooks/useInAppPurchase', () => ({ useInAppPurchase: () => {
  const annual = { identifier: '$rc_annual', packageType: 'ANNUAL', product: { identifier: 'com.atlasoon.anacan.premium.yearly',
    price: 29.99, priceString: '$29.99', currencyCode: 'USD', subscriptionPeriod: 'P1Y', introPrice: { price: mocks.intro, priceString: `$${mocks.intro.toFixed(2)}`, period: 'P1Y', cycles: 1 } } };
  const monthly = { identifier: '$rc_monthly', packageType: 'MONTHLY', product: { identifier: 'com.atlasoon.anacan.premium.monthly',
    price: 3.99, priceString: '$3.99', currencyCode: 'USD', subscriptionPeriod: 'P1M' } };
  return { packages: [{ ...annual, _raw: annual }, { ...monthly, _raw: monthly }], introEligibility: { [annual.product.identifier]: 2 },
    isSupported: true, isLoading: false, isPurchasing: false, error: null,
    purchaseExact: mocks.purchase, purchaseByIdentifier: mocks.legacyPurchase, restorePurchases: mocks.restore };
} }));
beforeEach(() => { vi.clearAllMocks(); mocks.intro = 19.99; mocks.purchase.mockResolvedValue(true); });
afterEach(cleanup);
it('shows the 29.99 to 19.99 annual offer and buys the displayed paid intro instead of the base plan', async () => {
  const done = vi.fn(); render(<PaywallCore onPurchased={done} />);
  expect(screen.getByText('Go Premium to remove ads')).toBeInTheDocument();
  expect(document.querySelector('del')).toHaveTextContent('$29.99');
  expect(screen.getByText('33% saved')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Get Premium' }));
  await waitFor(() => expect(done).toHaveBeenCalledWith('yearly'));
  expect(mocks.purchase.mock.calls[0][1]).toMatchObject({ productId: 'com.atlasoon.anacan.premium.yearly', price: 19.99, currency: 'USD', paidIntro: true });
  expect(mocks.legacyPurchase).not.toHaveBeenCalled();
});
it('blocks an automatic free trial while leaving the paid monthly option usable', async () => {
  mocks.intro = 0; render(<PaywallCore onPurchased={() => {}} />);
  expect(screen.getByRole('button', { name: 'Get Premium' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Monthly/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Get Premium' }));
  await waitFor(() => expect(mocks.purchase).toHaveBeenCalledOnce());
  expect(mocks.purchase.mock.calls[0][1]).toMatchObject({ productId: 'com.atlasoon.anacan.premium.monthly', price: 3.99 });
});

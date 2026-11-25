import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PaywallCore from './PaywallCore';

const mocks = vi.hoisted(() => ({ empty: false, failed: false, status: 'idle', error: null as string | null, eligibility: 2 as number | undefined,
  purchase: vi.fn(), reload: vi.fn(), retry: vi.fn(), restore: vi.fn(), toast: vi.fn(), own: false, household: false }));
vi.mock('@/components/paywall/EpointPayOption', () => ({ default: () => null }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (state: { language: string }) => unknown) => selector({ language: 'en' }) }));
vi.mock('@/lib/revenuecat', () => ({ isNativePlatform: () => true, getPlatform: () => 'ios' }));
vi.mock('@/components/premium/SponsorEntry', () => ({ default: () => null }));
vi.mock('@/components/qaygicash/QaygiCashPremium', () => ({ QcPremiumEarnLine: () => null, QaygiCashPremiumOption: () => null }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/lib/analytics', () => ({ analytics: { logPaywallClicked: vi.fn() } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/usePremiumEntitlement', () => ({ usePremiumEntitlement: () => ({ ownPremium: mocks.own, householdPremium: mocks.household }) }));
vi.mock('@/hooks/usePaywallConfig', () => ({ usePaywallConfig: () => ({ yearly_label: 'Yearly', monthly_label: 'Monthly', yearly_suffix: '/month',
  monthly_suffix: '/month', yearly_total_suffix: '/year', savings_badge: '{percent}% saved', purchasing_text: 'Processing',
  restore_text: 'Restore', terms_label: 'Terms', privacy_label: 'Privacy', cancel_notice: 'Cancel anytime' }) }));
vi.mock('@/hooks/useInAppPurchase', () => ({ useInAppPurchase: () => {
  const annual = { identifier: '$rc_annual', packageType: 'ANNUAL', product: { identifier: 'com.atlasoon.anacan.premium.yearly',
    price: 29.99, priceString: '$29.99', currencyCode: 'USD', subscriptionPeriod: 'P1Y', introPrice: { price: 19.99, priceString: '$19.99', period: 'P1Y', cycles: 1 } } };
  const monthly = { identifier: '$rc_monthly', packageType: 'MONTHLY', product: { identifier: 'com.atlasoon.anacan.premium.monthly',
    price: 3.99, priceString: '$3.99', currencyCode: 'USD', subscriptionPeriod: 'P1M' } };
  return { packages: mocks.empty ? [] : [{ ...annual, _raw: annual }, { ...monthly, _raw: monthly }],
    introEligibility: mocks.eligibility === undefined ? {} : { [annual.product.identifier]: mocks.eligibility },
    isSupported: true, isLoading: false, isPurchasing: false, error: mocks.error, offeringsFailed: mocks.failed, purchaseStatus: mocks.status,
    purchaseExact: mocks.purchase, purchaseByIdentifier: vi.fn(), restorePurchasesDetailed: mocks.restore, reloadOfferings: mocks.reload, retryActivation: mocks.retry };
} }));
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(mocks, { empty: false, failed: false, status: 'idle', error: null, eligibility: 2, own: false, household: false });
  mocks.purchase.mockResolvedValue(true); mocks.reload.mockResolvedValue(undefined);
});
afterEach(cleanup);

it('offers a visible retry when offerings could not be loaded', async () => {
  mocks.empty = true; mocks.failed = true; render(<PaywallCore onPurchased={() => {}} />);
  expect(screen.getByText(/Qiymətləri yükləmək alınmadı/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Yenidən cəhd et/ }));
  await waitFor(() => expect(mocks.reload).toHaveBeenCalledOnce());
});
it('offers "refresh status" while the server confirmation is pending and keeps the CTA closed', async () => {
  mocks.status = 'pending'; mocks.error = 'pending text'; mocks.retry.mockResolvedValue(true);
  const done = vi.fn(); render(<PaywallCore onPurchased={done} />);
  expect(screen.getByRole('button', { name: 'Get Premium' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Refresh status/ }));
  await waitFor(() => expect(done).toHaveBeenCalledWith('restore'));
});
it('keeps the yearly plan buyable with both prices when intro eligibility is unknown', async () => {
  mocks.eligibility = undefined; render(<PaywallCore onPurchased={() => {}} />);
  expect(screen.getAllByText(/İlk il \$19\.99; bu təklifə uyğun deyilsinizsə \$29\.99/).length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: /Yearly/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Get Premium' }));
  await waitFor(() => expect(mocks.purchase).toHaveBeenCalledOnce());
  expect(mocks.purchase.mock.calls[0][1]).toMatchObject({ price: 29.99, introUncertain: true });
});
it('shows the monthly renewal disclosure and passes the Premium source to the purchase', async () => {
  mocks.household = true; render(<PaywallCore onPurchased={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Monthly/ }));
  expect(screen.getByText(/\$3\.99\/month\. Renews automatically unless cancelled\./)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Get Premium' }));
  await waitFor(() => expect(mocks.purchase).toHaveBeenCalledOnce());
  expect(mocks.purchase.mock.calls[0][2]).toEqual({ ownPremium: false, householdPremium: true });
});
it('formats the per-month equivalent with Intl in the store currency', () => {
  mocks.eligibility = 1; render(<PaywallCore onPurchased={() => {}} />);
  expect(screen.getByText(/\$2\.50\/month/)).toBeInTheDocument();
});

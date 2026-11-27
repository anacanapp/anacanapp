import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mocks = vi.hoisted(() => ({
  wallet: null as unknown,
  history: [] as unknown[],
  platform: 'ios' as 'ios' | 'android' | 'web',
  invoke: vi.fn(),
  refreshProfile: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, refreshProfile: mocks.refreshProfile }) }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: 'https://api.test' }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (name: string, args?: unknown) => {
      mocks.rpc(name, args);
      return Promise.resolve({ data: name === 'qaygicash_wallet_v1' ? mocks.wallet : mocks.history, error: null });
    },
    functions: { invoke: (...args: unknown[]) => mocks.invoke(...args) },
  },
}));
vi.mock('@/lib/revenuecat', () => ({ getPlatform: () => mocks.platform }));
vi.mock('@/lib/analytics', () => ({ logEvent: vi.fn(() => Promise.resolve()) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (s: { language: string }) => unknown) => selector({ language: 'az' }) }));
vi.mock('@/lib/tr', () => ({
  tr: (_k: string, fallback: string) => fallback,
  formatTr: (_k: string, fallback: string, values: Record<string, unknown>) =>
    fallback.replace(/\{(\w+)\}/g, (m, name) => (name in values ? String(values[name]) : m)),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import QaygiCashHomeCard from './QaygiCashHomeCard';
import QaygiCashScreen from './QaygiCashScreen';
import { QaygiCashPremiumOption, QcPremiumEarnLine } from './QaygiCashPremium';
import { QcEarnBox, QcProductBadge, QcRedeemRow, useQcRedeem } from './QcParts';
import type { QcRedeemChannel } from '@/lib/qaygicash';

const WALLET = {
  enabled: true, status: 'live', country: 'AZ', currency: 'AZN',
  available_minor: 659, pending_minor: 108, expiring_30d_minor: 0, next_expiry_at: null, debt_minor: 0,
  rates: { premium_yearly: 500, premium_monthly: 300, book: 500, cake: 300, own_shop: 500, partner: 0, affiliate: 0 },
  hold_days_physical: 14, hold_days_digital: 7, expiry_months: 12, max_redeem_pct: 30, min_redeem_minor: 100,
  redeem_channels: ['aptek', 'cake', 'book'], terms_version: 1,
  premium_redeem: { enabled: false, monthly: { enabled: false, price_minor: 399 }, yearly: { enabled: false, price_minor: 2699 }, platforms: { ios: false, android: false, web: false } },
};

function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
const settle = () => waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('qaygicash_wallet_v1', undefined));

beforeEach(() => {
  localStorage.clear();
  mocks.wallet = { ...WALLET };
  mocks.history = [];
  mocks.platform = 'ios';
  mocks.invoke.mockReset();
  mocks.refreshProfile.mockReset();
  mocks.rpc.mockReset();
});
afterEach(cleanup);

describe('QaygiCashHomeCard', () => {
  it('renders nothing when the programme is off for this account', async () => {
    mocks.wallet = { enabled: false };
    const { container } = renderWith(<QaygiCashHomeCard onOpen={() => {}} />);
    await settle();
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe('');
  });

  it('shows the balance once there is bonus activity', async () => {
    const open = vi.fn();
    renderWith(<QaygiCashHomeCard onOpen={open} />);
    expect(await screen.findByTestId('qc-home-card')).toBeInTheDocument();
    expect(screen.getByText('6,59 ₼')).toBeInTheDocument();
    expect(screen.getByText('+1,08 ₼')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(open).toHaveBeenCalled();
  });

  it('shows a one-time intro without activity and remembers the dismissal', async () => {
    mocks.wallet = { ...WALLET, available_minor: 0, pending_minor: 0 };
    const first = renderWith(<QaygiCashHomeCard onOpen={() => {}} />);
    expect(await screen.findByTestId('qc-home-intro')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Bağla'));
    expect(screen.queryByTestId('qc-home-intro')).toBeNull();
    first.unmount();
    const { container } = renderWith(<QaygiCashHomeCard onOpen={() => {}} />);
    await settle();
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe('');
  });
});

function RedeemHarness({ channel, goods }: { channel: QcRedeemChannel; goods: number }) {
  const state = useQcRedeem(channel, goods);
  return <><QcRedeemRow state={state} /><output data-testid="amount">{state.amount}</output></>;
}

describe('checkout row', () => {
  it('starts on, at the max (30 % of goods, capped by the balance)', async () => {
    renderWith(<RedeemHarness channel="aptek" goods={5690} />);
    expect(await screen.findByTestId('qc-redeem')).toBeInTheDocument();
    expect(screen.getByTestId('amount')).toHaveTextContent('659');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Balans 6,59 ₼ · bu sifarişdə maks. 6,59 ₼')).toBeInTheDocument();
  });

  it('caps by the order share and lets the slider go down to the minimum, then off', async () => {
    renderWith(<RedeemHarness channel="cake" goods={1000} />);
    await screen.findByTestId('qc-redeem');
    expect(screen.getByTestId('amount')).toHaveTextContent('300');
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('max', '20'); // (3,00 − 1,00) / 0,10
    fireEvent.change(slider, { target: { value: '0' } });
    expect(screen.getByTestId('amount')).toHaveTextContent('100');
    fireEvent.change(slider, { target: { value: '7' } });
    expect(screen.getByTestId('amount')).toHaveTextContent('170');
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.getByTestId('amount')).toHaveTextContent('0');
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('tells when the order is too small for the minimum and applies nothing', async () => {
    renderWith(<RedeemHarness channel="book" goods={300} />);
    await screen.findByTestId('qc-redeem');
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByTestId('amount')).toHaveTextContent('0');
  });

  it.each([
    ['balance under the minimum', { available_minor: 99 }],
    ['spending paused', { status: 'paused' }],
    ['channel closed', { redeem_channels: ['cake'] }],
    ['programme off', { enabled: false }],
  ])('is hidden when %s', async (_label, patch) => {
    mocks.wallet = { ...WALLET, ...patch };
    renderWith(<RedeemHarness channel="aptek" goods={5690} />);
    await settle();
    await waitFor(() => expect(screen.getByTestId('amount')).toHaveTextContent('0'));
    expect(screen.queryByTestId('qc-redeem')).toBeNull();
  });

  it('previews earnings and product badges only with a rate', async () => {
    renderWith(<><QcEarnBox amount={106} /><QcProductBadge channel="own_shop" priceMinor={1200} /><QcProductBadge channel="partner" priceMinor={1200} /></>);
    expect(await screen.findByTestId('qc-earn')).toHaveTextContent('Bu sifarişdən 1,06 ₼ QayğıCash qazanacaqsan. Çatdırılmadan 14 gün sonra hazır olur.');
    expect(screen.getAllByTestId('qc-badge')).toHaveLength(1);
    expect(screen.getByTestId('qc-badge')).toHaveTextContent('+0,60 ₼ · 5% QayğıCash');
  });
});

describe('Premium with bonus', () => {
  it('shows the earn line but keeps the pay option hidden by default', async () => {
    renderWith(<><QcPremiumEarnLine plan="yearly" /><QcPremiumEarnLine plan="monthly" /><QaygiCashPremiumOption plan="yearly" /><QaygiCashPremiumOption plan="monthly" /></>);
    expect(await screen.findByTestId('qc-prem-earn-yearly')).toHaveTextContent('+1,34 ₼ QayğıCash');
    expect(screen.getByTestId('qc-prem-earn-monthly')).toHaveTextContent('Hər yenilənmədə +0,11 ₼ QayğıCash');
    expect(screen.queryByTestId('qc-prem-pay-yearly')).toBeNull();
    expect(screen.queryByTestId('qc-prem-pay-monthly')).toBeNull();
  });

  it('stays hidden on a platform the server has not enabled', async () => {
    mocks.wallet = { ...WALLET, available_minor: 3000, premium_redeem: { ...WALLET.premium_redeem, enabled: true, yearly: { enabled: true, price_minor: 2699 }, platforms: { ios: true } } };
    mocks.platform = 'android';
    renderWith(<><QcPremiumEarnLine plan="yearly" /><QaygiCashPremiumOption plan="yearly" /></>);
    await screen.findByTestId('qc-prem-earn-yearly');
    expect(screen.queryByTestId('qc-prem-pay-yearly')).toBeNull();
  });

  it('confirms in-page, calls the edge function and refreshes Premium', async () => {
    mocks.wallet = { ...WALLET, available_minor: 3000, premium_redeem: { ...WALLET.premium_redeem, enabled: true, yearly: { enabled: true, price_minor: 2699 }, platforms: { ios: true } } };
    mocks.invoke.mockResolvedValue({ data: { ok: true, plan: 'yearly', expires_at: '2027-11-06T00:00:00Z' }, error: null });
    const done = vi.fn();
    renderWith(<QaygiCashPremiumOption plan="yearly" onDone={done} />);
    fireEvent.click(await screen.findByTestId('qc-prem-pay-yearly'));
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Balansından 26,99 ₼ çıxılacaq və 1 il Premium aktivləşəcək.');
    fireEvent.click(screen.getByTestId('qc-prem-confirm'));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(mocks.invoke).toHaveBeenCalledWith('qaygicash-premium', { body: { plan: 'yearly', platform: 'ios' } });
    expect(mocks.refreshProfile).toHaveBeenCalled();
  });

  it('is disabled when the balance does not cover the price', async () => {
    mocks.wallet = { ...WALLET, premium_redeem: { ...WALLET.premium_redeem, enabled: true, monthly: { enabled: true, price_minor: 399 }, platforms: { web: true } } };
    mocks.wallet = { ...(mocks.wallet as object), available_minor: 200 };
    mocks.platform = 'web';
    renderWith(<QaygiCashPremiumOption plan="monthly" />);
    expect(await screen.findByTestId('qc-prem-pay-monthly')).toBeDisabled();
  });
});

describe('QaygiCashScreen', () => {
  it('shows balance, rates with rate > 0, history tones and the rules', async () => {
    mocks.history = [
      { id: 'l1', type: 'earn', channel: 'cake', amount_minor: 108, rate_bp: 300, status: 'pending', at: '2026-11-01T00:00:00Z', available_at: '2026-11-15T00:00:00Z' },
      { id: 'r1', type: 'redeem', channel: 'aptek', amount_minor: 150, status: 'committed', at: '2026-10-17T00:00:00Z' },
      { id: 'r2', type: 'redeem', channel: 'cake', amount_minor: 120, status: 'released', at: '2026-10-10T00:00:00Z' },
    ];
    mocks.wallet = { ...WALLET, rates: { ...WALLET.rates, premium_monthly: 0 } };
    renderWith(<QaygiCashScreen onBack={() => {}} />);
    expect(await screen.findByTestId('qc-available')).toHaveTextContent('6,59 ₼');
    const rates = screen.getByTestId('qc-rates');
    expect(rates).toHaveTextContent('Premium illik');
    expect(rates).not.toHaveTextContent('Premium aylıq');
    expect(rates).toHaveTextContent('Tərəfdaş məhsulları');
    await waitFor(() => expect(screen.getAllByTestId('qc-tx')).toHaveLength(3));
    expect(screen.getAllByTestId('qc-tx').map((row) => row.getAttribute('data-tone'))).toEqual(['pending', 'used', 'gone']);
    expect(screen.getByText('Balansa qaytarıldı')).toBeInTheDocument();
    expect(screen.getByTestId('qc-faq').querySelectorAll('details')).toHaveLength(8);
    expect(screen.getByTestId('qc-faq')).toHaveTextContent('Sifarişin 30%-inə qədər, minimum 1,00 ₼.');
    expect(screen.queryByTestId('qc-paused')).toBeNull();
  });

  it('notes a pause and a debt', async () => {
    mocks.wallet = { ...WALLET, status: 'paused', debt_minor: 250 };
    renderWith(<QaygiCashScreen onBack={() => {}} />);
    expect(await screen.findByTestId('qc-paused')).toBeInTheDocument();
    expect(screen.getByTestId('qc-debt')).toHaveTextContent('2,50 ₼');
    expect(screen.queryByText('Xərclə')).toBeNull();
  });

  it('shows no wallet when the programme is off', async () => {
    mocks.wallet = { enabled: false };
    renderWith(<QaygiCashScreen onBack={() => {}} />);
    await settle();
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId('qc-wallet-card')).toBeNull();
    expect(screen.queryByTestId('qc-faq')).toBeNull();
  });
});

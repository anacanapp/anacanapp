import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AdminQaygiCash, { formatMinor, parseMoney, parseRate, type Overview } from './AdminQaygiCash';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error, info: mocks.info } }));

const premium = { enabled: false, monthly: { enabled: false, price_minor: 399 }, yearly: { enabled: false, price_minor: 2699 }, platforms: { ios: false, android: false, web: false } };
const overview: Overview = {
  programs: [
    { country: 'AZ', currency: 'AZN', status: 'live', hold_days_physical: 14, hold_days_digital: 7, expiry_months: 12, max_redeem_pct: 30, min_redeem_minor: 100,
      monthly_earn_cap_minor: 5000, control_pct: 0, redeem_channels: ['aptek', 'cake', 'book'], premium_redeem: premium, terms_version: 'v1', updated_at: '2026-11-06T10:00:00Z' },
    { country: 'TR', currency: 'TRY', status: 'draft', hold_days_physical: 14, hold_days_digital: 7, expiry_months: 12, max_redeem_pct: 20, min_redeem_minor: 0,
      monthly_earn_cap_minor: 0, control_pct: 0, redeem_channels: [], premium_redeem: null, terms_version: null, updated_at: '2026-11-06T10:00:00Z' },
  ],
  rules: [
    { country: 'AZ', channel: 'premium_yearly', rate_bp: 500, own_product: true, fixed_base_minor: 2699, version: 1, updated_at: null },
    { country: 'AZ', channel: 'book', rate_bp: 500, own_product: true, fixed_base_minor: null, version: 2, updated_at: null },
    { country: 'AZ', channel: 'partner', rate_bp: 0, own_product: false, fixed_base_minor: null, version: 1, updated_at: null },
  ],
  liability_available_minor: 841200, liability_pending_minor: 296000, debt_minor: 1250, issued_30d_minor: 123456, redeemed_30d_minor: 50000,
  expired_minor: 0, wallets: 1532, own_products: 12, by_channel_30d: { book: 70000, cake: 53456 },
  log: [{ id: 1, admin_id: 'admin', action: 'set_rule', target: 'AZ:book', detail: { rate_bp: 500 }, created_at: '2026-11-06T10:00:00Z' }],
};
let client: QueryClient;
const mount = () => render(<QueryClientProvider client={client}><AdminQaygiCash /></QueryClientProvider>);
const openTab = async (name: string) => { fireEvent.mouseDown(await screen.findByRole('tab', { name })); };

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.rpc.mockImplementation(async (name: string) => name === 'qaygicash_admin_overview_v1' ? { data: overview, error: null } : { data: { ok: true }, error: null });
});
afterEach(() => { cleanup(); client.clear(); });

it('formats and parses money and rates', () => {
  expect(formatMinor(123456)).toBe('1 234,56 ₼');
  expect(formatMinor(-250)).toBe('−2,50 ₼');
  expect(parseMoney('26,99')).toBe(2699);
  expect(parseMoney('-2,5', true)).toBe(-250);
  expect(parseMoney('-2,5')).toBeNull();
  expect(['0', '0,5', '3', '5'].map(parseRate)).toEqual([0, 50, 300, 500]);
  expect(['7', '0,3', '5,5', '1,25', 'abc', ''].map(parseRate)).toEqual([null, null, null, null, null, null]);
});

it('renders the overview KPIs, channel totals and admin log', async () => {
  mount();
  expect(await screen.findByText('8 412,00 ₼')).toBeInTheDocument();
  expect(screen.getByText('2 960,00 ₼')).toBeInTheDocument();
  expect(screen.getByText('1 234,56 ₼')).toBeInTheDocument();
  expect(screen.getByText('1532')).toBeInTheDocument();
  expect(screen.getByText('PDF kitablar')).toBeInTheDocument();
  expect(screen.getByText('AZ:book')).toBeInTheDocument();
});

it('rejects invalid rates client-side and saves a valid rate', async () => {
  mount(); await openTab('Dərəcələr');
  const row = await screen.findByTestId('qc-rule-book');
  const input = within(row).getByLabelText('PDF kitablar: dərəcə %');
  const save = within(row).getByRole('button', { name: 'Saxla' });
  for (const bad of ['7', '0,3']) {
    fireEvent.change(input, { target: { value: bad } });
    expect(within(row).getByText('0 və ya 0,5–5 (0,5 addımla)')).toBeInTheDocument();
    expect(save).toBeDisabled();
  }
  fireEvent.click(save);
  expect(mocks.rpc).not.toHaveBeenCalledWith('qaygicash_admin_set_rule_v1', expect.anything());
  fireEvent.change(input, { target: { value: '2,5' } });
  expect(within(row).getByText('2,50 ₼')).toBeInTheDocument();
  fireEvent.click(save);
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('qaygicash_admin_set_rule_v1',
    { p_country: 'AZ', p_channel: 'book', p_rate_bp: 250, p_own: true, p_fixed_base_minor: null }));
  const partner = screen.getByTestId('qc-rule-partner');
  expect(within(partner).getByLabelText('Tərəfdaş məhsulları (aptek): dərəcə %')).toBeDisabled();
});

it('sends the full premium_redeem object with the store warning visible', async () => {
  mount(); await openTab('Premium bonusla');
  expect(await screen.findByText(/App Store 3\.1\.1/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('switch', { name: 'Premium bonusla: əsas açar' }));
  fireEvent.click(screen.getByRole('switch', { name: 'Aylıq plan' }));
  fireEvent.change(screen.getByLabelText('Qiymət (₼)', { selector: '#qc-premium-monthly' }), { target: { value: '4,49' } });
  fireEvent.click(screen.getByRole('switch', { name: 'Platforma: Web' }));
  fireEvent.click(screen.getByRole('button', { name: 'Premium ayarlarını saxla' }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('qaygicash_admin_set_program_v1', { p_country: 'AZ', p_patch: { premium_redeem: {
    enabled: true, monthly: { enabled: true, price_minor: 449 }, yearly: { enabled: false, price_minor: 2699 }, platforms: { ios: false, android: false, web: true } } } }));
});

it('requires an in-page confirmation before changing a program to paused', async () => {
  mount(); await openTab('Proqramlar');
  fireEvent.click(within(await screen.findByTestId('qc-program-AZ')).getByRole('button', { name: 'Redaktə' }));
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'paused' } });
  fireEvent.change(screen.getByLabelText('Nəzarət qrupu, %'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Yadda saxla' }));
  expect(mocks.rpc).not.toHaveBeenCalledWith('qaygicash_admin_set_program_v1', expect.anything());
  fireEvent.click(screen.getByRole('button', { name: 'Bəli, təsdiqlə' }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('qaygicash_admin_set_program_v1', { p_country: 'AZ', p_patch: { status: 'paused', control_pct: 10 } }));
});

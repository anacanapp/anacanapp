import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), calls: [] as string[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: fixture.rpc, from: fixture.from } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin-fixture' }, isAdmin: true }) }));
import AdminDashboard from './AdminDashboard';

const response = (value: { data: unknown; error: unknown; status?: number }) => Object.assign(Promise.resolve(value), { abortSignal() { return this; } });
const overview = {
  schema: 'anacan-admin-overview-v1', users_total: 48213, users_today: 186, users_7d: 1294, users_prev_7d: 1172, premium_active: 3920, active_today: 6481, active_7d: 18904,
  active_prev_7d: 18230, orders_pending: 9, orders_processing: 14, orders_today: 37, orders_today_revenue: 1284.6, cakes_pending: 3, cakes_paid_today: 4, cakes_paid_today_revenue: 230,
  books_pending: 2, books_paid_today: 11, books_paid_today_revenue: 64.4, qc_available_minor: 841200, qc_pending_minor: 296000, support_open: 12, support_new: 5,
  moderation_pending: 4, ad_review_pending: 2, crashes_24h: 17, signups_series: [1, 2, 3], orders_series: [3, 2, 1], active_series: [5, 6],
  recent: [{ kind: 'order', id: 'o1', title: 'AP-26184', detail: 'pending', amount: 42.8, at: new Date().toISOString() }], generated_at: new Date().toISOString(),
};
/** Chainable PostgREST stub: every `count: exact, head` query resolves to a per-table count, row reads to []. */
function builder(table: string) {
  let head = false;
  const counts: Record<string, number> = { profiles: 500, orders: 7, cake_orders: 2, support_tickets: 3, post_reports: 1, crash_reports: 4, book_orders: 0 };
  const api: any = new Proxy({}, { get: (_target, key) => {
    if (key === 'select') return (_cols: string, options?: { head?: boolean }) => { head = !!options?.head; fixture.calls.push(`${table}:${head ? 'head' : 'rows'}`); return api; };
    if (key === 'then') return (resolve: (value: unknown) => void) => resolve(head ? { data: null, error: null, count: counts[table] ?? 0 } : { data: [], error: null });
    return () => api;
  } });
  return api;
}
let client: QueryClient;
const mount = () => render(<QueryClientProvider client={client}><AdminDashboard onNavigate={navigate} /></QueryClientProvider>);
const navigate = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); fixture.calls = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fixture.from.mockImplementation(builder);
});
afterEach(() => { cleanup(); client.clear(); });

describe('AdminDashboard', () => {
  it('renders KPIs from one admin_overview_v1 call without touching tables', async () => {
    fixture.rpc.mockImplementation((name: string) => response(name === 'admin_overview_v1' ? { data: overview, error: null } : { data: null, error: { code: 'PGRST202' } }));
    mount();
    expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByTestId('kpi-users')).getByText((48213).toLocaleString('az-AZ'))).toBeInTheDocument());
    expect(within(screen.getByTestId('kpi-active')).getByText((6481).toLocaleString('az-AZ'))).toBeInTheDocument();
    expect(within(screen.getByTestId('admin-queues')).getByText('17')).toBeInTheDocument();
    expect(screen.getByText('AP-26184')).toBeInTheDocument();
    expect(screen.getByTestId('admin-overview-source')).toHaveTextContent('admin_overview_v1');
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
    expect(fixture.from).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('kpi-users'));
    expect(navigate).toHaveBeenCalledWith('users');
  });

  it('falls back to head-only count queries when the RPC is not deployed', async () => {
    fixture.rpc.mockImplementation((name: string) => response(name === 'qaygicash_admin_overview_v1'
      ? { data: { liability_available_minor: 1000, liability_pending_minor: 500 }, error: null } : { data: null, error: { code: 'PGRST202', message: 'Could not find the function' }, status: 404 }));
    mount();
    await waitFor(() => expect(screen.getByTestId('admin-overview-source')).toHaveTextContent('ehtiyat'));
    expect(within(screen.getByTestId('kpi-users')).getByText('500')).toBeInTheDocument();
    expect(within(screen.getByTestId('kpi-active')).getByText('Server hesabatı tələb olunur')).toBeInTheDocument();
    // Counts never download rows; only five small "latest 5" reads are row queries.
    const heads = fixture.calls.filter(call => call.endsWith(':head')), rows = fixture.calls.filter(call => call.endsWith(':rows'));
    expect(heads.length).toBeGreaterThanOrEqual(12);
    expect(rows.length).toBeLessThanOrEqual(7);
  });

  it('shows an inline error with retry when the server refuses', async () => {
    fixture.rpc.mockImplementation(() => response({ data: null, error: { code: '42501', message: 'admin_required' } }));
    mount();
    const alert = await screen.findByRole('alert', {}, { timeout: 4000 }); // ADMIN_QUERY retries once
    expect(alert).toHaveTextContent('Məlumat alınmadı');
    fixture.rpc.mockImplementation((name: string) => response(name === 'admin_overview_v1' ? { data: overview, error: null } : { data: null, error: { code: 'PGRST202' } }));
    fireEvent.click(within(alert).getByRole('button', { name: 'Yenidən yoxla' }));
    await waitFor(() => expect(screen.getByTestId('admin-overview-source')).toHaveTextContent('admin_overview_v1'));
  });
});

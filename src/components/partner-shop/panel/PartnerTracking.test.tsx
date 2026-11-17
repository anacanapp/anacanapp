import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PanelPartner, PanelTracking } from '@/lib/partner-panel';

const KEY = 'pk_' + 'b'.repeat(32);
const DATA: PanelTracking = {
  from: '2026-10-19', to: '2026-11-17', test: false, key: KEY, has_secret: false, secret_set_at: null, attribution_days: 30,
  coupons: ['ANACAN10'], website_url: 'https://olivia.az', commission_pct: 7, last_order_at: null, last_pixel_at: null, last_server_at: null,
  summary: { clicks: 40, orders: 2, amount: 51.98, pending: 1, confirmed: 1, delivered: 0, cancelled: 0, returned: 0, payable_amount: 20,
    commission: 1.4, expected_commission: 3.64, by_click: 1, by_coupon: 1, verified: 1 },
  orders: [{ id: 'o1', order_id: 'OL-1001', amount: 31.98, currency: 'AZN', status: 'pending', source: 'pixel', verified: false, by: 'click', coupon: null,
    commission: 2.24, product_name: 'Siveno körpə yuyucu gel', placement: 'shop_baby', items: [], ordered_at: '2026-11-17T08:00:00Z', updated_at: '2026-11-17T08:00:00Z' }],
};

vi.mock('@/lib/partner-panel', async (orig) => {
  const real = await orig<typeof import('@/lib/partner-panel')>();
  return { ...real, prpc: vi.fn(async () => DATA) };
});

import { PartnerTracking } from './PartnerTracking';

const partner = (role: PanelPartner['role']): PanelPartner => ({
  id: 'p1', slug: 'olivia', name: 'Olivia', logo_url: null, icon_url: null, brand_color: '#9B16D9', status: 'admin_only',
  website_url: 'https://olivia.az', commission_pct: 7, role,
});

function renderPanel(role: PanelPartner['role']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><PartnerTracking partner={partner(role)} /></QueryClientProvider>);
}

describe('PartnerTracking', () => {
  it('shows the key, install snippets, numbers and tracked orders', async () => {
    renderPanel('owner');
    expect(await screen.findAllByText(/OL-1001/)).not.toHaveLength(0);
    expect(screen.getAllByText(KEY).length).toBeGreaterThan(0);
    expect(screen.getByText(/data-key="pk_b{32}"/)).toBeTruthy();
    expect(screen.getByText('Yarat')).toBeTruthy();
    expect(screen.getByDisplayValue('ANACAN10')).toBeTruthy();
    expect(screen.queryByText(/Atribusiya müddəti \(gün\)/)).toBeNull(); // owners cannot change the contract window
  });
  it('viewers see numbers but no secret or settings controls', async () => {
    renderPanel('viewer');
    expect(await screen.findAllByText(/OL-1001/)).not.toHaveLength(0);
    expect(screen.queryByText('Yarat')).toBeNull();
    expect(screen.queryByDisplayValue('ANACAN10')).toBeNull();
    expect(screen.queryByLabelText('Status')).toBeNull();
  });
});

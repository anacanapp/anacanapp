import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminEpointEvidence, { evidenceHtml, evidenceRows, type Evidence } from './AdminEpointEvidence';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));

const book: Evidence = {
  type: 'book', order_id: '11111111-2222-3333-4444-555555555555', provider_transaction: 'te023734232', status: 'paid', amount: 4, currency: 'AZN',
  created_at: '2026-11-05T12:01:00Z', paid_at: '2026-11-05T12:02:49Z', email: 'ana@example.com', name: 'Ana', user_id: 'u1', product: 'Fermada',
  channel: 'web', granted_at: '2026-11-05T12:02:49Z', email_sent_at: '2026-11-05T12:02:50Z', consent_at: '2026-11-05T12:01:00Z', consent_version: 'digital-delivery-v1',
  downloads: [{ at: '2026-11-05T12:05:00Z', book_id: '1_01', via: 'email_link', ip: '5.191.0.1', user_agent: 'Safari' }],
};

describe('AdminEpointEvidence', () => {
  it('builds the evidence rows with payment, delivery, downloads and consent', () => {
    const rows = Object.fromEntries(evidenceRows(book));
    expect(rows['Epoint əməliyyat ID']).toBe('te023734232');
    expect(rows['Status']).toBe('Ödənilib');
    expect(rows['PDF yükləmələri']).toMatch(/^1 dəfə/);
    expect(rows['Alıcının razılığı']).toMatch(/dərhal çatdırılmasına/);
  });
  it('escapes buyer data in the printable page', () => {
    const html = evidenceHtml({ ...book, name: '<script>x</script>' });
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).toContain('VÖEN 1407578211');
  });
  it('searches by Epoint transaction and shows the card', async () => {
    mocks.rpc.mockResolvedValue({ data: [book], error: null });
    render(<AdminEpointEvidence />);
    fireEvent.change(screen.getByLabelText(/Epoint əməliyyat ID/), { target: { value: ' te023734232 ' } });
    fireEvent.click(screen.getByRole('button', { name: /Axtar/ }));
    await waitFor(() => expect(screen.getByTestId('epoint-evidence-card')).toBeTruthy());
    expect(mocks.rpc).toHaveBeenCalledWith('admin_epoint_evidence_v1', { p_query: 'te023734232' });
    expect(screen.getAllByText('te023734232').length).toBeGreaterThan(0);
  });
  it('asks for a longer query instead of calling the server', () => {
    mocks.rpc.mockClear();
    render(<AdminEpointEvidence />);
    fireEvent.click(screen.getByRole('button', { name: /Axtar/ }));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

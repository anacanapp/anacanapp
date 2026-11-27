import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const updates: Array<{ id: string; bump_order: number }> = [];
const rows = [
  { id: 'a', tool_id: 'aa', name: 'Alpha', bump_order: 5 },
  { id: 'b', tool_id: 'bb', name: 'Beta', bump_order: 5 },   // same number as Alpha: used to get stuck
  { id: 'c', tool_id: 'cc', name: 'Gamma', bump_order: 9 },
].map((r, i) => ({ name_az: null, display_name_az: null, icon: '', life_stages: [], sort_order: i, flow_order: i, mommy_order: i,
  is_active: true, flow_active: true, bump_active: true, mommy_active: true, flow_locked: false, bump_locked: false, mommy_locked: false,
  is_premium: false, premium_type: 'none', premium_limit: 0, description_az: null, is_hero: false, hero_order: 0, is_quick_access: false, quick_access_order: 0, ...r }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ order: async () => ({ data: rows, error: null }) }),
      update: (patch: { bump_order: number }) => ({ eq: async (_c: string, id: string) => { updates.push({ id, bump_order: patch.bump_order }); return { error: null }; } }),
    }),
  },
}));
vi.mock('@/contexts/AdminLanguageContext', () => ({ useAdminLocalize: () => (row: Record<string, string>, f: string) => row[f] || '' }));
vi.mock('./AdminUsageStats', () => ({ default: () => null }));

import AdminTools from './AdminTools';

const names = () => screen.getAllByText(/^(Alpha|Beta|Gamma)$/).map((n) => n.textContent);

describe('AdminTools ordering', () => {
  it('moves a tool even when two tools share the same order number, and saves renumbered positions', async () => {
    render(<QueryClientProvider client={new QueryClient()}><AdminTools /></QueryClientProvider>);
    await waitFor(() => expect(names()).toEqual(['Alpha', 'Beta', 'Gamma']));
    const betaRow = screen.getByText('Beta').closest('[class*="rounded-lg border"]') as HTMLElement;
    const [up] = within(betaRow).getAllByRole('button').filter((b) => b.querySelector('.lucide-chevron-up'));
    fireEvent.click(up);
    expect(names()).toEqual(['Beta', 'Alpha', 'Gamma']);
    fireEvent.click(screen.getByText('Yadda saxla'));
    await waitFor(() => expect(updates.length).toBeGreaterThan(0));
    expect(Object.fromEntries(updates.map((u) => [u.id, u.bump_order]))).toEqual({ a: 20, b: 10, c: 30 });
  });

  it('every row has a drag handle', async () => {
    render(<QueryClientProvider client={new QueryClient()}><AdminTools /></QueryClientProvider>);
    await waitFor(() => expect(screen.getAllByLabelText('Sürüşdür')).toHaveLength(3));
  });
});

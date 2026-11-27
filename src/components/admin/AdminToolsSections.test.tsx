import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const updates: Array<{ id: string; bump_order: number }> = [];
const rows = [
  { id: 'a', tool_id: 'aa', name: 'Alpha', bump_order: 1 },
  { id: 'b', tool_id: 'blog', name: 'Beta', bump_order: 2 },
  { id: 'd', tool_id: 'dd', name: 'Delta', bump_order: 4, bump_active: false },
  { id: 'e', tool_id: 'mood', name: 'Epsilon', bump_order: 3, bump_locked: true },
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

describe('AdminTools sections mirror the app', () => {
  it('splits visible tools into free and Premium and lists hidden ones last', async () => {
    render(<QueryClientProvider client={new QueryClient()}><AdminTools /></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('Beta')).toBeTruthy());
    const section = (title: string) => screen.getByText(title).closest('div.mb-5') as HTMLElement;
    expect(within(section('Ödənişsiz alətlər')).queryByText('Beta')).toBeTruthy();
    expect(within(section('Premium alətlər')).queryByText('Alpha')).toBeTruthy();
    expect(within(section('Premium alətlər')).queryByText('Epsilon')).toBeTruthy(); // stage lock makes it Premium
    expect(within(section('Bu mərhələdə görünmür')).queryByText('Delta')).toBeTruthy();
  });
});

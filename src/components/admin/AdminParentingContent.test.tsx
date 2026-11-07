import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  rows: [] as unknown[],
  calls: [] as [string, Record<string, unknown>][],
  missing: false,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      db.calls.push([name, args]);
      if (name === 'admin_parenting_overrides_v1') {
        return Promise.resolve(db.missing ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function' }, status: 404 } : { data: db.rows, error: null });
      }
      return Promise.resolve({ data: {}, error: null });
    },
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminParentingContent, { listItems, overrideProblems } from './AdminParentingContent';
import az from '@/data/parenting/az';

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><AdminParentingContent /></QueryClientProvider>);
};

beforeEach(() => {
  db.rows = []; db.calls = []; db.missing = false;
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Admin → Tərbiyə məzmunu', () => {
  it('lists every editable item type with stable ids', () => {
    expect(listItems(az, 'article')).toHaveLength(az.articles.length);
    expect(listItems(az, 'programme_day').map((x) => x.id)).toContain('sleep-7:7');
    expect(listItems(az, 'tip')[0].id).toBe('0-1:1');
    expect(listItems(az, 'quiz').map((x) => x.id)).toEqual(['style', 'milestones']);
  });

  it('blocks removing {emergency} or hard-coding an emergency number', () => {
    const base = { text: 'Zəng et: {emergency}' };
    expect(overrideProblems(base, { text: 'Zəng et' })).toHaveLength(1);
    expect(overrideProblems(base, { text: 'Zəng et: 103 {emergency}' })).toHaveLength(1);
    expect(overrideProblems(base, { text: 'Dərhal zəng et: {emergency}' })).toEqual([]);
  });

  it('shows the bundled text, edits a field and publishes only the changed fields', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('par-item-lying'));
    const editor = await screen.findByTestId('admin-parenting-editor');
    const title = within(editor).getByDisplayValue('Yalan: niyə danışır və necə cavab verməli');
    fireEvent.change(title, { target: { value: 'Yalan: yeni başlıq' } });
    expect(within(editor).getByText('1 sahə dəyişib')).toBeInTheDocument();
    expect(within(editor).getByText(/Orijinal:/)).toBeInTheDocument();
    fireEvent.click(within(editor).getByRole('button', { name: 'Dərc et' }));
    await waitFor(() => expect(db.calls.some(([n]) => n === 'admin_parenting_override_save_v1')).toBe(true));
    const [, args] = db.calls.find(([n]) => n === 'admin_parenting_override_save_v1')!;
    expect(args).toEqual({ p_language: 'az', p_item_type: 'article', p_item_id: 'lying', p_patch: { title: 'Yalan: yeni başlıq' }, p_action: 'publish' });
  });

  it('opens a published override with its status and can revert it to the bundled text', async () => {
    db.rows = [{ item_type: 'sos', item_id: 'nightmare', patch: { title: 'Kabus (redaktə)' }, draft: null, published: true, published_at: '2026-11-07T10:00:00Z', updated_at: '2026-11-07T10:00:00Z' }];
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /SOS kartı/ }));
    const item = await screen.findByTestId('par-item-nightmare');
    expect(item).toHaveTextContent('Dərc olunub');
    fireEvent.click(item);
    const editor = await screen.findByTestId('admin-parenting-editor');
    expect(within(editor).getByDisplayValue('Kabus (redaktə)')).toBeInTheDocument();
    fireEvent.click(within(editor).getByRole('button', { name: 'Orijinala qaytar' }));
    await waitFor(() => expect(db.calls.some(([n]) => n === 'admin_parenting_override_revert_v1')).toBe(true));
    expect(db.calls.find(([n]) => n === 'admin_parenting_override_revert_v1')![1]).toEqual({ p_language: 'az', p_item_type: 'sos', p_item_id: 'nightmare' });
  });

  it('explains when the migration is not applied and disables saving', async () => {
    db.missing = true;
    renderPage();
    expect(await screen.findByText(/miqrasiya 20261107200000_parenting_sync_cms tətbiq olunmayıb/)).toBeInTheDocument();
    fireEvent.click(await screen.findByTestId('par-item-lying'));
    fireEvent.change(within(await screen.findByTestId('admin-parenting-editor')).getByDisplayValue('Yalan: niyə danışır və necə cavab verməli'), { target: { value: 'X' } });
    expect(screen.getByRole('button', { name: 'Dərc et' })).toBeDisabled();
  });
});

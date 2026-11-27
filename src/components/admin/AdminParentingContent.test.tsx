import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  rows: [] as unknown[],
  byLang: {} as Record<string, unknown[]>,
  history: [] as unknown[],
  historyMissing: true,
  calls: [] as [string, Record<string, unknown>][],
  missing: false,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      db.calls.push([name, args]);
      if (name === 'admin_parenting_overrides_v1') {
        return Promise.resolve(db.missing ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function' }, status: 404 }
          : { data: db.byLang[args.p_language as string] ?? db.rows, error: null });
      }
      if (name === 'admin_parenting_override_history_v1') {
        return Promise.resolve(db.historyMissing ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function' }, status: 404 } : { data: db.history, error: null });
      }
      return Promise.resolve({ data: {}, error: null });
    },
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminParentingContent, { listItems, overrideProblems, staleTranslations, versionPatch, type OverrideAdminRow } from './AdminParentingContent';
import az from '@/data/parenting/az';

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><AdminParentingContent /></QueryClientProvider>);
};

beforeEach(() => {
  db.rows = []; db.byLang = {}; db.history = []; db.historyMissing = true; db.calls = []; db.missing = false;
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

  it('flags other languages as possibly stale when the az override is newer or the language has none', () => {
    const row = (lang: string, id: string, updated: string, published_at: string | null = updated): OverrideAdminRow & { lang: string } =>
      ({ lang, item_type: 'article', item_id: id, patch: {}, draft: null, published: !!published_at, published_at, updated_at: updated });
    const az = [row('az', 'lying', '2026-11-08T10:00:00Z'), row('az', 'fears', '2026-11-01T10:00:00Z'), row('az', 'draft-only', '2026-11-08T10:00:00Z', null)];
    const en = [row('en', 'lying', '2026-11-05T10:00:00Z'), row('en', 'fears', '2026-11-02T10:00:00Z')];
    expect([...staleTranslations('en', en, az)]).toEqual(['article|lying']);
    expect([...staleTranslations('ru', [], az)].sort()).toEqual(['article|fears', 'article|lying']);
    expect(staleTranslations('az', [], az).size).toBe(0);
    expect(staleTranslations('en', en, null).size).toBe(0);
  });

  it('shows the stale badge on another language’s row', async () => {
    db.byLang = {
      az: [{ item_type: 'article', item_id: 'lying', patch: { title: 'Yeni' }, draft: null, published: true, published_at: '2026-11-08T10:00:00Z', updated_at: '2026-11-08T10:00:00Z' }],
      en: [],
    };
    renderPage();
    await screen.findByTestId('par-item-lying');
    expect(screen.queryByText('Tərcümə köhnə ola bilər')).toBeNull();
    fireEvent.change(screen.getByLabelText('Dil'), { target: { value: 'en' } });
    await waitFor(() => expect(screen.getByTestId('par-item-lying')).toHaveTextContent('Tərcümə köhnə ola bilər'));
  });

  it('history: explains a missing migration; lists versions and restores one through the RPC', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('par-item-lying'));
    const editor = await screen.findByTestId('admin-parenting-editor');
    fireEvent.click(within(editor).getByRole('button', { name: /Tarixçə/ }));
    expect(await within(editor).findByText(/20261108160000_parenting_cms_history tətbiq olunmayıb/)).toBeInTheDocument();
    cleanup();

    db.historyMissing = false;
    db.history = [
      { id: 'h2', patch: {}, draft: null, published: true, action: 'revert', edited_by: null, created_at: '2026-11-08T10:00:00Z' },
      { id: 'h1', patch: { title: 'Köhnə başlıq' }, draft: null, published: true, action: 'publish', edited_by: null, created_at: '2026-11-07T10:00:00Z' },
    ];
    renderPage();
    fireEvent.click(await screen.findByTestId('par-item-lying'));
    const ed = await screen.findByTestId('admin-parenting-editor');
    fireEvent.click(within(ed).getByRole('button', { name: /Tarixçə/ }));
    const list = await within(ed).findByTestId('admin-parenting-history');
    expect(list).toHaveTextContent('Orijinala qaytarılma');
    expect(list).toHaveTextContent('Dərc');
    fireEvent.click(within(list).getAllByRole('button', { name: 'Qaralama kimi bərpa et' })[1]);
    await waitFor(() => expect(db.calls.some(([n]) => n === 'admin_parenting_override_restore_v1')).toBe(true));
    expect(db.calls.find(([n]) => n === 'admin_parenting_override_restore_v1')![1]).toEqual({ p_history_id: 'h1', p_action: 'draft' });
    // "Load into form" puts the version's text in the editor without saving (the panel stays open after a restore).
    fireEvent.click(within(await within(ed).findByTestId('admin-parenting-history')).getAllByRole('button', { name: 'Formaya yüklə' })[1]);
    expect(within(ed).getByDisplayValue('Köhnə başlıq')).toBeInTheDocument();
  });

  it('a version stands for its live patch when published, else its draft', () => {
    expect(versionPatch({ patch: { a: 1 }, draft: { b: 2 }, published: true })).toEqual({ a: 1 });
    expect(versionPatch({ patch: { a: 1 }, draft: { b: 2 }, published: false })).toEqual({ b: 2 });
    expect(versionPatch({ patch: { a: 1 }, draft: null, published: false })).toEqual({ a: 1 });
  });

  it('previews the item with the edited text applied', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('par-item-lying'));
    const editor = await screen.findByTestId('admin-parenting-editor');
    fireEvent.change(within(editor).getByDisplayValue('Yalan: niyə danışır və necə cavab verməli'), { target: { value: 'Önizləmə başlığı' } });
    fireEvent.click(within(editor).getByRole('button', { name: /Önizləmə/ }));
    const preview = await within(editor).findByTestId('parenting-preview', {}, { timeout: 8000 });
    expect(within(preview).getByRole('heading', { name: 'Önizləmə başlığı' })).toBeInTheDocument();
  });
});

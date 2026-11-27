import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PartnerHospitalBagScreen from './PartnerHospitalBagScreen';

const make = (over: Record<string, unknown>) => ({
  id: String(over.item_id), user_id: 'mom', item_id: 'x', item_name: 'x', category: 'mom', bag_category: 'mom',
  is_checked: false, priority: 2, notes: null, added_by: null, custom: false, hidden: false, virtual: false,
  created_at: '', updated_at: '', ...over,
});

const state = vi.hoisted(() => ({
  hook: {} as Record<string, any>,
}));

vi.mock('@/hooks/usePartnerHospitalBag', () => ({ usePartnerHospitalBag: () => state.hook }));
vi.mock('@/lib/tr', () => ({
  tr: (_key: string, fallback: string) => fallback,
  formatTr: (_key: string, fallback: string, vars: Record<string, unknown>) =>
    fallback.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k])),
  mapRowsTranslation: (rows: unknown[]) => rows ?? [],
}));
vi.mock('@/store/userStore', () => ({ useUserStore: (sel: (s: { language: string }) => unknown) => sel({ language: 'az' }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

beforeEach(() => {
  const items = [
    make({ item_id: 'passport', item_name: 'Pasport', category: 'documents', bag_category: 'documents', is_checked: true }),
    make({ item_id: 'robe', item_name: 'Xalat', category: 'mom', bag_category: 'mom' }),
    make({ item_id: 'custom:partner:1', item_name: 'Şarj cihazı', category: 'mom', bag_category: 'partner', custom: true, added_by: 'partner' }),
    make({ item_id: 'socks', item_name: 'Corab', category: 'mom', bag_category: 'mom', hidden: true }),
  ];
  state.hook = {
    items: items.filter((i) => !i.hidden),
    hiddenItems: items.filter((i) => i.hidden),
    loading: false,
    toggleItem: vi.fn(),
    addItem: vi.fn().mockResolvedValue({ data: null, error: null }),
    deleteItem: vi.fn().mockResolvedValue({ error: null }),
    setHidden: vi.fn().mockResolvedValue({ error: null }),
    getProgress: () => (1 / 3) * 100,
    checkedCount: 1,
    totalCount: 3,
    refetch: vi.fn(),
  };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('shows a Partnyor tab with partner items and counts based on visible items', () => {
  render(<PartnerHospitalBagScreen onBack={() => {}} />);
  expect(screen.getByText('1 / 3')).toBeInTheDocument();
  expect(screen.getByText('Xalat')).toBeInTheDocument();
  // The partner item is not in the "Ana üçün" tab even though its legacy category is 'mom'.
  expect(screen.queryByText('Şarj cihazı')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /Partnyor/ }));
  expect(screen.getByText('Şarj cihazı')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Partnyor/ })).toHaveTextContent('(0/1)');
});

it('deletes an own item only after confirmation', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(<PartnerHospitalBagScreen onBack={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: /Partnyor/ }));
  const del = screen.getByRole('button', { name: 'Sil: Şarj cihazı' });
  fireEvent.click(del);
  expect(state.hook.deleteItem).not.toHaveBeenCalled();
  fireEvent.click(del);
  await waitFor(() => expect(state.hook.deleteItem).toHaveBeenCalledWith('custom:partner:1'));
  expect(confirm).toHaveBeenCalledTimes(2);
});

it('hides a default item and lists hidden items in a collapsible group to show again', async () => {
  render(<PartnerHospitalBagScreen onBack={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Gizlət: Xalat' }));
  await waitFor(() => expect(state.hook.setHidden).toHaveBeenCalledWith('robe', true));

  const toggle = screen.getByRole('button', { name: /Gizlədilənlər \(1\)/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Corab')).not.toBeInTheDocument();
  fireEvent.click(toggle);
  expect(screen.getByText('Corab')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Göstər: Corab' }));
  await waitFor(() => expect(state.hook.setHidden).toHaveBeenCalledWith('socks', false));
});

it('adds an own item in the active category', async () => {
  render(<PartnerHospitalBagScreen onBack={() => {}} />);
  fireEvent.click(screen.getByRole('tab', { name: /Partnyor/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Öz əşyanızı əlavə edin' }));
  fireEvent.change(await screen.findByRole('textbox', { name: 'Öz əşyanız' }), { target: { value: '  Su   şüşəsi ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Əlavə et' }));
  await waitFor(() => expect(state.hook.addItem).toHaveBeenCalledWith('Su şüşəsi', 'partner'));
});

it('toggles an item from its row button', () => {
  render(<PartnerHospitalBagScreen onBack={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Xalat/, pressed: false }));
  expect(state.hook.toggleItem).toHaveBeenCalledWith('robe');
});

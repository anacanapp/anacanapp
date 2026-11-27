import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'admin' }, isAdmin: true, loading: false, profile: { name: 'Admin', email: 'a@anacan.az' }, signOut: async () => ({ error: null }) }) }));
vi.mock('./sections', () => ({
  prefetchSection: vi.fn(),
  sectionComponent: (id: string) => function Section() { return <div data-testid="section-body">{id}</div>; },
}));
import AdminPanel from '../AdminPanel';

const setDesktop = (desktop: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: desktop && query.includes('min-width: 1024px'), media: query, onchange: null, addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
};
beforeEach(() => { localStorage.clear(); setDesktop(true); });
afterEach(() => { cleanup(); document.documentElement.classList.remove('admin-active'); });

describe('admin shell', () => {
  it('opens a deep link alias, shows the breadcrumb and switches sections from the menu', () => {
    const onSectionChange = vi.fn();
    render(<AdminPanel onExit={vi.fn()} initialTab="premium" onSectionChange={onSectionChange} />);
    expect(document.documentElement).toHaveClass('admin-active');
    expect(screen.getByTestId('section-body')).toHaveTextContent('premium');
    expect(within(screen.getByRole('navigation', { name: 'Yer' })).getByText('Premium mərkəzi')).toHaveAttribute('aria-current', 'page');
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Admin bölmələri' })).getAllByRole('button', { name: 'İstifadəçilər' })[0]);
    expect(onSectionChange).toHaveBeenCalledWith('users');
    expect(screen.getByTestId('section-body')).toHaveTextContent('users');
  });

  it('opens the command palette with Ctrl+K and jumps to a section', () => {
    const onSectionChange = vi.fn();
    render(<AdminPanel onExit={vi.fn()} onSectionChange={onSectionChange} />);
    act(() => { fireEvent.keyDown(window, { key: 'k', ctrlKey: true }); });
    const palette = screen.getByTestId('admin-command-palette');
    const input = within(palette).getByRole('combobox');
    fireEvent.change(input, { target: { value: 'kupon' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSectionChange).toHaveBeenCalledWith('coupons');
    expect(screen.queryByTestId('admin-command-palette')).not.toBeInTheDocument();
    expect(screen.getByTestId('section-body')).toHaveTextContent('coupons');
  });

  it('pins favourites and remembers recently used sections', () => {
    render(<AdminPanel onExit={vi.fn()} initialTab="crash-reports" />);
    fireEvent.click(screen.getByRole('button', { name: 'Seçilmişlərə əlavə et' }));
    expect(JSON.parse(localStorage.getItem('anacan_admin_favourites_v1')!)).toContain('crash-reports');
    expect(JSON.parse(localStorage.getItem('anacan_admin_recent_v1')!)[0]).toBe('crash-reports');
  });

  it('uses a bottom tab bar and a searchable "Hamısı" list on phones', () => {
    setDesktop(false);
    const onSectionChange = vi.fn();
    render(<AdminPanel onExit={vi.fn()} initialTab="dashboard" onSectionChange={onSectionChange} />);
    const tabs = screen.getByRole('navigation', { name: 'Əsas bölmələr' });
    expect(within(tabs).getAllByRole('button').map(button => button.textContent)).toEqual(['İcmal', 'Sifarişlər', 'İstifadəçilər', 'Məzmun', 'Hamısı']);
    fireEvent.click(within(tabs).getByRole('button', { name: 'Hamısı' }));
    const sheet = screen.getByTestId('admin-all-sections');
    fireEvent.change(within(sheet).getByRole('searchbox', { name: 'Bölmə axtar' }), { target: { value: 'peyvend' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Peyvənd təqvimi' }));
    expect(onSectionChange).toHaveBeenCalledWith('vaccines');
    expect(screen.queryByTestId('admin-all-sections')).not.toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole('button', { name: 'Sifarişlər' }));
    expect(onSectionChange).toHaveBeenLastCalledWith('orders');
    fireEvent.click(screen.getByRole('button', { name: 'Geri' }));
    expect(screen.getByTestId('section-body')).toHaveTextContent('vaccines');
  });
});

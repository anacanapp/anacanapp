import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./sections', () => ({ prefetchSection: vi.fn() }));
import CommandPalette, { searchSections } from './CommandPalette';
import { prefetchSection } from './sections';

afterEach(cleanup);
const mount = (props: Partial<React.ComponentProps<typeof CommandPalette>> = {}) => {
  const onNavigate = vi.fn(), onOpenChange = vi.fn();
  render(<CommandPalette open onOpenChange={onOpenChange} onNavigate={onNavigate} {...props} />);
  return { onNavigate, onOpenChange, input: screen.getByRole('combobox', { name: 'Bölmə axtar' }) };
};
const options = () => within(screen.getByRole('listbox', { name: 'Bölmələr' })).getAllByRole('option');

describe('searchSections', () => {
  it('folds Azerbaijani letters and ranks label prefixes first', () => {
    expect(searchSections('sifaris')[0].id).toBe('orders');
    expect(searchSections('İSTİFADƏÇİ')[0].id).toBe('users');
    expect(searchSections('istifadeci')[0].id).toBe('users');
  });
  it('finds sections by id and by keyword', () => {
    expect(searchSections('crash-reports')[0].id).toBe('crash-reports');
    expect(searchSections('push').map(section => section.id)).toContain('push-notifications');
    expect(searchSections('keşbek').map(section => section.id)).toContain('qaygicash');
    expect(searchSections('zzzz-nothing')).toEqual([]);
  });
});

describe('CommandPalette', () => {
  it('shows favourites and recents first when the query is empty', () => {
    mount({ favourites: ['orders'], recents: ['users', 'orders'] });
    const labels = options().slice(0, 2).map(option => option.textContent);
    expect(labels[0]).toContain('Sifarişlər');
    expect(labels[1]).toContain('İstifadəçilər');
    expect(screen.getByText('Seçilmişlər')).toBeInTheDocument();
    expect(screen.getByText('Son baxılanlar')).toBeInTheDocument();
  });
  it('navigates with the keyboard: type, arrow down, enter', () => {
    const { input, onNavigate, onOpenChange } = mount();
    fireEvent.change(input, { target: { value: 'sifari' } });
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    expect(options()[0]).toHaveTextContent('Sifarişlər');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options()[1].id);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onNavigate).toHaveBeenCalledWith('orders');
    expect(prefetchSection).toHaveBeenCalledWith('orders');
  });
  it('navigates on click and shows an empty state for no match', () => {
    const { input, onNavigate } = mount();
    fireEvent.change(input, { target: { value: 'xəta' } });
    fireEvent.click(options().find(option => option.textContent?.includes('Xəta hesabatları'))!);
    expect(onNavigate).toHaveBeenCalledWith('crash-reports');
    fireEvent.change(input, { target: { value: 'qqqqqq' } });
    expect(screen.getByText(/üzrə bölmə tapılmadı/)).toBeInTheDocument();
  });
  it('does not move past the ends of the list', () => {
    const { input } = mount();
    fireEvent.change(input, { target: { value: 'tortlar' } });
    const count = options().length;
    for (let i = 0; i < count + 3; i++) fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options()[count - 1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Home' });
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
  });
});

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import VaccineCalendar from './VaccineCalendar';

const mocks = vi.hoisted(() => ({
  language: 'ja', accountCountry: 'AZ', storedCountry: null as string | null, selected: 0, from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn(), refetch: vi.fn(), toast: vi.fn(), schedule: vi.fn(),
  children: [
    { id: 'child-a', name: 'Child A', birth_date: '2025-01-01', gender: 'girl', country_code: 'AZ', vaccine_country_code: 'FR', avatar_emoji: '👧' },
    { id: 'child-b', name: 'Child B', birth_date: '2024-01-01', gender: 'boy', country_code: 'AZ', vaccine_country_code: 'NL', avatar_emoji: '👦' },
  ],
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'viewer' }, profile: { country_code: mocks.accountCountry } }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (select: any) => select({ language: mocks.language, countryCode: mocks.storedCountry }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback, getPersistedLanguage: () => mocks.language }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/useChildren', () => ({ useChildren: () => ({ children: mocks.children, selectedChild: mocks.children[mocks.selected],
  setSelectedChild: (child: any) => { mocks.selected = mocks.children.findIndex(c => c.id === child.id); },
  getChildAge: () => ({ days: 300, displayText: 'Age', isPremature: false }), refetch: mocks.refetch }) }));
vi.mock('@/hooks/useVaccines', () => ({
  useVaccineCountries: () => ({ data: ['AZ','FR','NL','JP','SE'].map(code => ({ id: code, code, name: code, flag_emoji: '🌍' })) }),
  useVaccineScheduleForCountry: (country: string) => { mocks.schedule(country); return { data: [], isLoading: false }; },
  useChildVaccinations: () => ({ data: [] }), useUpsertChildVaccination: () => ({ mutateAsync: vi.fn() }), useDeleteChildVaccination: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>, DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: any) => asChild ? children : <button>{children}</button>,
  DropdownMenuItem: ({ children, onClick, disabled }: any) => <button onClick={onClick} disabled={disabled}>{children}</button>,
}));
beforeEach(() => {
  vi.clearAllMocks(); mocks.selected = 0; mocks.language = 'ja'; mocks.storedCountry = null; mocks.accountCountry = 'AZ';
  mocks.children[0].country_code = 'AZ'; mocks.children[1].country_code = 'AZ';
  mocks.children[0].vaccine_country_code = 'FR'; mocks.children[1].vaccine_country_code = 'NL';
  const q = { update: mocks.update, eq: mocks.eq, select: mocks.select, maybeSingle: mocks.maybeSingle };
  mocks.from.mockReturnValue(q); mocks.update.mockReturnValue(q); mocks.eq.mockReturnValue(q); mocks.select.mockReturnValue(q);
  mocks.refetch.mockResolvedValue(undefined);
});
afterEach(cleanup);

it('uses an explicit vaccine choice immediately when switching children or UI language', () => {
  const view = render(<VaccineCalendar onBack={() => {}} />);
  expect(screen.getByTestId('vaccine-country')).toHaveTextContent('FR');
  mocks.language = 'sv'; view.rerender(<VaccineCalendar onBack={() => {}} />);
  expect(screen.getByTestId('vaccine-country')).toHaveTextContent('FR');
  mocks.selected = 1; view.rerender(<VaccineCalendar onBack={() => {}} />);
  expect(screen.getByTestId('vaccine-country')).toHaveTextContent('NL');
  expect(mocks.schedule).toHaveBeenLastCalledWith('NL');
  expect(mocks.update).not.toHaveBeenCalled();
});
it('prioritizes the account country over a legacy child default and lists it first', () => {
  mocks.children[0].vaccine_country_code = ''; mocks.children[0].country_code = 'FR';
  mocks.accountCountry = 'NL';
  render(<VaccineCalendar onBack={() => {}} />);
  expect(screen.getByTestId('vaccine-country')).toHaveTextContent('NL');
  expect(screen.getAllByRole('button', { name: /^🌍/ }).filter(button => button.dataset.testid !== 'vaccine-country')[0]).toHaveTextContent('NL');
});
it('renders safely while the child list is loading, then adopts the loaded child country', () => {
  mocks.selected = -1;
  const view = render(<VaccineCalendar onBack={() => {}} />);
  expect(screen.queryByTestId('vaccine-country')).not.toBeInTheDocument();
  mocks.selected = 0; view.rerender(<VaccineCalendar onBack={() => {}} />);
  expect(screen.getByTestId('vaccine-country')).toHaveTextContent('FR');
});
it('requires a confirmed country write and does not let a late save switch another child country', async () => {
  let finish!: (value: any) => void; mocks.maybeSingle.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const view = render(<VaccineCalendar onBack={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: '🌍 SE' }));
  expect(screen.getByTestId('vaccine-country')).toHaveTextContent('FR');
  expect(mocks.eq).toHaveBeenCalledWith('id', 'child-a'); expect(mocks.eq).toHaveBeenCalledWith('user_id', 'viewer');
  mocks.selected = 1; view.rerender(<VaccineCalendar onBack={() => {}} />);
  expect(mocks.update).toHaveBeenCalledWith({ vaccine_country_code: 'SE' });
  await act(async () => finish({ data: { id: 'child-a', vaccine_country_code: 'SE' }, error: null }));
  expect(screen.getByTestId('vaccine-country')).toHaveTextContent('NL');
  expect(mocks.schedule).toHaveBeenLastCalledWith('NL');
});
it('keeps the previous country and reports a failed or unconfirmed save', async () => {
  mocks.maybeSingle.mockResolvedValue({ data: null, error: { code: '42501' } });
  render(<VaccineCalendar onBack={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: '🌍 SE' }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  expect(screen.getByTestId('vaccine-country')).toHaveTextContent('FR');
  expect(mocks.refetch).not.toHaveBeenCalled();
});

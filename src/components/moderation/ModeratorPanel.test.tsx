import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ModeratorPanel from './ModeratorPanel';
import { APP_LANGUAGES } from '@/lib/app-languages';
import { moderatorText } from '@/lib/moderator-i18n';

const mocks = vi.hoisted(() => ({ language: 'en', allowed: true, staff: true, rpc: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'moderator-fixture' }, isModerator: mocks.staff, isAdmin: false }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: any) => selector({ language: mocks.language }) }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ url: 'https://backend.example.test' }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('./AdModerationWorkspace', () => ({ default: ({ moderator }: { moderator: boolean }) => <div data-testid="advertising-workspace" data-moderator={moderator} /> }));
let client: QueryClient;
beforeEach(() => {
  mocks.language = 'en'; mocks.allowed = true; mocks.staff = true; vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  mocks.rpc.mockImplementation((name: string, args: any) => {
    const data = name === 'get_moderator_access_v1' ? { protocol: 'anacan-moderator-console-v1', user_id: 'moderator-fixture', role: mocks.allowed ? 'moderator' : null, allowed: mocks.allowed, network_mode: 'off' }
      : args?.p_view === 'overview' ? { tasks: 2, assigned: 1, restrictions: 0, warnings: 1, appeals: 0 }
      : { items: [], total: 0, mode: 'off' };
    const result = Promise.resolve({ data, error: null });
    return Object.assign(result, { abortSignal: () => result });
  });
});
afterEach(() => { cleanup(); client.clear(); });
const mount = () => render(<QueryClientProvider client={client}><ModeratorPanel onBack={vi.fn()} /></QueryClientProvider>);

it.each(APP_LANGUAGES.map(language => language.code))('renders the independent moderation navigation in %s', async language => {
  mocks.language = language; mount();
  expect(await screen.findByTestId('moderator-panel')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: moderatorText('title', language) })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: moderatorText('title', language) })).toBeInTheDocument();
  expect(screen.queryByText(/RevenueCat|Epoint/i)).not.toBeInTheDocument();
  expect(client.getQueryCache().getAll().every(query => query.meta?.persist === false)).toBe(true);
});
it('uses the moderator advertising workspace and server network-readiness state', async () => {
  mount(); await screen.findByTestId('moderator-panel');
  fireEvent.click(screen.getByRole('button', { name: moderatorText('ads', 'en') }));
  expect(screen.getByTestId('advertising-workspace')).toHaveAttribute('data-moderator', 'true');
  fireEvent.click(screen.getByRole('button', { name: moderatorText('network', 'en') }));
  await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('moderator_ip_rules_v1', { p_limit: 25, p_offset: 0 }));
  expect(screen.getByText(moderatorText('network_pending', 'en'))).toBeInTheDocument();
});
it('does not trust a cached UI role when the database denies access', async () => {
  mocks.allowed = false; mount();
  await screen.findByRole('alert');
  expect(screen.queryByTestId('moderator-panel')).not.toBeInTheDocument();
  expect(mocks.rpc.mock.calls.every(([name]) => name === 'get_moderator_access_v1')).toBe(true);
});
it('never requests moderation data for an ordinary account', () => {
  mocks.staff = false; mount();
  expect(screen.getByText(moderatorText('moderator_required', 'en'))).toBeInTheDocument();
  expect(mocks.rpc).not.toHaveBeenCalled();
});

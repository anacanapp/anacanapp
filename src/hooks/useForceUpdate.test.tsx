import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useForceUpdate } from './useForceUpdate';

const mocks = vi.hoisted(() => ({ native: vi.fn(), info: vi.fn(), rpc: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: mocks.info } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
const config = { enabled: true, min_version: '28.0', title: 'Update', message: 'Update the app', android_url: '', ios_url: '' };
let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.native.mockReturnValue(true);
  mocks.info.mockResolvedValue({ version: '28.0' });
  mocks.rpc.mockResolvedValue({ data: config, error: null });
});
afterEach(() => client.clear());

it.each(['28.0', '28.0.1', '29.0'])('does not block a current/newer %s native app', async version => {
  mocks.info.mockResolvedValue({ version });
  const { result } = renderHook(() => useForceUpdate(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.updateRequired).toBe(false);
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('get_public_app_setting', { p_key: 'force_update' });
});

it('requires an update only below min_version and supports JSON-encoded public settings', async () => {
  mocks.info.mockResolvedValue({ version: '25.0' });
  mocks.rpc.mockResolvedValue({ data: JSON.stringify(config), error: null });
  const { result } = renderHook(() => useForceUpdate(), { wrapper });
  await waitFor(() => expect(result.current.updateRequired).toBe(true));
});

it('does not block the website or call a native-only version API on web', () => {
  mocks.native.mockReturnValue(false);
  const { result } = renderHook(() => useForceUpdate(), { wrapper });
  expect(result.current.updateRequired).toBe(false);
  expect(result.current.isLoading).toBe(false);
  expect(mocks.info).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
});

it.each([null, { ...config, enabled: false }, { ...config, min_version: 'unknown' }])('does not guess a blanket block from an unusable setting', async value => {
  mocks.info.mockResolvedValue({ version: '25.0' });
  mocks.rpc.mockResolvedValue({ data: value, error: null });
  const { result } = renderHook(() => useForceUpdate(), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.updateRequired).toBe(false);
});

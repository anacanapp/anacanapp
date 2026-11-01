import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HealthSyncScreen from './HealthSyncScreen';
import { HEALTH_CONNECTED_KEY, localDayKey } from '@/lib/health';
import { CYCLE_WRITE_KEY } from '@/lib/healthCycle';
import { VITALS_WRITE_KEY } from '@/lib/healthVitals';
import en from '@/data/health-sync/en.json';

const { state, nativeHealth, cycle, vitals, toast } = vi.hoisted(() => ({
  state: { platform: 'ios', native: true, lifeStage: 'flow', language: 'en', userId: 'u1' },
  nativeHealth: {
    isHealthAvailable: vi.fn(), checkHealthPermissions: vi.fn(), requestHealthPermissions: vi.fn(),
    queryAggregated: vi.fn(), queryWorkouts: vi.fn(), openAppleHealthSettings: vi.fn(),
    openHealthConnectSettings: vi.fn(), showHealthConnectInPlayStore: vi.fn()
  },
  cycle: { isAvailable: vi.fn(), requestWritePermission: vi.fn(), writeMenstruation: vi.fn() },
  vitals: { isAvailable: vi.fn(), requestWritePermission: vi.fn(), writeWeight: vi.fn(), writeBloodPressure: vi.fn(), writeBloodGlucose: vi.fn() },
  toast: vi.fn()
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => state.native, getPlatform: () => state.platform },
  registerPlugin: (name: string) => name === 'HealthCycle' ? cycle : vitals
}));
vi.mock('capacitor-health', () => ({ Health: nativeHealth }));
vi.mock('@/store/userStore', () => ({
  useUserStore: Object.assign((selector: (value: typeof state) => unknown) => selector(state), { getState: () => state })
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => { const c = { select: () => c, eq: () => c, gt: () => c, order: () => c, limit: async () => ({ data: [], error: null }) }; return c; } }
}));
vi.mock('@/lib/i18n', () => ({ getLocaleTag: () => 'en-US', getCachedTranslation: () => undefined }));
vi.mock('@/lib/tr', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/tr')>()), tr: (_key: string, value: string) => value }));
vi.mock('@/hooks/useScrollToTop', () => ({ useScrollToTop: () => {} }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));

let client: QueryClient;
const midnight = () => {const d = new Date();return new Date(d.getFullYear(), d.getMonth(), d.getDate());};

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  Object.assign(state, { platform: 'ios', native: true, lifeStage: 'flow', language: 'en', userId: 'u1' });
  cycle.isAvailable.mockResolvedValue({ available: true, apiVersion: 2 });
  cycle.requestWritePermission.mockResolvedValue({ granted: true });
  vitals.isAvailable.mockResolvedValue({ available: true });
  vitals.requestWritePermission.mockResolvedValue({ granted: true });
  nativeHealth.isHealthAvailable.mockResolvedValue({ available: true });
  nativeHealth.requestHealthPermissions.mockResolvedValue({ permissions: { READ_STEPS: true, READ_WORKOUTS: true } });
  nativeHealth.checkHealthPermissions.mockResolvedValue({ permissions: { READ_STEPS: true, READ_WORKOUTS: true } });
  nativeHealth.queryAggregated.mockResolvedValue({ aggregatedData: [] });
  nativeHealth.queryWorkouts.mockResolvedValue({ workouts: [] });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  localStorage.clear();
});

const renderScreen = () => render(
  <QueryClientProvider client={client}>
    <HealthSyncScreen onBack={() => {}} />
  </QueryClientProvider>
);

describe('HealthSyncScreen', () => {
  it('shows real iOS steps after connecting (epoch-millisecond buckets)', async () => {
    nativeHealth.queryAggregated.mockImplementation(async ({ dataType }) => ({
      aggregatedData: dataType === 'steps' ? [{ startDate: midnight().getTime(), endDate: Date.now(), value: 8123 }] : []
    }));
    nativeHealth.queryWorkouts.mockResolvedValue({ workouts: [{ startDate: new Date().toISOString(), endDate: new Date().toISOString(), workoutType: 'walking', duration: 1800, calories: 120 }] });
    renderScreen();
    expect(await screen.findByText(en.status_off)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Connect Apple Health/ }));
    expect(await screen.findByText('8,123')).toBeInTheDocument();
    expect(screen.getByText(en.goal_done)).toBeInTheDocument();
    expect(screen.getByText(en.status_connected)).toBeInTheDocument();
    expect(screen.getByText(en.wt_walking)).toBeInTheDocument();
    expect(screen.getByText(en.mindful7)).toBeInTheDocument();
    expect(screen.queryByText(en.empty_title)).not.toBeInTheDocument();
  });

  it('explains where to look when the phone returns no data', async () => {
    localStorage.setItem(HEALTH_CONNECTED_KEY, '1');
    renderScreen();
    expect(await screen.findByText(en.empty_title)).toBeInTheDocument();
    expect(screen.getByText(en.empty_ios)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: en.open_permissions })[0]);
    await waitFor(() => expect(nativeHealth.openAppleHealthSettings).toHaveBeenCalledOnce());
  });

  it('reads Health Connect on Android and shows a missing grant honestly', async () => {
    state.platform = 'android';
    localStorage.setItem(HEALTH_CONNECTED_KEY, '1');
    nativeHealth.checkHealthPermissions.mockResolvedValue({ permissions: { READ_STEPS: false, READ_WORKOUTS: false } });
    renderScreen();
    expect(await screen.findByText(en.no_access_desc)).toBeInTheDocument();
    expect(screen.getAllByText(en.status_no_access).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: en.grant_btn }));
    await waitFor(() => expect(nativeHealth.requestHealthPermissions).toHaveBeenCalledWith({ permissions: ['READ_STEPS', 'READ_WORKOUTS'] }));
  });

  it('shows Android steps from LocalDateTime buckets', async () => {
    state.platform = 'android';
    localStorage.setItem(HEALTH_CONNECTED_KEY, '1');
    nativeHealth.queryAggregated.mockResolvedValue({ aggregatedData: [{ startDate: `${localDayKey(new Date())}T00:00`, endDate: '', value: 3456 }] });
    renderScreen();
    expect(await screen.findByText('3,456')).toBeInTheDocument();
    expect(screen.getByText(en.active7)).toBeInTheDocument();
  });

  it('offers the Health Connect install when it is missing', async () => {
    state.platform = 'android';
    nativeHealth.isHealthAvailable.mockResolvedValue({ available: false });
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: en.install_btn }));
    await waitFor(() => expect(nativeHealth.showHealthConnectInPlayStore).toHaveBeenCalledOnce());
  });

  it.each(['ios', 'android'])('turns on measurement copies with a permission request on %s', async (platform) => {
    state.platform = platform;
    renderScreen();
    const toggle = await screen.findByRole('switch', { name: en.vitals_title });
    expect(vitals.requestWritePermission).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(vitals.requestWritePermission).toHaveBeenCalledOnce();
    expect(localStorage.getItem(VITALS_WRITE_KEY)).toBe('1');
    expect(await screen.findByRole('button', { name: en.sync_now })).toBeInTheDocument();
  });

  it('keeps period copies to Flow, but an earlier opt-in can always be turned off', async () => {
    state.lifeStage = 'bump';
    renderScreen();
    await screen.findByRole('switch', { name: en.vitals_title });
    expect(screen.queryByRole('switch', { name: en.cycle_title })).not.toBeInTheDocument();
    cleanup();

    localStorage.setItem(CYCLE_WRITE_KEY, '1');
    renderScreen();
    const toggle = await screen.findByRole('switch', { name: en.cycle_title });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(localStorage.getItem(CYCLE_WRITE_KEY)).toBeNull();
    expect(cycle.requestWritePermission).not.toHaveBeenCalled();
  });

  it('is informational on the web', async () => {
    state.native = false;
    state.platform = 'web';
    renderScreen();
    expect(await screen.findByText(en.web_title)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    Object.values(nativeHealth).forEach((method) => expect(method).not.toHaveBeenCalled());
  });
});

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HealthSyncScreen from './HealthSyncScreen';
import { HEALTH_CONNECTED_KEY } from '@/lib/health';
import { CYCLE_WRITE_KEY } from '@/lib/healthCycle';
import { VITALS_WRITE_KEY } from '@/lib/healthVitals';

const { state, nativeHealth, cycle, vitals } = vi.hoisted(() => ({
  state: { platform: 'android', lifeStage: 'flow' },
  nativeHealth: {
    isHealthAvailable: vi.fn(), requestHealthPermissions: vi.fn(),
    queryAggregated: vi.fn(), queryWorkouts: vi.fn(),
    openHealthConnectSettings: vi.fn(), showHealthConnectInPlayStore: vi.fn()
  },
  cycle: { isAvailable: vi.fn(), requestWritePermission: vi.fn(), writeMenstruation: vi.fn() },
  vitals: { isAvailable: vi.fn(), requestWritePermission: vi.fn() }
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => state.platform },
  registerPlugin: (name: string) => name === 'HealthCycle' ? cycle : vitals
}));
vi.mock('capacitor-health', () => ({ Health: nativeHealth }));
vi.mock('@/store/userStore', () => ({
  useUserStore: (selector: (value: typeof state) => unknown) => selector(state)
}));
vi.mock('@/lib/tr', () => ({ tr: (key: string) => key }));
vi.mock('@/lib/i18n', () => ({ getLocaleTag: () => 'en-US' }));
vi.mock('@/hooks/useScrollToTop', () => ({ useScrollToTop: () => {} }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  state.platform = 'android';
  state.lifeStage = 'flow';
  cycle.isAvailable.mockResolvedValue({ available: true, apiVersion: 2 });
  cycle.requestWritePermission.mockResolvedValue({ granted: true });
  nativeHealth.isHealthAvailable.mockResolvedValue({ available: true });
  nativeHealth.queryAggregated.mockResolvedValue({ aggregatedData: [] });
  nativeHealth.queryWorkouts.mockResolvedValue({ workouts: [] });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  cleanup();
  client.clear();
  localStorage.clear();
});

function renderScreen() {
  return render(
    <QueryClientProvider client={client}>
      <HealthSyncScreen onBack={() => {}} />
    </QueryClientProvider>
  );
}

describe('HealthSyncScreen platform branches', () => {
  it.each([true, false])('requests cycle permission only on an explicit Flow toggle (granted=%s)', async (granted) => {
    cycle.requestWritePermission.mockResolvedValue({ granted });
    renderScreen();
    const toggle = screen.getByRole('switch', { name: 'hc_write_title' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await act(async () => {
      await client.refetchQueries({ queryKey: ['health-cycle-write-available'] });
    });
    expect(cycle.requestWritePermission).not.toHaveBeenCalled();
    expect(screen.queryByText('health_connect_btn')).not.toBeInTheDocument();

    fireEvent.click(toggle);
    await waitFor(() => expect(cycle.requestWritePermission).toHaveBeenCalledOnce());
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', String(granted)));
    expect(localStorage.getItem(CYCLE_WRITE_KEY)).toBe(granted ? '1' : null);
    expect(localStorage.getItem(HEALTH_CONNECTED_KEY)).toBeNull();
    expect(cycle.writeMenstruation).not.toHaveBeenCalled();
    Object.values(nativeHealth).forEach((method) => expect(method).not.toHaveBeenCalled());
    Object.values(vitals).forEach((method) => expect(method).not.toHaveBeenCalled());
  });

  it.each(['bump', 'mommy'])('hides activity and opt-ins for Android %s despite old flags and cache', async (stage) => {
    state.lifeStage = stage;
    localStorage.setItem(HEALTH_CONNECTED_KEY, 'previous-release');
    localStorage.setItem(VITALS_WRITE_KEY, '1');
    client.setQueryData(['health-available'], true);
    client.setQueryData(['health-daily', 7], { steps: [{ date: '2026-09-01', value: 9000 }], mindfulness: [] });
    client.setQueryData(['health-workouts', 7], [{ workoutType: 'running', duration: 1200 }]);
    renderScreen();
    await waitFor(() => expect(cycle.isAvailable).toHaveBeenCalledOnce());

    expect(screen.getByText('health_android_cycle_only')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText('health_connect_btn')).not.toBeInTheDocument();
    expect(screen.queryByText('health_steps_today')).not.toBeInTheDocument();
    expect(screen.queryByText('health_workouts_week')).not.toBeInTheDocument();
    expect(screen.queryByText('vitals_write_title')).not.toBeInTheDocument();
    Object.values(nativeHealth).forEach((method) => expect(method).not.toHaveBeenCalled());
    Object.values(vitals).forEach((method) => expect(method).not.toHaveBeenCalled());
    expect(cycle.requestWritePermission).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /health_open_settings/ }));
    await waitFor(() => expect(nativeHealth.openHealthConnectSettings).toHaveBeenCalledOnce());
  });

  it.each([false, true])('handles unavailable Health Connect without blocking prior opt-out (prior=%s)', async (prior) => {
    state.lifeStage = prior ? 'bump' : 'flow';
    if (prior) localStorage.setItem(CYCLE_WRITE_KEY, '1');
    cycle.isAvailable.mockResolvedValue({ available: false });
    renderScreen();
    await screen.findByText('health_android_unavailable_desc');
    const toggle = screen.getByRole('switch', { name: 'hc_write_title' });

    if (prior) {
      expect(toggle).toBeEnabled();
      expect(toggle).toBeChecked();
      fireEvent.click(toggle);
      expect(localStorage.getItem(CYCLE_WRITE_KEY)).toBeNull();
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    } else {
      expect(toggle).toBeDisabled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'health_hc_install' }));
    await waitFor(() => expect(nativeHealth.showHealthConnectInPlayStore).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: /health_open_settings/ })).toBeInTheDocument();
    expect(cycle.requestWritePermission).not.toHaveBeenCalled();
    expect(nativeHealth.isHealthAvailable).not.toHaveBeenCalled();
    expect(nativeHealth.requestHealthPermissions).not.toHaveBeenCalled();
  });

  it('preserves the iOS Connect, activity and write-toggle UI', async () => {
    state.platform = 'ios';
    renderScreen();
    fireEvent.click(await screen.findByRole('button', { name: 'health_connect_btn' }));
    await screen.findByText('health_steps_today');

    expect(nativeHealth.requestHealthPermissions).toHaveBeenCalledOnce();
    expect(screen.getByText('vitals_write_title')).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(2);
    expect(screen.queryByText('health_android_cycle_only')).not.toBeInTheDocument();
    expect(cycle.isAvailable).not.toHaveBeenCalled();
    expect(cycle.requestWritePermission).not.toHaveBeenCalled();
    expect(vitals.requestWritePermission).not.toHaveBeenCalled();
  });
});

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WeatherClothing from './WeatherClothing';

const mocks = vi.hoisted(() => ({ position: vi.fn(), invoke: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/permissions', () => ({ getCurrentPosition: mocks.position }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: () => ({ profile: { life_stage: 'flow' } }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (state: object) => unknown) => selector({ lifeStage: 'flow' }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback, getPersistedLanguage: () => 'az' }));
vi.mock('./anacan/ToolKit', () => ({
  ToolPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToolHeader: () => <h1>Weather</h1>,
}));

const advice = {
  temperature: 20, feelsLike: 20, humidity: 50, windSpeed: 5, uvIndex: 2,
  weatherDescription: 'Clear', clothingAdvice: 'Light clothes', clothingItems: [],
  warnings: [], outdoorAdvice: 'Walk outside', safeToGoOut: true, alertLevel: 'safe',
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.invoke.mockResolvedValue({ data: { success: true, cityName: 'Test city', advice }, error: null });
});
afterEach(cleanup);

describe('weather location handling', () => {
  it('uses the granted position once and sends the real coordinates', async () => {
    mocks.position.mockResolvedValue({ coords: { latitude: 41.7, longitude: 44.8 } });
    render(<WeatherClothing onBack={vi.fn()} />);
    await screen.findByText('Test city');
    expect(mocks.position).toHaveBeenCalledTimes(1);
    expect(mocks.invoke).toHaveBeenCalledWith('weather-clothing', expect.objectContaining({
      body: expect.objectContaining({ lat: 41.7, lng: 44.8 }),
    }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('labels Baku fallback after unavailable system location, rather than claiming permission denial', async () => {
    mocks.position.mockRejectedValue({ code: 'OS-PLUG-GLOC-0007' });
    render(<WeatherClothing onBack={vi.fn()} />);
    await screen.findByRole('status');
    expect(screen.getByRole('status')).toHaveTextContent('Bakı üçün hava göstərilir');
    expect(mocks.invoke).toHaveBeenCalledWith('weather-clothing', expect.objectContaining({
      body: expect.objectContaining({ lat: 40.4093, lng: 49.8671 }),
    }));
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it('does not mistake a backend permission error for device location denial', async () => {
    mocks.position.mockResolvedValue({ coords: { latitude: 41.7, longitude: 44.8 } });
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('permission denied for remote service') });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<WeatherClothing onBack={vi.fn()} />);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Hava məlumatı alınarkən xəta baş verdi.',
    })));
    expect(screen.queryByText(/Məkan icazəsi rədd edildi/)).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });
});

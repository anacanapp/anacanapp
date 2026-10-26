import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NoiseMeter from './NoiseMeter';

const { insert, openMicrophone, releaseAudioRecording, toast } = vi.hoisted(() => ({
  insert: vi.fn(), openMicrophone: vi.fn(), releaseAudioRecording: vi.fn(), toast: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: { user_id: 'noise-test' } }) }));
vi.mock('@/hooks/useScreenAnalytics', () => ({ useScreenAnalytics: () => {} }));
vi.mock('@/hooks/useScrollToTop', () => ({ useScrollToTop: () => {} }));
vi.mock('@/hooks/useMentalHealthData', () => ({ useNoiseThresholdsDB: () => ({ data: [] }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ insert }) } }));
vi.mock('@/lib/audioRecording', () => ({
  openMicrophone, releaseAudioRecording, getAudioErrorToast: () => ({ title: 'Microphone unavailable' }),
}));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/lib/i18n', () => ({ getLocaleTag: () => 'az-AZ' }));

let amplitude = 0.001;
const stream = {} as MediaStream;
const close = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  amplitude = 0.001; // 34 dB with the meter's existing calibration.
  openMicrophone.mockResolvedValue(stream);
  insert.mockResolvedValue({ error: null });
  close.mockResolvedValue(undefined);
  vi.stubGlobal('AudioContext', class {
    close = close;
    createMediaStreamSource() { return { connect: vi.fn() }; }
    createAnalyser() {
      return {
        frequencyBinCount: 4,
        getFloatTimeDomainData: (values: Float32Array) => values.fill(amplitude),
      };
    }
  });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function clickControl(name: RegExp) {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
}

describe('NoiseMeter retained result', () => {
  it('keeps average/max below the control while persistence is pending and resets them for the next recording', async () => {
    insert.mockReturnValue(new Promise(() => {}));
    render(<NoiseMeter onBack={vi.fn()} />);
    expect(screen.getByText('Ölçüm başladılmayıb')).toBeInTheDocument();
    await clickControl(/Başlamaq/);
    await clickControl(/Dayandırmaq/);

    expect(screen.queryByText('Ölçüm başladılmayıb')).not.toBeInTheDocument();
    const result = screen.getByRole('status');
    expect(within(result).getByText('Son ölçmənin nəticəsi')).toBeInTheDocument();
    expect(within(result).getAllByText('34 dB')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Başlamaq/ }).compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(releaseAudioRecording).toHaveBeenCalledWith(null, stream);
    expect(close).toHaveBeenCalledOnce();

    amplitude = 0.0001;
    await clickControl(/Başlamaq/);
    await clickControl(/Dayandırmaq/);
    expect(within(screen.getByRole('status')).getAllByText('14 dB')).toHaveLength(2);
  });

  it('distinguishes a measured silence from a measurement that never started', async () => {
    amplitude = 0;
    render(<NoiseMeter onBack={vi.fn()} />);
    await clickControl(/Başlamaq/);
    await clickControl(/Dayandırmaq/);
    expect(within(screen.getByRole('status')).getAllByText('0 dB')).toHaveLength(2);
    expect(screen.queryByText('Ölçüm başladılmayıb')).not.toBeInTheDocument();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ decibel_level: 0 }));
  });

  it('does not fabricate a result when microphone permission is refused', async () => {
    openMicrophone.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    render(<NoiseMeter onBack={vi.fn()} />);
    await clickControl(/Başlamaq/);
    expect(screen.getByText('Ölçüm başladılmayıb')).toBeInTheDocument();
    expect(screen.queryByText('Son ölçmənin nəticəsi')).not.toBeInTheDocument();
    expect(insert).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledOnce();
  });
});

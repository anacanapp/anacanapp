import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { format, subDays } from 'date-fns';

const state = vi.hoisted(() => ({ logs: [] as { log_date: string; flow_intensity: string }[], mutate: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, profile: { baby_birth_date: '2026-01-01' } }) }));
vi.mock('@/store/userStore', () => ({ useUserStore: (selector: (s: { language: string }) => unknown) => selector({ language: 'az' }) }));
vi.mock('@/hooks/usePeriodDayLogs', () => ({
  usePeriodDayLogs: () => ({ data: state.logs }),
  useRecordPeriodDays: () => ({ mutate: state.mutate, isPending: false }),
}));
vi.mock('@/lib/date-utils', () => ({ getCurrentDateLocale: () => undefined }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/flow/FlowPeriodCalendar', () => ({ default: () => null }));

import { MommyPeriodBanner } from './MommyPeriodTracker';

const day = (ago: number) => format(subDays(new Date(), ago), 'yyyy-MM-dd');
const flow = (...agos: number[]) => agos.map((ago) => ({ log_date: day(ago), flow_intensity: 'unspecified' }));

beforeEach(() => {
  state.logs = [];
  state.mutate = vi.fn((_input, opts) => opts?.onSuccess?.());
  localStorage.clear();
});
afterEach(cleanup);

describe('MommyPeriodBanner', () => {
  it('invites to track with the Menstruasiya wording and records today on Başladı', () => {
    const onOpen = vi.fn();
    render(<MommyPeriodBanner onOpen={onOpen} />);
    expect(screen.getByText('Menstruasiyanız bərpa olunub?')).toBeTruthy();
    fireEvent.click(screen.getByText('Menstruasiya izləyicinizi və təqviminizi açın'));
    expect(onOpen).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Başladı' }));
    expect(state.mutate.mock.calls[0][0]).toEqual({ dates: [day(0)], flow: 'unspecified', preserveExisting: true });
  });

  it('shows the day count and ends the period over its whole range', () => {
    state.logs = flow(2, 1, 0);
    render(<MommyPeriodBanner onOpen={vi.fn()} />);
    expect(screen.getByText('Gün 3')).toBeTruthy();
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Bitdi' }));
    const input = state.mutate.mock.calls[0][0];
    expect(input.complete).toBe(true);
    expect(input.dates.map((d: Date) => format(d, 'yyyy-MM-dd'))).toEqual([day(2), day(1), day(0)]);
    // Ended today: the card now offers a new start.
    expect(screen.getByRole('button', { name: 'Başladı' })).toBeTruthy();
  });

  it('asks about today when recorded until yesterday and logs it on Davam edir', () => {
    state.logs = flow(2, 1);
    render(<MommyPeriodBanner onOpen={vi.fn()} />);
    expect(screen.getByText('Bu gün də davam edir?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Davam edir' }));
    expect(state.mutate.mock.calls[0][0]).toEqual({ dates: [day(0)], flow: 'unspecified', preserveExisting: true });
  });

  it('toggles a day in the 14-day strip', () => {
    state.logs = flow(20);
    render(<MommyPeriodBanner onOpen={vi.fn()} />);
    const days = screen.getByRole('group').querySelectorAll('button');
    expect(days).toHaveLength(14);
    fireEvent.click(days[12]);
    expect(state.mutate.mock.calls[0][0]).toEqual({ dates: [day(1)], flow: 'unspecified' });
  });
});

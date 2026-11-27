import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Appointment } from '@/hooks/useAppointments';

const state = vi.hoisted(() => ({ appointments: [] as Appointment[], user: { id: 'u' } as { id: string } | null }));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/hooks/useAppointments', () => ({ useAppointments: () => ({ appointments: state.appointments }) }));
vi.mock('./AppointmentSheet', () => ({
  default: ({ appointment }: { appointment: Appointment | null }) => <div role="dialog">{appointment ? `edit:${appointment.title}` : 'new'}</div>,
}));

import UpcomingAppointments from './UpcomingAppointments';

const iso = (offsetDays: number) => {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const row = (over: Partial<Appointment>): Appointment => ({
  id: 'a1', user_id: 'u', title: 'USM', description: null, event_date: iso(1), event_time: '09:30:00',
  event_type: 'ultrasound', reminder_enabled: true, created_at: '2026-01-01T00:00:00Z', ...over,
});

beforeEach(() => {
  localStorage.setItem('anacan-language', 'en');
  state.user = { id: 'u' };
  state.appointments = [];
});
afterEach(cleanup);

describe('UpcomingAppointments', () => {
  it('lists only future appointments (max 4) and opens the edit sheet on tap', async () => {
    state.appointments = [
      row({ id: 'past', title: 'Old visit', event_date: iso(-2) }),
      row({ id: 't', title: 'Blood test', event_date: iso(0) }),
      row({ id: 'm', title: 'USM', event_date: iso(1) }),
      row({ id: 'x', title: 'Dentist', event_date: iso(10) }),
      row({ id: 'y', title: 'Checkup', event_date: iso(20) }),
      row({ id: 'z', title: 'Fifth', event_date: iso(30) }),
    ];
    render(<UpcomingAppointments />);
    expect(screen.queryByText('Old visit')).toBeNull();
    expect(screen.queryByText('Fifth')).toBeNull();
    expect(screen.getByText('Blood test')).toBeTruthy();
    expect(screen.getByText('Checkup')).toBeTruthy();

    fireEvent.click(screen.getByText('USM'));
    expect((await screen.findByRole('dialog')).textContent).toBe('edit:USM');
  });

  it('shows the empty state and opens a new appointment sheet from it and from the add link', async () => {
    render(<UpcomingAppointments />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect((await screen.findByRole('dialog')).textContent).toBe('new');
  });

  it('renders nothing when signed out', () => {
    state.user = null;
    const { container } = render(<UpcomingAppointments />);
    expect(container.innerHTML).toBe('');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Appointment } from '@/hooks/useAppointments';

const api = vi.hoisted(() => ({
  addAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  deleteAppointment: vi.fn(),
}));

vi.mock('@/hooks/useAppointments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAppointments')>()),
  useAppointments: () => ({ ...api, saving: false }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/native', () => ({ hapticFeedback: { light: vi.fn() } }));
// vaul needs layout APIs jsdom lacks; render the sheet content inline.
vi.mock('@/components/anacan/Sheet', () => ({
  Sheet: ({ open, title, children, footer }: { open: boolean; title: ReactNode; children: ReactNode; footer?: ReactNode }) =>
    open ? <div><h2>{title}</h2>{children}{footer}</div> : null,
}));

import AppointmentSheet from './AppointmentSheet';
import { sortAppointments } from '@/hooks/useAppointments';

const row = (over: Partial<Appointment>): Appointment => ({
  id: 'a1', user_id: 'u', title: 'USM', description: null, event_date: '2099-03-04', event_time: '09:30:00',
  event_type: 'ultrasound', reminder_enabled: true, created_at: '2026-01-01T00:00:00Z', ...over,
});

beforeEach(() => {
  localStorage.setItem('anacan-language', 'en');
  api.addAppointment.mockReset().mockImplementation(async (input) => row({ ...input, id: 'new' }));
  api.updateAppointment.mockReset().mockImplementation(async (id, input) => row({ ...input, id }));
  api.deleteAppointment.mockReset().mockResolvedValue(true);
});
afterEach(cleanup);

describe('AppointmentSheet', () => {
  it('requires a title, then saves every field for a new appointment', async () => {
    const onClose = vi.fn();
    render(<AppointmentSheet open onClose={onClose} defaultDate={new Date(2099, 0, 15)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Add a title');
    expect(api.addAppointment).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText(/Check-up/), { target: { value: '  Doctor visit  ' } });
    fireEvent.click(screen.getByRole('radio', { name: /Lab test/ }));
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '14:15' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Room 4' } });
    expect(screen.getByRole('switch')).toHaveTextContent('2 hours before');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.addAppointment).toHaveBeenCalledWith({
      title: 'Doctor visit', event_type: 'test', event_date: '2099-01-15', event_time: '14:15',
      description: 'Room 4', reminder_enabled: true,
    });
  });

  it('edits an existing appointment and can switch the reminder off', async () => {
    render(<AppointmentSheet open onClose={vi.fn()} appointment={row({})} />);
    expect(screen.getByRole('heading')).toHaveTextContent('Edit appointment');
    expect(screen.getByLabelText('Time')).toHaveValue('09:30');
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updateAppointment).toHaveBeenCalledWith('a1', expect.objectContaining({
      event_time: null, reminder_enabled: false, event_type: 'ultrasound', description: null,
    })));
  });

  it('asks for a second tap before deleting', async () => {
    const onClose = vi.fn();
    render(<AppointmentSheet open onClose={onClose} appointment={row({})} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteAppointment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to delete' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.deleteAppointment).toHaveBeenCalledWith('a1');
  });

  it('warns that past dates get no reminder', () => {
    render(<AppointmentSheet open onClose={vi.fn()} appointment={row({ event_date: '2000-01-01' })} />);
    expect(screen.getByRole('switch')).toHaveTextContent('no reminder will be sent');
  });
});

describe('sortAppointments', () => {
  it('orders by date, then time, untimed last', () => {
    const list = sortAppointments([
      row({ id: 'c', event_date: '2099-01-02', event_time: null }),
      row({ id: 'b', event_date: '2099-01-02', event_time: '08:00:00' }),
      row({ id: 'a', event_date: '2099-01-01', event_time: '23:00:00' }),
    ]);
    expect(list.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });
});

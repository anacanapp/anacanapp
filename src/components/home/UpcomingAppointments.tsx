import { Suspense, lazy, useMemo, useState } from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { Bell, Calendar, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAppointments, type Appointment } from '@/hooks/useAppointments';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { rd } from '@/lib/redesign-i18n';

const AppointmentSheet = lazy(() => import('./AppointmentSheet'));

/** Home "Upcoming" card in the original a-* design: next appointments, add/edit in a sheet. */
export default function UpcomingAppointments() {
  const { user } = useAuth();
  const { appointments } = useAppointments();
  // null = closed; { appointment: null } = new appointment.
  const [sheet, setSheet] = useState<{ appointment: Appointment | null } | null>(null);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  // Appointments come ordered by date and time.
  const upcoming = useMemo(
    () => appointments.filter((a) => new Date(`${a.event_date}T00:00:00`) >= today).slice(0, 4),
    [appointments, today],
  );
  if (!user) return null;

  return (
    <section className="a-section">
      <div className="a-section-head">
        <h2 className="a-section-title a-heading">{rd('upcoming_title')}</h2>
        <button type="button" className="a-section-link inline-flex items-center gap-1" onClick={() => setSheet({ appointment: null })}>
          <Plus size={14} strokeWidth={2.2} />{rd('upcoming_add')}
        </button>
      </div>
      <div className="a-list-card">
        {upcoming.length ? upcoming.map((a) => {
          const date = new Date(`${a.event_date}T00:00:00`);
          const days = differenceInCalendarDays(date, today);
          const sub = [format(date, 'd MMMM', { locale: getCurrentDateLocale() }), a.event_time?.slice(0, 5)].filter(Boolean).join(' · ');
          return (
            <button key={a.id} type="button" className="a-list-row w-full text-start" onClick={() => setSheet({ appointment: a })}>
              <span className="a-list-icon" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
                <Calendar size={17} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="a-list-title truncate">{a.title}</p>
                <p className="a-list-sub inline-flex items-center gap-1">
                  {a.reminder_enabled !== false && <Bell size={11} aria-label={rd('appt_remind')} />}{sub}
                </p>
              </div>
              <span className="a-list-trail">
                <p className="a-list-value">{days === 0 ? rd('today') : days === 1 ? rd('tomorrow') : rd('in_days', { n: days })}</p>
              </span>
            </button>
          );
        }) : (
          <button type="button" className="a-list-row w-full text-start" onClick={() => setSheet({ appointment: null })}>
            <span className="a-list-icon" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
              <Plus size={17} strokeWidth={2} />
            </span>
            <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>{rd('upcoming_empty')}</p>
          </button>
        )}
      </div>
      {sheet && (
        <Suspense fallback={null}>
          <AppointmentSheet open onClose={() => setSheet(null)} appointment={sheet.appointment} />
        </Suspense>
      )}
    </section>
  );
}

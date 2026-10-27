// Add / edit / delete one appointment. Used from the home "Upcoming" list and the calendar.
// Reminders are pushed by the server (day before at 10:00 and 2 hours before), so this only
// stores the reminder switch.
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Bell, Trash2 } from 'lucide-react';
import { Sheet } from '@/components/anacan/Sheet';
import { rd, type RedesignKey } from '@/lib/redesign-i18n';
import { hapticFeedback } from '@/lib/native';
import { useToast } from '@/hooks/use-toast';
import { useAppointments, type Appointment } from '@/hooks/useAppointments';

export const APPOINTMENT_TYPES: { id: string; key: RedesignKey; icon: string }[] = [
  { id: 'appointment', key: 'appt_type_doctor', icon: '🩺' },
  { id: 'ultrasound', key: 'appt_type_ultrasound', icon: '🫄' },
  { id: 'test', key: 'appt_type_test', icon: '🧪' },
  { id: 'pill', key: 'appt_type_pill', icon: '💊' },
  { id: 'reminder', key: 'appt_type_other', icon: '🔔' },
];

export const appointmentIcon = (type: string | null | undefined) =>
  APPOINTMENT_TYPES.find((t) => t.id === type)?.icon ?? APPOINTMENT_TYPES[0].icon;

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit this appointment; omit to add a new one. */
  appointment?: Appointment | null;
  /** Prefilled date for a new appointment (defaults to today). */
  defaultDate?: Date | null;
}

export default function AppointmentSheet({ open, onClose, appointment, defaultDate }: Props) {
  const { addAppointment, updateAppointment, deleteAppointment, saving } = useAppointments();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('appointment');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [remind, setRemind] = useState(true);
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(appointment?.title ?? '');
    setType(appointment?.event_type ?? 'appointment');
    setDate(appointment?.event_date ?? format(defaultDate ?? new Date(), 'yyyy-MM-dd'));
    setTime(appointment?.event_time?.slice(0, 5) ?? '');
    setNote(appointment?.description ?? '');
    setRemind(appointment ? appointment.reminder_enabled !== false : true);
    setTouched(false);
    setConfirmDelete(false);
  }, [open, appointment, defaultDate]);

  const titleOk = title.trim().length > 0;
  const isPast = !!date && date < format(new Date(), 'yyyy-MM-dd');

  const save = async () => {
    setTouched(true);
    if (!titleOk || !date || saving) return;
    const fields = {
      title: title.trim().slice(0, 120),
      event_type: type,
      event_date: date,
      event_time: time || null,
      description: note.trim() ? note.trim().slice(0, 500) : null,
      reminder_enabled: remind,
    };
    const row = appointment ? await updateAppointment(appointment.id, fields) : await addAppointment(fields);
    if (!row) return;
    hapticFeedback.light();
    if (appointment) toast({ title: rd('appt_updated'), description: row.title });
    onClose();
  };

  const remove = async () => {
    if (!appointment || saving) return;
    if (!confirmDelete) { setConfirmDelete(true); hapticFeedback.light(); return; }
    if (await deleteAppointment(appointment.id)) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full={false}
      title={appointment ? rd('appt_edit') : rd('appt_new')}
      footer={
        <div className="a3-appt-bar">
          {appointment && (
            <button type="button" className={`a3-btn ghost${confirmDelete ? ' danger' : ''}`} onClick={() => void remove()} disabled={saving}
              aria-label={confirmDelete ? rd('appt_delete_confirm') : rd('appt_delete')}>
              <Trash2 size={18} />{confirmDelete ? rd('appt_delete_confirm') : null}
            </button>
          )}
          {!confirmDelete && (
            <button type="button" className="a3-btn accent grow" onClick={() => void save()} disabled={saving}>{rd('appt_save')}</button>
          )}
        </div>
      }>
      <form className="a3-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="a3-field"><span>{rd('appt_what')}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={rd('appt_what_ph')} maxLength={120}
            enterKeyHint="done" aria-invalid={touched && !titleOk} />
        </label>
        {touched && !titleOk && <p className="a3-meta" role="alert" style={{ color: 'var(--a-bad)' }}>{rd('appt_err_title')}</p>}

        <div className="a3-field" role="radiogroup" aria-label={rd('appt_type')}>
          <span>{rd('appt_type')}</span>
          <div className="a3-appt-types">
            {APPOINTMENT_TYPES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={type === t.id} className={`a3-chip-btn${type === t.id ? ' on' : ''}`} onClick={() => setType(t.id)}>
                <span aria-hidden="true">{t.icon}</span> {rd(t.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="a3-form-row">
          <label className="a3-field"><span>{rd('appt_date')}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="a3-field"><span>{rd('appt_time')}</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        <label className="a3-field"><span>{rd('appt_note')}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={rd('appt_note_ph')} maxLength={500} />
        </label>

        <button type="button" role="switch" aria-checked={remind} className="a3-switch-row" onClick={() => setRemind((v) => !v)}>
          <span className="a3-ico-sq sm c-yellow" aria-hidden="true"><Bell size={16} /></span>
          <span className="grow">
            <span className="a3-switch-title">{rd('appt_remind')}</span>
            <span className="a3-meta">{isPast ? rd('appt_past') : time ? rd('appt_remind_hint_time') : rd('appt_remind_hint')}</span>
          </span>
          <span className="a3-switch" aria-hidden="true" />
        </button>
      </form>
    </Sheet>
  );
}

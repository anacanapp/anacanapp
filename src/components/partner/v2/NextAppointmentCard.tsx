import { useState, useEffect } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { CalendarHeart, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { tr } from '@/lib/tr';

/**
 * Ananın növbəti randevusu — partnyor "onu apar" xatırlatması.
 * RLS: "Partners can view linked appointments" (mövcuddur).
 * share_appointments bağlıdırsa render olunmur (valideyn komponent idarə edir).
 */

interface AppointmentRow {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  event_type: string | null;
}

interface Props {
  motherUserId: string | null | undefined;
  onOpen?: () => void;
}

const NextAppointmentCard = ({ motherUserId, onOpen }: Props) => {
  const [appointment, setAppointment] = useState<AppointmentRow | null>(null);

  useEffect(() => {
    if (!motherUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase.
        from('appointments').
        select('id, title, event_date, event_time, event_type').
        eq('user_id', motherUserId).
        gte('event_date', today).
        order('event_date', { ascending: true }).
        order('event_time', { ascending: true, nullsFirst: false }).
        limit(1);

        if (!cancelled && !error && data && data.length > 0) {
          setAppointment(data[0] as AppointmentRow);
        }
      } catch {
        /* səssiz — kart sadəcə görünmür */
      }
    })();
    return () => {cancelled = true;};
  }, [motherUserId]);

  if (!appointment) return null;

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const isToday = appointment.event_date === today;
  const isTomorrow = appointment.event_date === tomorrow;

  const dateLabel = isToday ?
  tr('partnerv2_bu_gun', 'Bu gün') :
  isTomorrow ?
  tr('partnerv2_sabah', 'Sabah') :
  new Date(appointment.event_date).toLocaleDateString(getLocaleTag(), { day: 'numeric', month: 'long' });

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className="w-full flex items-center gap-3 text-start"
      style={{
        padding: 15,
        borderRadius: 'var(--a-radius-md)',
        background: 'var(--a-surface)',
        boxShadow: 'var(--a-card-shadow)',
        border: isToday ? '1.5px solid var(--a-blue-2)' : '1.5px solid transparent'
      }}
      whileTap={{ scale: 0.98 }}>

      <div className="w-11 h-11 flex items-center justify-center shrink-0" style={{ borderRadius: 14, background: 'var(--a-blue-1)' }}>
        <CalendarHeart size={19} style={{ color: 'var(--a-blue-ink)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{appointment.title}</p>
          {isToday &&
          <span className="shrink-0" style={{ background: 'var(--a-blue-2)', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 9.5, fontWeight: 800 }}>
              {tr('partnerv2_bu_gun', 'Bu gün')}!
            </span>
          }
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', marginTop: 1 }}>
          {dateLabel}{appointment.event_time ? ` · ${appointment.event_time.slice(0, 5)}` : ''} — {tr('partnerv2_onu_aparmagi_unutma', 'onu aparmağı unutma')} 🚗
        </p>
      </div>
      <ChevronRight size={16} className="rtl:rotate-180 shrink-0" style={{ color: 'var(--a-ink-faint)' }} />
    </motion.button>);

};

export default NextAppointmentCard;

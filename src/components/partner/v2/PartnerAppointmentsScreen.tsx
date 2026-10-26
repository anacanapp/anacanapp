import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getLocaleTag } from '@/lib/i18n';
import { ArrowLeft, CalendarHeart, Stethoscope, Pill, Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePartnerData } from '@/hooks/usePartnerData';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { tr } from '@/lib/tr';

/**
 * Ananın randevuları — partnyor görünüşü (read-only).
 * RLS: "Partners can view linked appointments".
 * share_appointments bağlıdırsa hörmətli boş vəziyyət göstərilir.
 */

interface AppointmentRow {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  event_type: string | null;
}

interface Props {
  onBack: () => void;
}

const TYPE_META: Record<string, {icon: any;bg: string;ink: string;}> = {
  appointment: { icon: Stethoscope, bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)' },
  pill: { icon: Pill, bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' },
  reminder: { icon: Bell, bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)' }
};

const PartnerAppointmentsScreen = ({ onBack }: Props) => {
  useScrollToTop();
  const { partnerProfile, sharing } = usePartnerData();
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerProfile?.user_id || !sharing.share_appointments) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const from = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        const { data, error } = await supabase.
        from('appointments').
        select('id, title, description, event_date, event_time, event_type').
        eq('user_id', partnerProfile.user_id).
        gte('event_date', from).
        order('event_date', { ascending: true }).
        order('event_time', { ascending: true, nullsFirst: false });

        if (!cancelled && !error) setAppointments((data || []) as AppointmentRow[]);
      } catch {/* boş qalır */} finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {cancelled = true;};
  }, [partnerProfile?.user_id, sharing.share_appointments]);

  const today = new Date().toISOString().split('T')[0];
  const upcoming = appointments.filter((a) => a.event_date >= today);
  const past = appointments.filter((a) => a.event_date < today).reverse();

  const formatDate = (d: string) =>
  new Date(d).toLocaleDateString(getLocaleTag(), { day: 'numeric', month: 'long', weekday: 'long' });

  const renderRow = (apt: AppointmentRow, highlight: boolean, idx: number) => {
    const meta = TYPE_META[apt.event_type || 'appointment'] || TYPE_META.appointment;
    const Icon = meta.icon;
    const isToday = apt.event_date === today;
    return (
      <motion.div
        key={apt.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.04 }}
        className="flex items-center gap-3"
        style={{
          padding: 14,
          borderRadius: 16,
          background: highlight ? 'var(--a-surface)' : 'var(--a-surface)',
          opacity: highlight ? 1 : 0.6,
          boxShadow: 'var(--a-card-shadow)',
          border: isToday ? '1.5px solid var(--a-blue-2)' : '1.5px solid transparent'
        }}>

        <div className="w-11 h-11 flex items-center justify-center shrink-0" style={{ borderRadius: 14, background: meta.bg }}>
          <Icon size={18} style={{ color: meta.ink }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{apt.title}</p>
            {isToday &&
            <span className="shrink-0" style={{ background: 'var(--a-blue-2)', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 9.5, fontWeight: 800 }}>
                {tr('partnerv2_bu_gun', 'Bu gün')}
              </span>
            }
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', marginTop: 1 }}>
            {formatDate(apt.event_date)}{apt.event_time ? ` · ${apt.event_time.slice(0, 5)}` : ''}
          </p>
          {apt.description && <p className="truncate" style={{ fontSize: 11, color: 'var(--a-ink-faint)', marginTop: 1 }}>{apt.description}</p>}
        </div>
      </motion.div>);
  };

  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr('common_geri', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{tr('partnerv2_onun_vizitleri', 'Onun vizitləri')}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr('partnerv2_randevular', 'Randevular')}</p>
            </div>
          </div>
        </header>

        {!sharing.share_appointments ?
        <div className="a-card text-center" style={{ padding: '38px 18px' }}>
            <div className="mx-auto mb-4 flex items-center justify-center"
          style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--a-surface-soft)' }}>
              <CalendarHeart size={26} style={{ color: 'var(--a-ink-faint)' }} />
            </div>
            <h3 className="a-list-title" style={{ marginBottom: 4 }}>{tr('partnerv2_paylasim_bagli', 'Paylaşım bağlıdır')}</h3>
            <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>
              {tr('partnerv2_randevu_paylasimi_bagli_izah', 'Həyat yoldaşınız randevu paylaşımını hazırda bağlayıb.')}
            </p>
          </div> :
        loading ?
        <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--a-blue-2)', borderTopColor: 'transparent' }} />
          </div> :
        appointments.length === 0 ?
        <div className="a-card text-center" style={{ padding: '38px 18px' }}>
            <div className="mx-auto mb-4 flex items-center justify-center"
          style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--a-blue-1)' }}>
              <CalendarHeart size={26} style={{ color: 'var(--a-blue-ink)' }} />
            </div>
            <h3 className="a-list-title" style={{ marginBottom: 4 }}>{tr('partnerv2_randevu_yoxdur', 'Randevu yoxdur')}</h3>
            <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>
              {tr('partnerv2_randevu_yoxdur_izah', 'Həyat yoldaşınız randevu əlavə etdikdə burada görünəcək.')}
            </p>
          </div> :

        <div className="space-y-4">
            {upcoming.length > 0 &&
          <div>
                <h3 className="a-section-title" style={{ marginBottom: 10 }}>{tr('partnerv2_qarsidan_gelen', 'Qarşıdan gələn')}</h3>
                <div className="space-y-2">{upcoming.map((a, i) => renderRow(a, true, i))}</div>
              </div>
          }
            {past.length > 0 &&
          <div>
                <h3 className="a-section-title" style={{ marginBottom: 10 }}>{tr('partnerv2_kecmis', 'Keçmiş')}</h3>
                <div className="space-y-2">{past.slice(0, 5).map((a, i) => renderRow(a, false, i))}</div>
              </div>
          }
          </div>
        }
      </div>
    </div>);

};

export default PartnerAppointmentsScreen;

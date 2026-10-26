import { tr } from "@/lib/tr";import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Bell, ChevronRight, Clock, Check, X } from 'lucide-react';
import { useFlowReminders, useToggleReminder, useInitializeFlowReminders, REMINDER_TYPE_INFO, ReminderType } from '@/hooks/useFlowReminders';
import { Switch } from '@/components/ui/switch';

const FlowRemindersCard = () => {
  const { data: reminders = [], isLoading } = useFlowReminders();
  const toggleReminder = useToggleReminder();
  const initReminders = useInitializeFlowReminders();
  const [showAll, setShowAll] = useState(false);
  const initFiredRef = useRef(false);

  // İlk açılışda default xatırlatmaları yarat (heç biri yoxdursa) —
  // əvvəllər bu init HEÇ YERDƏ çağırılmırdı → server bildirişləri işə düşmürdü.
  useEffect(() => {
    if (!isLoading && reminders.length === 0 && !initFiredRef.current) {
      initFiredRef.current = true;
      initReminders.mutate();
    }
  }, [isLoading, reminders.length]);

  const handleToggle = async (id: string, currentValue: boolean) => {
    await toggleReminder.mutateAsync({ id, is_enabled: !currentValue });
  };

  if (isLoading) {
    return (
      <div className="a-card animate-pulse">
        <div style={{ height: 24, width: '33%', borderRadius: 8, background: 'var(--a-surface-soft)', marginBottom: 14 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ height: 48, borderRadius: 14, background: 'var(--a-surface-soft)' }} />
          <div style={{ height: 48, borderRadius: 14, background: 'var(--a-surface-soft)' }} />
        </div>
      </div>);

  }

  const displayedReminders = showAll ? reminders : reminders.slice(0, 3);
  const enabledCount = reminders.filter((r) => r.is_enabled).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="a-card a-fade-in"
      style={{ padding: '18px 18px 8px' }}>
      
      <div className="a-card-head" style={{ marginBottom: 4 }}>
        <h3 className="a-card-title a-heading">{tr("flowreminderscard_xatirlatmalar_ddd8e7", "Xat\u0131rlatmalar")}</h3>
        <span className="a-tag on" style={{ cursor: 'default' }}>
          {enabledCount} {tr("flowreminderscard_aktiv_d7a82c", "aktiv")}
        </span>
      </div>

      {reminders.length > 0 ?
      <div>
          {displayedReminders.map((reminder) => {
          const info = REMINDER_TYPE_INFO[reminder.reminder_type as ReminderType];
          return (
            <div key={reminder.id} className="a-list-row" style={{ paddingInlineStart: 0, paddingInlineEnd: 0, opacity: reminder.is_enabled ? 1 : 0.55 }}>
                <span className="a-list-icon" style={{ background: 'var(--a-surface-soft)', fontSize: 17 }}>
                  {info?.emoji || '🔔'}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p className="a-list-title">
                    {reminder.reminder_type !== 'custom'
                    ? tr(`useflowreminders_title_${reminder.reminder_type}`, reminder.title || info?.labelAz || info?.label || '')
                    : reminder.title}
                  </p>
                  <p className="a-list-sub" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={11} />
                    {reminder.time_of_day?.slice(0, 5) || '09:00'}
                    {reminder.days_before > 0 &&
                  <span>· {tr("flow_days_before", "{days} gün əvvəl").replace("{days}", String(reminder.days_before))}</span>
                  }
                  </p>
                </div>
                <span className="a-list-trail">
                  <Switch
                  checked={reminder.is_enabled}
                  onCheckedChange={() => handleToggle(reminder.id, reminder.is_enabled)}
                  disabled={toggleReminder.isPending} />
                </span>
              </div>);

        })}

          {reminders.length > 3 &&
        <button
          onClick={() => setShowAll(!showAll)}
          className="a-list-row"
          style={{ width: '100%', textAlign: 'start', background: 'none', border: 'none', borderTop: '1px solid var(--a-line)', cursor: 'pointer', paddingInlineStart: 0, paddingInlineEnd: 0 }}>
          
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: 'var(--a-ink-soft)' }}>
                {showAll ? tr("flowreminderscard_daha_az_goster_47a81d", "Daha az g\xF6st\u0259r") : tr("flowreminderscard_hamisini_goster_f123bc", "Hamısını göstər ({count})").replace("{count}", String(reminders.length))}
              </span>
              <ChevronRight size={15} className={`rtl:rotate-180 a-list-chevron transition-transform ${showAll ? 'rotate-90' : ''}`} />
            </button>
        }
        </div> :

      <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Bell size={36} style={{ color: 'var(--a-ink-faint)', margin: '0 auto 8px' }} />
          <p className="a-list-title" style={{ marginBottom: 3 }}>
            {tr("flowreminderscard_hec_bir_xatirlatma_yoxdur_dc234b", "He\xE7 bir xat\u0131rlatma yoxdur")}
          </p>
          <p className="a-list-sub" style={{ margin: '0 0 12px' }}>
            {tr("flowreminderscard_tenzimlemelerden_xatirlatmalar_389fd8", "T\u0259nziml\u0259m\u0259l\u0259rd\u0259n xat\u0131rlatmalar \u0259lav\u0259 edin")}
          </p>
        </div>
      }
    </motion.div>);

};

export default FlowRemindersCard;
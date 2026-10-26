import { tr } from "@/lib/tr";import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pill, Clock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useFlowReminders, useSaveFlowReminder, useToggleReminder } from '@/hooks/useFlowReminders';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { useUserStore } from '@/store/userStore';

const PILL_NOTIFICATION_ID = 91201;

const PillReminderCard = () => {
  const { data: reminders = [] } = useFlowReminders();
  const save = useSaveFlowReminder();
  const toggle = useToggleReminder();
  const pill = reminders.find((r) => r.reminder_type === 'pill');

  const language = useUserStore((s) => s.language);
  const defaultTitleAz = "Həbinizi qəbul edin";
  
  const getPillTitle = () => {
    if (!pill?.title) return tr("pillremindercard_hebinizi_qebul_edin_03c5be", defaultTitleAz);
    // Başlıq hələ default AZ mətndirsə → BÜTÜN dillərdə lokallaşdır (əvvəllər yalnız en idi)
    if (pill.title === defaultTitleAz) return tr("pillremindercard_hebinizi_qebul_edin_03c5be", defaultTitleAz);
    return pill.title;
  };

  const [time, setTime] = useState(pill?.time_of_day?.slice(0, 5) || '09:00');
  const [title, setTitle] = useState(getPillTitle());
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (pill) {
      setTime(pill.time_of_day?.slice(0, 5) || '09:00');
      setTitle(getPillTitle());
    }
  }, [pill?.id, language]);

  const scheduleNative = async (enabled: boolean, t: string, ttl: string) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await LocalNotifications.cancel({ notifications: [{ id: PILL_NOTIFICATION_ID }] });
      if (!enabled) return;
      const [h, m] = t.split(':').map(Number);
      const now = new Date();
      const at = new Date();
      at.setHours(h, m, 0, 0);
      if (at <= now) at.setDate(at.getDate() + 1);
      await LocalNotifications.schedule({
        notifications: [{
          id: PILL_NOTIFICATION_ID,
          title: ttl || tr("pillremindercard_hebinizi_qebul_edin_03c5be", "H\u0259binizi q\u0259bul edin"),
          body: tr("pillremindercard_gundelik_hebinizi_qebul_etmek__064f3f", "\uD83D\uDC8A G\xFCnd\u0259lik h\u0259binizi q\u0259bul etm\u0259k vaxt\u0131d\u0131r"),
          schedule: { at, repeats: true, every: 'day' }
        }]
      });
    } catch (e) {
      console.warn('Pill reminder schedule failed', e);
    }
  };

  const handleSave = async () => {
    const isEnabled = pill?.is_enabled ?? true;
    await save.mutateAsync({
      reminder_type: 'pill',
      time_of_day: `${time}:00`,
      days_before: 0,
      is_enabled: isEnabled,
      title,
      message: tr("pillremindercard_gundelik_hebinizi_qebul_edin_ea7547", "\uD83D\uDC8A G\xFCnd\u0259lik h\u0259binizi q\u0259bul edin")
    });
    await scheduleNative(isEnabled, time, title);
    toast.success(tr("pillremindercard_heb_xatirlatmasi_yadda_saxlani_27cacb", "H\u0259b xat\u0131rlatmas\u0131 yadda saxlan\u0131ld\u0131"));
    setEditing(false);
  };

  const handleToggle = async () => {
    if (!pill) {
      await save.mutateAsync({
        reminder_type: 'pill',
        time_of_day: `${time}:00`,
        days_before: 0,
        is_enabled: true,
        title,
        message: tr("pillremindercard_gundelik_hebinizi_qebul_edin_ea7547", "\uD83D\uDC8A G\xFCnd\u0259lik h\u0259binizi q\u0259bul edin")
      });
      await scheduleNative(true, time, title);
    } else {
      await toggle.mutateAsync({ id: pill.id, is_enabled: !pill.is_enabled });
      await scheduleNative(!pill.is_enabled, time, title);
    }
  };

  const enabled = pill?.is_enabled ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="a-card a-fade-in">
      
      <div className="a-card-head" style={{ marginBottom: enabled ? 12 : 8 }}>
        <div className="a-list-row" style={{ padding: 0, borderTop: 'none', gap: 10 }}>
          <span className="a-list-icon" style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--a-grad-yellow)', color: 'var(--a-warn-ink)' }}>
            <Pill size={16} strokeWidth={2} />
          </span>
          <h3 className="a-card-title a-heading">{tr("pillremindercard_heb_xatirlatmasi_e3e934", "H\u0259b Xat\u0131rlatmas\u0131")}</h3>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} disabled={save.isPending || toggle.isPending} />
      </div>

      {enabled &&
      <div className="space-y-3">
          {editing ?
        <>
              <div>
                <label className="a-stat-tile-label" style={{ display: 'block', marginBottom: 4 }}>{tr("pillremindercard_basliq_e1f6c5", "Ba\u015Fl\u0131q")}</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="a-input" style={{ width: '100%' }} />
              </div>
              <div>
                <label className="a-stat-tile-label" style={{ display: 'block', marginBottom: 4 }}>{tr("untranslated_vaxt_8etncj", "Vaxt")}</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="a-input" style={{ width: '100%' }} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={save.isPending} className="a-btn-solid" style={{ flex: 1, justifyContent: 'center' }}>{tr("untranslated_yadda_saxla_bpdu9v", "Yadda saxla")}</button>
                <button onClick={() => setEditing(false)} className="a-tag" style={{ cursor: 'pointer' }}>{tr("pillremindercard_legv_et_b5e49c", "L\u0259\u011Fv et")}</button>
              </div>
            </> :

        <button
          onClick={() => setEditing(true)}
          className="a-stat-tile"
          style={{ width: '100%', textAlign: 'start', border: 'none', cursor: 'pointer', justifyContent: 'space-between' }}>
          
              <div>
                <p className="a-list-title">{title}</p>
                <p className="a-list-sub" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={11} />
                  {tr("pillremindercard_her_gun_f4fe36", "H\u0259r g\xFCn")} {time}
                </p>
              </div>
              <span className="a-list-value" style={{ color: 'var(--a-accent-ink)' }}>{tr("pillremindercard_redakte_d53ba7", "Redakt\u0259")}</span>
            </button>
        }
        </div>
      }

      {!enabled &&
      <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>{tr("pillremindercard_gundelik_kontrasepsiya_ve_ya_d_8f8e44", "G\xFCnd\u0259lik kontrasepsiya v\u0259 ya d\u0259rman xat\u0131rlatmas\u0131 \xFC\xE7\xFCn aktiv edin.")}</p>
      }
    </motion.div>);

};

export default PillReminderCard;
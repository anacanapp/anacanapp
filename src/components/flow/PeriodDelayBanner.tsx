import { tr } from "@/lib/tr";import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, MessageCircle } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useCycleStats } from '@/hooks/useCycleHistory';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const PeriodDelayBanner = () => {
  const { lastPeriodDate, cycleLength } = useUserStore(
    useShallow((s) => ({ lastPeriodDate: s.lastPeriodDate, cycleLength: s.cycleLength }))
  );
  const { user } = useAuth();
  const stats = useCycleStats();
  const navigate = useNavigate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lpd = lastPeriodDate ? new Date(lastPeriodDate) : new Date(today);
  lpd.setHours(0, 0, 0, 0);
  const daysSince = Math.floor((today.getTime() - lpd.getTime()) / (1000 * 60 * 60 * 24));
  const avgCycle = stats.averageCycleLength || cycleLength || 28;
  const delayDays = daysSince - avgCycle;

  // Throttled notification: only insert into notifications once per 24h
  useEffect(() => {
    if (!lastPeriodDate || delayDays < 3 || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data: prefs } = await supabase.
      from('user_preferences').
      select('last_delay_notification_at').
      eq('user_id', user.id).
      maybeSingle();
      if (cancelled) return;
      const last = prefs?.last_delay_notification_at ? new Date(prefs.last_delay_notification_at) : null;
      const hoursAgo = last ? (Date.now() - last.getTime()) / 36e5 : Infinity;
      if (hoursAgo < 24) return;

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Period gecikir',
        message: `${tr("flow_period_delay_1", "Periodunuz təxmini tarixdən")} ${delayDays} ${tr("flow_period_delay_2", "gün gecikir. Hamiləlik testi etməyi və ya Dr. Anacan-dan soruşmağı düşünün.")}`,
        notification_type: 'flow_delay',
        is_read: false
      });
      await supabase.
      from('user_preferences').
      update({ last_delay_notification_at: new Date().toISOString() }).
      eq('user_id', user.id);
    })();
    return () => {cancelled = true;};
  }, [delayDays, user?.id, lastPeriodDate]);

  if (!lastPeriodDate || delayDays < 3) return null;

  return (
    <section className="a-section" style={{ marginTop: 8 }}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="a-alert-card a-fade-in">
        
        <span className="a-alert-eyebrow">
          <AlertCircle size={13} strokeWidth={2.3} /> {tr("flow_cycle_alert", "Tsikl xəbərdarlığı")}
        </span>
        <h1 className="a-alert-headline a-heading">
          {tr("perioddelaybanner_period_late", "Periodunuz {days} gün gecikir").replace("{days}", String(delayDays))}
        </h1>
        <p className="a-alert-text">
          {tr("perioddelaybanner_avg_cycle_desc", "Orta tsikliniz {days} gündür. Stress, çəki dəyişikliyi, hormonal dalğalanma və ya hamiləlik səbəb ola bilər. Hamiləlik testi etməyi düşünün.").replace("{days}", String(avgCycle))}
        </p>
        <button
          onClick={() => navigate(`/ai-chat?prompt=${encodeURIComponent(`${tr("flow_period_delay_prompt_1", "Periodum")} ${delayDays} ${tr("flow_period_delay_prompt_2", "gün gecikib, nə edə bilərəm?")}`)}`)}
          className="a-cta-btn"
          style={{ background: 'var(--a-pink-2)' }}>
          
          <MessageCircle size={14} strokeWidth={2.2} />
          {tr("perioddelaybanner_dr_anacan_dan_sorus_1fb5f1", "Dr. Anacan-dan soru\u015F")}
        </button>
      </motion.div>
    </section>);

};

export default PeriodDelayBanner;

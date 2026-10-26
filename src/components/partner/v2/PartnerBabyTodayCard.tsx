import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { tr } from '@/lib/tr';

/**
 * Mommy: "Körpə bu gün" — dashboard üçün kompakt yemə/yuxu/bez zolağı.
 * Toxunanda tam "Körpə Günü" ekranı açılır.
 */

interface Props {
  motherUserId: string;
  babyName: string;
  onOpen: () => void;
}

interface DayAgg {
  feeds: number;
  totalMl: number;
  sleepMin: number;
  sleepOngoing: boolean;
  diapers: number;
}

const PartnerBabyTodayCard = ({ motherUserId, babyName, onOpen }: Props) => {
  const [agg, setAgg] = useState<DayAgg | null>(null);

  useEffect(() => {
    if (!motherUserId) return;
    let cancelled = false;

    const fetchToday = async () => {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { data, error } = await supabase.
        from('baby_logs').
        select('log_type, start_time, end_time, amount_ml').
        eq('user_id', motherUserId).
        gte('start_time', startOfDay.toISOString());

        if (cancelled || error) return;
        const logs = data || [];
        const feeds = logs.filter((l) => l.log_type === 'feeding');
        const sleeps = logs.filter((l) => l.log_type === 'sleep');
        const sleepMin = sleeps.reduce((s, l) => {
          if (!l.end_time) return s;
          return s + Math.max(0, (new Date(l.end_time).getTime() - new Date(l.start_time).getTime()) / 60000);
        }, 0);
        setAgg({
          feeds: feeds.length,
          totalMl: feeds.reduce((s, l) => s + ((l as any).amount_ml || 0), 0),
          sleepMin,
          sleepOngoing: sleeps.some((l) => !l.end_time),
          diapers: logs.filter((l) => l.log_type === 'diaper').length
        });
      } catch {/* səssiz */}
    };

    fetchToday();

    const channel = supabase.
    channel(`partner-baby-strip-${motherUserId}`).
    on('postgres_changes', { event: '*', schema: 'public', table: 'baby_logs', filter: `user_id=eq.${motherUserId}` }, () => {
      fetchToday();
    }).
    subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [motherUserId]);

  if (!agg) return null;

  const sleepH = Math.floor(agg.sleepMin / 60);
  const sleepM = Math.round(agg.sleepMin % 60);

  const tiles = [
  { emoji: '🍼', value: String(agg.feeds), sub: agg.totalMl > 0 ? `${agg.totalMl} ml` : tr('partnerv2_qidalanma', 'Qidalanma') },
  { emoji: agg.sleepOngoing ? '😴' : '🌙', value: agg.sleepMin > 0 ? `${sleepH}s ${sleepM}d` : (agg.sleepOngoing ? tr('partnerv2_yatir', 'Yatır') : '0'), sub: tr('partnerv2_yuxu', 'Yuxu') },
  { emoji: '🧷', value: String(agg.diapers), sub: tr('partnerv2_bez', 'Bez') }];


  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className="w-full a-card text-start"
      whileTap={{ scale: 0.98 }}>

      <div className="flex items-center justify-between mb-2.5">
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--a-ink)' }}>
          {babyName} {tr('partnerv2_bu_gun_lower', 'bu gün')}
          {agg.sleepOngoing && <span className="ms-2" style={{ fontSize: 11, fontWeight: 700, color: 'var(--a-lav-ink)' }}>😴 {tr('partnerv2_indi_yatir', 'indi yatır')}</span>}
        </h3>
        <ChevronRight className="rtl:rotate-180" size={15} style={{ color: 'var(--a-ink-faint)' }} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t) =>
        <div key={t.sub} className="text-center" style={{ background: 'var(--a-surface-soft)', borderRadius: 14, padding: '9px 6px' }}>
            <div style={{ fontSize: 17 }}>{t.emoji}</div>
            <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--a-ink)', marginTop: 1 }}>{t.value}</p>
            <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{t.sub}</p>
          </div>
        )}
      </div>
    </motion.button>);

};

export default PartnerBabyTodayCard;

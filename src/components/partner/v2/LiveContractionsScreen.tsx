import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { getLocaleTag } from '@/lib/i18n';
import { ArrowLeft, HeartPulse, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePartnerData } from '@/hooks/usePartnerData';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { tr } from '@/lib/tr';

/**
 * Canlı sancı görünüşü — partnyor ananın sancı taymerini realtime izləyir.
 * RLS: partnyor daily_logs kimi contractions-a da baxa bilir.
 * 5-1-1 qaydası: interval ≤5 dəq, müddət ≥1 dəq, ≥1 saat davam.
 */

interface ContractionRow {
  id: string;
  start_time: string;
  duration_seconds: number | null;
  interval_seconds: number | null;
}

interface Props {
  onBack: () => void;
}

const LiveContractionsScreen = ({ onBack }: Props) => {
  useScrollToTop();
  const { partnerProfile, sharing } = usePartnerData();
  const [contractions, setContractions] = useState<ContractionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerProfile?.user_id || !sharing.share_contractions) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const fetchContractions = async () => {
      try {
        const from = new Date(Date.now() - 24 * 3600000).toISOString();
        const { data, error } = await supabase.
        from('contractions').
        select('id, start_time, duration_seconds, interval_seconds').
        eq('user_id', partnerProfile.user_id).
        gte('start_time', from).
        order('start_time', { ascending: false }).
        limit(30);

        if (!cancelled && !error) setContractions((data || []) as ContractionRow[]);
      } catch {/* boş */} finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchContractions();

    const channel = supabase.
    channel(`partner-contractions-${partnerProfile.user_id}`).
    on('postgres_changes', { event: '*', schema: 'public', table: 'contractions', filter: `user_id=eq.${partnerProfile.user_id}` }, () => {
      fetchContractions();
    }).
    subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [partnerProfile?.user_id, sharing.share_contractions]);

  // Son 1 saatın statistikası
  const stats = useMemo(() => {
    const hourAgo = Date.now() - 3600000;
    const recent = contractions.filter((c) => new Date(c.start_time).getTime() >= hourAgo);
    if (recent.length === 0) return null;

    const durations = recent.map((c) => c.duration_seconds || 0).filter((d) => d > 0);
    const intervals = recent.map((c) => c.interval_seconds || 0).filter((i) => i > 0);
    const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const avgInterval = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
    const is511 = recent.length >= 3 && avgInterval > 0 && avgInterval <= 300 && avgDuration >= 60;

    return { count: recent.length, avgDuration, avgInterval, is511 };
  }, [contractions]);

  const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' });

  const lastContraction = contractions[0];
  const minutesSinceLast = lastContraction ?
  Math.floor((Date.now() - new Date(lastContraction.start_time).getTime()) / 60000) : null;

  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr('common_geri', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{tr('partnerv2_realtime', 'Realtime')}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr('partnerv2_canli_sancilar', 'Canlı sancılar')}</p>
            </div>
          </div>
        </header>

        {!sharing.share_contractions ?
        <div className="a-card text-center" style={{ padding: '38px 18px' }}>
            <div className="mx-auto mb-4 flex items-center justify-center"
          style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--a-surface-soft)' }}>
              <HeartPulse size={26} style={{ color: 'var(--a-ink-faint)' }} />
            </div>
            <h3 className="a-list-title" style={{ marginBottom: 4 }}>{tr('partnerv2_paylasim_bagli', 'Paylaşım bağlıdır')}</h3>
            <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>
              {tr('partnerv2_sanci_paylasimi_bagli_izah', 'Həyat yoldaşınız sancı paylaşımını hazırda bağlayıb.')}
            </p>
          </div> :
        loading ?
        <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--a-pink-2)', borderTopColor: 'transparent' }} />
          </div> :

        <div className="space-y-3.5">
            {/* 5-1-1 status */}
            {stats?.is511 &&
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-3"
            style={{ background: 'var(--a-alert-bg)', borderRadius: 'var(--a-radius-md)', padding: 16, border: '1.5px solid rgba(177,39,91,0.4)' }}>
                <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1, repeat: Infinity }}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--a-pink-ink)' }}>
                  <AlertTriangle size={20} className="text-white" />
                </motion.div>
                <div>
                  <p style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--a-alert-ink)' }}>{tr('usepartnernotifications_5_1_1_qaydasi_976061', '⚠️ 5-1-1 Qaydası!')}</p>
                  <p style={{ fontSize: 11.5, color: 'var(--a-alert-soft)' }}>
                    {tr('partnerv2_511_izah', 'Sancılar sıxlaşıb — xəstəxanaya hazırlaş!')}
                  </p>
                </div>
              </motion.div>
          }

            {/* Statistika */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="text-center a-card" style={{ padding: '14px 8px' }}>
                <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--a-ink)' }}>{stats?.count || 0}</p>
                <p style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr('partnerv2_son_1_saat', 'son 1 saat')}</p>
              </div>
              <div className="text-center a-card" style={{ padding: '14px 8px' }}>
                <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--a-ink)' }}>{stats ? fmtDur(stats.avgDuration) : '—'}</p>
                <p style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr('partnerv2_orta_muddet', 'orta müddət')}</p>
              </div>
              <div className="text-center a-card" style={{ padding: '14px 8px' }}>
                <p style={{ fontSize: 20, fontWeight: 900, color: 'var(--a-ink)' }}>{stats && stats.avgInterval > 0 ? `${Math.round(stats.avgInterval / 60)}d` : '—'}</p>
                <p style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{tr('partnerv2_orta_interval', 'orta interval')}</p>
              </div>
            </div>

            {/* Son sancı */}
            {minutesSinceLast !== null &&
          <div className="text-center" style={{ background: 'var(--a-pink-1)', borderRadius: 16, padding: '10px 14px' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--a-alert-ink)' }}>
                  {tr('partnerv2_son_sanci', 'Son sancı')}: {minutesSinceLast < 1 ? tr('partnerv2_indice', 'İndicə') : `${minutesSinceLast} ${tr('partnerv2_deq_evvel', 'dəq əvvəl')}`}
                </p>
              </div>
          }

            {/* Siyahı */}
            <div className="a-card">
              <h3 className="a-card-title" style={{ marginBottom: 12 }}>{tr('partnerv2_son_24_saat', 'Son 24 saat')}</h3>
              {contractions.length === 0 ?
            <p className="text-center py-6" style={{ fontSize: 12.5, color: 'var(--a-ink-soft)' }}>
                  {tr('partnerv2_sanci_yoxdur', 'Sancı qeyd olunmayıb — hər şey sakitdir 💚')}
                </p> :

            <div className="space-y-1.5">
                  {contractions.slice(0, 15).map((c, i) =>
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className="flex items-center gap-2.5"
                style={{ padding: '9px 11px', borderRadius: 13, background: i === 0 ? 'var(--a-surface-soft)' : 'transparent' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--a-pink-1)' }}>
                        <HeartPulse size={14} style={{ color: 'var(--a-pink-ink)' }} />
                      </div>
                      <p className="flex-1" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--a-ink)' }}>{fmtTime(c.start_time)}</p>
                      {c.duration_seconds != null && c.duration_seconds > 0 &&
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--a-ink-soft)' }}>{fmtDur(c.duration_seconds)}</span>
                }
                      {c.interval_seconds != null && c.interval_seconds > 0 &&
                <span style={{ fontSize: 10.5, color: 'var(--a-ink-faint)' }}>· {Math.round(c.interval_seconds / 60)}{tr('partnerv2_d_short', 'd')} {tr('partnerv2_interval_short', 'interval')}</span>
                }
                    </motion.div>
              )}
                </div>
            }
            </div>
          </div>
        }
      </div>
    </div>);

};

export default LiveContractionsScreen;

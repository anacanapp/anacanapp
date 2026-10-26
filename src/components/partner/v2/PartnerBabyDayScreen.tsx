import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getLocaleTag } from '@/lib/i18n';
import { ArrowLeft, Baby, Moon, Milk, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePartnerData } from '@/hooks/usePartnerData';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { tr } from '@/lib/tr';

/**
 * "Körpə Günü" — mommy mərhələsində partnyor körpənin bugünkü ritmini görür.
 * RLS: "Partners can view linked baby logs" (mövcuddur).
 */

interface BabyLogRow {
  id: string;
  log_type: string; // feeding | sleep | diaper
  start_time: string;
  end_time: string | null;
  feed_type: string | null;
  diaper_type: string | null;
  amount_ml: number | null;
}

interface Props {
  onBack: () => void;
}

const PartnerBabyDayScreen = ({ onBack }: Props) => {
  useScrollToTop();
  const { partnerProfile, sharing } = usePartnerData();
  const [logs, setLogs] = useState<BabyLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!partnerProfile?.user_id || !sharing.share_baby_logs) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const fetchLogs = async () => {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { data, error } = await supabase.
        from('baby_logs').
        select('id, log_type, start_time, end_time, feed_type, diaper_type, amount_ml').
        eq('user_id', partnerProfile.user_id).
        gte('start_time', startOfDay.toISOString()).
        order('start_time', { ascending: false });

        if (!cancelled && !error) setLogs((data || []) as BabyLogRow[]);
      } catch {/* boş */} finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLogs();

    // Realtime: ana qeyd etdikcə yenilənsin (server-side filtrlənir)
    const channel = supabase.
    channel(`partner-baby-day-${partnerProfile.user_id}`).
    on('postgres_changes', { event: '*', schema: 'public', table: 'baby_logs', filter: `user_id=eq.${partnerProfile.user_id}` }, () => {
      fetchLogs();
    }).
    subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [partnerProfile?.user_id, sharing.share_baby_logs]);

  // ── Aqreqatlar ──
  const feedings = logs.filter((l) => l.log_type === 'feeding');
  const sleeps = logs.filter((l) => l.log_type === 'sleep');
  const diapers = logs.filter((l) => l.log_type === 'diaper');

  const totalMl = feedings.reduce((s, l) => s + (l.amount_ml || 0), 0);
  const totalSleepMin = sleeps.reduce((s, l) => {
    if (!l.end_time) return s;
    return s + Math.max(0, (new Date(l.end_time).getTime() - new Date(l.start_time).getTime()) / 60000);
  }, 0);
  const sleepH = Math.floor(totalSleepMin / 60);
  const sleepM = Math.round(totalSleepMin % 60);

  const babyName = partnerProfile?.baby_name || tr('partnerv2_korpe', 'Körpə');

  const formatTime = (d: string) =>
  new Date(d).toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' });

  const logMeta = (l: BabyLogRow): {icon: any;bg: string;ink: string;label: string;} => {
    if (l.log_type === 'feeding') return {
      icon: Milk, bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)',
      label: `${tr('partnerv2_qidalanma', 'Qidalanma')}${l.amount_ml ? ` · ${l.amount_ml} ml` : ''}`
    };
    if (l.log_type === 'sleep') return {
      icon: Moon, bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)',
      label: l.end_time ?
      `${tr('partnerv2_yuxu', 'Yuxu')} · ${formatTime(l.start_time)}–${formatTime(l.end_time)}` :
      `${tr('partnerv2_yuxu', 'Yuxu')} · ${tr('partnerv2_davam_edir', 'davam edir')} 😴`
    };
    return {
      icon: Baby, bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)',
      label: `${tr('partnerv2_bez_deyisme', 'Bez dəyişmə')}${l.diaper_type ? ` · ${l.diaper_type}` : ''}`
    };
  };

  // Dark mode düzəlişi: 3 hardcoded hex dark modda uyğun --a-*-1 tünd
  // tint-lərinə qarşı demək olar oxunmurdu — CSS dəyişənlərinə keçirilib.
  const stats = [
  { emoji: '🍼', value: String(feedings.length), sub: totalMl > 0 ? `${totalMl} ml` : tr('partnerv2_qidalanma', 'Qidalanma'), bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' },
  { emoji: '😴', value: totalSleepMin > 0 ? `${sleepH}s ${sleepM}d` : String(sleeps.length), sub: tr('partnerv2_yuxu', 'Yuxu'), bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)' },
  { emoji: '🧷', value: String(diapers.length), sub: tr('partnerv2_bez', 'Bez'), bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)' }];


  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr('common_geri', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{babyName}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr('partnerv2_korpe_gunu', 'Körpə Günü')}</p>
            </div>
          </div>
        </header>

        {!sharing.share_baby_logs ?
        <div className="a-card text-center" style={{ padding: '38px 18px' }}>
            <div className="mx-auto mb-4 flex items-center justify-center"
          style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--a-surface-soft)' }}>
              <Baby size={26} style={{ color: 'var(--a-ink-faint)' }} />
            </div>
            <h3 className="a-list-title" style={{ marginBottom: 4 }}>{tr('partnerv2_paylasim_bagli', 'Paylaşım bağlıdır')}</h3>
            <p className="a-list-sub" style={{ whiteSpace: 'normal' }}>
              {tr('partnerv2_korpe_paylasimi_bagli_izah', 'Həyat yoldaşınız körpə qeydlərinin paylaşımını hazırda bağlayıb.')}
            </p>
          </div> :
        loading ?
        <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid var(--a-blue-2)', borderTopColor: 'transparent' }} />
          </div> :

        <div className="space-y-4">
            {/* Günün xülasəsi */}
            <div className="grid grid-cols-3 gap-2.5">
              {stats.map((s) =>
            <motion.div
              key={s.sub}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
              style={{ background: s.bg, borderRadius: 18, padding: '14px 8px' }}>
                  <div style={{ fontSize: 22 }}>{s.emoji}</div>
                  <p style={{ fontSize: 16, fontWeight: 900, color: s.ink, marginTop: 4 }}>{s.value}</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: s.ink, opacity: 0.75 }}>{s.sub}</p>
                </motion.div>
            )}
            </div>

            {/* İpucu */}
            <div className="flex items-start gap-2.5" style={{ background: 'var(--a-disclaimer-bg)', border: '1px solid var(--a-disclaimer-border)', borderRadius: 16, padding: 13 }}>
              <Sparkles size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--a-disclaimer-strong)' }} />
              <p style={{ fontSize: 11.5, color: 'var(--a-disclaimer-ink)', lineHeight: 1.5 }}>
                {tr('partnerv2_korpe_gunu_ipucu', 'Gecə növbəsini öz üzərinə götür — ananın 4 saatlıq fasiləsiz yuxusu qızıl dəyərindədir. 💛')}
              </p>
            </div>

            {/* Bugünkü qeydlər */}
            <div className="a-card">
              <h3 className="a-card-title" style={{ marginBottom: 12 }}>{tr('partnerv2_bugunku_qeydler', 'Bugünkü qeydlər')}</h3>
              {logs.length === 0 ?
            <p className="text-center py-6" style={{ fontSize: 12.5, color: 'var(--a-ink-soft)' }}>
                  {tr('partnerv2_bugun_qeyd_yoxdur', 'Bu gün hələ qeyd yoxdur')}
                </p> :

            <div className="space-y-1.5">
                  {logs.slice(0, 12).map((l, i) => {
                const meta = logMeta(l);
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-2.5"
                    style={{ padding: '8px 10px', borderRadius: 13 }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                          <Icon size={15} style={{ color: meta.ink }} />
                        </div>
                        <p className="flex-1 truncate" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--a-ink)' }}>{meta.label}</p>
                        <span className="shrink-0" style={{ fontSize: 10.5, color: 'var(--a-ink-faint)', fontWeight: 600 }}>{formatTime(l.start_time)}</span>
                      </motion.div>);
              })}
                </div>
            }
            </div>
          </div>
        }
      </div>
    </div>);

};

export default PartnerBabyDayScreen;

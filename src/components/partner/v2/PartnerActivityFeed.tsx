import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity, Baby, Droplets, HeartPulse, Smile, FileText, AlertTriangle, Siren, HandHeart } from 'lucide-react';
import { usePartnerMessages } from '@/hooks/usePartnerMessages';
import { useAuth } from '@/hooks/useAuth';
import { tr } from '@/lib/tr';

/**
 * Aktivlik lenti — ananın canlı hadisələri (partner_messages event tipləri).
 * Realtime yenilənir (usePartnerMessages öz abunəliyi ilə).
 */

const EVENT_TYPES = new Set([
'mood_update', 'kick_session', 'water_goal',
'contraction_started', 'contraction_511',
'daily_summary', 'sos_alert', 'birth_alert', 'thank_you']
);

const EVENT_META: Record<string, {icon: any;bg: string;ink: string;fallbackTitle: string;}> = {
  mood_update: { icon: Smile, bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)', fallbackTitle: tr('partnerv2_ehval_yenilendi', 'Əhval yeniləndi') },
  kick_session: { icon: Baby, bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)', fallbackTitle: tr('partnerv2_korpe_tepik_atdi', 'Körpə təpik atdı') },
  water_goal: { icon: Droplets, bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)', fallbackTitle: tr('partnerv2_su_hedefi', 'Su hədəfinə çatdı') },
  contraction_started: { icon: HeartPulse, bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)', fallbackTitle: tr('partnerv2_sanci_qeyd_edildi', 'Sancı qeyd edildi') },
  contraction_511: { icon: AlertTriangle, bg: 'var(--a-alert-bg)', ink: 'var(--a-alert-ink)', fallbackTitle: tr('partnerv2_511_qaydasi', '5-1-1 Qaydası!') },
  daily_summary: { icon: FileText, bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)', fallbackTitle: tr('partnerv2_gunluk_xulase', 'Günlük xülasə') },
  sos_alert: { icon: Siren, bg: 'var(--a-alert-bg)', ink: 'var(--a-alert-ink)', fallbackTitle: 'SOS' },
  birth_alert: { icon: Siren, bg: 'var(--a-alert-bg)', ink: 'var(--a-alert-ink)', fallbackTitle: tr('partnerv2_dogus_siqnali', 'Doğuş siqnalı!') },
  thank_you: { icon: HandHeart, bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)', fallbackTitle: tr('partnerv2_tesekkur_aldiniz', 'Təşəkkür aldınız') }
};

const timeAgo = (dateStr: string): string => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return tr('partnerv2_indice', 'İndicə');
  if (mins < 60) return `${mins} ${tr('partnerv2_deq', 'dəq')}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${tr('partnerv2_saat', 'saat')}`;
  const days = Math.floor(hours / 24);
  return `${days} ${tr('partnerv2_gun', 'gün')}`;
};

interface FeedItem {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
}

const PartnerActivityFeed = () => {
  const { user } = useAuth();
  const { messages } = usePartnerMessages();

  const items: FeedItem[] = useMemo(() => {
    return (messages || []).
    filter((m: any) => EVENT_TYPES.has(m.message_type) && m.receiver_id === user?.id).
    slice(-8).
    reverse().
    map((m: any) => {
      let title = EVENT_META[m.message_type]?.fallbackTitle || m.message_type;
      let body = '';
      try {
        const parsed = JSON.parse(m.content || '');
        if (parsed?.title) title = parsed.title;
        if (parsed?.body) body = parsed.body;
      } catch {
        if (m.content && typeof m.content === 'string' && m.content.length < 120) body = m.content;
      }
      return { id: m.id, type: m.message_type, title, body, createdAt: m.created_at };
    });
  }, [messages, user?.id]);

  return (
    <div className="a-card">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ borderRadius: 12, background: 'var(--a-blue-1)' }}>
          <Activity size={16} style={{ color: 'var(--a-blue-ink)' }} />
        </div>
        <div>
          <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--a-ink)' }}>{tr('partnerv2_aktivlik_lenti', 'Aktivlik lenti')}</h3>
          <p style={{ fontSize: 11, color: 'var(--a-ink-soft)' }}>{tr('partnerv2_onun_gunu_canli', 'Onun günü — canlı')}</p>
        </div>
      </div>

      {items.length === 0 ?
      <div className="text-center py-6">
          <p style={{ fontSize: 12.5, color: 'var(--a-ink-soft)' }}>
            {tr('partnerv2_hele_aktivlik_yoxdur', 'Bu gün hələ aktivlik yoxdur')}
          </p>
          <p style={{ fontSize: 11, color: 'var(--a-ink-faint)', marginTop: 2 }}>
            {tr('partnerv2_tepik_su_ehval_burada', 'Təpiklər, su və əhval dəyişiklikləri burada görünəcək')}
          </p>
        </div> :

      <div className="space-y-1.5">
          {items.map((item, i) => {
          const meta = EVENT_META[item.type] || EVENT_META.mood_update;
          const Icon = meta.icon;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-2.5"
              style={{ padding: '8px 10px', borderRadius: 13, background: i === 0 ? 'var(--a-surface-soft)' : 'transparent' }}>

                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                  <Icon size={14} style={{ color: meta.ink }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ fontSize: 12, fontWeight: 700, color: 'var(--a-ink)' }}>{item.title}</p>
                  {item.body && <p className="truncate" style={{ fontSize: 10.5, color: 'var(--a-ink-soft)' }}>{item.body}</p>}
                </div>
                <span className="shrink-0" style={{ fontSize: 10, color: 'var(--a-ink-faint)', fontWeight: 600 }}>{timeAgo(item.createdAt)}</span>
              </motion.div>);

        })}
        </div>
      }
    </div>);

};

export default PartnerActivityFeed;

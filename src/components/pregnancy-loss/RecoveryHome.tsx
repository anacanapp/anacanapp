import { motion } from 'framer-motion';
import { ChevronRight, MessageCircleHeart, ClipboardCheck, NotebookPen, Stethoscope, FolderHeart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { useUserStore } from '@/store/userStore';
import { hapticFeedback } from '@/lib/native';
import { LOSS_RECOVERY_WEEKS, lossWeek, usePregnancyLossText } from '@/data/pregnancy-loss';
import ReadyChoices from './ReadyChoices';
import '@/styles/pregnancy-loss.css';

/**
 * Home during pregnancy loss recovery: no pregnancy, fertility or shopping content. A gentle week card,
 * a mood check-in (saved to the daily log, so the partner can see it when she shares her mood), the
 * "see a doctor now" signs, and quiet links to the guide, a body check, AI, mood tests and memories.
 */
interface Props {
  onNavigate?: (screen: string) => void;
  onNavigateToTool?: (tool: string) => void;
  onOpenAssistant?: () => void;
}

const Link = ({ icon: Icon, title, sub, onClick }: { icon: typeof ChevronRight; title: string; sub: string; onClick: () => void }) => (
  <motion.button type="button" className="loss-card flex items-center gap-3 w-full text-start" onClick={onClick} whileTap={{ scale: 0.98 }}>
    <span className="loss-row-icon"><Icon size={17} style={{ color: 'var(--loss-accent-ink)' }} /></span>
    <span className="flex-1 min-w-0">
      <span className="loss-row-title block">{title}</span>
      <span className="loss-row-sub block">{sub}</span>
    </span>
    <ChevronRight size={16} className="rtl:rotate-180 shrink-0" style={{ color: 'var(--a-ink-faint)' }} />
  </motion.button>
);

const MOOD_EMOJI = ['😣', '😔', '😶', '😌', '🙂'];

const RecoveryHome = ({ onNavigate, onNavigateToTool, onOpenAssistant }: Props) => {
  const language = useUserStore((s) => s.language) || 'az';
  const text = usePregnancyLossText(language);
  const { profile } = useAuth();
  const { todayLog, updateMood } = useDailyLogs();
  if (!text) return null;
  const t = text.ui;
  const week = lossWeek(profile?.pregnancy_loss_date);
  const w = text.weeks[(week ?? LOSS_RECOVERY_WEEKS) - 1];
  const mood = todayLog?.mood ?? null;

  const pickMood = async (value: number) => {
    await hapticFeedback.light();
    await updateMood(value);
  };

  return (
    <div className="space-y-3" style={{ marginTop: 4 }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '2px 4px 4px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.25, color: 'var(--a-ink)', letterSpacing: '-0.01em' }}>{t.home_title} 🤍</h1>
      </motion.div>

      <motion.button type="button" className="loss-card w-full text-start" onClick={() => onNavigate?.('loss-guide')}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.99 }}>
        <p className="loss-tag">{week ? t.home_week.replace('{n}', String(week)) : t.home_done}</p>
        <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--a-ink)', margin: '5px 0 9px' }}>{week ? w.title : t.home_done}</h2>
        <div className="loss-bar" aria-hidden><i style={{ width: `${((week ?? LOSS_RECOVERY_WEEKS) / LOSS_RECOVERY_WEEKS) * 100}%` }} /></div>
        <p className="loss-body" style={{ marginTop: 9 }}>{week ? w.body : t.home_done_body}</p>
        <span className="flex items-center gap-1" style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color: 'var(--loss-accent-ink)' }}>
          {t.home_open_week} <ChevronRight size={14} className="rtl:rotate-180" />
        </span>
      </motion.button>

      <section className="loss-card" aria-labelledby="loss-mood-title">
        <h3 id="loss-mood-title" style={{ fontSize: 15, fontWeight: 900, color: 'var(--a-ink)', marginBottom: 10 }}>{t.mood_title}</h3>
        <div className="grid grid-cols-5 gap-1.5">
          {t.moods.map((label, i) => (
            <button key={label} type="button" aria-pressed={mood === i + 1} onClick={() => pickMood(i + 1)} className="flex flex-col items-center gap-1">
              <span className="grid place-items-center" style={{ width: 46, height: 46, borderRadius: 15, fontSize: 22,
                background: mood === i + 1 ? 'var(--loss-accent)' : 'var(--loss-soft)', transition: 'background .2s' }}>{MOOD_EMOJI[i]}</span>
              <span style={{ fontSize: 10.5, fontWeight: mood === i + 1 ? 800 : 600, color: 'var(--a-ink-soft)', textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
            </button>
          ))}
        </div>
        {mood !== null &&
          <motion.p key={mood} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="loss-body"
            style={{ marginTop: 12, background: 'var(--loss-soft)', borderRadius: 14, padding: '10px 12px' }}>
            {t.mood_reply[Math.min(4, Math.max(0, mood - 1))]}
          </motion.p>}
      </section>

      <div className="loss-alert" role="note">
        <b className="block" style={{ fontSize: 13.5, marginBottom: 2 }}>{t.warn_title}</b>{t.warn_body}
      </div>

      <Link icon={ClipboardCheck} title={t.check_title} sub={t.check_sub} onClick={() => onNavigate?.('loss-guide/signs')} />
      {onOpenAssistant && <Link icon={MessageCircleHeart} title={t.talk_title} sub={t.talk_sub} onClick={onOpenAssistant} />}
      <Link icon={Stethoscope} title={t.epds_title} sub={t.epds_sub} onClick={() => onNavigateToTool?.('mental-health')} />
      <Link icon={NotebookPen} title={t.diary_title} sub={t.diary_sub} onClick={() => onNavigateToTool?.('mood-diary')} />
      <Link icon={FolderHeart} title={t.memories_title} sub={t.memories_sub} onClick={() => onNavigate?.('loss-memories')} />

      {!week && <ReadyChoices text={text} onNavigate={onNavigate} />}

      <p style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--a-ink-faint)', textAlign: 'center', padding: '4px 12px' }}>{t.disclaimer}</p>
    </div>
  );
};

export default RecoveryHome;

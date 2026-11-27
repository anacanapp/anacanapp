import { motion } from 'framer-motion';
import { ChevronRight, Heart } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { usePartnerRecentMoods } from '@/hooks/usePartnerRecentMoods';
import { POSTPARTUM_WEEKS, usePostpartumPartnerText } from '@/data/postpartum-partner';

/** Partner home, first 8 weeks after birth: this week's focus and a low-mood nudge. */
interface Props {
  week: number;
  shareMood: boolean;
  onOpen: () => void;
}

const PostpartumCard = ({ week, shareMood, onOpen }: Props) => {
  const language = useUserStore((s) => s.language) || 'az';
  const text = usePostpartumPartnerText(language);
  const { lowDays } = usePartnerRecentMoods(7, shareMood);
  if (!text) return null;
  const w = text.weeks[week - 1];
  return (
    <motion.button type="button" onClick={onOpen} className="a-card w-full text-start" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.99 }} style={{ background: 'var(--a-grad-peach)', padding: 16 }}>
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0" style={{ background: 'var(--a-surface)' }}>💛</span>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--a-accent-ink)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {text.ui.home_card.replace('{n}', String(week))}
          </p>
          <p style={{ fontSize: 15.5, fontWeight: 900, color: 'var(--a-ink)', letterSpacing: '-0.01em' }}>{w.title}</p>
          <p className="truncate" style={{ fontSize: 12, color: 'var(--a-body-text)' }}>{w.do[0]}</p>
        </div>
        <ChevronRight size={18} className="rtl:rotate-180 shrink-0" style={{ color: 'var(--a-accent-ink)' }} />
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--a-chip-overlay)', marginTop: 12 }}>
        <div className="h-full rounded-full" style={{ width: `${(week / POSTPARTUM_WEEKS) * 100}%`, background: 'var(--a-peach-2)' }} />
      </div>
      {lowDays >= 3 &&
        <p className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, color: 'var(--a-pink-ink)', marginTop: 10, background: 'var(--a-surface)', borderRadius: 12, padding: '8px 10px' }}>
          <Heart size={13} className="shrink-0" />{text.ui.mood_low_title}
        </p>}
    </motion.button>
  );
};

export default PostpartumCard;

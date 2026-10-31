import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useUserStore } from '@/store/userStore';
import { lossWeek, usePregnancyLossText } from '@/data/pregnancy-loss';
import '@/styles/pregnancy-loss.css';

/** Partner home: the entry to the loss support guide, shown only when she chose to share it. */
const PartnerLossCard = ({ lossDate, onOpen }: { lossDate: string | null | undefined; onOpen: () => void }) => {
  const language = useUserStore((s) => s.language) || 'az';
  const text = usePregnancyLossText(language);
  if (!text) return null;
  const t = text.ui;
  const week = lossWeek(lossDate);
  return (
    <motion.button type="button" onClick={onOpen} className="loss-scope w-full text-start flex items-center gap-3"
      style={{ background: 'var(--loss-hero)', borderRadius: 'var(--a-radius-md)', padding: 16, boxShadow: '0 14px 30px -18px rgba(120, 90, 170, 0.45)' }}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.99 }}>
      <span className="grid place-items-center shrink-0" style={{ width: 46, height: 46, borderRadius: 16, background: 'rgba(255,255,255,0.7)', fontSize: 22 }} aria-hidden>🤍</span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontSize: 15, fontWeight: 900, color: 'var(--loss-accent-ink)' }}>{t.p_card_title}</span>
        <span className="block" style={{ fontSize: 12, color: 'var(--loss-accent-ink)', opacity: 0.85, marginTop: 2 }}>
          {week ? t.p_card_sub.replace('{n}', String(week)) : t.p_sub}
        </span>
      </span>
      <ChevronRight size={18} className="rtl:rotate-180 shrink-0" style={{ color: 'var(--loss-accent-ink)' }} />
    </motion.button>
  );
};

export default PartnerLossCard;

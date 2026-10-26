import { tr } from "@/lib/tr";
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useFlowInsights } from '@/hooks/useFlowData';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { getPhaseInfoForDate } from '@/lib/cycle-utils';
import { format } from 'date-fns';
import { getTranslatedTip } from '@/lib/tip-translations';

// Deterministic shuffle by seed (date)
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = h * 31 + seed.charCodeAt(i) & 0xffffffff;
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    h = h * 1103515245 + 12345 & 0x7fffffff;
    const j = h % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const PHASE_GRADIENT: Record<string, string> = {
  menstrual: 'from-rose-400 to-red-500',
  follicular: 'from-emerald-400 to-teal-500',
  ovulation: 'from-pink-400 to-fuchsia-500',
  luteal: 'from-indigo-400 to-purple-500'
};

const DailyStoryCards = () => {
  const { lastPeriodDate, cycleLength, periodLength, userId, language } = useUserStore(
    useShallow((s) => ({ lastPeriodDate: s.lastPeriodDate, cycleLength: s.cycleLength, periodLength: s.periodLength, userId: s.userId, language: s.language }))
  );
  const today = new Date();
  const phase = lastPeriodDate ?
  getPhaseInfoForDate(today, new Date(lastPeriodDate), cycleLength || 28, periodLength || 5).phase :
  null;

  const { data: insights = [] } = useFlowInsights(phase);
  const [selected, setSelected] = useState<typeof insights[0] | null>(null);

  const cards = useMemo(() => {
    if (insights.length === 0) return [];
    const seed = `${userId || 'anon'}-${format(today, 'yyyy-MM-dd')}`;
    return seededShuffle(insights, seed).slice(0, 5);
  }, [insights, userId]);

  if (cards.length === 0) return null;

  const getCardTitle = (card: any, lang: string) => {
    if (lang === 'az') return card.title_az || card.title;
    if (lang === 'en') return card.title_en || card.title;
    const localized = card[`title_${lang}`];
    if (localized) return localized;
    const translated = getTranslatedTip(card.title, lang);
    if (translated !== card.title) return translated;
    return getTranslatedTip(card.title_az || card.title, lang);
  };

  const getCardContent = (card: any, lang: string) => {
    if (lang === 'az') return card.content_az || card.content;
    if (lang === 'en') return card.content_en || card.content;
    const localized = card[`content_${lang}`];
    if (localized) return localized;
    const translated = getTranslatedTip(card.content, lang);
    if (translated !== card.content) return translated;
    return getTranslatedTip(card.content_az || card.content, lang);
  };

  return (
    <>
      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="a-section">
        <div className="a-section-head">
          <h2 className="a-section-title a-heading">{tr("dailystorycards_bu_gun_ucun_def36c", "Bu G\xFCn \xDC\xE7\xFCn")}</h2>
          <span className="a-section-link">{format(today, 'd MMM')}</span>
        </div>
        <div className="a-hscroll hide-scrollbar">
          {cards.map((card, idx) => {
            return (
              <motion.button
                key={card.id}
                onClick={() => setSelected(card)}
                whileTap={{ scale: 0.96 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="a-hscroll-card">
                
                <span className="a-list-icon" style={{ background: 'var(--a-grad-pink)', fontSize: 18 }}>
                  {card.emoji || '✨'}
                </span>
                <p className="a-hscroll-title">{getCardTitle(card, language)}</p>
                <p className="a-hscroll-text">{getCardContent(card, language)}</p>
              </motion.button>);

          })}
        </div>
      </motion.section>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
              onClick={() => setSelected(null)}>
              
                <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[80vh] overflow-y-auto">
                
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-4xl">{selected.emoji || '✨'}</div>
                    <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <h2 className="text-xl font-bold text-foreground mb-2">{getCardTitle(selected, language)}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{getCardContent(selected, language)}</p>
                </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>);

};

export default DailyStoryCards;
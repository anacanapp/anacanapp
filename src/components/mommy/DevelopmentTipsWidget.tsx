import { useState } from 'react';
import { tr } from '@/lib/tr';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDevelopmentTips } from '@/hooks/useDevelopmentTips';
import { useChildren } from '@/hooks/useChildren';

/**
 * Development recommendations — redesigned to the anacan-demo teaser card
 * (single tip row + pager dots). Data source (development_tips) unchanged.
 */
const DevelopmentTipsWidget = () => {
  const { selectedChild, getChildAge } = useChildren();
  const childAge = selectedChild ? getChildAge(selectedChild) : null;
  // PREMATURE DƏSTƏYİ: inkişaf tövsiyələri korreksiya olunmuş yaşla seçilir
  // (premature deyilsə correctedMonths xronoloji ilə eynidir).
  const ageInMonths = (childAge?.correctionApplied ? childAge.correctedMonths : childAge?.months) || 0;
  const [currentIndex, setCurrentIndex] = useState(0);

  const getAgeGroup = () => {
    if (ageInMonths < 3) return 'newborn';
    if (ageInMonths < 6) return 'infant';
    return 'older';
  };

  const { data: tips = [], isLoading } = useDevelopmentTips(getAgeGroup());

  const getAgeLabel = () => {
    if (ageInMonths < 1) return tr('developmenttipswidget_newborn', 'Yenidoğan');
    if (ageInMonths < 3) return tr('developmenttipswidget_0_3_mo', '0-3 ay');
    if (ageInMonths < 6) return tr('developmenttipswidget_3_6_mo', '3-6 ay');
    if (ageInMonths < 9) return tr('developmenttipswidget_6_9_mo', '6-9 ay');
    if (ageInMonths < 12) return tr('developmenttipswidget_9_12_mo', '9-12 ay');
    return tr('developmenttipswidget_12_plus_mo', '12+ ay');
  };

  const handleNext = () => {
    if (tips.length > 0) setCurrentIndex((prev) => (prev + 1) % tips.length);
  };

  const handlePrev = () => {
    if (tips.length > 0) setCurrentIndex((prev) => (prev - 1 + tips.length) % tips.length);
  };

  if (isLoading) {
    return (
      <div className="a-card a-fade-in">
        <div style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '2px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
        </div>
      </div>
    );
  }

  if (tips.length === 0) {
    return (
      <div className="a-card a-fade-in">
        <p className="a-list-sub" style={{ whiteSpace: 'normal', textAlign: 'center', padding: '14px 0' }}>
          {tr("developmenttipswidget_bu_yas_qrupu_ucun_tovsiye_yoxdur_3e49db", "Bu yaş qrupu üçün tövsiyə yoxdur")}
        </p>
      </div>
    );
  }

  const currentTip = tips[currentIndex];

  return (
    <div className="a-card a-fade-in">
      {/* Header */}
      <div className="a-card-head">
        <h3 className="a-card-title a-heading">{tr("developmenttipswidget_inkisaf_tovsiyeleri_9f473e", "İnkişaf Tövsiyələri")}</h3>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--a-ink-soft)' }}>{getAgeLabel()}</span>
      </div>

      {/* Current Tip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTip.id}
          className="a-list-row"
          style={{ padding: '2px 0 0', borderTop: 'none' }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
        >
          <span className="a-list-icon" style={{ background: 'var(--a-peach-1)', fontSize: 19 }}>
            {currentTip.emoji}
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="a-list-title">{currentTip.title}</p>
            <p className="a-list-sub" style={{ whiteSpace: 'normal', lineHeight: 1.55 }}>
              {currentTip.content}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation dots & arrows */}
      {tips.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <button
            type="button"
            className="a-icon-btn"
            style={{ width: 30, height: 30 }}
            onClick={handlePrev}
            aria-label={tr("common_previous", "Əvvəlki")}
          >
            <ChevronLeft className="rtl:rotate-180" size={15} />
          </button>
          <div style={{ display: 'flex', gap: 5 }}>
            {tips.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={tr("devtips_tip_n", "Məsləhət {n}").replace('{n}', String(idx + 1))}
                style={{
                  width: idx === currentIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 999,
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: idx === currentIndex ? 'var(--a-peach-2)' : 'var(--a-line-strong)',
                  transition: 'all 150ms ease',
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className="a-icon-btn"
            style={{ width: 30, height: 30 }}
            onClick={handleNext}
            aria-label={tr("common_next", "Növbəti")}
          >
            <ChevronRight className="rtl:rotate-180" size={15} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DevelopmentTipsWidget;

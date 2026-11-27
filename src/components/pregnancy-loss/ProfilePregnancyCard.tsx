import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import BirthOnboardingModal from '@/components/BirthOnboardingModal';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { usePregnancyLossText } from '@/data/pregnancy-loss';
import PregnancyLossSheet from './PregnancyLossSheet';
import '@/styles/pregnancy-loss.css';

/**
 * Profile → "Hamiləliyim": pregnancy dates, "Körpəm doğuldu" and the calm "Hamiləliyim davam etmir" entry.
 * During loss recovery the same card links the recovery guide and the memories instead.
 */
const Row = ({ icon, tint, title, sub, onClick }: { icon: string; tint: string; title: string; sub: string; onClick: () => void }) => (
  <button type="button" className="loss-row" onClick={onClick}>
    <span className="loss-row-icon" style={{ background: tint }} aria-hidden>{icon}</span>
    <span className="flex-1 min-w-0">
      <span className="loss-row-title block">{title}</span>
      <span className="loss-row-sub block">{sub}</span>
    </span>
    <ChevronRight size={16} className="rtl:rotate-180 shrink-0" style={{ color: 'var(--a-ink-faint)' }} />
  </button>
);

const ProfilePregnancyCard = ({ onNavigate }: { onNavigate?: (screen: string) => void }) => {
  const { lifeStage, language } = useUserStore(useShallow((s) => ({ lifeStage: s.lifeStage, language: s.language || 'az' })));
  const { profile } = useAuth();
  const text = usePregnancyLossText(language);
  const [birthOpen, setBirthOpen] = useState(false);
  const [lossOpen, setLossOpen] = useState(false);
  const recovering = lifeStage === 'flow' && !!profile?.loss_recovery_active;
  if (!text || (lifeStage !== 'bump' && !recovering)) return null;
  const t = text.ui;

  return (
    <motion.div className="a-card a-fade-in loss-scope" style={{ marginTop: 12, padding: '10px 16px' }}
      initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.26 }}>
      <h3 className="a-card-title a-heading" style={{ margin: '6px 0 2px' }}>{recovering ? t.guide_title : t.section_title}</h3>
      {recovering ?
        <>
          <Row icon="🌿" tint="var(--loss-soft)" title={t.guide_title} sub={t.guide_sub} onClick={() => onNavigate?.('loss-guide')} />
          <Row icon="🤍" tint="var(--loss-soft)" title={t.memories_title} sub={t.memories_sub} onClick={() => onNavigate?.('loss-memories')} />
        </> :
        <>
          <Row icon="📅" tint="var(--a-peach-1)" title={t.dates_row} sub={t.dates_sub} onClick={() => onNavigate?.('edit-profile')} />
          <Row icon="👶" tint="var(--a-green-1)" title={t.birth_row} sub={t.birth_sub} onClick={() => setBirthOpen(true)} />
          <Row icon="🤍" tint="var(--loss-soft)" title={t.entry_title} sub={t.entry_sub} onClick={() => setLossOpen(true)} />
          <p style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--a-ink-soft)', padding: '8px 2px 6px' }}>{t.entry_note}</p>
        </>}
      <BirthOnboardingModal isOpen={birthOpen} onClose={() => setBirthOpen(false)}
        onComplete={() => { setBirthOpen(false); window.location.reload(); }} />
      <PregnancyLossSheet open={lossOpen} onClose={() => setLossOpen(false)}
        onDone={() => { setLossOpen(false); onNavigate?.('home'); }} />
    </motion.div>
  );
};

export default ProfilePregnancyCard;

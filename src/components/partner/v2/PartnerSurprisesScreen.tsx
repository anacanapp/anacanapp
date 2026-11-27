import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import SurpriseTab from '@/components/partner/SurpriseTab';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { tr } from '@/lib/tr';

/** Sürpriz planlayıcı — tam ekran sarğı. */
const PartnerSurprisesScreen = ({ onBack }: {onBack: () => void;}) => {
  useScrollToTop();
  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr('common_geri', 'Geri')}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{tr('partnerv2_onu_sevindir', 'Onu sevindir')}</p>
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr('syncedfeaturesgrid_surpriz_planla_d495ce', 'Sürpriz Planla')}</p>
            </div>
          </div>
        </header>
        <SurpriseTab />
      </div>
    </div>);

};

export default PartnerSurprisesScreen;

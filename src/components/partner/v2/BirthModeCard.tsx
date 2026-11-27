import { motion } from 'framer-motion';
import { Timer, Car, Package, ClipboardList } from 'lucide-react';
import { feature37Text } from '@/lib/feature37-i18n';

/** Shown on the partner home from week 36: everything for the birth in one tap. */
interface Props {
  daysUntilDue: number;
  onNavigate: (screen: string) => void;
}

const BirthModeCard = ({ daysUntilDue, onNavigate }: Props) => {
  const actions = [
    { screen: 'live-contractions', icon: Timer, label: feature37Text('pm_birth_contractions') },
    { screen: 'hospital-run', icon: Car, label: feature37Text('pm_birth_hospital') },
    { screen: 'partner-hospital-bag', icon: Package, label: feature37Text('pm_birth_bag') },
    { screen: 'birth-plan', icon: ClipboardList, label: feature37Text('pm_birth_plan') },
  ];
  return (
    <motion.section
      className="a-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ background: 'var(--a-alert-bg)', border: '1.5px solid var(--a-peach-2)' }}
      aria-label={feature37Text('pm_birth_title')}>
      <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
        <span className="a-pulse-dot" aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: 'var(--a-peach-2)', display: 'inline-block' }} />
        <h2 style={{ fontSize: 16, fontWeight: 900, color: 'var(--a-alert-ink)', letterSpacing: '-0.01em' }}>{feature37Text('pm_birth_title')}</h2>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--a-alert-soft)', marginBottom: 12 }}>
        {daysUntilDue > 0 ? feature37Text('pm_birth_sub').replace('{n}', String(daysUntilDue)) : feature37Text('pm_birth_sub_due')}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {actions.map(({ screen, icon: Icon, label }) => (
          <motion.button
            key={screen}
            type="button"
            onClick={() => onNavigate(screen)}
            className="flex flex-col items-center gap-1.5 text-center"
            style={{ background: 'var(--a-surface)', borderRadius: 16, padding: '10px 4px' }}
            whileTap={{ scale: 0.95 }}>
            <span className="w-9 h-9 flex items-center justify-center" style={{ borderRadius: 12, background: 'var(--a-peach-1)' }}>
              <Icon size={17} style={{ color: 'var(--a-accent-ink)' }} />
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--a-ink)', lineHeight: 1.2 }}>{label}</span>
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
};

export default BirthModeCard;

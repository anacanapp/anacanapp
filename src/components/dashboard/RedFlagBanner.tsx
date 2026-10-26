import { motion } from 'framer-motion';
import { HeartPulse, ChevronRight } from 'lucide-react';
import { useBloodPressureLogs } from '@/hooks/useBloodPressure';
import { classifyBp } from '@/lib/bloodPressure';
import { useUserStore } from '@/store/userStore';
import { tr } from '@/lib/tr';

/**
 * Avtomatik qırmızı bayraq banneri — bump dashboard.
 * Bu günkü son qan təzyiqi ölçməsi ≥140/90 olduqda görünür.
 */

interface Props {
  onOpenTool?: (toolId: string) => void;
}

const RedFlagBanner = ({ onOpenTool }: Props) => {
  const lifeStage = useUserStore((s) => s.lifeStage);
  const { data: logs = [] } = useBloodPressureLogs();

  const latest = logs[0];
  if (!latest) return null;

  // Yalnız bu günkü ölçmə
  const isToday = new Date(latest.measured_at).toDateString() === new Date().toDateString();
  if (!isToday) return null;

  const assessment = classifyBp(latest.systolic, latest.diastolic, lifeStage === 'bump');
  const isUrgent = assessment.category === 'crisis' || assessment.pregnancyAlert === 'urgent';
  const isWarning = assessment.pregnancyAlert === 'warning' || assessment.category === 'stage2';

  if (!isUrgent && !isWarning) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onOpenTool?.('blood-pressure')}
      className="w-full flex items-center gap-3 text-start mb-3"
      style={{
        background: 'var(--a-alert-bg)',
        borderRadius: 'var(--a-radius-md)',
        padding: 14,
        border: '1.5px solid rgba(177, 39, 91, 0.35)'
      }}
      whileTap={{ scale: 0.98 }}>

      <motion.div
        animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 1.4, repeat: 2 }}
        className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
        style={{ background: isUrgent ? 'var(--a-pink-ink)' : 'var(--a-chip-overlay)' }}>
        <HeartPulse size={19} style={{ color: isUrgent ? '#ffffff' : 'var(--a-alert-ink)' }} />
      </motion.div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--a-alert-ink)' }}>
          {isUrgent ?
          tr('rfb_urgent_title', 'Təzyiq təhlükəli səviyyədədir!') :
          tr('rfb_warning_title', 'Təzyiqiniz yüksəkdir')}
          {' '}({latest.systolic}/{latest.diastolic})
        </p>
        <p style={{ fontSize: 11.5, color: 'var(--a-alert-soft)', marginTop: 1 }}>
          {isUrgent ?
          tr('rfb_urgent_sub', 'Dərhal həkimə müraciət edin — ətraflı üçün toxunun') :
          tr('rfb_warning_sub', 'Preeklampsiya riski — bu gün həkiminizlə danışın')}
        </p>
      </div>
      <ChevronRight size={16} className="rtl:rotate-180 shrink-0" style={{ color: 'var(--a-alert-ink)' }} />
    </motion.button>);

};

export default RedFlagBanner;

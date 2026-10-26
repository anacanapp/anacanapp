import { useState, useEffect, useRef, forwardRef } from 'react';
import { tr } from '@/lib/tr';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, AlertCircle, Trash2 } from 'lucide-react';
import { useContractions } from '@/hooks/useContractions';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { hapticFeedback } from '@/lib/native';
import { formatDateAz, formatTimeAz } from '@/lib/date-utils';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { useIsRtl, rtlX } from '@/lib/rtl';

interface ContractionTimerProps {
  onBack: () => void;
}

const ContractionTimer = forwardRef<HTMLDivElement, ContractionTimerProps>(({ onBack }, ref) => {
  useScrollToTop();
  const isRtl = useIsRtl();
  useScreenAnalytics('ContractionTimer', 'Tools');

  const [isActive, setIsActive] = useState(false);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [lastEndTime, setLastEndTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { contractions, addContraction, getStats, clearAll, loading } = useContractions();

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setCurrentDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    await hapticFeedback.medium();
    setIsActive(true);
    setCurrentDuration(0);
  };

  const handleStop = async () => {
    await hapticFeedback.heavy();
    setIsActive(false);
    const now = new Date();

    const interval = lastEndTime ?
    Math.floor((now.getTime() - lastEndTime.getTime()) / 1000 - currentDuration) :
    undefined;

    await addContraction(currentDuration, interval);
    setLastEndTime(now);
    setCurrentDuration(0);
  };

  const stats = getStats();

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={tr("contractiontimer_5_1_1_qaydasi_a3c5d3", "5-1-1 Qaydas\u0131")}
        title={tr("contractiontimer_sanci_olcen_67d681", "Sancı Ölçən")}
        actions={contractions.length > 0 &&
        <motion.button
          onClick={clearAll}
          className="a-icon-btn"
          style={{ background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)', border: 'none' }}
          whileTap={{ scale: 0.9 }}>
          
            <Trash2 size={15} strokeWidth={2} />
          </motion.button>
        } />

      {/* 5-1-1 Alert */}
      <AnimatePresence>
        {stats.is511 &&
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="a-alert-card mb-3">
          
            <span className="a-alert-eyebrow">
              <AlertCircle size={13} strokeWidth={2.3} /> {tr("contractiontimer_xestexanaya_getme_vaxti_780dba", "Xəstəxanaya getmə vaxtı!")}
            </span>
            <p className="a-alert-text" style={{ marginBottom: 0 }}>
              {tr("contractiontimer_5_1_1_qaydasi_sancilar_5_deqiqeden_bir_1_c1c5ce", "5-1-1 qaydası: Sancılar 5 dəqiqədən bir, 1 dəqiqə davam edir")}
            </p>
          </motion.div>
        }
      </AnimatePresence>

      {/* Main Timer Card */}
      <motion.div
        className="a-card a-fade-in"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}>
        
        {/* Timer Display */}
        <div className="text-center mb-4">
          <p className="a-today-info-eyebrow" style={{ marginBottom: 2 }}>
            {isActive ? tr("contractiontimer_sanci_muddeti_0d04f4", "Sanc\u0131 m\xFCdd\u0259ti") : tr("contractiontimer_hazir_3ae38e", "Haz\u0131r")}
          </p>
          <motion.p
            className="font-mono a-heading"
            style={{ margin: 0, fontSize: 44, fontWeight: 800, color: isActive ? 'var(--a-peach-2)' : 'var(--a-ink)' }}
            animate={isActive ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}>
            
            {formatTime(currentDuration)}
          </motion.p>
        </div>

        {/* Control Button */}
        {!isActive ?
        <motion.button
          onClick={handleStart}
          className="a-cta-btn w-full"
          style={{ justifyContent: 'center', height: 48 }}
          whileTap={{ scale: 0.98 }}>
          
            <Play size={15} strokeWidth={2.2} />
            {tr("contractiontimer_sanci_basladi_d99102", "Sanc\u0131 ba\u015Flad\u0131")}
          </motion.button> :

        <motion.button
          onClick={handleStop}
          className="a-cta-btn w-full"
          style={{ justifyContent: 'center', height: 48, background: 'var(--a-pink-2)' }}
          whileTap={{ scale: 0.98 }}
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 0.5, repeat: 3 }}>
          
            <Square size={15} strokeWidth={2.2} />
            {tr("contractiontimer_sanci_bitdi_c1b3e1", "Sanc\u0131 bitdi")}
          </motion.button>
        }
      </motion.div>

      {/* Stats */}
      <div className="a-grid-2" style={{ marginTop: 12 }}>
        <motion.div
          className="a-stat-tile"
          style={{ background: 'var(--a-blue-1)' }}
          initial={{ x: rtlX(-20, isRtl), opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}>
          
          <div>
            <p className="a-stat-tile-label" style={{ color: 'var(--a-blue-ink)' }}>{tr("contractiontimer_ort_muddet_b77c4e", "Ort. Müddət")}</p>
            <p className="a-stat-tile-value">{formatTime(stats.avgDuration)}</p>
            <p className="a-stat-tile-label">{tr("contractiontimer_hedef_1_deq_6ce02e", "Hədəf: ~1 dəq")}</p>
          </div>
        </motion.div>

        <motion.div
          className="a-stat-tile"
          style={{ background: 'var(--a-lav-1)' }}
          initial={{ x: rtlX(20, isRtl), opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}>
          
          <div>
            <p className="a-stat-tile-label" style={{ color: 'var(--a-lav-ink)' }}>{tr("contractiontimer_ort_araliq_711af3", "Ort. Aralıq")}</p>
            <p className="a-stat-tile-value">{formatTime(stats.avgInterval)}</p>
            <p className="a-stat-tile-label">{tr("contractiontimer_hedef_5_deq_b2dc81", "Hədəf: ~5 dəq")}</p>
          </div>
        </motion.div>
      </div>

      {/* 5-1-1 Rule Info */}
      <motion.div
        className="a-today-info-tip"
        style={{ marginTop: 12 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}>
        
        <span style={{ fontSize: 15, lineHeight: 1 }}>💡</span>
        <span>
          <strong>{tr("contractiontimer_5_1_1_qaydasi_a3c5d3", "5-1-1 Qaydas\u0131")}:</strong> {tr("contractiontimer_sancilar_9b16c7", "Sancılar")} <strong>{tr("contractiontimer_5_deqiqe_ad05bb", "5 dəqiqə")}</strong> {tr("contractiontimer_araliginda_24710a", "aralığında,")} <strong>{tr("contractiontimer_1_deqiqe_a187ac", "1 dəqiqə")}</strong> {tr("contractiontimer_davam_ederse_ve_bu_7029f5", "davam edərsə və bu")} <strong>{tr("contractiontimer_1_saat_hardcoded", "1 saat")}</strong> {tr("contractiontimer_boyunca_davam_ederse_xestexana_2b067a", "boyunca davam edərsə, xəstəxanaya getmə vaxtıdır.")}
        </span>
      </motion.div>

      {/* Contractions List */}
      {contractions.length > 0 &&
      <section className="a-section pb-6">
          <div className="a-section-head">
            <h2 className="a-section-title a-heading" style={{ fontSize: 15 }}>{tr("contractiontimer_sancilar_6f1b69", "Sanc\u0131lar (")}{contractions.length})</h2>
          </div>
          <div className="a-list-card">
            {contractions.slice(0, 10).map((contraction, index) =>
          <motion.div
            key={contraction.id}
            initial={{ opacity: 0, x: rtlX(-20, isRtl) }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index * 0.05, 0.3) }}
            className="a-list-row">
            
                <span className="a-list-icon" style={{ background: 'var(--a-surface-soft)', fontSize: 12, fontWeight: 800, color: 'var(--a-ink-soft)' }}>
                  #{contractions.length - index}
                </span>
                <div>
                  <p className="a-list-title">{formatTime(contraction.duration_seconds)} {tr("contractiontimer_muddet_a5b45d", "m\xFCdd\u0259t")}</p>
                  <p className="a-list-sub">
                    {formatDateAz(contraction.start_time)}, {formatTimeAz(contraction.start_time)}
                  </p>
                </div>
                {contraction.interval_seconds &&
            <span className="a-list-trail">
                    <p className="a-list-value font-mono">{formatTime(contraction.interval_seconds)}</p>
                    <p className="a-list-time">{tr("contractiontimer_araliq_05bea1", "aralıq")}</p>
                  </span>
            }
              </motion.div>
          )}
          </div>
        </section>
      }
    </ToolPage>);

});

ContractionTimer.displayName = 'ContractionTimer';

export default ContractionTimer;
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Baby, Volume2, Square, Clock, X, VolumeX } from 'lucide-react';
import { useTimerStore, type TimerType } from '@/store/timerStore';
import { useWhiteNoiseStore } from '@/store/whiteNoiseStore';
import { useBabyLogs } from '@/hooks/useBabyLogs';
import { tr } from "@/lib/tr";
import { useIsRtl, rtlX } from '@/lib/rtl';

const timerConfig: Record<TimerType, {icon: typeof Moon;color: string;label: string;}> = {
  sleep: { icon: Moon, color: 'text-indigo-500', label: tr("common_yuxu", 'Yuxu') },
  feeding: { icon: Baby, color: 'text-rose-500', label: tr("floatingtimerwidget_emizdirme_20d46a", 'Əmizdirmə') },
  diaper: { icon: Clock, color: 'text-amber-500', label: tr("common_bez", 'Bez') },
  'white-noise': { icon: Volume2, color: 'text-emerald-500', label: tr("floatingtimerwidget_kuy_sesi_7b0cd5", 'Küy Səsi') }
};

const formatTime = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor(totalSeconds % 3600 / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Saniyəlik tick yalnız bu kiçik etiketi yenidən render edir (bütün widget-i yox)
const ElapsedLabel = ({ timerId, getElapsedSeconds, className }: {
  timerId: string; getElapsedSeconds: (id: string) => number; className: string;
}) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  return <span className={className}>{formatTime(getElapsedSeconds(timerId))}</span>;
};

const FloatingTimerWidget = () => {
  const isRtl = useIsRtl();
  const { activeTimers, stopTimer, getElapsedSeconds } = useTimerStore();
  const whiteNoise = useWhiteNoiseStore();
  const { addLog } = useBabyLogs();
  const [expanded, setExpanded] = useState(false);

  const hasTimers = activeTimers.length > 0;
  const hasWhiteNoise = whiteNoise.isPlaying;
  const hasAnything = hasTimers || hasWhiteNoise;

  // Dayandırılan yuxu/əmizdirmə sessiyasını baby_logs-a yaz
  const saveTimerLog = useCallback(async (opts: {
    type: string; feedType?: 'left' | 'right' | null; startTime: number; endTime: number;
    childId?: string;
  }) => {
    if (opts.type !== 'sleep' && opts.type !== 'feeding') return;
    if (opts.endTime - opts.startTime < 3000) return; // <3s — təsadüfi toxunuş
    await addLog({
      log_type: opts.type as 'sleep' | 'feeding',
      feed_type: opts.type === 'feeding' && opts.feedType
        ? (opts.feedType === 'left' ? 'breast_left' : 'breast_right')
        : undefined,
      start_time: new Date(opts.startTime).toISOString(),
      end_time: new Date(opts.endTime).toISOString(),
      // Taymer hansı uşaq üçün başladılıbsa, qeyd də ona yazılsın (əkizlər)
      ...(opts.childId ? { child_id: opts.childId } : {}),
    } as any);
  }, [addLog]);

  // Panel düyməsindən dayandırma — artıq sessiyanı da saxlayır (əvvəl itirdi!)
  const handleStop = useCallback(async (timerId: string) => {
    const timer = activeTimers.find((t) => t.id === timerId);
    const result = stopTimer(timerId);
    if (timer && result) {
      await saveTimerLog({
        type: timer.type,
        feedType: timer.feedType,
        startTime: Date.now() - result.durationSeconds * 1000,
        endTime: Date.now(),
        childId: timer.childId,
      });
    }
  }, [activeTimers, stopTimer, saveTimerLog]);

  // QEYD: kilid ekranı widget-indən / bildirişdən dayandırılanların emalı
  // buradan usePendingTimerStops hook-una (Index səviyyəsi, HƏMİŞƏ mounted)
  // köçürüldü — bu komponent şərti render olunur və ilk render-də uşaq
  // siyahısı yüklənmədiyi üçün qeydlər child_id=NULL ilə itirdi.

  useEffect(() => {
    if (!hasAnything) setExpanded(false);
  }, [hasAnything]);

  if (!hasAnything) return null;

  const primaryTimer = activeTimers[0];
  const config = primaryTimer ? timerConfig[primaryTimer.type] || timerConfig.sleep : null;
  const PrimaryIcon = config?.icon || Volume2;
  const primaryColor = config?.color || 'text-emerald-500';

  return (
    <AnimatePresence mode="wait">
      {!expanded ?
      <motion.button
        key="mini"
        data-ad-block="true"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        onClick={() => setExpanded(true)}
        whileTap={{ scale: 0.9 }}
        className="fixed end-3 z-[55] flex items-center gap-1.5 rounded-full shadow-lg border border-border/60 bg-card px-2.5 py-1.5"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.75rem)' }}>
        
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 ring-2 ring-green-500/30" />
          {hasWhiteNoise && !primaryTimer ?
        <>
              <span className="text-sm">{whiteNoise.soundEmoji || '🔊'}</span>
              <span className="text-[11px] font-semibold text-foreground truncate max-w-[60px]">
                {whiteNoise.soundName || tr("floatingtimerwidget_kuy_a91589", "K\xFCy")}
              </span>
            </> :
        primaryTimer ?
        <>
              <PrimaryIcon className={`w-3.5 h-3.5 ${primaryColor}`} />
              <ElapsedLabel
            timerId={primaryTimer.id}
            getElapsedSeconds={getElapsedSeconds}
            className="text-[11px] font-mono font-bold text-foreground tabular-nums" />
            </> :
        null}
          {activeTimers.length + (hasWhiteNoise ? 1 : 0) > 1 &&
        <span className="text-[9px] font-semibold text-muted-foreground bg-muted rounded-full w-4 h-4 flex items-center justify-center">
              {activeTimers.length + (hasWhiteNoise ? 1 : 0)}
            </span>
        }
        </motion.button> :

      <motion.div
        key="panel"
        data-ad-block="true"
        initial={{ x: rtlX(60, isRtl), opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: rtlX(60, isRtl), opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
        className="fixed end-3 z-[55] w-52"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.75rem)' }}>
        
          <div className="bg-card rounded-2xl shadow-lg border border-border/60 overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{tr("untranslated_taymer_uen6sv", "Taymer")}</span>
              <button
              onClick={() => setExpanded(false)}
              className="w-5 h-5 rounded-full bg-muted/60 flex items-center justify-center">
              
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            </div>
            <div className="px-2 pb-2 space-y-1">
              {/* White noise entry */}
              {hasWhiteNoise &&
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-2.5 py-1.5">
                  <span className="text-sm shrink-0">{whiteNoise.soundEmoji || '🔊'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground truncate leading-tight">
                      {whiteNoise.soundName || tr("floatingtimerwidget_kuy_sesi_7b0cd5", "K\xFCy S\u0259si")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{tr("floatingtimerwidget_oynayir_2c8aa6", "Oynayır")}</p>
                  </div>
                  <motion.button
                onClick={() => whiteNoise.toggleMute()}
                whileTap={{ scale: 0.85 }}
                className="w-6 h-6 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
                
                    {whiteNoise.isMuted ?
                <VolumeX className="w-2.5 h-2.5 text-muted-foreground" /> :
                <Volume2 className="w-2.5 h-2.5 text-emerald-600" />
                }
                  </motion.button>
                  <motion.button
                onClick={() => whiteNoise.stop()}
                whileTap={{ scale: 0.85 }}
                className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                
                    <Square className="w-2.5 h-2.5 text-destructive fill-destructive" />
                  </motion.button>
                </div>
            }
              {/* Timer entries */}
              {activeTimers.map((timer) => {
              const tc = timerConfig[timer.type] || timerConfig.sleep;
              const Icon = tc.icon;
              return (
                <div key={timer.id} className="flex items-center gap-2 rounded-xl bg-muted/40 px-2.5 py-1.5">
                    <Icon className={`w-3.5 h-3.5 ${tc.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate leading-tight">
                        {timer.childName ? `${timer.childName} — ` : ''}
                        {timer.label || tc.label}
                        {timer.feedType ? ` (${timer.feedType === 'left' ? tr("dashboard_sol", 'Sol') : tr("floatingtimerwidget_sag_edbe12", "Sağ")})` : ''}
                      </p>
                      <ElapsedLabel
                    timerId={timer.id}
                    getElapsedSeconds={getElapsedSeconds}
                    className="block text-xs font-mono font-bold text-foreground tabular-nums" />
                    </div>
                    <motion.button
                    onClick={() => handleStop(timer.id)}
                    whileTap={{ scale: 0.85 }}
                    className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    
                      <Square className="w-2.5 h-2.5 text-destructive fill-destructive" />
                    </motion.button>
                  </div>);

            })}
            </div>
          </div>
        </motion.div>
      }
    </AnimatePresence>);

};

export default FloatingTimerWidget;

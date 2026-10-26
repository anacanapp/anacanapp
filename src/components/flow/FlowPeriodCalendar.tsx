import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Droplets } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isAfter, parseISO } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { usePeriodDayLogs, useRecordPeriodDays } from '@/hooks/usePeriodDayLogs';
import { hasPeriodFlow, periodFlowLabel, type PeriodFlowAction } from '@/lib/period-flow';
import { getPhaseInfoForDate } from '@/lib/cycle-utils';
import { toast } from 'sonner';
import { tr } from "@/lib/tr";

const flowOptions = () => [
{ key: 'unspecified', label: tr('flow_had_flow', 'Axın oldu'), emoji: '🩸', color: 'bg-red-100 dark:bg-red-900/30' },
{ key: 'light', label: tr("flowperiodcalendar_yungul_2a8010", 'Yüngül'), emoji: '💧', color: 'bg-red-200 dark:bg-red-900/30' },
{ key: 'medium', label: tr("common_orta", 'Orta'), emoji: '💧💧', color: 'bg-red-300 dark:bg-red-800/40' },
{ key: 'heavy', label: tr("flowperiodcalendar_guclu_0fda31", 'Güclü'), emoji: '💧💧💧', color: 'bg-red-400 dark:bg-red-700/50' },
{ key: 'none', label: tr('flow_no_flow', 'Axın olmadı'), emoji: '⚪', color: 'bg-slate-100 dark:bg-slate-800' },
{ key: 'spotting', label: tr('flowdailylogger_lekelenme_8e7b1e', 'Ləkələnmə'), emoji: '🔵', color: 'bg-blue-100 dark:bg-blue-900/30' }];


const FlowPeriodCalendar = ({ trackingOnly = false, fromDate }: { trackingOnly?: boolean; fromDate?: string | null } = {}) => {
  const { cycleLength, periodLength, getCycleData } = useUserStore(
    useShallow((s) => ({ cycleLength: s.cycleLength, periodLength: s.periodLength, getCycleData: s.getCycleData }))
  );
  const cycleData = getCycleData();
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showFlowPicker, setShowFlowPicker] = useState(false);

  const { data: periodLogs = [] } = usePeriodDayLogs();
  const recordMutation = useRecordPeriodDays();
  const selectedLog = selectedDate ? periodLogs.find(log => log.log_date === format(selectedDate, 'yyyy-MM-dd')) : undefined;
  const todayLog = periodLogs.find(log => log.log_date === format(new Date(), 'yyyy-MM-dd'));
  const todayHasFlow = !!todayLog && hasPeriodFlow(todayLog.flow_intensity);

  const lastPeriodDate = cycleData?.lastPeriodDate ?
  (typeof cycleData.lastPeriodDate === 'string' ? parseISO(cycleData.lastPeriodDate) : new Date(cycleData.lastPeriodDate)) :
  new Date();

  // Set of logged period day strings for fast lookup
  const loggedPeriodDays = useMemo(() => {
    const set = new Set<string>();
    periodLogs.filter(log => hasPeriodFlow(log.flow_intensity)).forEach((log) => set.add(log.log_date));
    return set;
  }, [periodLogs]);

  // Get flow intensity for a date
  const getFlowIntensity = (dateStr: string) => {
    return periodLogs.find((l) => l.log_date === dateStr)?.flow_intensity || null;
  };

  const calendarDays = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  const getDayInfo = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const isLogged = loggedPeriodDays.has(dateStr);
    const phaseInfo = getPhaseInfoForDate(date, lastPeriodDate, cycleLength, periodLength);
    const record = periodLogs.find(log => log.log_date === dateStr);
    const isPredictedPeriod = !trackingOnly && !record && phaseInfo.isPeriodDay;
    const isFutureDate = isAfter(date, new Date());

    return {
      dateStr,
      isLogged,
      isPredictedPeriod,
      isFertile: !trackingOnly && phaseInfo.isFertileDay && !isLogged,
      isOvulation: !trackingOnly && phaseInfo.isOvulationDay && !isLogged,
      flowIntensity: getFlowIntensity(dateStr),
      isSpotting: record?.flow_intensity === 'spotting',
      isFutureDate
    };
  };

  const handleDayTap = (date: Date) => {
    if (isAfter(date, new Date()) || fromDate && format(date, 'yyyy-MM-dd') < fromDate) return;
    setSelectedDate(date);
    setShowFlowPicker(true);
  };

  const handleFlowSelect = (intensity: PeriodFlowAction) => {
    if (!selectedDate) return;
    recordMutation.mutate({ dates: [selectedDate], flow: intensity }, {
      onSuccess: () => {
        toast.success(intensity === 'clear' ? tr('flowperiodcalendar_period_gunu_silindi_c4a18f', 'Period günü silindi') : tr('flow_day_saved', 'Günün qeydi saxlanıldı'), {
          description: format(selectedDate, 'd MMMM', { locale: getCurrentDateLocale() })
        });
        setShowFlowPicker(false);
        setSelectedDate(null);
      },
      onError: () => toast.error(tr('flow_save_failed', 'Qeyd saxlanılmadı. Yenidən cəhd edin.')),
    });
  };

  const getFlowDotColor = (intensity: string | null) => {
    switch (intensity) {
      case 'light':return 'bg-red-300';
      case 'heavy':return 'bg-red-600';
      default:return 'bg-red-400';
    }
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="a-card a-fade-in">
      
      {/* Header */}
      <div className="a-card-head">
        <h3 className="a-card-title a-heading">{tr("flowperiodcalendar_period_teqvimi_d04269", "Period T\u0259qvimi")}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
            className="a-icon-btn"
            style={{ width: 28, height: 28 }}>
            
            <ChevronLeft className="rtl:rotate-180" size={14} />
          </button>
          <span className="a-section-link" style={{ minWidth: 100, justifyContent: 'center', color: 'var(--a-ink)' }}>
            {format(calendarMonth, 'MMMM yyyy', { locale: getCurrentDateLocale() })}
          </span>
          <button
            onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
            className="a-icon-btn"
            style={{ width: 28, height: 28 }}>
            
            <ChevronRight className="rtl:rotate-180" size={14} />
          </button>
        </div>
      </div>

      {/* Instruction */}
      <p className="a-list-sub" style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Droplets size={13} />
        {tr("flowperiodcalendar_gune_toxunaraq_period_gunlerin_3b5f8a", "G\xFCn\u0259 toxunaraq period g\xFCnl\u0259rini qeyd edin")}
      </p>

      <button
        type="button"
        className="w-full rounded-xl py-3 mb-3 text-sm font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
        disabled={recordMutation.isPending}
        onClick={() => {
          if (todayHasFlow) { handleDayTap(new Date()); return; }
          recordMutation.mutate({ dates: [new Date()], flow: 'unspecified' }, {
            onSuccess: () => toast.success(tr('flow_day_saved', 'Günün qeydi saxlanıldı')),
            onError: () => toast.error(tr('flow_save_failed', 'Qeyd saxlanılmadı. Yenidən cəhd edin.')),
          });
        }}>
        {todayHasFlow ? tr('flow_today_recorded', 'Bu gün qeyd olunub') : tr('flow_had_flow_today', 'Bu gün axın oldu')}
      </button>

      {/* Day Labels */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {[tr('day_sun_short', 'B'), tr('day_mon_short', 'BE'), tr('day_tue_short', 'ÇA'), tr('day_wed_short', 'Ç'), tr('day_thu_short', 'CA'), tr('day_fri_short', 'C'), tr('day_sat_short', 'Ş')].map((day, i) =>
        <div key={i} className="text-center py-1" style={{ fontSize: 10, fontWeight: 700, color: 'var(--a-ink-faint)' }}>
            {day}
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: calendarDays[0]?.getDay() || 0 }).map((_, i) =>
        <div key={`empty-${i}`} className="aspect-square" />
        )}

        {calendarDays.map((day) => {
          const info = getDayInfo(day);
          const isToday = isSameDay(day, new Date());

          return (
            <motion.button
              key={info.dateStr}
              data-date={info.dateStr}
              aria-label={format(day, 'd MMMM yyyy', { locale: getCurrentDateLocale() })}
              aria-pressed={info.isLogged}
              onClick={() => handleDayTap(day)}
              disabled={info.isFutureDate || recordMutation.isPending || !!fromDate && info.dateStr < fromDate}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-medium relative transition-all ${
              isToday ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''} ${

              info.isLogged ?
              info.flowIntensity === 'heavy' ?
              'bg-red-500/90 text-white dark:bg-red-600/80' :
              info.flowIntensity === 'light' ?
              'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
              'bg-red-400/80 text-white dark:bg-red-500/60' :
              info.isPredictedPeriod ?
              'bg-red-100/60 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-dashed border-red-300 dark:border-red-700' :
              info.isOvulation ?
              'bg-pink-200 text-pink-800 dark:bg-pink-800/40 dark:text-pink-300' :
              info.isFertile ?
              'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' :
              info.isFutureDate ?
              'text-muted-foreground/40' :
              'text-foreground hover:bg-muted active:bg-muted/80'}`
              }
              whileTap={!info.isFutureDate ? { scale: 0.85 } : undefined}>
              
              {format(day, 'd')}
              {/* Flow intensity dot */}
              {info.isLogged &&
              <span className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${getFlowDotColor(info.flowIntensity)}`} />
              }
              {info.isSpotting && <span className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" />}
              {/* Predicted period indicator */}
              {info.isPredictedPeriod && !info.isLogged &&
              <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-red-300 dark:bg-red-600" />
              }
              {info.isOvulation &&
              <span className="absolute -top-0.5 -end-0.5 text-[8px]">🌸</span>
              }
            </motion.button>);

        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <span className="text-[10px] text-muted-foreground">{tr("flowperiodcalendar_qeyd_edilen_d67bc1", "Qeyd edilən")}</span>
        </div>
        {!trackingOnly && <><div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-200 border border-dashed border-red-300" />
          <span className="text-[10px] text-muted-foreground">{tr("untranslated_proqnoz_rt0tdx", "Proqnoz")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-pink-300" />
          <span className="text-[10px] text-muted-foreground">{tr("flowperiodcalendar_mehsuldar_7ab8a5", "Məhsuldar")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs">🌸</span>
          <span className="text-[10px] text-muted-foreground">{tr("untranslated_ovulyasiya_h9aw8t", "Ovulyasiya")}</span>
        </div></>}
      </div>

      {/* Flow Intensity Picker Bottom Sheet */}
      {typeof document !== 'undefined' && createPortal(<AnimatePresence>
        {showFlowPicker && selectedDate &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="a-scope fixed inset-0 z-[200] flex items-end justify-center bg-black/40"
          onClick={() => {setShowFlowPicker(false);setSelectedDate(null);}}>
          
            <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            exit={{ y: 300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
             className="w-full max-w-md bg-card rounded-t-3xl p-6 pb-24"
             role="dialog"
             aria-modal="true"
             aria-label={format(selectedDate, 'd MMMM yyyy', { locale: getCurrentDateLocale() })}
            onClick={(e) => e.stopPropagation()}>
            
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-4" />
              <h4 className="font-bold text-foreground text-center mb-1">
                🩸 {format(selectedDate, 'd MMMM yyyy', { locale: getCurrentDateLocale() })}
              </h4>
              <p className="text-sm text-muted-foreground text-center mb-5">
                {tr("flowperiodcalendar_axinti_intensivliyini_secin_7d78ea", "Ax\u0131nt\u0131 intensivliyini se\xE7in")}
              </p>

              <div className="grid grid-cols-6 gap-3">
                {flowOptions().map((option) =>
              <motion.button
                key={option.key}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleFlowSelect(option.key as PeriodFlowAction)}
                disabled={recordMutation.isPending}
                aria-pressed={!!selectedLog && periodFlowLabel(selectedLog.flow_intensity) === option.key}
                className={`${option.color} ${option.key === 'unspecified' ? 'col-span-6' : ['none','spotting'].includes(option.key) ? 'col-span-3' : 'col-span-2'} rounded-2xl p-4 flex flex-col items-center gap-2 transition-all hover:opacity-80 ${selectedLog && periodFlowLabel(selectedLog.flow_intensity) === option.key ? 'ring-2 ring-red-500' : ''}`}>
                
                    <span className="text-2xl">{option.emoji}</span>
                    <span className="text-xs font-semibold text-foreground">{option.label}</span>
                  </motion.button>
              )}
              </div>

              {selectedLog && <button type="button" onClick={() => handleFlowSelect('clear')}
                disabled={recordMutation.isPending} className="w-full mt-3 py-2 text-sm text-red-600">
                {tr('flow_clear_day', 'Bu günün qeydini sil')}
              </button>}

              <button
              onClick={() => {setShowFlowPicker(false);setSelectedDate(null);}}
              className="w-full mt-4 text-sm text-muted-foreground py-2">
                {tr("flowperiodcalendar_legv_et_b5e49c", "L\u0259\u011Fv et")}
              
            </button>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>, document.body)}
    </motion.div>);

};

export default FlowPeriodCalendar;

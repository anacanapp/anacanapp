import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, X,
  Droplets, Sparkles, Calendar as CalendarIcon } from
'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useAppointments } from '@/hooks/useAppointments';
import { useDailyLogs } from '@/hooks/useDailyLogs';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { getPhaseInfoForDate, getCycleDayForDate } from '@/lib/cycle-utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { tr } from "@/lib/tr";
import { usePeriodDayLogs } from '@/hooks/usePeriodDayLogs';
import { hasPeriodFlow } from '@/lib/period-flow';

interface CalendarScreenProps {
  onBack: () => void;
}

interface DayEventType {
  type: 'period' | 'fertile' | 'ovulation' | 'appointment' | 'mood';
  label: string;
  color: string; // dot rÉ™ngi (palitra)
}

// Palitra dot rÉ™nglÉ™ri
const DOT = {
  period: '#ff8aa4', // pink-2
  fertile: '#63bd8b', // green-2
  ovulation: '#ffc94d', // yellow-2
  appointment: '#ab84ee', // lav-2
  mood: '#63acdf' // blue-2
};

const CalendarScreen = ({ onBack }: CalendarScreenProps) => {
  useScrollToTop();
  useScreenAnalytics('Calendar', 'Calendar');

  const { lifeStage, getCycleData, getPregnancyData, cycleLength, periodLength } = useUserStore(
    useShallow((s) => ({
      lifeStage: s.lifeStage,
      getCycleData: s.getCycleData,
      getPregnancyData: s.getPregnancyData,
      cycleLength: s.cycleLength,
      periodLength: s.periodLength,
    }))
  );
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState('appointment');

  const { appointments, addAppointment, deleteAppointment } = useAppointments();
  const { logs } = useDailyLogs();
  const { data: periodDays = [] } = usePeriodDayLogs();
  const cycleData = getCycleData();
  const pregData = getPregnancyData();

  // Get last period date
  const lastPeriodDate = cycleData?.lastPeriodDate ?
  (typeof cycleData.lastPeriodDate === 'string' ? parseISO(cycleData.lastPeriodDate) : new Date(cycleData.lastPeriodDate)) :
  new Date();

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    // Add padding for start of week
    const firstDayOfWeek = start.getDay();
    const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    return { days, paddingDays };
  }, [currentMonth]);

  // Get events for a specific day
  const getDayEvents = (day: Date): DayEventType[] => {
    const events: DayEventType[] = [];
    const dateStr = format(day, 'yyyy-MM-dd');

    // Check for appointments
    const dayAppointments = appointments.filter((apt) => apt.event_date === dateStr);
    dayAppointments.forEach((apt) => {
      events.push({ type: 'appointment', label: apt.title, color: DOT.appointment });
    });

    // Check for mood logs
    const dayLog = logs.find((l) => l.log_date === dateStr);
    if (dayLog?.mood) {
      events.push({ type: 'mood', label: tr("calendarscreen_ehval_qeyd_aa4f19", 'Æhval qeyd'), color: DOT.mood });
    }

    // Cycle-based events for flow stage
    if (lifeStage === 'flow' && cycleData) {
      const phaseInfo = getPhaseInfoForDate(day, lastPeriodDate, cycleLength, periodLength);
      const period = periodDays.find(log => log.log_date === dateStr);
      if (period && hasPeriodFlow(period.flow_intensity)) {
        events.push({ type: 'period', label: tr('flow_had_flow', 'Axın oldu'), color: DOT.period });
      } else if (!period && phaseInfo.isPeriodDay) {
        events.push({ type: 'period', label: tr('flow_predicted_period', 'Proqnozlaşdırılan period'), color: DOT.period });
      }

      if (phaseInfo.isOvulationDay) {
        events.push({ type: 'ovulation', label: 'Ovulyasiya', color: DOT.ovulation });
      } else if (phaseInfo.isFertileDay && !phaseInfo.isPeriodDay) {
        events.push({ type: 'fertile', label: tr("calendarscreen_fertil_gun_653ae1", 'Fertil gÃ¼n'), color: DOT.fertile });
      }
    }

    // Pregnancy due date
    if (lifeStage === 'bump' && pregData?.dueDate) {
      const dueDate = new Date(pregData.dueDate);
      if (isSameDay(day, dueDate)) {
        events.push({ type: 'appointment', label: tr("calendarscreen_dogus_tarixi_e2caea", 'DoÄŸuÅŸ tarixi'), color: DOT.appointment });
      }
    }

    return events;
  };

  // Get day styling based on cycle phase â€” tint fon + sabit ink
  const getDayStyle = (day: Date): {bg?: string;ink?: string;} => {
    if (lifeStage !== 'flow' || !cycleData) return {};

    const phaseInfo = getPhaseInfoForDate(day, lastPeriodDate, cycleLength, periodLength);
    const period = periodDays.find(log => log.log_date === format(day, 'yyyy-MM-dd'));
    if (period && hasPeriodFlow(period.flow_intensity)) return { bg: 'var(--a-pink-2)', ink: 'var(--a-pink-ink)' };
    if (!period && phaseInfo.isPeriodDay) return { bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' };
    if (phaseInfo.isOvulationDay) return { bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)' };
    if (phaseInfo.isFertileDay) return { bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' };
    return {};
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const handleAddEvent = async () => {
    if (!newEventTitle || !selectedDate) return;

    await addAppointment({
      title: newEventTitle,
      event_date: format(selectedDate, 'yyyy-MM-dd'),
      event_type: newEventType
    });

    setNewEventTitle('');
    setShowAddForm(false);
  };

  const today = new Date();

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const selectedDateEvents = selectedDate ? getDayEvents(selectedDate) : [];
  const selectedDateAppointments = appointments.filter((apt) => apt.event_date === selectedDateStr);

  // Current cycle day info for header
  const currentCycleDay = lifeStage === 'flow' && cycleData ?
  getCycleDayForDate(today, lastPeriodDate, cycleLength) :
  null;

  const cycleStats = [
  { icon: Droplets, value: periodLength, label: tr("calendarscreen_gun_period_957849", "gÃ¼n period"), bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' },
  { icon: CalendarIcon, value: cycleLength, label: tr("calendarscreen_gun_tsikl_bb0ab6", "gÃ¼n tsikl"), bg: 'var(--a-peach-1)', ink: 'var(--a-accent-ink)' },
  { icon: Sparkles, value: cycleLength - 14, label: tr("calendarscreen_ovulyasiya_gunu_e20a0b", "ovulyasiya gÃ¼nÃ¼"), bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)' }];


  const legendItems = [
  { color: DOT.period, label: tr("untranslated_menstruasiya_6pect0", "Menstruasiya") },
  { color: DOT.fertile, label: tr("calendarscreen_fertil_gunler_65de2c", "Fertil gÃ¼nlÉ™r") },
  { color: DOT.ovulation, label: tr("untranslated_ovulyasiya_h9aw8t", "Ovulyasiya") },
  { color: DOT.appointment, label: tr("untranslated_randevu_xc37do", "Randevu") }];


  return (
    <div className="a-scope safe-top min-h-screen pb-24 overflow-y-auto overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <motion.button onClick={onBack} className="a-icon-btn" whileTap={{ scale: 0.9 }} aria-label={tr("common_geri", "Geri")}>
              <ArrowLeft className="rtl:rotate-180" size={16} strokeWidth={2} />
            </motion.button>
            <div style={{ minWidth: 0 }}>
              {lifeStage === 'flow' && currentCycleDay &&
              <p className="a-eyebrow">{tr("calendarscreen_tsikl_gunu_51cdf3", "Tsikl g\xFCn\xFC:")} {currentCycleDay} / {cycleLength}</p>
              }
              <p className="a-wordmark" style={{ fontSize: 16 }}>{tr("calendarscreen_teqvim_584bdd", "TÉ™qvim")}</p>
            </div>
          </div>
          {selectedDate &&
          <div className="a-topbar-actions">
              <motion.button onClick={() => setShowAddForm(true)} className="a-icon-btn" whileTap={{ scale: 0.95 }} aria-label={tr("calendarscreen_elave_et_6e1b9b", "\u018Flav\u0259 et")}>
                <Plus size={16} strokeWidth={2} />
              </motion.button>
            </div>
          }
        </header>

        {/* Cycle Stats for Flow */}
        {lifeStage === 'flow' &&
        <div className="grid grid-cols-3 gap-2.5 mb-3.5">
            {cycleStats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="text-center" style={{ background: 'var(--a-surface)', borderRadius: 18, padding: '12px 8px', boxShadow: 'var(--a-card-shadow)' }}>
                  <div className="mx-auto mb-1.5 flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 10, background: s.bg }}>
                    <Icon size={14} style={{ color: s.ink }} />
                  </div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--a-ink)' }}>{s.value}</p>
                  <p style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{s.label}</p>
                </div>);

          })}
          </div>
        }

        {/* Calendar Card */}
        <motion.div
          className="a-card"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}>

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <motion.button
              onClick={() => navigateMonth('prev')}
              className="a-icon-btn"
              whileTap={{ scale: 0.95 }}
              aria-label={tr("calendarscreen_evvelki_ay", "ÆvvÉ™lki ay")}>
              <ChevronLeft className="rtl:rotate-180" size={16} />
            </motion.button>
            <h2 className="capitalize" style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>
              {format(currentMonth, 'MMMM yyyy', { locale: getCurrentDateLocale() })}
            </h2>
            <motion.button
              onClick={() => navigateMonth('next')}
              className="a-icon-btn"
              whileTap={{ scale: 0.95 }}
              aria-label={tr("calendarscreen_novbeti_ay", "NÃ¶vbÉ™ti ay")}>
              <ChevronRight className="rtl:rotate-180" size={16} />
            </motion.button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['B.e.', tr("calendarscreen_c_a_5c29b2", "\xC7.a."), tr("calendarscreen_c_399abb", "\xC7."), 'C.a.', 'C.', tr("calendarscreen_s_f3ddc2", "\u015E."), 'B.'].map((day) =>
            <div key={day} className="text-center py-2" style={{ fontSize: 11, fontWeight: 700, color: 'var(--a-ink-soft)' }}>
                {day}
              </div>
            )}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for start padding */}
            {Array.from({ length: calendarDays.paddingDays }).map((_, i) =>
            <div key={`pad-${i}`} className="aspect-square" />
            )}

            {calendarDays.days.map((day) => {
              const events = getDayEvents(day);
              const dayStyle = getDayStyle(day);
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              const cellStyle: React.CSSProperties = isSelected ?
              { background: 'var(--a-peach-2)', color: '#ffffff', boxShadow: '0 0 0 2px var(--a-surface), 0 0 0 4px var(--a-peach-2)' } :
              {
                background: dayStyle.bg || (isToday ? 'var(--a-peach-1)' : 'transparent'),
                color: dayStyle.ink || (isToday ? 'var(--a-accent-ink)' : 'var(--a-ink)'),
                border: isToday ? '2px solid var(--a-peach-2)' : '2px solid transparent'
              };

              return (
                <motion.button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all"
                  style={cellStyle}
                  whileTap={{ scale: 0.95 }}>

                  <span style={{ fontSize: 13, fontWeight: isToday || isSelected ? 800 : 500 }}>
                    {format(day, 'd')}
                  </span>

                  {/* Event indicators */}
                  {events.length > 0 &&
                  <div className="flex gap-0.5 mt-0.5">
                      {events.slice(0, 3).map((event, i) =>
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: isSelected ? '#ffffff' : event.color }} />

                    )}
                    </div>
                  }
                </motion.button>);

            })}
          </div>
        </motion.div>

        {/* Legend */}
        <motion.div
          className="a-card mt-3.5"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}>

          <h3 className="a-card-title" style={{ marginBottom: 12 }}>{tr("calendarscreen_isareler_c13095", "Ä°ÅŸarÉ™lÉ™r")}</h3>
          <div className="grid grid-cols-2 gap-2">
            {legendItems.map((item) =>
            <div key={item.label} className="flex items-center gap-2" style={{ background: 'var(--a-surface-soft)', borderRadius: 12, padding: '8px 10px' }}>
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--a-ink-soft)' }}>{item.label}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Selected Day Details */}
        <AnimatePresence>
          {selectedDate &&
          <motion.div
            className="a-card mt-3.5"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--a-ink)' }}>
                    {format(selectedDate, 'd MMMM, EEEE', { locale: getCurrentDateLocale() })}
                  </h3>
                  {lifeStage === 'flow' && cycleData &&
                <p style={{ fontSize: 11, color: 'var(--a-ink-soft)', marginTop: 2 }}>
                      {tr("calendarscreen_tsikl_gunu_51cdf3", "Tsikl g\xFCn\xFC:")} {getCycleDayForDate(selectedDate, lastPeriodDate, cycleLength)}
                    </p>
                }
                </div>
                <motion.button
                onClick={() => setShowAddForm(true)}
                className="a-btn-soft"
                whileTap={{ scale: 0.95 }}>

                  <Plus size={14} />
                  {tr("calendarscreen_elave_et_6e1b9b", "\u018Flav\u0259 et")}
                </motion.button>
              </div>

              {selectedDateEvents.length > 0 || selectedDateAppointments.length > 0 ?
            <div className="space-y-2">
                  {selectedDateEvents.map((event, i) =>
              <div key={i} className="flex items-center gap-3" style={{ background: 'var(--a-surface-soft)', borderRadius: 14, padding: '11px 13px' }}>
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: event.color }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink)' }}>{event.label}</span>
                    </div>
              )}
                  {selectedDateAppointments.map((apt) =>
              <div key={apt.id} className="flex items-center justify-between gap-3" style={{ background: 'var(--a-surface-soft)', borderRadius: 14, padding: '11px 13px' }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: DOT.appointment }} />
                        <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink)' }}>{apt.title}</span>
                      </div>
                      <motion.button
                  onClick={() => deleteAppointment(apt.id)}
                  className="shrink-0"
                  style={{ background: 'var(--a-alert-bg)', color: 'var(--a-alert-ink)', borderRadius: 10, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}
                  whileTap={{ scale: 0.95 }}>{tr("untranslated_sil_zwa7lz", "Sil")}</motion.button>
                    </div>
              )}
                </div> :

            <div className="text-center py-6">
                  <CalendarIcon size={36} className="mx-auto mb-2" style={{ color: 'var(--a-ink-faint)' }} />
                  <p style={{ fontSize: 13, color: 'var(--a-ink-soft)' }}>{tr("calendarscreen_bu_gun_ucun_hadise_yoxdur_a394c8", "Bu gÃ¼n Ã¼Ã§Ã¼n hadisÉ™ yoxdur")}</p>
                </div>
            }
            </motion.div>
          }
        </AnimatePresence>
      </div>

      {/* Add Event Modal */}
      <AnimatePresence>
        {showAddForm && selectedDate &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 z-50 flex items-end"
          onClick={() => setShowAddForm(false)}>

            <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full p-6 relative"
            style={{ background: 'var(--a-surface)', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 24px)' }}>

              <div className="absolute left-1/2 -translate-x-1/2 top-3 w-12 h-1.5 rounded-full" style={{ background: 'var(--a-line-strong)' }} />
              <div className="flex items-center justify-between mb-6 mt-1">
                <h2 style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>
                  {tr("calendarscreen_randevu_elave_et_2cfa5a", "Randevu \u0259lav\u0259 et")}
                </h2>
                <motion.button
                onClick={() => setShowAddForm(false)}
                className="a-icon-btn"
                style={{ width: 32, height: 32, borderRadius: 999 }}
                whileTap={{ scale: 0.95 }}
                aria-label={tr("premiummodal_bagla_84bdc9", "BaÄŸla")}>
                  <X size={14} />
                </motion.button>
              </div>

              <p style={{ fontSize: 13, color: 'var(--a-ink-soft)', marginBottom: 16 }}>
                {format(selectedDate, 'd MMMM yyyy', { locale: getCurrentDateLocale() })}
              </p>

              <div className="mb-4">
                <label className="block mb-2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink)' }}>{tr("calendarscreen_basliq_e1f6c5", "BaÅŸlÄ±q")}</label>
                <input
                placeholder={tr("calendarscreen_hekim_muayinesi_78c373", "HÉ™kim mÃ¼ayinÉ™si")}
                value={newEventTitle}
                onChange={(e) => setNewEventTitle(e.target.value)}
                className="a-input w-full"
                style={{ height: 48 }} />

              </div>

              <div className="mb-6">
                <label className="block mb-2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink)' }}>{tr("calendarscreen_nov_98ad7c", "NÃ¶v")}</label>
                <div className="flex gap-2">
                  {[
                { id: 'appointment', label: 'Randevu', icon: 'ðŸ“…' },
                { id: 'pill', label: tr("calendarscreen_derman_8b4b27", 'DÉ™rman'), icon: 'ðŸ’Š' },
                { id: 'reminder', label: tr("calendarscreen_xatirlatma_3f3c48", 'XatÄ±rlatma'), icon: 'ðŸ””' }].
                map((type) =>
                <button
                  key={type.id}
                  onClick={() => setNewEventType(type.id)}
                  className="flex-1 py-3 transition-all"
                  style={{
                    borderRadius: 14,
                    fontSize: 12.5,
                    fontWeight: 700,
                    background: newEventType === type.id ? 'var(--a-peach-1)' : 'var(--a-surface-soft)',
                    color: newEventType === type.id ? 'var(--a-accent-ink)' : 'var(--a-ink-soft)',
                    border: newEventType === type.id ? '1.5px solid var(--a-peach-2)' : '1.5px solid transparent'
                  }}>

                      {type.icon} {type.label}
                    </button>
                )}
                </div>
              </div>

              <button
              onClick={handleAddEvent}
              disabled={!newEventTitle}
              className="w-full h-14 rounded-full text-white font-bold disabled:opacity-50"
              style={{ background: 'var(--a-peach-2)', boxShadow: '0 14px 28px -12px rgba(217, 108, 74, 0.55)', fontSize: 14.5 }}>{tr("untranslated_yadda_saxla_bpdu9v", "Yadda saxla")}</button>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

};

export default CalendarScreen;

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronRight, Calendar, Clock, Sparkles, X, Check, Lightbulb } from 'lucide-react';
import { useBabyCrisisPeriods, BabyCrisisPeriod, useCurrentBabyCrisis, useUpcomingBabyCrises } from '@/hooks/useBabyCrisisPeriods';
import { hapticFeedback } from '@/lib/native';
import { tr } from "@/lib/tr";

interface BabyCrisisWidgetProps {
  babyAgeWeeks: number;
  babyName: string;
}

const severityConfig = {
  mild: { 
    color: 'from-[color:var(--a-yellow-2)] to-[color:var(--a-yellow-2)]',
    bgColor: 'bg-[color:var(--a-yellow-1)]',
    borderColor: 'border-[color:var(--a-yellow-2)]',
    textColor: 'text-[color:var(--a-yellow-ink)]',
    dotColor: 'bg-[color:var(--a-yellow-ink)]',
    label: tr("babycrisiswidget_yungul_2a8010", 'Yüngül')
  },
  medium: { 
    color: 'from-[color:var(--a-peach-2)] to-[color:var(--a-peach-2)]',
    bgColor: 'bg-[color:var(--a-peach-1)]',
    borderColor: 'border-[color:var(--a-peach-2)]',
    textColor: 'text-[color:var(--a-peach-ink)]',
    dotColor: 'bg-[color:var(--a-peach-ink)]',
    label: tr('babycrisiswidget_medium','Orta')
  },
  intense: { 
    color: 'from-[color:var(--a-pink-2)] to-[color:var(--a-pink-2)]',
    bgColor: 'bg-[color:var(--a-pink-1)]',
    borderColor: 'border-[color:var(--a-pink-2)]',
    textColor: 'text-[color:var(--a-pink-ink)]',
    dotColor: 'bg-[color:var(--a-pink-ink)]',
    label: tr("babycrisiswidget_i_ntensiv_45a63b", 'İntensiv')
  },
};

const BabyCrisisWidget = ({ babyAgeWeeks, babyName }: BabyCrisisWidgetProps) => {
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const [selectedCrisis, setSelectedCrisis] = useState<BabyCrisisPeriod | null>(null);
  
  const { data: allCrisisPeriods = [], isLoading } = useBabyCrisisPeriods();
  const currentCrises = useCurrentBabyCrisis(babyAgeWeeks);
  const upcomingCrises = useUpcomingBabyCrises(babyAgeWeeks, 2);
  
  const isInCrisis = currentCrises.length > 0;
  const currentCrisis = currentCrises[0];
  
  const openFullCalendar = async () => {
    await hapticFeedback.light();
    setShowFullCalendar(true);
  };

  const openCrisisDetail = async (crisis: BabyCrisisPeriod) => {
    await hapticFeedback.light();
    setSelectedCrisis(crisis);
  };

  if (isLoading || allCrisisPeriods.length === 0) {
    return null;
  }

  const getSeverityConfig = (severity: string) => {
    return severityConfig[severity as keyof typeof severityConfig] || severityConfig.mild;
  };

  const getProgressInCrisis = () => {
    if (!currentCrisis) return 0;
    const totalWeeks = currentCrisis.week_end - currentCrisis.week_start + 1;
    const currentWeekInCrisis = babyAgeWeeks - currentCrisis.week_start + 1;
    return Math.min(100, (currentWeekInCrisis / totalWeeks) * 100);
  };

  // anacan-demo rank-tag class per severity
  const severityTagClass = (severity: string) => {
    if (severity === 'intense') return 'intensive';
    if (severity === 'medium') return 'medium';
    return 'mild';
  };

  return (
    <>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <div className="a-section-head">
          <h2 className="a-section-title a-heading">{tr("babycrisiswidget_kriz_teqvimi_aa2ea5", "Kriz Təqvimi")}</h2>
          <span className="a-section-link">
            {isInCrisis
              ? tr('babycrisiswidget_active_crisis', 'Aktiv Kriz Dövrü')
              : upcomingCrises.length > 0
                ? tr('babycrisiswidget_next_week', 'Növbəti: {n}. həftə').replace('{n}', String(upcomingCrises[0].week_start))
                : tr('babycrisiswidget_no_upcoming', 'Yaxınlaşan kriz yoxdur')}
          </span>
        </div>
        {isInCrisis ? (
          // Active Crisis Alert Card
          <motion.div
            className="a-card a-fade-in"
            style={{ cursor: 'pointer' }}
            onClick={openFullCalendar}
          >
            <div className="a-rank-row" style={{ borderTop: 'none', padding: '0 0 4px' }}>
              <motion.span
                className="a-rank-avatar"
                style={{ background: 'var(--a-peach-1)', fontSize: 20 }}
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: 2 }}
              >
                {currentCrisis.emoji}
              </motion.span>
              <div style={{ minWidth: 0 }}>
                <p className="a-today-info-eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 5, margin: 0 }}>
                  <AlertTriangle size={11} style={{ color: 'var(--a-peach-2)' }} />
                  {tr('babycrisiswidget_active_crisis', 'Aktiv Kriz Dövrü')}
                </p>
                <p className="a-rank-title" style={{ marginTop: 3 }}>
                  {currentCrisis.title || currentCrisis.title}
                </p>
              </div>
              <span className={`a-rank-tag ${severityTagClass(currentCrisis.severity)}`}>
                {getSeverityConfig(currentCrisis.severity).label}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ margin: '10px 0 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <span className="a-list-sub" style={{ margin: 0 }}>
                  {tr('babycrisiswidget_weeks_range', 'Həftə {s}-{e}').replace('{s}', String(currentCrisis.week_start)).replace('{e}', String(currentCrisis.week_end))}
                </span>
                <span className="a-list-value" style={{ color: 'var(--a-accent-ink)' }}>
                  {Math.round(getProgressInCrisis())}{tr('babycrisiswidget_pct_done', '% keçdi')}
                </span>
              </div>
              <div className="a-inline-bar" style={{ marginTop: 0 }}>
                <motion.div
                  className="a-inline-bar-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${getProgressInCrisis()}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>
            </div>

            <p className="a-cta-text" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {currentCrisis.description}
            </p>

            {/* Quick symptoms */}
            {currentCrisis.symptoms && currentCrisis.symptoms.length > 0 && (
              <div className="a-tag-row" style={{ marginTop: 12, marginBottom: 0 }}>
                {currentCrisis.symptoms.slice(0, 3).map((symptom, i) => (
                  <span key={i} className="a-tag" style={{ cursor: 'default' }}>
                    {symptom}
                  </span>
                ))}
                {currentCrisis.symptoms.length > 3 && (
                  <span className="a-tag" style={{ cursor: 'default', background: 'transparent' }}>
                    +{currentCrisis.symptoms.length - 3}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        ) : (
          // No Active Crisis - Show Calendar Preview
          <motion.div
            className="a-card a-fade-in"
            style={{ padding: '6px 18px', cursor: 'pointer' }}
            onClick={openFullCalendar}
          >
            {upcomingCrises.length > 0 ? (
              upcomingCrises.map((crisis) => (
                <div key={crisis.id} className="a-rank-row">
                  <span className="a-rank-avatar" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                    <Calendar size={17} strokeWidth={2} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p className="a-rank-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {crisis.emoji} {crisis.title}
                    </p>
                    <p className="a-rank-sub">
                      {tr('babycrisiswidget_weeks_range', 'Həftə {s}-{e}').replace('{s}', String(crisis.week_start)).replace('{e}', String(crisis.week_end))} · {crisis.week_start - babyAgeWeeks} {tr('babycrisiswidget_week_unit_later', 'həftə sonra')}
                    </p>
                  </div>
                  <span className={`a-rank-tag ${severityTagClass(crisis.severity)}`}>
                    {getSeverityConfig(crisis.severity).label}
                  </span>
                </div>
              ))
            ) : (
              <div className="a-rank-row">
                <span className="a-rank-avatar" style={{ background: 'var(--a-green-1)', color: 'var(--a-green-2)' }}>
                  <Calendar size={17} strokeWidth={2} />
                </span>
                <div>
                  <p className="a-rank-title">{tr("babycrisiswidget_kriz_teqvimi_aa2ea5", "Kriz Təqvimi")}</p>
                  <p className="a-rank-sub">{tr('babycrisiswidget_no_upcoming', 'Yaxınlaşan kriz yoxdur')}</p>
                </div>
                <ChevronRight className="rtl:rotate-180 a-list-chevron" style={{ marginInlineStart: 'auto' }} size={16} />
              </div>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Full Calendar Modal */}
      <AnimatePresence>
        {showFullCalendar && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowFullCalendar(false)}
            />
            <motion.div
              className="relative bg-background rounded-t-3xl w-full max-h-[90vh] overflow-hidden"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div className="sticky top-0 bg-background border-b border-border/50 px-4 py-4 z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{tr("babycrisiswidget_kriz_teqvimi_aa2ea5", "Kriz Təqvimi")}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {babyName} • {babyAgeWeeks}. {tr('babycrisiswidget_week_header','həftə')}
                    </p>
                  </div>
                  <motion.button
                    onClick={() => setShowFullCalendar(false)}
                    className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>

              {/* Timeline */}
              <div
                className="overflow-y-auto max-h-[calc(90vh-80px)] p-4 pb-24"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' }}
              >
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute start-5 top-0 bottom-0 w-0.5 bg-border" />
                  
                  {/* Current position indicator */}
                  <motion.div 
                    className="absolute start-3 w-5 h-5 rounded-full bg-primary border-4 border-background shadow-lg z-10"
                    style={{ 
                      top: `${Math.min(95, (babyAgeWeeks / 80) * 100)}%` 
                    }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: 2 }}
                  />
                  
                  <div className="space-y-4">
                    {allCrisisPeriods.map((crisis, index) => {
                      const isPast = babyAgeWeeks > crisis.week_end;
                      const isCurrent = babyAgeWeeks >= crisis.week_start && babyAgeWeeks <= crisis.week_end;
                      
                      return (
                        <motion.div
                          key={crisis.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(index * 0.05, 0.3) }}
                          className="relative ps-12"
                        >
                          {/* Timeline dot */}
                          <div className={`absolute start-3 w-5 h-5 rounded-full flex items-center justify-center ${
                            isCurrent 
                              ? `bg-gradient-to-br ${getSeverityConfig(crisis.severity).color} ring-4 ring-primary/20 shadow-lg`
                              : isPast
                                ? 'bg-muted'
                                : 'bg-muted/50 border-2 border-dashed border-muted-foreground/30'
                          }`}>
                            {isPast && <Check className="w-3 h-3 text-muted-foreground" />}
                          </div>

                          {/* Card */}
                          <motion.button
                            onClick={() => openCrisisDetail(crisis)}
                            className={`w-full text-start p-4 rounded-2xl border transition-all ${
                              isCurrent 
                                ? `${getSeverityConfig(crisis.severity).bgColor} ${getSeverityConfig(crisis.severity).borderColor} shadow-md`
                                : isPast
                                  ? 'bg-muted/30 border-border/30 opacity-60'
                                  : 'bg-card border-border/50 hover:border-primary/30'
                            }`}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-2xl">{crisis.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className={`font-bold ${isCurrent ? getSeverityConfig(crisis.severity).textColor : 'text-foreground'}`}>
                                    {crisis.title}
                                  </h3>
                                  {isCurrent && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 ${getSeverityConfig(crisis.severity).textColor}`}>
                                      {tr('babycrisiswidget_indi','İNDİ')}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  <span>{tr('babycrisiswidget_weeks_range','Həftə {s}-{e}').replace('{s}',String(crisis.week_start)).replace('{e}',String(crisis.week_end))}</span>
                                  <span>•</span>
                                  <span className={`font-medium ${getSeverityConfig(crisis.severity).textColor}`}>
                                    {getSeverityConfig(crisis.severity).label}
                                  </span>
                                </div>
                                {isCurrent && (
                                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                    {crisis.description}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="rtl:rotate-180 w-5 h-5 text-muted-foreground flex-shrink-0" />
                            </div>
                          </motion.button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crisis Detail Modal */}
      <AnimatePresence>
        {selectedCrisis && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="absolute inset-0 bg-black/60"
              onClick={() => setSelectedCrisis(null)}
            />
            <motion.div
              className="relative bg-background rounded-t-3xl w-full max-h-[85vh] overflow-hidden"
              style={{ marginBottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Header with gradient */}
              <div className={`bg-gradient-to-br ${getSeverityConfig(selectedCrisis.severity).color} px-4 py-6 relative`}>
                <motion.button
                  onClick={() => setSelectedCrisis(null)}
                  className="absolute top-4 end-4 w-10 h-10 rounded-full bg-white/30 flex items-center justify-center"
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5 text-white" />
                </motion.button>
                
                <div className="flex items-center gap-4">
                  <motion.div 
                    className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-4xl"
                    animate={{ rotate: [0, -5, 5, 0] }}
                    transition={{ duration: 3, repeat: 1 }}
                  >
                    {selectedCrisis.emoji}
                  </motion.div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {selectedCrisis.title}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3.5 h-3.5 text-white/80" />
                      <span className="text-sm text-white/90">
                        {tr('babycrisiswidget_weeks_range','Həftə {s}-{e}').replace('{s}',String(selectedCrisis.week_start)).replace('{e}',String(selectedCrisis.week_end))}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs text-white font-medium">
                        {getSeverityConfig(selectedCrisis.severity).label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[calc(85vh-140px)] p-4 pb-24 space-y-4">
                {/* Description */}
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-sm text-foreground leading-relaxed">
                    {selectedCrisis.description}
                  </p>
                </div>

                {/* Symptoms */}
                {Array.isArray(selectedCrisis.symptoms) && selectedCrisis.symptoms.length > 0 && (
                  <div className={`rounded-xl p-4 ${getSeverityConfig(selectedCrisis.severity).bgColor} border ${getSeverityConfig(selectedCrisis.severity).borderColor}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className={`w-4 h-4 ${getSeverityConfig(selectedCrisis.severity).textColor}`} />
                      <h3 className={`font-bold text-sm ${getSeverityConfig(selectedCrisis.severity).textColor}`}>
                        {tr('babycrisiswidget_elamtler','Əlamətlər')}
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {selectedCrisis.symptoms.map((symptom, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${getSeverityConfig(selectedCrisis.severity).dotColor}`} />
                          <span className="text-sm text-foreground">{symptom}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tips */}
                {Array.isArray(selectedCrisis.tips) && selectedCrisis.tips.length > 0 && (
                  <div className="bg-primary/5 dark:bg-primary/10 rounded-xl p-4 border border-primary/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="w-4 h-4 text-primary" />
                      <h3 className="font-bold text-sm text-primary">{tr("babycrisiswidget_tovsiyeler_17a8f7", "Tövsiyələr")}</h3>
                    </div>
                    <div className="space-y-2">
                      {selectedCrisis.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-foreground">{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BabyCrisisWidget;

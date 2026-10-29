import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock, Moon, Pencil, Trash2, X, Check } from 'lucide-react';
import { useBabyLogs } from '@/hooks/useBabyLogs';
import { format, isToday, isYesterday } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { useToast } from '@/hooks/use-toast';
import { tr } from "@/lib/tr";

const formatDuration = (minutes: number): string => {
  if (minutes <= 0) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) return `${hours} ${tr('unit_hr','saat')} ${mins} ${tr('unit_min','dəq')}`;
  return `${mins} ${tr('unit_min','dəq')}`;
};

const getDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isToday(date)) return tr('sleephistorypanel_today','Bu gün');
  if (isYesterday(date)) return tr('sleephistorypanel_yesterday','Dünən');
  return format(date, 'd MMMM', { locale: getCurrentDateLocale() });
};

interface SleepHistoryPanelProps {
  isExpanded?: boolean;
  onToggle?: () => void;
  defaultExpanded?: boolean;
}

const SleepHistoryPanel = ({ isExpanded: externalExpanded, onToggle, defaultExpanded = false }: SleepHistoryPanelProps) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const { logs, todayLogs, deleteLog, updateLog } = useBabyLogs();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const handleToggle = onToggle || (() => setInternalExpanded(!internalExpanded));

  // Today's sleep stats
  const todaySleepStats = useMemo(() => {
    const sleepLogs = todayLogs.filter(l => l.log_type === 'sleep');
    let totalMinutes = 0;
    sleepLogs.forEach(log => {
      if (log.end_time) {
        const start = new Date(log.start_time);
        const end = new Date(log.end_time);
        totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
      }
    });
    return { count: sleepLogs.length, totalMinutes };
  }, [todayLogs]);

  // Sleep history for last 3 days
  const sleepHistory = useMemo(() => {
    const sleepLogs = logs.filter(l => l.log_type === 'sleep');
    const historyMap = new Map<string, typeof sleepLogs>();
    const dates: string[] = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(dateStr);
      historyMap.set(dateStr, []);
    }
    sleepLogs.forEach(log => {
      const dateStr = log.start_time.split('T')[0];
      if (dates.includes(dateStr)) {
        const existing = historyMap.get(dateStr) || [];
        existing.push(log);
        historyMap.set(dateStr, existing);
      }
    });
    return Array.from(historyMap.entries());
  }, [logs]);

  const handleDelete = async (id: string) => {
    const result = await deleteLog(id);
    if (!result.error) {
      toast({ title: tr('sleephistorypanel_record_deleted','Yuxu qeydi silindi') });
      setDeletingId(null);
    } else {
      toast({ title: tr("sleephistorypanel_xeta_bas_verdi_f22fba", 'Xəta baş verdi'), variant: 'destructive' });
    }
  };

  const handleEdit = (log: any) => {
    setEditingId(log.id);
    setEditStartTime(format(new Date(log.start_time), 'HH:mm'));
    setEditEndTime(log.end_time ? format(new Date(log.end_time), 'HH:mm') : '');
  };

  const handleSaveEdit = async (log: any) => {
    const [sh, sm] = editStartTime.split(':').map(Number);
    const newStart = new Date(log.start_time);
    newStart.setHours(sh, sm, 0, 0);
    const updates: any = { start_time: newStart.toISOString() };
    if (editEndTime) {
      const [eh, em] = editEndTime.split(':').map(Number);
      const newEnd = new Date(newStart);
      newEnd.setHours(eh, em, 0, 0);
      if (newEnd.getTime() <= newStart.getTime()) {
        newEnd.setDate(newEnd.getDate() + 1);
      }
      updates.end_time = newEnd.toISOString();
    }
    const result = await updateLog(log.id, updates);
    if (!result.error) {
      toast({ title: tr("sleephistorypanel_yuxu_qeydi_yenilendi_26a02f", 'Yuxu qeydi yeniləndi') });
      setEditingId(null);
    } else {
      toast({ title: tr("sleephistorypanel_xeta_bas_verdi_f22fba", 'Xəta baş verdi'), variant: 'destructive' });
    }
  };

  return (
    <div className="rounded-[20px] overflow-hidden" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)', boxShadow: 'var(--a-card-shadow)' }}>
      <button
        onClick={handleToggle}
        className="w-full p-3 flex items-center justify-between transition-colors"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--a-grad-lav)' }}>
            <Moon className="w-4 h-4" style={{ color: 'var(--a-lav-ink)' }} />
          </div>
          <div className="text-start">
            <p className="text-xs font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>{tr("sleephistorypanel_yuxu_xulasesi_b2dc87", "Yuxu xülasəsi")}</p>
            <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>
              {todaySleepStats.count > 0
                ? `🌙 ${todaySleepStats.count} ${tr('sleephistorypanel_times','dəfə')} · ${formatDuration(todaySleepStats.totalMinutes)}`
                : tr('sleephistorypanel_no_records','Qeyd yoxdur')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {todaySleepStats.count > 0 && (
            <div className="text-end me-2">
              <p className="text-xs font-bold" style={{ margin: 0, color: 'var(--a-lav-ink)' }}>
                {formatDuration(todaySleepStats.totalMinutes)}
              </p>
              <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr("sleephistorypanel_bu_gun_7d7f30", "bu gün")}</p>
            </div>
          )}
          {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--a-ink-faint)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--a-ink-faint)' }} />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {sleepHistory.map(([date, items]) => (
                <div key={date} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>{getDateLabel(date)}</p>
                    <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{items.length} {tr('sleephistorypanel_sleep_sessions','yuxu')}</p>
                  </div>

                  {items.length === 0 ? (
                    <p className="text-xs text-center py-2" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr('sleephistorypanel_no_records','Qeyd yoxdur')}</p>
                  ) : (
                    <div className="space-y-1">
                      {items.map((log) => {
                        const startTime = new Date(log.start_time);
                        const endTime = log.end_time ? new Date(log.end_time) : null;
                        const durationMin = endTime ? (endTime.getTime() - startTime.getTime()) / (1000 * 60) : 0;

                        return (
                          <div key={log.id} className="relative">
                            {deletingId === log.id ? (
                              <div className="flex items-center justify-between rounded-lg px-2.5 py-2" style={{ background: 'var(--a-pink-1)' }}>
                                <span className="text-xs font-semibold" style={{ color: 'var(--a-pink-ink)' }}>{tr("sleephistorypanel_silmek_isteyirsiniz_77af6b", "Silmək istəyirsiniz?")}</span>
                                <div className="flex gap-1.5">
                                  <button onClick={() => handleDelete(log.id)} className="p-1.5 rounded-full" style={{ background: 'var(--a-pink-2)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setDeletingId(null)} className="p-1.5 rounded-full" style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-pink-ink)', border: 'none', cursor: 'pointer' }}>
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ) : editingId === log.id ? (
                              <div className="rounded-lg px-2.5 py-2 space-y-2" style={{ background: 'var(--a-lav-1)' }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">🌙</span>
                                  <span className="text-xs font-semibold" style={{ color: 'var(--a-lav-ink)' }}>{tr('sleephistorypanel_sleep_label','Yuxu')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="time"
                                    value={editStartTime}
                                    onChange={(e) => setEditStartTime(e.target.value)}
                                    className="text-xs rounded px-2 py-1 w-24"
                                    style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line-strong)', color: 'var(--a-ink)' }}
                                  />
                                  <span className="text-xs" style={{ color: 'var(--a-lav-ink)' }}>-</span>
                                  <input
                                    type="time"
                                    value={editEndTime}
                                    onChange={(e) => setEditEndTime(e.target.value)}
                                    className="text-xs rounded px-2 py-1 w-24"
                                    style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line-strong)', color: 'var(--a-ink)' }}
                                  />
                                </div>
                                <div className="flex justify-end gap-1.5">
                                  <button onClick={() => handleSaveEdit(log)} className="p-1.5 rounded-full" style={{ background: 'var(--a-green-2)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="p-1.5 rounded-full" style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-lav-ink)', border: 'none', cursor: 'pointer' }}>
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 group" style={{ background: 'var(--a-surface-soft)' }}>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">🌙</span>
                                  <div>
                                    <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-ink)' }}>{tr('sleephistorypanel_sleep_label','Yuxu')}</p>
                                    <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>
                                      {format(startTime, 'HH:mm')}
                                      {endTime && ` - ${format(endTime, 'HH:mm')}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1" style={{ color: 'var(--a-lav-ink)' }}>
                                    <Clock className="w-3 h-3" />
                                    <span className="text-xs font-bold">{formatDuration(durationMin)}</span>
                                  </div>
                                  <div className="flex gap-0.5">
                                    <button onClick={() => handleEdit(log)} className="p-1 rounded" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-ink-soft)' }}>
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => setDeletingId(log.id)} className="p-1 rounded" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-pink-ink)' }}>
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SleepHistoryPanel;

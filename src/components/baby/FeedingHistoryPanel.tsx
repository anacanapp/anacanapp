import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock, ArrowLeft, ArrowRight, Baby, Pencil, Trash2, X, Check } from 'lucide-react';
import { useBabyLogs, FeedingHistoryItem } from '@/hooks/useBabyLogs';

import { format, isToday, isYesterday } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { useToast } from '@/hooks/use-toast';
import { tr } from "@/lib/tr";

const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return '-';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours} ${tr('unit_hr','saat')} ${mins} ${tr('unit_min','dəq')}`;
  if (mins > 0) return `${mins} ${tr('unit_min','dəq')} ${secs} ${tr('unit_sec','san')}`;
  return `${secs} ${tr('unit_sec','san')}`;
};

const getFeedTypeLabel = (type: string): string => {
  switch (type) {
    case 'left': return tr('feedinghistorypanel_sol_sine_64d1ac','Sol sinə');
    case 'right': return tr('feedinghistorypanel_sag_sine_074475','Sağ sinə');
    case 'formula': return tr('feedinghistorypanel_suni_qida_fdf267','Süni qida');
    case 'solid': return tr('feedinghistorypanel_elave_qida_ac1beb','Bərk qida');
    default: return type;
  }
};

const getFeedTypeEmoji = (type: string): string => {
  switch (type) {
    case 'left': return '🤱←';
    case 'right': return '→🤱';
    case 'formula': return '🍼';
    case 'solid': return '🥣';
    default: return '🍼';
  }
};

const getDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isToday(date)) return tr('feedinghistorypanel_today','Bu gün');
  if (isYesterday(date)) return tr('feedinghistorypanel_yesterday','Dünən');
  return format(date, 'd MMMM', { locale: getCurrentDateLocale() });
};

interface FeedingHistoryPanelProps {
  isExpanded?: boolean;
  onToggle?: () => void;
  defaultExpanded?: boolean;
}

const FeedingHistoryPanel = ({ isExpanded: externalExpanded, onToggle, defaultExpanded = false }: FeedingHistoryPanelProps) => {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const { getFeedingHistory, getTodayFeedingBreakdown, deleteLog, updateLog } = useBabyLogs();
  
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;
  const handleToggle = onToggle || (() => setInternalExpanded(!internalExpanded));
  
  const feedingHistory = getFeedingHistory(3);
  const todayBreakdown = getTodayFeedingBreakdown;
  const historyArray = Array.from(feedingHistory.entries());

  const totalFeedings = todayBreakdown.leftCount + todayBreakdown.rightCount + todayBreakdown.formulaCount + todayBreakdown.solidCount;
  const hasAnyFeedings = totalFeedings > 0;

  const buildSummaryText = () => {
    const parts: string[] = [];
    if (todayBreakdown.leftCount > 0 || todayBreakdown.rightCount > 0) {
      parts.push(`🤱 ${todayBreakdown.leftCount + todayBreakdown.rightCount}`);
    }
    if (todayBreakdown.formulaCount > 0) parts.push(`🍼 ${todayBreakdown.formulaCount}`);
    if (todayBreakdown.solidCount > 0) parts.push(`🥣 ${todayBreakdown.solidCount}`);
    return parts.length > 0 ? parts.join(' · ') : tr('feedinghistorypanel_no_records','Qeyd yoxdur');
  };

  const handleDelete = async (id: string) => {
    const result = await deleteLog(id);
    if (!result.error) {
      toast({ title: tr('feedinghistorypanel_record_deleted','Qeyd silindi') });
      setDeletingId(null);
    } else {
      toast({ title: tr("feedinghistorypanel_xeta_bas_verdi_f22fba", 'Xəta baş verdi'), variant: 'destructive' });
    }
  };

  const handleEdit = (item: FeedingHistoryItem) => {
    setEditingId(item.id);
    setEditStartTime(format(item.startTime, "HH:mm"));
    setEditEndTime(item.endTime ? format(item.endTime, "HH:mm") : '');
  };

  const handleSaveEdit = async (item: FeedingHistoryItem) => {
    const dateStr = item.date;
    const [sh, sm] = editStartTime.split(':').map(Number);
    const newStart = new Date(item.startTime);
    newStart.setHours(sh, sm, 0, 0);

    const updates: any = { start_time: newStart.toISOString() };
    if (editEndTime) {
      const [eh, em] = editEndTime.split(':').map(Number);
      const newEnd = new Date(item.startTime);
      newEnd.setHours(eh, em, 0, 0);
      updates.end_time = newEnd.toISOString();
    }

    const result = await updateLog(item.id, updates);
    if (!result.error) {
      toast({ title: tr("feedinghistorypanel_qeyd_yenilendi_816afb", 'Qeyd yeniləndi') });
      setEditingId(null);
    } else {
      toast({ title: tr("feedinghistorypanel_xeta_bas_verdi_f22fba", 'Xəta baş verdi'), variant: 'destructive' });
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
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--a-grad-peach)' }}>
            <Baby className="w-4 h-4" style={{ color: 'var(--a-accent-ink)' }} />
          </div>
          <div className="text-start">
            <p className="text-xs font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>{tr("feedinghistorypanel_qidalanma_xulasesi_836869", "Qidalanma xülasəsi")}</p>
            <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{buildSummaryText()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasAnyFeedings && (
            <div className="text-end me-2">
              <p className="text-xs font-bold" style={{ margin: 0, color: 'var(--a-accent-ink)' }}>{totalFeedings} {tr('feedinghistorypanel_times','dəfə')}</p>
              <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr("feedinghistorypanel_bu_gun_7d7f30", "bu gün")}</p>
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
              {hasAnyFeedings && (
                <div className="grid grid-cols-2 gap-2">
                  {todayBreakdown.leftCount > 0 && (
                    <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--a-peach-1)' }}>
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <ArrowLeft className="rtl:rotate-180 w-3 h-3" style={{ color: 'var(--a-accent-ink)' }} />
                        <span className="text-xs font-bold" style={{ color: 'var(--a-accent-ink)' }}>{tr("feedinghistorypanel_sol_sine_64d1ac", "Sol sinə")}</span>
                      </div>
                      <p className="text-sm font-bold" style={{ margin: 0, color: 'var(--a-accent-ink)' }}>{formatDuration(todayBreakdown.leftTotalSeconds)}</p>
                      <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-accent-ink)', opacity: 0.7 }}>{todayBreakdown.leftCount} {tr('feedinghistorypanel_times','dəfə')}</p>
                    </div>
                  )}
                  {todayBreakdown.rightCount > 0 && (
                    <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--a-peach-1)' }}>
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="text-xs font-bold" style={{ color: 'var(--a-accent-ink)' }}>{tr("feedinghistorypanel_sag_sine_074475", "Sağ sinə")}</span>
                        <ArrowRight className="rtl:rotate-180 w-3 h-3" style={{ color: 'var(--a-accent-ink)' }} />
                      </div>
                      <p className="text-sm font-bold" style={{ margin: 0, color: 'var(--a-accent-ink)' }}>{formatDuration(todayBreakdown.rightTotalSeconds)}</p>
                      <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-accent-ink)', opacity: 0.7 }}>{todayBreakdown.rightCount} {tr('feedinghistorypanel_times','dəfə')}</p>
                    </div>
                  )}
                  {todayBreakdown.formulaCount > 0 && (
                    <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--a-blue-1)' }}>
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="text-lg">🍼</span>
                        <span className="text-xs font-bold" style={{ color: 'var(--a-blue-ink)' }}>{tr("feedinghistorypanel_suni_qida_fdf267", "Süni qida")}</span>
                      </div>
                      <p className="text-sm font-bold" style={{ margin: 0, color: 'var(--a-blue-ink)' }}>{todayBreakdown.formulaCount} {tr('feedinghistorypanel_times','dəfə')}</p>
                      <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-blue-ink)', opacity: 0.7 }}>{tr("feedinghistorypanel_bu_gun_7d7f30", "bu gün")}</p>
                    </div>
                  )}
                  {todayBreakdown.solidCount > 0 && (
                    <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--a-green-1)' }}>
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="text-lg">🥣</span>
                        <span className="text-xs font-bold" style={{ color: 'var(--a-green-ink)' }}>{tr("feedinghistorypanel_elave_qida_ac1beb", "Əlavə qida")}</span>
                      </div>
                      <p className="text-sm font-bold" style={{ margin: 0, color: 'var(--a-green-ink)' }}>{todayBreakdown.solidCount} {tr('feedinghistorypanel_times','dəfə')}</p>
                      <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-green-ink)', opacity: 0.7 }}>{tr("feedinghistorypanel_bu_gun_7d7f30", "bu gün")}</p>
                    </div>
                  )}
                </div>
              )}


              {historyArray.map(([date, items]) => (
                <div key={date} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold" style={{ margin: 0, color: 'var(--a-ink)' }}>{getDateLabel(date)}</p>
                    <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{items.length} {tr('feedinghistorypanel_feedings_count','qidalanma')}</p>
                  </div>
                  
                  {items.length === 0 ? (
                    <p className="text-xs text-center py-2" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>{tr('feedinghistorypanel_no_records','Qeyd yoxdur')}</p>
                  ) : (
                    <div className="space-y-1">
                      {items.map((item) => (
                        <div key={item.id} className="relative">
                          {/* Delete confirmation */}
                          {deletingId === item.id ? (
                            <div className="flex items-center justify-between rounded-lg px-2.5 py-2" style={{ background: 'var(--a-pink-1)' }}>
                              <span className="text-xs font-semibold" style={{ color: 'var(--a-pink-ink)' }}>{tr("feedinghistorypanel_silmek_isteyirsiniz_77af6b", "Silmək istəyirsiniz?")}</span>
                              <div className="flex gap-1.5">
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-full" style={{ background: 'var(--a-pink-2)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                  <Check className="w-3 h-3" />
                                </button>
                                <button onClick={() => setDeletingId(null)} className="p-1.5 rounded-full" style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-pink-ink)', border: 'none', cursor: 'pointer' }}>
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ) : editingId === item.id ? (
                            <div className="rounded-lg px-2.5 py-2 space-y-2" style={{ background: 'var(--a-peach-1)' }}>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{getFeedTypeEmoji(item.feedType)}</span>
                                <span className="text-xs font-semibold" style={{ color: 'var(--a-accent-ink)' }}>{getFeedTypeLabel(item.feedType)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={editStartTime}
                                  onChange={(e) => setEditStartTime(e.target.value)}
                                  className="text-xs rounded px-2 py-1 w-24"
                                  style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line-strong)', color: 'var(--a-ink)' }}
                                />
                                <span className="text-xs" style={{ color: 'var(--a-accent-ink)' }}>-</span>
                                <input
                                  type="time"
                                  value={editEndTime}
                                  onChange={(e) => setEditEndTime(e.target.value)}
                                  className="text-xs rounded px-2 py-1 w-24"
                                  style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line-strong)', color: 'var(--a-ink)' }}
                                />
                              </div>
                              <div className="flex justify-end gap-1.5">
                                <button onClick={() => handleSaveEdit(item)} className="p-1.5 rounded-full" style={{ background: 'var(--a-green-2)', color: '#fff', border: 'none', cursor: 'pointer' }}>
                                  <Check className="w-3 h-3" />
                                </button>
                                <button onClick={() => setEditingId(null)} className="p-1.5 rounded-full" style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-accent-ink)', border: 'none', cursor: 'pointer' }}>
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 group" style={{ background: 'var(--a-surface-soft)' }}>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{getFeedTypeEmoji(item.feedType)}</span>
                                <div>
                                  <p className="text-xs font-semibold" style={{ margin: 0, color: 'var(--a-ink)' }}>
                                    {item.feedType === 'solid' && item.notes ? item.notes : getFeedTypeLabel(item.feedType)}
                                    {item.feedType === 'formula' && item.notes && item.notes.includes('ml') && (
                                      <span className="ms-1 font-bold" style={{ color: 'var(--a-accent-ink)' }}>({item.notes})</span>
                                    )}
                                  </p>
                                  <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-ink-soft)' }}>
                                    {format(item.startTime, 'HH:mm')}
                                    {item.endTime && ` - ${format(item.endTime, 'HH:mm')}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1" style={{ color: 'var(--a-accent-ink)' }}>
                                  <Clock className="w-3 h-3" />
                                  <span className="text-xs font-bold">{formatDuration(item.durationSeconds)}</span>
                                </div>
                                <div className="flex gap-0.5">
                                  <button onClick={() => handleEdit(item)} className="p-1 rounded" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-ink-soft)' }}>
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setDeletingId(item.id)} className="p-1 rounded" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--a-pink-ink)' }}>
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
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

export default FeedingHistoryPanel;

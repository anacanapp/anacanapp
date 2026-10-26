import { useState } from 'react';
import { motion } from 'framer-motion';
import { Droplet, Plus, TrendingUp, Trash2, AlertTriangle, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isYesterday, subDays } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { tr } from "@/lib/tr";
import MedicalDisclaimer from '@/components/MedicalDisclaimer';
import { ToolPage, ToolHeader, ToolEmpty } from './anacan/ToolKit';

interface BloodSugarTrackerProps {
  onBack: () => void;
}

interface BloodSugarLog {
  id: string;
  user_id: string;
  reading_value: number;
  reading_type: string;
  meal_context: string | null;
  notes: string | null;
  logged_at: string;
  created_at: string;
}

const readingTypes = [
{ id: 'fasting', label: tr("bloodsugartracker_acliq_b6d5ee", 'Aclıq'), emoji: '🌅', description: tr("bloodsugartracker_seher_tezden_yemekden_evvel_3f58e4", 'Səhər tezdən, yeməkdən əvvəl') },
{ id: 'before_meal', label: tr("bloodsugartracker_yemekden_evvel_167a3d", 'Yeməkdən əvvəl'), emoji: '🍽️', description: tr("bloodsugartracker_yemekden_30_deq_evvel_266704", 'Yeməkdən 30 dəq əvvəl') },
{ id: 'after_meal', label: tr("bloodsugartracker_yemekden_sonra_56238e", 'Yeməkdən sonra'), emoji: '⏰', description: tr("bloodsugartracker_yemekden_2_saat_sonra_c59165", 'Yeməkdən 2 saat sonra') },
{ id: 'bedtime', label: tr("bloodsugartracker_yatmazdan_evvel_a457fa", 'Yatmazdan əvvəl'), emoji: '🌙', description: tr("bloodsugartracker_gece_yatmaq_ucun_34ca83", 'Gecə yatmaq üçün') },
{ id: 'random', label: tr("bloodsugartracker_tesadufi_98c20c", 'Təsadüfi'), emoji: '📊', description: tr("bloodsugartracker_i_stenilen_vaxt_ec15be", 'İstənilən vaxt') }];


const mealContexts = [
{ id: 'breakfast', label: tr("bloodsugartracker_seher_yemeyi_b82929", 'Səhər yeməyi'), emoji: '🥞' },
{ id: 'lunch', label: tr("bloodsugartracker_nahar", 'Nahar'), emoji: '🍲' },
{ id: 'dinner', label: tr("bloodsugartracker_sam_yemeyi_6002e9", 'Şam yeməyi'), emoji: '🍛' },
{ id: 'snack', label: tr("bloodsugartracker_qelyanalti_42fb71", 'Qəlyanaltı'), emoji: '🍎' }];


// Blood sugar level thresholds (mg/dL) → anacan design palette
const getReadingStatus = (value: number, type: string) => {
  if (type === 'fasting') {
    if (value < 70) return { status: 'low', label: tr("bloodsugartracker_asagi_1c27f1", 'Aşağı'), ink: 'var(--a-blue-ink)', bg: 'var(--a-blue-1)' };
    if (value <= 95) return { status: 'normal', label: tr("common_normal", 'Normal'), ink: 'var(--a-green-ink)', bg: 'var(--a-green-1)' };
    if (value <= 125) return { status: 'elevated', label: tr("bloodsugartracker_yukselmis_1fee34", 'Yüksəlmiş'), ink: 'var(--a-warn-ink)', bg: 'var(--a-yellow-1)' };
    return { status: 'high', label: tr("bloodsugartracker_yuksek_492584", 'Yüksək'), ink: 'var(--a-pink-ink)', bg: 'var(--a-pink-1)' };
  } else {
    if (value < 70) return { status: 'low', label: tr("bloodsugartracker_asagi_1c27f1", 'Aşağı'), ink: 'var(--a-blue-ink)', bg: 'var(--a-blue-1)' };
    if (value <= 140) return { status: 'normal', label: tr("common_normal", 'Normal'), ink: 'var(--a-green-ink)', bg: 'var(--a-green-1)' };
    if (value <= 180) return { status: 'elevated', label: tr("bloodsugartracker_yukselmis_1fee34", 'Yüksəlmiş'), ink: 'var(--a-warn-ink)', bg: 'var(--a-yellow-1)' };
    return { status: 'high', label: tr("bloodsugartracker_yuksek_492584", 'Yüksək'), ink: 'var(--a-pink-ink)', bg: 'var(--a-pink-1)' };
  }
};

// Small status pill using the design palette
const StatusTag = ({ value, type }: {value: number;type: string;}) => {
  const s = getReadingStatus(value, type);
  return (
    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: s.bg, color: s.ink }}>
      {s.label}
    </span>);

};

const BloodSugarTracker = ({ onBack }: BloodSugarTrackerProps) => {
  useScrollToTop();
  useScreenAnalytics('BloodSugarTracker', 'Tools');

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newReading, setNewReading] = useState('');
  const [selectedType, setSelectedType] = useState('random');
  const [selectedMeal, setSelectedMeal] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['blood-sugar-logs', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.
      from('blood_sugar_logs').
      select('*').
      eq('user_id', user.id).
      order('logged_at', { ascending: false }).
      limit(100);
      if (error) throw error;
      return data as BloodSugarLog[];
    },
    enabled: !!user?.id
  });

  const addLogMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !newReading) throw new Error(tr("bloodsugartracker_melumat_yoxdur_a3e271", "M\u0259lumat yoxdur"));

      const { error } = await supabase.
      from('blood_sugar_logs').
      insert({
        user_id: user.id,
        reading_value: parseFloat(newReading),
        reading_type: selectedType,
        meal_context: selectedMeal,
        notes: notes || null
      });
      if (error) throw error;

      // Health inteqrasiyası aktivdirsə → Apple Health / Health Connect-ə də yaz (arxa planda)
      import('@/lib/healthVitals').then((m) => m.writeBloodGlucoseToHealth(parseFloat(newReading))).catch(() => {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blood-sugar-logs'] });
      setShowAddModal(false);
      setNewReading('');
      setSelectedType('random');
      setSelectedMeal(null);
      setNotes('');
      toast({ title: tr("bloodsugartracker_qeyd_elave_edildi_c5012e", 'Qeyd əlavə edildi'), description: tr("bloodsugartracker_qan_sekeri_seviyyesi_ugurla_qeyd_edildi_cb5736", 'Qan şəkəri səviyyəsi uğurla qeyd edildi') });
    },
    onError: () => {
      toast({ title: tr("bloodsugartracker_xeta_3cdbb6", 'Xəta'), description: tr("bloodsugartracker_qeyd_elave_edile_bilmedi_c1e5e5", 'Qeyd əlavə edilə bilmədi'), variant: 'destructive' });
    }
  });

  const deleteLogMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.
      from('blood_sugar_logs').
      delete().
      eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blood-sugar-logs'] });
      toast({ title: tr("common_silindi", 'Silindi'), description: tr("bloodsugartracker_qeyd_silindi", 'Qeyd silindi') });
    }
  });

  // Calculate statistics
  const todayLogs = logs.filter((log) => isToday(new Date(log.logged_at)));
  const weekLogs = logs.filter((log) => new Date(log.logged_at) >= subDays(new Date(), 7));

  const avgToday = todayLogs.length > 0 ?
  Math.round(todayLogs.reduce((sum, log) => sum + log.reading_value, 0) / todayLogs.length) :
  null;

  const avgWeek = weekLogs.length > 0 ?
  Math.round(weekLogs.reduce((sum, log) => sum + log.reading_value, 0) / weekLogs.length) :
  null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return tr("bloodsugartracker_bu_gun_786fd4", "Bu g\xFCn");
    if (isYesterday(date)) return tr("bloodsugartracker_dunen_52b701", "D\xFCn\u0259n");
    return format(date, 'd MMM', { locale: getCurrentDateLocale() });
  };

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={tr("bloodsugartracker_seviyyeni_izleyin_1b70d5", "Səviyyəni izləyin")}
        title={tr("bloodsugartracker_qan_sekeri_b9a2cc", "Qan Şəkəri")}
        actions={
        <motion.button
          onClick={() => setShowAddModal(true)}
          className="a-icon-btn"
          style={{ background: 'var(--a-peach-2)', color: '#fff', border: 'none' }}
          whileTap={{ scale: 0.9 }}>
          
            <Plus size={17} strokeWidth={2.4} />
          </motion.button>
        } />

      <MedicalDisclaimer variant="compact" />

      {/* Stats */}
      <div className="a-grid-2" style={{ marginTop: 12 }}>
        <motion.div
          className="a-stat-tile"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}>
          
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-grad-pink)', color: 'var(--a-berry-ink)' }}>
            <Droplet size={15} />
          </span>
          <div>
            <p className="a-stat-tile-label">{tr("bloodsugartracker_bu_gun_orta_96f2fa", "Bu gün orta")}</p>
            <p className="a-stat-tile-value">
              {avgToday ? `${avgToday} mg/dL` : '—'}
            </p>
            {avgToday && <div style={{ marginTop: 3 }}><StatusTag value={avgToday} type="random" /></div>}
          </div>
        </motion.div>

        <motion.div
          className="a-stat-tile"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}>
          
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
            <TrendingUp size={15} />
          </span>
          <div>
            <p className="a-stat-tile-label">{tr("bloodsugartracker_heftelik_orta_f3a738", "Həftəlik orta")}</p>
            <p className="a-stat-tile-value">
              {avgWeek ? `${avgWeek} mg/dL` : '—'}
            </p>
            <p className="a-stat-tile-label">{weekLogs.length} {tr("bloodsugartracker_olcme_6aff0d", "\xF6l\xE7m\u0259")}</p>
          </div>
        </motion.div>
      </div>

      {/* Info Card */}
      <div className="a-today-info-tip" style={{ marginTop: 12 }}>
        <AlertTriangle size={14} />
        <span>
          <strong>{tr("bloodsugartracker_hamilelik_zamani_normal_seviyyeler_458722", "Hamiləlik zamanı normal səviyyələr:")}</strong>
          <br />{tr("bloodsugartracker_acliq_70_95_mg_dl_d4ac37", "• Aclıq: 70-95 mg/dL")}
          <br />{tr("bloodsugartracker_yemekden_2_saat_sonra_lt_140_mg_dl_8efae2", "• Yeməkdən 2 saat sonra: &lt;140 mg/dL")}
        </span>
      </div>

      {/* Logs List */}
      <section className="a-section">
        <div className="a-section-head">
          <h2 className="a-section-title a-heading" style={{ fontSize: 15 }}>{tr("bloodsugartracker_son_olcmeler_b024cf", "Son ölçmələr")}</h2>
          <span className="a-section-link">{logs.length}</span>
        </div>
        
        {isLoading ?
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) =>
          <div key={i} className="a-card animate-pulse">
                <div style={{ height: 14, width: '33%', borderRadius: 8, background: 'var(--a-surface-soft)', marginBottom: 8 }} />
                <div style={{ height: 20, width: '25%', borderRadius: 8, background: 'var(--a-surface-soft)' }} />
              </div>
          )}
          </div> :
        logs.length === 0 ?
        <ToolEmpty
          icon={<Droplet size={26} style={{ color: 'var(--a-pink-2)' }} />}
          title={tr("bloodsugartracker_hele_hec_bir_qeyd_yoxdur_463107", "Hələ heç bir qeyd yoxdur")}
          text={tr("bloodsugartracker_ilk_olcmenizi_elave_edin_c94d74", "İlk ölçmənizi əlavə edin")} /> :

        <div className="a-list-card">
            {logs.map((log, index) => {
            const status = getReadingStatus(log.reading_value, log.reading_type);
            const typeInfo = readingTypes.find((t) => t.id === log.reading_type);
            const mealInfo = mealContexts.find((m) => m.id === log.meal_context);

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
                className="a-list-row"
                style={{ display: 'block' }}>
                
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                      <span className="a-list-icon" style={{ background: status.bg, fontSize: 17 }}>
                        {typeInfo?.emoji || '📊'}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <p className="a-list-title" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {log.reading_value} <span className="a-list-time" style={{ margin: 0 }}>mg/dL</span>
                          <StatusTag value={log.reading_value} type={log.reading_type} />
                        </p>
                        <p className="a-list-sub">
                          {typeInfo?.label}
                          {mealInfo && <> · {mealInfo.emoji} {mealInfo.label}</>}
                        </p>
                      </div>
                    </div>
                    <span className="a-list-trail" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>
                        <p className="a-list-value">{formatDate(log.logged_at)}</p>
                        <p className="a-list-time">{format(new Date(log.logged_at), 'HH:mm')}</p>
                      </span>
                      <button
                      className="a-icon-btn"
                      style={{ width: 30, height: 30 }}
                      onClick={() => deleteLogMutation.mutate(log.id)}>
                      
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </span>
                  </div>
                  {log.notes &&
                <p className="a-list-time" style={{ marginTop: 6, whiteSpace: 'normal' }}>📝 {log.notes}</p>
                }
                </motion.div>);

          })}
          </div>
        }
      </section>

      {/* Add Modal */}
      {showAddModal &&
      <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="a-scope w-full max-w-md p-5 max-h-[85vh] overflow-y-auto"
          style={{ background: 'var(--a-surface)', borderRadius: 'var(--a-radius-lg)', boxShadow: 'var(--a-card-shadow)', paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 16px)' }}>
          
            <div className="a-card-head">
              <h2 className="a-card-title a-heading" style={{ fontSize: 16 }}>{tr("bloodsugartracker_yeni_olcme_cc2042", "Yeni ölçmə")}</h2>
              <button className="a-icon-btn" style={{ width: 32, height: 32 }} onClick={() => setShowAddModal(false)}>
                <X size={15} />
              </button>
            </div>

            {/* Reading Value */}
            <div className="mb-3">
              <label className="a-stat-tile-label" style={{ display: 'block', marginBottom: 6 }}>{tr("bloodsugartracker_qan_sekeri_seviyyesi_mg_dl_cb75a9", "Qan şəkəri səviyyəsi (mg/dL)")}</label>
              <input
              type="number"
              inputMode="decimal"
              value={newReading}
              onChange={(e) => setNewReading(e.target.value)}
              placeholder={tr("bloodsugartracker_meselen_95_23137b", "Məsələn: 95")}
              className="a-input w-full text-center"
              style={{ height: 52, fontSize: 22, fontWeight: 800 }} />
            
              {newReading &&
            <div className="mt-2 text-center">
                  <StatusTag value={parseFloat(newReading)} type={selectedType} />
                </div>
            }
            </div>

            {/* Reading Type */}
            <div className="mb-3">
              <label className="a-stat-tile-label" style={{ display: 'block', marginBottom: 6 }}>{tr("bloodsugartracker_olcme_novu_0d8219", "Ölçmə növü")}</label>
              <div className="grid grid-cols-2 gap-1.5">
                {readingTypes.map((type) =>
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className="flex items-center text-start transition-all"
                style={{
                  padding: 9,
                  borderRadius: 14,
                  border: selectedType === type.id ? '1.5px solid var(--a-peach-2)' : '1.5px solid var(--a-line)',
                  background: selectedType === type.id ? 'var(--a-tag-on-bg)' : 'var(--a-surface-soft)',
                  cursor: 'pointer'
                }}>
                
                    <span className="text-base me-2">{type.emoji}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--a-ink)' }}>{type.label}</span>
                  </button>
              )}
              </div>
            </div>

            {/* Meal Context (optional) */}
            {(selectedType === 'before_meal' || selectedType === 'after_meal') &&
          <div className="mb-3">
                <label className="a-stat-tile-label" style={{ display: 'block', marginBottom: 6 }}>{tr("bloodsugartracker_yemek_b1fd56", "Yemək")}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {mealContexts.map((meal) =>
              <button
                key={meal.id}
                onClick={() => setSelectedMeal(selectedMeal === meal.id ? null : meal.id)}
                className="text-center transition-all"
                style={{
                  padding: 7,
                  borderRadius: 14,
                  border: selectedMeal === meal.id ? '1.5px solid var(--a-peach-2)' : '1.5px solid var(--a-line)',
                  background: selectedMeal === meal.id ? 'var(--a-tag-on-bg)' : 'var(--a-surface-soft)',
                  cursor: 'pointer'
                }}>
                
                      <span className="text-lg block mb-0.5">{meal.emoji}</span>
                      <span style={{ fontSize: 9, lineHeight: 1.2, display: 'block', fontWeight: 600, color: 'var(--a-ink)' }}>{meal.label}</span>
                    </button>
              )}
                </div>
              </div>
          }

            {/* Notes */}
            <div className="mb-4">
              <label className="a-stat-tile-label" style={{ display: 'block', marginBottom: 6 }}>{tr("bloodsugartracker_qeyd_isteye_bagli_96c689", "Qeyd (istəyə bağlı)")}</label>
              <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={tr("bloodsugartracker_elave_qeydler_c55f23", "Əlavə qeydlər...")}
              className="a-input w-full resize-none"
              style={{ height: 64 }} />
            
            </div>

            <button
            className="a-btn-solid w-full"
            style={{ justifyContent: 'center', padding: '13px 18px', opacity: !newReading || addLogMutation.isPending ? 0.45 : 1 }}
            disabled={!newReading || addLogMutation.isPending}
            onClick={() => addLogMutation.mutate()}>
            
              {addLogMutation.isPending ? tr("bloodsugartracker_elave_edilir_3c28b4", "Əlavə edilir...") : tr("bloodsugartracker_qeyd_et_3c7a2d", "Qeyd et")}
            </button>
          </motion.div>
        </div>
      }
    </ToolPage>);

};

export default BloodSugarTracker;
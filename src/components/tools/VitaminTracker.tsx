import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pill, Check, Clock, Bell, BellOff, Trash2, X, ChevronDown } from 'lucide-react';
import { ToolPage, ToolHeader, ToolEmpty } from './anacan/ToolKit';
import { useVitaminSchedules, VitaminSchedule } from '@/hooks/useVitaminSchedules';
import { toast } from 'sonner';
import { hapticFeedback } from '@/lib/native';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { tr, mapRowTranslation } from "@/lib/tr";
import { weekdayLabels } from '@/lib/date-utils';
import { NEW_LANGUAGE_CODES } from '@/lib/app-languages';
import MedicalDisclaimer from '@/components/MedicalDisclaimer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

interface VitaminTrackerProps {
  onBack?: () => void;
}

const VITAMIN_PRESETS = [
{ name: tr("vitamintracker_folat_fol_tursusu_941d76", "Folat (Fol turşusu)"), emoji: '🟢' },
{ name: tr("vitamintracker_d_vitamini", "D vitamini"), emoji: '☀️' },
{ name: tr("vitamintracker_demir_30bf6c", "Dəmir"), emoji: '🔴' },
{ name: tr("vitamintracker_kalsium", "Kalsium"), emoji: '🦴' },
{ name: tr("vitamintracker_omega_3", "Omega-3"), emoji: '🐟' },
{ name: tr("vitamintracker_b12_vitamini", "B12 vitamini"), emoji: '💜' },
{ name: tr("vitamintracker_c_vitamini", "C vitamini"), emoji: '🍊' },
{ name: tr("vitamintracker_maqnezium", "Maqnezium"), emoji: '💎' },
{ name: tr("vitamintracker_sink", "Sink"), emoji: '⚡' },
{ name: tr("vitamintracker_yod", "Yod"), emoji: '🌊' },
{ name: tr("vitamintracker_prenatal_vitamin", "Prenatal vitamin"), emoji: '💊' },
{ name: tr("vitamintracker_probiotik", "Probiotik"), emoji: '🦠' }];


const getDayLabels = (language: string) => {
  if ((NEW_LANGUAGE_CODES as readonly string[]).includes(language)) return weekdayLabels(language);
  if (language === 'en') return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (language === 'ru') return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  if (language === 'tr') return ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  if (language === 'kk') return ['Жс', 'Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб'];
  if (language === 'uz') return ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh'];
  if (language === 'ka') return ['კვ', 'ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა'];
  if (language === 'de') return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  if (language === 'ar') return ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];
  return ['B', 'B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş'];
};

const VitaminTracker = ({ onBack }: VitaminTrackerProps) => {
  const language = useUserStore((state) => state.language);
  
  const { data: dbVitamins = [] } = useQuery({
    queryKey: ['all_raw_vitamins', language],
    queryFn: async () => {
      // select('*') — yeni dil sütunları (name_kk və s.) əlavə olunanda kod dəyişmir;
      // konkret siyahı olsaydı, sütun DB-yə çatmamış 400 verərdi
      const { data } = await supabase.from('vitamins').select('*').eq('is_active', true);
      return (data || []) as any[];
    },
    staleTime: 1000 * 60 * 60,
  });

  // Vitamin adını istifadəçi dilində qaytar (kk/uz/ka→ru, de/ar→en körpüsü)
  const locVitName = (v: any): string => mapRowTranslation(v, language, ['name'])?.name || '';

  const dynamicPresets = dbVitamins.length > 0 ? dbVitamins.map(v => ({
    name: locVitName(v),
    emoji: v.icon_emoji || '💊'
  })) : VITAMIN_PRESETS;

  const getTranslatedVitaminName = (savedName: string) => {
    if (!savedName) return savedName;
    const normalized = savedName.trim().toLowerCase();
    
    const dbVit = dbVitamins.find(v => 
      (v.name && v.name.toLowerCase() === normalized) || 
      (v.name_az && v.name_az.toLowerCase() === normalized)
    );
    
    if (dbVit) {
      return locVitName(dbVit);
    }
    
    if (normalized === 'folat (fol turşusu)' || normalized === 'folate (folic acid)') return tr("vitamintracker_folat_fol_tursusu_941d76", "Folat (Fol turşusu)");
    if (normalized === 'd vitamini' || normalized === 'vitamin d') return tr("vitamintracker_d_vitamini", "D vitamini");
    if (normalized === 'dəmir' || normalized === 'iron') return tr("vitamintracker_demir_30bf6c", "Dəmir");
    if (normalized === 'kalsium' || normalized === 'calcium') return tr("vitamintracker_kalsium", "Kalsium");
    if (normalized === 'omega-3') return tr("vitamintracker_omega_3", "Omega-3");
    if (normalized === 'b12 vitamini' || normalized === 'vitamin b12') return tr("vitamintracker_b12_vitamini", "B12 vitamini");
    if (normalized === 'c vitamini' || normalized === 'vitamin c') return tr("vitamintracker_c_vitamini", "C vitamini");
    if (normalized === 'maqnezium' || normalized === 'magnesium') return tr("vitamintracker_maqnezium", "Maqnezium");
    if (normalized === 'sink' || normalized === 'zinc') return tr("vitamintracker_sink", "Sink");
    if (normalized === 'yod' || normalized === 'iodine') return tr("vitamintracker_yod", "Yod");
    if (normalized === 'prenatal vitamin') return tr("vitamintracker_prenatal_vitamin", "Prenatal vitamin");
    if (normalized === 'probiotik' || normalized === 'probiotic') return tr("vitamintracker_probiotik", "Probiotik");
    
    return savedName;
  };

  useScreenAnalytics('VitaminTracker', 'Tools');
  const {
    schedules, isLoading, addSchedule, updateSchedule, deleteSchedule,
    logIntake, undoIntake, isVitaminTakenToday, getIntakeLog
  } = useVitaminSchedules();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [newVitamin, setNewVitamin] = useState({ name: '', emoji: '💊', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], notification: true });

  const handleAdd = async () => {
    if (!newVitamin.name.trim()) {
      toast.error(tr("vitamintracker_vitamin_adini_daxil_edin_3784af", "Vitamin ad\u0131n\u0131 daxil edin"));
      return;
    }
    try {
      await addSchedule.mutateAsync({
        vitamin_name: newVitamin.name,
        icon_emoji: newVitamin.emoji,
        scheduled_time: newVitamin.time + ':00',
        days_of_week: newVitamin.days,
        notification_enabled: newVitamin.notification
      });
      toast.success(tr("vitamintracker_vitamin_elave_edildi_b2e88b", "Vitamin \u0259lav\u0259 edildi"));
      setShowAddModal(false);
      setNewVitamin({ name: '', emoji: '💊', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], notification: true });
    } catch {
      toast.error(tr("vitamintracker_xeta_bas_verdi_f22fba", "X\u0259ta ba\u015F verdi"));
    }
  };

  const handleToggleTaken = async (schedule: VitaminSchedule) => {
    await hapticFeedback.light();
    const taken = isVitaminTakenToday(schedule.id);
    if (taken) {
      const log = getIntakeLog(schedule.id);
      if (log) await undoIntake.mutateAsync(log.id);
    } else {
      await logIntake.mutateAsync(schedule);
      toast.success(`${getTranslatedVitaminName(schedule.vitamin_name)} ${tr("vitamintracker_taken_status", "qəbul edildi ✓")}`);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSchedule.mutateAsync(id);
    toast.success(tr("vitamintracker_vitamin_deleted", "Vitamin silindi"));
  };

  const handleToggleNotification = async (schedule: VitaminSchedule) => {
    await updateSchedule.mutateAsync({
      id: schedule.id,
      notification_enabled: !schedule.notification_enabled
    });
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    return `${h}:${m}`;
  };

  const activeSchedules = schedules.filter((s) => s.is_active);
  const takenCount = activeSchedules.filter((s) => isVitaminTakenToday(s.id)).length;
  const totalCount = activeSchedules.length;
  const progress = totalCount > 0 ? takenCount / totalCount * 100 : 0;

  const toggleDay = (day: number) => {
    setNewVitamin((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day].sort()
    }));
  };

  return (
    <ToolPage className="pb-32">
      <ToolHeader
        onBack={onBack}
        eyebrow={<>{tr("vitamintracker_bugunku_qebul_ae152d", "Bugünkü qəbul")}: {takenCount}/{totalCount}</>}
        title={tr("vitamintracker_vitamin_izleyicisi_049643", "Vitamin İzləyicisi")}
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

      {/* Progress Card */}
      <motion.div
        className="a-cta a-fade-in"
        style={{ background: 'var(--a-grad-green)', marginTop: 12 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}>
        
        <span className="a-cta-shape" style={{ width: 110, height: 110, top: -40, insetInlineEnd: -30, background: 'rgba(255,255,255,0.35)' }} />
        <div className="a-cta-top">
          <span className="a-cta-badge" style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-green-ink)' }}>
            💊 {tr("vitamintracker_bugunku_qebul_ae152d", "Bugünkü qəbul")}
          </span>
          <span className="a-cta-deco" style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-green-ink)' }}>
            <Pill size={18} strokeWidth={2} />
          </span>
        </div>
        {/* Dark mode düzəlişi: #14532d/rgba(20,83,45,x) hardcode-ları dark modda
            --a-grad-green-in tünd tint-inə qarşı demək olar oxunmurdu —
            var(--a-green-ink) istifadə olunur (dark-da avtomatik ağ olur). */}
        <h2 className="a-cta-title a-heading" style={{ color: 'var(--a-green-ink)', fontSize: 28, margin: '12px 0 10px' }}>{takenCount}/{totalCount}</h2>
        <div className="relative" style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.4)', overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', borderRadius: 999, background: 'var(--a-green-ink)' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }} />
          
        </div>
        {totalCount > 0 && takenCount === totalCount &&
        <p className="a-cta-text" style={{ position: 'relative', marginTop: 10, color: 'color-mix(in srgb, var(--a-green-ink) 85%, transparent)', fontWeight: 600 }}>{tr("vitamintracker_butun_vitaminler_qebul_edildi_87d9d1", "🎉 Bütün vitaminlər qəbul edildi!")}</p>
        }
      </motion.div>

      {/* Vitamin List */}
      <div style={{ marginTop: 12 }}>
        {isLoading ?
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map((i) =>
          <div key={i} className="a-card animate-pulse" style={{ height: 76 }} />
          )}
          </div> :
        activeSchedules.length === 0 ?
        <ToolEmpty
          icon={<Pill size={26} style={{ color: 'var(--a-peach-2)' }} />}
          title={tr("vitamintracker_vitamin_elave_edin_3a46b1", "Vitamin əlavə edin")}
          text={tr("vitamintracker_gundelik_vitamin_qebulunuzu_izleyin_f8d5c5", "Gündəlik vitamin qəbulunuzu izləyin")}
          action={
          <button onClick={() => setShowAddModal(true)} className="a-cta-btn">
              {tr("vitamintracker_vitamin_elave_et_287d28", "+ Vitamin \u0259lav\u0259 et")}
            </button>
          } /> :

        <div className="a-list-card">
            {activeSchedules.map((schedule, idx) => {
            const taken = isVitaminTakenToday(schedule.id);
            return (
              <motion.div
                key={schedule.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                className="a-list-row"
                style={taken ? { background: 'var(--a-green-1)' } : undefined}>
                
                  {/* Check button */}
                  <motion.button
                  onClick={() => handleToggleTaken(schedule)}
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 42, height: 42, borderRadius: 13, cursor: 'pointer',
                    ...(taken ?
                    { background: 'var(--a-green-2)', border: 'none', boxShadow: '0 8px 16px -8px rgba(99, 189, 139, 0.8)' } :
                    { background: 'var(--a-surface-soft)', border: '2px dashed var(--a-line-strong)' })
                  }}
                  whileTap={{ scale: 0.85 }}>
                  
                    {taken ?
                  <Check size={18} strokeWidth={2.5} style={{ color: '#fff' }} /> :

                  <span className="text-xl">{schedule.icon_emoji}</span>
                  }
                  </motion.button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="a-list-title" style={taken ? { color: 'var(--a-green-ink)', textDecoration: 'line-through' } : undefined}>
                      {getTranslatedVitaminName(schedule.vitamin_name)}
                    </p>
                    <p className="a-list-sub" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={11} />
                      {formatTime(schedule.scheduled_time)}
                      {schedule.notification_enabled && <Bell size={11} style={{ color: 'var(--a-peach-2)' }} />}
                    </p>
                  </div>

                  {/* Actions */}
                  <span className="a-list-trail" style={{ display: 'flex', gap: 6 }}>
                    <button
                    onClick={() => handleToggleNotification(schedule)}
                    className="a-icon-btn"
                    style={{ width: 30, height: 30 }}>
                    
                      {schedule.notification_enabled ?
                    <Bell size={13} style={{ color: 'var(--a-peach-2)' }} /> :

                    <BellOff size={13} />
                    }
                    </button>
                    <button
                    onClick={() => handleDelete(schedule.id)}
                    className="a-icon-btn"
                    style={{ width: 30, height: 30, background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)', border: 'none' }}>
                      <Trash2 size={13} strokeWidth={2} />
                    </button>
                  </span>
                </motion.div>);
            })}
          </div>
        }
      </div>
      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal &&
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}>
          
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
            <motion.div
            className="a-scope relative w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
            style={{ background: 'var(--a-surface)', borderRadius: 'var(--a-radius-lg)', boxShadow: 'var(--a-card-shadow)' }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
            
              <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--a-line)' }}>
                <h2 className="a-card-title a-heading" style={{ fontSize: 16 }}>{tr("vitamintracker_vitamin_elave_et_ba4a9c", "Vitamin Əlavə Et")}</h2>
                <button onClick={() => setShowAddModal(false)} className="a-icon-btn" style={{ width: 32, height: 32 }}>
                  <X size={15} />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                {/* Presets */}
                <div>
                  <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="a-section-link mb-2"
                  style={{ color: 'var(--a-accent-ink)' }}>
                  
                    <span>{tr("vitamintracker_hazir_vitaminler_73ff90", "Hazır vitaminlər")}</span>
                    <ChevronDown size={14} className={`transition-transform ${showPresets ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showPresets &&
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden">
                    
                        <div className="a-tag-row" style={{ marginBottom: 8, marginTop: 6 }}>
                          {dynamicPresets.map((preset) =>
                      <button
                        key={preset.name}
                        onClick={() => {
                          setNewVitamin((prev) => ({ ...prev, name: preset.name, emoji: preset.emoji }));
                          setShowPresets(false);
                        }}
                        className="a-tag">
                        
                              {preset.emoji} {preset.name}
                            </button>
                      )}
                        </div>
                      </motion.div>
                  }
                  </AnimatePresence>
                </div>

                {/* Name */}
                <div>
                  <label className="a-stat-tile-label" style={{ display: 'block', marginBottom: 6 }}>{tr("vitamintracker_vitamin_adi_15e0a6", "Vitamin adı")}</label>
                  <div className="flex gap-2">
                    <button
                    onClick={() => {
                      const emojis = ['💊', '🟢', '☀️', '🔴', '🦴', '🐟', '💜', '🍊', '💎', '⚡', '🌊', '🦠'];
                      const idx = emojis.indexOf(newVitamin.emoji);
                      setNewVitamin((prev) => ({ ...prev, emoji: emojis[(idx + 1) % emojis.length] }));
                    }}
                    className="a-icon-btn flex-shrink-0"
                    style={{ width: 44, height: 44, fontSize: 20 }}>
                    
                      {newVitamin.emoji}
                    </button>
                    <input
                    value={newVitamin.name}
                    onChange={(e) => setNewVitamin((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder={tr("vitamintracker_mes_folat_d_vitamini_6e4ad1", "Məs: Folat, D vitamini...")}
                    className="a-input flex-1" />
                  
                  </div>
                </div>

                {/* Time */}
                <div>
                  <label className="a-stat-tile-label" style={{ display: 'block', marginBottom: 6 }}>{tr("vitamintracker_qebul_saati_b569b1", "Qəbul saatı")}</label>
                  <input
                  type="time"
                  value={newVitamin.time}
                  onChange={(e) => setNewVitamin((prev) => ({ ...prev, time: e.target.value }))}
                  className="a-input w-full" />
                
                </div>

                {/* Days */}
                <div>
                  <label className="a-stat-tile-label" style={{ display: 'block', marginBottom: 8 }}>{tr("vitamintracker_qebul_gunleri_5262ae", "Qəbul günləri")}</label>
                  <div className="flex gap-1.5 justify-between">
                    {getDayLabels(language).map((label, idx) =>
                  <button
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    className={`a-cal-day-circle${newVitamin.days.includes(idx) ? ' selected' : ''}`}
                    style={{ cursor: 'pointer', border: 'none', fontSize: 10 }}>
                    
                        {label}
                      </button>
                  )}
                  </div>
                </div>

                {/* Notification */}
                <div className="a-stat-tile" style={{ justifyContent: 'space-between' }}>
                  <div className="flex items-center gap-2">
                    <Bell size={15} style={{ color: 'var(--a-peach-2)' }} />
                    <span className="a-list-title" style={{ fontSize: 12.5 }}>{tr("vitamintracker_xatirlatma_bildirisi_8da2b8", "Xatırlatma bildirişi")}</span>
                  </div>
                  <button
                  onClick={() => setNewVitamin((prev) => ({ ...prev, notification: !prev.notification }))}
                  style={{ width: 44, height: 25, borderRadius: 999, border: 'none', cursor: 'pointer', transition: 'background 150ms ease', background: newVitamin.notification ? 'var(--a-peach-2)' : 'var(--a-line-strong)', position: 'relative' }}>
                  
                    <div
                    style={{
                      position: 'absolute', top: 3, width: 19, height: 19, borderRadius: 999, background: '#fff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'inset-inline-start 150ms ease',
                      insetInlineStart: newVitamin.notification ? 22 : 3
                    }} />
                  </button>
                </div>
                <p className="a-list-time" style={{ marginTop: 8, marginInlineStart: 4, marginBottom: 4, lineHeight: 1.5 }}>
                  {tr("vitamintracker_qebul_vaxtindan_5_deqiqe_evvel_023b26", "Q\u0259bul vaxt\u0131ndan 5 d\u0259qiq\u0259 \u0259vv\u0259l bildiri\u015F g\xF6nd\u0259ril\u0259c\u0259k")}
                </p>
              </div>

              {/* Submit */}
              <div className="p-5 pt-4" style={{ borderTop: '1px solid var(--a-line)' }}>
                <button
                onClick={handleAdd}
                disabled={addSchedule.isPending}
                className="a-btn-solid w-full"
                style={{ justifyContent: 'center', padding: '13px 18px', opacity: addSchedule.isPending ? 0.5 : 1 }}>
                
                  {addSchedule.isPending ? tr("vitamintracker_elave_edilir_3c28b4", "Əlavə edilir...") : tr("vitamintracker_vitamin_elave_et_ba4a9c", "Vitamin Əlavə Et")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </ToolPage>);

};

export default VitaminTracker;

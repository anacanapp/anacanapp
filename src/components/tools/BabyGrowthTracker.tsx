import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { buildCurveData, percentile, percentileLabel, ageInMonths, type Sex, type Measure } from '@/lib/whoGrowth';
import { getPrematurityInfo } from '@/lib/pregnancy-utils';
import {
  ArrowLeft, Scale, Ruler, Plus, TrendingUp, TrendingDown,
  Calendar, ChevronRight, Sparkles, Baby, LineChart, Edit2, Trash2 } from
'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { hapticFeedback } from '@/lib/native';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { format } from 'date-fns';
import { getCurrentDateLocale, formatDateAz } from '@/lib/date-utils';
import { useScreenAnalytics, trackEvent } from '@/hooks/useScreenAnalytics';
import { tr } from "@/lib/tr";

interface BabyGrowthTrackerProps {
  onBack: () => void;
}

/**
 * WHO percentil əyriləri (0-24 ay) — çəki və boy.
 * P3/P15/P50/P85/P97 zolaqları + uşağın real ölçüləri.
 */
const WHOPercentileCard = ({ entries, birthDate, sex, dueDate }: {
  entries: {entry_date: string;weight_kg: number | null;height_cm: number | null;}[];
  birthDate: string;
  sex: Sex;
  /** Orijinal EDD — premature körpələrdə qrafik korreksiya olunmuş yaşla qurulur */
  dueDate?: string | null;
}) => {
  const [measure, setMeasure] = useState<Measure>('weight');

  // PREMATURE DƏSTƏYİ: WHO əyriləri termdə doğulmuş körpələr üçündür. Premature
  // körpənin nöqtələrini XRONOLOJİ yaşla yerləşdirmək onu yalançı "aşağı
  // percentil"də göstərir. Standart praktika: 24 aya qədər korreksiya olunmuş
  // yaşla (EDD-dən hesablanan) plot etmək. Korreksiya olunmuş ay =
  // ageInMonths(dueDate, entry_date).
  const prematurity = useMemo(() => getPrematurityInfo(birthDate, dueDate ?? null), [birthDate, dueDate]);
  const ageReferenceDate = prematurity.isPremature && dueDate ? dueDate : birthDate;

  const { chartData, latestPercentile } = useMemo(() => {
    const curve = buildCurveData(measure, sex);

    // Uşağın ölçülərini aylara yerləşdir
    const childPoints: {month: number;value: number;}[] = [];
    for (const e of entries) {
      const val = measure === 'weight' ? e.weight_kg : e.height_cm;
      if (!val) continue;
      const m = ageInMonths(ageReferenceDate, e.entry_date);
      if (m >= 0 && m <= 24) childPoints.push({ month: Math.round(m * 10) / 10, value: val });
    }
    childPoints.sort((a, b) => a.month - b.month);

    // recharts: əyri + uşaq nöqtələri birləşmiş data
    const merged: any[] = curve.map((c) => ({ ...c }));
    for (const p of childPoints) {
      merged.push({ month: p.month, child: p.value });
    }
    merged.sort((a, b) => a.month - b.month);

    // Son ölçünün percentili
    let latest: number | null = null;
    if (childPoints.length > 0) {
      const last = childPoints[childPoints.length - 1];
      latest = percentile(measure, sex, last.month, last.value);
    }

    return { chartData: merged, latestPercentile: latest };
  }, [entries, ageReferenceDate, sex, measure]);

  const tone = latestPercentile !== null ? percentileLabel(latestPercentile).tone : null;
  const toneStyle = tone === 'ok' ?
  { bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' } :
  tone === 'watch' ?
  { bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)' } :
  { bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' };

  return (
    <motion.div
      className="a-card a-fade-in"
      style={{ marginTop: 12 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}>

      <div className="a-card-head">
        <h3 className="a-card-title a-heading">{tr('who_curves_title', 'WHO inkişaf əyriləri')}</h3>
        {latestPercentile !== null &&
        <span className="a-rank-tag" style={{ background: toneStyle.bg, color: toneStyle.ink }}>
            P{latestPercentile} · {tone === 'ok' ? tr('who_normal', 'normal') : tone === 'watch' ? tr('who_watch', 'izləyin') : tr('who_alert', 'həkimlə danışın')}
          </span>
        }
      </div>
      {prematurity.isPremature &&
      <p style={{ fontSize: 11, color: 'var(--a-ink-soft)', marginBottom: 8 }}>
          {tr('who_corrected_note', 'Qrafik korreksiya olunmuş yaşla qurulur (vaxtından əvvəl doğulub')}
          {prematurity.gestationalWeeksAtBirth !== null && <> — {prematurity.gestationalWeeksAtBirth} {tr('who_corrected_weeks', 'həftəlik')}</>}
          {')'}
        </p>
      }

      {/* Ölçü seçimi */}
      <div className="flex gap-2 mb-3">
        {[
        { id: 'weight' as Measure, label: tr('who_weight', 'Çəki (kq)') },
        { id: 'height' as Measure, label: tr('who_height', 'Boy (sm)') }].
        map((m) =>
        <button
          key={m.id}
          onClick={() => setMeasure(m.id)}
          className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
          style={{
            background: measure === m.id ? 'var(--a-peach-1)' : 'var(--a-surface-soft)',
            color: measure === m.id ? 'var(--a-accent-ink)' : 'var(--a-ink-soft)',
            border: measure === m.id ? '2px solid var(--a-peach-2)' : '2px solid transparent'
          }}>
            {m.label}
          </button>
        )}
      </div>

      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
            <XAxis
              dataKey="month"
              type="number"
              domain={[0, 24]}
              ticks={[0, 6, 12, 18, 24]}
              tick={{ fontSize: 10, fill: 'var(--a-ink-soft)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--a-line)' }}
              tickFormatter={(m) => `${m}${tr('who_month_short', 'ay')}`} />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 10, fill: 'var(--a-ink-soft)' }}
              tickLine={false}
              axisLine={false}
              width={40} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid var(--a-line)', fontSize: 11, background: 'var(--a-surface)' }}
              formatter={(value: any, name: string) => {
                const labels: Record<string, string> = {
                  p3: 'P3', p15: 'P15', p50: tr('who_median', 'P50 (median)'), p85: 'P85', p97: 'P97',
                  child: tr('who_child', 'Körpəniz')
                };
                return [value, labels[name] || name];
              }}
              labelFormatter={(m) => `${m} ${tr('who_month_short', 'ay')}`} />

            {/* Percentil əyriləri */}
            <Line dataKey="p97" stroke="#e4a3b8" strokeWidth={1} dot={false} connectNulls isAnimationActive={false} strokeDasharray="4 3" />
            <Line dataKey="p85" stroke="#d4b48c" strokeWidth={1} dot={false} connectNulls isAnimationActive={false} />
            <Line dataKey="p50" stroke="#63bd8b" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line dataKey="p15" stroke="#d4b48c" strokeWidth={1} dot={false} connectNulls isAnimationActive={false} />
            <Line dataKey="p3" stroke="#e4a3b8" strokeWidth={1} dot={false} connectNulls isAnimationActive={false} strokeDasharray="4 3" />

            {/* Körpənin ölçüləri */}
            <Line
              dataKey="child"
              stroke="var(--a-peach-2)"
              strokeWidth={2.5}
              connectNulls
              dot={{ r: 3.5, fill: 'var(--a-peach-2)', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="a-teaser" style={{ marginTop: 8 }}>
        {tr('who_explainer', 'Yaşıl xətt — WHO medianı (P50). P15-P85 arası tam normaldır; P3-dən aşağı və ya P97-dən yuxarıdırsa pediatrla məsləhətləşin.')}
      </p>
    </motion.div>);
};

interface BabyGrowthEntry {
  id: string;
  user_id: string;
  child_id: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  head_cm: number | null;
  entry_date: string;
  notes: string | null;
  created_at: string;
}

const BabyGrowthTracker = ({ onBack }: BabyGrowthTrackerProps) => {
  useScreenAnalytics('BabyGrowthTracker', 'Tools');
  const { user } = useAuth();
  const { selectedChild } = useChildren();
  const { toast } = useToast();
  const [entries, setEntries] = useState<BabyGrowthEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BabyGrowthEntry | null>(null);

  const [formData, setFormData] = useState({
    weight_kg: '',
    height_cm: '',
    head_cm: '',
    notes: '',
    entry_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchEntries();
  }, [user, selectedChild]);

  const fetchEntries = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let query = supabase.
      from('baby_growth').
      select('*').
      eq('user_id', user.id).
      order('entry_date', { ascending: false });

      // Filter by selected child
      if (selectedChild) {
        query = query.eq('child_id', selectedChild.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEntries(data || []);
    } catch (e) {
      console.error('Error fetching growth data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    const weight = parseFloat(formData.weight_kg);
    const height = parseFloat(formData.height_cm);
    const head = parseFloat(formData.head_cm);

    if (isNaN(weight) && isNaN(height) && isNaN(head)) {
      toast({
        title: tr("babygrowthtracker_xeta_3cdbb6", 'Xəta'),
        description: tr("babygrowthtracker_en_azi_bir_olcu_daxil_edin_bfceff", 'Ən azı bir ölçü daxil edin'),
        variant: 'destructive'
      });
      return;
    }

    await hapticFeedback.medium();

    try {
      if (editingEntry) {
        const { error } = await supabase.
        from('baby_growth').
        update({
          weight_kg: isNaN(weight) ? null : weight,
          height_cm: isNaN(height) ? null : height,
          head_cm: isNaN(head) ? null : head,
          notes: formData.notes || null,
          entry_date: formData.entry_date
        }).
        eq('id', editingEntry.id);

        if (error) throw error;
        toast({ title: tr("babygrowthtracker_olcu_yenilendi_163440", 'Ölçü yeniləndi! 📏') });
      } else {
        const { error } = await supabase.
        from('baby_growth').
        insert({
          user_id: user.id,
          child_id: selectedChild?.id || null,
          weight_kg: isNaN(weight) ? null : weight,
          height_cm: isNaN(height) ? null : height,
          head_cm: isNaN(head) ? null : head,
          notes: formData.notes || null,
          entry_date: formData.entry_date
        });

        if (error) throw error;
        toast({ title: tr("babygrowthtracker_yeni_olcu_elave_edildi_a55e91", 'Yeni ölçü əlavə edildi! 📏') });
      }

      resetForm();
      fetchEntries();
    } catch (error) {
      console.error('Error saving growth entry:', error);
      toast({
        title: tr("babygrowthtracker_xeta_bas_verdi_f22fba", 'Xəta baş verdi'),
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id: string) => {
    await hapticFeedback.light();

    try {
      const { error } = await supabase.
      from('baby_growth').
      delete().
      eq('id', id);

      if (error) throw error;
      toast({ title: tr("babygrowthtracker_olcu_silindi_cbd1ac", 'Ölçü silindi') });
      fetchEntries();
    } catch (error) {
      toast({
        title: tr("babygrowthtracker_xeta_bas_verdi_f22fba", 'Xəta baş verdi'),
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      weight_kg: '',
      height_cm: '',
      head_cm: '',
      notes: '',
      entry_date: new Date().toISOString().split('T')[0]
    });
    setEditingEntry(null);
    setShowAddModal(false);
  };

  const openEditModal = (entry: BabyGrowthEntry) => {
    setEditingEntry(entry);
    setFormData({
      weight_kg: entry.weight_kg?.toString() || '',
      height_cm: entry.height_cm?.toString() || '',
      head_cm: entry.head_cm?.toString() || '',
      notes: entry.notes || '',
      entry_date: entry.entry_date
    });
    setShowAddModal(true);
  };

  // Calculate statistics
  const latestEntry = entries[0];
  const previousEntry = entries[1];

  const weightChange = latestEntry && previousEntry ?
  (latestEntry.weight_kg || 0) - (previousEntry.weight_kg || 0) :
  null;
  const heightChange = latestEntry && previousEntry ?
  (latestEntry.height_cm || 0) - (previousEntry.height_cm || 0) :
  null;

  return (
    <div className="a-scope pb-24" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
      <div className="a-shell">
        {/* Top bar */}
        <header className="a-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button onClick={onBack} className="a3-icon-btn" whileTap={{ scale: 0.9 }}>
              <ArrowLeft className="rtl:rotate-180" size={20} strokeWidth={2} />
            </motion.button>
            <div>
              <p className="a-eyebrow">{selectedChild?.name || tr("common_qeyd", "qeyd")}</p>
              <p className="a3-tool-title">{tr("babygrowthtracker_i_nkisaf_izleyicisi_71039e", "\u0130nki\u015Faf izl\u0259yicisi")}</p>
            </div>
          </div>
          <div className="a-topbar-actions">
            <motion.button
              onClick={() => setShowAddModal(true)}
              className="a-icon-btn"
              style={{ background: 'var(--a-peach-2)', color: '#fff', border: 'none' }}
              whileTap={{ scale: 0.9 }}>
              
              <Plus size={17} strokeWidth={2.4} />
            </motion.button>
          </div>
        </header>

        {/* Current Stats */}
        <div className="a-trio" style={{ marginTop: 6 }}>
          <motion.div
            className="a-trio-item"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}>
            
            <span className="a-trio-icon" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
              <Scale size={17} strokeWidth={2} />
            </span>
            <p className="a-trio-value" style={{ fontSize: 17 }}>
              {latestEntry?.weight_kg ? `${latestEntry.weight_kg}` : '—'}
            </p>
            <p className="a-trio-label">{tr('unit_kg', 'kq')}</p>
            {weightChange !== null && weightChange !== 0 &&
            <p className="a-trio-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 3, color: weightChange > 0 ? 'var(--a-green-2)' : 'var(--a-pink-2)' }}>
                {weightChange > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {weightChange > 0 ? '+' : ''}{weightChange.toFixed(2)}
              </p>
            }
          </motion.div>

          <motion.div
            className="a-trio-item"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}>
            
            <span className="a-trio-icon" style={{ background: 'var(--a-grad-blue)', color: 'var(--a-blue-ink)' }}>
              <Ruler size={17} strokeWidth={2} />
            </span>
            <p className="a-trio-value" style={{ fontSize: 17 }}>
              {latestEntry?.height_cm ? `${latestEntry.height_cm}` : '—'}
            </p>
            <p className="a-trio-label">{tr('unit_cm', 'sm')}</p>
            {heightChange !== null && heightChange !== 0 &&
            <p className="a-trio-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 3, color: heightChange > 0 ? 'var(--a-green-2)' : 'var(--a-pink-2)' }}>
                {heightChange > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {heightChange > 0 ? '+' : ''}{heightChange.toFixed(1)}
              </p>
            }
          </motion.div>

          <motion.div
            className="a-trio-item"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}>
            
            <span className="a-trio-icon" style={{ background: 'var(--a-grad-yellow)', color: 'var(--a-warn-ink)' }}>
              <Baby size={17} strokeWidth={2} />
            </span>
            <p className="a-trio-value" style={{ fontSize: 17 }}>
              {latestEntry?.head_cm ? `${latestEntry.head_cm}` : '—'}
            </p>
            <p className="a-trio-label">{tr("babygrowthtracker_bas_sm_1367d0", "baş sm")}</p>
          </motion.div>
        </div>

        {/* WHO Percentil Əyriləri */}
        {selectedChild?.birth_date && selectedChild?.gender && entries.length > 0 &&
        <WHOPercentileCard
          entries={entries}
          birthDate={selectedChild.birth_date}
          dueDate={selectedChild.due_date}
          sex={selectedChild.gender === 'boy' ? 'boy' : 'girl'} />
        }

        {/* History Section */}
        <motion.section
          className="a-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}>
          
          <div className="a-section-head">
            <h2 className="a-section-title a-heading">{tr("babygrowthtracker_olcu_tarixcesi_249279", "Ölçü Tarixçəsi")}</h2>
            <span className="a-section-link">{entries.length} {tr("common_qeyd", "qeyd")}</span>
          </div>

          {isLoading ?
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3].map((i) =>
            <div key={i} className="a-card animate-pulse">
                  <div style={{ height: 16, width: '33%', borderRadius: 8, background: 'var(--a-surface-soft)', marginBottom: 8 }} />
                  <div style={{ height: 12, width: '66%', borderRadius: 8, background: 'var(--a-surface-soft)' }} />
                </div>
            )}
            </div> :
          entries.length === 0 ?
          <div className="a-card" style={{ textAlign: 'center', padding: '32px 18px' }}>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'var(--a-grad-peach)' }}>
                <Scale size={26} style={{ color: 'var(--a-accent-ink)' }} />
              </div>
              <h3 className="a-list-title" style={{ marginBottom: 4 }}>{tr("babygrowthtracker_hele_olcu_yoxdur_7f7813", "Hələ ölçü yoxdur")}</h3>
              <p className="a-list-sub" style={{ margin: '0 0 16px', whiteSpace: 'normal' }}>
                {tr("babygrowthtracker_korpenizin_ceki_ve_boyunu_izle_36b05f", "K\xF6rp\u0259nizin \xE7\u0259ki v\u0259 boyunu izl\u0259m\u0259k \xFC\xE7\xFCn ilk \xF6l\xE7\xFCn\xFC \u0259lav\u0259 edin")}
              </p>
              <button onClick={() => setShowAddModal(true)} className="a-cta-btn">
                <Plus size={14} strokeWidth={2.4} />
                {tr("babygrowthtracker_i_lk_olcunu_elave_et_5a19bb", "\u0130lk \xF6l\xE7\xFCn\xFC \u0259lav\u0259 et")}
              </button>
            </div> :

          <div className="a-list-card">
              {entries.map((entry, index) =>
            <motion.div
              key={entry.id}
              className="a-list-row"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.3) }}>
              
                  <span
                className="a-list-icon"
                style={index === 0 ?
                { background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' } :
                { background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}>
                    <Calendar size={17} strokeWidth={2} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="a-list-title">
                      {formatDateAz(new Date(entry.entry_date), true)}
                    </p>
                    <p className="a-list-sub" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {entry.weight_kg &&
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Scale size={11} /> {entry.weight_kg} {tr('unit_kg', 'kq')}
                        </span>
                  }
                      {entry.height_cm &&
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Ruler size={11} /> {entry.height_cm} {tr('unit_cm', 'sm')}
                        </span>
                  }
                      {entry.head_cm &&
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Baby size={11} /> {entry.head_cm} {tr('unit_cm', 'sm')}
                        </span>
                  }
                    </p>
                    {entry.notes &&
                <p className="a-list-time" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📝 {entry.notes}
                      </p>
                }
                  </div>
                  
                  <span className="a-list-trail" style={{ display: 'flex', gap: 6 }}>
                    <motion.button
                  onClick={() => openEditModal(entry)}
                  className="a-icon-btn"
                  style={{ width: 30, height: 30 }}
                  whileTap={{ scale: 0.9 }}>
                  
                      <Edit2 size={13} strokeWidth={2} />
                    </motion.button>
                    <motion.button
                  onClick={() => handleDelete(entry.id)}
                  className="a-icon-btn"
                  style={{ width: 30, height: 30, background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)', border: 'none' }}
                  whileTap={{ scale: 0.9 }}>
                  
                      <Trash2 size={13} strokeWidth={2} />
                    </motion.button>
                  </span>
                </motion.div>
            )}
            </div>
          }
        </motion.section>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
                <Scale className="w-4 h-4" />
              </div>
              {editingEntry ? tr("babygrowthtracker_olcunu_redakte_et_44cfb4", "\xD6l\xE7\xFCn\xFC redakt\u0259 et") : tr("babygrowthtracker_yeni_olcu_elave_et_45ac37", "Yeni \xF6l\xE7\xFC \u0259lav\u0259 et")}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{tr("untranslated_tarix_6hhkyx", "Tarix")}</label>
              <Input
                type="date"
                value={formData.entry_date}
                onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                className="bg-muted/50" />
              
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-[color:var(--a-pink-ink)]" />
                  {tr("babygrowthtracker_ceki_kq_2f7555", "\xC7\u0259ki (kq)")}
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.weight_kg}
                  onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                  placeholder="5.2"
                  className="bg-muted/50" />
                
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-1">
                  <Ruler className="w-3.5 h-3.5 text-[color:var(--a-lav-ink)]" />
                  {tr("babygrowthtracker_boy_sm_3bc841", "Boy (sm)")}
                </label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.height_cm}
                  onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                  placeholder="58"
                  className="bg-muted/50" />
                
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block flex items-center gap-1">
                  <Baby className="w-3.5 h-3.5 text-[color:var(--a-lav-ink)]" />
                  {tr("babygrowthtracker_bas_sm_927b99", "Ba\u015F (sm)")}
                </label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.head_cm}
                  onChange={(e) => setFormData({ ...formData, head_cm: e.target.value })}
                  placeholder="38"
                  className="bg-muted/50" />
                
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">{tr("babygrowthtracker_qeyd_isteye_bagli_96c689", "Qeyd (istəyə bağlı)")}</label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={tr("babygrowthtracker_hekim_yoxlamasi_vaksinasiya_6ce4a0", "Həkim yoxlaması, vaksinasiya...")}
                className="bg-muted/50" />
              
            </div>
            
            <button
              onClick={handleSubmit}
              className="a-btn-solid w-full"
              style={{ justifyContent: 'center', padding: '12px 18px' }}>
              
              <Sparkles size={15} strokeWidth={2.2} />
              {editingEntry ? tr("babygrowthtracker_yenile_570ce2", "Yenilə") : tr("babygrowthtracker_yadda_saxla_3c7a2d", "Yadda saxla")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

};

export default BabyGrowthTracker;
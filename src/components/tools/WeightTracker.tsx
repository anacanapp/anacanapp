import { useState, useEffect, forwardRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, TrendingUp, TrendingDown, Minus, Scale, Loader2, Sparkles, Target, Activity, Trash2, RotateCcw, MoreVertical } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { differenceInDays } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useWeightEntries } from '@/hooks/useWeightEntries';
import { useWeightRecommendations } from '@/hooks/useDynamicTools';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { supabase } from '@/integrations/supabase/client';
import { formatDateAz, formatTimeAz } from '@/lib/date-utils';
import { tr, getPersistedLanguage } from "@/lib/tr";
import { ToolPage, ToolHeader } from './anacan/ToolKit';
// IOM (Institute of Medicine, 2009) hamiləlik çəki artımı ankerləri + xətti
// interpolyasiya — src/lib/pregnancyWeightGain.ts-ə çıxarılıb ki, React-dan
// asılı olmadan unit-test edilə bilsin (bax pregnancyWeightGain.test.ts).
// Tək hamiləlikdə mövcud DB/hardcode dəyərlərlə (13/26/40-cı həftə) UYĞUNDUR.
// Əkiz/çoxdöllü hamiləlikdə İOM-un ayrıca, DAHA YÜKSƏK məcmu tövsiyəsi var
// (normal BMI üçün ~16.8-24.5 kq) VƏ "tam vaxtında" 40 yox, ~37-ci həftədir
// (bax Duzelis29.sql-in "Həftə 36" qeydi — eyni mənbə, ACOG/İOM).
import { SINGLE_GAIN_ANCHORS, MULTIPLE_GAIN_ANCHORS, interpolateGain } from '@/lib/pregnancyWeightGain';

interface WeightTrackerProps {
  onBack: () => void;
}

const WeightTracker = forwardRef<HTMLDivElement, WeightTrackerProps>(({ onBack }, ref) => {
  useScrollToTop();
  useScreenAnalytics('WeightTracker', 'Tools');

  const { entries, loading, addEntry, getStats, deleteEntry, deleteAllEntries } = useWeightEntries();
  const { profile } = useAuth();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const getPregnancyData = useUserStore((s) => s.getPregnancyData);
  const [newWeight, setNewWeight] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Əkiz/çoxdöllü hamiləlikdə İOM çəki artım tövsiyəsi tək hamiləlikdən DAHA
  // YÜKSƏKDİR — bunu nəzərə almasaq, əkiz ana normal artımla belə "Çox artırırsınız"
  // kimi SƏHV xəbərdarlıq görər (bax MULTIPLE_GAIN_ANCHORS yuxarıda).
  const isMultiple = !!profile?.multiples_type && profile.multiples_type !== 'single';

  const pregData = getPregnancyData();
  const currentWeek = pregData?.currentWeek || 20;
  const stats = getStats();

  const startWeight = stats?.startWeight || 60;
  const currentWeight = stats?.currentWeight || startWeight;
  const totalGain = stats?.totalGain || 0;

  const trimester = currentWeek <= 12 ? 1 : currentWeek <= 26 ? 2 : 3;
  const { data: recommendations } = useWeightRecommendations(trimester);

  const recommended = useMemo(() => {
    // Əkiz/çoxdöllü: DB/hardcode tək-hamiləlik dəyərlərini KEÇ, real İOM əkiz
    // ankerlərindən cari həftəyə görə interpolyasiya et.
    if (isMultiple) {
      const [min, max] = interpolateGain(currentWeek, MULTIPLE_GAIN_ANCHORS);
      return { min: Math.round(min * 10) / 10, max: Math.round(max * 10) / 10 };
    }
    const rec = recommendations?.find((r) => r.bmi_category === 'normal');
    if (rec) {
      return { min: Number(rec.min_gain_kg), max: Number(rec.max_gain_kg) };
    }
    if (trimester === 1) return { min: 0.5, max: 2 };
    if (trimester === 2) return { min: 4, max: 8 };
    return { min: 8, max: 14 };
  }, [recommendations, trimester, isMultiple, currentWeek]);

  // Status → anacan design palette (bg gradient + ink color)
  const getStatus = () => {
    if (totalGain < recommended.min) return { status: 'low', text: tr("weighttracker_status_low", "Az"), grad: 'var(--a-grad-yellow)', ink: 'var(--a-warn-ink)' };
    if (totalGain > recommended.max) return { status: 'high', text: tr("weighttracker_cox_72c890", "Çox"), grad: 'var(--a-grad-pink)', ink: 'var(--a-berry-ink)' };
    return { status: 'normal', text: tr("weighttracker_status_normal", "Normal"), grad: 'var(--a-grad-green)', ink: 'var(--a-green-ink)' };
  };

  const status = getStatus();

  // ── Hamiləlik həftə qrafiki (İOM tövsiyə zolağı ilə) ──
  // Tək hamiləlikdə: hf13 [0.5-2], hf26 [4-8], hf40 [8-14] kq kumulyativ artım.
  // Əkiz/çoxdöllü: MULTIPLE_GAIN_ANCHORS (yuxarı bax) — daha yüksək, 37-ci həftəyə
  // qədər hesablanan İOM anker nöqtələri istifadə olunur.
  const lmpDate = pregData?.lastPeriodDate ? new Date(pregData.lastPeriodDate) : null;

  const pregnancyChartData = useMemo(() => {
    if (!lmpDate || entries.length < 2) return null;

    const anchors = isMultiple ? MULTIPLE_GAIN_ANCHORS : SINGLE_GAIN_ANCHORS;
    const gainAt = (week: number): [number, number] => interpolateGain(week, anchors);

    // Hər həftə üçün son çəki qeydi (entries DESC sıralıdır → xronoloji gedişat üçün tərsinə)
    const weekWeight = new Map<number, number>();
    [...entries].reverse().forEach((e) => {
      const wk = Math.floor(differenceInDays(new Date(e.entry_date), lmpDate) / 7);
      if (wk >= 0 && wk <= 42) weekWeight.set(wk, e.weight);
    });
    if (weekWeight.size === 0) return null;

    const data: {week: number;band: [number, number];weight: number | null;}[] = [];
    for (let wk = 4; wk <= 42; wk++) {
      const [gMin, gMax] = gainAt(wk);
      data.push({
        week: wk,
        band: [Math.round((startWeight + gMin) * 10) / 10, Math.round((startWeight + gMax) * 10) / 10],
        weight: weekWeight.get(wk) ?? null
      });
    }
    return data;
  }, [entries, lmpDate, startWeight, isMultiple]);

  useEffect(() => {
    const fetchAIAdvice = async () => {
      if (entries.length === 0) return;

      setAiLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('dr-anacan-chat', {
          body: {
            messages: [{
              role: 'user',
              content: `${tr("weighttracker_ai_prompt_prefix", "Çəki analizi:")} ${currentWeek} ${tr("weighttracker_ai_prompt_week", "həftə")}, ${tr("weighttracker_ai_prompt_start", "başlanğıc:")} ${startWeight}kg, ${tr("weighttracker_ai_prompt_now", "indi:")} ${currentWeight}kg, ${tr("weighttracker_ai_prompt_gain", "artım:")} ${totalGain}kg (${tr("weighttracker_ai_prompt_rec", "tövsiyə:")} ${recommended.min}-${recommended.max}kg). ${tr("weighttracker_ai_prompt_status", "Status:")} ${status.text}. ${tr("weighttracker_ai_prompt_rules", "QAYDALAR: 1) Salamlama yoxdur, birbaşa məsələyə keç. 2) Maksimum 1-2 cümlə. 3) Disclaimer/xəbərdarlıq yoxdur. 4) Yalnız praktik qısa məsləhət.")}`
            }],
            isWeightAnalysis: true,
            language: getPersistedLanguage()
          }
        });

        if (data && !error) {
          setAiAdvice(data.message || data.content);
        }
      } catch (e) {
        console.error('AI advice error:', e);
      } finally {
        setAiLoading(false);
      }
    };

    fetchAIAdvice();
  }, [entries.length, currentWeek, totalGain]);

  const handleAddWeight = async () => {
    if (newWeight) {
      const weight = parseFloat(newWeight);
      if (!isNaN(weight) && weight > 0) {
        await addEntry(weight);
        setNewWeight('');
        setShowAddForm(false);
        // Health inteqrasiyası aktivdirsə → Apple Health / Health Connect-ə də yaz (arxa planda)
        import('@/lib/healthVitals').then((m) => m.writeWeightToHealth(weight)).catch(() => {});
      }
    }
  };

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={<>{currentWeek}. {tr("weighttracker_ai_prompt_week", "həftə")} · {trimester}. {tr("weighttracker_trimestr_soz", "trimestr")}</>}
        title={tr("weighttracker_ceki_i_zleyici_9dfe43", "\xC7\u0259ki \u0130zl\u0259yici")}
        actions={
        <motion.button
          onClick={() => setShowAddForm(true)}
          className="a-icon-btn"
          style={{ background: 'var(--a-peach-2)', color: '#fff', border: 'none' }}
          whileTap={{ scale: 0.9 }}>
          
            <Plus size={17} strokeWidth={2.4} />
          </motion.button>
        } />

      {/* Stats trio */}
      <div className="a-trio">
        <motion.div
          className="a-trio-item"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}>
          
          <span className="a-trio-icon" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
            <Scale size={17} strokeWidth={2} />
          </span>
          <p className="a-trio-value" style={{ fontSize: 17 }}>{currentWeight}</p>
          <p className="a-trio-label">{tr("weighttracker_hazirki_kg_426054", "Hazırkı (kg)")}</p>
        </motion.div>
        <motion.div
          className="a-trio-item"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          title={tr("weighttracker_baslangic_cekiden_ferq_8a58c5", "Başlanğıc çəkidən fərq")}>
          
          <span className="a-trio-icon" style={{ background: 'var(--a-grad-blue)', color: 'var(--a-blue-ink)' }}>
            <Activity size={17} strokeWidth={2} />
          </span>
          <p className="a-trio-value" style={{ fontSize: 17 }}>{totalGain >= 0 ? '+' : ''}{totalGain.toFixed(1)}</p>
          <p className="a-trio-label">{tr("weighttracker_ferq_kg_8bd06d", "Fərq (kg)")}</p>
        </motion.div>
        <motion.div
          className="a-trio-item"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}>
          
          <span className="a-trio-icon" style={{ background: 'var(--a-grad-lav)', color: 'var(--a-lav-ink)' }}>
            <Target size={17} strokeWidth={2} />
          </span>
          <p className="a-trio-value" style={{ fontSize: 17 }}>{recommended.min}-{recommended.max}</p>
          <p className="a-trio-label">{isMultiple ? tr("weighttracker_tovsiye_kg_ekiz", "Tövsiyə (kg) · əkiz üçün") : tr("weighttracker_tovsiye_kg_6a77a1", "Tövsiyə (kg)")}</p>
        </motion.div>
      </div>

      {/* Status Card */}
      <motion.div
        className="a-card a-fade-in"
        style={{ marginTop: 12 }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}>
        
        <div className="a-list-row" style={{ padding: 0, borderTop: 'none' }}>
          <span className="a-rank-avatar" style={{ background: status.grad, color: status.ink }}>
            {status.status === 'normal' && <Minus size={19} strokeWidth={2.2} />}
            {status.status === 'low' && <TrendingDown size={19} strokeWidth={2.2} />}
            {status.status === 'high' && <TrendingUp size={19} strokeWidth={2.2} />}
          </span>
          <div>
            <p className="a-today-info-eyebrow" style={{ margin: 0 }}>{tr("weighttracker_ceki_statusu_d932ab", "Çəki statusu")}</p>
            <p className="a-heading" style={{ margin: '2px 0 0', fontSize: 19, color: 'var(--a-ink)' }}>{status.text}</p>
            <p className="a-list-sub">
              {tr("weighttracker_baslangic_ef1964", "Başlanğıc:")} {startWeight} kg → {tr("weighttracker_indi_eef", "Cari:")} {currentWeight} kg
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: 14 }}>
          <div className="flex justify-between" style={{ marginBottom: 5 }}>
            <span className="a-list-time" style={{ margin: 0 }}>{recommended.min} kg</span>
            <span className="a-list-value" style={{ color: 'var(--a-ink-soft)' }}>{tr("weighttracker_tovsiye_olunan_araliq_4810a8", "Tövsiyə olunan aralıq")}</span>
            <span className="a-list-time" style={{ margin: 0 }}>{recommended.max} kg</span>
          </div>
          <div className="a-inline-bar relative" style={{ marginTop: 0, height: 8 }}>
            <div
              className="a-inline-bar-fill"
              style={{ background: status.grad, width: `${Math.min(totalGain / recommended.max * 100, 100)}%`, transition: 'width 300ms ease' }} />
            
            <div
              className="absolute top-0 h-full"
              style={{ insetInlineStart: `${recommended.min / recommended.max * 100}%`, borderInlineEnd: '2px dashed var(--a-green-2)' }} />
            
          </div>
        </div>
      </motion.div>

      {/* AI Analysis */}
      <motion.div
        className="a-cta a-fade-in"
        style={{ background: 'var(--a-grad-green)', marginTop: 12 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}>
        
        <span className="a-cta-shape" style={{ width: 110, height: 110, top: -40, right: -30, background: 'rgba(255,255,255,0.35)' }} />
        <div className="a-cta-top">
          {/* Dark mode düzəlişi: #14532d/rgba(20,83,45,x) dark modda
              --a-grad-green-in tünd tint-inə qarşı oxunmurdu. */}
          <span className="a-cta-badge" style={{ background: 'var(--a-chip-overlay)', color: 'var(--a-green-ink)' }}>
            <Sparkles size={11} strokeWidth={2.4} /> {tr("weighttracker_ai_analiz_41639d", "AI Analiz")}
          </span>
          {aiLoading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--a-green-ink)' }} />}
        </div>
        <p className="a-cta-text" style={{ position: 'relative', marginTop: 12, color: 'color-mix(in srgb, var(--a-green-ink) 85%, transparent)', fontWeight: 500 }}>
          {aiLoading ? tr("weighttracker_analiz_edilir_e11d27", "Analiz edilir...") : aiAdvice || tr("weighttracker_melumat_yuklenir_355722", "Məlumat yüklənir...")}
        </p>
      </motion.div>

      {/* Hamiləlik həftə qrafiki (İOM zolağı ilə) — bump istifadəçiləri */}
      {pregnancyChartData &&
      <motion.div
        className="a-card a-fade-in"
        style={{ marginTop: 12 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}>
        
          <div className="a-card-head">
            <h3 className="a-card-title a-heading">{tr("weighttracker_hamilelik_qrafiki", "Hamiləlik qrafiki")}</h3>
            <span className="a-rank-tag" style={{ background: 'var(--a-green-1)', color: 'var(--a-green-ink)' }}>
              {tr("weighttracker_tovsiye_zolagi", "yaşıl = tövsiyə aralığı")}
            </span>
          </div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pregnancyChartData} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
                <XAxis
                dataKey="week"
                type="number"
                domain={[4, 42]}
                ticks={[8, 16, 24, 32, 40]}
                tick={{ fontSize: 10, fill: 'var(--a-ink-soft)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--a-line)' }}
                tickFormatter={(w) => `${w}h`} />
              
                <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: 'var(--a-ink-soft)' }}
                tickLine={false}
                axisLine={false}
                width={46}
                tickFormatter={(v) => `${v}kq`} />
              
                <Tooltip
                formatter={(value: any, name: string) => {
                  if (name === 'band') return [`${value[0]}–${value[1]} kq`, tr("weighttracker_tovsiye_araligi", "Tövsiyə aralığı")];
                  return [`${value} kq`, tr("weighttracker_cekiniz", "Çəkiniz")];
                }}
                labelFormatter={(w) => `${w}. ${tr("weighttracker_ai_prompt_week", "həftə")}`}
                contentStyle={{ borderRadius: 12, border: '1px solid var(--a-line)', fontSize: 12, background: 'var(--a-surface)' }} />
              
                <Area
                dataKey="band"
                stroke="none"
                fill="#63bd8b"
                fillOpacity={0.18}
                isAnimationActive={false} />
              
                <ReferenceLine
                x={currentWeek}
                stroke="var(--a-ink-faint)"
                strokeDasharray="4 4"
                label={{ value: tr("weighttracker_indi_ref", "indi"), position: 'top', fontSize: 10, fill: 'var(--a-ink-soft)' }} />
              
                <Line
                dataKey="weight"
                type="monotone"
                connectNulls
                stroke="var(--a-peach-2)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--a-peach-2)', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false} />
              
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="a-teaser" style={{ marginTop: 8 }}>
            {tr("weighttracker_qrafik_izah", "Xətt — çəki qeydləriniz, yaşıl zolaq — həftəyə görə tövsiyə olunan artım aralığı (başlanğıc çəkiyə əsasən).")}
          </p>
        </motion.div>
      }

      {/* Progress Chart */}
      {entries.length > 0 && !pregnancyChartData &&
      <motion.div
        className="a-card a-fade-in"
        style={{ marginTop: 12 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}>
        
          <div className="a-card-head">
            <h3 className="a-card-title a-heading">{tr("weighttracker_son_7_qeyd", "Son 7 qeyd")}</h3>
          </div>
          <div className="h-32 flex items-end gap-2">
            {entries.slice(0, 7).reverse().map((entry, index) => {
            const maxWeight = Math.max(...entries.slice(0, 7).map((e) => e.weight));
            const minWeight = Math.min(...entries.slice(0, 7).map((e) => e.weight));
            const range = maxWeight - minWeight || 1;
            const height = (entry.weight - minWeight) / range * 60 + 40;

            return (
              <motion.div
                key={entry.id}
                className="flex-1 relative group cursor-pointer"
                style={{ background: 'var(--a-grad-peach)', borderRadius: '8px 8px 4px 4px' }}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: 0.4 + index * 0.08 }}>
                
                  <div className="a-chart-tooltip opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ left: '50%', top: -4 }}>
                    {entry.weight} kg
                  </div>
                </motion.div>);

          })}
          </div>
          <div className="a-chart-axis" style={{ marginTop: 10 }}>
            {entries.slice(0, 7).reverse().map((entry) =>
          <span key={entry.id} className="text-center flex-1">
                {formatDateAz(entry.entry_date)}
              </span>
          )}
          </div>
        </motion.div>
      }

      {/* History */}
      {entries.length > 0 &&
      <motion.section
        className="a-section pb-24"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}>
        
          <div className="a-section-head">
            <h2 className="a-section-title a-heading">{tr("weighttracker_tarixce_b09a14", "Tarixçə")}</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="a-icon-btn" style={{ width: 30, height: 30 }}>
                  <MoreVertical size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                onClick={() => setShowResetConfirm(true)}
                className="text-destructive focus:text-destructive">
                
                  <RotateCcw className="w-4 h-4 me-2" />
                  {tr("weighttracker_tarixceni_sifirla_577dd6", "Tarixçəni sıfırla")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="a-list-card">
            {entries.slice(0, 10).map((entry, index) =>
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(0.05 * index, 0.3) }}
            className="a-list-row">
            
                <span className="a-list-icon" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                  <Scale size={17} strokeWidth={2} />
                </span>
                <div>
                  <p className="a-list-title" style={{ fontSize: 14.5 }}>{entry.weight} kg</p>
                  <p className="a-list-sub">
                    {formatDateAz(entry.created_at)}, {formatTimeAz(entry.created_at)}
                  </p>
                </div>
                <span className="a-list-trail" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {index > 0 && entries[index - 1] &&
              <span
                className="a-rank-tag"
                style={entry.weight > entries[index - 1].weight ?
                { background: 'var(--a-green-1)', color: 'var(--a-green-ink)' } :
                entry.weight < entries[index - 1].weight ?
                { background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)' } :
                { background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}>
                      {entry.weight > entries[index - 1].weight ?
                `+${(entry.weight - entries[index - 1].weight).toFixed(1)}` :
                entry.weight < entries[index - 1].weight ?
                (entry.weight - entries[index - 1].weight).toFixed(1) :
                '0'}
                    </span>
              }
                  <button
                className="a-icon-btn"
                style={{ width: 30, height: 30 }}
                onClick={() => {
                  if (confirm(tr("weighttracker_bu_qeydi_silmek_isteyirsiniz_c4a2fa", "Bu qeydi silmək istəyirsiniz?"))) {
                    deleteEntry(entry.id);
                  }
                }}>
                
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </span>
              </motion.div>
          )}
          </div>
        </motion.section>
      }

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowResetConfirm(false)}>
          
            <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="a-scope w-full max-w-sm p-6"
            style={{ background: 'var(--a-surface)', borderRadius: 'var(--a-radius-lg)', boxShadow: 'var(--a-card-shadow)' }}>
            
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'var(--a-pink-1)' }}>
                <Trash2 size={26} style={{ color: 'var(--a-pink-ink)' }} />
              </div>
              <h2 className="a-heading text-center" style={{ margin: '0 0 6px', fontSize: 18, color: 'var(--a-ink)' }}>{tr("weighttracker_tarixceni_sifirla_577dd6", "Tarixçəni sıfırla")}</h2>
              <p className="a-list-sub text-center" style={{ margin: '0 0 20px', whiteSpace: 'normal' }}>
                {tr("weighttracker_butun_ceki_qeydleri_silinecek__3a01e1", "Bütün çəki qeydləri silinəcək. Bu əməliyyat geri qaytarıla bilməz.")}
              </p>
              <div className="flex gap-2">
                <button
                className="a-btn-soft flex-1"
                style={{ justifyContent: 'center' }}
                onClick={() => setShowResetConfirm(false)}>
                  {tr("weighttracker_legv_et_b5e49c", "Ləğv et")}
                
              </button>
                <button
                className="a-cta-btn flex-1"
                style={{ justifyContent: 'center', background: 'var(--a-pink-2)' }}
                onClick={() => {
                  deleteAllEntries();
                  setShowResetConfirm(false);
                }}>
                
                  {tr("weighttracker_sil", "Sil")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Add Weight Sheet */}
      <AnimatePresence>
        {showAddForm &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end"
          onClick={() => setShowAddForm(false)}>
          
            <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="a-scope w-full overflow-hidden"
            style={{ background: 'var(--a-surface)', borderRadius: '30px 30px 0 0', paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 94px)' }}>
            
              <div className="h-20 flex items-center justify-center" style={{ background: 'var(--a-grad-peach)' }}>
                <motion.div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--a-chip-overlay)' }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}>
                
                  <Scale size={28} style={{ color: 'var(--a-accent-ink)' }} />
                </motion.div>
              </div>
              
              <div className="p-6">
                <h2 className="a-heading text-center" style={{ margin: '0 0 4px', fontSize: 18, color: 'var(--a-ink)' }}>{tr("weighttracker_ceki_elave_et_252a47", "Çəki əlavə et")}</h2>
                <p className="a-list-sub text-center" style={{ margin: '0 0 20px', whiteSpace: 'normal' }}>{tr("weighttracker_bugunku_cekinizi_daxil_edin_24f734", "Bugünkü çəkinizi daxil edin")}</p>
                
                <div className="mb-5 relative">
                  <input
                  type="number"
                  step="0.1"
                  placeholder="65.5"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                  className="a-input w-full text-center"
                  style={{ height: 60, fontSize: 28, fontWeight: 800, borderRadius: 18 }} />
                
                  <span className="absolute end-4 top-1/2 -translate-y-1/2 a-list-value" style={{ color: 'var(--a-ink-soft)' }}>kg</span>
                </div>

                <motion.button
                onClick={handleAddWeight}
                className="a-btn-solid w-full"
                style={{ justifyContent: 'center', padding: '14px 18px', fontSize: 14 }}
                whileTap={{ scale: 0.98 }}>
                
                  <Sparkles size={17} strokeWidth={2.2} />
                  {tr("weighttracker_yadda_saxla", "Yadda saxla")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </ToolPage>);

});

WeightTracker.displayName = 'WeightTracker';

export default WeightTracker;
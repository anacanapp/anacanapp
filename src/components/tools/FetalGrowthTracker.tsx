import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, TrendingUp, Sparkles, Trash2, Baby, Users } from 'lucide-react';
import { ComposedChart, Area, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { useFetalGrowthScans } from '@/hooks/useFetalGrowthScans';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { getPregnancyWeekAtDate } from '@/lib/pregnancy-utils';
import {
  buildFetalGrowthChartData, estimatePercentileForWeight,
  calculateDiscordance, percentileTone, BABY_LABELS,
  FETAL_GROWTH_MIN_WEEK, FETAL_GROWTH_MAX_WEEK } from
'@/lib/fetalGrowth';
import { formatDateAz } from '@/lib/date-utils';
import { tr } from '@/lib/tr';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import MedicalDisclaimer from '@/components/MedicalDisclaimer';

interface FetalGrowthTrackerProps {
  onBack: () => void;
}

const BABY_COLORS: Record<string, string> = {
  A: '#e8879c',
  B: '#6b9bd8',
  C: '#a78bda',
  D: '#5cb88a'
};

const FetalGrowthTracker = ({ onBack }: FetalGrowthTrackerProps) => {
  useScrollToTop();
  useScreenAnalytics('FetalGrowthTracker', 'Tools');

  const { profile } = useAuth();
  const getPregnancyData = useUserStore((s) => s.getPregnancyData);
  const { scans, loading, addScan, deleteScan } = useFetalGrowthScans();

  const pregData = getPregnancyData();
  const currentWeek = pregData?.currentWeek || 20;
  const trimester = pregData?.trimester || 2;
  const lmpDate = pregData?.lastPeriodDate ? new Date(pregData.lastPeriodDate) : null;

  const babyCount = Math.max(1, Math.min(4, profile?.baby_count || 1));
  const isMultiple = babyCount > 1;
  const babyLabels = BABY_LABELS.slice(0, babyCount);

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>('A');
  const [scanDate, setScanDate] = useState(new Date().toISOString().split('T')[0]);
  const [efwInput, setEfwInput] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Hər USM qeydinin bu tarixdəki hamiləlik həftəsi (bugün deyil — həmin skan tarixi)
  const scansWithWeek = useMemo(() => {
    return scans.map((s) => ({
      ...s,
      week: lmpDate ? getPregnancyWeekAtDate(lmpDate, s.scan_date) : currentWeek,
      percentile: estimatePercentileForWeight(
        lmpDate ? getPregnancyWeekAtDate(lmpDate, s.scan_date) : currentWeek,
        s.efw_grams
      )
    }));
  }, [scans, lmpDate, currentWeek]);

  // Hər körpənin son (ən son tarixli) qeydi
  const latestByBaby = useMemo(() => {
    const map: Record<string, typeof scansWithWeek[number]> = {};
    scansWithWeek.forEach((s) => {
      const existing = map[s.baby_label];
      if (!existing || new Date(s.scan_date) >= new Date(existing.scan_date)) {
        map[s.baby_label] = s;
      }
    });
    return map;
  }, [scansWithWeek]);

  // Uyğunsuzluq (discordance) — hər körpənin son EFW-si üzərindən
  const discordance = useMemo(() => {
    if (!isMultiple) return null;
    const values = babyLabels.map((l) => latestByBaby[l]?.efw_grams).filter((v): v is number => !!v);
    return calculateDiscordance(values);
  }, [isMultiple, babyLabels, latestByBaby]);

  // Qrafik datası: persentil zolağı (P10-P90 tuple — WeightTracker.tsx-dəki
  // sınanmış "band" nümunəsi ilə eyni) + hər körpənin öz Line-ı (həftəyə görə birləşir)
  const chartData = useMemo(() => {
    const base = buildFetalGrowthChartData().map((band) => ({
      ...band,
      normalBand: [band.p10, band.p90] as [number, number]
    } as any));
    scansWithWeek.forEach((s) => {
      const row = base.find((r) => r.week === s.week);
      if (row) row[`baby${s.baby_label}`] = s.efw_grams;
    });
    return base;
  }, [scansWithWeek]);

  const handleAddScan = async () => {
    const grams = parseInt(efwInput, 10);
    if (!efwInput || isNaN(grams) || grams < 100 || grams > 6000) return;
    const result = await addScan(isMultiple ? selectedLabel : 'A', scanDate, grams);
    if (result) {
      setEfwInput('');
      setShowAddForm(false);
    }
  };

  const toneStyle = (tone: ReturnType<typeof percentileTone>) => {
    if (tone === 'watch-low') return { grad: 'var(--a-grad-yellow)', ink: 'var(--a-warn-ink)' };
    if (tone === 'watch-high') return { grad: 'var(--a-grad-blue)', ink: 'var(--a-blue-ink)' };
    return { grad: 'var(--a-grad-green)', ink: 'var(--a-green-ink)' };
  };

  const discordanceStyle = discordance?.level === 'high' ?
  { grad: 'var(--a-grad-pink)', ink: 'var(--a-berry-ink)' } :
  discordance?.level === 'watch' ?
  { grad: 'var(--a-grad-yellow)', ink: 'var(--a-warn-ink)' } :
  { grad: 'var(--a-grad-green)', ink: 'var(--a-green-ink)' };

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={<>{currentWeek}. {tr("weighttracker_ai_prompt_week", "həftə")} · {trimester}. {tr("weighttracker_trimestr_soz", "trimestr")}</>}
        title={tr("fetalgrowth_title", "Fetal Böyümə İzləyicisi")}
        actions={
        <motion.button
          onClick={() => {
            setSelectedLabel('A');
            setScanDate(new Date().toISOString().split('T')[0]);
            setShowAddForm(true);
          }}
          className="a-icon-btn"
          style={{ background: 'var(--a-peach-2)', color: '#fff', border: 'none' }}
          whileTap={{ scale: 0.9 }}>
          
            <Plus size={17} strokeWidth={2.4} />
          </motion.button>
        } />

      <MedicalDisclaimer variant="anacan" className="a-fade-in" />

      {/* Stats trio */}
      <div className="a-trio" style={{ marginTop: 12 }}>
        <motion.div className="a-trio-item" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <span className="a-trio-icon" style={{ background: 'var(--a-grad-peach)', color: 'var(--a-accent-ink)' }}>
            <TrendingUp size={17} strokeWidth={2} />
          </span>
          <p className="a-trio-value" style={{ fontSize: 17 }}>{currentWeek}</p>
          <p className="a-trio-label">{tr("fetalgrowth_current_week", "Cari həftə")}</p>
        </motion.div>
        <motion.div className="a-trio-item" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <span className="a-trio-icon" style={{ background: 'var(--a-grad-blue)', color: 'var(--a-blue-ink)' }}>
            <Baby size={17} strokeWidth={2} />
          </span>
          <p className="a-trio-value" style={{ fontSize: 17 }}>{scans.length}</p>
          <p className="a-trio-label">{tr("fetalgrowth_scan_count", "USM qeydi")}</p>
        </motion.div>
        <motion.div className="a-trio-item" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <span className="a-trio-icon" style={{ background: 'var(--a-grad-lav)', color: 'var(--a-lav-ink)' }}>
            <Users size={17} strokeWidth={2} />
          </span>
          <p className="a-trio-value" style={{ fontSize: 17 }}>{babyCount}</p>
          <p className="a-trio-label">{tr("fetalgrowth_baby_count", "Körpə sayı")}</p>
        </motion.div>
      </div>

      {/* Hər körpənin son EFW/persentil kartı */}
      {babyLabels.map((label, idx) => {
        const latest = latestByBaby[label];
        if (!latest) return null;
        const tone = percentileTone(latest.percentile);
        const style = toneStyle(tone);
        return (
          <motion.div
            key={label}
            className="a-card a-fade-in"
            style={{ marginTop: idx === 0 ? 12 : 8 }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 + idx * 0.05 }}>
            
            <div className="a-list-row" style={{ padding: 0, borderTop: 'none' }}>
              <span
                className="a-rank-avatar"
                style={{ background: BABY_COLORS[label] + '22', color: BABY_COLORS[label] }}>
                
                {isMultiple ? label : <Baby size={19} strokeWidth={2.2} />}
              </span>
              <div>
                <p className="a-today-info-eyebrow" style={{ margin: 0 }}>
                  {isMultiple ? tr("fetalgrowth_baby_label_n", "Körpə {n}").replace('{n}', label) : tr("fetalgrowth_latest_efw", "Son EFW")}
                </p>
                <p className="a-heading" style={{ margin: '2px 0 0', fontSize: 19, color: 'var(--a-ink)' }}>{latest.efw_grams} q</p>
                <p className="a-list-sub">
                  {latest.week}. {tr("weighttracker_ai_prompt_week", "həftə")} · {formatDateAz(latest.scan_date)}
                </p>
              </div>
              <span className="a-rank-tag" style={{ marginInlineStart: 'auto', background: style.grad, color: style.ink }}>
                {latest.percentile}p
              </span>
            </div>
          </motion.div>);

      })}

      {/* Uyğunsuzluq (discordance) — yalnız əkiz/üçüz/dördüz */}
      {isMultiple && discordance &&
      <motion.div
        className="a-card a-fade-in"
        style={{ marginTop: 8 }}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}>
        
          <div className="a-list-row" style={{ padding: 0, borderTop: 'none' }}>
            <span className="a-rank-avatar" style={{ background: discordanceStyle.grad, color: discordanceStyle.ink }}>
              <Users size={19} strokeWidth={2.2} />
            </span>
            <div>
              <p className="a-today-info-eyebrow" style={{ margin: 0 }}>{tr("fetalgrowth_discordance_title", "Böyümə uyğunluğu")}</p>
              <p className="a-heading" style={{ margin: '2px 0 0', fontSize: 17, color: 'var(--a-ink)' }}>
                {discordance.level === 'high' ?
              tr("fetalgrowth_discordance_high", "Əhəmiyyətli fərq — həkiminizlə müzakirə edin") :
              discordance.level === 'watch' ?
              tr("fetalgrowth_discordance_watch", "Yüngül fərq — izləməyə davam edin") :
              tr("fetalgrowth_discordance_normal", "Uyğun böyüyürlər")}
              </p>
              <p className="a-list-sub">
                {tr("fetalgrowth_discordance_desc", "Körpələr arasında çəki fərqi: {percent}%").replace('{percent}', String(discordance.percent))}
              </p>
            </div>
          </div>
        </motion.div>
      }

      {/* Qrafik */}
      <motion.div
        className="a-card a-fade-in"
        style={{ marginTop: 12 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}>
        
        <div className="a-card-head">
          <h3 className="a-card-title a-heading">{tr("fetalgrowth_chart_title", "Böyümə qrafiki")}</h3>
        </div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
              <XAxis
                dataKey="week"
                type="number"
                domain={[FETAL_GROWTH_MIN_WEEK, FETAL_GROWTH_MAX_WEEK]}
                ticks={[20, 24, 28, 32, 36, 40]}
                tick={{ fontSize: 10, fill: 'var(--a-ink-soft)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--a-line)' }}
                tickFormatter={(w) => `${w}h`} />
              
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: 'var(--a-ink-soft)' }}
                tickLine={false}
                axisLine={false}
                width={40}
                tickFormatter={(v) => `${Math.round(v / 100) / 10}kq`} />
              
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid var(--a-line)', fontSize: 11, background: 'var(--a-surface)' }}
                labelFormatter={(w) => `${w}. ${tr("weighttracker_ai_prompt_week", "həftə")}`}
                formatter={(value: any, name: string) => {
                  if (name === 'normalBand') return [`${value[0]}–${value[1]} q`, tr("fetalgrowth_normal_range", "Normal aralıq (P10–P90)")];
                  if (name === 'p50') return [`${value} q`, tr("fetalgrowth_median_label", "Median (P50)")];
                  if (name === 'p97' || name === 'p3') return [`${value} q`, name.toUpperCase()];
                  if (name.startsWith('baby')) {
                    const label = name.replace('baby', '');
                    return [`${value} q`, isMultiple ? tr("fetalgrowth_baby_label_n", "Körpə {n}").replace('{n}', label) : tr("fetalgrowth_latest_efw", "Son EFW")];
                  }
                  return [`${value} q`, name];
                }} />
              
              <Area dataKey="normalBand" stroke="none" fill="#63bd8b" fillOpacity={0.15} isAnimationActive={false} />
              
              <ReferenceLine
                x={currentWeek}
                stroke="var(--a-ink-faint)"
                strokeDasharray="4 4"
                label={{ value: tr("weighttracker_indi_ref", "indi"), position: 'top', fontSize: 10, fill: 'var(--a-ink-soft)' }} />
              
              <Line dataKey="p97" stroke="#e4a3b8" strokeWidth={1} dot={false} isAnimationActive={false} strokeDasharray="4 3" />
              <Line dataKey="p50" stroke="#63bd8b" strokeWidth={1.5} dot={false} isAnimationActive={false} strokeDasharray="2 2" />
              <Line dataKey="p3" stroke="#e4a3b8" strokeWidth={1} dot={false} isAnimationActive={false} strokeDasharray="4 3" />
              
              {babyLabels.map((label) =>
              <Line
                key={label}
                dataKey={`baby${label}`}
                stroke={BABY_COLORS[label]}
                strokeWidth={2.5}
                connectNulls
                dot={{ r: 4, fill: BABY_COLORS[label], strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                isAnimationActive={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="a-teaser" style={{ marginTop: 8 }}>
          {tr("fetalgrowth_chart_legend", "Yaşıl zolaq — normal aralıq (P10–P90), nöqtələr — sizin USM ölçmələriniz")}
        </p>
      </motion.div>

      {/* Tarixçə */}
      {scansWithWeek.length > 0 ?
      <motion.section
        className="a-section pb-24"
        style={{ marginTop: 12 }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}>
        
          <div className="a-section-head">
            <h2 className="a-section-title a-heading">{tr("fetalgrowth_history_title", "USM Tarixçəsi")}</h2>
          </div>
          <div className="a-list-card">
            {[...scansWithWeek].reverse().map((scan, index) =>
          <motion.div
            key={scan.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(0.05 * index, 0.3) }}
            className="a-list-row">
            
                <span
              className="a-list-icon"
              style={{ background: BABY_COLORS[scan.baby_label] + '22', color: BABY_COLORS[scan.baby_label] }}>
              
                  {isMultiple ? scan.baby_label : <Baby size={17} strokeWidth={2} />}
                </span>
                <div>
                  <p className="a-list-title" style={{ fontSize: 14.5 }}>{scan.efw_grams} q · {scan.percentile}p</p>
                  <p className="a-list-sub">
                    {scan.week}. {tr("weighttracker_ai_prompt_week", "həftə")} · {formatDateAz(scan.scan_date)}
                  </p>
                </div>
                <span className="a-list-trail">
                  <button
                className="a-icon-btn"
                style={{ width: 30, height: 30 }}
                onClick={() => setDeleteConfirmId(scan.id)}>
                
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </span>
              </motion.div>
          )}
          </div>
        </motion.section> :
      !loading &&
      <motion.div className="a-card a-fade-in" style={{ marginTop: 12, textAlign: 'center', padding: '28px 16px' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="a-list-sub" style={{ margin: 0 }}>{tr("fetalgrowth_no_scans_yet", "Hələ USM qeydi yoxdur")}</p>
          <p className="a-list-sub" style={{ margin: '4px 0 0' }}>{tr("fetalgrowth_add_scan_hint", "İlk USM ölçünüzü əlavə edin")}</p>
        </motion.div>
      }

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteConfirmId &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setDeleteConfirmId(null)}>
          
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
              <p className="a-list-sub text-center" style={{ margin: '0 0 20px', whiteSpace: 'normal' }}>
                {tr("fetalgrowth_delete_confirm", "Bu USM qeydini silmək istəyirsiniz?")}
              </p>
              <div className="flex gap-2">
                <button className="a-btn-soft flex-1" style={{ justifyContent: 'center' }} onClick={() => setDeleteConfirmId(null)}>
                  {tr("weighttracker_legv_et_b5e49c", "Ləğv et")}
                </button>
                <button
                className="a-cta-btn flex-1"
                style={{ justifyContent: 'center', background: 'var(--a-pink-2)' }}
                onClick={() => {
                  if (deleteConfirmId) deleteScan(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}>
                
                  {tr("weighttracker_sil", "Sil")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Add Scan Sheet */}
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
                
                  <TrendingUp size={28} style={{ color: 'var(--a-accent-ink)' }} />
                </motion.div>
              </div>
              
              <div className="p-6">
                <h2 className="a-heading text-center" style={{ margin: '0 0 4px', fontSize: 18, color: 'var(--a-ink)' }}>{tr("fetalgrowth_add_title", "USM ölçüsü əlavə et")}</h2>
                <p className="a-list-sub text-center" style={{ margin: '0 0 20px', whiteSpace: 'normal' }}>{tr("fetalgrowth_add_subtitle", "Son USM-dəki təxmini çəkini daxil edin")}</p>
                
                {isMultiple &&
              <div className="mb-4">
                    <label className="a-list-time" style={{ display: 'block', marginBottom: 8 }}>{tr("fetalgrowth_which_baby", "Hansı körpə?")}</label>
                    <div className="flex gap-2">
                      {babyLabels.map((label) =>
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSelectedLabel(label)}
                    className="flex-1"
                    style={{
                      height: 44,
                      borderRadius: 14,
                      fontWeight: 700,
                      border: selectedLabel === label ? `2px solid ${BABY_COLORS[label]}` : '1px solid var(--a-line-strong)',
                      background: selectedLabel === label ? BABY_COLORS[label] + '18' : 'var(--a-surface)',
                      color: selectedLabel === label ? BABY_COLORS[label] : 'var(--a-ink-soft)'
                    }}>
                    
                          {label}
                        </button>
                  )}
                    </div>
                  </div>
              }

                <div className="mb-4">
                  <label className="a-list-time" style={{ display: 'block', marginBottom: 8 }}>{tr("fetalgrowth_scan_date_label", "USM tarixi")}</label>
                  <input
                  type="date"
                  value={scanDate}
                  onChange={(e) => setScanDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="a-input w-full" />
                
                </div>

                <div className="mb-5 relative">
                  <label className="a-list-time" style={{ display: 'block', marginBottom: 8 }}>{tr("fetalgrowth_efw_label", "Təxmini çəki (qram)")}</label>
                  <input
                  type="number"
                  step="1"
                  placeholder="1200"
                  value={efwInput}
                  onChange={(e) => setEfwInput(e.target.value)}
                  className="a-input w-full text-center"
                  style={{ height: 60, fontSize: 28, fontWeight: 800, borderRadius: 18 }} />
                
                  <span className="absolute end-4 a-list-value" style={{ top: 46, transform: 'translateY(-50%)', color: 'var(--a-ink-soft)' }}>q</span>
                </div>

                <motion.button
                onClick={handleAddScan}
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

};

export default FetalGrowthTracker;

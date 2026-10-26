import { useState, useEffect, useMemo } from 'react';
import { getLocaleTag } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, TrendingUp, Plus, Ruler, CircleDot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { hapticFeedback } from '@/lib/native';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { tr } from "@/lib/tr";

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

type MetricKey = 'weight' | 'height';

/** Build an SVG line + area path from a series of values (anacan-demo chart). */
function buildPath(values: readonly number[], width: number, height: number, pad: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const area = `${d} L${last[0].toFixed(1)},${height - pad} L${points[0][0].toFixed(1)},${height - pad} Z`;
  return { d, area, last };
}

/**
 * Growth tracker — redesigned to the anacan-demo "Development tracker" card
 * (weight/height tabs + line chart + stat tiles). Data logic unchanged:
 * same `baby_growth` fetch/insert filtered by the selected child.
 */
const GrowthTrackerWidget = () => {
  const { user } = useAuth();
  const { selectedChild, getChildAge } = useChildren();
  const { toast } = useToast();
  const [entries, setEntries] = useState<BabyGrowthEntry[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [headInput, setHeadInput] = useState('');
  const [metric, setMetric] = useState<MetricKey>('weight');

  // Check if baby is under 1 year old using selectedChild
  const showHeadCircumference = useMemo(() => {
    if (!selectedChild) return true; // Show by default if no child selected
    const ageInMonths = getChildAge(selectedChild).months;
    return ageInMonths < 12;
  }, [selectedChild, getChildAge]);

  // Fetch baby growth entries - filtered by selectedChild
  useEffect(() => {
    const fetchEntries = async () => {
      if (!user) return;
      try {
        let query = supabase
          .from('baby_growth')
          .select('*')
          .eq('user_id', user.id)
          .order('entry_date', { ascending: false })
          .limit(10);
        
        // Filter by selected child
        if (selectedChild) {
          query = query.eq('child_id', selectedChild.id);
        }
        
        const { data, error } = await query;
        
        if (error) {
          console.log('Baby growth fetch error:', error);
          return;
        }
        setEntries((data || []) as BabyGrowthEntry[]);
      } catch (e) {
        console.log('Baby growth table not ready');
      }
    };
    fetchEntries();
  }, [user, selectedChild]);

  const latestEntry = entries[0];
  const previousEntry = entries[1];

  // Calculate changes
  const weightChange = latestEntry && previousEntry 
    ? ((latestEntry.weight_kg || 0) - (previousEntry.weight_kg || 0)).toFixed(2)
    : null;
  const heightChange = latestEntry && previousEntry
    ? ((latestEntry.height_cm || 0) - (previousEntry.height_cm || 0)).toFixed(1)
    : null;

  const handleAddEntry = async () => {
    if (!user) return;
    
    const weight = parseFloat(weightInput);
    const height = parseFloat(heightInput);
    
    if (isNaN(weight) && isNaN(height)) {
      toast({
        title: tr("growthtrackerwidget_melumat_daxil_edin_2ab80a", 'Məlumat daxil edin'),
        description: tr("growthtrackerwidget_ceki_ve_ya_boy_daxil_edin_10a689", 'Çəki və ya boy daxil edin'),
        variant: 'destructive',
      });
      return;
    }
    
    await hapticFeedback.medium();
    
    try {
      const { data, error } = await supabase
        .from('baby_growth')
        .insert({
          user_id: user.id,
          child_id: selectedChild?.id || null,
          weight_kg: isNaN(weight) ? null : weight,
          height_cm: isNaN(height) ? null : height,
          head_cm: showHeadCircumference && !isNaN(parseFloat(headInput)) ? parseFloat(headInput) : null,
          entry_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Add new entry to local state
      if (data) {
        setEntries(prev => [data as BabyGrowthEntry, ...prev]);
      }
      setWeightInput('');
      setHeightInput('');
      setHeadInput('');
      setShowInput(false);
      
      toast({
        title: tr("growthtrackerwidget_olcu_yadda_saxlandi_3c8d60", 'Ölçü yadda saxlandı! 📏'),
        description: `${!isNaN(weight) ? `${weight} ${tr('growthtrackerwidget_unit_kg','kq')}` : ''} ${!isNaN(height) ? `${height} ${tr('growthtrackerwidget_unit_cm','sm')}` : ''}`,
      });
    } catch (error) {
      console.error('Error adding growth entry:', error);
      toast({
        title: tr("growthtrackerwidget_xeta_bas_verdi_f22fba", 'Xəta baş verdi'),
        variant: 'destructive',
      });
    }
  };

  // Chart data — chronological order, only entries with the selected metric
  const chartEntries = useMemo(() => {
    const chronological = [...entries].reverse();
    return chronological.filter((e) => (metric === 'weight' ? e.weight_kg != null : e.height_cm != null));
  }, [entries, metric]);

  const chartValues = chartEntries.map((e) => (metric === 'weight' ? e.weight_kg! : e.height_cm!));
  const unit = metric === 'weight' ? tr('growthtrackerwidget_unit_kg', 'kq') : tr('growthtrackerwidget_unit_cm', 'sm');
  const hasChart = chartValues.length >= 2;

  const width = 300;
  const height = 116;
  const pad = 10;
  const chart = hasChart ? buildPath(chartValues, width, height, pad) : null;

  const formatAxisDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  return (
    <motion.div
      className="a-card a-fade-in"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      <div className="a-card-head">
        <h3 className="a-card-title a-heading">{tr("growthtrackerwidget_inkisaf_izleyicisi_71039e", "İnkişaf izləyicisi")}</h3>
        <div className="a-tabs">
          <button type="button" className={`a-tab${metric === 'weight' ? ' active' : ''}`} onClick={() => setMetric('weight')}>
            {tr("growthtrackerwidget_ceki_b10cc4", "Çəki")}
          </button>
          <button type="button" className={`a-tab${metric === 'height' ? ' active' : ''}`} onClick={() => setMetric('height')}>
            {tr('growthtrackerwidget_height', 'Boy')}
          </button>
        </div>
      </div>

      {/* Line chart */}
      {hasChart && chart ? (
        <>
          <div className="a-chart-wrap">
            <span
              className="a-chart-tooltip"
              style={{ insetInlineStart: `${(chart.last[0] / width) * 100}%` }}
            >
              {chartValues[chartValues.length - 1]} {unit}
            </span>
            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
              <defs>
                <linearGradient id={`a-growth-fade-${metric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--a-chart-line)" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="var(--a-chart-line)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((f) => (
                <line
                  key={f}
                  x1="0"
                  x2={width}
                  y1={height * f}
                  y2={height * f}
                  stroke="var(--a-line)"
                  strokeDasharray="3 5"
                  strokeWidth="1"
                />
              ))}
              <path d={chart.area} fill={`url(#a-growth-fade-${metric})`} />
              <path d={chart.d} fill="none" stroke="var(--a-chart-line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={chart.last[0]} cy={chart.last[1]} r="4.5" fill="var(--a-surface)" stroke="var(--a-chart-line)" strokeWidth="2.5" />
            </svg>
          </div>
          <div className="a-chart-axis">
            <span>{formatAxisDate(chartEntries[0].entry_date)}</span>
            <span>{formatAxisDate(chartEntries[chartEntries.length - 1].entry_date)}</span>
          </div>
        </>
      ) : (
        <p className="a-list-sub" style={{ whiteSpace: 'normal', textAlign: 'center', padding: '14px 0' }}>
          {tr('mommy_growth_empty', 'Qrafik üçün ən azı 2 ölçü lazımdır')}
        </p>
      )}

      {/* Current stats */}
      <div className={showHeadCircumference ? 'a-grid-3' : 'a-grid-2'}>
        <div className="a-stat-tile">
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
            <Scale size={14} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="a-stat-tile-label">{tr("growthtrackerwidget_ceki_b10cc4", "Çəki")}</p>
            <p className="a-stat-tile-value" style={{ fontSize: 13 }}>
              {latestEntry?.weight_kg ? `${latestEntry.weight_kg} ${tr('growthtrackerwidget_unit_kg', 'kq')}` : '—'}
            </p>
            {weightChange && parseFloat(weightChange) !== 0 && (
              <p className="a-stat-tile-label" style={{ display: 'flex', alignItems: 'center', gap: 3, color: parseFloat(weightChange) > 0 ? 'var(--a-green-2)' : 'var(--a-pink-2)' }}>
                <TrendingUp size={10} style={{ transform: parseFloat(weightChange) > 0 ? 'none' : 'rotate(180deg)' }} />
                {parseFloat(weightChange) > 0 ? '+' : ''}{weightChange}
              </p>
            )}
          </div>
        </div>

        <div className="a-stat-tile">
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
            <Ruler size={14} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="a-stat-tile-label">{tr('growthtrackerwidget_height', 'Boy')}</p>
            <p className="a-stat-tile-value" style={{ fontSize: 13 }}>
              {latestEntry?.height_cm ? `${latestEntry.height_cm} ${tr('growthtrackerwidget_unit_cm', 'sm')}` : '—'}
            </p>
            {heightChange && parseFloat(heightChange) !== 0 && (
              <p className="a-stat-tile-label" style={{ display: 'flex', alignItems: 'center', gap: 3, color: parseFloat(heightChange) > 0 ? 'var(--a-green-2)' : 'var(--a-pink-2)' }}>
                <TrendingUp size={10} style={{ transform: parseFloat(heightChange) > 0 ? 'none' : 'rotate(180deg)' }} />
                {parseFloat(heightChange) > 0 ? '+' : ''}{heightChange}
              </p>
            )}
          </div>
        </div>

        {showHeadCircumference && (
          <div className="a-stat-tile">
            <span className="a-stat-tile-icon" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
              <CircleDot size={14} />
            </span>
            <div style={{ minWidth: 0 }}>
              <p className="a-stat-tile-label">{tr("growthtrackerwidget_bas_compact", "Baş")}</p>
              <p className="a-stat-tile-value" style={{ fontSize: 13 }}>
                {latestEntry?.head_cm ? `${latestEntry.head_cm} ${tr('growthtrackerwidget_unit_cm', 'sm')}` : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Input */}
      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
            style={{ marginTop: 14 }}
          >
            <div className={`grid ${showHeadCircumference ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
              <div>
                <label className="a-stat-tile-label" style={{ display: 'block', marginBottom: 4 }}>{tr("growthtrackerwidget_ceki_kq_2f7555", "Çəki (kq)")}</label>
                <input
                  type="number"
                  step="0.1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder="5.2"
                  className="a-input"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label className="a-stat-tile-label" style={{ display: 'block', marginBottom: 4 }}>{tr('growthtrackerwidget_height_cm', 'Boy (sm)')}</label>
                <input
                  type="number"
                  step="0.5"
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  placeholder="58"
                  className="a-input"
                  style={{ width: '100%' }}
                />
              </div>
              {showHeadCircumference && (
                <div>
                  <label className="a-stat-tile-label" style={{ display: 'block', marginBottom: 4 }}>{tr("growthtrackerwidget_bas_sm_927b99", "Baş (sm)")}</label>
                  <input
                    type="number"
                    step="0.5"
                    value={headInput}
                    onChange={(e) => setHeadInput(e.target.value)}
                    placeholder="38"
                    className="a-input"
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
            <motion.button
              onClick={handleAddEntry}
              className="a-btn-solid"
              style={{ width: '100%', justifyContent: 'center' }}
              whileTap={{ scale: 0.98 }}
            >
              {tr('growthtrackerwidget_save', 'Yadda saxla')}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last updated + add toggle */}
      <div className="a-teaser" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span>
          {latestEntry
            ? <>{tr('growthtrackerwidget_last_meas_label', 'Son ölçü:')} <strong>{new Date(latestEntry.entry_date).toLocaleDateString(getLocaleTag())}</strong></>
            : tr('mommy_growth_no_entries', 'Hələ ölçü qeyd edilməyib')}
        </span>
        <motion.button
          onClick={() => setShowInput(!showInput)}
          className="a-btn-soft"
          style={{ flexShrink: 0 }}
          whileTap={{ scale: 0.9 }}
        >
          <Plus size={13} strokeWidth={2.5} style={{ transition: 'transform 150ms ease', transform: showInput ? 'rotate(45deg)' : 'none' }} />
          {tr("dashboard_elave_et_a5fb21", "+ \u018Flav\u0259 et").replace('+ ', '')}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default GrowthTrackerWidget;

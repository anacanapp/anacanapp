import { tr } from "@/lib/tr";import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { useCycleHistory, useCycleStats } from '@/hooks/useCycleHistory';

const CycleTrendChart = () => {
  const { data: cycles = [], isLoading } = useCycleHistory();
  const stats = useCycleStats();

  const chartData = cycles.
  filter((c) => c.cycle_length && c.cycle_length > 0).
  slice(0, 12).
  reverse().
  map((c) => ({
    cycle: `#${c.cycle_number}`,
    length: c.cycle_length!
  }));

  if (isLoading) {
    return (
      <div className="a-card animate-pulse">
        <div style={{ height: 24, width: '50%', borderRadius: 8, background: 'var(--a-surface-soft)', marginBottom: 14 }} />
        <div style={{ height: 150, borderRadius: 16, background: 'var(--a-surface-soft)' }} />
      </div>);

  }

  if (chartData.length < 2) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="a-card a-fade-in">
      
      <div className="a-card-head" style={{ marginBottom: 10 }}>
        <h3 className="a-card-title a-heading">{tr("cycletrendchart_tsikl_uzunlugu_trendi_13a67d", "Tsikl Uzunlu\u011Fu Trendi")}</h3>
        <span className="a-section-link" style={{ color: 'var(--a-ink-soft)' }}>{tr("cycletrendchart_tsikl_count", "{count} tsikl").replace("{count}", String(chartData.length))}</span>
      </div>

      <div className="h-44 -ms-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 5" stroke="var(--a-line-strong)" opacity={0.6} />
            <XAxis dataKey="cycle" tick={{ fontSize: 10, fill: 'var(--a-ink-soft)' }} stroke="var(--a-line-strong)" />
            <YAxis domain={[15, 45]} tick={{ fontSize: 10, fill: 'var(--a-ink-soft)' }} stroke="var(--a-line-strong)" width={28} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--a-surface)',
                border: '1px solid var(--a-line-strong)',
                borderRadius: 12,
                fontSize: 12,
                color: 'var(--a-ink)'
              }}
              formatter={(v: number) => [`${v} ${tr("common_gun", "gün")}`, tr("cycletrendchart_uzunluq_f427cd", "Uzunluq")]} />
            
            <ReferenceLine y={stats.averageCycleLength} stroke="var(--a-chart-line)" strokeDasharray="4 4" label={{ value: `${tr("common_orta", "Orta")} ${stats.averageCycleLength}`, position: 'insideTopRight', fontSize: 10, fill: 'var(--a-chart-line)' }} />
            <ReferenceLine y={21} stroke="#e05575" strokeOpacity={0.35} strokeDasharray="2 4" />
            <ReferenceLine y={35} stroke="#e05575" strokeOpacity={0.35} strokeDasharray="2 4" />
            <Line type="monotone" dataKey="length" stroke="var(--a-chart-line)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--a-chart-line)' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="a-teaser" style={{ textAlign: 'center' }}>
        {tr("cycletrendchart_normal_diapazon_21_35_gun_acog_48b2bf", "Normal diapazon: 21\u201335 g\xFCn (ACOG)")}
      </p>
    </motion.div>);

};

export default CycleTrendChart;
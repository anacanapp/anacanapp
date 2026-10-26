import { useMemo } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import { TrendingUp, Smile, Zap, Heart } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useFlowMoodChart } from '@/hooks/useFlowDailyLogs';

const FlowMoodChart = () => {
  const { data: moodData = [], isLoading } = useFlowMoodChart();

  const chartData = useMemo(() => {
    // Create array of last 14 days
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayData = moodData.find((d) => d.log_date === dateStr);

      days.push({
        date: dateStr,
        dayLabel: format(date, 'd', { locale: getCurrentDateLocale() }),
        mood: dayData?.mood || null,
        energy: dayData?.energy_level || null,
        pain: dayData?.pain_level || null,
        sleep: dayData?.sleep_quality || null
      });
    }
    return days;
  }, [moodData]);

  const averages = useMemo(() => {
    const withMood = moodData.filter((d) => d.mood);
    const withEnergy = moodData.filter((d) => d.energy_level);
    const withSleep = moodData.filter((d) => d.sleep_quality);

    return {
      mood: withMood.length > 0 ? (withMood.reduce((a, b) => a + (b.mood || 0), 0) / withMood.length).toFixed(1) : '-',
      energy: withEnergy.length > 0 ? (withEnergy.reduce((a, b) => a + (b.energy_level || 0), 0) / withEnergy.length).toFixed(1) : '-',
      sleep: withSleep.length > 0 ? (withSleep.reduce((a, b) => a + (b.sleep_quality || 0), 0) / withSleep.length).toFixed(1) : '-',
      totalLogs: moodData.length
    };
  }, [moodData]);

  if (isLoading) {
    return (
      <div className="a-card animate-pulse">
        <div style={{ height: 24, width: '33%', borderRadius: 8, background: 'var(--a-surface-soft)', marginBottom: 14 }} />
        <div style={{ height: 150, borderRadius: 16, background: 'var(--a-surface-soft)' }} />
      </div>);

  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg p-3" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line-strong)', boxShadow: 'var(--a-card-shadow)' }}>
          <p className="text-sm font-medium text-foreground mb-2">
            {format(parseISO(data.date), 'd MMMM', { locale: getCurrentDateLocale() })}
          </p>
          {data.mood &&
          <p className="text-xs text-muted-foreground">
              {tr("flowmoodchart_ehval_1ea198", "\u018Fhval:")} {['', '😢', '😔', '😐', '😊', '🥰'][data.mood]} ({data.mood}/5)
            </p>
          }
          {data.energy &&
          <p className="text-xs text-muted-foreground">
              {tr("common_enerji_label", 'Enerji:')} {data.energy}/5
            </p>
          }
          {data.sleep &&
          <p className="text-xs text-muted-foreground">
              {tr("flowmoodchart_yuxu_label", 'Yuxu:')} {data.sleep}/5
            </p>
          }
        </div>);

    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="a-card a-fade-in">
      
      <div className="a-card-head" style={{ marginBottom: 4 }}>
        <h3 className="a-card-title a-heading">{tr("flowmoodchart_ehval_qrafiki_fe3531", "\u018Fhval Qrafiki")}</h3>
        <span className="a-section-link" style={{ color: 'var(--a-ink-soft)' }}>{tr("flowmoodchart_son_14_gun_6be43a", "Son 14 gün")}</span>
      </div>

      <p className="a-today-info-eyebrow" style={{ margin: '0 0 14px' }}>
        {tr("flowmoodchart_ehval_qrafiki_fe3531", "\u018Fhval Qrafiki")} · {tr("flowmoodchart_son_14_gun_6be43a", "Son 14 gün")}
      </p>

      {/* Stats Summary */}
      <div className="a-trio" style={{ marginBottom: 14 }}>
        <div className="a-trio-item" style={{ border: 'none', boxShadow: 'none', background: 'var(--a-surface-soft)' }}>
          <span className="a-trio-icon" style={{ background: 'var(--a-grad-pink)', color: 'var(--a-berry-ink)' }}>
            <Smile size={16} strokeWidth={2} />
          </span>
          <p className="a-trio-value">{averages.mood}</p>
          <p className="a-trio-label">{tr("flowmoodchart_orta_ehval_d444a0", "Orta Əhval")}</p>
        </div>
        <div className="a-trio-item" style={{ border: 'none', boxShadow: 'none', background: 'var(--a-surface-soft)' }}>
          <span className="a-trio-icon" style={{ background: 'var(--a-grad-yellow)', color: 'var(--a-warn-ink)' }}>
            <Zap size={16} strokeWidth={2} />
          </span>
          <p className="a-trio-value">{averages.energy}</p>
          <p className="a-trio-label">{tr("untranslated_orta_enerji_ojxdi0", "Orta Enerji")}</p>
        </div>
        <div className="a-trio-item" style={{ border: 'none', boxShadow: 'none', background: 'var(--a-surface-soft)' }}>
          <span className="a-trio-icon" style={{ background: 'var(--a-grad-lav)', color: 'var(--a-lav-ink)' }}>
            <Heart size={16} strokeWidth={2} />
          </span>
          <p className="a-trio-value">{averages.totalLogs}</p>
          <p className="a-trio-label">{tr("flowmoodchart_qeyd_sayi_3b2708", "Qeyd Sayı")}</p>
        </div>
      </div>

      {/* Chart */}
      {moodData.length > 0 ?
      <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
              dataKey="dayLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
            
              <YAxis
              domain={[0, 5]}
              hide />
            
              <Tooltip content={<CustomTooltip />} />
              <Area
              type="monotone"
              dataKey="mood"
              stroke="#ec4899"
              strokeWidth={2}
              fill="url(#moodGradient)"
              connectNulls
              dot={{ r: 3, fill: '#ec4899' }} />
            
              <Area
              type="monotone"
              dataKey="energy"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#energyGradient)"
              connectNulls
              dot={{ r: 3, fill: '#f59e0b' }} />
            
            </AreaChart>
          </ResponsiveContainer>
        </div> :

      <div className="h-40 flex items-center justify-center">
          <div className="text-center">
            <Smile size={36} style={{ color: 'var(--a-ink-faint)', margin: '0 auto 8px' }} />
            <p className="a-list-sub" style={{ margin: 0 }}>
              {tr("flowmoodchart_ehval_qeydleri_elave_edin_f86771", "\u018Fhval qeydl\u0259ri \u0259lav\u0259 edin")}
            </p>
          </div>
        </div>
      }

      {/* Legend */}
      <div className="a-legend-row" style={{ justifyContent: 'center' }}>
        <span className="a-legend-item">
          <span className="a-legend-dot" style={{ background: '#ec4899' }} /> {tr("flowmoodchart_ehval_0457f9", "Əhval")}
        </span>
        <span className="a-legend-item">
          <span className="a-legend-dot" style={{ background: '#f59e0b' }} /> {tr("untranslated_enerji_q6zcss", "Enerji")}
        </span>
      </div>
    </motion.div>);

};

export default FlowMoodChart;
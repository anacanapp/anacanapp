import { tr } from '@/lib/tr';
import { useBabyLogs } from '@/hooks/useBabyLogs';

interface DayStats {
  date: string;
  feedingCount: number;
  sleepHours: number;
  diaperCount: number;
}

/**
 * Weekly review — redesigned to the anacan-demo list card with
 * per-day mini-dot sparklines. Data source (baby_logs) unchanged.
 */
const QuickStatsWidget = () => {
  const { logs } = useBabyLogs();

  // Calculate last 7 days stats
  const getWeeklyStats = (): DayStats[] => {
    const stats: DayStats[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayLogs = logs.filter((log) => log.start_time.startsWith(dateStr));
      const feedingLogs = dayLogs.filter((l) => l.log_type === 'feeding');
      const sleepLogs = dayLogs.filter((l) => l.log_type === 'sleep');
      const diaperLogs = dayLogs.filter((l) => l.log_type === 'diaper');

      let sleepMinutes = 0;
      sleepLogs.forEach((log) => {
        if (log.end_time) {
          const start = new Date(log.start_time);
          const end = new Date(log.end_time);
          sleepMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
        }
      });

      stats.push({
        date: dateStr,
        feedingCount: feedingLogs.length,
        sleepHours: Math.round(sleepMinutes / 60 * 10) / 10,
        diaperCount: diaperLogs.length
      });
    }

    return stats;
  };

  const weeklyStats = getWeeklyStats();

  // Calculate averages
  const avgFeeding = weeklyStats.reduce((sum, d) => sum + d.feedingCount, 0) / 7;
  const avgSleep = weeklyStats.reduce((sum, d) => sum + d.sleepHours, 0) / 7;
  const avgDiaper = weeklyStats.reduce((sum, d) => sum + d.diaperCount, 0) / 7;

  const rows = [
    {
      key: 'feeding',
      icon: '🍽️',
      label: tr("quickstatswidget_ort_qidalanma", "Ort. qidalanma"),
      value: avgFeeding.toFixed(1),
      data: weeklyStats.map((d) => d.feedingCount)
    },
    {
      key: 'sleep',
      icon: '🌙',
      label: tr("quickstatswidget_ort_yuxu_s", "Ort. yuxu (s)"),
      value: avgSleep.toFixed(1),
      data: weeklyStats.map((d) => d.sleepHours)
    },
    {
      key: 'diaper',
      icon: '🧷',
      label: tr("quickstatswidget_ort_bez", "Ort. bez"),
      value: avgDiaper.toFixed(1),
      data: weeklyStats.map((d) => d.diaperCount)
    }
  ];

  return (
    <section className="a-section">
      <div className="a-section-head">
        <h2 className="a-section-title a-heading">{tr("quickstatswidget_heftelik_baxis_625baf", "Həftəlik Baxış")}</h2>
      </div>
      <div className="a-list-card a-fade-in">
        {rows.map((row) => {
          const max = Math.max(...row.data, 1);
          return (
            <div key={row.key} className="a-list-row">
              <span className="a-list-icon" style={{ background: 'var(--a-surface-soft)', fontSize: 17 }}>
                {row.icon}
              </span>
              <div>
                <p className="a-list-title">{row.label}</p>
                <p className="a-list-sub">{tr('mommy_this_week', 'Bu həftə')}</p>
              </div>
              <span className="a-list-trail" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="a-mini-dots">
                  {row.data.map((v, i) => (
                    <span
                      key={i}
                      className={i === row.data.length - 1 && v > 0 ? 'peak' : ''}
                      style={{ height: 4 + Math.round((v / max) * 13) }}
                    />
                  ))}
                </span>
                <p className="a-list-value">{row.value}</p>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default QuickStatsWidget;

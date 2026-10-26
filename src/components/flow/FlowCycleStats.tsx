import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import { Calendar, TrendingUp, Clock, Activity, BarChart3 } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { useCycleHistory, useCycleStats, CycleHistory } from '@/hooks/useCycleHistory';

const FlowCycleStats = () => {
  const { data: cycles = [], isLoading } = useCycleHistory();
  const stats = useCycleStats();

  if (isLoading) {
    return (
      <div className="a-card animate-pulse">
        <div style={{ height: 24, width: '33%', borderRadius: 8, background: 'var(--a-surface-soft)', marginBottom: 14 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ height: 60, borderRadius: 16, background: 'var(--a-surface-soft)' }} />
          <div style={{ height: 60, borderRadius: 16, background: 'var(--a-surface-soft)' }} />
        </div>
      </div>);

  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="a-card a-fade-in">
      
      <div className="a-card-head">
        <h3 className="a-card-title a-heading">{tr("flowcyclestats_tsikl_statistikasi_e8cbea", "Tsikl Statistikas\u0131")}</h3>
        <span className="a-section-link" style={{ color: 'var(--a-ink-soft)' }}>{tr("flowcyclestats_tsikl_count", "{count} tsikl").replace("{count}", String(stats.totalCycles))}</span>
      </div>

      {/* Stats Grid */}
      <div className="a-grid-2" style={{ marginTop: 0 }}>
        <div className="a-stat-tile">
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-grad-pink)', color: 'var(--a-berry-ink)' }}>
            <Calendar size={15} />
          </span>
          <div>
            <p className="a-stat-tile-label">{tr("untranslated_orta_tsikl_vxzcvs", "Orta Tsikl")}</p>
            <p className="a-stat-tile-value">{stats.averageCycleLength} {tr("flowcyclestats_gun_54e78d", "gün")}</p>
          </div>
        </div>

        <div className="a-stat-tile">
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-grad-blue)', color: 'var(--a-blue-ink)' }}>
            <Clock size={15} />
          </span>
          <div>
            <p className="a-stat-tile-label">{tr("untranslated_orta_period_tvx5me", "Orta Period")}</p>
            <p className="a-stat-tile-value">{stats.averagePeriodLength} {tr("flowcyclestats_gun_54e78d", "gün")}</p>
          </div>
        </div>

        <div className="a-stat-tile">
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-grad-yellow)', color: 'var(--a-warn-ink)' }}>
            <TrendingUp size={15} />
          </span>
          <div>
            <p className="a-stat-tile-label">{tr("untranslated_diapazon_dgfplg", "Diapazon")}</p>
            <p className="a-stat-tile-value">{stats.shortestCycle}–{stats.longestCycle} {tr("flowcyclestats_gun_54e78d", "gün")}</p>
          </div>
        </div>

        <div className="a-stat-tile">
          <span className="a-stat-tile-icon" style={{ background: 'var(--a-grad-green)', color: 'var(--a-green-ink)' }}>
            <Activity size={15} />
          </span>
          <div>
            <p className="a-stat-tile-label">{tr("untranslated_variasiya_nbjh0m", "Variasiya")}</p>
            <p className="a-stat-tile-value">{stats.cycleVariation} {tr("flowcyclestats_gun_ferq_d595f3", "gün fərq")}</p>
          </div>
        </div>
      </div>

      {/* Recent Cycles */}
      {cycles.length > 0 &&
      <div style={{ marginTop: 14 }}>
          <p className="a-today-info-eyebrow" style={{ marginBottom: 4 }}>{tr("flowcyclestats_son_tsikller_7e7eb6", "Son Tsikllər")}</p>
          <div>
            {cycles.slice(0, 3).map((cycle) =>
          <div key={cycle.id} className="a-rank-row">
                <span className="a-rank-avatar" style={{ background: 'var(--a-surface-soft)', fontSize: 11.5, fontWeight: 800, color: 'var(--a-ink-soft)' }}>
                  #{cycle.cycle_number}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p className="a-rank-title">
                    {format(parseISO(cycle.start_date), 'd MMM', { locale: getCurrentDateLocale() })}
                    {cycle.end_date &&
                <span style={{ color: 'var(--a-ink-soft)' }}>
                        {' – '}
                        {format(parseISO(cycle.end_date), 'd MMM', { locale: getCurrentDateLocale() })}
                      </span>
                }
                  </p>
                  <p className="a-rank-sub">
                    {cycle.cycle_length ? tr("flowcyclestats_gun_tsikl_f123bc", "{length} gün tsikl").replace("{length}", String(cycle.cycle_length)) : tr("flowcyclestats_davam_edir_f842cd", "Davam edir")}
                  </p>
                </div>
                {cycle.period_length &&
            <span className="a-rank-tag intensive">
                    {cycle.period_length} {tr("flowcyclestats_gun_54e78d", "g\xFCn")}
                  </span>
            }
              </div>
          )}
          </div>
        </div>
      }

      {cycles.length === 0 &&
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Calendar size={36} style={{ color: 'var(--a-ink-faint)', margin: '0 auto 8px' }} />
          <p className="a-list-title" style={{ marginBottom: 3 }}>
            {tr("flowcyclestats_tsikl_tarixi_yoxdur_b78f8c", "Tsikl tarixi yoxdur")}
          </p>
          <p className="a-list-sub" style={{ margin: 0 }}>
            {tr("flowcyclestats_period_gunlerini_qeyd_etdikde__f44b96", "Period g\xFCnl\u0259rini qeyd etdikd\u0259 tarix yaranacaq")}
          </p>
        </div>
      }
    </motion.div>);

};

export default FlowCycleStats;
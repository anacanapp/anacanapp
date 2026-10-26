import { tr } from "@/lib/tr";import { motion } from 'framer-motion';
import { AlertTriangle, Info } from 'lucide-react';
import { useCycleStats, useCycleHistory } from '@/hooks/useCycleHistory';

const CycleAnomalyBanner = () => {
  const stats = useCycleStats();
  const { data: cycles = [] } = useCycleHistory();

  if (cycles.length < 3) return null;

  const anomalies: {severity: 'warn' | 'info';title: string;message: string;}[] = [];

  if (stats.shortestCycle > 0 && stats.shortestCycle < 21) {
    anomalies.push({
      severity: 'warn',
      title: tr("cycleanomalybanner_qisa_tsikl_askar_edildi_b0e734", "Qısa tsikl aşkar edildi"),
      message: tr("flow_shortest_cycle_msg", "Ən qısa tsikliniz {days} gündür. 21 gündən az tsikllər həkim müraciəti tələb edə bilər.").replace("{days}", String(stats.shortestCycle))
    });
  }

  if (stats.longestCycle > 35) {
    anomalies.push({
      severity: 'warn',
      title: tr("cycleanomalybanner_uzun_tsikl_askar_edildi_14479e", "Uzun tsikl aşkar edildi"),
      message: tr("flow_longest_cycle_msg", "Ən uzun tsikliniz {days} gündür. 35 gündən uzun tsikllər PCOS və ya hormonal disbalans əlaməti ola bilər.").replace("{days}", String(stats.longestCycle))
    });
  }

  if (stats.cycleVariation > 7) {
    anomalies.push({
      severity: 'info',
      title: tr("cycleanomalybanner_duzensiz_tsikl_7b2693", "Düzənsiz tsikl"),
      message: tr("flow_cycle_diff_msg", "Tsikllər arasında {days} gün fərq var. Bu stress, çəki dəyişikliyi və ya tireoid problemlərlə bağlı ola bilər.").replace("{days}", String(stats.cycleVariation))
    });
  }

  if (anomalies.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      {anomalies.map((a, i) => {
        const isWarn = a.severity === 'warn';
        const Icon = isWarn ? AlertTriangle : Info;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="a-card">
            
            <div className="a-list-row" style={{ padding: 0 }}>
              <span className="a-list-icon" style={isWarn ? { background: 'var(--a-pink-1)', color: 'var(--a-pink-ink)' } : { background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)' }}>
                <Icon size={16} strokeWidth={2} />
              </span>
              <p className="a-list-title">{a.title}</p>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.55, color: 'var(--a-ink-soft)' }}>{a.message}</p>
          </motion.div>);

      })}
    </div>);

};

export default CycleAnomalyBanner;
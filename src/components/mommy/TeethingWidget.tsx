import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import { ChevronRight, Check, Clock } from 'lucide-react';
import { useTeething } from '@/hooks/useTeething';
import { useChildren } from '@/hooks/useChildren';

interface TeethingWidgetProps {
  onOpen: () => void;
}

/**
 * Teething tracker summary — redesigned to the anacan-demo card.
 * Same data source (useTeething / baby_teeth) and same tap-to-open behaviour.
 */
const TeethingWidget = ({ onOpen }: TeethingWidgetProps) => {
  const { selectedChild, getChildAge, hasChildren, loading: childrenLoading } = useChildren();
  const { emergedCount, totalTeeth, progress, loading: teethingLoading } = useTeething();

  // Don't render if still loading
  if (childrenLoading || teethingLoading) {
    return (
      <div className="a-card animate-pulse">
        <div style={{ height: 80, borderRadius: 16, background: 'var(--a-surface-soft)' }} />
      </div>);

  }

  // Don't show widget if no child is selected
  if (!hasChildren || !selectedChild) {
    return null;
  }

  const childAge = getChildAge(selectedChild);
  const ageMonths = childAge.months;

  // Get expected teeth count for age
  const getExpectedTeeth = (months: number): number => {
    if (months < 6) return 0;
    if (months < 8) return 2;
    if (months < 10) return 4;
    if (months < 12) return 6;
    if (months < 14) return 8;
    if (months < 18) return 12;
    if (months < 24) return 16;
    return 20;
  };

  const expectedTeeth = getExpectedTeeth(ageMonths);

  // Get next expected teeth
  const getNextTeethInfo = (months: number): {name: string;timeframe: string;} | null => {
    if (months < 6) return { name: tr("teethingwidget_alt_merkezi_kesiciler_63d8b0", "Alt mərkəzi kəsicilər"), timeframe: tr('teethingwidget_timeframe_6_10', '6-10 ay') };
    if (months < 8) return { name: tr("teethingwidget_yuxari_merkezi_kesiciler_456b8c", "Yuxarı mərkəzi kəsicilər"), timeframe: tr('teethingwidget_timeframe_8_12', '8-12 ay') };
    if (months < 10) return { name: tr("teethingwidget_yan_kesiciler_c75ada", "Yan kəsicilər"), timeframe: tr('teethingwidget_timeframe_9_16', '9-16 ay') };
    if (months < 14) return { name: tr("teethingwidget_birinci_azi_disler_eccbbc", "Birinci azı dişlər"), timeframe: tr('teethingwidget_timeframe_13_19', '13-19 ay') };
    if (months < 18) return { name: tr("teethingwidget_kopek_disleri_a86ac1", "Köpək dişləri"), timeframe: tr('teethingwidget_timeframe_16_23', '16-23 ay') };
    if (months < 24) return { name: tr("teethingwidget_ikinci_azi_disler_861654", "İkinci azı dişlər"), timeframe: tr('teethingwidget_timeframe_23_33', '23-33 ay') };
    if (emergedCount < 20) return { name: tr("teethingwidget_son_sud_disleri_c43b8c", "Son süd dişləri"), timeframe: tr('teethingwidget_timeframe_soon', 'Tezliklə') };
    return null;
  };

  const nextTeeth = getNextTeethInfo(ageMonths);

  // Determine status
  const isOnTrack = emergedCount >= expectedTeeth - 2;

  return (
    <motion.button
      onClick={onOpen}
      className="w-full text-start"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}>
      
      <div className="a-card a-fade-in">
        <div className="a-card-head" style={{ marginBottom: 6 }}>
          <h3 className="a-card-title a-heading">{tr("teethingwidget_dis_cixarma_ca53f7", "Diş Çıxarma")}</h3>
          <span className="a-section-link" style={{ color: 'var(--a-ink-soft)' }}>
            {emergedCount}/{totalTeeth} <ChevronRight className="rtl:rotate-180" size={13} />
          </span>
        </div>

        {/* Progress */}
        <div className="a-inline-bar">
          <div className="a-inline-bar-fill" style={{ width: `${progress}%`, background: 'var(--a-grad-peach)' }} />
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--a-ink-soft)' }}>
          <strong style={{ color: 'var(--a-ink)' }}>{emergedCount} / {totalTeeth}</strong> {tr("teethingwidget_cixan_disler_a9eadd", "Çıxan dişlər").toLowerCase()}
        </p>

        {/* Stats Row */}
        <div className="a-grid-2">
          {/* Status tile */}
          <div className="a-stat-tile" style={{ background: isOnTrack ? 'var(--a-green-1)' : 'var(--a-yellow-1)' }}>
            <span className="a-stat-tile-icon" style={{ background: 'var(--a-chip-overlay)', color: isOnTrack ? 'var(--a-green-2)' : 'var(--a-yellow-2)' }}>
              <Check size={14} />
            </span>
            <div style={{ minWidth: 0 }}>
              <p className="a-stat-tile-label">
                {isOnTrack ? tr('teethingwidget_normal_development', 'Normal inkişaf') : tr("teethingwidget_diqqet_764567", "Diqq\u0259t")}
              </p>
              <p className="a-stat-tile-label" style={{ fontWeight: 600 }}>
                {tr('teethingwidget_expected_teeth', '{n} aylıq üçün ~{t} diş gözlənilir').replace('{n}', String(ageMonths)).replace('{t}', String(expectedTeeth))}
              </p>
            </div>
          </div>

          {/* Next Teeth tile */}
          {nextTeeth &&
          <div className="a-stat-tile">
              <span className="a-stat-tile-icon" style={{ background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                <Clock size={14} />
              </span>
              <div style={{ minWidth: 0 }}>
                <p className="a-stat-tile-label">{tr("teethingwidget_novbeti_0fff9a", "Növbəti:")}</p>
                <p className="a-stat-tile-value" style={{ fontSize: 12, lineHeight: 1.3 }}>{nextTeeth.name}</p>
                <p className="a-stat-tile-label" style={{ fontWeight: 600 }}>{nextTeeth.timeframe}</p>
              </div>
            </div>
          }
        </div>

        <div className="a-teaser" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>
            {selectedChild.name} · <strong>{childAge.displayText}</strong>
          </span>
          <ChevronRight className="rtl:rotate-180" size={15} style={{ color: 'var(--a-ink-faint)', flexShrink: 0 }} />
        </div>
      </div>
    </motion.button>);

};

export default TeethingWidget;

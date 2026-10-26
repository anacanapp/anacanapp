import { motion } from 'framer-motion';
import { tr } from '@/lib/tr';
import { Pill, AlertCircle, Leaf, Info } from 'lucide-react';
import { useVitamins, Vitamin } from '@/hooks/useVitamins';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { getPregnancyWeek } from '@/lib/pregnancy-utils';
import { useIsRtl, rtlX } from '@/lib/rtl';

interface VitaminsTabProps {
  className?: string;
}

const VitaminsTab = ({ className }: VitaminsTabProps) => {
  const isRtl = useIsRtl();
  const { lifeStage, lastPeriodDate } = useUserStore(
    useShallow((s) => ({ lifeStage: s.lifeStage, lastPeriodDate: s.lastPeriodDate }))
  );

  // Calculate current pregnancy week
  const currentWeek =
  lifeStage === 'bump' && lastPeriodDate ?
  Math.max(1, getPregnancyWeek(lastPeriodDate)) :
  undefined;

  const { data: vitamins = [], isLoading } = useVitamins(currentWeek, lifeStage || 'bump');

  // Separate essential and recommended vitamins
  const essentialVitamins = vitamins.filter((v) => v.importance === 'essential');
  const recommendedVitamins = vitamins.filter((v) => v.importance === 'recommended');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 rounded-full animate-spin" style={{ border: '3px solid var(--a-peach-2)', borderTopColor: 'transparent' }} />
      </div>);

  }

  const VitaminCard = ({ vitamin, index, isEssential }: {vitamin: Vitamin;index: number;isEssential: boolean;}) =>
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: Math.min(index * 0.05, 0.3) }}
    className="a-card"
    style={isEssential ? { background: 'var(--a-peach-1)', border: 'none' } : undefined}>
    
      <div className="flex items-start gap-3">
        <span
        className="a-list-icon"
        style={{ background: isEssential ? 'var(--a-chip-overlay)' : 'var(--a-surface-soft)', fontSize: 18 }}>
          {vitamin.icon_emoji || '💊'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="a-list-title" style={{ margin: 0, color: isEssential ? 'var(--a-accent-ink)' : undefined }}>{vitamin.name}</h3>
            {isEssential &&
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--a-peach-2)', color: '#fff' }}>
                {tr("vitamins_vacib", "Vacib")}
              </span>
          }
          </div>
          {vitamin.description &&
        <p className="text-xs mt-0.5 line-clamp-2" style={{ margin: '2px 0 0', color: isEssential ? 'rgba(138, 69, 20, 0.75)' : 'var(--a-ink-soft)' }}>
              {vitamin.description}
            </p>
        }
          
          {/* Dosage */}
          {vitamin.dosage &&
            <div className="mt-2 flex items-center gap-1 text-[10px] font-bold" style={{ color: isEssential ? 'var(--a-accent-ink)' : 'var(--a-accent-ink)' }}>
              <Pill className="w-3 h-3" />
              {vitamin.dosage}
            </div>
          }
        </div>
      </div>

      {/* Benefits */}
      {vitamin.benefits && vitamin.benefits.length > 0 &&
    <div className="mt-2 pt-2" style={{ borderTop: isEssential ? '1px solid rgba(138, 69, 20, 0.15)' : '1px solid var(--a-line)' }}>
          <p className="text-[10px] mb-1 font-bold" style={{ margin: '0 0 4px', color: isEssential ? 'rgba(138, 69, 20, 0.75)' : 'var(--a-ink-soft)' }}>{tr("vitaminstab_faydalari_8b3d9f", "Faydaları:")}</p>
          <div className="flex flex-wrap gap-1">
            {vitamin.benefits.slice(0, 3).map((benefit, i) =>
        <span
          key={i}
          className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
          style={{ background: isEssential ? 'var(--a-chip-overlay)' : 'var(--a-surface-soft)', color: isEssential ? 'var(--a-accent-ink)' : 'var(--a-ink-soft)' }}>
          
                {benefit}
              </span>
        )}
          </div>
        </div>
    }

      {/* Food Sources */}
      {vitamin.food_sources && vitamin.food_sources.length > 0 &&
    <div className="mt-2 pt-2" style={{ borderTop: isEssential ? '1px solid rgba(138, 69, 20, 0.15)' : '1px solid var(--a-line)' }}>
          <p className="text-[10px] mb-1 font-bold flex items-center gap-1" style={{ margin: '0 0 4px', color: 'var(--a-green-ink)' }}>
            <Leaf className="w-3 h-3" />
            {tr("vitaminstab_qida_menbeleri_b0a789", "Qida m\u0259nb\u0259l\u0259ri:")}
          </p>
          <p className="text-xs" style={{ margin: 0, color: isEssential ? 'rgba(138, 69, 20, 0.85)' : 'var(--a-body-text)' }}>
            {vitamin.food_sources.join(', ')}
          </p>
        </div>
    }
    </motion.div>;


  return (
    <motion.div
      key="vitamins"
      initial={{ opacity: 0, x: rtlX(-20, isRtl) }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: rtlX(20, isRtl) }}
      className={`space-y-4 ${className}`}>
      
      {/* Current Week Info */}
      {lifeStage === 'bump' && currentWeek &&
      <div className="a-card flex items-center gap-2" style={{ padding: '12px 14px' }}>
          <Info className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--a-peach-2)' }} />
          <p className="text-xs" style={{ margin: 0, color: 'var(--a-ink)' }}>
            <span className="font-bold">{tr("vitaminstab_hefte_3aa886", "H\u0259ft\u0259")} {currentWeek}</span> {tr("vitaminstab_ucun_tovsiye_olunan_vitaminler_1552cd", "\xFC\xE7\xFCn t\xF6vsiy\u0259 olunan vitaminl\u0259r")}
          </p>
        </div>
      }

      {/* Essential Vitamins */}
      {essentialVitamins.length > 0 &&
      <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4" style={{ color: 'var(--a-peach-2)' }} />
            <h2 className="font-bold text-sm a-heading" style={{ margin: 0, color: 'var(--a-on-bg)' }}>{tr("vitaminstab_vacib_vitaminler_167026", "Vacib Vitaminlər")}</h2>
          </div>
          <div className="space-y-2">
            {essentialVitamins.map((vitamin, index) =>
          <VitaminCard key={vitamin.id} vitamin={vitamin} index={index} isEssential={true} />
          )}
          </div>
        </div>
      }

      {/* Recommended Vitamins */}
      {recommendedVitamins.length > 0 &&
      <div>
          <div className="flex items-center gap-2 mb-2">
            <Pill className="w-4 h-4" style={{ color: 'var(--a-on-bg-soft)' }} />
            <h2 className="font-bold text-sm a-heading" style={{ margin: 0, color: 'var(--a-on-bg)' }}>{tr("vitaminstab_tovsiye_olunan_f7f407", "Tövsiyə Olunan")}</h2>
          </div>
          <div className="space-y-2">
            {recommendedVitamins.map((vitamin, index) =>
          <VitaminCard key={vitamin.id} vitamin={vitamin} index={index} isEssential={false} />
          )}
          </div>
        </div>
      }

      {vitamins.length === 0 &&
      <div className="a-card text-center" style={{ padding: '34px 18px' }}>
          <Pill className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--a-ink-faint)' }} />
          <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>{tr("vitaminstab_bu_merhele_ucun_vitamin_melumati_yoxdur_d17150", "Bu mərhələ üçün vitamin məlumatı yoxdur")}</p>
        </div>
      }

      {/* Disclaimer */}
      <div className="rounded-2xl p-3 text-center" style={{ background: 'var(--a-disclaimer-bg)', border: '1px solid var(--a-disclaimer-border)' }}>
        <p className="text-[10px]" style={{ margin: 0, color: 'var(--a-disclaimer-ink)' }}>
          {tr("vitaminstab_bu_melumatlar_umumi_xarakter_d_0af27f", "\u26A0\uFE0F Bu m\u0259lumatlar \xFCmumi xarakter da\u015F\u0131y\u0131r. Vitamin q\u0259bulundan \u0259vv\u0259l h\u0259kiminizl\u0259 m\u0259sl\u0259h\u0259tl\u0259\u015Fin.")}
        </p>
      </div>
    </motion.div>);

};

export default VitaminsTab;

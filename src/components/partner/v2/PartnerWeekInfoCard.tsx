import { useState } from 'react';
import { motion } from 'framer-motion';
import { Ruler, Weight, ChevronDown, ChevronUp } from 'lucide-react';
import { tr } from '@/lib/tr';

/**
 * Bump: "Bu həftə körpəniz" — partnyor üçün həftəlik inkişaf kartı.
 * Mənbə: pregnancy_daily_content (baby_development) + fruit data.
 */

interface FruitDataLike {
  fruit: string;
  emoji: string;
  imageUrl: string | null;
  lengthCm: number;
  weightG: number;
}

interface Props {
  currentWeek: number;
  weekData: FruitDataLike | null;
  dayContent: any;
  language: string;
  /** Əkiz/üçüz və s. hamiləlik — "körpəniz" əvəzinə "körpələriniz" göstərilir */
  isMultiple?: boolean;
}

const PartnerWeekInfoCard = ({ currentWeek, weekData, dayContent, language, isMultiple = false }: Props) => {
  const [expanded, setExpanded] = useState(false);

  if (!currentWeek || currentWeek <= 0) return null;

  // Lokalizasiya suffiksi ilə inkişaf mətni
  const development: string | null = (() => {
    if (!dayContent) return null;
    const d = dayContent as any;
    const localized = language !== 'az' ? d[`baby_development_${language}`] || (language === 'kk' || language === 'uz' || language === 'ka' ? d.baby_development_ru : null) || (language === 'de' || language === 'ar' ? d.baby_development_en : null) : null;
    return localized || d.baby_development || null;
  })();

  if (!development && !weekData) return null;

  return (
    <motion.div className="a-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 flex items-center justify-center text-3xl shrink-0"
        style={{ borderRadius: 16, background: 'var(--a-peach-1)' }}>
          {weekData?.imageUrl ?
          <img src={weekData.imageUrl} alt={weekData.fruit} className="w-9 h-9 object-contain" /> :
          weekData?.emoji || '👶'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>
            {currentWeek}. {isMultiple ? tr('partnerv2_hefte_korpeleriniz', 'həftə — körpələriniz') : tr('partnerv2_hefte_korpeniz', 'həftə — körpəniz')}
          </h3>
          {weekData?.fruit &&
          <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)' }}>
              {isMultiple ?
            `${tr('partnerv2_her_korpe_texminen', 'Hər körpə təxminən')} ${weekData.fruit} ${tr('partnerv2_boyukluyunde', 'böyüklüyündə')}` :
            `${tr('partnerv2_texminen', 'Təxminən')} ${weekData.fruit} ${tr('partnerv2_boyukluyunde', 'böyüklüyündə')}`}
            </p>
          }
        </div>
      </div>

      {/* Ölçü çipləri */}
      {weekData && (weekData.lengthCm > 0 || weekData.weightG > 0) &&
      <div className="flex gap-2 mb-3">
          {weekData.lengthCm > 0 &&
        <span className="inline-flex items-center gap-1.5"
        style={{ background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)', borderRadius: 999, padding: '5px 12px', fontSize: 11.5, fontWeight: 700 }}>
              <Ruler size={12} /> {weekData.lengthCm} sm
            </span>
        }
          {weekData.weightG > 0 &&
        <span className="inline-flex items-center gap-1.5"
        style={{ background: 'var(--a-green-1)', color: 'var(--a-green-ink)', borderRadius: 999, padding: '5px 12px', fontSize: 11.5, fontWeight: 700 }}>
              <Weight size={12} /> {weekData.weightG >= 1000 ? `${(weekData.weightG / 1000).toFixed(1)} kq` : `${weekData.weightG} q`}
            </span>
        }
        </div>
      }

      {/* İnkişaf mətni */}
      {development &&
      <>
          <p
          className="leading-relaxed"
          style={{
            fontSize: 12.5,
            color: 'var(--a-body-text)',
            display: '-webkit-box',
            WebkitLineClamp: expanded ? 'unset' as any : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {development}
          </p>
          {development.length > 140 &&
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-2"
          style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--a-accent-ink)' }}>
              {expanded ? <>{tr('partnerv2_yigcam_gorunus', 'Yığcam görünüş')} <ChevronUp size={13} /></> : <>{tr('partnerv2_davamini_oxu', 'Davamını oxu')} <ChevronDown size={13} /></>}
            </button>
        }
        </>
      }
    </motion.div>);

};

export default PartnerWeekInfoCard;

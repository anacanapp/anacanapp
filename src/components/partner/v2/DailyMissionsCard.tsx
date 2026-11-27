import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { usePartnerMissions } from '@/hooks/usePartnerMissions';
import type { MissionStageInput } from '@/data/partner-missions';
import LevelUpCelebration from '@/components/partner/LevelUpCelebration';
import { hapticFeedback } from '@/lib/native';
import { useToast } from '@/hooks/use-toast';
import { tr } from '@/lib/tr';

/**
 * "Bu gün necə kömək edim?" — ananın mərhələsinə uyğun günlük 3 tapşırıq.
 * Tam siyahı (7) açıla bilir. Səviyyə irəliləyişi + level-up konfetti.
 */

// FUNKSIYA: tr() render anında qiymətləndirilsin (modul yüklənəndə dil overlay
// hazır olmaya bilər → AZ "bake" olunurdu)
const DIFF_TINT = (): Record<string, {bg: string;ink: string;label: string;}> => ({
  easy: { bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)', label: tr('partnerv2_asan', 'Asan') },
  medium: { bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)', label: tr('partnerv2_orta', 'Orta') },
  hard: { bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)', label: tr('partnerv2_cetin', 'Çətin') }
});

const CAT_TINT: Record<string, {bg: string;ink: string;}> = {
  care: { bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)' },
  support: { bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)' },
  surprise: { bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' }
};

const DailyMissionsCard = (stage: MissionStageInput) => {
  const { missions, loading, toggleMission, level, levelProgress, pointsToNextLevel, totalPoints } = usePartnerMissions(stage);
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [celebrateLevel, setCelebrateLevel] = useState<number | null>(null);

  if (loading) return null;

  // Tamamlanmamışlar önə — ilk 3 göstər
  const sorted = [...missions].sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted));
  const visible = expanded ? sorted : sorted.slice(0, 3);
  const completedToday = missions.filter((m) => m.isCompleted).length;

  const handleToggle = async (missionId: string, points: number, wasCompleted: boolean) => {
    await hapticFeedback.light();
    const levelBefore = level;
    const result = await toggleMission(missionId, points);
    if (result && result.completed) {
      toast({ title: `+${result.pointsEarned} ${tr('partnerv2_xal', 'xal')} 🎉`, description: tr('partnerv2_tesekkurler_qaygikesh', 'Təşəkkürlər, qayğıkeş partnyor!') });
      // Level-up yoxlaması (xal → səviyyə: /50)
      const newTotal = totalPoints + result.pointsEarned;
      const levelAfter = Math.floor(newTotal / 50) + 1;
      if (levelAfter > levelBefore) {
        await hapticFeedback.heavy();
        setCelebrateLevel(levelAfter);
      }
    }
  };

  return (
    <div className="a-card">
      {/* Başlıq + səviyyə */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--a-ink)' }}>
            {tr('partnerv2_bugun_nece_komek_edim', 'Bu gün necə kömək edim?')}
          </h3>
          <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', marginTop: 1 }}>
            {completedToday}/{missions.length} {tr('partnerv2_tamamlandi', 'tamamlandı')}
          </p>
        </div>
        <div className="text-end shrink-0">
          <span className="inline-flex items-center gap-1"
          style={{ background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)', borderRadius: 999, padding: '5px 12px', fontSize: 11.5, fontWeight: 800 }}>
            <Zap size={12} /> {tr('partnerv2_seviyye', 'Səviyyə')} {level}
          </span>
        </div>
      </div>

      {/* Səviyyə irəliləyişi */}
      <div className="mb-4">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--a-surface-soft)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--a-grad-blue)' }}
            initial={{ width: 0 }}
            animate={{ width: `${levelProgress}%` }}
            transition={{ duration: 0.5 }} />
        </div>
        <p className="mt-1 text-end" style={{ fontSize: 10, color: 'var(--a-ink-faint)' }}>
          {tr('partnerv2_novbeti_seviyyeye', 'Növbəti səviyyəyə')}: {pointsToNextLevel} {tr('partnerv2_xal', 'xal')}
        </p>
      </div>

      {/* Tapşırıqlar */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {visible.map((m) => {
            const Icon = m.icon;
            const cat = CAT_TINT[m.category] || CAT_TINT.care;
            const diffMap = DIFF_TINT();
    const diff = diffMap[m.difficulty] || diffMap.easy;
            return (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                onClick={() => handleToggle(m.id, m.points, m.isCompleted)}
                className="w-full flex items-center gap-3 text-start transition-all"
                style={{
                  padding: '11px 13px',
                  borderRadius: 16,
                  background: m.isCompleted ? 'var(--a-green-1)' : 'var(--a-surface-soft)'
                }}
                whileTap={{ scale: 0.98 }}>

                <div className="w-9 h-9 flex items-center justify-center shrink-0"
                style={{ borderRadius: 12, background: m.isCompleted ? 'var(--a-chip-overlay)' : cat.bg }}>
                  {m.isCompleted ?
                  <Check size={16} style={{ color: 'var(--a-green-ink)' }} strokeWidth={3} /> :
                  <Icon size={16} style={{ color: cat.ink }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={m.isCompleted ? 'line-through' : ''}
                  style={{ fontSize: 12.5, fontWeight: 700, color: m.isCompleted ? 'var(--a-ink-soft)' : 'var(--a-ink)' }}>
                    {m.title}
                  </p>
                  <p className="truncate" style={{ fontSize: 10.5, color: 'var(--a-ink-soft)' }}>{m.description}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span style={{ fontSize: 11, fontWeight: 800, color: m.isCompleted ? 'var(--a-green-ink)' : 'var(--a-accent-ink)' }}>+{m.points}</span>
                  <span style={{ background: diff.bg, color: diff.ink, borderRadius: 999, padding: '1px 7px', fontSize: 8.5, fontWeight: 700 }}>
                    {diff.label}
                  </span>
                </div>
              </motion.button>);

          })}
        </AnimatePresence>
      </div>

      {/* Aç / bağla */}
      {missions.length > 3 &&
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 mt-3 py-2"
        style={{ fontSize: 12, fontWeight: 700, color: 'var(--a-blue-ink)' }}>
          {expanded ?
        <>{tr('partnerv2_yigcam_gorunus', 'Yığcam görünüş')} <ChevronUp size={14} /></> :
        <>{tr('partnerv2_hamisina_bax', 'Hamısına bax')} ({missions.length}) <ChevronDown size={14} /></>}
        </button>
      }

      {/* Level-up konfetti */}
      <LevelUpCelebration
        show={celebrateLevel !== null}
        level={celebrateLevel || level}
        onClose={() => setCelebrateLevel(null)} />

    </div>);

};

export default DailyMissionsCard;

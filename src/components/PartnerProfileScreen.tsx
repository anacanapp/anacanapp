import { useState, useMemo } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import {
  User, Settings, Bell, Shield, HelpCircle, LogOut,
  ChevronRight, Crown, Heart, MessageCircle, Sparkles,
  Trophy, Target, Star, Gift, TrendingUp, BarChart3 } from
'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/hooks/use-toast';
import { usePartnerStats } from '@/hooks/usePartnerStats';
import { usePartnerMissions } from '@/hooks/usePartnerMissions';
import { useSurprises } from '@/hooks/useSurprises';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import {
  usePartnerAchievements,
  usePartnerMenuItems,
  useSurpriseCategories,
  FALLBACK_ACHIEVEMENTS,
  FALLBACK_MENU_ITEMS,
  FALLBACK_SURPRISE_CATEGORIES } from
'@/hooks/usePartnerConfig';

// Icon mapping for menu items
const MENU_ICON_MAP: Record<string, any> = {
  Bell, Shield, HelpCircle, Settings, User
};

// DB-dəki achievement/menu/category cədvəllərində YALNIZ *_az sütunu var (çox-dilli
// deyil) — məlum key-lər üçün eyni tr() açarlarını (FALLBACK massivlərində istifadə
// olunanlarla EYNİ) təkrar istifadə edirik ki, DB-dən gəlsin, fallback-dan gəlsin,
// nəticə həmişə cari dilə tərcümə olunsun. Naməlum/admin-in əlavə etdiyi xüsusi
// key-lər üçün DB-nin özündəki (AZ) mətninə enirik.
const ACHIEVEMENT_NAME_TR: Record<string, [string, string]> = {
  first_love: ["usepartnerconfig_ilk_sevgi", "İlk Sevgi"],
  supporter: ["usepartnerconfig_destekci_829677", "Dəstəkçi"],
  caring: ["usepartnerconfig_qaygikes_c791ee", "Qayğıkeş"],
  super_partner: ["partnerprofilescreen_super_partner", "Super Partner"],
  family_hero: ["usepartnerconfig_aile_qehremani_62b00e", "Ailə Qəhrəmanı"],
  messenger: ["usepartnerconfig_sevgi_elcisi", "Sevgi Elçisi"],
  weekly_hero: ["usepartnerconfig_heftelik_qehreman", "Həftəlik Qəhrəman"],
};
const MENU_LABEL_TR: Record<string, [string, string]> = {
  notifications: ["usepartnerconfig_bildirisler_54eb88", "Bildirişlər"],
  "partner-privacy": ["usepartnerconfig_gizlilik", "Gizlilik"],
  help: ["usepartnerconfig_yardim_da857a", "Yardım"],
};
const SURPRISE_CATEGORY_LABEL_TR: Record<string, [string, string]> = {
  romantic: ["usepartnerconfig_romantik", "Romantik"],
  care: ["usepartnerconfig_qaygi_868e7d", "Qayğı"],
  adventure: ["usepartnerconfig_macera_bc3bdc", "Macəra"],
  gift: ["usepartnerconfig_hediyye_8578f3", "Hədiyyə"],
};

interface PartnerProfileScreenProps {
  onNavigate?: (screen: string) => void;
}

const PartnerProfileScreen = ({ onNavigate }: PartnerProfileScreenProps) => {
  useScrollToTop();

  const { name, email, partnerWomanData, logout } = useUserStore(
    useShallow((s) => ({ name: s.name, email: s.email, partnerWomanData: s.partnerWomanData, logout: s.logout }))
  );
  const { toast } = useToast();
  const { stats, loading: statsLoading } = usePartnerStats();
  const { level, levelProgress, pointsToNextLevel } = usePartnerMissions();
  const {
    completedSurprises,
    totalPoints: surprisePoints,
    categoryStats,
    monthlyChartData,
    topCategory
  } = useSurprises();

  // Fetch dynamic config
  const { data: dbAchievements = [] } = usePartnerAchievements();
  const { data: dbMenuItems = [] } = usePartnerMenuItems();
  const { data: dbSurpriseCategories = [] } = useSurpriseCategories();

  // Build achievements from DB or fallback
  // NOT: əvvəllər yalnız Sürprizlər aktivliyi (completed_surprises/
  // surprise_points) nailiyyət aça bilirdi - gündəlik missiya tamamlamaq
  // və ya sevgi/mətn mesajı göndərmək heç bir nailiyyətə təsir etmirdi,
  // halbuki bunlar da real partnyor aktivliyidir. `messages_sent` və
  // `missions_completed` şərtləri indi `usePartnerStats()`-dən gələn
  // stats-a görə yoxlanılır (bax useEffect üstündəki `stats`).
  const achievements = useMemo(() => {
    const source = dbAchievements.length > 0 ? dbAchievements : FALLBACK_ACHIEVEMENTS;
    return source.map((a) => ({
      id: a.achievement_key,
      name: ACHIEVEMENT_NAME_TR[a.achievement_key] ?
      tr(...ACHIEVEMENT_NAME_TR[a.achievement_key]) :
      (a as any).name_az || (a as any).name || a.achievement_key,
      emoji: a.emoji,
      unlocked: a.unlock_condition === 'always_unlocked' ||
      a.unlock_condition === 'completed_surprises' && completedSurprises.length >= a.unlock_threshold ||
      a.unlock_condition === 'surprise_points' && surprisePoints >= a.unlock_threshold ||
      a.unlock_condition === 'messages_sent' && (stats.lovesSent + stats.messagesSent) >= a.unlock_threshold ||
      a.unlock_condition === 'missions_completed' && stats.completedMissions >= a.unlock_threshold
    }));
  }, [dbAchievements, completedSurprises, surprisePoints, stats.lovesSent, stats.messagesSent, stats.completedMissions]);

  // Build menu items from DB or fallback
  const menuItems = useMemo(() => {
    const source = dbMenuItems.length > 0 ? dbMenuItems : FALLBACK_MENU_ITEMS;
    return source.map((m) => ({
      id: (m as any).route || m.menu_key,
      icon: MENU_ICON_MAP[(m as any).icon_name || 'Settings'] || Settings,
      label: MENU_LABEL_TR[m.menu_key] ?
      tr(...MENU_LABEL_TR[m.menu_key]) :
      (m as any).label_az || (m as any).label || m.menu_key
    }));
  }, [dbMenuItems]);

  // Build surprise category lookup
  const getCategoryLabel = useMemo(() => {
    const source = dbSurpriseCategories.length > 0 ? dbSurpriseCategories : FALLBACK_SURPRISE_CATEGORIES;
    return (category: string) => {
      const found = source.find((c) => c.category_key === category);
      if (found) {
        return {
          label: SURPRISE_CATEGORY_LABEL_TR[found.category_key] ?
          tr(...SURPRISE_CATEGORY_LABEL_TR[found.category_key]) :
          found.label_az || category,
          emoji: found.emoji,
          color: found.color_gradient
        };
      }
      return { label: category, emoji: '✨', color: 'from-blue-500 to-indigo-600' };
    };
  }, [dbSurpriseCategories]);

  const maxPoints = Math.max(...monthlyChartData.map((d) => d.points), 1);

  const statTiles = [
    { icon: Trophy, value: stats.totalPoints + surprisePoints, label: tr("untranslated_toplam_xal_dy1dwr", "Toplam Xal"), tone: 'c-yellow' },
    { icon: Target, value: stats.completedMissions, label: tr("partnerprofilescreen_tapsiriq_d827b6", "Tapşırıq"), tone: 'c-lav' },
    { icon: Gift, value: completedSurprises.length, label: tr("partnerprofilescreen_surpriz_67b2b2", "Sürpriz"), tone: 'c-pink' },
    { icon: MessageCircle, value: stats.messagesSent, label: tr("untranslated_mesaj_3c09op", "Mesaj"), tone: 'c-green' },
  ];
  // Category tiles use the design palette; the gradient classes stored with the categories are not
  // generated by Tailwind and left white text on no background.
  const tones = ['c-pink', 'c-lav', 'c-yellow', 'c-green', 'c-blue', 'c-peach'];

  return (
    <div className="a-scope pb-28" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
      <div className="a-shell">
        <header className="a3-topbar">
          <h1 className="a3-page-title a3-grow">{tr("untranslated_partner_profili_lip00f", "Partner Profili")}</h1>
          <button type="button" className="a3-icon-btn" onClick={() => onNavigate?.('partner-privacy')} aria-label={tr("usepartnerconfig_gizlilik", "Gizlilik")}>
            <Settings size={22} />
          </button>
        </header>

        {/* Profile card */}
        <section className="a3-card a3-pad" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <span className="a3-ico-sq c-blue" style={{ width: 64, height: 64, borderRadius: 20, fontSize: 32 }} aria-hidden="true">👨</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="a3-entry-title" style={{ fontSize: 19 }}>{name || 'Partner'}</span>
            {email && <span className="a3-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>}
            <span className="a3-chip ac" style={{ alignSelf: 'flex-start' }}>
              <Heart size={12} fill="currentColor" />
              {partnerWomanData?.name || tr("partnerprofilescreen_heyat_yoldasi_ad6f31", "Həyat Yoldaşı")} {tr("partnerprofilescreen_ile_elaqeli_b0595d", "ilə əlaqəli")}
            </span>
          </span>
        </section>

        {/* Stats */}
        <section className="a3-sec" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {statTiles.map(({ icon: Icon, value, label, tone }) => (
            <div key={label} className="a3-card a3-pad" style={{ gap: 6 }}>
              <span className={`a3-ico-sq sm ${tone}`} aria-hidden="true"><Icon size={16} /></span>
              <b className="a3-num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--a-ink)', lineHeight: 1.1 }}>{value}</b>
              <span className="a3-meta">{label}</span>
            </div>
          ))}
        </section>

        {/* Level */}
        <section className="a3-sec">
          <div className="a3-card a3-pad" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <span className="a3-ico-sq c-yellow a3-num" style={{ width: 56, height: 56, borderRadius: 18, fontSize: 24, fontWeight: 700 }}>{level}</span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="a3-entry-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Star size={15} />{tr("partnerprofilescreen_seviyye_8266e7", "Səviyyə")} {level}</span>
              <span className="a3-meta">{tr("partnerprofilescreen_novbeti_seviyyeye_d52c78", "Növbəti səviyyəyə")} {pointsToNextLevel} {tr("partnerprofilescreen_xal_qalib_5931e2", "xal qalıb")}</span>
              <span className="a-inline-bar" style={{ display: 'block', marginTop: 4 }}><span className="a-inline-bar-fill" style={{ display: 'block', width: `${levelProgress}%`, transition: 'width 600ms var(--a-ease)' }} /></span>
            </span>
          </div>
        </section>

        {/* Surprise statistics */}
        {completedSurprises.length > 0 &&
        <section className="a3-sec">
            <h2 className="a3-sec-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={18} />{tr("partnerprofilescreen_surpriz_statistikasi_5eee15", "Sürpriz Statistikası")}</h2>
            <div className="a3-card a3-pad" style={{ gap: 16 }}>
              <div>
                <p className="a3-meta" style={{ marginBottom: 10 }}>{tr("partnerprofilescreen_ayliq_xal_qrafiki_dca77f", "Aylıq Xal Qrafiki")}</p>
                <div className="flex items-end justify-between gap-2 h-24">
                  {monthlyChartData.map((data) =>
                <div key={data.month} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                      <div style={{ width: '100%', height: `${data.points / maxPoints * 100}%`, minHeight: data.points > 0 ? 8 : 2, borderRadius: '8px 8px 0 0', background: 'var(--a-coral-strong)', opacity: data.points > 0 ? 1 : 0.25, transition: 'height 500ms var(--a-ease)' }} />
                      <span className="a3-meta" style={{ fontSize: 11 }}>{data.label}</span>
                    </div>
                )}
                </div>
              </div>
              <div>
                <p className="a3-meta" style={{ marginBottom: 10 }}>{tr("partnerprofilescreen_surpriz_novleri_592120", "Sürpriz Növləri")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(categoryStats).map(([category, count], i) => {
                  const catInfo = getCategoryLabel(category);
                  return (
                    <div key={category} className={tones[i % tones.length]} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 14 }}>
                        <span style={{ fontSize: 20 }} aria-hidden="true">{catInfo.emoji}</span>
                        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{catInfo.label}</span>
                          <b className="a3-num" style={{ fontSize: 17 }}>{count}</b>
                        </span>
                      </div>);
                })}
                </div>
              </div>
              {topCategory &&
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="a3-ico-sq sm c-yellow" aria-hidden="true"><TrendingUp size={16} /></span>
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="a3-meta">{tr("partnerprofilescreen_en_cox_edilen_f000e8", "Ən çox edilən")}</span>
                    <b style={{ fontSize: 14.5, color: 'var(--a-ink)' }}>
                      {getCategoryLabel(topCategory.category).emoji} {getCategoryLabel(topCategory.category).label} ({topCategory.count} {tr("partnerprofilescreen_defe_cf1e5e", "dəfə)")}
                    </b>
                  </span>
                </div>
            }
            </div>
          </section>
        }

        {/* Achievements */}
        <section className="a3-sec">
          <h2 className="a3-sec-title">{tr("partnerprofilescreen_nailiyyetler_92db73", "Nailiyyətlər")}</h2>
          <div className="a3-rail">
            {achievements.map((achievement) =>
            <div key={achievement.id} style={{ width: 76, textAlign: 'center', opacity: achievement.unlocked ? 1 : 0.4 }}>
                <span className={`a3-ico-sq ${achievement.unlocked ? 'c-lav' : ''}`} style={{ width: 60, height: 60, borderRadius: 20, fontSize: 28, margin: '0 auto 6px', background: achievement.unlocked ? undefined : 'var(--a-surface-soft)' }} aria-hidden="true">{achievement.emoji}</span>
                <span className="a3-meta" style={{ display: 'block', fontSize: 11.5 }}>{achievement.name}</span>
              </div>
            )}
          </div>
        </section>

        {/* Linked partner */}
        {partnerWomanData &&
        <section className="a3-sec">
            <div className="a3-card a3-pad" style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <span className="a3-ico-sq c-pink" style={{ width: 52, height: 52, borderRadius: 18, fontSize: 26 }} aria-hidden="true">🤰</span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="a3-entry-title">{partnerWomanData.name}</span>
                <span className="a3-meta">
                  {partnerWomanData.lifeStage === 'bump' ? tr("partnerprofilescreen_hamilelik_dovru_57af7a", "Hamiləlik dövrü") :
                partnerWomanData.lifeStage === 'mommy' ? tr("partnerprofilescreen_analiq_dovru_b1c7dd", "Analıq dövrü") : tr("partnerprofilescreen_menstruasiya_dovru_a5852d", "Menstruasiya dövrü")}
                </span>
              </span>
              <Gift size={20} style={{ color: 'var(--a-coral-text)' }} />
            </div>
          </section>
        }

        {/* Menu */}
        <section className="a3-sec">
          <div className="a-list-card">
            {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => onNavigate?.(item.id)} className="a-list-row" style={{ width: '100%', background: 'none', textAlign: 'start', cursor: 'pointer' }}>
                  <span className="a-list-icon" style={{ background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}><Icon size={18} /></span>
                  <span className="a-list-title" style={{ flex: 1 }}>{item.label}</span>
                  <ChevronRight size={18} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />
                </button>);
          })}
          </div>
        </section>

        <section className="a3-sec">
          <button type="button" onClick={logout} className="a3-btn ghost block" style={{ color: 'var(--a-bad)' }}>
            <LogOut size={18} />
            {tr("partnerprofilescreen_cixis_c2de5c", "Çıxış")}
          </button>
        </section>
      </div>
    </div>);

};

export default PartnerProfileScreen;
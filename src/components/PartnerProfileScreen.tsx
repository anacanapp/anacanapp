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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <div className="pb-28 pt-2 px-5">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between mb-6"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}>
        
        <h1 className="text-2xl font-black text-foreground">{tr("untranslated_partner_profili_lip00f", "Partner Profili")}</h1>
        <motion.button
          className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate?.('partner-privacy')}>
          
          <Settings className="w-6 h-6 text-muted-foreground" />
        </motion.button>
      </motion.div>

      {/* Profile Card */}
      <motion.div
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 mb-6 shadow-elevated"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}>
        
        <div className="absolute -end-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -start-10 -bottom-10 w-32 h-32 rounded-full bg-white/5 blur-xl" />
        
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-4xl shadow-lg">
            👨
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-white">{name || 'Partner'}</h2>
            <p className="text-white/80 font-medium">{email || 'email@example.com'}</p>
            <div className="mt-2 inline-flex items-center px-3 py-1 bg-white/20 rounded-full text-white text-xs font-bold gap-1">
              <Heart className="w-3 h-3 fill-white" />
              {partnerWomanData?.name || tr("partnerprofilescreen_heyat_yoldasi_ad6f31", "H\u0259yat Yolda\u015F\u0131")} {tr("partnerprofilescreen_ile_elaqeli_b0595d", "il\u0259 \u0259laq\u0259li")}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        className="grid grid-cols-2 gap-3 mb-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}>
        
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-4 text-white">
          <Trophy className="w-6 h-6 mb-2" />
          <p className="text-3xl font-black">{stats.totalPoints + surprisePoints}</p>
          <p className="text-xs text-white/80">{tr("untranslated_toplam_xal_dy1dwr", "Toplam Xal")}</p>
        </div>
        <div className="bg-gradient-to-br from-violet-400 to-purple-600 rounded-2xl p-4 text-white">
          <Target className="w-6 h-6 mb-2" />
          <p className="text-3xl font-black">{stats.completedMissions}</p>
          <p className="text-xs text-white/80">{tr("partnerprofilescreen_tapsiriq_d827b6", "Tapşırıq")}</p>
        </div>
        <div className="bg-gradient-to-br from-pink-400 to-rose-500 rounded-2xl p-4 text-white">
          <Gift className="w-6 h-6 mb-2" />
          <p className="text-3xl font-black">{completedSurprises.length}</p>
          <p className="text-xs text-white/80">{tr("partnerprofilescreen_surpriz_67b2b2", "Sürpriz")}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl p-4 text-white">
          <MessageCircle className="w-6 h-6 mb-2" />
          <p className="text-3xl font-black">{stats.messagesSent}</p>
          <p className="text-xs text-white/80">{tr("untranslated_mesaj_3c09op", "Mesaj")}</p>
        </div>
      </motion.div>

      {/* Surprise Statistics Section */}
      {completedSurprises.length > 0 &&
      <motion.div
        className="bg-card rounded-3xl p-5 mb-6 shadow-card border border-border/50"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.18 }}>
        
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-partner" />
            <h3 className="font-bold text-foreground">{tr("partnerprofilescreen_surpriz_statistikasi_5eee15", "Sürpriz Statistikası")}</h3>
          </div>

          {/* Monthly Points Chart */}
          <div className="mb-5">
            <p className="text-sm text-muted-foreground mb-3">{tr("partnerprofilescreen_ayliq_xal_qrafiki_dca77f", "Aylıq Xal Qrafiki")}</p>
            <div className="flex items-end justify-between gap-2 h-24">
              {monthlyChartData.map((data, index) =>
            <div key={data.month} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                className="w-full bg-gradient-to-t from-partner to-violet-500 rounded-t-lg"
                initial={{ height: 0 }}
                animate={{ height: `${data.points / maxPoints * 100}%` }}
                transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                style={{ minHeight: data.points > 0 ? '8px' : '2px' }} />
              
                  <span className="text-[10px] text-muted-foreground font-medium">{data.label}</span>
                </div>
            )}
            </div>
          </div>

          {/* Category Breakdown */}
          <div>
            <p className="text-sm text-muted-foreground mb-3">{tr("partnerprofilescreen_surpriz_novleri_592120", "Sürpriz Növləri")}</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(categoryStats).map(([category, count]) => {
              const catInfo = getCategoryLabel(category);
              return (
                <motion.div
                  key={category}
                  className={`flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r ${catInfo.color} bg-opacity-10`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}>
                  
                    <span className="text-xl">{catInfo.emoji}</span>
                    <div>
                      <p className="text-xs font-medium text-white">{catInfo.label}</p>
                      <p className="text-lg font-black text-white">{count}</p>
                    </div>
                  </motion.div>);

            })}
            </div>
          </div>

          {/* Top Category Badge */}
          {topCategory &&
        <motion.div
          className="mt-4 flex items-center gap-3 p-3 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}>
          
              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-amber-700 dark:text-amber-400">{tr("partnerprofilescreen_en_cox_edilen_f000e8", "Ən çox edilən")}</p>
                <p className="font-bold text-amber-800 dark:text-amber-300">
                  {getCategoryLabel(topCategory.category).emoji} {getCategoryLabel(topCategory.category).label} ({topCategory.count} {tr("partnerprofilescreen_defe_cf1e5e", "d\u0259f\u0259)")}
                </p>
              </div>
            </motion.div>
        }
        </motion.div>
      }

      {/* Level Card */}
      <motion.div
        className="bg-card rounded-3xl p-5 mb-6 shadow-card border border-border/50"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}>
        
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
            <span className="text-3xl font-black text-white">{level}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-foreground">{tr("partnerprofilescreen_seviyye_8266e7", "S\u0259viyy\u0259")} {level}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{tr("partnerprofilescreen_novbeti_seviyyeye_d52c78", "N\xF6vb\u0259ti s\u0259viyy\u0259y\u0259")} {pointsToNextLevel} {tr("partnerprofilescreen_xal_qalib_5931e2", "xal qal\u0131b")}</p>
            <div className="h-2 bg-muted rounded-full mt-2 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${levelProgress}%` }} />
              
            </div>
          </div>
        </div>
      </motion.div>

      {/* Achievements */}
      <motion.div
        className="mb-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}>
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">{tr("partnerprofilescreen_nailiyyetler_92db73", "Nailiyyətlər")}</h3>
        </div>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
          {achievements.map((achievement) =>
          <motion.div
            key={achievement.id}
            className={`flex-shrink-0 w-20 text-center ${
            achievement.unlocked ? '' : 'opacity-40'}`
            }
            whileHover={{ scale: 1.05 }}>
            
              <div className={`w-16 h-16 mx-auto rounded-2xl ${
            achievement.unlocked ?
            'bg-gradient-to-br from-indigo-100 to-violet-100 border-2 border-indigo-200' :
            'bg-muted'} flex items-center justify-center text-3xl mb-2`
            }>
                {achievement.emoji}
              </div>
              <p className="text-[10px] font-medium text-muted-foreground">{achievement.name}</p>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Linked Partner Info */}
      {partnerWomanData &&
      <motion.div
        className="bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-3xl p-5 mb-6 border border-pink-100 dark:border-pink-800"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}>
        
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-lg text-3xl">
              🤰
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground">{partnerWomanData.name}</h3>
              <p className="text-sm text-muted-foreground">
                {partnerWomanData.lifeStage === 'bump' ? tr("partnerprofilescreen_hamilelik_dovru_57af7a", "Hamil\u0259lik d\xF6vr\xFC") :
              partnerWomanData.lifeStage === 'mommy' ? tr("partnerprofilescreen_analiq_dovru_b1c7dd", "Anal\u0131q d\xF6vr\xFC") : tr("partnerprofilescreen_menstruasiya_dovru_a5852d", "Menstruasiya d\xF6vr\xFC")}
              </p>
            </div>
            <Gift className="w-6 h-6 text-pink-500" />
          </div>
        </motion.div>
      }

      {/* Menu Items */}
      <motion.div
        className="bg-card rounded-3xl overflow-hidden shadow-card border border-border/50"
        variants={containerVariants}
        initial="hidden"
        animate="visible">
        
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              variants={itemVariants}
              onClick={() => onNavigate?.(item.id)}
              className={`w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors ${
              index !== menuItems.length - 1 ? 'border-b border-border/50' : ''}`
              }>
              
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
                <Icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="flex-1 text-start font-medium text-foreground">{item.label}</span>
              <ChevronRight className="rtl:rotate-180 w-5 h-5 text-muted-foreground" />
            </motion.button>);

        })}
      </motion.div>

      {/* Logout */}
      <motion.button
        onClick={logout}
        className="w-full mt-6 p-4 rounded-2xl bg-destructive/10 text-destructive font-bold flex items-center justify-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}>
        
        <LogOut className="w-5 h-5" />
        {tr("partnerprofilescreen_cixis_c2de5c", "\xC7\u0131x\u0131\u015F")}
      </motion.button>

    </div>);

};

export default PartnerProfileScreen;
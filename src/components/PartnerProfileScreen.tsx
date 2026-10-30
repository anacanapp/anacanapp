import { useState, useMemo } from 'react';
import { tr } from '@/lib/tr';
import { motion } from 'framer-motion';
import {
  User, Settings, Bell, Shield, HelpCircle, LogOut,
  ChevronRight, MessageCircle, Trophy, Target, Gift, Zap } from
'lucide-react';
import { useUserStore } from '@/store/userStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '@/hooks/useAuth';
import PartnerLinkForm from '@/components/partner/v2/PartnerLinkForm';
import { useToast } from '@/hooks/use-toast';
import { usePartnerStats } from '@/hooks/usePartnerStats';
import { usePartnerMissions } from '@/hooks/usePartnerMissions';
import { useSurprises } from '@/hooks/useSurprises';
import { useScrollToTop } from '@/hooks/useScrollToTop';
import {
  usePartnerAchievements,
  usePartnerMenuItems,
  FALLBACK_ACHIEVEMENTS,
  FALLBACK_MENU_ITEMS } from
'@/hooks/usePartnerConfig';
import { usePartnerData } from '@/hooks/usePartnerData';
import { feature37Text } from '@/lib/feature37-i18n';

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
interface PartnerProfileScreenProps {
  onNavigate?: (screen: string) => void;
}

const PartnerProfileScreen = ({ onNavigate }: PartnerProfileScreenProps) => {
  useScrollToTop();

  const { name, email, logout } = useUserStore(
    useShallow((s) => ({ name: s.name, email: s.email, logout: s.logout }))
  );
  const { partnerProfile, getPregnancyWeek, getBabyAgeDays } = usePartnerData();
  const { toast } = useToast();
  const { signOut, profile } = useAuth();
  const isLinked = !!profile?.linked_partner_id;
  const { stats, loading: statsLoading } = usePartnerStats();
  const { level, levelProgress, pointsToNextLevel } = usePartnerMissions();
  const { completedSurprises, totalPoints: surprisePoints } = useSurprises();

  // Fetch dynamic config
  const { data: dbAchievements = [] } = usePartnerAchievements();
  const { data: dbMenuItems = [] } = usePartnerMenuItems();

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

  const stage = partnerProfile?.life_stage;
  const weeks = stage === 'bump' ? getPregnancyWeek() : 0;
  const babyDays = stage === 'mommy' ? getBabyAgeDays() : 0;
  const stageLine = stage === 'bump' ?
  `${tr('partnerprofilescreen_hamilelik_dovru_57af7a', 'Hamiləlik dövrü')}${weeks ? ` · ${feature37Text('pp_week').replace('{n}', String(weeks))}` : ''}` :
  stage === 'mommy' ?
  babyDays >= 60 ? feature37Text('pp_baby_age_months').replace('{n}', String(Math.floor(babyDays / 30))) : feature37Text('pp_baby_age_days').replace('{n}', String(babyDays)) :
  tr('partnerprofilescreen_menstruasiya_dovru_a5852d', 'Menstruasiya dövrü');

  const statTiles = [
  { icon: Trophy, value: stats.totalPoints + surprisePoints, label: feature37Text('pp_points'), bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)' },
  { icon: Target, value: stats.completedMissions, label: feature37Text('pp_missions'), bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)' },
  { icon: Gift, value: completedSurprises.length, label: feature37Text('pp_surprises'), bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' },
  { icon: MessageCircle, value: stats.messagesSent, label: feature37Text('pp_messages'), bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' }];

  const menu = [{ id: 'partner-notifications', icon: Bell, label: feature37Text('pn_title') }, ...menuItems, { id: 'settings', icon: Settings, label: feature37Text('pp_settings') }];
  const card = { background: 'var(--a-surface)', borderRadius: 'var(--a-radius-md)', boxShadow: 'var(--a-card-shadow)' } as const;

  return (
    <div className="a-scope pb-28 min-h-screen relative overflow-x-hidden" style={{ background: 'var(--a-bg)' }}>
      <div className="a-sky" aria-hidden>
        <span className="a-cloud c1" /><span className="a-cloud c2" /><span className="a-cloud c3" />
      </div>
      <div className="a-shell relative z-10">
        <header className="a-topbar">
          <div>
            <p className="a-eyebrow">{feature37Text('pp_profile')}</p>
            <p className="a-wordmark" style={{ fontSize: 19 }}>{name || 'Partner'}</p>
          </div>
          <div className="a-topbar-actions">
            <button type="button" className="a-icon-btn" onClick={() => onNavigate?.('partner-privacy')} aria-label={tr('usepartnerconfig_gizlilik', 'Gizlilik')}>
              <Shield size={16} />
            </button>
          </div>
        </header>

        <div className="space-y-3.5">
          {/* Me + level */}
          <motion.section className="a-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 16 }}>
            <div className="flex items-center gap-3">
              <span className="w-14 h-14 rounded-full flex items-center justify-center text-3xl shrink-0" style={{ background: 'var(--a-grad-blue)' }}>👨</span>
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ fontSize: 17, fontWeight: 900, color: 'var(--a-ink)' }}>{name || 'Partner'}</p>
                {email && <p className="truncate" style={{ fontSize: 12, color: 'var(--a-ink-soft)' }}>{email}</p>}
              </div>
              <span className="inline-flex items-center gap-1 shrink-0" style={{ background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)', borderRadius: 999, padding: '5px 11px', fontSize: 11.5, fontWeight: 800 }}>
                <Zap size={12} />{feature37Text('pp_level').replace('{n}', String(level))}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--a-surface-soft)', marginTop: 14 }}>
              <motion.div className="h-full rounded-full" style={{ background: 'var(--a-grad-blue)' }} initial={{ width: 0 }} animate={{ width: `${levelProgress}%` }} />
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--a-ink-faint)', marginTop: 4, textAlign: 'end' }}>{feature37Text('pp_to_next').replace('{n}', String(pointsToNextLevel))}</p>
          </motion.section>

          {/* Connection */}
          {isLinked && partnerProfile ?
          <section className="flex items-center gap-3" style={{ ...card, padding: 14 }}>
              <span className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0" style={{ background: 'var(--a-pink-1)' }}>
                {stage === 'bump' ? '🤰' : stage === 'mommy' ? '👩‍🍼' : '🌸'}
              </span>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--a-ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{feature37Text('pp_connected_with')}</p>
                <p className="truncate" style={{ fontSize: 15, fontWeight: 900, color: 'var(--a-ink)' }}>{partnerProfile.name}</p>
                <p className="truncate" style={{ fontSize: 11.5, color: 'var(--a-ink-soft)' }}>{stageLine}</p>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--a-green-ink)', background: 'var(--a-green-1)', borderRadius: 999, padding: '3px 9px' }}>● {feature37Text('ph_linked')}</span>
            </section> :
          <div className="flex justify-center"><PartnerLinkForm /></div>
          }

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {statTiles.map(({ icon: Icon, value, label, bg, ink }) =>
            <div key={label} className="text-center" style={{ ...card, padding: '12px 4px' }}>
                <span className="w-8 h-8 mx-auto flex items-center justify-center" style={{ borderRadius: 10, background: bg }}><Icon size={15} style={{ color: ink }} /></span>
                <p style={{ fontSize: 17, fontWeight: 900, color: 'var(--a-ink)', marginTop: 6 }}>{statsLoading ? '·' : value}</p>
                <p className="truncate" style={{ fontSize: 10, color: 'var(--a-ink-soft)' }}>{label}</p>
              </div>
            )}
          </div>

          {/* Achievements */}
          <section style={{ ...card, padding: '14px 0 12px' }}>
            <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--a-ink)', padding: '0 16px 10px' }}>{feature37Text('pp_achievements')}</p>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar" style={{ padding: '0 16px' }}>
              {achievements.map((a) =>
              <div key={a.id} className="flex-shrink-0 text-center" style={{ width: 68, opacity: a.unlocked ? 1 : 0.4 }}>
                  <div className="w-14 h-14 mx-auto flex items-center justify-center text-2xl" style={{ borderRadius: 18, background: a.unlocked ? 'var(--a-blue-1)' : 'var(--a-surface-soft)' }}>{a.emoji}</div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--a-ink-soft)', marginTop: 5, lineHeight: 1.25 }}>{a.name}</p>
                </div>
              )}
            </div>
          </section>

          {/* Menu */}
          <nav style={{ ...card, overflow: 'hidden' }}>
            {menu.map((item, index) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" onClick={() => onNavigate?.(item.id)} className="w-full flex items-center gap-3 text-start"
                style={{ padding: '13px 16px', borderTop: index ? '1px solid var(--a-line)' : undefined }}>
                  <span className="w-9 h-9 flex items-center justify-center shrink-0" style={{ borderRadius: 12, background: 'var(--a-surface-soft)' }}>
                    <Icon size={16} style={{ color: 'var(--a-ink-soft)' }} />
                  </span>
                  <span className="flex-1" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{item.label}</span>
                  <ChevronRight size={16} className="rtl:rotate-180" style={{ color: 'var(--a-ink-faint)' }} />
                </button>);
            })}
          </nav>

          <motion.button type="button" onClick={async () => { await signOut(); logout(); }} whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2"
          style={{ padding: 14, borderRadius: 16, background: 'var(--a-alert-bg)', color: 'var(--a-alert-ink)', fontSize: 14, fontWeight: 800 }}>
            <LogOut size={17} />{feature37Text('pp_logout')}
          </motion.button>
        </div>
      </div>
    </div>);

};

export default PartnerProfileScreen;
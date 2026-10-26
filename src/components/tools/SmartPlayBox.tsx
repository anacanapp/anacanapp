import { useState, useMemo } from 'react';
import { Play, Check, Clock, Package, Trophy, Baby, ChevronRight, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePlayActivities, usePlayInventoryItems, useUserPlayInventory, useToggleInventoryItem, useLogPlayActivity, PlayActivity } from '@/hooks/usePlayActivities';
import { useAuthContext } from '@/contexts/AuthContext';
import { useChildren } from '@/hooks/useChildren';
import { differenceInDays, differenceInMonths } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useScreenAnalytics } from '@/hooks/useScreenAnalytics';
import { ToolPage, ToolHeader } from './anacan/ToolKit';
import { tr } from "@/lib/tr";

interface SmartPlayBoxProps {
  onBack: () => void;
}

// Skill → anacan palette
const SKILL_STYLES: Record<string, {bg: string;ink: string;}> = {
  motor: { bg: 'var(--a-blue-1)', ink: 'var(--a-blue-ink)' },
  sensory: { bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)' },
  language: { bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' },
  cognitive: { bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)' },
  social: { bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' }
};

const SKILL_LABELS: Record<string, string> = {
  motor: '💪 ' + tr("smartplaybox_motor", 'Motor'),
  sensory: tr("smartplaybox_duygu_a3bf01", "\u270B Duy\u011Fu"),
  language: '🗣️ ' + tr("smartplaybox_dil", 'Dil'),
  cognitive: '🧠 ' + tr("playbox_cognitive", "İdrak"),
  social: '👥 ' + tr("smartplaybox_sosial", 'Sosial')
};

const SKILL_ICONS: Record<string, string> = {
  motor: '💪',
  sensory: '✋',
  language: '🗣️',
  cognitive: '🧠',
  social: '👥'
};

const DIFFICULTY_LABELS: Record<string, {label: string;bg: string;ink: string;}> = {
  easy: { label: tr("smartplaybox_easy", 'Asan'), bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' },
  medium: { label: tr("smartplaybox_medium", 'Orta'), bg: 'var(--a-yellow-1)', ink: 'var(--a-warn-ink)' },
  hard: { label: tr("smartplaybox_cetin_4bf032", 'Çətin'), bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' }
};

const SmartPlayBox = ({ onBack }: SmartPlayBoxProps) => {
  useScreenAnalytics('SmartPlayBox', 'Tools');
  const { profile } = useAuthContext();
  const [selectedActivity, setSelectedActivity] = useState<PlayActivity | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [rating, setRating] = useState(0);

  // PREMATURE DƏSTƏYİ: oyun/inkişaf fəaliyyətləri inkişaf mərhələsinə bağlıdır,
  // ona görə premature körpələrdə KORREKSİYA OLUNMUŞ yaşla filterlənir.
  // selectedChild (due_date daşıyır) mövcuddursa ondan, əks halda köhnə yol —
  // profiles.baby_birth_date-dən istifadə olunur.
  const { selectedChild, getChildAge } = useChildren();

  // Calculate baby age
  const babyInfo = useMemo(() => {
    if (selectedChild) {
      const age = getChildAge(selectedChild);
      const days = age.correctionApplied ? age.correctedDays : age.days;
      const months = age.correctionApplied ? age.correctedMonths : age.months;

      let label = '';
      if (months < 1) {
        label = `${days} ${tr('time_days_old', 'günlük')}`;
      } else if (months < 12) {
        label = `${months} ${tr('time_months_old', 'aylıq')}`;
      } else {
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        label = `${years} ${tr('time_years_old', 'yaş')}${remainingMonths > 0 ? ` ${remainingMonths} ${tr('time_month', 'ay')}` : ''}`;
      }
      if (age.correctionApplied) {
        label += ` (${tr('preemie_corrected_short', 'korreksiya')})`;
      }
      return { days, months, label };
    }

    if (!profile?.baby_birth_date) return { days: undefined, months: undefined, label: '' };
    const birthDate = new Date(profile.baby_birth_date);
    const days = differenceInDays(new Date(), birthDate);
    const months = differenceInMonths(new Date(), birthDate);

    let label = '';
    if (months < 1) {
      label = `${days} ${tr('time_days_old', 'günlük')}`;
    } else if (months < 12) {
      label = `${months} ${tr('time_months_old', 'aylıq')}`;
    } else {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      label = `${years} ${tr('time_years_old', 'yaş')}${remainingMonths > 0 ? ` ${remainingMonths} ${tr('time_month', 'ay')}` : ''}`;
    }

    return { days, months, label };
  }, [profile?.baby_birth_date, selectedChild, getChildAge]);

  const { data: inventoryItems = [] } = usePlayInventoryItems();
  const { data: userInventory = [] } = useUserPlayInventory();
  const { data: allActivities = [], isLoading } = usePlayActivities();

  const toggleInventory = useToggleInventoryItem();
  const logActivity = useLogPlayActivity();

  const userInventoryNames = userInventory.map((i) => i.item_name.toLowerCase().replace(/\s+/g, '_'));

  // Filter activities based on baby age and available items
  const { filteredActivities, matchedActivities, allAgeActivities } = useMemo(() => {
    let activities = allActivities;
    let matched: PlayActivity[] = [];
    let allAge: PlayActivity[] = [];

    // Filter by age if baby age is known
    if (babyInfo.days !== undefined) {
      activities = activities.filter((a) =>
      babyInfo.days! >= a.min_age_days && babyInfo.days! <= a.max_age_days
      );
    }

    allAge = activities;

    // Find activities that match user's inventory
    if (userInventoryNames.length > 0) {
      matched = activities.filter((a) => {
        if (!a.required_items?.length) return true;
        return a.required_items.some((item) =>
        userInventoryNames.includes(item.toLowerCase().replace(/\s+/g, '_'))
        );
      });

      // Sort matched by number of matching items
      matched = [...matched].sort((a, b) => {
        const aMatches = a.required_items?.filter((item) =>
        userInventoryNames.includes(item.toLowerCase().replace(/\s+/g, '_'))
        ).length || 0;
        const bMatches = b.required_items?.filter((item) =>
        userInventoryNames.includes(item.toLowerCase().replace(/\s+/g, '_'))
        ).length || 0;
        return bMatches - aMatches;
      });
    }

    return { filteredActivities: activities, matchedActivities: matched, allAgeActivities: allAge };
  }, [allActivities, babyInfo.days, userInventoryNames]);

  // Get today's recommended activity
  const todaysActivity = matchedActivities.length > 0 ? matchedActivities[0] : filteredActivities[0];

  const handleCompleteActivity = async () => {
    if (!selectedActivity) return;

    await logActivity.mutateAsync({
      activityId: selectedActivity.id,
      rating: rating > 0 ? rating : undefined
    });

    setShowComplete(false);
    setSelectedActivity(null);
    setRating(0);
  };

  const isItemSelected = (itemName: string) => {
    return userInventoryNames.includes(itemName.toLowerCase().replace(/\s+/g, '_'));
  };

  const handleToggleItem = async (item: {name: string;name_az: string;}) => {
    await toggleInventory.mutateAsync({
      itemName: item.name,
      itemNameAz: item.name_az
    });
  };

  // Group inventory items by category
  const groupedInventory = useMemo(() => {
    const groups: Record<string, typeof inventoryItems> = {};
    inventoryItems.forEach((item) => {
      const cat = item.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [inventoryItems]);

  const categoryLabels: Record<string, string> = {
    home: `🏠 ${tr("common_ev", 'Ev')}`,
    kitchen: tr("smartplaybox_metbex_4f67cc", "\uD83C\uDF73 M\u0259tb\u0259x"),
    recyclable: tr("smartplaybox_tekrar_istifade_4effdb", "\u267B\uFE0F T\u0259krar istifad\u0259"),
    office: tr("common_ofis_label", '📎 Ofis'),
    clothing: tr("common_paltar_label", '👕 Paltar'),
    toys: tr("common_oyuncaq_label", '🧸 Oyuncaq'),
    education: tr("smartplaybox_tehsil_ce8208", "📚 Təhsil"),
    electronics: tr("common_elektronika_label", '📱 Elektronika'),
    general: tr("smartplaybox_umumi_980283", "\uD83D\uDCE6 \xDCmumi")
  };

  const getActivityEmoji = (skills: string[]) => {
    if (skills.includes('motor')) return '🤸';
    if (skills.includes('sensory')) return '🎨';
    if (skills.includes('language')) return '📚';
    if (skills.includes('cognitive')) return '🧩';
    if (skills.includes('social')) return '👶';
    return '🎮';
  };

  const renderItemChip = (item: string, size: 'sm' | 'md' = 'sm') => {
    const invItem = inventoryItems.find((i) =>
    i.name.toLowerCase().replace(/\s+/g, '_') === item.toLowerCase().replace(/\s+/g, '_')
    );
    const hasItem = isItemSelected(item);
    return (
      <span
        key={item}
        className={`${size === 'md' ? 'px-3 py-1.5' : 'px-3 py-1'} rounded-full text-sm font-semibold flex items-center gap-1`}
        style={hasItem ?
        { background: 'var(--a-green-1)', color: 'var(--a-green-ink)' } :
        { background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}>
        
        {hasItem && <Check className="h-3 w-3" />}
        {invItem?.emoji} {invItem?.name || item}
      </span>);

  };

  return (
    <ToolPage>
      <ToolHeader
        onBack={onBack}
        eyebrow={babyInfo.label ? `${tr("smartplaybox_korpeniz_da99de", "K\xF6rp\u0259niz")} ${babyInfo.label}` : tr("smartplaybox_bugunku_tovsiye_ec6c3a", "Bugünkü Tövsiyə")}
        title={tr("smartplaybox_agilli_oyun_qutusu_db6ef9", "A\u011F\u0131ll\u0131 Oyun Qutusu")}
        actions={
        <button className="a-icon-btn relative" onClick={() => setShowInventory(true)} aria-label="Inventory">
            <Package size={16} strokeWidth={2} />
            {userInventory.length > 0 &&
          <span
            className="absolute -top-1 -end-1 text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold"
            style={{ background: 'var(--a-lav-2)', color: '#fff' }}>
                {userInventory.length}
              </span>
          }
          </button>
        } />

      <div className="space-y-3">
        {/* Setup prompt if no inventory */}
        {userInventory.length === 0 &&
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="a-card"
          style={{ background: 'var(--a-lav-1)', border: 'none' }}>
          
            <div className="flex items-start gap-3">
              <span className="a-list-icon" style={{ background: 'var(--a-grad-lav)', flexShrink: 0 }}>
                <Package size={17} strokeWidth={2.2} style={{ color: 'var(--a-lav-ink)' }} />
              </span>
              <div className="flex-1">
                <h3 className="a-list-title" style={{ margin: 0, color: 'var(--a-lav-ink)' }}>
                  {tr("smartplaybox_evdeki_esyalari_secin_3b81dd", "Evd\u0259ki \u0259\u015Fyalar\u0131 se\xE7in")}
                </h3>
                <p className="text-sm mt-1" style={{ margin: 0, color: 'var(--a-lav-ink)', opacity: 0.8 }}>
                  {tr("smartplaybox_daha_deqiq_oyun_teklifleri_ucu_c0c456", "Daha d\u0259qiq oyun t\u0259klifl\u0259ri \xFC\xE7\xFCn evinizd\u0259ki \u0259\u015Fyalar\u0131 qeyd edin.")}
                </p>
                <button
                className="a-cta-btn mt-3"
                style={{ height: 38, padding: '0 16px', fontSize: 11.5, background: 'var(--a-lav-2)', color: '#fff' }}
                onClick={() => setShowInventory(true)}>
                  {tr("smartplaybox_esyalari_sec_67bfb1", "\u018F\u015Fyalar\u0131 se\xE7")}
                
              </button>
              </div>
            </div>
          </motion.div>
        }

        {/* Today's Activity Card */}
        {todaysActivity &&
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="a-card overflow-hidden"
          style={{ padding: 0 }}>
          
            <div className="p-5" style={{ background: 'var(--a-grad-lav)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5" style={{ color: 'var(--a-lav-ink)' }} />
                <span className="font-bold a-heading" style={{ color: 'var(--a-lav-ink)' }}>{tr("smartplaybox_bugunku_tovsiye_ec6c3a", "Bugünkü Tövsiyə")}</span>
              </div>
              <div className="flex items-start gap-4">
                <motion.div
                className="text-5xl"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: 2 }}>
                
                  {getActivityEmoji(todaysActivity.skill_tags || [])}
                </motion.div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1 a-heading" style={{ color: 'var(--a-lav-ink)' }}>{todaysActivity.title}</h3>
                  <p className="text-sm" style={{ margin: 0, color: 'var(--a-lav-ink)', opacity: 0.85 }}>{todaysActivity.description}</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-1" style={{ color: 'var(--a-ink-soft)' }}>
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-semibold">{todaysActivity.duration_minutes} {tr("smartplaybox_deq_780a5c", "d\u0259q")}</span>
                </div>
                {todaysActivity.difficulty_level && DIFFICULTY_LABELS[todaysActivity.difficulty_level] &&
              <span
                className="a-rank-tag"
                style={{
                  margin: 0,
                  background: DIFFICULTY_LABELS[todaysActivity.difficulty_level].bg,
                  color: DIFFICULTY_LABELS[todaysActivity.difficulty_level].ink
                }}>
                    {DIFFICULTY_LABELS[todaysActivity.difficulty_level].label}
                  </span>
              }
                <div className="flex gap-1">
                  {todaysActivity.skill_tags?.map((skill) =>
                <span key={skill} className="text-lg" title={SKILL_LABELS[skill]}>
                      {SKILL_ICONS[skill]}
                    </span>
                )}
                </div>
              </div>

              {todaysActivity.required_items?.length > 0 &&
            <div className="mb-4">
                  <p className="a-list-sub mb-2" style={{ margin: '0 0 8px' }}>{tr("smartplaybox_lazim_olan_esyalar_b33d1b", "Lazım olan əşyalar:")}</p>
                  <div className="flex flex-wrap gap-2">
                    {todaysActivity.required_items.map((item) => renderItemChip(item))}
                  </div>
                </div>
            }

              <button
              className="a-cta-btn w-full"
              style={{ justifyContent: 'center', height: 46, background: 'var(--a-lav-2)', color: '#fff' }}
              onClick={() => setSelectedActivity(todaysActivity)}>
              
                <Play size={15} strokeWidth={2.2} />
                {tr("smartplaybox_oyuna_basla_fe4574", "Oyuna Ba\u015Fla")}
              </button>
            </div>
          </motion.div>
        }

        {/* Skills Overview */}
        <div className="a-card">
          <p className="a-card-title a-heading" style={{ marginBottom: 10 }}>{tr("smartplaybox_bacariq_saheleri_d5133c", "Bacarıq Sahələri")}</p>
          <div className="grid grid-cols-5 gap-2">
            {Object.entries(SKILL_ICONS).map(([skill, icon]) => {
              const count = filteredActivities.filter((a) => a.skill_tags?.includes(skill)).length;
              return (
                <div key={skill} className="text-center rounded-2xl py-2" style={{ background: SKILL_STYLES[skill]?.bg || 'var(--a-surface-soft)' }}>
                  <div className="text-2xl mb-1">{icon}</div>
                  <p className="text-xs font-bold" style={{ margin: 0, color: SKILL_STYLES[skill]?.ink || 'var(--a-ink-soft)' }}>{count}</p>
                </div>);

            })}
          </div>
        </div>

        {/* All Activities */}
        <div>
          <div className="a-section-head">
            <h2 className="a-section-title a-heading" style={{ fontSize: 15 }}>
              {matchedActivities.length > 0 ?
              `${tr("playbox_for_you", "Sizin üçün")} (${matchedActivities.length})` :
              `${tr("playbox_all_games", "Bütün Oyunlar")} (${filteredActivities.length})`}
            </h2>
          </div>
          
          {isLoading ?
          <div className="a-card text-center" style={{ padding: '34px 18px' }}>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" style={{ color: 'var(--a-lav-2)' }} />
              <p className="a-list-sub" style={{ margin: 0 }}>{tr("smartplaybox_oyunlar_yuklenir_d1edd2", "Oyunlar yüklənir...")}</p>
            </div> :
          filteredActivities.length === 0 ?
          <div className="a-card text-center" style={{ padding: '34px 18px' }}>
              <Baby className="h-12 w-12 mx-auto mb-2" style={{ color: 'var(--a-ink-faint)' }} />
              <p className="a-list-title" style={{ margin: 0 }}>{tr("smartplaybox_bu_yasa_uygun_oyun_tapilmadi_72e443", "Bu yaşa uyğun oyun tapılmadı")}</p>
              {!profile?.baby_birth_date &&
            <p className="a-list-sub mt-2" style={{ margin: '8px 0 0', whiteSpace: 'normal' }}>{tr("smartplaybox_profilde_korpenin_dogum_tarixini_elave_e_696d85", "Profildə körpənin doğum tarixini əlavə edin")}</p>
            }
            </div> :

          <div className="a-list-card pb-4">
              <AnimatePresence>
                {(matchedActivities.length > 0 ? matchedActivities : filteredActivities).map((activity, index) =>
              <motion.button
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.3) }}
                className="a-list-row w-full text-start"
                style={{ width: '100%', background: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer' }}
                onClick={() => setSelectedActivity(activity)}>
                
                    <span className="a-list-icon" style={{ background: 'var(--a-grad-lav)', fontSize: 18 }}>
                      {getActivityEmoji(activity.skill_tags || [])}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="a-list-title">{activity.title}</p>
                      <p className="a-list-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activity.duration_minutes} {tr("smartplaybox_deq_780a5c", "d\u0259q")} · {activity.description}
                      </p>
                    </div>
                    <span className="a-list-trail" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13 }}>
                        {activity.skill_tags?.slice(0, 3).map((skill) => SKILL_ICONS[skill]).join(' ')}
                      </span>
                      <ChevronRight size={16} className="rtl:rotate-180 a-list-chevron" />
                    </span>
                  </motion.button>
              )}
              </AnimatePresence>
            </div>
          }
        </div>
      </div>

      {/* Activity Detail Modal */}
      <Dialog open={!!selectedActivity && !showComplete} onOpenChange={(open) => !open && setSelectedActivity(null)}>
        <DialogContent className="a-scope max-w-md max-h-[85vh] overflow-y-auto p-0 rounded-[26px]" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          {selectedActivity &&
          <>
              <div className="p-6" style={{ background: 'var(--a-grad-lav)' }}>
                <div className="flex items-center gap-4">
                  <div className="text-5xl">
                    {getActivityEmoji(selectedActivity.skill_tags || [])}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold a-heading" style={{ margin: 0, color: 'var(--a-lav-ink)' }}>{selectedActivity.title}</h2>
                    <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: 'var(--a-lav-ink)', opacity: 0.8 }}>
                      <Clock className="h-4 w-4" />
                      <span>{selectedActivity.duration_minutes} {tr("smartplaybox_deqiqe_94641a", "d\u0259qiq\u0259")}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-5">
                <p className="a-cta-text" style={{ margin: 0 }}>{selectedActivity.description}</p>
                
                {/* Skills */}
                <div className="flex flex-wrap gap-2">
                  {selectedActivity.skill_tags?.map((skill) =>
                <span
                  key={skill}
                  className="a-rank-tag"
                  style={{
                    margin: 0,
                    background: SKILL_STYLES[skill]?.bg || 'var(--a-surface-soft)',
                    color: SKILL_STYLES[skill]?.ink || 'var(--a-ink-soft)'
                  }}>
                      {SKILL_LABELS[skill]}
                    </span>
                )}
                  {selectedActivity.difficulty_level && DIFFICULTY_LABELS[selectedActivity.difficulty_level] &&
                <span
                  className="a-rank-tag"
                  style={{
                    margin: 0,
                    background: DIFFICULTY_LABELS[selectedActivity.difficulty_level].bg,
                    color: DIFFICULTY_LABELS[selectedActivity.difficulty_level].ink
                  }}>
                      {DIFFICULTY_LABELS[selectedActivity.difficulty_level].label}
                    </span>
                }
                </div>

                {/* Required items */}
                {selectedActivity.required_items?.length > 0 &&
              <div>
                    <h4 className="font-bold mb-2" style={{ color: 'var(--a-ink)' }}>{tr("smartplaybox_lazim_olan_esyalar_8e1429", "📦 Lazım olan əşyalar")}</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedActivity.required_items.map((item) => renderItemChip(item, 'md'))}
                    </div>
                  </div>
              }

                {/* Instructions */}
                {selectedActivity.instructions &&
              <div>
                    <h4 className="font-bold mb-2" style={{ color: 'var(--a-ink)' }}>{tr("smartplaybox_nece_oynamali_6cadac", "📝 Necə oynamalı")}</h4>
                    <div className="rounded-2xl p-4" style={{ background: 'var(--a-surface-soft)' }}>
                      <p className="text-sm whitespace-pre-line leading-relaxed" style={{ margin: 0, color: 'var(--a-body-text)' }}>
                        {selectedActivity.instructions}
                      </p>
                    </div>
                  </div>
              }

                <button
                className="a-cta-btn w-full"
                style={{ justifyContent: 'center', height: 46, background: 'var(--a-lav-2)', color: '#fff' }}
                onClick={() => setShowComplete(true)}>
                
                  <Check size={15} strokeWidth={2.2} />
                  {tr("smartplaybox_oyunu_tamamladim_51cdab", "Oyunu Tamamlad\u0131m!")}
                </button>
              </div>
            </>
          }
        </DialogContent>
      </Dialog>

      {/* Complete Activity Modal */}
      <Dialog open={showComplete} onOpenChange={setShowComplete}>
        <DialogContent className="a-scope max-w-sm rounded-[26px] max-h-[85dvh] overflow-y-auto" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          <DialogHeader>
            <DialogTitle className="text-center a-heading" style={{ color: 'var(--a-ink)' }}>{tr("smartplaybox_ela_548a34", "🎉 Əla!")}</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>{tr("smartplaybox_oyun_nece_kecdi_c5f5f4", "Oyun necə keçdi?")}</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) =>
              <motion.button
                key={star}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setRating(star)}
                className="text-3xl">
                
                  {rating >= star ? '⭐' : '☆'}
                </motion.button>
              )}
            </div>
            <button
              className="a-cta-btn w-full"
              style={{ justifyContent: 'center', height: 46, background: 'var(--a-lav-2)', color: '#fff', opacity: logActivity.isPending ? 0.7 : 1 }}
              onClick={handleCompleteActivity}
              disabled={logActivity.isPending}>
              
              {logActivity.isPending ?
              <Loader2 className="h-4 w-4 animate-spin" /> :

              tr("playbox_log_note", "Qeyd et")
              }
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Inventory Modal */}
      <Dialog open={showInventory} onOpenChange={setShowInventory}>
        <DialogContent className="a-scope max-w-md max-h-[85vh] overflow-y-auto rounded-[26px]" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 a-heading" style={{ color: 'var(--a-ink)' }}>
              <Package className="h-5 w-5" style={{ color: 'var(--a-lav-2)' }} />
              {tr("smartplaybox_evde_olan_esyalar_382e9a", "Evd\u0259 Olan \u018F\u015Fyalar")}
            </DialogTitle>
          </DialogHeader>
          <p className="a-list-sub" style={{ margin: 0, whiteSpace: 'normal' }}>
            {tr("smartplaybox_evinizde_olan_esyalari_secin_s_ec7864", "Evinizd\u0259 olan \u0259\u015Fyalar\u0131 se\xE7in, siz\u0259 uy\u011Fun oyunlar t\xF6vsiy\u0259 ed\u0259k.")}
          </p>
          
          {userInventory.length > 0 &&
          <div className="p-3 rounded-2xl" style={{ background: 'var(--a-lav-1)' }}>
              <p className="text-sm font-bold" style={{ margin: 0, color: 'var(--a-lav-ink)' }}>
                ✓ {userInventory.length} {tr("smartplaybox_esya_secilib_cfd789", "\u0259\u015Fya se\xE7ilib")}
              </p>
            </div>
          }

          <div className="space-y-4">
            {Object.entries(groupedInventory).map(([category, items]) =>
            <div key={category}>
                <h4 className="font-bold text-sm mb-2" style={{ color: 'var(--a-ink)' }}>{categoryLabels[category] || category}</h4>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) =>
                <motion.button
                  key={item.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleToggleItem(item)}
                  disabled={toggleInventory.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all"
                  style={isItemSelected(item.name) ?
                  { background: 'var(--a-lav-2)', color: '#fff', boxShadow: '0 6px 14px -6px rgba(171, 132, 238, 0.6)' } :
                  { background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)' }}>
                  
                      <span>{item.emoji}</span>
                      <span>{item.name}</span>
                      {isItemSelected(item.name) && <Check className="h-3 w-3" />}
                    </motion.button>
                )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ToolPage>);

};

export default SmartPlayBox;

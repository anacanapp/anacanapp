import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gift, Check, Clock, Heart, Sparkles,
  Calendar, Star, ChefHat, Music, Camera,
  Flower2, MapPin, MessageCircle, ShoppingBag,
  History, Trophy, Trash2, ChevronDown, ChevronUp, Loader2 } from
'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { hapticFeedback } from '@/lib/native';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePartnerData } from '@/hooks/usePartnerData';
import { useSurprises } from '@/hooks/useSurprises';
import { useSurpriseIdeas } from '@/hooks/useDynamicConfig';
import { format } from 'date-fns';
import { getCurrentDateLocale } from '@/lib/date-utils';
import { tr } from "@/lib/tr";

interface SurpriseIdea {
  id: string;
  surprise_key: string;
  title: string;
  title_az: string | null;
  description: string | null;
  description_az: string | null;
  emoji: string;
  icon: string | null;
  category: string;
  difficulty: string;
  points: number;
}

// Icon mapping for dynamic icons from database
const ICON_MAP: Record<string, any> = {
  ChefHat,
  Heart,
  ShoppingBag,
  MapPin,
  MessageCircle,
  Flower2,
  Star,
  Camera,
  Music,
  Gift,
  Sparkles
};

const SurpriseTab = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { partnerProfile } = usePartnerData();
  const {
    plannedSurprises,
    completedSurprises,
    totalPoints,
    isLoading,
    addSurprise,
    completeSurprise,
    deleteSurprise
  } = useSurprises();

  // Fetch surprise ideas from database
  const { data: surpriseIdeasData, isLoading: ideasLoading } = useSurpriseIdeas();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSurprise, setSelectedSurprise] = useState<SurpriseIdea | null>(null);
  const [planningDate, setPlanningDate] = useState('');
  const [planningNotes, setPlanningNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Build categories dynamically from data
  const categories = useMemo(() => {
    const baseCategories = [{ id: 'all', label: tr("surprisetab_hamisi_c73c4d", 'Hamısı'), emoji: '✨' }];
    const uniqueCategories = new Set(surpriseIdeasData?.map((s) => s.category) || []);

    const categoryLabels: Record<string, {label: string;emoji: string;}> = {
      romantic: { label: tr("surprisetab_romantic", 'Romantik'), emoji: '❤️' },
      care: { label: tr("surprisetab_qaygi_868e7d", 'Qayğı'), emoji: '🤗' },
      adventure: { label: tr("surprisetab_macera_bc3bdc", 'Macəra'), emoji: '🌟' },
      gift: { label: tr("surprisetab_hediyye_8578f3", 'Hədiyyə'), emoji: '🎁' },
      creative: { label: tr("surprisetab_yaradici_28b2b1", 'Yaradıcı'), emoji: '🎨' },
      fun: { label: tr("surprisetab_eylence_43d0e0", 'Əyləncə'), emoji: '🎉' }
    };

    uniqueCategories.forEach((cat) => {
      if (categoryLabels[cat]) {
        baseCategories.push({ id: cat, ...categoryLabels[cat] });
      }
    });

    return baseCategories;
  }, [surpriseIdeasData]);

  // Map database data to UI format
  const surpriseIdeas: SurpriseIdea[] = useMemo(() => {
    return (surpriseIdeasData || []).map((idea) => ({
      id: idea.id,
      surprise_key: idea.surprise_key,
      title: idea.title_az || idea.title,
      title_az: idea.title_az,
      description: idea.description_az || idea.description,
      description_az: idea.description_az,
      emoji: idea.emoji || '🎁',
      icon: idea.icon,
      category: idea.category,
      difficulty: idea.difficulty || 'easy',
      points: idea.points || 10
    }));
  }, [surpriseIdeasData]);

  const filteredIdeas = selectedCategory === 'all' ?
  surpriseIdeas :
  surpriseIdeas.filter((s) => s.category === selectedCategory);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'medium':return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'hard':return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
      default:return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'romantic':return 'from-pink-500 to-rose-600';
      case 'care':return 'from-violet-500 to-purple-600';
      case 'adventure':return 'from-amber-500 to-orange-600';
      case 'gift':return 'from-emerald-500 to-teal-600';
      default:return 'from-partner to-indigo-600';
    }
  };

  const planSurprise = async () => {
    if (!selectedSurprise || !planningDate) return;

    await hapticFeedback.medium();

    const result = await addSurprise({
      surprise_id: selectedSurprise.id,
      surprise_title: selectedSurprise.title,
      surprise_emoji: selectedSurprise.emoji,
      surprise_category: selectedSurprise.category,
      surprise_points: selectedSurprise.points,
      planned_date: planningDate,
      notes: planningNotes || undefined
    });

    if (result) {
      // Send notification to partner
      if (profile && partnerProfile) {
        try {
          await supabase.from('partner_messages').insert({
            sender_id: profile.user_id,
            receiver_id: partnerProfile.user_id,
            message_type: 'surprise_planned',
            content: tr("partner_surprise_planned", `🎁 Həyat yoldaşın sənin üçün xüsusi bir sürpriz planladı!`)
          });
        } catch (err) {
          console.error('Error sending surprise notification:', err);
        }
      }

      toast({
        title: tr("surprisetab_surpriz_planlandi_0e685c", 'Sürpriz planlandı! 🎉'),
        description: `${selectedSurprise.title} - ${format(new Date(planningDate), 'd MMMM yyyy', { locale: getCurrentDateLocale() })}`
      });

      setSelectedSurprise(null);
      setPlanningDate('');
      setPlanningNotes('');
    }
  };

  const handleCompleteSurprise = async (id: string, title: string, points: number, emoji: string) => {
    await hapticFeedback.heavy();

    const success = await completeSurprise(id);
    if (success) {
      // Send completion notification to partner
      if (profile && partnerProfile) {
        try {
          await supabase.from('partner_messages').insert({
            sender_id: profile.user_id,
            receiver_id: partnerProfile.user_id,
            message_type: 'surprise_completed',
            content: `${emoji} ${tr("partner_surprise_completed_1", "Həyat yoldaşın")} "${title}" ${tr("partner_surprise_completed_2", "sürprizini sənin üçün tamamladı! 🎉")}`
          });

          // Also add to notifications table
          await supabase.from('notifications').insert({
            user_id: partnerProfile.user_id,
            notification_type: 'surprise',
            title: tr("surprisetab_surpriz_tamamlandi_ff52dd", 'Sürpriz Tamamlandı! 🎁'),
            message: tr("surprisetab_partner_completed_msg_f123bc", "{partnerName} sənin üçün \"{title}\" sürprizini tamamladı! {emoji}").replace("{partnerName}", profile.name || tr("surprisetab_heyat_yoldasin_fc543b", "Həyat yoldaşın")).replace("{title}", title).replace("{emoji}", emoji)
          });
        } catch (err) {
          console.error('Error sending surprise completion notification:', err);
        }
      }

      toast({
        title: `+${points} ${tr("partner_points_earned_2", "xal qazandın! 🏆")}`,
        description: `${title} ${tr("partner_surprise_done", "tamamlandı!")}`
      });
    }
  };

  const handleDeleteSurprise = async (id: string) => {
    await hapticFeedback.light();
    await deleteSurprise(id);
    toast({
      title: tr("surprisetab_surpriz_silindi_095181", 'Sürpriz silindi')
    });
  };

  const isPlanned = (surpriseId: string) =>
  plannedSurprises.some((p) => p.surprise_id === surpriseId);

  return (
    <motion.div
      key="surprise"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-5 pb-32">
      
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg">{tr("surprisetab_surpriz_planla_d495ce", "Sürpriz Planla")}</h2>
            <p className="text-sm text-muted-foreground">{tr("surprisetab_onu_xosbext_etmek_ucun_7ecff1", "Onu xoşbəxt etmək üçün")}</p>
          </div>
        </div>
        
        {/* Stats Badge */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 px-4 py-2 rounded-2xl">
          <Trophy className="w-5 h-5 text-amber-600" />
          <div className="text-end">
            <p className="text-xs text-amber-700 dark:text-amber-400">{tr("untranslated_toplam_lheej5", "Toplam")}</p>
            <p className="font-bold text-amber-800 dark:text-amber-300">{totalPoints} xal</p>
          </div>
        </div>
      </div>

      {/* Planned Surprises */}
      {plannedSurprises.length > 0 &&
      <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-partner" />
            {tr("surprisetab_planlanmis_surprizler_3cd66a", "Planlanm\u0131\u015F S\xFCrprizl\u0259r (")}{plannedSurprises.length})
          </h3>
          {plannedSurprises.map((planned) =>
        <motion.div
          key={planned.id}
          className="bg-gradient-to-r from-partner/10 to-violet-500/10 rounded-2xl p-4 border border-partner/20"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          layout>
          
              <div className="flex items-center gap-4">
                <div className="text-3xl">{planned.surprise_emoji}</div>
                <div className="flex-1">
                  <h4 className="font-semibold">{planned.surprise_title}</h4>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(planned.planned_date), 'd MMMM yyyy', { locale: getCurrentDateLocale() })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                onClick={() => handleDeleteSurprise(planned.id)}
                className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center"
                whileTap={{ scale: 0.9 }}>
                
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                  <motion.button
                onClick={() => handleCompleteSurprise(planned.id, planned.surprise_title, planned.surprise_points, planned.surprise_emoji)}
                className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center"
                whileTap={{ scale: 0.9 }}>
                
                    <Check className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
              {planned.notes &&
          <p className="text-sm text-muted-foreground mt-2 ps-12">{planned.notes}</p>
          }
            </motion.div>
        )}
        </div>
      }

      {/* Completed Surprises History */}
      {completedSurprises.length > 0 &&
      <div className="space-y-3">
          <motion.button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800"
          whileTap={{ scale: 0.98 }}>
          
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                <History className="w-5 h-5 text-white" />
              </div>
              <div className="text-start">
                <h3 className="font-semibold text-emerald-800 dark:text-emerald-200">{tr("surprisetab_surpriz_tarixcesi_46a7ab", "Sürpriz Tarixçəsi")}</h3>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  {completedSurprises.length} {tr("surprisetab_surpriz_tamamlanib_e7514f", "s\xFCrpriz tamamlan\u0131b")}
                </p>
              </div>
            </div>
            <motion.div
            animate={{ rotate: showHistory ? 180 : 0 }}
            transition={{ duration: 0.2 }}>
            
              <ChevronDown className="w-5 h-5 text-emerald-600" />
            </motion.div>
          </motion.button>

          <AnimatePresence>
            {showHistory &&
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 overflow-hidden">
            
                {completedSurprises.map((surprise, index) =>
            <motion.div
              key={surprise.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-card rounded-xl p-3 border border-border/50 flex items-center gap-3">
              
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xl">
                      {surprise.surprise_emoji}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{surprise.surprise_title}</p>
                      <p className="text-xs text-muted-foreground">
                        {surprise.completed_date ?
                  format(new Date(surprise.completed_date), 'd MMM yyyy', { locale: getCurrentDateLocale() }) : tr("surprisetab_tamamlandi_5e0188", "Tamamland\u0131")

                  }
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-lg">
                      <Star className="w-3 h-3 text-amber-600" />
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400">+{surprise.surprise_points}</span>
                    </div>
                  </motion.div>
            )}
              </motion.div>
          }
          </AnimatePresence>
        </div>
      }

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
        {categories.map((cat) =>
        <motion.button
          key={cat.id}
          onClick={() => setSelectedCategory(cat.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
          selectedCategory === cat.id ?
          'bg-partner text-white shadow-md' :
          'bg-muted/50 text-muted-foreground hover:bg-muted'}`
          }
          whileTap={{ scale: 0.95 }}>
          
            <span>{cat.emoji}</span>
            <span className="text-sm font-medium">{cat.label}</span>
          </motion.button>
        )}
      </div>

      {/* Surprise Ideas Grid */}
      <div className="grid gap-4">
        {filteredIdeas.map((idea, index) => {
          const planned = isPlanned(idea.id);

          return (
            <motion.div
              key={idea.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-card rounded-2xl p-4 shadow-lg border-2 transition-all ${
              planned ? 'border-partner/50 bg-partner/5' : 'border-border/50'}`
              }>
              
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getCategoryColor(idea.category)} flex items-center justify-center shrink-0 shadow-md`}>
                  <span className="text-2xl">{idea.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold">{idea.title}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getDifficultyColor(idea.difficulty)}`}>
                      {idea.difficulty === 'easy' ? tr("surprisetab_difficulty_easy", 'Asan') : idea.difficulty === 'medium' ? tr("surprisetab_difficulty_orta", 'Orta') : tr("surprisetab_cetin_4bf032", "\xC7\u0259tin")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{idea.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-bold text-amber-600">+{idea.points} xal</span>
                    </div>
                    {planned ?
                    <span className="text-xs text-partner font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {tr("surprisetab_planlandi_3fb737", "Planland\u0131")}
                      </span> :

                    <motion.button
                      onClick={() => setSelectedSurprise(idea)}
                      className="px-4 py-2 bg-partner text-white text-sm font-medium rounded-xl flex items-center gap-1"
                      whileTap={{ scale: 0.95 }}>
                      
                        <Sparkles className="w-4 h-4" />
                        {tr("surprisetab_planla", "Planla")}
                      </motion.button>
                    }
                  </div>
                </div>
              </div>
            </motion.div>);

        })}
      </div>

      {/* Planning Modal */}
      <AnimatePresence>
        {selectedSurprise &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedSurprise(null)}>
          
            <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="w-full max-w-lg bg-card rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 100px)' }}
            onClick={(e) => e.stopPropagation()}>
            
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-6" />
              
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getCategoryColor(selectedSurprise.category)} flex items-center justify-center`}>
                  <span className="text-3xl">{selectedSurprise.emoji}</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg">{selectedSurprise.title}</h3>
                  <p className="text-sm text-muted-foreground">{selectedSurprise.description}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("surprisetab_tarix_sec_937037", "Tarix seç")}</label>
                  <input
                  type="date"
                  value={planningDate}
                  onChange={(e) => setPlanningDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full h-12 px-4 rounded-xl bg-muted/50 border-2 border-transparent focus:border-partner/30 outline-none" />
                
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">{tr("surprisetab_qeyd_isteye_bagli_96c689", "Qeyd (istəyə bağlı)")}</label>
                  <textarea
                  value={planningNotes}
                  onChange={(e) => setPlanningNotes(e.target.value)}
                  placeholder={tr("surprisetab_xususi_qeydler_6c6d1f", "Xüsusi qeydlər...")}
                  className="w-full h-24 px-4 py-3 rounded-xl bg-muted/50 border-2 border-transparent focus:border-partner/30 outline-none resize-none" />
                
                </div>
                <motion.button
                onClick={planSurprise}
                disabled={!planningDate}
                className="w-full h-14 bg-gradient-to-r from-partner to-violet-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
                whileTap={{ scale: 0.98 }}>
                
                  <Gift className="w-5 h-5" />
                  {tr("surprisetab_surprizi_planla_f95b6f", "S\xFCrprizi Planla")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>

      {/* Tips Section */}
      <motion.div
        className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-2xl p-5 border border-pink-200 dark:border-pink-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}>
        
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-pink-500" />
          <h3 className="font-bold text-pink-800 dark:text-pink-200">{tr("surprisetab_ipucu_a842e4", "İpucu")}</h3>
        </div>
        <p className="text-sm text-pink-700 dark:text-pink-300">
          {tr("surprisetab_kicik_ve_sade_jestler_cox_vaxt_53a074", "Ki\xE7ik v\u0259 sad\u0259 jestl\u0259r \xE7ox vaxt \u0259n yadda qalanlar olur. G\xF6zl\u0259nilm\u0259z anlarda edil\u0259n s\xFCrprizl\u0259r daha x\xFCsusidir! \uD83D\uDC95")}
        </p>
      </motion.div>
    </motion.div>);

};

export default SurpriseTab;
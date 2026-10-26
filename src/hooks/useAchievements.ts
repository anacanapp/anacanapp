import { useState, useEffect, useCallback } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

// Achievement definitions for all user types
export const ACHIEVEMENTS = {
  // Flow achievements
  flow: [
    { id: 'first_log', name: tr("useachievements_ilk_qeyd_9ffe17", "İlk qeyd"), description: tr("useachievements_ilk_gundelik_qeydinizi_etdiniz_5668b4", "İlk gündəlik qeydinizi etdiniz"), emoji: '📝', points: 10 },
    { id: 'water_champion', name: tr("useachievements_su_cempionu_dbdd89", "Su çempionu"), description: tr("useachievements_7_gun_ardicil_8_stekan_su_icdiniz_4a8763", "7 gün ardıcıl 8 stəkan su içdiniz"), emoji: '💧', points: 50 },
    { id: 'symptom_tracker', name: tr("useachievements_simptom_izleyicisi_f87e97", "Simptom izləyicisi"), description: tr("useachievements_30_gun_simptom_qeyd_etdiniz_4ebd0c", "30 gün simptom qeyd etdiniz"), emoji: '📊', points: 100 },
    { id: 'cycle_expert', name: tr("useachievements_dovr_eksperti_a59aef", "Dövr eksperti"), description: tr("useachievements_3_ay_dovr_izlediniz_0c7214", "3 ay dövr izlədiniz"), emoji: '🔄', points: 150 },
  ],
  // Bump achievements
  bump: [
    { id: 'first_kick', name: tr("useachievements_ilk_tepik_c4991e", "İlk təpik"), description: tr("useachievements_ilk_tepiki_qeyd_etdiniz_6cb5de", "İlk təpiki qeyd etdiniz"), emoji: '👣', points: 10 },
    { id: 'kick_master', name: tr("useachievements_tepik_ustasi_8d8ddd", "Təpik ustası"), description: tr("useachievements_100_tepik_qeyd_etdiniz_7cff23", "100 təpik qeyd etdiniz"), emoji: '🦶', points: 50 },
    { id: 'weight_tracker', name: tr("useachievements_ceki_izleyicisi_a28936", "Çəki izləyicisi"), description: tr("useachievements_10_ceki_qeydi_etdiniz_15ea30", "10 çəki qeydi etdiniz"), emoji: '⚖️', points: 30 },
    { id: 'trimester_1', name: tr("useachievements_1_ci_trimester_12345", "1-ci trimester"), description: tr("useachievements_1_ci_trimestri_tamamladiniz_82953e", "1-ci trimestri tamamladınız"), emoji: '🌱', points: 100 },
    { id: 'trimester_2', name: tr("useachievements_2_ci_trimester_23456", "2-ci trimester"), description: tr("useachievements_2_ci_trimestri_tamamladiniz_bd7d13", "2-ci trimestri tamamladınız"), emoji: '🌿', points: 150 },
    { id: 'trimester_3', name: tr("useachievements_3_cu_trimester_03fa4b", "3-cü trimester"), description: tr("useachievements_3_cu_trimestri_tamamladiniz_7a26a5", "3-cü trimestri tamamladınız"), emoji: '🌳', points: 200 },
    { id: 'hospital_bag_ready', name: tr("useachievements_xestexana_cantasi_hazir_71cd1a", "Xəstəxana çantası hazır"), description: tr("useachievements_xestexana_cantasini_tamamladiniz_7825f8", "Xəstəxana çantasını tamamladınız"), emoji: '🎒', points: 75 },
  ],
  // Mommy achievements
  mommy: [
    { id: 'first_feed', name: tr("useachievements_ilk_qidalanma_d5b330", "İlk qidalanma"), description: tr("useachievements_ilk_qidalanmani_qeyd_etdiniz_d2ba0b", "İlk qidalanmanı qeyd etdiniz"), emoji: '🍼', points: 10 },
    { id: 'feeding_pro', name: tr("useachievements_qidalanma_ustasi_7ee87c", "Qidalanma ustası"), description: tr("useachievements_100_qidalanma_qeyd_etdiniz_34567", "100 qidalanma qeyd etdiniz"), emoji: '🤱', points: 100 },
    { id: 'sleep_tracker', name: tr("useachievements_yuxu_izleyicisi_1ed3f5", "Yuxu izləyicisi"), description: tr("useachievements_50_yuxu_qeyd_etdiniz_45678", "50 yuxu qeyd etdiniz"), emoji: '😴', points: 50 },
    { id: 'diaper_hero', name: tr("useachievements_bez_qehremani_72c596", "Bez qəhrəmanı"), description: tr("useachievements_100_bez_deyisme_qeyd_etdiniz_5fd4f5", "100 bez dəyişmə qeyd etdiniz"), emoji: '👶', points: 75 },
    { id: 'milestone_first', name: tr("useachievements_ilk_merhele_a06a58", "İlk mərhələ"), description: tr("useachievements_ilk_inkisaf_merhelesini_qeyd_etdiniz_50d5c9", "İlk inkişaf mərhələsini qeyd etdiniz"), emoji: '⭐', points: 25 },
    { id: 'milestone_5', name: tr("useachievements_5_merhele_aaa997", "5 mərhələ"), description: tr("useachievements_5_inkisaf_merhelesini_qeyd_etdiniz_831f29", "5 inkişaf mərhələsini qeyd etdiniz"), emoji: '🏆', points: 100 },
  ],
  // Partner achievements
  partner: [
    { id: 'first_message', name: tr("useachievements_ilk_mesaj_c2af7d", "İlk mesaj"), description: tr("useachievements_ilk_mesaji_gonderdiniz_cb17f2", "İlk mesajı göndərdiniz"), emoji: '💬', points: 10 },
    { id: 'support_star', name: tr("useachievements_destek_ulduzu_843f2b", "Dəstək ulduzu"), description: tr("useachievements_10_sevgi_gonderdiniz_daf5b1", "10 sevgi göndərdiniz"), emoji: '❤️', points: 30 },
    { id: 'shopping_helper', name: tr("useachievements_alis_veris_komekcisi_429aaa", "Alış-veriş köməkçisi"), description: tr("useachievements_10_mehsul_elave_etdiniz_269710", "10 məhsul əlavə etdiniz"), emoji: '🛒', points: 50 },
    { id: 'active_partner', name: tr("useachievements_aktiv_partner_56789", "Aktiv partner"), description: tr("useachievements_7_gun_ardicil_tetbiqi_istifade_etdiniz_74a7d5", "7 gün ardıcıl tətbiqi istifadə etdiniz"), emoji: '🌟', points: 100 },
  ],
  // General achievements
  general: [
    { id: 'profile_complete', name: tr("useachievements_profil_tamamlandi_a64e06", "Profil tamamlandı"), description: tr("useachievements_profilinizi_tamamladiniz_546cdb", "Profilinizi tamamladınız"), emoji: '✅', points: 20 },
    { id: 'first_week', name: tr("useachievements_ilk_hefte_7228fd", "İlk həftə"), description: tr("useachievements_tetbiqi_1_hefte_istifade_etdiniz_5dff17", "Tətbiqi 1 həftə istifadə etdiniz"), emoji: '📅', points: 25 },
    { id: 'first_month', name: tr("useachievements_ilk_ay_de1d29", "İlk ay"), description: tr("useachievements_tetbiqi_1_ay_istifade_etdiniz_18a5b8", "Tətbiqi 1 ay istifadə etdiniz"), emoji: '🗓️', points: 100 },
    { id: 'community_member', name: tr("useachievements_icma_uzvu_7f7890", "İcma üzvü"), description: tr("useachievements_ilk_paylasiminizi_etdiniz_10b9f8", "İlk paylaşımınızı etdiniz"), emoji: '👥', points: 30 },
  ],
};

export interface Achievement {
  id: string;
  achievement_id: string;
  achievement_type: string;
  achieved_at: string;
  notified: boolean;
}

export const useAchievements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAchievements = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', user.id)
        .order('achieved_at', { ascending: false });

      if (error) throw error;
      setAchievements(data || []);
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAchievements();

    // Subscribe to realtime updates
    if (user) {
      const channel = supabase
        .channel(`achievements-channel:${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'user_achievements',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            const newAchievement = payload.new as Achievement;
            setAchievements(prev => [newAchievement, ...prev]);
            
            // Find achievement details
            const allAchievements = Object.values(ACHIEVEMENTS).flat();
            const details = allAchievements.find(a => a.id === newAchievement.achievement_id);
            
            if (details && !newAchievement.notified) {
              toast({
                title: `${tr("useachievements_nailiyyet", "🎉 Nailiyyət:")} ${details.name}`,
                description: details.description,
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, fetchAchievements, toast]);

  const unlockAchievement = useCallback(async (achievementId: string, achievementType: string) => {
    if (!user) return false;

    // Check if already unlocked
    const existing = achievements.find(a => a.achievement_id === achievementId);
    if (existing) return false;

    try {
      const { error } = await supabase
        .from('user_achievements')
        .insert({
          user_id: user.id,
          achievement_id: achievementId,
          achievement_type: achievementType,
          notified: false,
        });

      if (error) {
        // Ignore duplicate key errors
        if (error.code === '23505') return false;
        throw error;
      }

      // Mark as notified after showing toast
      await supabase
        .from('user_achievements')
        .update({ notified: true })
        .eq('user_id', user.id)
        .eq('achievement_id', achievementId);

      return true;
    } catch (error) {
      console.error('Error unlocking achievement:', error);
      return false;
    }
  }, [user, achievements]);

  const hasAchievement = useCallback((achievementId: string) => {
    return achievements.some(a => a.achievement_id === achievementId);
  }, [achievements]);

  const getAchievementsByType = useCallback((type: string) => {
    return achievements.filter(a => a.achievement_type === type);
  }, [achievements]);

  const getTotalPoints = useCallback(() => {
    const allAchievements = Object.values(ACHIEVEMENTS).flat();
    return achievements.reduce((total, a) => {
      const details = allAchievements.find(d => d.id === a.achievement_id);
      return total + (details?.points || 0);
    }, 0);
  }, [achievements]);

  return {
    achievements,
    loading,
    unlockAchievement,
    hasAchievement,
    getAchievementsByType,
    getTotalPoints,
    refetch: fetchAchievements,
    ACHIEVEMENTS,
  };
};

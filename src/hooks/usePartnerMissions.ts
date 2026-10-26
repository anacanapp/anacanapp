import { useState, useEffect, useCallback } from 'react';
import { tr } from '@/lib/tr';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Coffee, Heart, Flower2, Stethoscope, Baby, Gift, Star, ShoppingCart, Home, Calendar, Droplets, Moon, Smile, Utensils, Music, MessageCircle, Car, Book, Camera, Sun } from 'lucide-react';

export interface Mission {
  id: string;
  title: string;
  description: string;
  icon: any;
  points: number;
  isCompleted: boolean;
  category: 'care' | 'support' | 'surprise';
  difficulty: 'easy' | 'medium' | 'hard';
}

// Large pool of missions to generate from
const MISSION_POOL: Omit<Mission, 'isCompleted'>[] = [
  // Care missions
  { id: 'care-1', title: tr("usepartnermissions_seher_cay_hazirla_c940df", "Səhər çay hazırla"), description: tr("usepartnermissions_zencefilli_cay_urekbulanmaya_komek_edir_52233b", "Zəncəfilli çay ürəkbulanmaya kömək edir"), icon: Coffee, points: 10, category: 'care', difficulty: 'easy' },
  { id: 'care-2', title: tr("usepartnermissions_ayaq_masaji_et_df5daf", "Ayaq masajı et"), description: tr("usepartnermissions_axsam_15_deqiqe_rahatlatici_masaj_5333e1", "Axşam 15 dəqiqə rahatlatıcı masaj"), icon: Heart, points: 20, category: 'care', difficulty: 'medium' },
  { id: 'care-3', title: tr("usepartnermissions_ev_islerini_et_140314", "Ev işlərini et"), description: tr("usepartnermissions_yemek_hazirla_temizlik_et_f122e4", "Yemək hazırla, təmizlik et"), icon: Home, points: 15, category: 'care', difficulty: 'easy' },
  { id: 'care-4', title: tr("usepartnermissions_gezintiye_cixar_f03c3b", "Gəzintiyə çıxar"), description: tr("usepartnermissions_birlikde_aciq_havada_gezin_6fd473", "Birlikdə açıq havada gəzin"), icon: Calendar, points: 15, category: 'care', difficulty: 'easy' },
  { id: 'care-5', title: tr("usepartnermissions_su_icmesini_xatirlat_bb4543", "Su içməsini xatırlat"), description: tr("usepartnermissions_gun_erzinde_8_stekan_su_0ca58e", "Gün ərzində 8 stəkan su"), icon: Droplets, points: 10, category: 'care', difficulty: 'easy' },
  { id: 'care-6', title: tr("usepartnermissions_yuxuya_hazirla_e9214a", "Yuxuya hazırla"), description: tr("usepartnermissions_yatmadan_evvel_rahat_muhit_yarat_b1d28e", "Yatmadan əvvəl rahat mühit yarat"), icon: Moon, points: 15, category: 'care', difficulty: 'easy' },
  { id: 'care-7', title: tr("usepartnermissions_gulumset_63f97b", "Gülümsət"), description: tr("usepartnermissions_zarafat_et_ehvalini_yaxsilasdir_f109e1", "Zarafat et, əhvalını yaxşılaşdır"), icon: Smile, points: 10, category: 'care', difficulty: 'easy' },
  { id: 'care-8', title: tr("usepartnermissions_saglam_yemek_hazirla_d06767", "Sağlam yemək hazırla"), description: tr("usepartnermissions_qida_deyeri_yuksek_yemek_bisir_0627e7", "Qida dəyəri yüksək yemək bişir"), icon: Utensils, points: 25, category: 'care', difficulty: 'medium' },
  { id: 'care-9', title: tr("usepartnermissions_mahni_dinlet_ccfd6c", "Mahnı dinlət"), description: tr("usepartnermissions_sevdiyi_mahnilari_ac_3f2905", "Sevdiyi mahnıları aç"), icon: Music, points: 10, category: 'care', difficulty: 'easy' },
  { id: 'care-10', title: tr("usepartnermissions_bel_masaji_et_0ffb9e", "Bel masajı et"), description: tr("usepartnermissions_bel_agrilarini_yungullesdir_8f62f7", "Bel ağrılarını yüngülləşdir"), icon: Heart, points: 20, category: 'care', difficulty: 'medium' },
  
  // Support missions
  { id: 'support-1', title: tr("usepartnermissions_hekim_vizitine_gotur_0349e4", "Həkim vizitinə götür"), description: tr("usepartnermissions_muayine_randevusuna_beraber_get_c8bf62", "Müayinə randevusuna bərabər get"), icon: Stethoscope, points: 25, category: 'support', difficulty: 'hard' },
  { id: 'support-2', title: tr("usepartnermissions_korpe_otagini_hazirla_765d3d", "Körpə otağını hazırla"), description: tr("usepartnermissions_mebel_yigmaqda_komek_et_809a01", "Mebel yığmaqda kömək et"), icon: Baby, points: 30, category: 'support', difficulty: 'hard' },
  { id: 'support-3', title: tr("usepartnermissions_alis_veris_komeyi_59264f", "Alış-veriş köməyi"), description: tr("usepartnermissions_lazimi_esyalari_birlikde_alin_66c242", "Lazımi əşyaları birlikdə alın"), icon: ShoppingCart, points: 20, category: 'support', difficulty: 'medium' },
  { id: 'support-4', title: tr("usepartnermissions_masini_hazirla_45bec7", "Maşını hazırla"), description: tr("usepartnermissions_xestexanaya_gedise_hazir_ol_ff31ff", "Xəstəxanaya gedişə hazır ol"), icon: Car, points: 15, category: 'support', difficulty: 'easy' },
  { id: 'support-5', title: tr("usepartnermissions_hamilelik_kitabi_oxu_e82419", "Hamiləlik kitabı oxu"), description: tr("usepartnermissions_birlikde_oyrenin_35983b", "Birlikdə öyrənin"), icon: Book, points: 20, category: 'support', difficulty: 'medium' },
  { id: 'support-6', title: tr("usepartnermissions_sekil_cek_28c0eb", "Şəkil çək"), description: tr("usepartnermissions_hamilelik_xatiresi_ucun_foto_478155", "Hamiləlik xatirəsi üçün foto"), icon: Camera, points: 15, category: 'support', difficulty: 'easy' },
  { id: 'support-7', title: tr("usepartnermissions_sabahki_plana_komek_et_673086", "Sabahkı plana kömək et"), description: tr("usepartnermissions_gundelik_islerde_destek_ol_748d32", "Gündəlik işlərdə dəstək ol"), icon: Sun, points: 15, category: 'support', difficulty: 'easy' },
  { id: 'support-8', title: tr("usepartnermissions_korpe_ile_danis_f8df8a", "Körpə ilə danış"), description: tr("usepartnermissions_qarina_danis_korpe_sesi_tanisin_3a983d", "Qarına danış, körpə səsi tanısın"), icon: Baby, points: 20, category: 'support', difficulty: 'medium' },
  
  // Surprise missions
  { id: 'surprise-1', title: tr("usepartnermissions_gul_getir_cec2ba", "Gül gətir"), description: tr("usepartnermissions_onu_surpriz_etmek_ucun_cicek_al_e8d64e", "Onu sürpriz etmək üçün çiçək al"), icon: Flower2, points: 15, category: 'surprise', difficulty: 'easy' },
  { id: 'surprise-2', title: tr("usepartnermissions_romantik_sam_yemeyi_5e523d", "Romantik şam yeməyi"), description: tr("usepartnermissions_evde_xususi_axsam_kecirin_43c91e", "Evdə xüsusi axşam keçirin"), icon: Star, points: 25, category: 'surprise', difficulty: 'medium' },
  { id: 'surprise-3', title: tr("usepartnermissions_surpriz_hediyye_al_a056ae", "Sürpriz hədiyyə al"), description: tr("usepartnermissions_xususi_bir_hediyye_ile_sevindir_359686", "Xüsusi bir hədiyyə ilə sevindir"), icon: Gift, points: 30, category: 'surprise', difficulty: 'hard' },
  { id: 'surprise-4', title: tr("usepartnermissions_sevgi_mesaji_gonder_ba5dd7", "Sevgi mesajı göndər"), description: tr("usepartnermissions_gozlenilmeden_urek_mesaji_yaz_441107", "Gözlənilmədən ürək mesajı yaz"), icon: MessageCircle, points: 10, category: 'surprise', difficulty: 'easy' },
  { id: 'surprise-5', title: tr("usepartnermissions_sirniyyat_getir_9f18ab", "Şirniyyat gətir"), description: tr("usepartnermissions_sevdiyi_sirniyyati_al_76ae0b", "Sevdiyi şirniyyatı al"), icon: Coffee, points: 15, category: 'surprise', difficulty: 'easy' },
  { id: 'surprise-6', title: tr("usepartnermissions_film_gecesi_planla_a3cd04", "Film gecəsi planla"), description: tr("usepartnermissions_sevimli_filmlerle_rahat_axsam_785849", "Sevimli filmlərlə rahat axşam"), icon: Star, points: 20, category: 'surprise', difficulty: 'medium' },
];

// Function to get daily seed based on date
const getDailySeed = (): number => {
  const today = new Date();
  return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
};

// Seeded random function
const seededRandom = (seed: number): () => number => {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
};

// Shuffle array with seed
const shuffleArray = <T,>(array: T[], random: () => number): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Generate daily missions based on date seed
const generateDailyMissions = (): Omit<Mission, 'isCompleted'>[] => {
  const seed = getDailySeed();
  const random = seededRandom(seed);

  // Shuffle the mission pool
  const shuffled = shuffleArray(MISSION_POOL, random);

  // Pick missions ensuring variety
  const careMissions = shuffled.filter(m => m.category === 'care').slice(0, 3);
  const supportMissions = shuffled.filter(m => m.category === 'support').slice(0, 2);
  const surpriseMissions = shuffled.filter(m => m.category === 'surprise').slice(0, 2);

  // Combine and add daily IDs
  return [...careMissions, ...supportMissions, ...surpriseMissions].map((m, i) => ({
    ...m,
    id: `daily-${seed}-${i}`,
  }));
};

export const usePartnerMissions = () => {
  const { user } = useAuth();
  const [completedMissionIds, setCompletedMissionIds] = useState<Set<string>>(new Set());
  const [dbPoints, setDbPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  // Generate daily missions (same for all users each day)
  const dailyMissions = generateDailyMissions();

  // Build missions with completion state
  const missions: Mission[] = dailyMissions.map(m => ({
    ...m,
    isCompleted: completedMissionIds.has(m.id),
  }));

  const fetchMissionState = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('partner_missions')
        .select('mission_id, is_completed, points_earned')
        .eq('user_id', user.id);

      if (error) throw error;

      // Get completed mission IDs
      const completedIds = new Set(
        (data || []).filter(m => m.is_completed).map(m => m.mission_id)
      );
      setCompletedMissionIds(completedIds);

      // Calculate total points from DB
      const totalFromDb = (data || []).reduce((sum, m) => sum + (m.points_earned || 0), 0);
      setDbPoints(totalFromDb);
    } catch (err) {
      console.error('Error fetching missions:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMissionState();
  }, [fetchMissionState]);

  const toggleMission = async (missionId: string, missionPoints?: number): Promise<{ pointsEarned: number; completed: boolean } | null> => {
    if (!user) return null;

    const currentlyCompleted = completedMissionIds.has(missionId);
    const newCompleted = !currentlyCompleted;
    const points = missionPoints || dailyMissions.find(m => m.id === missionId)?.points || 10;

    try {
      // Optimistically update UI
      setCompletedMissionIds(prev => {
        const next = new Set(prev);
        if (newCompleted) {
          next.add(missionId);
        } else {
          next.delete(missionId);
        }
        return next;
      });

      if (newCompleted) {
        setDbPoints(prev => prev + points);
      } else {
        setDbPoints(prev => Math.max(0, prev - points));
      }

      // Upsert to database
      const { error } = await supabase
        .from('partner_missions')
        .upsert({
          user_id: user.id,
          mission_id: missionId,
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
          points_earned: newCompleted ? points : 0,
        }, {
          onConflict: 'user_id,mission_id'
        });

      if (error) throw error;

      return { pointsEarned: newCompleted ? points : 0, completed: newCompleted };
    } catch (err) {
      console.error('Error toggling mission:', err);
      // Revert on error
      setCompletedMissionIds(prev => {
        const next = new Set(prev);
        if (currentlyCompleted) {
          next.add(missionId);
        } else {
          next.delete(missionId);
        }
        return next;
      });
      if (newCompleted) {
        setDbPoints(prev => Math.max(0, prev - points));
      } else {
        setDbPoints(prev => prev + points);
      }
      return null;
    }
  };

  // Calculate level from total DB points
  const totalPoints = dbPoints;
  const level = Math.floor(totalPoints / 50) + 1;
  const pointsToNextLevel = 50 - (totalPoints % 50);
  const levelProgress = ((totalPoints % 50) / 50) * 100;
  const completedCount = completedMissionIds.size;

  return {
    missions,
    loading,
    toggleMission,
    totalPoints,
    level,
    pointsToNextLevel,
    levelProgress,
    completedCount,
    refetch: fetchMissionState,
  };
};

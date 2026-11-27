import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useUserStore } from '@/store/userStore';
import { Coffee, Heart, Flower2, Stethoscope, Baby, Gift, Star, ShoppingCart, Home, Calendar, Droplets, Moon, Smile, Utensils, Music, MessageCircle, Car, Book, Camera, Sun, Briefcase, Phone, Pill, Footprints } from 'lucide-react';
import { dailyMissionId, pickDailyMissions, usePartnerMissionText, type MissionIcon, type MissionStageInput } from '@/data/partner-missions';

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

const ICONS: Record<MissionIcon, any> = {
  coffee: Coffee, heart: Heart, home: Home, calendar: Calendar, droplets: Droplets, moon: Moon, smile: Smile,
  utensils: Utensils, music: Music, stethoscope: Stethoscope, baby: Baby, cart: ShoppingCart, car: Car, book: Book,
  camera: Camera, sun: Sun, gift: Gift, flower: Flower2, star: Star, message: MessageCircle, bag: Briefcase,
  phone: Phone, pill: Pill, footprints: Footprints,
};

/** Missions follow the woman's stage; without a stage only the general pool is used. */
export const usePartnerMissions = (stage: MissionStageInput = {}) => {
  const { user } = useAuth();
  const language = useUserStore((s) => s.language) || 'az';
  const text = usePartnerMissionText(language);
  const [completedMissionIds, setCompletedMissionIds] = useState<Set<string>>(new Set());
  const [dbPoints, setDbPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const { lifeStage, pregnancyWeek, babyAgeDays } = stage;
  const dailyMissions = useMemo(() => pickDailyMissions({ lifeStage, pregnancyWeek, babyAgeDays }).map((def) => ({
    id: dailyMissionId(def.key),
    title: text?.[def.key]?.[0] ?? '',
    description: text?.[def.key]?.[1] ?? '',
    icon: ICONS[def.icon],
    points: def.points,
    category: def.category,
    difficulty: def.difficulty,
  })), [lifeStage, pregnancyWeek, babyAgeDays, text]);

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
    loading: loading || !text,
    toggleMission,
    totalPoints,
    level,
    pointsToNextLevel,
    levelProgress,
    completedCount,
    refetch: fetchMissionState,
  };
};

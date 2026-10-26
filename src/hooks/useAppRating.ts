import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Capacitor } from '@capacitor/core';

interface AppRatingState {
  shouldShowPrompt: boolean;
  loading: boolean;
  recordAction: (action: 'later' | 'rated' | 'never') => Promise<void>;
}

const USAGE_COUNT_KEY = 'anacan_app_usage_count';
const RATING_DONE_KEY = 'anacan_rating_done';

export const useAppRating = (): AppRatingState => {
  const { user } = useAuth();
  const [shouldShowPrompt, setShouldShowPrompt] = useState(false);
  const [loading, setLoading] = useState(true);

  const getPlatform = (): string => {
    if (Capacitor.isNativePlatform()) {
      return Capacitor.getPlatform();
    }
    return 'web';
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Check if already rated
    const ratingDone = localStorage.getItem(RATING_DONE_KEY);
    if (ratingDone === 'true') {
      setLoading(false);
      return;
    }

    // Track usage count
    const currentCount = parseInt(localStorage.getItem(USAGE_COUNT_KEY) || '0', 10) + 1;
    localStorage.setItem(USAGE_COUNT_KEY, String(currentCount));

    // Show on 3rd usage
    if (currentCount >= 3) {
      // Check DB if already rated
      const checkDb = async () => {
        try {
          const { data } = await supabase
            .from('app_rating_prompts')
            .select('last_action')
            .eq('user_id', user.id)
            .single();

          if (data?.last_action === 'rated' || data?.last_action === 'never') {
            localStorage.setItem(RATING_DONE_KEY, 'true');
            setLoading(false);
            return;
          }
          setShouldShowPrompt(true);
        } catch {
          setShouldShowPrompt(true);
        }
        setLoading(false);
      };
      checkDb();
    } else {
      setLoading(false);
    }
  }, [user]);

  const recordAction = useCallback(async (action: 'later' | 'rated' | 'never') => {
    if (!user) return;

    try {
      const platform = getPlatform();
      const now = new Date().toISOString();

      const { data: existing } = await supabase
        .from('app_rating_prompts')
        .select('id, show_count')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        await supabase
          .from('app_rating_prompts')
          .update({
            last_action: action,
            last_shown_at: now,
            show_count: (existing.show_count || 1) + 1,
            rated_at: action === 'rated' ? now : null,
            platform,
            updated_at: now
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('app_rating_prompts')
          .insert({
            user_id: user.id,
            last_action: action,
            platform,
            rated_at: action === 'rated' ? now : null
          });
      }

      if (action === 'rated' || action === 'never') {
        localStorage.setItem(RATING_DONE_KEY, 'true');
      }

      setShouldShowPrompt(false);
    } catch (error) {
      console.error('Error recording rating action:', error);
    }
  }, [user]);

  return {
    shouldShowPrompt,
    loading,
    recordAction,
  };
};

export const openAppStore = () => {
  const platform = Capacitor.getPlatform();

  if (platform === 'ios') {
    // Real App Store ID (əvvəl placeholder id123456789 idi → 404 verirdi).
    // ?action=write-review birbaşa rəy pəncərəsini açır.
    // Link locale-dən asılı deyil — istifadəçinin öz App Store dili açılır.
    window.open('https://apps.apple.com/app/id6745406124?action=write-review', '_blank');
  } else if (platform === 'android') {
    window.open('https://play.google.com/store/apps/details?id=com.atlasoon.anacan', '_blank');
  }
};

/**
 * Rəsmi native in-app review dialoqu (SKStoreReviewController / Play In-App Review).
 * Guideline-friendly: istifadəçi tətbiqdən çıxmadan qiymətləndirir → konversiya yüksək.
 * OS kvota qoyur (iOS ~3 dəfə/il) — dialoq göstərilməsə də xəta atmır.
 * true = sorğu OS-ə ötürüldü; false = plugin yoxdur/xəta → link fallback istifadə edin.
 */
export const requestNativeReview = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { InAppReview } = await import('@capacitor-community/in-app-review');
    await InAppReview.requestReview();
    return true;
  } catch (e) {
    console.warn('Native in-app review unavailable:', e);
    return false;
  }
};

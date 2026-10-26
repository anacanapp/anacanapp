import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAppSetting } from './useAppSettings';
import { readCache, writeCache } from '@/lib/offlineCache';
import { usePremiumEntitlement } from './usePremiumEntitlement';

const SUBSCRIPTION_CACHE = 'subscription';
const HOUSEHOLD_PREMIUM_CACHE = 'household_premium';

interface Subscription {
  id: string;
  user_id: string;
  plan_type: 'free' | 'premium' | 'premium_plus';
  status: 'active' | 'cancelled' | 'expired';
  started_at: string;
  expires_at: string | null;
  updated_at?: string;
  is_trial?: boolean;
  cancelled_at?: string | null;
}

/** Gündəlik say limiti olan feature-lər (usage_tracking.feature_type) */
export type DailyFeature =
  'ai_chat' | 'cry_translator' | 'poop_scanner' | 'fairy_tale' | 'horoscope' | 'baby_insight';

type UsageFeatureType = 'white_noise' | 'baby_photoshoot' | DailyFeature;

interface UsageTracking {
  id: string;
  user_id: string;
  feature_type: UsageFeatureType;
  usage_date: string;
  usage_count: number;
  usage_seconds: number;
}

// Fallback free tier limits (used if DB setting not available)
const DEFAULT_FREE_LIMITS = {
  white_noise_seconds_per_day: 20 * 60,
  baby_photoshoot_count: 3,
  fairy_tale_count_per_day: 3,
  ai_chat_count_per_day: 10,
  cry_translator_count_per_day: 3,
  poop_scanner_count_per_day: 3,
  horoscope_count_per_day: 2,
  baby_insight_count_per_day: 2,
};

const DAILY_LIMIT_KEYS: Record<DailyFeature, keyof typeof DEFAULT_FREE_LIMITS> = {
  ai_chat: 'ai_chat_count_per_day',
  cry_translator: 'cry_translator_count_per_day',
  poop_scanner: 'poop_scanner_count_per_day',
  fairy_tale: 'fairy_tale_count_per_day',
  horoscope: 'horoscope_count_per_day',
  baby_insight: 'baby_insight_count_per_day',
};

export function useSubscription() {
  const access = usePremiumEntitlement();
  const { user, profile: authProfile } = useAuth();
  const userId = user?.id ?? null;
  const profile = authProfile?.user_id === userId ? authProfile : null;
  const linkedPartnerId = profile?.linked_partner_id ?? null;
  const today = new Date().toISOString().split('T')[0];
  const householdCacheKey = `${HOUSEHOLD_PREMIUM_CACHE}:${linkedPartnerId}`;

  // Read free limits from DB (app_settings -> free_limits)
  const dbFreeLimits = useAppSetting('free_limits');
  
  const freeLimits = useMemo(() => {
    if (dbFreeLimits && typeof dbFreeLimits === 'object') {
      return { ...DEFAULT_FREE_LIMITS, ...dbFreeLimits };
    }
    return DEFAULT_FREE_LIMITS;
  }, [dbFreeLimits]);

  const subscriptionQuery = useQuery({
    queryKey: ['subscription', userId],
    enabled: !!userId,
    staleTime: 30_000,
    retry: false,
    networkMode: 'always',
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      const subscription = data as Subscription | null;
      // A confirmed missing row must also clear the previous offline entitlement.
      writeCache(SUBSCRIPTION_CACHE, userId, subscription);
      return subscription;
    },
  });

  const usageQuery = useQuery({
    queryKey: ['subscription-usage', userId, today],
    enabled: !!userId,
    staleTime: 30_000,
    retry: false,
    networkMode: 'always',
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .eq('usage_date', today);

      if (error) throw error;
      return (data ?? []) as UsageTracking[];
    },
  });

  const householdQuery = useQuery({
    queryKey: ['household-premium', userId, linkedPartnerId],
    enabled: !!userId && !!linkedPartnerId,
    staleTime: 30_000,
    retry: false,
    networkMode: 'always',
    queryFn: async () => {
      if (!userId || !linkedPartnerId) return false;
      const { data, error } = await (supabase.rpc as any)('get_linked_partner_premium');
      if (error) throw error;
      writeCache(householdCacheKey, userId, data === true);
      return data === true;
    },
  });

  // Keep query errors visible; reading offline data must not renew its cache lifetime.
  const subscription = subscriptionQuery.isError && userId
    ? readCache<Subscription>(SUBSCRIPTION_CACHE, userId)
    : subscriptionQuery.data ?? null;
  const usage = usageQuery.data;
  const householdPremium = access.householdPremium;
  const loading = !!userId && (subscriptionQuery.isLoading || usageQuery.isLoading || householdQuery.isLoading);

  const { refetch: refetchSubscription } = subscriptionQuery;
  const { refetch: refetchUsage } = usageQuery;
  const { refetch: refetchHousehold } = householdQuery;
  const refreshAccess = access.refresh;
  const fetchSubscription = useCallback(async (): Promise<void> => {
    if (!userId) return;
    await Promise.all([
      refetchSubscription({ cancelRefetch: false }),
      refetchUsage({ cancelRefetch: false }),
      refreshAccess({ cancelRefetch: false }),
      ...(linkedPartnerId ? [refetchHousehold({ cancelRefetch: false })] : []),
    ]);
  }, [userId, linkedPartnerId, refetchSubscription, refetchUsage, refetchHousehold, refreshAccess]);

  // Only the bounded, current server grant authorizes paid access.
  const ownPremium = access.ownPremium;

  // Household: linked partnyorun premiumu da sayılır
  const isPremium = ownPremium || householdPremium;

  const isCancelled = subscription?.status === 'cancelled';
  const cancelledButActive = isCancelled && ownPremium;

  const getUsageForFeature = useCallback(
    (featureType: UsageFeatureType): UsageTracking | undefined => {
      return usage?.find(u => u.feature_type === featureType);
    },
    [usage]
  );

  /**
   * Gündəlik say limiti: yoxla və İSTİFADƏ ET (premium → limitsiz).
   * usage_tracking-də (user_id, feature_type, usage_date) UNIQUE olduğundan
   * upsert təhlükəsizdir. İcazə yoxdursa sayğac artırılmır.
   */
  const checkAndConsume = useCallback(async (
    feature: DailyFeature
  ): Promise<{ allowed: boolean; remaining: number; limit: number }> => {
    const limit = Number(freeLimits[DAILY_LIMIT_KEYS[feature]] ?? 0);
    if (isPremium) return { allowed: true, remaining: Infinity, limit };
    if (!userId) return { allowed: false, remaining: 0, limit };

    const today = new Date().toISOString().split('T')[0];
    try {
      const { data: row } = await supabase
        .from('usage_tracking')
        .select('id, usage_count')
        .eq('user_id', userId)
        .eq('feature_type', feature)
        .eq('usage_date', today)
        .maybeSingle();

      const used = row?.usage_count || 0;
      if (used >= limit) return { allowed: false, remaining: 0, limit };

      if (row) {
        await supabase.from('usage_tracking').update({ usage_count: used + 1 }).eq('id', row.id);
      } else {
        await supabase.from('usage_tracking').upsert({
          user_id: userId,
          feature_type: feature,
          usage_date: today,
          usage_count: 1,
        }, { onConflict: 'user_id,feature_type,usage_date' });
      }
      return { allowed: true, remaining: Math.max(0, limit - used - 1), limit };
    } catch (e) {
      // Şəbəkə xətasında istifadəçini bloklamırıq (limit "best effort"-dur)
      console.error('checkAndConsume failed:', e);
      return { allowed: true, remaining: 0, limit };
    }
  }, [isPremium, userId, freeLimits]);

  /** Gündəlik limitdən nə qədər qalıb — YALNIZ oxuyur (UI sayğacları üçün). */
  const peekRemainingDaily = useCallback(async (
    feature: DailyFeature
  ): Promise<{ remaining: number; limit: number }> => {
    const limit = Number(freeLimits[DAILY_LIMIT_KEYS[feature]] ?? 0);
    if (isPremium) return { remaining: Infinity, limit };
    if (!userId) return { remaining: 0, limit };
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data: row } = await supabase
        .from('usage_tracking')
        .select('usage_count')
        .eq('user_id', userId)
        .eq('feature_type', feature)
        .eq('usage_date', today)
        .maybeSingle();
      return { remaining: Math.max(0, limit - (row?.usage_count || 0)), limit };
    } catch {
      return { remaining: limit, limit };
    }
  }, [isPremium, userId, freeLimits]);

  const canUseWhiteNoise = useCallback((): { allowed: boolean; remainingSeconds: number } => {
    if (isPremium) {
      return { allowed: true, remainingSeconds: Infinity };
    }

    const whiteNoiseUsage = getUsageForFeature('white_noise');
    const usedSeconds = whiteNoiseUsage?.usage_seconds || 0;
    const remaining = freeLimits.white_noise_seconds_per_day - usedSeconds;

    return {
      allowed: remaining > 0,
      remainingSeconds: Math.max(0, remaining),
    };
  }, [getUsageForFeature, isPremium, freeLimits]);

  const canUseBabyPhotoshoot = useCallback(async (): Promise<{ allowed: boolean; remainingCount: number }> => {
    if (isPremium) {
      return { allowed: true, remainingCount: Infinity };
    }

    if (!userId) {
      return { allowed: false, remainingCount: 0 };
    }

    const { count } = await supabase
      .from('baby_photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const totalPhotos = count || 0;
    const remaining = freeLimits.baby_photoshoot_count - totalPhotos;

    return {
      allowed: remaining > 0,
      remainingCount: Math.max(0, remaining),
    };
  }, [isPremium, userId, freeLimits]);

  const trackWhiteNoiseUsage = useCallback(async (seconds: number) => {
    if (!userId || isPremium) return;

    const today = new Date().toISOString().split('T')[0];
    const existingUsage = getUsageForFeature('white_noise');

    if (existingUsage) {
      await supabase
        .from('usage_tracking')
        .update({ usage_seconds: existingUsage.usage_seconds + seconds })
        .eq('id', existingUsage.id);
    } else {
      await supabase
        .from('usage_tracking')
        .insert({
          user_id: userId,
          feature_type: 'white_noise',
          usage_date: today,
          usage_seconds: seconds,
        });
    }

    await refetchUsage({ cancelRefetch: false });
  }, [refetchUsage, getUsageForFeature, isPremium, userId]);

  // !!! DEPRECATED (Duzelis33 təhlükəsizlik düzəlişi) !!!
  // Əvvəllər bu 2 funksiya subscriptions.status-u BİRBAŞA DB-də dəyişirdi —
  // real Store/RevenueCat vəziyyətinə heç toxunmadan. Nəticədə:
  //  - "Cancel" — Google Play/App Store-da abunəlik REAL olaraq davam edir,
  //    istifadəçi ödənişi almağa davam edir, amma tətbiq "ləğv edilib" göstərir.
  //  - "Restore" — heç bir yoxlama olmadan statusu "active"-ə qaytarırdı.
  // subscriptions cədvəli artıq client-tərəfi yazıla bilmir (RLS, Duzelis33).
  // Doğru axın: BillingScreen.tsx Android-də Play Store-un abunəlik idarəetmə
  // səhifəsinə yönləndirir (real ləğv), iOS-da RC Customer Center (artıq belə
  // idi), "Restore" isə useInAppPurchase().restorePurchases()-i çağırır (real
  // RC restore + server-side sync-revenuecat-entitlement). Bu 2 funksiya heç
  // yerdən çağırılmır, saxlanılıb ki tarixçə/kontekst itməsin.
  const cancelSubscription = useCallback(async (): Promise<boolean> => {
    console.warn('cancelSubscription() deprecated — see BillingScreen.tsx Play Store deep-link / RC Customer Center');
    return false;
  }, []);

  const restoreSubscription = useCallback(async (): Promise<boolean> => {
    console.warn('restoreSubscription() deprecated — use useInAppPurchase().restorePurchases() instead');
    return false;
  }, []);

  const upgradeToPremium = () => {
    return {
      showUpgradeModal: true,
      monthlyPrice: 3.99,
      yearlyPrice: 29.99,
    };
  };

  return {
    subscription,
    isPremium,
    ownPremium,
    householdPremium,
    entitlementReady: access.ready,
    isCancelled,
    cancelledButActive,
    loading: loading || access.loading,
    canUseWhiteNoise,
    canUseBabyPhotoshoot,
    trackWhiteNoiseUsage,
    checkAndConsume,
    peekRemainingDaily,
    cancelSubscription,
    restoreSubscription,
    upgradeToPremium,
    refetch: fetchSubscription,
    freeLimits,
  };
}

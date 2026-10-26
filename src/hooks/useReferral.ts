import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { tr } from '@/lib/tr';

/**
 * Referral proqramı (konversiya-əsaslı):
 *  - kod + redeem
 *  - dəvət edilənlərin DETALLI siyahısı (ad, status: qeydiyyat/trial/premium, mükafat)
 *  - statistika: dəvət sayı, trial sayı, premium sayı, qazanılan günlər
 * Migrasiya tətbiq olunmayıbsa qəzasız (boş qaytarır).
 */

export type ReferralStatus = 'registered' | 'trial' | 'converted';

export interface ReferredUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  status: ReferralStatus;
  /** Hazırda premium görünür (public_profile_cards.is_premium) */
  isPremiumNow: boolean;
  createdAt: string;
  convertedAt: string | null;
  /** Bu dəvətə görə +7 gün verilib? */
  rewarded: boolean;
  rewardDays: number;
}

export interface ReferralStats {
  invitedCount: number;
  trialCount: number;
  premiumCount: number;
  earnedDays: number;
  redeemedAlready: boolean;
}

export const useReferral = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const codeQuery = useQuery({
    queryKey: ['referral-code', user?.id],
    queryFn: async (): Promise<string | null> => {
      try {
        const { data, error } = await (supabase.rpc as any)('get_or_create_referral_code');
        if (error) throw error;
        return (data as string) || null;
      } catch (e) {
        console.warn('referral code unavailable:', e);
        return null;
      }
    },
    enabled: !!user,
    staleTime: Infinity
  });

  const detailsQuery = useQuery({
    queryKey: ['referral-details', user?.id],
    queryFn: async (): Promise<{referred: ReferredUser[];redeemedAlready: boolean;}> => {
      try {
        const [{ data: rows }, { data: asReferred }] = await Promise.all([
        (supabase as any).
        from('referrals').
        select('id, referred_user_id, status, reward_days, converted_at, referrer_rewarded_at, created_at').
        eq('referrer_user_id', user!.id).
        order('created_at', { ascending: false }),
        (supabase as any).
        from('referrals').
        select('id').
        eq('referred_user_id', user!.id).
        maybeSingle()]
        );

        const list = (rows as any[]) || [];

        // Adlar/premium statusu — public profil kartlarından (tək batch)
        const cardMap = new Map<string, any>();
        if (list.length > 0) {
          const { data: cards } = await (supabase as any).
          from('public_profile_cards').
          select('user_id, name, avatar_url, is_premium').
          in('user_id', list.map((r) => r.referred_user_id));
          (cards as any[] || []).forEach((c) => cardMap.set(c.user_id, c));
        }

        const referred: ReferredUser[] = list.map((r) => {
          const card = cardMap.get(r.referred_user_id);
          return {
            id: r.id,
            name: card?.name || tr("usecommunity_i_stifadeci_b6bdd6", "İstifadəçi"),
            avatarUrl: card?.avatar_url || null,
            status: (r.status || 'registered') as ReferralStatus,
            isPremiumNow: !!card?.is_premium,
            createdAt: r.created_at,
            convertedAt: r.converted_at,
            rewarded: !!r.referrer_rewarded_at,
            rewardDays: r.reward_days || 7
          };
        });

        return { referred, redeemedAlready: !!asReferred };
      } catch {
        return { referred: [], redeemedAlready: false };
      }
    },
    enabled: !!user
  });

  const referred = detailsQuery.data?.referred ?? [];
  const stats: ReferralStats = {
    invitedCount: referred.length,
    trialCount: referred.filter((r) => r.status === 'trial').length,
    premiumCount: referred.filter((r) => r.status === 'converted').length,
    earnedDays: referred.filter((r) => r.rewarded).reduce((s, r) => s + r.rewardDays, 0),
    redeemedAlready: detailsQuery.data?.redeemedAlready ?? false
  };

  const redeemMutation = useMutation({
    mutationFn: async (code: string): Promise<{success: boolean;error?: string;rewardDays?: number;}> => {
      const { data, error } = await (supabase.rpc as any)('redeem_referral_code', { p_code: code });
      if (error) throw error;
      const res = data as any;
      return { success: !!res?.success, error: res?.error, rewardDays: res?.reward_days };
    },
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['referral-details'] });
        // Qeyd: dəvət olunana bonus verilmir — profil yeniləməyə ehtiyac yoxdur
      }
    }
  });

  return {
    code: codeQuery.data ?? null,
    codeLoading: codeQuery.isLoading,
    referred,
    stats,
    redeem: redeemMutation.mutateAsync,
    redeeming: redeemMutation.isPending
  };
};

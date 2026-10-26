import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CancellationReasonCode =
  | 'too_expensive'
  | 'not_using_enough'
  | 'missing_features'
  | 'technical_issues'
  | 'found_alternative'
  | 'temporary_break'
  | 'other';

interface SubmitCancellationReasonParams {
  reasonCode: CancellationReasonCode;
  reasonText?: string | null;
  planType?: string | null;
  wasTrial?: boolean;
}

/**
 * İstifadəçi Premium/free trial-ı ləğv etməzdən ƏVVƏL göstərilən popup-un
 * seçdiyi səbəbi qeyd edir (bax CancellationReasonDialog.tsx,
 * BillingScreen.tsx). `cancel_flow: 'in_app'` — RevenueCat webhook-un özünün
 * ayrıca qeyd etdiyi mağaza-tərəfi səbəbdən (`cancel_flow: 'store_reported'`,
 * bax supabase/functions/revenuecat-webhook/index.ts) FƏRQLƏNDİRİLİR ki, admin
 * panelində iki fərqli siqnal qarışdırılmasın.
 */
export const useSubmitCancellationReason = () => {
  return useMutation({
    mutationFn: async ({ reasonCode, reasonText, planType, wasTrial }: SubmitCancellationReasonParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // DİQQƏT: 'subscription_cancellations' hələ generated types.ts-də yoxdur
      // (Duzelis51.sql tətbiq olunana/tiplər yenilənənə qədər) — story_replies-də
      // olduğu kimi `as any` ilə keçici həll (bax useStoryReplies.ts).
      const { error } = await supabase.from('subscription_cancellations' as any).insert({
        user_id: user.id,
        reason_code: reasonCode,
        reason_text: reasonText?.trim() || null,
        plan_type: planType || null,
        was_trial: wasTrial || false,
        cancel_flow: 'in_app',
      });

      if (error) throw error;
    },
  });
};

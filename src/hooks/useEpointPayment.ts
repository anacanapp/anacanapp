import { tr } from "@/lib/tr";import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig, isAzureBackend } from '@/integrations/supabase/backend-config';
import { useAuthContext } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { epointErrorMessage, epointFunctionUrl } from '@/lib/epoint';

interface PaymentRequest {
  amount: number;
  orderType: 'cake' | 'shop' | 'album' | 'premium' | 'general';
  orderReferenceId?: string;
  description?: string;
  successUrl?: string;
  errorUrl?: string;
}

interface PaymentResponse {
  success: boolean;
  redirectUrl?: string;
  transactionId?: string;
  orderId?: string;
  error?: string;
}

export const useEpointPayment = () => {
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(false);

  const initiatePayment = async (request: PaymentRequest): Promise<PaymentResponse> => {
    if (!user?.id) {
      toast.error(tr("useepointpayment_odenis_ucun_daxil_olmalisiniz_6709e1", "\xD6d\u0259ni\u015F \xFC\xE7\xFCn daxil olmal\u0131s\u0131n\u0131z"));
      return { success: false, error: 'Not authenticated' };
    }

    setLoading(true);
    try {
      if (isAzureBackend() && !['shop', 'cake', 'album'].includes(request.orderType)) {
        toast.error(epointErrorMessage('unsupported_order_type'));
        return { success: false, error: 'unsupported_order_type' };
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (sessionError || !token) {
        toast.error(tr('useepointpayment_odenis_ucun_daxil_olmalisiniz_6709e1', 'Ödəniş üçün daxil olmalısınız'));
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(epointFunctionUrl('create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': getBackendConfig().publishableKey
        },
        body: JSON.stringify({
          amount: request.amount,
          orderType: request.orderType,
          orderReferenceId: request.orderReferenceId,
          description: request.description,
          successUrl: request.successUrl || `${window.location.origin}/payment/success`,
          errorUrl: request.errorUrl || `${window.location.origin}/payment/error`
        })
      });

      const result = await response.json();

      if (response.ok && result.success === true && typeof result.redirectUrl === 'string') {
        const redirect = new URL(result.redirectUrl);
        if (redirect.protocol !== 'https:' || redirect.username || redirect.password || redirect.port
          || (redirect.hostname !== 'epoint.az' && !redirect.hostname.endsWith('.epoint.az'))) {
          throw new Error('invalid_payment_redirect');
        }
        // Redirect to Epoint payment page
        window.location.href = redirect.href;
        return result;
      } else {
        const code = typeof result.error === 'string' ? result.error : 'payment_status_unknown';
        toast.error(epointErrorMessage(code));
        return { success: false, error: code };
      }
    } catch {
      // A lost response can follow a successful provider request. Never auto-retry.
      toast.error(epointErrorMessage('payment_status_unknown'));
      return { success: false, error: 'payment_status_unknown' };
    } finally {
      setLoading(false);
    }
  };

  return { initiatePayment, loading };
};

export const usePaymentTransactions = (limit = 50) => {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['payment-transactions', user?.id, limit],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('payment_transactions').
      select('*').
      eq('user_id', user!.id).
      order('created_at', { ascending: false }).
      limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });
};

export const useAllPaymentTransactions = (limit = 100) => {
  return useQuery({
    queryKey: ['all-payment-transactions', limit],
    queryFn: async () => {
      const { data, error } = await supabase.
      from('payment_transactions').
      select('*').
      order('created_at', { ascending: false }).
      limit(limit);

      if (error) throw error;
      return data;
    }
  });
};

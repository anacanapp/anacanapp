import { tr } from '@/lib/tr';
import { getBackendConfig } from '@/integrations/supabase/backend-config';

export function epointFunctionUrl(action: 'create' | 'callback'): string {
  const backend = new URL(getBackendConfig().url);
  if (backend.protocol !== 'https:' || backend.username || backend.password || backend.search || backend.hash) {
    throw new Error('invalid_payment_backend');
  }
  return `${backend.href.replace(/\/+$/, '')}/functions/v1/epoint-payment?action=${action}`;
}

export function epointErrorMessage(code: string): string {
  if (['function_disabled', 'function_not_ready', 'provider_not_configured', 'payment_not_configured', 'payment_merchant_not_live'].includes(code)) {
    return tr('payment_temporarily_unavailable', 'Kartla ödəniş hazırda aktiv deyil. Sifarişiniz ödənilmiş sayılmır.');
  }
  if (['unsupported_order_type', 'order_reference_required'].includes(code)) {
    return tr('payment_order_unsupported', 'Bu sifariş üçün kartla ödəniş dəstəklənmir.');
  }
  if (['payment_contract_rejected', 'function_rejected', 'order_amount_mismatch', 'staff_quote_required'].includes(code)) {
    return tr('payment_order_needs_review', 'Sifarişin qiyməti və ödəniş vəziyyəti yoxlanmalıdır. Dəstək xidməti ilə əlaqə saxlayın.');
  }
  if (['payment_already_attempted_reconcile_before_retry', 'function_upstream_failed', 'upstream_unavailable', 'payment_provider_unavailable', 'payment_database_unavailable', 'payment_status_unknown'].includes(code)) {
    return tr('payment_status_needs_review', 'Ödənişin nəticəsi təsdiqlənmədi. Yenidən ödəməzdən əvvəl sifarişin vəziyyətini dəstək xidməti ilə yoxlayın.');
  }
  return tr('useepointpayment_odenis_baslatila_bilmedi_8e916c', 'Ödəniş başladıla bilmədi');
}

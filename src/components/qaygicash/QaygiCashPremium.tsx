import './qaygicash.css';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { invalidateQaygiCash, useQaygiCashWallet } from '@/hooks/useQaygiCash';
import { getPlatform } from '@/lib/revenuecat';
import { QC_BRAND, formatQc, formatQcDate, premiumEarnMinor, premiumRedeemOption, qcErrorCode, qcErrorKey, type QcPremiumPlan } from '@/lib/qaygicash';
import { qf, qk, qt } from '@/lib/qaygicash-copy';
import { QcCoin, qcTrack, useQcLanguage } from './QcParts';

/** Same roots the store purchase sync refreshes (useInAppPurchase.syncWithDatabase). */
const PREMIUM_ROOTS = new Set(['premium-access-v1', 'subscription', 'household-premium', 'community-feed', 'group-posts', 'post-comments', 'single-post',
  'user-posts', 'community-connections', 'public-profile', 'community-profile', 'community-profile-card', 'chat-authors-v2']);

/** "+1,34 ₼ QayğıCash" under a paywall plan (earned on the fixed base: yearly 26,99, monthly 3,99). */
export function QcPremiumEarnLine({ plan }: { plan: QcPremiumPlan }) {
  const { wallet } = useQaygiCashWallet();
  const language = useQcLanguage();
  const amount = premiumEarnMinor(wallet ?? undefined, plan);
  if (!wallet || amount <= 0) return null;
  const text = plan === 'yearly'
    ? qf('qc_prem_earn', { amount: formatQc(amount, language) })
    : qf('qc_prem_earn_renewal', { amount: formatQc(amount, language) });
  return <span className="qc-prem-line qc-num" data-testid={`qc-prem-earn-${plan}`}><QcCoin size="sm" />{text}</span>;
}

async function invokePremium(plan: QcPremiumPlan, platform: string): Promise<{ ok: true; expires_at: string | null } | { ok: false; code: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('qaygicash-premium', { body: { plan, platform } });
    if (!error && (data as { ok?: boolean } | null)?.ok === true) return { ok: true, expires_at: (data as { expires_at?: string }).expires_at ?? null };
    let body: unknown = data;
    try { body = await (error as { context?: { json?: () => Promise<unknown> } } | null)?.context?.json?.() ?? body; } catch { /* not JSON */ }
    return { ok: false, code: qcErrorCode(body) ?? qcErrorCode(error) };
  } catch (e) {
    return { ok: false, code: qcErrorCode(e) };
  }
}

/**
 * "Pay with QayğıCash (X ₼)" for one Premium plan. Hidden unless the server enables Premium with bonus,
 * this plan and this platform (all off by default). Confirms in an in-page sheet before spending.
 */
export function QaygiCashPremiumOption({ plan, onDone, style }: { plan: QcPremiumPlan; onDone?: () => void; style?: React.CSSProperties }) {
  const { wallet } = useQaygiCashWallet();
  const language = useQcLanguage();
  const { refreshProfile } = useAuth();
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const platform = getPlatform();
  const option = premiumRedeemOption(wallet ?? undefined, plan, platform);
  if (!wallet || !option) return null;
  const price = formatQc(option.price, language);
  const planLabel = qt(plan === 'yearly' ? 'qc_prem_plan_yearly' : 'qc_prem_plan_monthly');

  const pay = async () => {
    if (busy) return;
    setBusy(true);
    const result = await invokePremium(plan, platform);
    setBusy(false);
    setConfirming(false);
    void invalidateQaygiCash(client);
    if (result.ok === true) {
      qcTrack('qc_premium_redeem', { plan, platform, amount_minor: option.price, ok: true });
      try { await refreshProfile(); } catch { /* the entitlement query below still refreshes */ }
      void client.invalidateQueries({ predicate: ({ queryKey }) => PREMIUM_ROOTS.has(String(queryKey[0])) });
      toast.success(result.expires_at ? qf('qc_prem_success', { date: formatQcDate(result.expires_at, language) }) : planLabel);
      onDone?.();
    } else {
      const code = (result as { code: string | null }).code;
      qcTrack('qc_premium_redeem', { plan, platform, ok: false, error: code ?? 'unknown' });
      toast.error(qk(qcErrorKey(code)));
    }
  };

  return (
    <>
      <button type="button" className="qc-prem-opt" style={style} disabled={!option.affordable || busy} onClick={() => setConfirming(true)} data-testid={`qc-prem-pay-${plan}`}>
        <QcCoin />
        <span style={{ flex: 1, minWidth: 0 }}>
          <b>{qf('qc_prem_pay', { amount: price })}</b>
          <small className="qc-num">{option.affordable ? `${planLabel} · ${QC_BRAND} ${formatQc(wallet.available_minor, language)}` : qf('qc_prem_pay_need', { amount: price })}</small>
        </span>
      </button>
      {confirming && createPortal(
        <div className="a-scope qc-sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="qc-prem-confirm" onClick={() => !busy && setConfirming(false)}>
          <div className="qc-sheet" onClick={(e) => e.stopPropagation()}>
            <QcCoin size="lg" />
            <h2 id="qc-prem-confirm">{qt('qc_prem_confirm_title')}</h2>
            <p>{qf('qc_prem_confirm_text', { amount: price, plan: planLabel })}</p>
            <div className="qc-sheet-actions">
              <button type="button" className="a-btn-soft" onClick={() => setConfirming(false)} disabled={busy}>{qt('qc_cancel')}</button>
              <button type="button" className="a-btn-solid" onClick={() => void pay()} disabled={busy} data-testid="qc-prem-confirm">
                {busy ? <Loader2 size={16} className="animate-spin" /> : qt('qc_prem_confirm')}
              </button>
            </div>
          </div>
        </div>, document.body)}
    </>
  );
}

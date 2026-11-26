import { useEffect, useRef } from 'react';
import { CreditCard, Loader2, RefreshCw } from 'lucide-react';
import { useInAppEpoint, type EpointPlan, formatAzn } from '@/lib/in-app-epoint';
import { iepFormat, iepText } from '@/lib/in-app-epoint-copy';

/**
 * "Pay with an Azerbaijani card (Epoint)": a secondary option under the store purchase button of the app paywall.
 * Renders nothing unless app_settings.in_app_epoint allows the user's country and platform, card payments are live,
 * the server has a price for the selected plan and the user has no Premium (see src/lib/in-app-epoint.ts).
 * Prices are the server's (web-premium 'status'), in AZN. The consent line is what the server records as
 * 'premium-autorenew-v1' when the checkout starts.
 */
export default function EpointPayOption({ plan, source = 'paywall', onPremium, style }: {
  plan: EpointPlan | 'lifetime';
  /** Paywall placement for the funnel (same value as the store button's analytics source). */
  source?: string;
  /** Called once when Premium is confirmed after the payment. */
  onPremium?: () => void;
  style?: React.CSSProperties;
}) {
  const epoint = useInAppEpoint(source);
  const notified = useRef(false);
  useEffect(() => {
    if (epoint.status === 'success' && !notified.current) { notified.current = true; onPremium?.(); }
  }, [epoint.status, onPremium]);

  const inFlight = epoint.status === 'starting' || epoint.status === 'redirected' || epoint.status === 'checking';
  const showStatus = epoint.status !== 'idle';
  const price = plan === 'lifetime' ? null : epoint.offer?.plans[plan] ?? null;
  // After the checkout started the card stays visible for its status even if the offer changes (e.g. Premium now active).
  if (plan === 'lifetime' || (!epoint.available && !showStatus) || (!price && !showStatus)) return null;

  const campaign = epoint.offer?.kind === 'campaign' && !!price?.was;
  return (
    <div data-testid="epoint-pay-option" style={{ marginTop: 10, ...style }}>
      {price && epoint.available && (
        <button type="button" onClick={() => void epoint.startCheckout(plan)} disabled={inFlight} data-testid={`epoint-pay-${plan}`}
          className="w-full flex items-center gap-3 text-start disabled:opacity-60"
          style={{ borderRadius: 18, padding: '12px 14px', background: 'var(--a-surface)', border: '1.5px solid var(--a-line-strong)',
            color: 'var(--a-ink)', cursor: inFlight ? 'default' : 'pointer' }}>
          <span className="grid place-items-center shrink-0" style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--a-blue-1)', color: 'var(--a-blue-ink)' }}>
            {inFlight ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={17} strokeWidth={2.2} />}
          </span>
          <span className="flex-1 min-w-0">
            <b style={{ display: 'block', fontSize: 13.5, fontWeight: 800 }}>{iepText('iep_pay_title')}</b>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', fontSize: 12, color: 'var(--a-ink-soft)', marginTop: 2 }}>
              {campaign && <del><bdi>{formatAzn(price.was!)}</bdi></del>}
              <bdi style={{ fontWeight: 800, color: 'var(--a-ink)' }}>
                {iepFormat(plan === 'yearly' ? 'iep_price_yearly' : 'iep_price_monthly', { price: formatAzn(price.price) })}
              </bdi>
              {price.usd !== null && <bdi style={{ fontSize: 11 }}>≈ ${price.usd.toFixed(2)}</bdi>}
              {campaign && <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 999, background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)' }}>
                {iepText('iep_campaign')}
              </span>}
            </span>
          </span>
        </button>
      )}
      {price && epoint.available && <>
        <p style={{ fontSize: 10.5, lineHeight: 1.45, color: 'var(--a-ink-soft)', margin: '6px 4px 0' }}>
          {iepText(plan === 'yearly' ? 'iep_consent_yearly' : 'iep_consent_monthly')}
        </p>
        <p style={{ fontSize: 9.5, lineHeight: 1.4, color: 'var(--a-ink-faint)', margin: '3px 4px 0' }}>{iepText('iep_legal')}</p>
      </>}
      {showStatus && <EpointStatusLine status={epoint.status} messageKey={epoint.messageKey} onRetry={epoint.checkAgain} />}
    </div>
  );
}

function EpointStatusLine({ status, messageKey, onRetry }: {
  status: ReturnType<typeof useInAppEpoint>['status']; messageKey: ReturnType<typeof useInAppEpoint>['messageKey']; onRetry: () => void;
}) {
  const text = status === 'starting' || status === 'redirected' ? iepText('iep_opening')
    : status === 'checking' ? iepText('iep_checking')
    : status === 'success' ? iepText('iep_success')
    : messageKey ? iepText(messageKey) : null;
  if (!text) return null;
  const tone = status === 'success' ? 'var(--a-green-ink)' : status === 'error' || status === 'timeout' ? 'var(--a-alert-ink)' : 'var(--a-ink-soft)';
  return (
    <div role={status === 'error' || status === 'timeout' ? 'alert' : 'status'} className="flex items-center justify-center gap-2 flex-wrap"
      style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: tone, textAlign: 'center' }}>
      {status === 'checking' && <Loader2 size={13} className="animate-spin" />}
      <span>{text}</span>
      {(status === 'timeout' || status === 'error') && (
        <button type="button" onClick={onRetry} className="flex items-center gap-1 underline"
          style={{ background: 'none', border: 'none', color: 'var(--a-ink)', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>
          <RefreshCw size={11} /> {iepText('iep_check_again')}
        </button>
      )}
    </div>
  );
}

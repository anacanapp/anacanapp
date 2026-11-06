import './qaygicash.css';
import { useState } from 'react';
import { PUSH_NAV_EVENT, type PushNavIntent } from '@/lib/pushNav';
import { logEvent } from '@/lib/analytics';
import { useUserStore } from '@/store/userStore';
import { useQaygiCashWallet } from '@/hooks/useQaygiCash';
import {
  QC_BRAND, QC_STEP_MINOR, availableFrom, clampRedeem, earnPreview, formatQc, formatQcDate, formatRate, rateOf, redeemLimits,
  type QcEarnChannel, type QcRedeemChannel, type QcWallet, type RedeemLimits,
} from '@/lib/qaygicash';
import { qf, qt } from '@/lib/qaygicash-copy';

/** Opens the wallet from any screen (Index switches to the QayğıCash sub-screen). */
export function openQaygiCash() {
  window.dispatchEvent(new CustomEvent<PushNavIntent>(PUSH_NAV_EVENT, { detail: { screen: 'qaygicash' } }));
}

type QcEvent = 'qc_wallet_view' | 'qc_redeem_toggle' | 'qc_redeem_commit' | 'qc_premium_redeem';
/** Analytics never blocks or breaks a purchase flow. */
export function qcTrack(event: QcEvent, params?: Record<string, string | number | boolean | undefined>) {
  try { void Promise.resolve(logEvent(event, params)).catch(() => {}); } catch { /* analytics unavailable */ }
}

export const useQcLanguage = () => useUserStore((s) => s.language);

export function QcCoin({ size, children = '₼' }: { size?: 'sm' | 'lg'; children?: React.ReactNode }) {
  return <span className={`qc-coin${size ? ` ${size}` : ''}`} aria-hidden="true">{children}</span>;
}

/**
 * "+0,60 ₼ · 5% QayğıCash" on a product card or detail. Renders nothing when the programme is off,
 * the channel earns 0 %, or (Aptek) the product is a partner product.
 */
export function QcProductBadge({ channel, priceMinor, own = true, style }: { channel: QcEarnChannel; priceMinor: number; own?: boolean; style?: React.CSSProperties }) {
  const { wallet } = useQaygiCashWallet();
  const language = useQcLanguage();
  const rate = own ? rateOf(wallet ?? undefined, channel) : 0;
  const amount = earnPreview(priceMinor, rate);
  if (!wallet || !rate || amount <= 0) return null;
  return (
    <span className="qc-badge qc-num" style={style} data-testid="qc-badge">
      {qf('qc_badge', { amount: formatQc(amount, language), pct: formatRate(rate, language) })}
    </span>
  );
}

/** Cart line note: "+1,06 ₼ bonus" for an earning line, "bonus yoxdur" for a partner product. */
export function QcLineBonus({ channel, amountMinor, own = true }: { channel: QcEarnChannel; amountMinor: number; own?: boolean }) {
  const { wallet } = useQaygiCashWallet();
  const language = useQcLanguage();
  const rate = rateOf(wallet ?? undefined, channel);
  if (!wallet || !rate) return null;
  const amount = own ? earnPreview(amountMinor, rate) : 0;
  return amount > 0
    ? <span className="qc-inline-bonus qc-num">{qf('qc_line_bonus', { amount: formatQc(amount, language) })}</span>
    : <span className="qc-badge none">{qt('qc_no_bonus')}</span>;
}

export interface QcRedeemState {
  wallet: QcWallet | null;
  limits: RedeemLimits;
  channel: QcRedeemChannel;
  on: boolean;
  /** Bonus applied to this order, in minor units (0 when off or not allowed). */
  amount: number;
  toggle: () => void;
  setAmount: (minor: number) => void;
}

/** Switch + slider state for an order. Default: on, at the maximum, following the cart until the person moves the slider. */
export function useQcRedeem(channel: QcRedeemChannel, goodsMinor: number): QcRedeemState {
  const { wallet } = useQaygiCashWallet();
  const limits = redeemLimits(wallet ?? undefined, channel, goodsMinor);
  const [on, setOn] = useState(true);
  const [chosen, setChosen] = useState<number | null>(null);
  const usable = limits.show && limits.block === null;
  const amount = usable && on ? (chosen == null ? limits.max : clampRedeem(chosen, limits.min, limits.max)) : 0;
  return {
    wallet, limits, channel, on: usable && on, amount,
    toggle: () => { const next = !on; setOn(next); qcTrack('qc_redeem_toggle', { channel, on: next }); },
    setAmount: (minor) => setChosen(minor),
  };
}

/** "Use QayğıCash" switch and slider. Hidden unless the programme is live, the channel is open and the balance reaches the minimum. */
export function QcRedeemRow({ state, className, style }: { state: QcRedeemState; className?: string; style?: React.CSSProperties }) {
  const language = useQcLanguage();
  const { wallet, limits, on, amount } = state;
  if (!wallet || !limits.show) return null;
  const blocked = limits.block === 'order';
  const steps = blocked ? 0 : Math.ceil((limits.max - limits.min) / QC_STEP_MINOR);
  const index = on ? Math.min(steps, Math.round((amount - limits.min) / QC_STEP_MINOR)) : 0;
  const fromIndex = (i: number) => (i >= steps ? limits.max : limits.min + i * QC_STEP_MINOR);
  return (
    <div className={`qc-redeem${className ? ` ${className}` : ''}`} style={style} data-testid="qc-redeem">
      <button type="button" role="switch" aria-checked={on} className="qc-redeem-head" onClick={state.toggle} disabled={blocked}>
        <QcCoin />
        <span style={{ flex: 1, minWidth: 0 }}>
          <b>{qt('qc_use')}</b>
          <small className="qc-num">
            {blocked
              ? qf('qc_order_too_small', { min: formatQc(limits.min, language) })
              : qf('qc_use_sub', { balance: formatQc(wallet.available_minor, language), max: formatQc(limits.max, language) })}
          </small>
        </span>
        {!blocked && <span className="qc-switch" aria-hidden="true" />}
      </button>
      {on && steps > 0 && (
        <>
          <input type="range" className="qc-range" min={0} max={steps} step={1} value={index}
            aria-label={qt('qc_amount_label')} aria-valuetext={formatQc(amount, language)}
            onChange={(e) => state.setAmount(fromIndex(Number(e.target.value)))} />
          <div className="qc-range-labels"><span>{formatQc(limits.min, language)}</span><b data-testid="qc-redeem-amount">{formatQc(amount, language)}</b><span>{formatQc(limits.max, language)}</span></div>
        </>
      )}
      {on && steps === 0 && <div className="qc-range-labels" style={{ marginTop: 8, justifyContent: 'flex-end' }}><b data-testid="qc-redeem-amount">{formatQc(amount, language)}</b></div>}
    </div>
  );
}

/** Summary row "QayğıCash −X ₼". */
export function QcSummaryLine({ amount, className }: { amount: number; className?: string }) {
  const language = useQcLanguage();
  if (amount <= 0) return null;
  return <div className={className ?? 'qc-sum-line'} data-testid="qc-summary"><span>{QC_BRAND}</span><b className="qc-num">{`−${formatQc(amount, language)}`}</b></div>;
}

/** Green "You'll earn +Y ₼" box. */
export function QcEarnBox({ amount, digital, style }: { amount: number; digital?: boolean; style?: React.CSSProperties }) {
  const { wallet } = useQaygiCashWallet();
  const language = useQcLanguage();
  if (!wallet || amount <= 0) return null;
  const when = digital ? qf('qc_earn_when_digital', { n: wallet.hold_days_digital }) : qf('qc_earn_when_physical', { n: wallet.hold_days_physical });
  return (
    <div className="qc-earn" style={style} data-testid="qc-earn">
      <QcCoin size="sm">+</QcCoin>
      <span>{qf('qc_earn_box', { amount: formatQc(amount, language) })} {when}</span>
    </div>
  );
}

export interface QcOrderNote { earnMinor: number; usedMinor: number; digital: boolean }

/** Earned-bonus note on an order success screen, with the date it becomes spendable. */
export function QcSuccessNote({ note, style }: { note: QcOrderNote | null | undefined; style?: React.CSSProperties }) {
  const { wallet } = useQaygiCashWallet();
  const language = useQcLanguage();
  if (!wallet || !note || (note.earnMinor <= 0 && note.usedMinor <= 0)) return null;
  const date = formatQcDate(availableFrom(note.digital ? wallet.hold_days_digital : wallet.hold_days_physical), language);
  return (
    <div className="qc-success" style={style} data-testid="qc-success">
      {note.earnMinor > 0 && <>
        <QcCoin size="lg" />
        <b>{qf('qc_success_earn', { amount: `+${formatQc(note.earnMinor, language)}` })}</b>
        <span>{qf('qc_success_date', { date })}</span>
      </>}
      {note.usedMinor > 0 && <span>{qf('qc_success_used', { amount: formatQc(note.usedMinor, language) })}</span>}
      <button type="button" onClick={openQaygiCash}>{qt('qc_view_balance')}</button>
    </div>
  );
}

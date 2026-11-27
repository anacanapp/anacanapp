import './qaygicash.css';
import { useEffect, useRef } from 'react';
import { ArrowLeft, HelpCircle, Hourglass } from 'lucide-react';
import { useQaygiCash } from '@/hooks/useQaygiCash';
import { getPlatform } from '@/lib/revenuecat';
import { PUSH_NAV_EVENT, type PushNavIntent } from '@/lib/pushNav';
import {
  QC_BRAND, formatQc, formatQcDate, formatQcSigned, formatRate, historyStatusKey, historyTitleKey, historyTone, premiumRedeemOption,
  type QcEarnChannel, type QcHistoryItem, type QcWallet,
} from '@/lib/qaygicash';
import { qf, qk, qt, type QcKey } from '@/lib/qaygicash-copy';
import { tr } from '@/lib/tr';
import { QcCoin, qcTrack, useQcLanguage } from './QcParts';
import { QaygiCashPremiumOption } from './QaygiCashPremium';

const RATE_ORDER: QcEarnChannel[] = ['premium_yearly', 'premium_monthly', 'book', 'cake', 'own_shop'];
const FAQ: Array<[QcKey, QcKey]> = [
  ['qc_faq_what_q', 'qc_faq_what_a'], ['qc_faq_earn_q', 'qc_faq_earn_a'], ['qc_faq_when_q', 'qc_faq_when_a'], ['qc_faq_where_q', 'qc_faq_where_a'],
  ['qc_faq_expiry_q', 'qc_faq_expiry_a'], ['qc_faq_cash_q', 'qc_faq_cash_a'], ['qc_faq_refund_q', 'qc_faq_refund_a'], ['qc_faq_delete_q', 'qc_faq_delete_a'],
];

/** QayğıCash wallet: balance, how you earn, history and the rules. */
export default function QaygiCashScreen({ onBack }: { onBack: () => void }) {
  const { wallet, enabled, isLoading, isError, refetch, history, historyLoading } = useQaygiCash();
  const language = useQcLanguage();
  const rulesRef = useRef<HTMLElement>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (!enabled || viewed.current || !wallet) return;
    viewed.current = true;
    qcTrack('qc_wallet_view', { status: wallet.status, available_minor: wallet.available_minor, pending_minor: wallet.pending_minor });
  }, [enabled, wallet]);

  const shell = (children: React.ReactNode) => (
    <div className="a-scope a3-enter" style={{ background: 'var(--a-bg)', minHeight: '100%' }}>
      <div className="a-shell" style={{ paddingBottom: 32 }}>
        <header className="a3-topbar">
          <button type="button" className="a3-icon-btn" onClick={onBack} aria-label={tr('common_back', 'Geri')}>
            <ArrowLeft size={18} className="rtl:rotate-180" />
          </button>
          <h1 className="a3-page-title" style={{ flex: 1, fontSize: 22, margin: 0, fontWeight: 800, color: 'var(--a-ink)' }}>{QC_BRAND}</h1>
          {enabled && (
            <button type="button" className="a3-icon-btn solid" aria-label={qt('qc_rules')} onClick={() => rulesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <HelpCircle size={18} />
            </button>
          )}
        </header>
        {children}
      </div>
    </div>
  );

  if (isLoading) return shell(<div className="qc-card" style={{ height: 190, opacity: 0.55 }} aria-busy="true" />);
  if (!wallet) {
    return shell(isError
      ? <div className="qc-note info" role="alert" style={{ flexDirection: 'column' }}>
          <span>{qt('qc_load_error')}</span>
          <button type="button" className="a-btn-soft" style={{ minHeight: 40, padding: '0 16px' }} onClick={refetch}>{qt('qc_retry')}</button>
        </div>
      : null);
  }

  const live = wallet.status === 'live';
  const canSpend = live && wallet.redeem_channels.includes('aptek') && wallet.available_minor >= wallet.min_redeem_minor;
  const platform = getPlatform();
  const premiumPlans = (['yearly', 'monthly'] as const).filter((plan) => premiumRedeemOption(wallet, plan, platform));

  return shell(
    <>
      <section className="qc-card" data-testid="qc-wallet-card">
        <span className="qc-card-flag">{`${wallet.country} · ${wallet.currency}`}</span>
        <div className="qc-card-brand"><QcCoin />{QC_BRAND}</div>
        <div className="qc-card-amt" data-testid="qc-available">{formatQc(wallet.available_minor, language)}</div>
        <p className="qc-card-sub">{qt('qc_balance_ready')}</p>
        <div className="qc-card-row">
          {wallet.pending_minor > 0 && <span className="qc-pill qc-num"><Hourglass size={13} />{qf('qc_pending_pill', { amount: formatQc(wallet.pending_minor, language) })}</span>}
          {wallet.expiring_30d_minor > 0 && <span className="qc-pill qc-num">{qf('qc_expiring_pill', { amount: formatQc(wallet.expiring_30d_minor, language) })}</span>}
          {canSpend && (
            <button type="button" className="qc-pill solid" onClick={() => window.dispatchEvent(new CustomEvent<PushNavIntent>(PUSH_NAV_EVENT, { detail: { screen: 'aptek' } }))}>
              {qt('qc_spend')}
            </button>
          )}
        </div>
      </section>

      <div className="qc-stats">
        <div className="qc-stat"><b>{formatQc(wallet.available_minor, language)}</b><span>{qt('qc_stat_available')}</span></div>
        <div className="qc-stat pend"><b>{formatQc(wallet.pending_minor, language)}</b><span>{qt('qc_stat_pending')}</span></div>
        <div className="qc-stat exp"><b>{formatQc(wallet.expiring_30d_minor, language)}</b><span>{qt('qc_stat_expiring')}</span></div>
      </div>
      {wallet.next_expiry_at && <p className="a3-meta" style={{ marginTop: 8, paddingInline: 4 }}>{qf('qc_next_expiry', { date: formatQcDate(wallet.next_expiry_at, language) })}</p>}

      {!live && <div className="qc-note warn" role="status" style={{ marginTop: 12 }} data-testid="qc-paused">{qt('qc_paused_note')}</div>}
      {wallet.debt_minor > 0 && <div className="qc-note info" style={{ marginTop: 12 }} data-testid="qc-debt">{qf('qc_debt_note', { amount: formatQc(wallet.debt_minor, language) })}</div>}

      <Rates wallet={wallet} language={language} onRules={() => rulesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />

      {premiumPlans.length > 0 && (
        <section className="a3-sec">
          <div className="a3-sec-head"><h2 className="a3-sec-title">{qt('qc_prem_title')}</h2></div>
          {premiumPlans.map((plan) => <QaygiCashPremiumOption key={plan} plan={plan} />)}
        </section>
      )}

      <section className="a3-sec">
        <div className="a3-sec-head"><h2 className="a3-sec-title">{qt('qc_history_title')}</h2></div>
        <div className="a3-card" style={{ padding: '4px 12px' }}>
          {historyLoading
            ? <p className="a3-meta" style={{ padding: '14px 2px' }} aria-busy="true">…</p>
            : history.length
              ? history.map((item) => <HistoryRow key={item.id} item={item} language={language} />)
              : <p className="a3-meta" style={{ padding: '14px 2px' }}>{qt('qc_history_empty')}</p>}
        </div>
      </section>

      <section className="a3-sec" ref={rulesRef} style={{ scrollMarginTop: 16 }}>
        <div className="a3-sec-head"><h2 className="a3-sec-title">{qt('qc_rules')}</h2></div>
        <div className="a3-card qc-faq" style={{ padding: '2px 16px' }} data-testid="qc-faq">
          {FAQ.map(([q, a], i) => (
            <details key={q} open={i < 2}>
              <summary>{qt(q)}</summary>
              <p>{faqAnswer(a, wallet, language)}</p>
            </details>
          ))}
        </div>
        <p className="a3-meta" style={{ textAlign: 'center' }}>{qf('qc_terms_version', { n: wallet.terms_version })}</p>
      </section>
    </>,
  );
}

function faqAnswer(key: QcKey, wallet: QcWallet, language: string): string {
  switch (key) {
    case 'qc_faq_when_a': return qf(key, { physical: wallet.hold_days_physical, digital: wallet.hold_days_digital });
    case 'qc_faq_where_a': return qf(key, { pct: formatRate(wallet.max_redeem_pct * 100, language), min: formatQc(wallet.min_redeem_minor, language) });
    case 'qc_faq_expiry_a': return qf(key, { months: wallet.expiry_months });
    default: return qt(key);
  }
}

function Rates({ wallet, language, onRules }: { wallet: QcWallet; language: string; onRules: () => void }) {
  const rows = RATE_ORDER.filter((channel) => (wallet.rates[channel] ?? 0) > 0);
  return (
    <section className="a3-sec">
      <div className="a3-sec-head">
        <h2 className="a3-sec-title">{qt('qc_how_title')}</h2>
        <button type="button" className="a3-link" onClick={onRules}>{qt('qc_rules')}</button>
      </div>
      <div className="a3-card a3-pad">
        <div className="qc-rates" data-testid="qc-rates">
          {rows.map((channel) => {
            const bp = wallet.rates[channel] ?? 0;
            return (
              <div key={channel} className="qc-rate">
                <span>{qt(`qc_rate_${channel}` as QcKey)}</span>
                <span className="qc-rate-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, bp / 5)}%` }} /></span>
                <b>{formatRate(bp, language)}</b>
              </div>
            );
          })}
          <div className="qc-rate none">
            <span>{qt('qc_rate_partner')}</span>
            <span className="qc-rate-bar" aria-hidden="true" />
            <b>{qt('qc_no_bonus')}</b>
          </div>
        </div>
        <p className="a3-meta" style={{ fontSize: 11.5 }}>{qt('qc_rates_note')}</p>
      </div>
    </section>
  );
}

function HistoryRow({ item, language }: { item: QcHistoryItem; language: string }) {
  const tone = historyTone(item);
  const earn = item.type === 'earn';
  const status = qk(historyStatusKey(item), item.available_at ? { date: formatQcDate(item.available_at, language) } : { date: '' });
  const meta = [formatQcDate(item.at, language), earn && item.rate_bp ? formatRate(item.rate_bp, language) : null,
    earn && tone === 'available' && item.remaining_minor != null && item.remaining_minor < item.amount_minor ? qf('qc_left', { amount: formatQc(item.remaining_minor, language) }) : null]
    .filter(Boolean).join(' · ');
  return (
    <div className="qc-tx" data-testid="qc-tx" data-tone={tone}>
      <span className={`qc-tx-ic ${tone}`} aria-hidden="true">{earn ? '+' : '−'}</span>
      <span className="qc-tx-main"><b>{qk(historyTitleKey(item))}</b><span>{meta}</span></span>
      <span className={`qc-tx-val ${tone}`}>
        <span className="qc-amt">{formatQcSigned(earn ? item.amount_minor : -item.amount_minor, language)}</span>
        <small>{status}</small>
      </span>
    </div>
  );
}

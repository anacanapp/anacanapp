import './qaygicash.css';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQaygiCashWallet } from '@/hooks/useQaygiCash';
import { QC_BRAND, formatQc, hasQcActivity, readIntroDismissed, writeIntroDismissed } from '@/lib/qaygicash';
import { qt } from '@/lib/qaygicash-copy';
import { QcCoin, openQaygiCash, useQcLanguage } from './QcParts';

/**
 * Dashboard entry: the balance card once there is bonus activity, otherwise a one-time,
 * dismissible intro (remembered per account on this device). Nothing when the programme is off.
 */
export default function QaygiCashHomeCard({ onOpen = openQaygiCash }: { onOpen?: () => void }) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const { wallet } = useQaygiCashWallet();
  const language = useQcLanguage();
  const [dismissed, setDismissed] = useState(() => readIntroDismissed(uid));
  useEffect(() => { setDismissed(readIntroDismissed(uid)); }, [uid]);
  if (!wallet) return null;

  if (hasQcActivity(wallet)) {
    return (
      <section className="a-section" data-testid="qc-home-card">
        <button type="button" className="qc-home" onClick={onOpen}>
          <QcCoin size="lg" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span>{qt('qc_home_balance')}</span>
            <b>{formatQc(wallet.available_minor, language)}</b>
          </span>
          {wallet.pending_minor > 0 && (
            <span style={{ textAlign: 'end' }}>
              <span>{qt('qc_home_pending')}</span>
              <b style={{ fontSize: 14 }}>{`+${formatQc(wallet.pending_minor, language)}`}</b>
            </span>
          )}
        </button>
      </section>
    );
  }

  if (dismissed) return null;
  const dismiss = () => { writeIntroDismissed(uid); setDismissed(true); };
  return (
    <section className="a-section" data-testid="qc-home-intro">
      <div className="a3-card a3-pad" style={{ gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: 'var(--a-ink)' }}>
            <QcCoin />{QC_BRAND}<span className="qc-badge">{qt('qc_intro_badge')}</span>
          </span>
          <button type="button" onClick={dismiss} aria-label={qt('qc_close')}
            style={{ width: 28, height: 28, borderRadius: 10, border: 0, background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
        <b style={{ fontSize: 15, color: 'var(--a-ink)', lineHeight: 1.3 }}>{qt('qc_intro_title')}</b>
        <span className="a3-meta" style={{ fontSize: 13, lineHeight: 1.45 }}>{qt('qc_intro_text')}</span>
        <div>
          <button type="button" className="a-btn-solid" style={{ minHeight: 40, padding: '0 16px' }} onClick={() => { dismiss(); onOpen(); }}>{qt('qc_intro_cta')}</button>
        </div>
      </div>
    </section>
  );
}

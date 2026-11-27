import './qaygicash.css';
import { ChevronRight } from 'lucide-react';
import { useQaygiCashWallet } from '@/hooks/useQaygiCash';
import { QC_BRAND, formatQc } from '@/lib/qaygicash';
import { qt } from '@/lib/qaygicash-copy';
import { QcCoin, openQaygiCash, useQcLanguage } from './QcParts';

/** Profile entry (after Anacan Premium): compact wallet card with a one-line explanation. Hidden when the programme is off. */
export default function QaygiCashProfileCard({ onOpen = openQaygiCash }: { onOpen?: () => void }) {
  const { wallet } = useQaygiCashWallet();
  const language = useQcLanguage();
  if (!wallet) return null;
  return (
    <button type="button" className="qc-card qc-card-profile" onClick={onOpen} data-testid="qc-profile-card">
      <span className="qc-card-flag">{`${wallet.country} · ${wallet.currency}`}</span>
      <span className="qc-card-brand"><QcCoin />{QC_BRAND}</span>
      <span className="qc-card-amt">{formatQc(wallet.available_minor, language)}</span>
      <span className="qc-card-sub">{qt('qc_balance_ready')}</span>
      <span className="qc-card-hint">{qt('qc_profile_hint')}<ChevronRight size={15} className="rtl:rotate-180" aria-hidden="true" /></span>
    </button>
  );
}

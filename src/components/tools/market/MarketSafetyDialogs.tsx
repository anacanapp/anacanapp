import { useEffect, useState } from 'react';
import { Ban, Flag, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { tr } from '@/lib/tr';
import { marketReasonLabel } from './marketReasonLabel';
import { MARKET_REPORT_NOTE_MAX, MARKET_REPORT_REASONS, type MarketReportReason, type MarketReportTarget } from '@/lib/marketSafety';

interface ReportDialogProps {
  open: boolean;
  target: MarketReportTarget;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: MarketReportReason, note: string) => Promise<void>;
}

/** Report a listing, a user or a conversation: one reason plus an optional short note. */
export function MarketReportDialog({ open, target, onOpenChange, onSubmit }: ReportDialogProps) {
  const [reason, setReason] = useState<MarketReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  useEffect(() => { if (open) { setReason(null); setNote(''); setSending(false); } }, [open]);

  const submit = async () => {
    if (!reason || sending) return;
    setSending(true);
    try { await onSubmit(reason, note); } finally { setSending(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="a-scope max-h-[90vh] overflow-y-auto rounded-[26px]" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 a-heading" style={{ color: 'var(--a-ink)' }}>
            <Flag className="w-5 h-5" style={{ color: 'var(--a-coral-text)' }} />
            {target === 'listing' ? tr('market_report_listing_title', 'Elanı şikayət et') : tr('market_report_user_title', 'İstifadəçini şikayət et')}
          </DialogTitle>
          <DialogDescription>{tr('market_report_reason_label', 'Səbəbi seçin')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tr('market_report_reason_label', 'Səbəbi seçin')}>
            {MARKET_REPORT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className="px-3 py-2 rounded-full text-sm font-semibold"
                style={reason === r
                  ? { background: 'var(--a-peach-1)', color: 'var(--a-accent-ink)', border: '1px solid var(--a-peach-2)', cursor: 'pointer', minHeight: 40 }
                  : { background: 'var(--a-surface-soft)', color: 'var(--a-ink-soft)', border: '1px solid transparent', cursor: 'pointer', minHeight: 40 }}>
                {marketReasonLabel(r)}
              </button>
            ))}
          </div>
          <textarea
            className="a-input w-full resize-none"
            style={{ height: 'auto', minHeight: 72, fontFamily: 'inherit' }}
            rows={3}
            maxLength={MARKET_REPORT_NOTE_MAX}
            placeholder={tr('market_report_note_placeholder', 'Əlavə qeyd (istəyə bağlı)')}
            aria-label={tr('market_report_note_placeholder', 'Əlavə qeyd (istəyə bağlı)')}
            value={note}
            onChange={(e) => setNote(e.target.value)} />
          <button
            type="button"
            className="a-cta-btn w-full"
            style={{ justifyContent: 'center', height: 46, opacity: !reason || sending ? 0.5 : 1 }}
            disabled={!reason || sending}
            onClick={submit}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag size={15} strokeWidth={2.2} />}
            {tr('market_report_send', 'Şikayəti göndər')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface BlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

export function MarketBlockDialog({ open, onOpenChange, onConfirm }: BlockDialogProps) {
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="a-scope rounded-[26px]" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-line)' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 a-heading" style={{ color: 'var(--a-ink)' }}>
            <Ban className="w-5 h-5" style={{ color: 'var(--a-coral-text)' }} />
            {tr('market_block_title', 'İstifadəçini bloklayaq?')}
          </DialogTitle>
          <DialogDescription style={{ whiteSpace: 'normal' }}>
            {tr('market_block_body', 'Onun elanlarını və mesajlarını görməyəcəksiniz, o da sizə yaza bilməyəcək.')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 mt-2">
          <button type="button" className="a-btn-soft flex-1" style={{ minHeight: 44, justifyContent: 'center' }} onClick={() => onOpenChange(false)}>
            {tr('market_cancel', 'Ləğv et')}
          </button>
          <button type="button" className="a-cta-btn flex-1" style={{ minHeight: 44, justifyContent: 'center', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={confirm}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban size={15} strokeWidth={2.2} />}
            {tr('market_block_confirm', 'Blokla')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

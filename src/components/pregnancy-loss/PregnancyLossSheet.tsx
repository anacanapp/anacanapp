import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BellOff, FolderHeart, Leaf, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { usePregnancyLossText } from '@/data/pregnancy-loss';
import { beginPregnancyLoss, isoDay } from '@/lib/pregnancy-loss';
import '@/styles/pregnancy-loss.css';

/**
 * "Hamiləliyim davam etmir": one calm confirmation. No reason is asked. Only the date (for the recovery
 * weeks) and whether to tell the linked partner.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

const PregnancyLossSheet = ({ open, onClose, onDone }: Props) => {
  const language = useUserStore((s) => s.language) || 'az';
  const text = usePregnancyLossText(language);
  const { user, profile, refreshProfile } = useAuth();
  const hasPartner = !!profile?.linked_partner_id;
  const today = isoDay(new Date());
  const earliest = isoDay(new Date(Date.now() - 365 * 86_400_000));
  const [date, setDate] = useState(today);
  const [share, setShare] = useState(true);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => { if (open) { setDate(isoDay(new Date())); setFailed(false); setShare(true); } }, [open]);

  if (!text) return null;
  const t = text.ui;

  const confirm = async () => {
    if (!user || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await beginPregnancyLoss({
        date: date && date <= today && date >= earliest ? date : today,
        sharePartner: hasPartner && share,
        userId: user.id,
        linkedPartnerProfileId: profile?.linked_partner_id,
        partnerMessage: t.partner_message,
      });
      await refreshProfile();
      onDone();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const point = (Icon: typeof BellOff, line: string) => (
    <div className="flex gap-3 items-start" style={{ padding: '6px 0' }}>
      <span className="loss-row-icon" style={{ width: 30, height: 30, borderRadius: 10 }}><Icon size={15} style={{ color: 'var(--loss-accent-ink)' }} /></span>
      <p style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--a-body-text)', paddingTop: 5 }}>{line}</p>
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {open &&
        <motion.div className="a-scope loss-scope fixed inset-0 z-[80] flex items-end justify-center" style={{ background: 'rgba(40, 30, 50, 0.38)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !saving && onClose()}>
          <motion.div role="dialog" aria-modal="true" aria-labelledby="loss-sheet-title"
            className="w-full max-w-md overflow-y-auto"
            style={{ background: 'var(--a-surface)', borderRadius: '28px 28px 0 0', padding: '10px 20px calc(24px + env(safe-area-inset-bottom))', maxHeight: '92vh' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 40, height: 5, borderRadius: 9, background: 'var(--a-line-strong)', margin: '0 auto 14px' }} />
            <div style={{ textAlign: 'center', fontSize: 30 }} aria-hidden>🤍</div>
            <h2 id="loss-sheet-title" style={{ textAlign: 'center', fontSize: 19, fontWeight: 900, color: 'var(--a-ink)', margin: '6px 0 4px' }}>{t.sheet_title}</h2>
            <p style={{ textAlign: 'center', fontSize: 13.5, lineHeight: 1.5, color: 'var(--a-body-text)', marginBottom: 10 }}>{t.sheet_body}</p>

            {point(BellOff, t.sheet_stop)}
            {point(FolderHeart, t.sheet_keep)}
            {point(Leaf, t.sheet_guide)}

            <label className="flex items-center gap-3" style={{ background: 'var(--loss-soft)', borderRadius: 16, padding: '11px 13px', margin: '10px 0 8px' }}>
              <span className="flex-1">
                <span className="block" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{t.sheet_date}</span>
                <span className="block" style={{ fontSize: 11.5, color: 'var(--a-ink-soft)' }}>{t.sheet_date_sub}</span>
              </span>
              <input type="date" value={date} max={today} min={earliest} onChange={(e) => setDate(e.target.value)}
                style={{ background: 'var(--a-surface)', color: 'var(--a-ink)', borderRadius: 12, padding: '7px 10px', fontSize: 13, fontWeight: 700, border: 0 }} />
            </label>

            {hasPartner &&
              <button type="button" role="switch" aria-checked={share} onClick={() => setShare((v) => !v)}
                className="flex items-center gap-3 w-full text-start" style={{ background: 'var(--loss-soft)', borderRadius: 16, padding: '11px 13px', marginBottom: 14 }}>
                <span className="flex-1">
                  <span className="block" style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--a-ink)' }}>{t.sheet_partner}</span>
                  <span className="block" style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', lineHeight: 1.4 }}>{t.sheet_partner_sub}</span>
                </span>
                <span aria-hidden className="relative shrink-0" style={{ width: 44, height: 26, borderRadius: 99, background: share ? 'var(--loss-accent)' : 'var(--a-line-strong)', transition: 'background .2s' }}>
                  <span style={{ position: 'absolute', top: 3, insetInlineStart: share ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .2s' }} />
                </span>
              </button>}

            {failed && <p role="alert" style={{ fontSize: 12.5, color: 'var(--a-alert-ink)', textAlign: 'center', marginBottom: 8 }}>{t.sheet_error}</p>}
            <button type="button" className="loss-cta flex items-center justify-center gap-2" disabled={saving} onClick={confirm} style={{ marginTop: hasPartner ? 0 : 8 }}>
              {saving && <Loader2 size={16} className="animate-spin" />}{t.sheet_continue}
            </button>
            <button type="button" className="loss-ghost" disabled={saving} onClick={onClose} style={{ marginTop: 6 }}>{t.sheet_back}</button>
          </motion.div>
        </motion.div>}
    </AnimatePresence>,
    document.body
  );
};

export default PregnancyLossSheet;

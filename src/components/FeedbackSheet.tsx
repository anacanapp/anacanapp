import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Sheet } from '@/components/anacan/Sheet';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useFeedbackText } from '@/data/feedback';
import { hapticFeedback } from '@/lib/native';
import { HIGH_REASONS, LOW_REASONS, markFeedbackDismissed, sendAppFeedback } from '@/lib/app-feedback';
import '@/styles/care.css';

/**
 * In-app feedback: stars, then what to fix (1–3) or what works (4–5), then a thank-you. Every answer
 * goes to the team only — this sheet never sends anyone to the App Store or Play Store.
 */
export default function FeedbackSheet({ open, onClose, auto = false }: { open: boolean; onClose: () => void; auto?: boolean }) {
  const language = useUserStore((s) => s.language);
  const lifeStage = useUserStore((s) => s.lifeStage);
  const { user } = useAuth();
  const t = useFeedbackText(language);
  const [rating, setRating] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  useEffect(() => {if (open) {setRating(0);setReasons([]);setMessage('');setState('idle');}}, [open]);
  if (!t) return null;

  const low = rating > 0 && rating <= 3;
  const options = low ? LOW_REASONS : HIGH_REASONS;
  const labels = (low ? t.low_reasons : t.high_reasons) as Record<string, string>;
  const close = () => {
    if (auto && state !== 'done') markFeedbackDismissed();
    onClose();
  };
  const send = async () => {
    if (!user?.id || !rating) return;
    setState('sending');
    try {
      await sendAppFeedback({ userId: user.id, rating, reasons, message, subject: t.subject, lifeStage, language });
      setState('done');
      void hapticFeedback.medium();
    } catch {
      setState('error');
    }
  };

  return (
    <Sheet open={open} onClose={close} full={false} title={state === 'done' ? '💛' : t.title}
    footer={state === 'done' ?
    <button type="button" className="a3-btn accent cx-wide" onClick={onClose}>{t.close}</button> :
    <div style={{ display: 'grid', gridTemplateColumns: auto ? '1fr 2fr' : '1fr', gap: 8, width: '100%' }}>
          {auto && <button type="button" className="a3-btn ghost" onClick={close}>{t.later}</button>}
          <button type="button" className="a3-btn accent cx-wide" disabled={!rating || state === 'sending' || low && !reasons.length && !message.trim()} onClick={() => void send()}>
            {state === 'sending' ? t.sending : t.send}
          </button>
        </div>
    }>
      {state === 'done' ?
      <motion.div className="cx-celebrate" initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="cx-big">{low ? '🙏' : '🥰'}</div>
          <p className="cx-sub" style={{ fontSize: 15, marginTop: 12, color: 'var(--a-ink)' }}>{low ? t.thanks_low : t.thanks_high}</p>
        </motion.div> :

      <div className="cx-stack">
          <p className="cx-sub" style={{ textAlign: 'center' }}>{t.subtitle}</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }} role="radiogroup" aria-label={t.title}>
            {[1, 2, 3, 4, 5].map((n) =>
          <motion.button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={t.stars[n - 1]} whileTap={{ scale: .85 }}
          animate={{ scale: rating === n ? 1.15 : 1 }} onClick={() => {setRating(n);setReasons([]);void hapticFeedback.light();}}
          style={{ border: 0, background: 'none', padding: 4, cursor: 'pointer' }}>
                <Star size={40} strokeWidth={1.6} fill={n <= rating ? '#ffc94d' : 'none'} color={n <= rating ? '#f0a500' : 'var(--a-ink-faint)'} />
              </motion.button>
          )}
          </div>
          <p style={{ textAlign: 'center', fontWeight: 800, color: 'var(--a-ink)', minHeight: 20, margin: 0 }}>{rating ? t.stars[rating - 1] : ''}</p>
          {rating > 0 &&
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="cx-stack">
              <div>
                <b style={{ display: 'block', fontSize: 15, color: 'var(--a-ink)' }}>{low ? t.low_title : t.high_title}</b>
                <p className="cx-sub">{low ? t.low_sub : t.high_sub}</p>
              </div>
              <div className="cx-chips">
                {options.map((r) => <button key={r} type="button" className="cx-chip" aria-pressed={reasons.includes(r)}
            onClick={() => setReasons((x) => x.includes(r) ? x.filter((y) => y !== r) : [...x, r])}>{labels[r]}</button>)}
              </div>
              <textarea className="cx-input" style={{ minHeight: 90, padding: 12 }} maxLength={1500} value={message}
          placeholder={low ? t.message_low : t.message_high} onChange={(e) => setMessage(e.target.value)} />
              {state === 'error' && <div className="cx-warn">{t.error}</div>}
            </motion.div>
        }
        </div>
      }
    </Sheet>);
}

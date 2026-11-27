import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, MailCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useEmailVerificationText } from '@/data/email-verification';
import { confirmVerificationCode, sendVerificationCode, type VerificationError } from '@/lib/email-verification';

/**
 * New e-mail/password accounts confirm their e-mail with a 6-digit code before onboarding (Duzelis74). The first
 * code is sent automatically; resend has a 60-second timer; the code field supports iOS/Android one-time-code fill.
 */
const sentKey = (userId: string) => `anacan_email_code_sent_v1:${userId}`;

const EmailVerificationScreen = ({ email, onVerified }: { email: string; onVerified: () => void }) => {
  const language = useUserStore((s) => s.language) || 'az';
  const text = useEmailVerificationText(language);
  const { user, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'send' | 'confirm' | null>(null);
  const [error, setError] = useState<VerificationError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [done, setDone] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const send = async () => {
    if (busy) return;
    setBusy('send'); setError(null); setNotice(null);
    const result = await sendVerificationCode(language);
    setBusy(null);
    if (result.ok) {
      setWait(result.retryIn ?? 60);
      setNotice('sent');
      try { if (user) sessionStorage.setItem(sentKey(user.id), String(Date.now())); } catch { /* ignore */ }
    } else {
      setError(result.error ?? 'send_failed');
      if (result.retryIn) setWait(result.retryIn);
    }
    input.current?.focus();
  };

  // The first code goes out on its own (once per app session).
  useEffect(() => {
    if (!user) return;
    let already = false;
    try { already = !!sessionStorage.getItem(sentKey(user.id)); } catch { /* ignore */ }
    if (!already) void send(); else setWait(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const confirm = async (value = code) => {
    if (busy || value.length !== 6) return;
    setBusy('confirm'); setError(null);
    const result = await confirmVerificationCode(value, language);
    setBusy(null);
    if (result.ok) {
      setDone(true);
      window.setTimeout(onVerified, 900);
    } else {
      setError(result.error ?? 'send_failed');
      if (result.error === 'wrong_code') setCode('');
    }
  };

  if (!text) {
    return <div className="a-scope min-h-screen flex items-center justify-center" style={{ background: 'var(--a-bg)' }}><Loader2 className="animate-spin" style={{ color: 'var(--a-ink-faint)' }} /></div>;
  }
  const t = text.ui;

  return (
    <div className="a-scope safe-top min-h-screen flex flex-col" style={{ background: 'var(--a-bg)' }}>
      <div className="a-shell flex-1 flex flex-col justify-center" style={{ maxWidth: 440, margin: '0 auto', width: '100%', padding: '32px 20px' }}>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="a-card" style={{ padding: 24 }}>
          <div className="grid place-items-center" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--a-peach-1)', margin: '0 auto 14px' }}>
            <MailCheck size={26} style={{ color: 'var(--a-peach-2)' }} />
          </div>
          <h1 style={{ fontSize: 21, fontWeight: 900, textAlign: 'center', color: 'var(--a-ink)' }}>{done ? t.verified : t.title}</h1>
          {!done && <>
            <p style={{ fontSize: 14, lineHeight: 1.5, textAlign: 'center', color: 'var(--a-body-text)', margin: '8px 0 4px' }}>
              {t.subtitle.split('{email}')[0]}<b dir="ltr" style={{ color: 'var(--a-ink)' }}>{email}</b>{t.subtitle.split('{email}')[1]}
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.45, textAlign: 'center', color: 'var(--a-ink-soft)', marginBottom: 18 }}>{t.why}</p>

            <label htmlFor="email-code" className="sr-only">{t.code_label}</label>
            <input id="email-code" ref={input} value={code} autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} dir="ltr"
              aria-invalid={!!error && error !== 'rate_limited'} placeholder="••••••"
              onChange={(e) => { const value = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(value); setError(null); if (value.length === 6) void confirm(value); }}
              style={{ width: '100%', textAlign: 'center', fontSize: 30, fontWeight: 800, letterSpacing: 12, padding: '14px 8px', borderRadius: 16,
                background: 'var(--a-surface-soft)', color: 'var(--a-ink)', border: `2px solid ${error && error !== 'rate_limited' ? 'var(--a-peach-2)' : 'transparent'}`, outline: 'none' }} />

            <div aria-live="polite" style={{ minHeight: 22, margin: '10px 0 6px', textAlign: 'center', fontSize: 13, fontWeight: 600,
              color: error ? 'var(--a-alert-ink)' : 'var(--a-green-ink)' }}>
              {error ? t[error] : notice === 'sent' ? `${t.sent} ✓` : ''}
            </div>

            <button type="button" className="a-cta-btn" disabled={busy !== null || code.length !== 6} onClick={() => void confirm()}
              style={{ width: '100%', justifyContent: 'center', opacity: busy !== null || code.length !== 6 ? 0.6 : 1 }}>
              {busy === 'confirm' && <Loader2 size={16} className="animate-spin" />} {t.confirm}
            </button>
            <button type="button" disabled={wait > 0 || busy !== null} onClick={() => void send()}
              style={{ width: '100%', marginTop: 10, padding: 12, fontSize: 14, fontWeight: 700, color: wait > 0 ? 'var(--a-ink-faint)' : 'var(--a-peach-2)' }}>
              {busy === 'send' ? <Loader2 size={15} className="animate-spin inline" /> : wait > 0 ? t.resend_in.replace('{s}', String(wait)) : t.resend}
            </button>
            <p style={{ fontSize: 12, lineHeight: 1.45, textAlign: 'center', color: 'var(--a-ink-soft)', marginTop: 4 }}>{t.spam_hint}</p>
          </>}
        </motion.div>
        {!done &&
          <button type="button" onClick={() => void signOut()} style={{ marginTop: 18, fontSize: 13, fontWeight: 600, color: 'var(--a-ink-soft)', textDecoration: 'underline' }}>
            {t.wrong_email}
          </button>}
      </div>
    </div>
  );
};

export default EmailVerificationScreen;

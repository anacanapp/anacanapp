import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/store/userStore';
import {
  decideAiConsent, fetchConsentState, readLocalAiConsent, setAiConsent, syncLocalAiConsent, type ConsentState,
} from '@/lib/consentGate';
import { ct, KVKK_TEXTS } from '@/lib/consent-copy';

interface AiConsentGateProps {
  userId: string | null | undefined;
  backend: string;
  /** Türkiye user: the owner's KVKK Açık Rıza text for the AI assistant. */
  kvkk?: boolean;
  /** Declined: the chat stays closed (e.g. back to Home); the rest of the app keeps working. */
  onDecline: () => void;
  children: ReactNode;
}

type Phase = 'checking' | 'ask' | 'open';

/**
 * Anacan.AI first-use consent (kind ai_assistant). The chat renders only after a granted consent; a decision
 * already made on this device opens it at once (and is re-checked against the server in the background).
 */
const AiConsentGate = ({ userId, backend, kvkk = false, onDecline, children }: AiConsentGateProps) => {
  useUserStore((s) => s.language);
  const { toast } = useToast();
  const local = userId ? readLocalAiConsent(backend, userId) : null;
  const [phase, setPhase] = useState<Phase>(local === true ? 'open' : 'checking');
  const [state, setState] = useState<ConsentState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchConsentState().then((next) => {
      if (cancelled) return;
      setState(next);
      syncLocalAiConsent(backend, userId, next);
      setPhase(decideAiConsent(next, readLocalAiConsent(backend, userId)));
    });
    return () => { cancelled = true; };
  }, [userId, backend]);

  if (!userId) return null;
  if (phase === 'open') return <>{children}</>;
  if (phase === 'checking') {
    return <div className="a-scope flex h-full min-h-[50vh] items-center justify-center" style={{ background: 'var(--a-bg)' }}>
      <Loader2 className="animate-spin" size={22} style={{ color: 'var(--a-peach-2)' }} />
    </div>;
  }

  const decide = async (granted: boolean) => {
    setSaving(true);
    try {
      const result = await setAiConsent(backend, userId, granted, state?.gate.version ?? null, kvkk);
      if (granted) setPhase('open');
      else { toast({ title: ct('ai_consent_declined') }); onDecline(); }
      if (granted && !result.synced) toast({ title: ct('consent_saved_offline') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="a-scope flex h-full min-h-[70vh] items-end sm:items-center justify-center px-4"
      style={{ background: 'var(--a-bg)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}>
      <motion.div className="a-card w-full" style={{ maxWidth: 440, padding: 20 }} role="dialog" aria-modal="true" aria-labelledby="ai-consent-title"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} data-testid="ai-consent-sheet">
        <div className="flex items-center gap-3" style={{ marginBottom: 12 }}>
          <div className="flex items-center justify-center shrink-0" style={{ width: 44, height: 44, borderRadius: 15, background: 'var(--a-lav-1)' }}>
            <Sparkles size={20} style={{ color: 'var(--a-lav-ink)' }} />
          </div>
          <h2 id="ai-consent-title" style={{ fontSize: 16, fontWeight: 800, color: 'var(--a-ink)' }}>{ct('ai_consent_title')}</h2>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--a-body-text, var(--a-ink))' }}>
          {kvkk ? KVKK_TEXTS.ai_assistant : ct('ai_consent_text')}
        </p>
        <button type="button" disabled={saving} onClick={() => void decide(true)} data-testid="ai-consent-accept"
          className="w-full h-12 rounded-full font-bold text-sm text-white border-0 flex items-center justify-center gap-2"
          style={{ marginTop: 18, background: 'var(--a-peach-2)', opacity: saving ? 0.6 : 1 }}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {ct('ai_consent_accept')}
        </button>
        <button type="button" disabled={saving} onClick={() => void decide(false)} data-testid="ai-consent-decline"
          className="w-full h-11 rounded-full font-semibold text-sm border-0"
          style={{ marginTop: 6, background: 'transparent', color: 'var(--a-ink-soft)' }}>
          {ct('ai_consent_decline')}
        </button>
      </motion.div>
    </div>
  );
};

export default AiConsentGate;

import { lazy, Suspense, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, HeartPulse, Loader2, ShieldCheck, Stethoscope } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/store/userStore';
import { acceptConsentGate, canContinue, MARKETING_CHANNELS, type GateChoices } from '@/lib/consentGate';
import { ct, KVKK_TEXTS } from '@/lib/consent-copy';

const LegalScreen = lazy(() => import('@/components/LegalScreen'));

interface ConsentGateScreenProps {
  userId: string;
  backend: string;
  version: string;
  /** Türkiye user (country TR or language tr): KVKK Açık Rıza wording, child data and İYS channels. */
  kvkk?: boolean;
  onAccepted: () => void;
  onSignOut: () => void;
}

type ChoiceKey = keyof GateChoices;
const EMPTY: GateChoices = {
  terms: false, health_data: false, age_16: false, marketing: false, child_data: false,
  marketing_email: false, marketing_push: false, marketing_sms: false,
};
const BOX = 'mt-0.5 h-[22px] w-[22px] shrink-0 rounded-[7px] border-2 border-[var(--a-peach-2)] data-[state=checked]:bg-[var(--a-peach-2)] data-[state=checked]:text-white';
const SMALL_BOX = 'h-[18px] w-[18px] shrink-0 rounded-[6px] border-2 border-[var(--a-peach-2)] data-[state=checked]:bg-[var(--a-peach-2)] data-[state=checked]:text-white';
const Divider = () => <div style={{ height: 1, background: 'var(--a-line)' }} />;

/**
 * Full-screen consent gate (legal documents v2.0). Nothing is pre-ticked; Continue needs the three required
 * items; the rest is optional. The documents open in the in-app LegalScreen on top of the gate.
 */
const ConsentGateScreen = ({ userId, backend, version, kvkk = false, onAccepted, onSignOut }: ConsentGateScreenProps) => {
  useUserStore((s) => s.language); // re-render on language change
  const { toast } = useToast();
  const [choices, setChoices] = useState<GateChoices>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState<string | null>(null);
  const ready = canContinue(choices);
  const set = (kind: ChoiceKey) => (checked: boolean | 'indeterminate') => setChoices((c) => ({ ...c, [kind]: checked === true }));

  const submit = async () => {
    if (!ready || saving) return;
    setSaving(true);
    try {
      const { synced } = await acceptConsentGate(backend, userId, choices, version, kvkk);
      if (!synced) toast({ title: ct('consent_saved_offline') });
      onAccepted();
    } finally {
      setSaving(false);
    }
  };

  const link = (label: string, type: string) => (
    <button type="button" onClick={() => setDoc(type)} className="underline underline-offset-2"
      style={{ color: 'var(--a-accent-ink)', fontWeight: 700, background: 'none', border: 0, padding: 0, font: 'inherit' }}>
      {label}
    </button>
  );

  const row = (kind: ChoiceKey, label: string, required: boolean, extra?: ReactNode, small = false) => (
    <div className="flex items-start gap-3" style={{ padding: '12px 2px' }}>
      <Checkbox id={`consent-${kind}`} className={BOX} checked={choices[kind]} onCheckedChange={set(kind)}
        aria-required={required} data-testid={`consent-${kind}`} />
      <div className="min-w-0 flex-1">
        <label htmlFor={`consent-${kind}`} style={{ fontSize: small ? 12.5 : 13.5, fontWeight: small ? 500 : 600, color: 'var(--a-ink)', lineHeight: 1.45, display: 'block' }}>
          {label}
        </label>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: required ? 'var(--a-accent-ink)' : 'var(--a-ink-faint)' }}>
          {required ? ct('consent_required') : ct('consent_optional')}
        </span>
        {extra}
      </div>
    </div>
  );

  if (doc) {
    return (
      <div className="fixed inset-0 z-[460]" style={{ background: 'var(--a-bg)' }}>
        <Suspense fallback={null}><LegalScreen initialDocument={doc} onBack={() => setDoc(null)} /></Suspense>
      </div>
    );
  }

  // Türkiye: İYS channels as separate, unticked sub-choices; "marketing" is recorded as any channel.
  const channels = (
    <div className="flex flex-wrap gap-x-4 gap-y-2" style={{ marginTop: 10 }}>
      {MARKETING_CHANNELS.map((kind) => (
        <label key={kind} htmlFor={`consent-${kind}`} className="flex items-center gap-2" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--a-ink)' }}>
          <Checkbox id={`consent-${kind}`} className={SMALL_BOX} checked={choices[kind]} onCheckedChange={set(kind)} data-testid={`consent-${kind}`} />
          {KVKK_TEXTS[kind]}
        </label>
      ))}
    </div>
  );

  return (
    <div className="a-scope fixed inset-0 z-[450] overflow-y-auto overflow-x-hidden" role="dialog" aria-modal="true" aria-labelledby="consent-title"
      style={{ background: 'var(--a-bg)', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 20px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
      <motion.div className="a-shell" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 480, margin: '0 auto' }}>
        <div className="flex flex-col items-center text-center" style={{ padding: '8px 4px 18px' }}>
          <div className="flex items-center justify-center" style={{ width: 60, height: 60, borderRadius: 22, background: 'var(--a-peach-1)', marginBottom: 14 }}>
            <ShieldCheck size={28} style={{ color: 'var(--a-accent-ink)' }} />
          </div>
          <p className="a-eyebrow">{ct('consent_eyebrow')}</p>
          <h1 id="consent-title" style={{ fontSize: 22, fontWeight: 800, color: 'var(--a-ink)', margin: '4px 0 8px' }}>{ct('consent_title')}</h1>
          <p style={{ fontSize: 13, color: 'var(--a-ink-soft)', lineHeight: 1.5, maxWidth: 360 }}>{ct('consent_intro')}</p>
        </div>

        {kvkk && (
          <button type="button" data-testid="consent-kvkk-notice"
            onClick={() => { try { window.open(KVKK_TEXTS.notice_url, '_blank'); } catch { /* no browser */ } }}
            className="w-full flex items-center justify-between gap-2 text-start"
            style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 'var(--a-radius-md)', background: 'var(--a-blue-1)', border: 0, color: 'var(--a-blue-ink)', fontSize: 13, fontWeight: 700 }}>
            <span className="underline underline-offset-2">{KVKK_TEXTS.notice_link}</span>
            <ExternalLink size={15} className="shrink-0" />
          </button>
        )}

        <div className="a-card" style={{ padding: '6px 16px' }}>
          {row('terms', ct('consent_terms_label'), true,
            <p style={{ fontSize: 12, marginTop: 4, color: 'var(--a-ink-soft)' }}>
              {link(ct('consent_terms_link'), 'terms_of_service')}{' · '}{link(ct('consent_privacy_link'), 'privacy_policy')}
            </p>)}
          <Divider />
          {kvkk ? row('health_data', KVKK_TEXTS.health_data, true, undefined, true) : row('health_data', ct('consent_health_label'), true,
            <div className="flex items-start gap-2" style={{ marginTop: 6, padding: 10, borderRadius: 14, background: 'var(--a-pink-1)' }}>
              <HeartPulse size={15} className="shrink-0" style={{ color: 'var(--a-pink-ink)', marginTop: 1 }} />
              <p style={{ fontSize: 11.5, color: 'var(--a-ink-soft)', lineHeight: 1.45 }}>{ct('consent_health_desc')}</p>
            </div>)}
          <Divider />
          {row('age_16', ct('consent_age_label'), true)}
          {kvkk && <><Divider />{row('child_data', KVKK_TEXTS.child_data, false, undefined, true)}</>}
          <Divider />
          {kvkk ? (
            <div style={{ padding: '12px 2px' }} data-testid="consent-marketing-kvkk">
              <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--a-ink)', lineHeight: 1.45 }}>{KVKK_TEXTS.marketing}</p>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', color: 'var(--a-ink-faint)' }}>{ct('consent_optional')}</span>
              {channels}
            </div>
          ) : row('marketing', ct('consent_marketing_label'), false,
            <p style={{ fontSize: 11.5, marginTop: 4, color: 'var(--a-ink-soft)' }}>{ct('consent_marketing_desc')}</p>)}
        </div>

        <div className="flex items-start gap-2.5" style={{ marginTop: 14, padding: 14, borderRadius: 'var(--a-radius-md)', background: 'var(--a-disclaimer-bg)', border: '1px solid var(--a-disclaimer-border)' }}>
          <Stethoscope size={16} className="shrink-0" style={{ color: 'var(--a-disclaimer-ink)', marginTop: 1 }} />
          <p style={{ fontSize: 12, color: 'var(--a-disclaimer-ink)', lineHeight: 1.45 }}>
            {ct('consent_medical_note')}{' '}{link(ct('consent_disclaimer_link'), 'disclaimer')}
          </p>
        </div>

        <button type="button" onClick={submit} disabled={!ready || saving} data-testid="consent-continue"
          className="w-full h-12 rounded-full font-bold text-sm text-white border-0 flex items-center justify-center gap-2"
          style={{ marginTop: 18, background: 'var(--a-peach-2)', opacity: !ready || saving ? 0.5 : 1, transition: 'opacity .2s' }}>
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? ct('consent_saving') : ct('consent_continue')}
        </button>
        <button type="button" onClick={onSignOut} disabled={saving}
          className="w-full h-11 rounded-full font-semibold text-sm border-0"
          style={{ marginTop: 8, background: 'transparent', color: 'var(--a-ink-soft)' }}>
          {ct('consent_sign_out')}
        </button>
      </motion.div>
    </div>
  );
};

export default ConsentGateScreen;

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Baby, FileCheck2, HeartPulse, Mail, Megaphone, MessageSquare, Smartphone, Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { getLocaleTag } from '@/lib/i18n';
import {
  fetchConsentState, isKvkkUser, MARKETING_CHANNELS, recordConsents, setAiConsent, syncLocalAiConsent,
  type ConsentItem, type ConsentKind, type ConsentState,
} from '@/lib/consentGate';
import { ct, ctf } from '@/lib/consent-copy';

const CHANNEL_LABELS = { marketing_email: 'consent_marketing_email', marketing_push: 'consent_marketing_push', marketing_sms: 'consent_marketing_sms' } as const;
const SWITCH_CLS = 'data-[state=checked]:bg-[var(--a-peach-2)]';

/**
 * Privacy → "Razılıqlar" (Profil → Gizlilik → Razılıqlar): health data, Anacan.AI and marketing consents; Türkiye
 * (KVKK) users also manage child data and the three İYS marketing channels (my_consents_v1 / record_consents_v1).
 */
const ConsentSettings = () => {
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const language = useUserStore((s) => s.language);
  const storeCountry = useUserStore((s) => s.countryCode);
  const kvkk = isKvkkUser((profile as any)?.country_code || storeCountry, language);
  const backend = getBackendConfig().url;
  const [state, setState] = useState<ConsentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<ConsentKind | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchConsentState().then((next) => {
      if (cancelled) return;
      setState(next);
      setLoading(false);
      if (user?.id) syncLocalAiConsent(backend, user.id, next);
    });
    return () => { cancelled = true; };
  }, [user?.id, backend]);

  const version = state?.gate.version ?? null;
  const health = state?.consents.health_data;
  const marketing = state?.consents.marketing;
  const terms = state?.consents.terms;

  const variant = kvkk ? { variant: 'kvkk_tr' as const } : {};
  const record = async (kind: ConsentKind, granted: boolean) => {
    if (!version) return;
    setBusy(kind);
    try {
      let next: ConsentState | null;
      if (kind === 'ai_assistant' && user?.id) {
        const result = await setAiConsent(backend, user.id, granted, version, kvkk);
        if (!result.synced) throw new Error('CONSENT_NOT_SYNCED');
        next = result.state;
      } else {
        const items: ConsentItem[] = [{ kind, granted, version, ...variant }];
        // İYS channels: keep the summary "marketing" row equal to "any channel granted".
        if ((MARKETING_CHANNELS as readonly string[]).includes(kind)) {
          const any = MARKETING_CHANNELS.some((c) => (c === kind ? granted : state?.consents[c]?.granted === true));
          items.push({ kind: 'marketing', granted: any, version, ...variant });
        }
        next = await recordConsents(items);
      }
      if (next) setState(next);
      toast({ title: ct('consent_updated') });
    } catch {
      toast({ title: ct('consent_update_failed'), variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const onHealth = (checked: boolean) => {
    if (checked) void record('health_data', true);
    else setConfirmWithdraw(true);
  };

  const ai = state?.consents.ai_assistant;
  const child = state?.consents.child_data;
  const channelIcons = { marketing_email: Mail, marketing_push: Smartphone, marketing_sms: MessageSquare } as const;
  const rows: Array<{ kind: ConsentKind; icon: typeof HeartPulse; title: string; desc: string; checked: boolean; onChange: (c: boolean) => void; bg: string; ink: string }> = [
    { kind: 'health_data' as const, icon: HeartPulse, title: ct('consent_health_toggle'), desc: ct('consent_health_toggle_desc'),
      checked: health?.granted === true, onChange: onHealth, bg: 'var(--a-pink-1)', ink: 'var(--a-pink-ink)' },
    { kind: 'ai_assistant' as const, icon: Sparkles, title: ct('consent_ai_toggle'), desc: ct('consent_ai_toggle_desc'),
      checked: ai?.granted === true, onChange: (c: boolean) => void record('ai_assistant', c), bg: 'var(--a-lav-1)', ink: 'var(--a-lav-ink)' },
    ...(kvkk ? [
      { kind: 'child_data' as const, icon: Baby, title: ct('consent_child_toggle'), desc: ct('consent_child_toggle_desc'),
        checked: child?.granted === true, onChange: (c: boolean) => void record('child_data', c), bg: 'var(--a-green-1)', ink: 'var(--a-green-ink)' },
      ...MARKETING_CHANNELS.map((kind) => ({ kind, icon: channelIcons[kind], title: `${ct('consent_marketing_toggle')} · ${ct(CHANNEL_LABELS[kind])}`,
        desc: ct('consent_marketing_toggle_desc'), checked: state?.consents[kind]?.granted === true,
        onChange: (c: boolean) => void record(kind, c), bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)' })),
    ] : [
      { kind: 'marketing' as const, icon: Megaphone, title: ct('consent_marketing_toggle'), desc: ct('consent_marketing_toggle_desc'),
        checked: marketing?.granted === true, onChange: (c: boolean) => void record('marketing', c), bg: 'var(--a-yellow-1)', ink: 'var(--a-yellow-ink)' },
    ]),
  ];

  const termsDate = terms?.granted && terms.created_at ? (() => {
    const d = new Date(terms.created_at);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(getLocaleTag());
  })() : null;

  return (
    <motion.div className="a-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.03 }} data-testid="consent-settings">
      <h3 className="a-card-title flex items-center gap-2" style={{ marginBottom: 4 }}>
        <FileCheck2 size={16} style={{ color: 'var(--a-accent-ink)' }} />
        {ct('consent_section_title')}
      </h3>
      <p style={{ fontSize: 11, color: 'var(--a-ink-soft)', marginBottom: 6 }}>{ct('consent_section_desc')}</p>

      {!loading && !state ? (
        <p style={{ fontSize: 12, color: 'var(--a-ink-soft)', padding: '8px 4px' }}>{ct('consent_unavailable')}</p>
      ) : (
        <div className="space-y-1">
          {rows.map(({ kind, icon: Icon, title, desc, checked, onChange, bg, ink }) => (
            <div key={kind} className="flex items-center justify-between gap-3" style={{ padding: '10px 4px' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 flex items-center justify-center shrink-0" style={{ borderRadius: 13, background: bg }}>
                  <Icon size={17} style={{ color: ink }} />
                </div>
                <div className="min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--a-ink)' }}>{title}</p>
                  <p style={{ fontSize: 11, color: 'var(--a-ink-soft)', marginTop: 1 }}>{desc}</p>
                </div>
              </div>
              <Switch className={SWITCH_CLS} checked={checked} aria-label={title} data-testid={`consent-toggle-${kind}`}
                disabled={loading || !version || busy !== null} onCheckedChange={onChange} />
            </div>
          ))}
          {health && !health.granted && (
            <p style={{ fontSize: 11.5, color: 'var(--a-alert-ink)', background: 'var(--a-alert-bg)', borderRadius: 12, padding: '8px 10px' }}>
              {ct('consent_withdrawn_note')}
            </p>
          )}
          {!loading && (
            <p style={{ fontSize: 11, color: 'var(--a-ink-faint)', padding: '8px 4px 2px' }}>
              {termsDate && terms ? ctf('consent_terms_accepted', { date: termsDate, version: terms.document_version }) : ct('consent_terms_unknown')}
            </p>
          )}
        </div>
      )}

      <Dialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
        <DialogContent className="a-scope rounded-[22px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--a-alert-ink)' }}>
              <AlertTriangle className="w-5 h-5" />
              {ct('consent_withdraw_title')}
            </DialogTitle>
            <DialogDescription className="text-start">{ct('consent_withdraw_text')}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setConfirmWithdraw(false)} className="flex-1 rounded-full">{ct('consent_cancel')}</Button>
            <Button variant="destructive" className="flex-1 rounded-full" disabled={busy !== null}
              onClick={() => { setConfirmWithdraw(false); void record('health_data', false); }}>
              {ct('consent_withdraw_confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default ConsentSettings;

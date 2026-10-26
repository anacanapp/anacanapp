import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { leadFieldLabel, leadText, parsePublicLeadForm, validateLead, type LeadError, type LeadFieldKey } from '@/lib/ads/leadForm';

interface Props { bannerId: string | null; deliveryId?: string | null; onClose: () => void }
const errorText: Record<LeadError, 'error_required' | 'error_email' | 'error_phone' | 'error_consent' | 'error_generic'> =
  { required: 'error_required', email: 'error_email', phone: 'error_phone', consent: 'error_consent', empty: 'error_required' };
const inputType: Partial<Record<LeadFieldKey, { type: string; autoComplete: string; inputMode?: 'tel' | 'email' }>> = {
  name: { type: 'text', autoComplete: 'name' }, phone: { type: 'tel', autoComplete: 'tel', inputMode: 'tel' }, email: { type: 'email', autoComplete: 'email', inputMode: 'email' },
};

/** Brand-owned in-app lead form. Answers go only to submit_ad_lead_v1; nothing is cached or persisted on device. */
export default function LeadFormSheet({ bannerId, deliveryId, onClose }: Props) {
  const { user } = useAuth(), language = useUserStore(state => state.language);
  const [answers, setAnswers] = useState<Partial<Record<LeadFieldKey, string>>>({}), [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validateLead>['errors']>({}), [result, setResult] = useState<'sent' | 'duplicate' | null>(null);
  const request = useRef(crypto.randomUUID());
  useEffect(() => { setAnswers({}); setConsent(false); setErrors({}); setResult(null); request.current = crypto.randomUUID(); }, [bannerId]);
  const form = useQuery({
    queryKey: ['brand-lead-form', getBackendConfig().url, user?.id, bannerId, language], enabled: !!user && !!bannerId,
    meta: { persist: false }, gcTime: 0, staleTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await (supabase as any).rpc('get_ad_lead_form_v1', { p_banner: bannerId, p_language: language }).abortSignal(signal);
      if (error) throw error;
      return parsePublicLeadForm(data);
    },
  });
  const submit = useMutation({
    mutationFn: async (clean: Partial<Record<LeadFieldKey, string>>) => {
      const { data, error } = await (supabase as any).rpc('submit_ad_lead_v1', { p_banner: bannerId, p_delivery: deliveryId ?? null,
        p_answers: clean, p_language: language, p_consent: true, p_request: request.current });
      if (error) throw error;
      return data as { id: string; duplicate: boolean };
    },
    onSuccess: data => { setResult(data?.duplicate ? 'duplicate' : 'sent'); setAnswers({}); },
  });
  const definition = form.data, brand = definition?.sponsor_name || '';
  const send = (event: FormEvent) => {
    event.preventDefault(); if (!definition || submit.isPending) return;
    const checked = validateLead(definition, answers, consent);
    setErrors(checked.errors);
    if (checked.valid) submit.mutate(checked.clean);
  };
  const failure = submit.error ? (/RATE_LIMITED/.test(String((submit.error as any)?.message)) ? 'error_rate' : 'error_generic') : null;
  const t = (key: Parameters<typeof leadText>[0]) => leadText(key, language, { brand, days: definition?.retention_days ?? 90 });
  return <Sheet open={!!bannerId} onOpenChange={open => { if (!open) onClose(); }}>
    <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-5" data-testid="brand-lead-sheet">
      {form.isLoading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('loading')}</div>
        : !definition ? <div className="py-10 text-center"><SheetTitle className="text-base">{t('unavailable')}</SheetTitle><SheetDescription className="sr-only">{t('unavailable')}</SheetDescription>
          <button type="button" className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground" onClick={onClose}>{t('close')}</button></div>
        : result ? <div className="flex flex-col items-center gap-3 py-8 text-center" role="status"><CheckCircle2 className="h-12 w-12 text-primary" aria-hidden="true" />
          <SheetTitle className="text-lg">{result === 'sent' ? definition.copy.success || t('success') : t('duplicate')}</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">{brand}</SheetDescription>
          <button type="button" className="mt-4 rounded-full bg-primary px-8 py-2.5 text-sm font-semibold text-primary-foreground" onClick={onClose}>{t('done')}</button></div>
        : <form onSubmit={send} noValidate lang={definition.language} className="flex flex-col gap-4 pt-2">
          <div className="pe-8"><span className="text-[11px] text-muted-foreground">{t('sponsored')} · <bdi>{brand}</bdi></span>
            <SheetTitle className="mt-1 text-lg leading-snug">{definition.copy.title}</SheetTitle>
            <SheetDescription className={definition.copy.intro ? 'mt-1 text-sm text-muted-foreground' : 'sr-only'}>{definition.copy.intro || definition.copy.title}</SheetDescription></div>
          {definition.fields.map(field => {
            const id = `lead-${field.key}`, error = errors[field.key], kind = inputType[field.key];
            return <label key={field.key} htmlFor={id} className="flex flex-col gap-1.5 text-sm font-medium">
              <span>{leadFieldLabel(definition, field.key, language)}{!field.required && <span className="ms-1 text-xs font-normal text-muted-foreground">({t('optional')})</span>}</span>
              <input id={id} name={field.key} type={kind?.type ?? 'text'} autoComplete={kind?.autoComplete ?? 'off'} inputMode={kind?.inputMode} dir={field.key === 'phone' || field.key === 'email' ? 'ltr' : undefined}
                required={field.required} maxLength={field.key.startsWith('question_') ? 500 : 254} value={answers[field.key] ?? ''} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
                onChange={event => setAnswers(old => ({ ...old, [field.key]: event.target.value }))}
                className="min-h-12 rounded-xl border border-border bg-background px-3.5 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary" />
              {error && <span id={`${id}-error`} className="text-xs font-normal text-destructive">{t(errorText[error])}</span>}
            </label>;
          })}
          <label className="flex items-start gap-3 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed">
            <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-0.5 h-5 w-5 flex-shrink-0 accent-primary" aria-invalid={!!errors.consent} />
            <span><span className="block font-medium text-foreground">{t('consent_check')}</span><span className="mt-1 block whitespace-pre-line text-muted-foreground">{definition.copy.consent}</span>
              {definition.privacy_url && <a href={definition.privacy_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-medium text-primary underline">{t('privacy_policy')}</a>}</span>
          </label>
          {errors.consent && <span className="-mt-2 text-xs text-destructive">{t('error_consent')}</span>}
          <p className="text-[11px] leading-relaxed text-muted-foreground">{t('privacy_note')}</p>
          {failure && <p role="alert" className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">{t(failure)}</p>}
          <button type="submit" disabled={submit.isPending} className="min-h-12 rounded-full bg-primary text-base font-semibold text-primary-foreground disabled:opacity-60">
            {submit.isPending ? t('sending') : t('submit')}</button>
        </form>}
    </SheetContent>
  </Sheet>;
}

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Ban, LogOut, MessageSquare, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useMyModerationStatus } from '@/hooks/useModerator';
import { writeStorageItem } from '@/lib/local-storage';
import { moderatorText } from '@/lib/moderator-i18n';
import { moderatorReason, type ModeratorWarning } from '@/lib/moderator';
import { appLanguageLocale } from '@/lib/app-languages';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import MyModerationDecisions from './MyModerationDecisions';
import { isRtlLang } from '@/lib/rtl';

const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
type PendingAck = { id: string; claim: string };
function readPending(key: string): PendingAck[] { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.filter(x => UUID.test(x?.id) && UUID.test(x?.claim)).slice(-100) : []; } catch { return []; } }
export default function ModeratorEnforcement({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth(), language = useUserStore(state => state.language), query = useMyModerationStatus();
  const backend = getBackendConfig().url, ownerKey = `${backend}:${user?.id || ''}`;
  const ackKey = `anacan-moderator-warning-acks-v1:${encodeURIComponent(ownerKey)}`;
  const claim = useMemo(() => crypto.randomUUID(), [ownerKey]);
  const [warning, setWarning] = useState<{ owner: string; data: ModeratorWarning } | null>(null), [dismissed, setDismissed] = useState<Record<string, boolean>>({}), [showDecisions, setShowDecisions] = useState(false);
  const visibleWarning = warning?.owner === ownerKey && !dismissed[`${ownerKey}:${warning.data.id}`] ? warning.data : null;
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('anacan-moderation-overlay', { detail: { open: !!visibleWarning } }));
    return () => { window.dispatchEvent(new CustomEvent('anacan-moderation-overlay', { detail: { open: false } })); };
  }, [!!visibleWarning]);
  useEffect(() => {
    if (!user || !query.data) return;
    let cancelled = false;
    const run = async () => {
      const pending = readPending(ackKey);
      for (const item of pending.slice(0, 10)) {
        if (cancelled) return;
        const { data, error } = await (supabase as any).rpc('ack_my_moderator_warning_v1', { p_actor: user.id, p_warning: item.id, p_claim: item.claim });
        if (!error && data === true) { try { writeStorageItem(localStorage, ackKey, JSON.stringify(readPending(ackKey).filter(value => value.id !== item.id))); } catch {} }
      }
      if (cancelled || !query.data?.pending_warnings || visibleWarning) return;
      const { data, error } = await (supabase as any).rpc('claim_my_moderator_warning_v1', { p_actor: user.id, p_claim: claim });
      if (cancelled || error || !data || readPending(ackKey).some(value => value.id === data.id) || dismissed[`${ownerKey}:${data.id}`]) return;
      setWarning({ owner: ownerKey, data });
    };
    void run().catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id, ownerKey, ackKey, claim, query.data, visibleWarning?.id, dismissed]);
  useEffect(() => {
    if (!user || !visibleWarning) return;
    let cancelled = false;
    const renew = async () => {
      if (document.visibilityState === 'hidden') return;
      const { data, error } = await (supabase as any).rpc('claim_my_moderator_warning_v1', { p_actor: user.id, p_claim: claim });
      // Another device may already have acknowledged this warning. Keep its
      // account-bound lease alive while this popup is actually on screen.
      if (!cancelled && !error && data?.id !== visibleWarning.id) setWarning(null);
    };
    const refresh = () => { void renew().catch(() => {}); };
    const timer = window.setInterval(refresh, 45000);
    window.addEventListener('focus', refresh);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [user?.id, ownerKey, claim, visibleWarning?.id]);
  useEffect(() => {
    if (query.data?.user_id === user?.id && query.data?.pending_warnings === 0) setWarning(null);
  }, [query.data?.user_id, query.data?.pending_warnings, user?.id]);
  useEffect(() => {
    if (query.data?.full && query.data.user_id === user?.id) {
      void import('@/store/whiteNoiseStore').then(({ useWhiteNoiseStore }) => useWhiteNoiseStore.getState().stop()).catch(() => {});
    }
  }, [query.data?.full, query.data?.user_id, user?.id]);
  const closeWarning = () => {
    if (!visibleWarning || !user) return;
    const entry = { id: visibleWarning.id, claim: visibleWarning.claim_id };
    setDismissed(current => ({ ...current, [`${ownerKey}:${entry.id}`]: true })); setWarning(null);
    try { writeStorageItem(localStorage, ackKey, JSON.stringify([...readPending(ackKey).filter(value => value.id !== entry.id), entry].slice(-100))); } catch {}
    void (supabase as any).rpc('ack_my_moderator_warning_v1', { p_actor: user.id, p_warning: entry.id, p_claim: entry.claim }).then(({ data, error }: any) => {
      if (!error && data === true) { try { writeStorageItem(localStorage, ackKey, JSON.stringify(readPending(ackKey).filter(value => value.id !== entry.id))); } catch {} void query.refetch(); }
    }).catch(() => {});
  };
  const full = query.data?.full && query.data.user_id === user?.id;
  return <>
    {full ? showDecisions ? <MyModerationDecisions onBack={() => setShowDecisions(false)} /> : <main className="a-scope safe-top min-h-[100dvh] flex flex-col items-center justify-center p-6 gap-5" data-testid="moderator-full-block" data-ad-block="true">
      <Ban size={48} className="text-destructive" /><h1 className="text-xl font-bold text-center">{moderatorText('restriction_notice', language)}</h1><p className="text-sm text-muted-foreground text-center max-w-md">{moderatorText('full_restricted', language)}</p>
      <div className="space-y-3 w-full max-w-md">{query.data.restrictions.filter(value => value.scope === 'full').map(value => <div className="a-card text-sm space-y-2" key={value.id}>
        <p className="font-semibold">{moderatorReason(value.reason, language)}</p>{value.detail && <p className="whitespace-pre-wrap break-words">{value.detail}</p>}
        <p className="text-muted-foreground">{value.expires_at ? new Intl.DateTimeFormat(appLanguageLocale(language), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value.expires_at)) : moderatorText('duration_permanent', language)}</p>
      </div>)}</div>
      <div className="flex flex-wrap justify-center gap-3"><Button onClick={() => setShowDecisions(true)}><MessageSquare size={16} />{moderatorText('appeals', language)}</Button><Button variant="outline" onClick={() => void signOut()}><LogOut size={16} />{moderatorText('sign_out', language)}</Button></div>
      <a className="text-sm text-primary underline" href="mailto:info@anacan.az">{moderatorText('contact_support', language)}</a>
    </main> : children}
    <Dialog open={!!visibleWarning} onOpenChange={open => { if (!open) closeWarning(); }}>
      <DialogContent closeLabel={moderatorText('close', language)} dir={isRtlLang(language) ? 'rtl' : 'ltr'} overlayClassName="z-[340]" className="z-[350] w-[calc(100%_-_24px)] max-w-md max-h-[calc(100dvh_-_32px)] overflow-y-auto" data-testid="moderator-warning" data-ad-block="true">
        <DialogHeader className="text-start"><DialogTitle className="flex items-center gap-2"><ShieldAlert className="text-amber-600 shrink-0" />{moderatorText('warning_title', language)}</DialogTitle><DialogDescription>{moderatorText('warning_body', language)}</DialogDescription></DialogHeader>
        {visibleWarning && <><p className="font-semibold">{moderatorReason(visibleWarning.reason, language)}</p><p className="text-sm leading-relaxed">{moderatorReason(visibleWarning.reason, language, true)}</p>
          {!!visibleWarning.detail && <p className="rounded-xl bg-muted p-3 whitespace-pre-wrap break-words text-sm" dir="auto">{visibleWarning.detail}</p>}</>}
        <Button onClick={closeWarning} className="min-h-11 h-auto whitespace-normal">{moderatorText('warning_close', language)}</Button>
      </DialogContent>
    </Dialog>
  </>;
}

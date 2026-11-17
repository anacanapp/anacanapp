/**
 * Partner panel at /partner (web). Partners sign in with an Anacan account; an invite link (/partner?invite=…)
 * from the partner's owner or an Anacan admin attaches the account to that store. Each member sees only the
 * stores they belong to; admins see every store. Data access is enforced by the shop_partner_* RPCs.
 */
import '@/styles/admin.css';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, LogOut, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Btn, ConfirmProvider, Field, Notice, StatusPill } from '@/components/admin/kit';
import { PanelError, ROLE_LABEL, STATUS_LABEL, prpc, type PanelMe, type PanelPartner } from '@/lib/partner-panel';
import { PartnerWorkspace } from './PartnerWorkspace';

const INVITE_KEY = 'anacan_partner_invite_v1';

function readInvite(): string | null {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('invite');
    if (fromUrl) {
      sessionStorage.setItem(INVITE_KEY, fromUrl);
      url.searchParams.delete('invite');
      window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
      return fromUrl;
    }
    return sessionStorage.getItem(INVITE_KEY);
  } catch { return null; }
}
const clearInvite = () => { try { sessionStorage.removeItem(INVITE_KEY); } catch { /* storage blocked */ } };

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--ad-bg)', color: 'var(--ad-text)' }}>
      <header className="sticky top-0 z-20 border-b" style={{ background: 'var(--ad-surface)', borderColor: 'var(--ad-border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <span className="flex items-center gap-2 font-bold">
            <img src="/website/brand-glyph-coral.png" alt="" width={26} height={26} />
            <span>Anacan <span style={{ color: 'var(--ad-text-3)', fontWeight: 600 }}>· Partnyor paneli</span></span>
          </span>
          {right}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}

function SignIn({ invite }: { invite: boolean }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMessage(null);
    const r = mode === 'in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password, name.trim() || email.trim().split('@')[0]);
    setBusy(false);
    if (r.error) { setMessage(mode === 'in' ? 'E-poçt və ya şifrə yanlışdır.' : 'Hesab yaradılmadı. E-poçtu yoxlayın və ən azı 8 simvolluq şifrə seçin.'); return; }
    if (mode === 'up' && !r.data?.session) setMessage('Hesab yaradıldı. E-poçtunuza gələn təsdiq linkini açın, sonra bu səhifəyə qayıdıb daxil olun.');
  };
  return (
    <div className="mx-auto grid max-w-md gap-4 pt-6">
      <div>
        <h1 className="text-2xl font-bold">{mode === 'in' ? 'Panelə daxil olun' : 'Hesab yaradın'}</h1>
        <p className="text-sm" style={{ color: 'var(--ad-text-2)' }}>Məhsullarınızı, qiymətləri, stoku, kampaniyaları və statistikanı buradan idarə edirsiniz.</p>
      </div>
      {invite && <Notice tone="info">Dəvət linki ilə gəlmisiniz. Dəvətin göndərildiyi e-poçtla daxil olun və ya hesab yaradın, mağaza avtomatik qoşulacaq.</Notice>}
      <form onSubmit={submit} className="ak-section" style={{ padding: 16, display: 'grid', gap: 12 }}>
        {mode === 'up' && <Field label="Ad">{(id) => <input id={id} className="ak-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}</Field>}
        <Field label="E-poçt" required>{(id) => <input id={id} type="email" className="ak-input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />}</Field>
        <Field label="Şifrə" required>{(id) => <input id={id} type="password" className="ak-input" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={8} required />}</Field>
        {message && <p className="text-sm" role="status">{message}</p>}
        <Btn variant="primary" type="submit" disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />}{mode === 'in' ? 'Daxil ol' : 'Hesab yarat'}</Btn>
        <button type="button" className="text-sm font-semibold" style={{ color: 'var(--ad-accent-text)' }} onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMessage(null); }}>
          {mode === 'in' ? 'Hesabınız yoxdur? Hesab yaradın' : 'Hesabınız var? Daxil olun'}
        </button>
      </form>
    </div>
  );
}

export default function PartnerPanel() {
  const { user, loading, signOut } = useAuth();
  const qc = useQueryClient();
  const [invite] = useState(readInvite);
  const [accepting, setAccepting] = useState(false);
  const [selected, setSelected] = useState<string | null>(() => { try { return new URL(window.location.href).searchParams.get('p'); } catch { return null; } });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('admin-active');
    const prevTitle = document.title;
    document.title = 'Anacan · Partnyor paneli';
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex,nofollow'; document.head.appendChild(robots);
    return () => { root.classList.remove('admin-active'); document.title = prevTitle; robots.remove(); };
  }, []);

  const me = useQuery({
    queryKey: ['partner-panel', 'me', user?.id], enabled: !!user && !accepting,
    queryFn: () => prpc<PanelMe>('shop_partner_me_v1'),
  });

  useEffect(() => {
    if (!user || !invite) return;
    let cancelled = false;
    setAccepting(true);
    prpc<{ partner_id: string }>('shop_partner_accept_invite_v1', { p_token: invite })
      .then((r) => { if (cancelled) return; clearInvite(); setSelected(r.partner_id); toast.success('Mağaza hesabınıza qoşuldu'); })
      .catch((e: unknown) => { if (!cancelled) { toast.error(e instanceof PanelError ? e.message : 'Dəvət qəbul olunmadı'); if (!(e instanceof PanelError && /e-poçt/.test(e.message))) clearInvite(); } })
      .finally(() => { if (!cancelled) { setAccepting(false); qc.invalidateQueries({ queryKey: ['partner-panel', 'me'] }); } });
    return () => { cancelled = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const partners = me.data?.partners || [];
  const partner: PanelPartner | undefined = useMemo(() => partners.find((p) => p.id === selected) || partners[0], [partners, selected]);
  const choose = (id: string) => {
    setSelected(id);
    try { const url = new URL(window.location.href); url.searchParams.set('p', id); window.history.replaceState(null, '', url.pathname + url.search); } catch { /* ignore */ }
  };
  const out = async () => { await signOut(); qc.removeQueries({ queryKey: ['partner-panel'] }); };

  if (loading || (user && (me.isLoading || accepting))) {
    return <Shell><div className="grid place-items-center py-24"><Loader2 className="animate-spin" /></div></Shell>;
  }
  if (!user) return <ConfirmProvider><Shell><SignIn invite={!!invite} /></Shell></ConfirmProvider>;

  const right = (
    <span className="flex items-center gap-2 text-sm min-w-0">
      <span className="hidden sm:inline truncate" style={{ color: 'var(--ad-text-2)', maxWidth: 220 }}>{me.data?.email || user.email}</span>
      <Btn size="sm" variant="ghost" onClick={out}><LogOut size={14} />Çıxış</Btn>
    </span>
  );

  if (me.isError) return <Shell right={right}><Notice tone="warning">Panel yüklənmədi. Səhifəni yeniləyin.</Notice></Shell>;
  if (!partner) {
    return (
      <Shell right={right}>
        <div className="mx-auto grid max-w-lg gap-3 pt-8 text-center">
          <Store className="mx-auto" size={36} />
          <h1 className="text-xl font-bold">Bu hesab heç bir mağazaya bağlı deyil</h1>
          <p className="text-sm" style={{ color: 'var(--ad-text-2)' }}>Mağazanızın sahibindən və ya Anacan komandasından dəvət linki istəyin. Linki açıb dəvət olunan e-poçtla daxil olun.</p>
        </div>
      </Shell>
    );
  }

  return (
    <ConfirmProvider>
      <Shell right={right}>
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-12 items-center rounded-xl border bg-white px-3" style={{ borderColor: 'var(--ad-border)' }}>
                {partner.logo_url ? <img src={partner.logo_url} alt={partner.name} className="h-7 w-auto object-contain" /> : <b>{partner.name}</b>}
              </span>
              <div className="min-w-0">
                <h1 className="text-lg font-bold leading-tight">{partner.name}</h1>
                <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--ad-text-3)' }}>
                  <StatusPill tone={partner.status === 'live' ? 'success' : partner.status === 'paused' ? 'danger' : 'warning'}>{STATUS_LABEL[partner.status]}</StatusPill>
                  <span>Rolunuz: {ROLE_LABEL[partner.role]}</span>
                </div>
              </div>
            </div>
            {partners.length > 1 && (
              <select className="ak-select" value={partner.id} onChange={(e) => choose(e.target.value)} aria-label="Mağaza seçin">
                {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <PartnerWorkspace key={partner.id} partner={partner} />
        </div>
      </Shell>
    </ConfirmProvider>
  );
}

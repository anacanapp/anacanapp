import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BarChart3, ChevronRight, Download, Inbox, LayoutDashboard, LogOut, Mail, Menu, Megaphone, Palette, RefreshCw, Settings, ShieldCheck, Users, X } from 'lucide-react';
import logo from '@/assets/brand-mark.png';
import { APP_LANGUAGES, normalizeAppLanguage } from '@/lib/app-languages';
import { portalText, type PortalText } from './copy';
import { BRAND_LANGUAGE_KEY } from './client';
import { useBrandAuth } from './Auth';
import BrandReportView from './Report';
import BrandAdmin from './Admin';
import BrandAudienceView from './Audience';
import BrandCreativesView from './Creatives';
import BrandLeadsView from './Leads';

export type BrandTranslate = (key: PortalText, values?: Record<string, string | number>) => string;
const languageLabel: Record<string, string> = { az: 'Dil', en: 'Language', tr: 'Dil', ru: 'Язык', de: 'Sprache', ar: 'اللغة', ka: 'ენა', kk: 'Тіл', uz: 'Til', zh: '语言', id: 'Bahasa', fr: 'Langue', es: 'Idioma', pt: 'Idioma', vi: 'Ngôn ngữ', hi: 'भाषा', ja: '言語', ko: '언어', pl: 'Język', nl: 'Taal', sv: 'Språk' };
function Wordmark({ t }: { t: BrandTranslate }) {
  return <div className="brand-wordmark"><img src={logo} alt="Anacan" /><span>Anacan<small>{t('product')}</small></span></div>;
}
function Language({ language, setLanguage }: { language: string; setLanguage: (value: string) => void }) {
  return <select className="brand-select" aria-label={languageLabel[language]} value={language} onChange={event => setLanguage(event.target.value)}>
    {APP_LANGUAGES.map(item => <option key={item.code} value={item.code}>{item.native_name}</option>)}
  </select>;
}
function Login({ t, language, setLanguage }: { t: BrandTranslate; language: string; setLanguage: (value: string) => void }) {
  const { signIn } = useBrandAuth();
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(false);
    try { await signIn(email, password); setPassword(''); } catch { setError(true); } finally { setBusy(false); }
  };
  return <main className="brand-login" dir={language === 'ar' ? 'rtl' : 'ltr'} data-testid="brand-login">
    <section className="brand-login-story"><Wordmark t={t} /><h1>{t('login_title')}</h1><p>{t('login_body')}</p>
      <div className="brand-login-decoration" aria-hidden="true">{[26, 43, 38, 61, 54, 78, 72, 96].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
    </section>
    <section className="brand-login-form"><div><Language language={language} setLanguage={setLanguage} /><h2>{t('sign_in')}</h2>
      <form onSubmit={submit}><label>{t('email')}<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} /></label>
        <label>{t('password')}<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
        {error && <p className="brand-form-error" role="alert">{t('login_error')}</p>}
        <button className="brand-button primary" type="submit" disabled={busy}>{busy ? t('signing_in') : t('sign_in')}<ChevronRight size={16} /></button>
      </form><small>{t('access')}<br /><a href="mailto:jamil@anacan.az">{t('contact')}</a></small>
    </div></section>
  </main>;
}
function EmptyAccess({ t, loading = false }: { t: BrandTranslate; loading?: boolean }) {
  const { signOut, reload, accessError } = useBrandAuth();
  return <main className="brand-login brand-access-page"><div className="brand-empty"><ShieldCheck size={34} />
    <strong>{loading ? t('loading') : accessError ? t('unavailable') : t('no_access_title')}</strong>
    {!loading && <><p>{t('no_access_body')}</p><div className="brand-actions"><button className="brand-button" onClick={reload}><RefreshCw size={15} />{t('refresh')}</button>
      <button className="brand-button" onClick={() => { void signOut(); }}>{t('sign_out')}</button><a className="brand-button" href="mailto:jamil@anacan.az">{t('contact')}</a></div></>}
  </div></main>;
}
function Workspace({ t, language, setLanguage, admin = false }: { t: BrandTranslate; language: string; setLanguage: (value: string) => void; admin?: boolean }) {
  const { brandId } = useParams(), { access, session, signOut } = useBrandAuth();
  const location = useLocation(), navigate = useNavigate(), [menuOpen, setMenuOpen] = useState(false);
  const brand = access?.brands.find(item => item.id === brandId);
  const view = location.pathname.split('/')[2] || 'overview';
  useEffect(() => setMenuOpen(false), [location.pathname]);
  if (!access || admin && !access.admin) return <EmptyAccess t={t} />;
  if (!admin && !brand) return <div className="brand-access-page"><div className="brand-empty"><strong>{t('forbidden')}</strong><Link className="brand-button" to="/">{t('select_brand')}</Link></div></div>;
  const navigation = [
    ['overview', LayoutDashboard], ['ads', Megaphone], ['placements', BarChart3], ['audience', Users], ['creatives', Palette], ['leads', Inbox], ['reports', Download],
  ] as const;
  return <div className="brand-portal" dir={language === 'ar' ? 'rtl' : 'ltr'} data-testid="brand-portal" data-brand={brand?.id ?? 'admin'}>
    {menuOpen && <button className="brand-menu-scrim" aria-label={t('close')} onClick={() => setMenuOpen(false)} />}
    <aside className="brand-sidebar" data-open={menuOpen}><Wordmark t={t} /><button className="brand-menu-close" aria-label={t('close')} onClick={() => setMenuOpen(false)}><X size={20} /></button>
      <nav aria-label={t('workspace')}>{brand && navigation.map(([name, Icon]) => <Link key={name} to={`/${brand.id}/${name}`} className="brand-nav-item" aria-current={!admin && view === name ? 'page' : undefined}>
        <Icon size={18} /><span>{t(name)}</span></Link>)}
        {access.admin && <Link to="/manage" className="brand-nav-item" aria-current={admin ? 'page' : undefined}><Settings size={18} /><span>{t('admin_title')}</span></Link>}
      </nav><div className="brand-sidebar-bottom"><span>{t('access')}</span><a href="mailto:jamil@anacan.az"><Mail size={15} />{t('contact')}</a>
        <button onClick={() => { void signOut(); }}><LogOut size={15} />{t('sign_out')}</button></div>
    </aside>
    <main className="brand-main"><header className="brand-topbar"><div className="brand-topbar-actions"><button className="brand-button brand-mobile-menu" aria-label={t('workspace')} onClick={() => setMenuOpen(true)}><Menu size={19} /></button>
      <div><strong>{admin ? t('admin_title') : brand?.name}</strong><small>{access.admin ? t('admin_preview') : t('workspace')}</small></div></div>
      <div className="brand-topbar-actions">{access.brands.length > 1 && <select className="brand-select" aria-label={t('select_brand')} value={brand?.id ?? ''} onChange={event => navigate('/' + event.target.value)}>
        {!brand && <option value="">{t('select_brand')}</option>}{access.brands.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select>}
        <Language language={language} setLanguage={setLanguage} /><span className="brand-avatar" title={session?.user.email}>{(brand?.name || session?.user.email || 'A').slice(0, 1).toUpperCase()}</span>
        <button className="brand-button brand-logout-compact" aria-label={t('sign_out')} onClick={() => { void signOut(); }}><LogOut size={16} /></button>
      </div></header><div className="brand-scroll"><div className="brand-inner">{admin ? <BrandAdmin t={t} language={language} />
        : view === 'audience' ? <BrandAudienceView key={brand!.id} brand={brand!} t={t} language={language} />
        : view === 'creatives' ? <BrandCreativesView key={brand!.id} brand={brand!} t={t} language={language} />
        : view === 'leads' ? <BrandLeadsView key={brand!.id} brand={brand!} t={t} language={language} />
        : <BrandReportView key={brand!.id} brand={brand!} view={view} t={t} language={language} />}</div></div>
    </main>
  </div>;
}
function Start() {
  const { access } = useBrandAuth();
  return <Navigate replace to={access?.brands[0] ? '/' + access.brands[0].id : '/manage'} />;
}
export function BrandPanel({ title, hint, children, action }: { title: string; hint?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="brand-panel"><div className="brand-panel-head"><div><h2>{title}</h2>{hint && <p className="hint">{hint}</p>}</div>{action}</div>{children}</section>;
}
export default function BrandPortal() {
  const { session, access, loading } = useBrandAuth();
  const [language, setLanguage] = useState(() => { try { return normalizeAppLanguage(localStorage.getItem(BRAND_LANGUAGE_KEY) || 'az'); } catch { return 'az'; } });
  const t: BrandTranslate = (key, values) => portalText(key, language, values);
  useEffect(() => {
    document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem(BRAND_LANGUAGE_KEY, language); } catch { /* The optional UI preference must not break an authenticated session. */ }
  }, [language]);
  const updateLanguage = (value: string) => setLanguage(normalizeAppLanguage(value));
  if (loading) return <EmptyAccess t={t} loading />;
  if (!session) return <Login t={t} language={language} setLanguage={updateLanguage} />;
  if (!access?.allowed) return <EmptyAccess t={t} />;
  return <Routes><Route path="/" element={<Start />} /><Route path="/manage" element={<Workspace t={t} language={language} setLanguage={updateLanguage} admin />} />
    <Route path="/:brandId/*" element={<Workspace t={t} language={language} setLanguage={updateLanguage} />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes>;
}

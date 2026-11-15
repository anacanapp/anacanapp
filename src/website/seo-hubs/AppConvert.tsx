/**
 * App conversion blocks of the SEO content pages (owner request 2026-11-15): the website gives a short answer,
 * the full guide lives in the Anacan app. Every block opens the installed app when it can (same deep link logic as
 * the tool card) and otherwise offers the stores with a campaign that names the page and the block:
 * `web_seo_<area>_<block>` (gate, inline, pill, sticky).
 *
 * The locked list only names what the app has. No page text is hidden from visitors or crawlers (no cloaking):
 * the faded lines in the gate are drawn with CSS, they are not real text.
 */
import { useEffect, useState } from 'react';
import { Lock, Smartphone, Star, X } from 'lucide-react';
import { useWebsite } from '../context';
import { Arrow } from '../components';
import { appDeepLinks, type AppToolId } from '../tools/AppOpen';
import { storeUrl, trackStoreClick } from '../store-links';
import './seo-hubs.css';

type Device = 'ios' | 'android' | 'desktop';
function device(): Device {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}
function track(name: string, params: Record<string, string>) {
  try { (window as unknown as { anacanAnalytics?: { track: (n: string, p: Record<string, string>) => void } }).anacanAnalytics?.track(name, params); } catch { /* never block */ }
}

/** Try the installed app; if the page is still visible after a moment, show the stores. Desktop follows the link (download page with QR). */
function useAppOpen(tool: AppToolId, src: string) {
  const { route } = useWebsite();
  const [fallback, setFallback] = useState<'ios' | 'android' | null>(null);
  const open = (event: React.MouseEvent<HTMLAnchorElement>, block: string) => {
    const kind = device();
    track('app_open_click', { button: block, tool, src, platform: kind });
    if (kind === 'desktop') return;
    event.preventDefault();
    let left = false;
    const hide = () => { left = true; };
    document.addEventListener('visibilitychange', hide, { once: true });
    window.addEventListener('pagehide', hide, { once: true });
    const links = appDeepLinks(tool, src, route.language);
    window.location.href = kind === 'android' ? links.intent : links.scheme;
    window.setTimeout(() => { if (!left && !document.hidden) setFallback(kind); }, 1600);
  };
  return { open, fallback };
}

function StoreButtons({ placement, only }: { placement: string; only?: 'ios' | 'android' | null }) {
  const { route } = useWebsite();
  const link = (store: 'ios' | 'android') => storeUrl(store, placement, route.language);
  return <div className="sh-stores">
    {only !== 'android' && <a href={link('ios')} data-store="ios" target="_blank" rel="noopener noreferrer"
      onClick={() => trackStoreClick('ios', placement, route.kind, route.language, link('ios'))}><Smartphone aria-hidden="true" size={15}/>App Store</a>}
    {only !== 'ios' && <a href={link('android')} data-store="android" target="_blank" rel="noopener noreferrer"
      onClick={() => trackStoreClick('android', placement, route.kind, route.language, link('android'))}><Smartphone aria-hidden="true" size={15}/>Google Play</a>}
  </div>;
}

export interface AppGateProps {
  tool: AppToolId; area: string;
  /** "Davamı Anacan tətbiqində" style heading and one sentence. */
  title: string; text: string;
  /** Section names of what the app adds (shown with a lock). */
  locked: string[];
  premium?: boolean;
}
/** Main block after the short answer: what the website does not show, and the button to get it. */
export function AppGate({ tool, area, title, text, locked, premium }: AppGateProps) {
  const { href } = useWebsite();
  const src = `web-seo-${area}`, placement = `seo_${area}_gate`;
  const { open, fallback } = useAppOpen(tool, src);
  return <section className="sh-gate" aria-labelledby={`sh-gate-${area}`}>
    <div className="sh-gate-fade" aria-hidden="true"><span/><span/><span/><span/></div>
    <div className="sh-gate-card">
      <div className="sh-gate-head">
        <img src="/website/brand-glyph-coral.png" width="44" height="44" alt=""/>
        <div><p className="sh-gate-kicker">{premium ? 'Anacan tətbiqində · Premium bələdçi' : 'Anacan tətbiqində · Pulsuz'}</p>
          <h2 id={`sh-gate-${area}`}>{title}</h2></div>
      </div>
      <p className="sh-gate-text">{text}</p>
      <ul className="sh-locked">{locked.map(item => <li key={item}><Lock aria-hidden="true" size={15} strokeWidth={2}/>{item}</li>)}</ul>
      <div className="sh-gate-actions">
        <a className="site-primary-button sh-gate-open" href={href('download')} onClick={event => open(event, 'gate')} data-app-tool={tool}>Tətbiqdə davam et<Arrow diagonal/></a>
        {fallback && <p className="sh-fallback" role="status">Tətbiq açılmadısa, hələ telefonunuzda yoxdur. Pulsuz yükləyin:</p>}
        <StoreButtons placement={placement} only={fallback}/>
      </div>
      <p className="sh-gate-trust"><Star aria-hidden="true" size={14}/>Hamiləlik, körpə və aybaşı izləmə bir tətbiqdə · 23 dil</p>
    </div>
  </section>;
}

/** Thin banner between sections. */
export function AppInline({ tool, area, text, cta = 'Tətbiqi yüklə' }: { tool: AppToolId; area: string; text: string; cta?: string }) {
  const { href } = useWebsite();
  const { open, fallback } = useAppOpen(tool, `web-seo-${area}-inline`);
  return <aside className="sh-inline">
    <img src="/website/brand-glyph-coral.png" width="32" height="32" alt=""/>
    <p>{text}</p>
    {fallback ? <StoreButtons placement={`seo_${area}_inline`} only={fallback}/> :
      <a className="sh-inline-btn" href={href('download')} onClick={event => open(event, 'inline')}>{cta}<Arrow diagonal/></a>}
  </aside>;
}

/** Small pill under the page heading: tells the reader at once that the full version is in the app. */
export function AppPill({ tool, area, text = 'Tam bələdçi Anacan tətbiqindədir' }: { tool: AppToolId; area: string; text?: string }) {
  const { href } = useWebsite();
  const { open } = useAppOpen(tool, `web-seo-${area}-pill`);
  return <a className="sh-pill" href={href('download')} onClick={event => open(event, 'pill')}>
    <img src="/website/brand-glyph-coral.png" width="20" height="20" alt=""/>{text}<span>Pulsuz yüklə</span></a>;
}

const STICKY_KEY = 'anacan_sh_sticky_closed';
/** Bar fixed to the bottom of the screen after the first scroll; closing it hides it for the session. */
export function AppSticky({ tool, area, text }: { tool: AppToolId; area: string; text: string }) {
  const { href } = useWebsite();
  const { open, fallback } = useAppOpen(tool, `web-seo-${area}-sticky`);
  const [shown, setShown] = useState(false), [closed, setClosed] = useState(false);
  useEffect(() => {
    try { if (sessionStorage.getItem(STICKY_KEY)) { setClosed(true); return; } } catch { /* storage unavailable */ }
    const onScroll = () => setShown(window.scrollY > 320);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (closed) return null;
  const close = () => { setClosed(true); try { sessionStorage.setItem(STICKY_KEY, '1'); } catch { /* storage unavailable */ } track('app_sticky_close', { area }); };
  return <div className={`sh-sticky${shown ? ' is-shown' : ''}`} role="region" aria-label="Anacan tətbiqi">
    <img src="/website/brand-glyph-coral.png" width="36" height="36" alt=""/>
    <p><strong>{text}</strong><span>Pulsuz · iOS və Android</span></p>
    {fallback ? <StoreButtons placement={`seo_${area}_sticky`} only={fallback}/> :
      <a className="site-primary-button sh-sticky-btn" href={href('download')} onClick={event => open(event, 'sticky')}>Yüklə</a>}
    <button type="button" className="sh-sticky-close" onClick={close} aria-label="Bağla"><X size={16}/></button>
  </div>;
}

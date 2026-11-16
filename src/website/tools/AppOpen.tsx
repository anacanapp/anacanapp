/**
 * "Open in the app" card for the website tool pages. app.anacan.az is login-restricted in a browser, so web
 * visitors are never sent there. On a phone the button tries the installed app (iOS: anacan://tool/<id>,
 * Android: intent:// with package com.atlasoon.anacan and the Play Store as browser_fallback_url, like
 * public/website/premium/app/). If the page is still visible after a moment, store buttons are offered.
 * Without JavaScript and on desktop the button is a plain link to the download page with its QR code.
 * The `src` query is ignored by parseDeeplink for /tool/<id> (only widget_action is read).
 * `pregnancy` opens the app's home tab (anacan://?src=…, parseDeeplink path "/"), which is the pregnancy
 * tracker (Dashboard: week, baby size) for pregnant users.
 */
import { useState } from 'react';
import { Check, Smartphone } from 'lucide-react';
import { useWebsite } from '../context';
import { Arrow, Eyebrow } from '../components';
import { storeUrl, trackStoreClick } from '../store-links';

/** App tools (anacan://tool/<id>), the calendar screen (anacan://calendar) and the home tab ('pregnancy'). */
export type AppToolId = 'names' | 'maternity-calculator' | 'weight' | 'baby-growth' | 'calendar' | 'pregnancy'
  | 'safety' | 'solid-food-guide' | 'first-aid' | 'baby-tracker';
export interface AppOpenLabels { eyebrow: string; open: string; fallback: string; store?: string }
const LABELS: Record<'az' | 'ka' | 'ru' | 'tr' | 'uz' | 'kk' | 'es', AppOpenLabels> = {
  az: { eyebrow: 'Anacan tətbiqi', open: 'Tətbiqdə aç', fallback: 'Tətbiq açılmadısa, yəqin ki, hələ telefonunuzda yoxdur. Yükləyin:', store: 'Yüklə' },
  ka: { eyebrow: 'Anacan აპლიკაცია', open: 'აპლიკაციაში გახსნა', fallback: 'თუ აპლიკაცია არ გაიხსნა, ალბათ ჯერ არ გაქვთ დაინსტალირებული. ჩამოტვირთეთ:', store: 'ჩამოტვირთვა' },
  ru: { eyebrow: 'Приложение Anacan', open: 'Открыть в приложении', fallback: 'Если приложение не открылось, его, скорее всего, еще нет на телефоне. Скачайте:', store: 'Скачать' },
  tr: { eyebrow: 'Anacan uygulaması', open: 'Uygulamada aç', fallback: 'Uygulama açılmadıysa muhtemelen telefonunuzda yüklü değil. İndirin:', store: 'İndir' },
  uz: { eyebrow: 'Anacan ilovasi', open: 'Ilovada ochish', fallback: 'Ilova ochilmagan boʻlsa, ehtimol u telefoningizda hali yoʻq. Yuklab oling:', store: 'Yuklab olish' },
  kk: { eyebrow: 'Anacan қосымшасы', open: 'Қосымшада ашу', fallback: 'Қосымша ашылмаса, ол әлі телефоныңызда жоқ шығар. Жүктеп алыңыз:', store: 'Жүктеу' },
  es: { eyebrow: 'App Anacan', open: 'Abrir en la app', fallback: 'Si la app no se abrió, probablemente aún no la tienes. Descárgala:', store: 'Descargar' },
};

export function appDeepLinks(tool: AppToolId, src: string, language = 'az') {
  const path = `${tool === 'pregnancy' ? '' : tool === 'calendar' ? 'calendar' : `tool/${tool}`}?src=${encodeURIComponent(src)}`;
  return {
    scheme: `anacan://${path}`,
    intent: `intent://${path}#Intent;scheme=anacan;package=com.atlasoon.anacan;S.browser_fallback_url=${encodeURIComponent(storeUrl('android', `tool_${tool}_open`, language))};end`,
  };
}
function platform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return 'desktop';
}

/** `labels` lets pages in other languages pass their own button texts (az/ka are built in). */
export function AppToolCard({ tool, src, title, text, features, labels: custom }: { tool: AppToolId; src: string; title: string; text: string; features: string[]; labels?: AppOpenLabels }) {
  const { href, route } = useWebsite();
  const labels = custom || LABELS[route.language as keyof typeof LABELS] || LABELS.az;
  const [fallback, setFallback] = useState<'ios' | 'android' | null>(null);
  const open = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const device = platform();
    try { (window as unknown as { anacanAnalytics?: { track: (name: string, params: Record<string, string>) => void } }).anacanAnalytics?.track('app_open_click', { button: 'tool', tool, src, platform: device }); } catch { /* never block */ }
    if (device === 'desktop') return;
    event.preventDefault();
    let left = false;
    const hide = () => { left = true; };
    document.addEventListener('visibilitychange', hide, { once: true });
    window.addEventListener('pagehide', hide, { once: true });
    const links = appDeepLinks(tool, src, route.language);
    window.location.href = device === 'android' ? links.intent : links.scheme;
    // iOS may still show its "Open in Anacan?" prompt, so the store is offered, never opened automatically.
    window.setTimeout(() => { if (!left && !document.hidden) setFallback(device); }, 1600);
  };
  return <section className="tl-app" aria-labelledby={`tl-app-${tool}`}>
    <div className="tl-app-mark"><img src="/website/brand-glyph-coral.png" width="40" height="40" alt=""/></div>
    <div className="tl-app-copy">
      <Eyebrow mint>{labels.eyebrow}</Eyebrow>
      <h2 id={`tl-app-${tool}`}>{title}</h2>
      <p>{text}</p>
      <ul>{features.map(feature => <li key={feature}><Check aria-hidden="true" size={16} strokeWidth={2}/>{feature}</li>)}</ul>
    </div>
    <div className="tl-app-actions">
      <a className="site-primary-button" href={href('download')} onClick={open} data-app-tool={tool}>{labels.open}<Arrow diagonal/></a>
      {fallback && <p className="tl-app-fallback" role="status">{labels.fallback}</p>}
      <div className="tl-app-stores">
        {fallback !== 'android' && <a href={storeUrl('ios', `tool_${tool}`, route.language)} onClick={() => trackStoreClick('ios', `tool_${tool}`, route.kind, route.language, storeUrl('ios', `tool_${tool}`, route.language))} data-store="ios" target="_blank" rel="noopener noreferrer"><Smartphone aria-hidden="true" size={15}/>App Store</a>}
        {fallback !== 'ios' && <a href={storeUrl('android', `tool_${tool}`, route.language)} onClick={() => trackStoreClick('android', `tool_${tool}`, route.kind, route.language, storeUrl('android', `tool_${tool}`, route.language))} data-store="android" target="_blank" rel="noopener noreferrer"><Smartphone aria-hidden="true" size={15}/>Google Play</a>}
      </div>
    </div>
  </section>;
}

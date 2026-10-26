import { appLaunchLinks, entryLanguage, entryPlatform } from './policy.mjs';
import { entryText } from './text';
import './entry.css';

export function mountAppLauncher(input = window.location.href, auto = true): () => void {
  const language = entryLanguage(input), links = appLaunchLinks(input);
  const platform = entryPlatform(navigator);
  const store = platform === 'ios' || platform === 'mac' ? links.appStore : links.googlePlay;
  const nativeLink = platform === 'android' ? links.androidIntent : links.scheme;
  document.documentElement.classList.remove('anacan-public-blog', 'anacan-public-website');
  document.documentElement.classList.add('anacan-entry');
  document.documentElement.lang = language; document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  const root = document.getElementById('root'); if (!root) return () => {};
  const main = document.createElement('main'); main.className = 'entry-card'; main.dataset.appLauncher = platform;
  const logo = document.createElement('img'); logo.src = '/brand-mark.png'; logo.alt = ''; logo.width = 88; logo.height = 88;
  const title = document.createElement('h1'); title.textContent = 'Anacan';
  const message = document.createElement('p'); message.textContent = entryText('opening', language); message.setAttribute('role', 'status');
  const open = document.createElement('a'); open.className = 'entry-primary'; open.href = nativeLink; open.textContent = entryText('openApp', language);
  const stores = document.createElement('div'); stores.className = 'entry-store-links';
  for (const [label, href] of [['App Store', links.appStore], ['Google Play', links.googlePlay]]) {
    const link = document.createElement('a'); link.href = href; link.textContent = label; stores.append(link);
  }
  const note = document.createElement('p'); note.className = 'entry-note'; note.textContent = entryText('storeFallback', language);
  main.append(logo, title, message, open, stores, note); root.replaceChildren(main);
  let timer = 0, launched = false, attempted = false;
  const cancel = () => { launched = true; window.clearTimeout(timer); };
  const hidden = () => { if (document.visibilityState === 'hidden') cancel(); };
  window.addEventListener('pagehide', cancel); document.addEventListener('visibilitychange', hidden);
  const launch = () => {
    if (attempted && auto) return; attempted = true; launched = false; window.clearTimeout(timer);
    if (platform === 'desktop' || platform === 'mac') { window.location.replace(store); return; }
    timer = window.setTimeout(() => {
      if (!launched && document.visibilityState !== 'hidden') window.location.replace(store);
    }, 2200);
    try { window.location.assign(nativeLink); } catch { /* A browser may require the visible open button. */ }
  };
  open.addEventListener('click', () => {
    launched = false; window.clearTimeout(timer);
    timer = window.setTimeout(() => { if (!launched && !document.hidden) window.location.replace(store); }, 2200);
  });
  if (auto) timer = window.setTimeout(launch, 80);
  return () => { window.clearTimeout(timer); window.removeEventListener('pagehide', cancel); document.removeEventListener('visibilitychange', hidden); };
}

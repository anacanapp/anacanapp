// MUST be the very first import — polyfills for Android 11 WebView (Chrome 90)
// and old iOS Safari. Without this Object.hasOwn etc. crash the app at startup.
import "./lib/polyfills";
import "./index.css";
import './styles/startup.css';
import { bootstrapBackend } from './integrations/supabase/backend-bootstrap';
import { BackendAdmissionError } from './integrations/supabase/backend-admission';
import { startupText, storedStartupLanguage } from './lib/startup-i18n';
import { Capacitor } from '@capacitor/core';
import { isBrandPortalPath } from './brand-portal/routing';
import { isWebsitePath } from './website/routing';
import { isChunkLoadError, reloadOnceForChunkError } from './lib/chunk-reload';

// Catch dynamic import / chunk load errors (happens when a new version is deployed
// and the browser tries to fetch old, deleted chunk hashes). Reload once to fetch
// the latest index.html and assets; the guard prevents an endless reload loop.
window.addEventListener("error", (e) => {
  if (isChunkLoadError(e.error ?? e.message)) reloadOnceForChunkError();
});
window.addEventListener("unhandledrejection", (e) => {
  if (isChunkLoadError(e.reason)) reloadOnceForChunkError();
});
// Keep app imports behind admission: i18n/native/crashReporter also import the
// Supabase singleton and would otherwise refresh a source token on the wrong host.
async function bootstrap() {
  try {
    if (!Capacitor.isNativePlatform() && (window as Window & { __anacanLaunchHandled?: boolean }).__anacanLaunchHandled) return;
    if (import.meta.env.VITE_NATIVE_BUILD !== 'true' && !Capacitor.isNativePlatform()) {
      const { handleBrowserEntry } = await import('./web-entry/bootstrap');
      if (await handleBrowserEntry()) return;
    }
    if (import.meta.env.VITE_NATIVE_BUILD !== 'true' && !Capacitor.isNativePlatform() && isWebsitePath(window.location.pathname,window.location.hostname)) {
      const { startWebsite } = await import('./website/bootstrap');
      await startWebsite(); return;
    }
    // The web business portal has its own auth/query realm. Native builds remove
    // this import branch and never mount the portal through an app deep link.
    if (import.meta.env.VITE_NATIVE_BUILD !== 'true' && !Capacitor.isNativePlatform() && isBrandPortalPath(window.location.pathname)) {
      const { startBrandPortal } = await import('./brand-portal/bootstrap');
      startBrandPortal(); return;
    }
    if (import.meta.env.VITE_NATIVE_BUILD !== 'true' && !Capacitor.isNativePlatform() && /^\/blog(?:\/|$)/.test(window.location.pathname)) {
      const { startPublicBlog } = await import('./public-blog/bootstrap');
      startPublicBlog(); return;
    }
    await bootstrapBackend();
    const { startApp } = await import('./bootstrap-app');
    await startApp();
  } catch (error) {
    // No login form or SDK is imported on admission failure. Storage stays intact.
    const container = document.createElement('main');
    const language = storedStartupLanguage();
    container.lang = language;
    container.dir = language === 'ar' ? 'rtl' : 'ltr';
    container.className = 'min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center';
    const title = document.createElement('h1');
    title.className = 'text-xl font-semibold';
    title.textContent = 'Anacan';
    const message = document.createElement('p');
    message.textContent = error instanceof BackendAdmissionError && error.code === 'ADMISSION_UPDATE_REQUIRED'
      ? startupText(language, 'updateRequired', 'Davam etmək üçün Anacan tətbiqini mağazadan yeniləyin.')
      : startupText(language, 'connectionPending', 'Bağlantı hazırlanır. Bir qədər sonra yenidən cəhd edin.');
    const retry = document.createElement('button');
    retry.className = 'rounded-xl bg-primary px-6 py-3 text-primary-foreground';
    retry.textContent = startupText(language, 'retry', 'Yenidən cəhd et');
    retry.onclick = () => window.location.reload();
    container.append(title, message, retry);
    document.getElementById('root')?.replaceChildren(container);
    import('@capacitor/splash-screen').then(({ SplashScreen }) => SplashScreen.hide()).catch(() => {});
  }
}

void bootstrap();

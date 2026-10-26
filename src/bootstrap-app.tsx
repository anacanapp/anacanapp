// Loaded only AFTER backend admission. Every app service below can import the SDK.
import { createRoot } from 'react-dom/client';
import { initializeNativeFeatures } from './lib/native';
import { initCrashReporter } from './lib/crashReporter';
import { initFacebookEvents } from './lib/facebook-events';
import { NativeSessionRecoveryPendingError, restoreAdmittedNativeSession, startNativeSessionSync } from './lib/session-persistence';
import { Preferences } from '@capacitor/preferences';
import { useUserStore } from '@/store/userStore';
import { ensureLanguageReady } from '@/lib/i18n';
import { applyDocumentDirection } from '@/lib/rtl';
import { watchBackendAdmission } from '@/integrations/supabase/backend-bootstrap';
import { supabase } from '@/integrations/supabase/client';
import { usesSourceFirstBootstrap } from '@/integrations/supabase/backend-config';
import { normalizeAppLanguage } from '@/lib/app-languages';
import RootErrorBoundary from '@/components/RootErrorBoundary';

async function restorePreferences() {
  try {
    const { value: storedLang } = await Preferences.get({ key: 'anacan_app_language' });
    if (storedLang) useUserStore.getState().setLanguage(storedLang);
    const { value: storedSelected } = await Preferences.get({ key: 'anacan_has_selected_language' });
    if (storedSelected === 'true') useUserStore.getState().setHasSelectedLanguage(true);
    const { value: storedIntro } = await Preferences.get({ key: 'anacan_has_seen_intro' });
    if (storedIntro === 'true') useUserStore.getState().setHasSeenIntro(true);
  } catch { console.warn('[bootstrap] restorePreferences failed'); }
}

export async function startApp() {
  // A transient refresh failure must not mount the login form. Bound startup even
  // when the SDK is retrying an unavailable grant; keep the backup for next boot.
  let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Always bounded: on a slow/captive network an unbounded token refresh kept
    // the startup screen up forever. The retry screen is shown instead.
    const restoration = restoreAdmittedNativeSession();
    await Promise.race([restoration, new Promise<never>((_, reject) => {
      recoveryTimer = setTimeout(() => reject(new NativeSessionRecoveryPendingError()), usesSourceFirstBootstrap() ? 8000 : 15000);
    })]);
  } catch (error) {
    await Promise.race([supabase.auth.stopAutoRefresh(), new Promise(resolve => setTimeout(resolve, 1000))]);
    throw error;
  } finally { clearTimeout(recoveryTimer); }

  initCrashReporter();
  initFacebookEvents();
  initializeNativeFeatures().catch(console.error);
  try {
    const cap = (window as any)?.Capacitor;
    if (typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform()) document.body.classList.add('native-app');
  } catch { /* Native styling is optional. */ }
  import('./lib/backButton').then(m => m.initBackButtonHandler()).catch(console.error);

  // The selected realm's backup is restored before React can show a login screen.
  // Bounded: a stuck native Preferences bridge must not hold the startup screen.
  await Promise.race([restorePreferences(), new Promise(resolve => setTimeout(resolve, 3000))]);
  try {
    const storedLanguage = useUserStore.getState().language;
    const lang = normalizeAppLanguage(storedLanguage);
    if (lang !== storedLanguage) useUserStore.getState().setLanguage(lang);
    applyDocumentDirection(lang);
    await ensureLanguageReady(lang);
  } catch (error) {
    // Bundled native seeds work offline. If a web chunk is unavailable, show
    // the SDK-free localized retry screen instead of mounting the wrong language.
    console.warn('[bootstrap] local language preparation failed');
    throw error;
  }
  startNativeSessionSync();
  const { default: App } = await import('./App');
  const root = createRoot(document.getElementById('root')!);
  root.render(<RootErrorBoundary><App /></RootErrorBoundary>);
  watchBackendAdmission(async () => {
    root.unmount();
    // Do not sign out or delete credentials to change authorities. A restart is
    // mandatory so all REST/Functions/Storage/Realtime callers choose together.
    await Promise.race([
      Promise.allSettled([supabase.auth.stopAutoRefresh(), supabase.removeAllChannels(),
        import('./lib/ads/native').then(module => module.removeNativeAdmobBanner())]),
      new Promise(resolve => setTimeout(resolve, 1000)),
    ]);
    window.location.reload();
  });
}

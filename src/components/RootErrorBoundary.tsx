import { Component, ErrorInfo, ReactNode } from 'react';
import { startupText, storedStartupLanguage } from '@/lib/startup-i18n';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-reload';
import { reportComponentCrash } from '@/lib/crashReporter';

/** Outermost boundary around <App/>. The inner ErrorBoundary is a child of App,
 * so errors in App's own hooks used to unmount the whole root and leave a dark,
 * empty screen. The fallback uses only inline light styles and SDK-free copy. */
export default class RootErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadOnceForChunkError()) return;
    try { reportComponentCrash(error, info.componentStack || undefined); } catch { /* never throw here */ }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    let language = 'az';
    try { language = storedStartupLanguage(); } catch { /* default */ }
    return (
      <main lang={language} dir={language === 'ar' ? 'rtl' : 'ltr'}
        style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: 32, textAlign: 'center', background: 'hsl(var(--background, 35 35% 97%))', color: 'hsl(var(--foreground, 20 30% 15%))', fontFamily: 'system-ui, sans-serif' }}>
        <img src="/brand-mark.png" alt="" width={72} height={72} />
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Anacan</h1>
        <button type="button" onClick={() => window.location.reload()}
          style={{ padding: '12px 24px', borderRadius: 12, border: 0, background: '#FF5A5F', color: '#fff', fontSize: 15, fontWeight: 600 }}>
          {startupText(language, 'retry', 'Yenidən cəhd et')}
        </button>
      </main>
    );
  }
}

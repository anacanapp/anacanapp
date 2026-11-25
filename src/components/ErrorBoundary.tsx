import { Component, ErrorInfo, ReactNode } from 'react';
import { tr } from '@/lib/tr';
import { reportComponentCrash } from '@/lib/crashReporter';
import { isChunkLoadError, isDeviceOffline, reloadOnceForChunkError, retryAfterChunkError } from '@/lib/chunk-reload';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  offline: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, offline: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, offline: isChunkLoadError(error) && isDeviceOffline() };
  }

  componentDidMount() {
    window.addEventListener('online', this.handleConnectivity);
    window.addEventListener('offline', this.handleConnectivity);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleConnectivity);
    window.removeEventListener('offline', this.handleConnectivity);
  }

  // The chunk-error reload itself is deferred to 'online' by chunk-reload; this only
  // keeps the offline/generic copy in sync with the connection.
  handleConnectivity = () => {
    if (this.state.hasError && isChunkLoadError(this.state.error)) this.setState({ offline: isDeviceOffline() });
  };

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    // A failed lazy chunk never recovers by re-rendering (React caches the
    // rejected import) and never reaches the window handlers — reload once.
    if (isChunkLoadError(error) && reloadOnceForChunkError()) return;
    reportComponentCrash(error, errorInfo.componentStack || undefined);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background text-foreground">
          {this.state.offline ? <p className="text-lg font-semibold mb-4 text-center" role="alert">
            {tr("errorboundary_offline_retry", "İnternet yoxdur, yenidən cəhd et")}
          </p> : <>
          <p className="text-lg font-semibold mb-2">{tr("errorboundary_xeta_bas_verdi_f22fba", "Xəta baş verdi")}</p>
          <p className="text-sm text-muted-foreground text-center mb-4">
            {this.state.error?.message || tr("errorboundary_namelum_xeta_aa30e7", "Nam\u0259lum x\u0259ta")}
          </p>
          </>}
          <button
            onClick={() => {
              if (isChunkLoadError(this.state.error)) {
                // Offline: no reload into the browser's offline page; it reloads on 'online'.
                if (!retryAfterChunkError()) this.setState({ offline: true });
                return;
              }
              this.setState({ hasError: false, error: null, offline: false });
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
            {tr("errorboundary_yeniden_cehd_et_d273ac", "Yenid\u0259n c\u0259hd et")}
          
          </button>
        </div>);

    }
    return this.props.children;
  }
}

export default ErrorBoundary;
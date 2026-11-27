import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { AdminLanguageProvider } from '@/contexts/AdminLanguageContext';
import { useAuth } from '@/hooks/useAuth';
import ErrorBoundary from './ErrorBoundary';
import AdminLayout from './admin/AdminLayout';
import { canonicalSection, isKnownSection } from './admin/registry';
import { prefetchSection, sectionComponent } from './admin/sections';
import { PageSkeleton } from './admin/kit/States';

/** Every historical id (including aliases such as `premium`, `notifications`, `ads`, `flow-symptoms`) and `revenuecat-debug`. */
export const isAdminSection = (value: string) => isKnownSection(value);
interface AdminPanelProps { onExit: () => void; initialTab?: string; onSectionChange?: (section: string) => void }

export default function AdminPanel({ onExit, initialTab = 'dashboard', onSectionChange }: AdminPanelProps) {
  const { user, isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(() => (isAdminSection(initialTab) ? initialTab : 'dashboard'));
  const history = useRef<string[]>([]), current = useRef(activeTab);
  current.current = activeTab;
  useEffect(() => { setActiveTab(isAdminSection(initialTab) ? initialTab : 'dashboard'); }, [initialTab]);
  // Warm the most used chunks once the shell is idle.
  useEffect(() => {
    if (!user || !isAdmin) return;
    const warm = () => ['dashboard', 'orders', 'users'].forEach(prefetchSection);
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(warm); else setTimeout(warm, 1200);
  }, [user, isAdmin]);

  const navigate = useCallback((section: string) => {
    if (!isAdminSection(section)) return;
    const previous = current.current;
    if (canonicalSection(previous) !== canonicalSection(section)) history.current = [...history.current.slice(-30), previous];
    setActiveTab(section);
    onSectionChange?.(section);
  }, [onSectionChange]);

  const back = useCallback(() => {
    // URL mode: let the browser pop /admin/:section so the address bar stays truthful.
    if (onSectionChange && history.current.length && window.history.length > 1) { history.current.pop(); window.history.back(); return; }
    const previous = history.current.pop() ?? 'dashboard';
    setActiveTab(previous);
    onSectionChange?.(previous);
  }, [onSectionChange]);

  if (loading) return <div className="grid min-h-[50vh] place-items-center" role="status" aria-label="Yüklənir"><Loader2 className="animate-spin" /></div>;
  if (!user || !isAdmin) return <div className="grid min-h-[50vh] place-content-center gap-3 p-6 text-center"><ShieldCheck className="mx-auto" />Administrator hesabı tələb olunur.<button onClick={onExit}>Tətbiqə qayıt</button></div>;
  const Content = sectionComponent(activeTab);
  const key = canonicalSection(activeTab) ?? 'dashboard';
  return <AdminLanguageProvider><AdminLayout activeTab={activeTab} onTabChange={navigate} onExit={onExit} onBack={back}>
    <ErrorBoundary key={key}><Suspense fallback={<PageSkeleton />}>
      <Content onNavigate={navigate} />
    </Suspense></ErrorBoundary>
  </AdminLayout></AdminLanguageProvider>;
}

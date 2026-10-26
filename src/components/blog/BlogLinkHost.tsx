import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { OPEN_BLOG_EVENT, clearPendingBlog, rememberBlog, validBlogSlug } from '@/lib/blog-links';
import { pushBackHandler } from '@/lib/backButton';
import { tr } from '@/lib/tr';
import { PUSH_NAV_EVENT } from '@/lib/pushNav';
import { BLOG_MODULE_EVENT } from '@/lib/blog-module-navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ErrorBoundary from '@/components/ErrorBoundary';

const BlogScreen = lazy(() => import('@/components/BlogScreen'));
/** An in-app article covers the current conversation instead of unmounting it,
 * preserving its draft, selected thread, reply and attachment preview. */
export default function BlogLinkHost({ children }: { children: (open: boolean) => ReactNode }) {
  const { user, profileLoaded } = useAuth(), lifeStage = useUserStore(state => state.lifeStage);
  const scope = `${getBackendConfig().url}:${user?.id || ''}`;
  const [link, setLink] = useState<{ slug: string; scope: string } | null>(null);
  const root = useRef<HTMLDivElement>(null), focused = useRef<HTMLElement | null>(null);
  const positions = useRef<Array<{ element: HTMLElement; top: number; left: number }>>([]);
  const open = !!link && link.scope === scope && !!user && profileLoaded;
  const close = useCallback(() => setLink(null), []);
  const restore = useCallback(() => {
    for (const item of positions.current) if (item.element.isConnected) { item.element.scrollTop = item.top; item.element.scrollLeft = item.left; }
    if (focused.current?.isConnected) focused.current.focus({ preventScroll: true });
    positions.current = []; focused.current = null;
  }, []);
  useEffect(() => { setLink(null); positions.current = []; focused.current = null; }, [scope]);
  useEffect(() => {
    const show = (event: Event) => {
      const slug = (event as CustomEvent).detail?.slug;
      if (!validBlogSlug(slug)) return;
      if (!user || !profileLoaded) { rememberBlog(slug); return; }
      if (!open) {
        focused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        positions.current = [...(root.current?.querySelectorAll<HTMLElement>('*') || [])].filter(element => element.scrollTop || element.scrollLeft).map(element => ({ element, top: element.scrollTop, left: element.scrollLeft }));
      }
      clearPendingBlog(); setLink({ slug, scope });
    };
    window.addEventListener(OPEN_BLOG_EVENT, show);
    return () => window.removeEventListener(OPEN_BLOG_EVENT, show);
  }, [scope, user, profileLoaded, open]);
  useEffect(() => open ? pushBackHandler(() => { close(); return true; }) : undefined, [open, close]);
  useEffect(() => { const navigate = () => close(); window.addEventListener(PUSH_NAV_EVENT, navigate); return () => window.removeEventListener(PUSH_NAV_EVENT, navigate); }, [close]);
  useEffect(() => { const navigate = () => close(); window.addEventListener(BLOG_MODULE_EVENT, navigate); return () => window.removeEventListener(BLOG_MODULE_EVENT, navigate); }, [close]);
  return <>
    <div ref={root} className="contents">{children(open)}</div>
    <Dialog open={open} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent data-blog-link-overlay data-app-viewport data-keyboard-surface="fullscreen"
        className="a-scope !inset-0 !start-0 !top-0 !translate-x-0 !translate-y-0 !max-w-none !w-full !h-full !block !rounded-none !border-0 !p-0 overflow-y-auto [&>button]:hidden"
        aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); restore(); }}>
        <DialogTitle className="sr-only">{tr('blogscreen_ana_bloqu_28124b', 'Qadın Bloqları')}</DialogTitle>
        {open && <ErrorBoundary key={link.slug}><Suspense fallback={<button className="a-icon-btn m-4" onClick={close}>{tr('common_geri', 'Geri')}</button>}>
          <BlogScreen initialSlug={link.slug} lifeStage={lifeStage} onBack={close} />
        </Suspense></ErrorBoundary>}
      </DialogContent>
    </Dialog>
  </>;
}

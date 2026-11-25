import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import StartupScreen from '@/components/StartupScreen';
import { useUserStore } from '@/store/userStore';
import { navigateFromPush } from '@/lib/pushNav';
import { appLinkForPath, rememberAppLink, takeAppLink } from '@/lib/app-path-links';
import NotFound from './NotFound';

/**
 * Catch-all route. A shared app path (/tools, /premium, /tool/<id>, /community/post/<id>, ...) opens the app
 * on that screen (after sign-in when needed); any other path is still the 404 page.
 */
export default function AppPathLink() {
  const location = useLocation(), navigate = useNavigate();
  const href = useMemo(() => appLinkForPath(location.pathname, location.search), [location.pathname, location.search]);
  useEffect(() => {
    if (!href) return;
    rememberAppLink(href);
    navigate('/', { replace: true });
  }, [href, navigate]);
  return href ? <StartupScreen /> : <NotFound />;
}

/**
 * Hands a remembered app link to Index's router once the user is signed in. Index applies it when the
 * profile is ready (same queue as notification taps). Mounted once inside the router.
 */
export function PendingAppLink() {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!isAuthenticated) return;
    const href = takeAppLink();
    if (href) navigateFromPush({ deeplink: href });
  }, [isAuthenticated, pathname]);
  return null;
}
